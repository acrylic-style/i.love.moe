import { managedAlbums } from "./albums";
import { planLimits, PLUS_PLAN } from "./plans";
import { authenticateSession } from "./service";
import {
  TAG_COLORS,
  type AlbumRow,
  type LibraryImageRow,
  type TagColor,
  type TagRow,
} from "./types";

export const LIBRARY_PAGE_SIZE = 48;
export const MAX_BULK_IMAGES = 100;
export const MAX_TAGS_PER_USER = 100;
export const MAX_TAGS_PER_IMAGE = 10;

export type LibrarySort = "newest" | "oldest" | "expiring" | "title";

export interface LibraryFilters {
  q: string;
  tag: string;
  server: string;
  visibility: "" | "public" | "unlisted" | "private" | "passphrase";
  favorite: boolean;
  from: number | null;
  to: number | null;
  expiring: boolean;
  sort: LibrarySort;
  cursor: string;
}

export interface ServerFacet {
  value: string;
  label: string;
}

export interface LibraryPage {
  images: LibraryImageRow[];
  tags: TagRow[];
  albums: AlbumRow[];
  servers: ServerFacet[];
  nextCursor: string | null;
}

interface CursorPayload {
  sort: LibrarySort;
  value: string | number;
  id: string;
}

interface LibraryDbRow extends Omit<LibraryImageRow, "tags"> {}

export function parseLibraryFilters(
  input: Record<string, string | string[] | undefined>,
): LibraryFilters {
  const one = (key: string) => {
    const value = input[key];
    return typeof value === "string" ? value : "";
  };
  const visibility = one("visibility");
  const sort = one("sort");
  return {
    q: one("q").trim().slice(0, 100),
    tag: one("tag").slice(0, 64),
    server: one("server").slice(0, 255),
    visibility:
      visibility === "public" ||
      visibility === "unlisted" ||
      visibility === "private" ||
      visibility === "passphrase"
        ? visibility
        : "",
    favorite: one("favorite") === "1",
    from: parseTimestamp(one("from")),
    to: parseTimestamp(one("to")),
    expiring: one("expiring") === "1",
    sort: sort === "oldest" || sort === "expiring" || sort === "title" ? sort : "newest",
    cursor: one("cursor").slice(0, 512),
  };
}

export function normalizeTagName(value: unknown): { name: string; normalized: string } | null {
  if (typeof value !== "string") return null;
  const name = value.normalize("NFKC").trim().replace(/\s+/gu, " ");
  if (name.length === 0 || [...name].length > 30) return null;
  return { name, normalized: name.toLocaleLowerCase("und") };
}

export function isTagColor(value: unknown): value is TagColor {
  return typeof value === "string" && (TAG_COLORS as readonly string[]).includes(value);
}

export function encodeLibraryCursor(payload: CursorPayload): string {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
}

export function decodeLibraryCursor(value: string, sort: LibrarySort): CursorPayload | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(
      new TextDecoder().decode(base64UrlToBytes(value)),
    ) as Partial<CursorPayload>;
    if (
      parsed.sort !== sort ||
      typeof parsed.id !== "string" ||
      parsed.id.length > 64 ||
      (sort === "title"
        ? typeof parsed.value !== "string"
        : typeof parsed.value !== "number" || !Number.isFinite(parsed.value))
    )
      return null;
    return parsed as CursorPayload;
  } catch {
    return null;
  }
}

export async function imageLibrary(
  env: CloudflareEnv,
  userId: string,
  filters: LibraryFilters,
): Promise<LibraryPage> {
  const now = Date.now();
  const clauses = [
    "i.owner_user_id = ?",
    "i.deleted_at IS NULL",
    "i.expires_at > ?",
    "s.retired_at IS NULL",
  ];
  const bindings: unknown[] = [userId, now];
  if (filters.q) {
    const pattern = `%${escapeLike(filters.q)}%`;
    clauses.push(`(
      i.title LIKE ? ESCAPE '\\' COLLATE NOCASE OR
      i.server_name LIKE ? ESCAPE '\\' COLLATE NOCASE OR
      i.server_address LIKE ? ESCAPE '\\' COLLATE NOCASE OR
      s.code LIKE ? ESCAPE '\\' COLLATE NOCASE OR
      EXISTS (
        SELECT 1 FROM image_tags qit JOIN tags qt ON qt.id = qit.tag_id
        WHERE qit.image_id = i.id AND qt.name LIKE ? ESCAPE '\\' COLLATE NOCASE
      )
    )`);
    bindings.push(pattern, pattern, pattern, pattern, pattern);
  }
  if (filters.tag) {
    clauses.push(
      "EXISTS (SELECT 1 FROM image_tags fit WHERE fit.image_id = i.id AND fit.tag_id = ?)",
    );
    bindings.push(filters.tag);
  }
  if (filters.server) {
    clauses.push("(i.server_address = ? OR (i.server_address IS NULL AND i.server_name = ?))");
    bindings.push(filters.server, filters.server);
  }
  if (filters.visibility) {
    if (filters.visibility === "public") {
      clauses.push("i.visibility = 'unlisted' AND i.discoverability = 'public'");
    } else if (filters.visibility === "unlisted") {
      clauses.push("i.visibility = 'unlisted' AND i.discoverability = 'hidden'");
    } else {
      clauses.push("i.visibility = ?");
      bindings.push(filters.visibility);
    }
  }
  if (filters.favorite) clauses.push("i.favorited_at IS NOT NULL");
  if (filters.from !== null) {
    clauses.push("i.created_at >= ?");
    bindings.push(filters.from);
  }
  if (filters.to !== null) {
    clauses.push("i.created_at < ?");
    bindings.push(filters.to);
  }
  if (filters.expiring) {
    clauses.push("i.expires_at <= ?");
    bindings.push(now + 7 * 24 * 60 * 60 * 1000);
  }

  const cursor = decodeLibraryCursor(filters.cursor, filters.sort);
  const sortExpression =
    filters.sort === "expiring"
      ? "i.expires_at"
      : filters.sort === "title"
        ? "COALESCE(i.title, '')"
        : "i.created_at";
  const direction = filters.sort === "newest" ? "DESC" : "ASC";
  if (cursor) {
    const comparison = direction === "DESC" ? "<" : ">";
    clauses.push(
      `(${sortExpression} ${comparison} ? OR (${sortExpression} = ? AND i.id ${comparison} ?))`,
    );
    bindings.push(cursor.value, cursor.value, cursor.id);
  }

  const rows = await env.DB.prepare(
    `SELECT i.id, i.title, i.server_address, i.server_name, i.r2_key, i.byte_size,
      i.width, i.height, i.created_at, i.expires_at, i.deleted_at, i.visibility,
      i.discoverability, i.server_id, i.access_version, i.storage_tier, i.favorited_at, s.code
    FROM images i
    JOIN short_links s ON s.target_type = 'image' AND s.target_id = i.id
    WHERE ${clauses.join(" AND ")}
    ORDER BY ${sortExpression} ${direction}, i.id ${direction}
    LIMIT ?`,
  )
    .bind(...bindings, LIBRARY_PAGE_SIZE + 1)
    .all<LibraryDbRow>();
  const hasMore = rows.results.length > LIBRARY_PAGE_SIZE;
  const pageRows = rows.results.slice(0, LIBRARY_PAGE_SIZE);
  const [tags, albums, servers, imageTags] = await Promise.all([
    userTags(env, userId),
    managedAlbums(env, userId),
    serverFacets(env, userId, now),
    tagsForImages(
      env,
      pageRows.map((image) => image.id),
    ),
  ]);
  const images = pageRows.map((image) => ({ ...image, tags: imageTags.get(image.id) ?? [] }));
  const last = images.at(-1);
  const nextCursor =
    hasMore && last
      ? encodeLibraryCursor({
          sort: filters.sort,
          value:
            filters.sort === "expiring"
              ? last.expires_at
              : filters.sort === "title"
                ? (last.title ?? "")
                : last.created_at,
          id: last.id,
        })
      : null;
  return { images, tags, albums, servers, nextCursor };
}

export async function userTags(env: CloudflareEnv, userId: string): Promise<TagRow[]> {
  const rows = await env.DB.prepare(
    `SELECT t.id, t.owner_user_id, t.name, t.normalized_name, t.color, t.created_at,
      t.updated_at, COUNT(it.image_id) AS image_count
    FROM tags t LEFT JOIN image_tags it ON it.tag_id = t.id
    WHERE t.owner_user_id = ?
    GROUP BY t.id
    ORDER BY t.normalized_name`,
  )
    .bind(userId)
    .all<TagRow>();
  return rows.results;
}

export async function createTag(request: Request, env: CloudflareEnv): Promise<Response> {
  const context = await mutationContext(request, env);
  if (context instanceof Response) return context;
  const body = await safeJson<{ name?: unknown; color?: unknown }>(request);
  const normalized = normalizeTagName(body?.name);
  if (!normalized || !isTagColor(body?.color)) return error("invalid_tag", 400);
  const count = await env.DB.prepare("SELECT COUNT(*) AS count FROM tags WHERE owner_user_id = ?")
    .bind(context.userId)
    .first<{ count: number }>();
  if ((count?.count ?? 0) >= MAX_TAGS_PER_USER) return error("tag_limit_reached", 409);
  const id = crypto.randomUUID();
  const now = Date.now();
  try {
    await env.DB.prepare(
      `INSERT INTO tags
        (id, owner_user_id, name, normalized_name, color, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(id, context.userId, normalized.name, normalized.normalized, body.color, now, now)
      .run();
  } catch (cause) {
    if (isUniqueFailure(cause)) return error("tag_exists", 409);
    throw cause;
  }
  return json({ tag: { id, name: normalized.name, color: body.color, image_count: 0 } }, 201);
}

export async function updateTag(
  request: Request,
  env: CloudflareEnv,
  id: string,
): Promise<Response> {
  const context = await mutationContext(request, env);
  if (context instanceof Response) return context;
  const body = await safeJson<{ name?: unknown; color?: unknown }>(request);
  const normalized = normalizeTagName(body?.name);
  if (!normalized || !isTagColor(body?.color)) return error("invalid_tag", 400);
  try {
    const result = await env.DB.prepare(
      `UPDATE tags SET name = ?, normalized_name = ?, color = ?, updated_at = ?
      WHERE id = ? AND owner_user_id = ?`,
    )
      .bind(normalized.name, normalized.normalized, body.color, Date.now(), id, context.userId)
      .run();
    if ((result.meta.changes ?? 0) !== 1) return error("not_found", 404);
  } catch (cause) {
    if (isUniqueFailure(cause)) return error("tag_exists", 409);
    throw cause;
  }
  return json({ saved: true });
}

export async function deleteTag(
  request: Request,
  env: CloudflareEnv,
  id: string,
): Promise<Response> {
  const context = await mutationContext(request, env);
  if (context instanceof Response) return context;
  const result = await env.DB.prepare("DELETE FROM tags WHERE id = ? AND owner_user_id = ?")
    .bind(id, context.userId)
    .run();
  if ((result.meta.changes ?? 0) !== 1) return error("not_found", 404);
  return json({ deleted: true });
}

type BulkAction = "favorite" | "unfavorite" | "add_tags" | "remove_tags" | "add_album" | "delete";

interface BulkBody {
  imageIds?: unknown;
  action?: unknown;
  tagIds?: unknown;
  albumId?: unknown;
}

export async function bulkOrganizeImages(request: Request, env: CloudflareEnv): Promise<Response> {
  const context = await mutationContext(request, env);
  if (context instanceof Response) return context;
  const body = await safeJson<BulkBody>(request);
  const imageIds = uniqueStringArray(body?.imageIds, MAX_BULK_IMAGES);
  const action = parseBulkAction(body?.action);
  if (!imageIds || imageIds.length === 0 || !action) return error("invalid_request", 400);
  const images = await ownedActiveImages(env, context.userId, imageIds);
  if (images.length !== imageIds.length) return error("images_changed", 409);

  if (action === "favorite" || action === "unfavorite") {
    await env.DB.batch(
      chunks(imageIds, 50).map((ids) => {
        const placeholders = ids.map(() => "?").join(",");
        return env.DB.prepare(
          `UPDATE images SET favorited_at = ?
          WHERE owner_user_id = ? AND id IN (${placeholders})`,
        ).bind(action === "favorite" ? Date.now() : null, context.userId, ...ids);
      }),
    );
    return json({ saved: true, imageIds });
  }
  if (action === "add_tags" || action === "remove_tags") {
    const tagIds = uniqueStringArray(body?.tagIds, MAX_TAGS_PER_IMAGE);
    if (!tagIds || tagIds.length === 0) return error("invalid_request", 400);
    if (!(await ownsAllTags(env, context.userId, tagIds))) return error("tags_changed", 409);
    if (action === "add_tags") {
      if (!(await canAddTags(env, imageIds, tagIds))) return error("image_tag_limit_reached", 409);
      const now = Date.now();
      await runStatementBatches(
        env,
        imageIds.flatMap((imageId) =>
          tagIds.map((tagId) =>
            env.DB.prepare(
              "INSERT OR IGNORE INTO image_tags (image_id, tag_id, created_at) VALUES (?, ?, ?)",
            ).bind(imageId, tagId, now),
          ),
        ),
      );
    } else {
      await env.DB.batch(
        chunks(imageIds, 50).map((ids) => {
          const imagePlaceholders = ids.map(() => "?").join(",");
          const tagPlaceholders = tagIds.map(() => "?").join(",");
          return env.DB.prepare(
            `DELETE FROM image_tags
            WHERE image_id IN (${imagePlaceholders}) AND tag_id IN (${tagPlaceholders})`,
          ).bind(...ids, ...tagIds);
        }),
      );
    }
    return json({ saved: true, imageIds });
  }
  if (action === "add_album") {
    if (typeof body?.albumId !== "string") return error("invalid_request", 400);
    const album = await env.DB.prepare(
      "SELECT id FROM albums WHERE id = ? AND owner_user_id = ? AND deleted_at IS NULL",
    )
      .bind(body.albumId, context.userId)
      .first<{ id: string }>();
    if (!album) return error("album_changed", 409);
    const existing = await env.DB.prepare(
      "SELECT image_id, position FROM album_images WHERE album_id = ? ORDER BY position",
    )
      .bind(album.id)
      .all<{ image_id: string; position: number }>();
    const existingIds = new Set(existing.results.map((row) => row.image_id));
    const additions = imageIds.filter((id) => !existingIds.has(id));
    if (existing.results.length + additions.length > PLUS_PLAN.imagesPerAlbum)
      return error("album_image_limit_reached", 409);
    if (additions.length > 0) {
      const start = existing.results.reduce((max, row) => Math.max(max, row.position), -1) + 1;
      const now = Date.now();
      await runStatementBatches(env, [
        ...additions.map((imageId, index) =>
          env.DB.prepare(
            "INSERT INTO album_images (album_id, image_id, position, added_at) VALUES (?, ?, ?, ?)",
          ).bind(album.id, imageId, start + index, now),
        ),
        env.DB.prepare("UPDATE albums SET updated_at = ? WHERE id = ?").bind(now, album.id),
      ]);
    }
    return json({ saved: true, imageIds, added: additions.length });
  }

  const succeededIds: string[] = [];
  const failedIds: string[] = [];
  for (const image of images) {
    const now = Date.now();
    try {
      // Delete the object first. R2 deletion is idempotent, so a later D1 failure can be retried
      // while the still-active row remains selectable.
      await env.IMAGES.delete(image.r2_key);
      await env.DB.batch([
        env.DB.prepare("UPDATE images SET deleted_at = COALESCE(deleted_at, ?) WHERE id = ?").bind(
          now,
          image.id,
        ),
        env.DB.prepare(
          "UPDATE short_links SET retired_at = COALESCE(retired_at, ?) WHERE code = ?",
        ).bind(now, image.code),
        env.DB.prepare("DELETE FROM album_images WHERE image_id = ?").bind(image.id),
        env.DB.prepare("DELETE FROM server_image_favorites WHERE image_id = ?").bind(image.id),
      ]);
      succeededIds.push(image.id);
    } catch {
      failedIds.push(image.id);
    }
  }
  return json(
    { saved: failedIds.length === 0, succeededIds, failedIds },
    failedIds.length ? 207 : 200,
  );
}

async function mutationContext(
  request: Request,
  env: CloudflareEnv,
): Promise<{ userId: string } | Response> {
  if (!sameOrigin(request)) return error("invalid_origin", 403);
  const session = await authenticateSession(request, env);
  if (!session) return error("not_found", 404);
  const limits = await planLimits(env, session.user_id);
  if (!limits.libraryOrganization) return error("plus_required", 403);
  return { userId: session.user_id };
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

async function serverFacets(
  env: CloudflareEnv,
  userId: string,
  now: number,
): Promise<ServerFacet[]> {
  const rows = await env.DB.prepare(
    `SELECT server_address, server_name, MAX(created_at) AS last_used
    FROM images
    WHERE owner_user_id = ? AND deleted_at IS NULL AND expires_at > ?
      AND (server_address IS NOT NULL OR server_name IS NOT NULL)
    GROUP BY server_address, server_name
    ORDER BY last_used DESC LIMIT 100`,
  )
    .bind(userId, now)
    .all<{ server_address: string | null; server_name: string | null }>();
  return rows.results.map((row) => ({
    value: row.server_address ?? row.server_name ?? "",
    label:
      row.server_name && row.server_address
        ? `${row.server_name} (${row.server_address})`
        : (row.server_name ?? row.server_address ?? ""),
  }));
}

async function tagsForImages(
  env: CloudflareEnv,
  imageIds: string[],
): Promise<Map<string, TagRow[]>> {
  const result = new Map<string, TagRow[]>();
  if (imageIds.length === 0) return result;
  const placeholders = imageIds.map(() => "?").join(",");
  const rows = await env.DB.prepare(
    `SELECT it.image_id, t.id, t.owner_user_id, t.name, t.normalized_name, t.color,
      t.created_at, t.updated_at
    FROM image_tags it JOIN tags t ON t.id = it.tag_id
    WHERE it.image_id IN (${placeholders})
    ORDER BY t.normalized_name`,
  )
    .bind(...imageIds)
    .all<TagRow & { image_id: string }>();
  for (const row of rows.results) {
    const tags = result.get(row.image_id) ?? [];
    tags.push(row);
    result.set(row.image_id, tags);
  }
  return result;
}

async function ownedActiveImages(
  env: CloudflareEnv,
  userId: string,
  imageIds: string[],
): Promise<Array<{ id: string; code: string; r2_key: string }>> {
  const result: Array<{ id: string; code: string; r2_key: string }> = [];
  const now = Date.now();
  for (const ids of chunks(imageIds, 50)) {
    const placeholders = ids.map(() => "?").join(",");
    const rows = await env.DB.prepare(
      `SELECT i.id, i.r2_key, s.code
      FROM images i JOIN short_links s ON s.target_type = 'image' AND s.target_id = i.id
      WHERE i.id IN (${placeholders}) AND i.owner_user_id = ? AND i.deleted_at IS NULL
        AND i.expires_at > ? AND s.retired_at IS NULL`,
    )
      .bind(...ids, userId, now)
      .all<{ id: string; code: string; r2_key: string }>();
    result.push(...rows.results);
  }
  return result;
}

async function ownsAllTags(env: CloudflareEnv, userId: string, tagIds: string[]): Promise<boolean> {
  const placeholders = tagIds.map(() => "?").join(",");
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS count FROM tags WHERE owner_user_id = ? AND id IN (${placeholders})`,
  )
    .bind(userId, ...tagIds)
    .first<{ count: number }>();
  return (row?.count ?? 0) === tagIds.length;
}

async function canAddTags(
  env: CloudflareEnv,
  imageIds: string[],
  tagIds: string[],
): Promise<boolean> {
  const byImage = new Map<
    string,
    { image_id: string; current_count: number; already_count: number }
  >();
  for (const ids of chunks(imageIds, 50)) {
    const imagePlaceholders = ids.map(() => "?").join(",");
    const tagPlaceholders = tagIds.map(() => "?").join(",");
    const rows = await env.DB.prepare(
      `SELECT image_id,
        COUNT(*) AS current_count,
        SUM(CASE WHEN tag_id IN (${tagPlaceholders}) THEN 1 ELSE 0 END) AS already_count
      FROM image_tags WHERE image_id IN (${imagePlaceholders}) GROUP BY image_id`,
    )
      .bind(...tagIds, ...ids)
      .all<{ image_id: string; current_count: number; already_count: number }>();
    for (const row of rows.results) byImage.set(row.image_id, row);
  }
  return imageIds.every((id) => {
    const row = byImage.get(id);
    return (
      (row?.current_count ?? 0) + tagIds.length - (row?.already_count ?? 0) <= MAX_TAGS_PER_IMAGE
    );
  });
}

function parseBulkAction(value: unknown): BulkAction | null {
  return value === "favorite" ||
    value === "unfavorite" ||
    value === "add_tags" ||
    value === "remove_tags" ||
    value === "add_album" ||
    value === "delete"
    ? value
    : null;
}

function uniqueStringArray(value: unknown, max: number): string[] | null {
  if (
    !Array.isArray(value) ||
    value.length > max ||
    value.some((item) => typeof item !== "string" || item.length === 0 || item.length > 64)
  )
    return null;
  const values = value as string[];
  const unique = [...new Set(values)];
  return unique.length === values.length ? unique : null;
}

function parseTimestamp(value: string): number | null {
  if (!/^\d{1,16}$/.test(value)) return null;
  const timestamp = Number(value);
  return Number.isSafeInteger(timestamp) && timestamp >= 0 ? timestamp : null;
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

async function safeJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

function isUniqueFailure(cause: unknown): boolean {
  return cause instanceof Error && /unique|constraint/i.test(cause.message);
}

function json(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: { "cache-control": "no-store" } });
}

function error(code: string, status: number): Response {
  return json({ error: code }, status);
}

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size)
    result.push(values.slice(index, index + size));
  return result;
}

async function runStatementBatches(
  env: CloudflareEnv,
  statements: D1PreparedStatement[],
): Promise<void> {
  for (const group of chunks(statements, 90)) await env.DB.batch(group);
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
