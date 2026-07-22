import { allocateShortCode, authenticateSession, normalizeOptionalText } from "./service";
import type { AlbumImageRow, AlbumRow, ImageRow } from "./types";

const MAX_ALBUMS_PER_USER = 20;
const MAX_IMAGES_PER_ALBUM = 50;

export interface AlbumDetail {
  album: AlbumRow;
  images: AlbumImageRow[];
}

export async function managedAlbums(env: CloudflareEnv, userId: string): Promise<AlbumRow[]> {
  const rows = await env.DB.prepare(`SELECT a.id, a.owner_user_id, a.title, a.description, a.created_at,
      a.updated_at, a.deleted_at, s.code,
      (SELECT sl.code FROM album_images ai
        JOIN images i ON i.id = ai.image_id
        JOIN short_links sl ON sl.target_type = 'image' AND sl.target_id = i.id AND sl.retired_at IS NULL
        WHERE ai.album_id = a.id AND i.deleted_at IS NULL AND i.expires_at > ?
        ORDER BY ai.position LIMIT 1) AS cover_code,
      (SELECT COUNT(*) FROM album_images ai JOIN images i ON i.id = ai.image_id
        WHERE ai.album_id = a.id AND i.deleted_at IS NULL AND i.expires_at > ?) AS image_count
    FROM albums a JOIN short_links s ON s.target_type = 'album' AND s.target_id = a.id AND s.retired_at IS NULL
    WHERE a.owner_user_id = ? AND a.deleted_at IS NULL
    ORDER BY a.updated_at DESC LIMIT ?`)
    .bind(Date.now(), Date.now(), userId, MAX_ALBUMS_PER_USER).all<AlbumRow>();
  return rows.results;
}

export async function managedAlbumDetail(env: CloudflareEnv, userId: string, id: string): Promise<AlbumDetail | null> {
  const album = await ownedAlbum(env, userId, id);
  if (!album) return null;
  return { album, images: await albumImages(env, id) };
}

export async function findActiveAlbumByCode(env: CloudflareEnv, code: string): Promise<AlbumDetail | null> {
  const album = await env.DB.prepare(`SELECT a.id, a.owner_user_id, a.title, a.description, a.created_at,
      a.updated_at, a.deleted_at, s.code
    FROM short_links s JOIN albums a ON a.id = s.target_id
    WHERE s.code = ? AND s.target_type = 'album' AND s.retired_at IS NULL AND a.deleted_at IS NULL`)
    .bind(code).first<AlbumRow>();
  if (!album) return null;
  return { album, images: await albumImages(env, album.id) };
}

export async function createAlbum(request: Request, env: CloudflareEnv): Promise<Response> {
  const session = await authenticateSession(request, env);
  if (!session) return new Response(null, { status: 404 });
  const form = await request.formData();
  const title = requiredText(form.get("title"), 100);
  const description = normalizeOptionalText(form.get("description"), 1000);
  const imageIds = uniqueStrings(form.getAll("imageIds"));
  if (!title || description === undefined || imageIds === null || imageIds.length > MAX_IMAGES_PER_ALBUM) {
    return formError("/manage/albums/new", "invalid_album");
  }
  if (!await ownsAllImages(env, session.user_id, imageIds)) {
    return formError("/manage/albums/new", "invalid_images");
  }
  const count = await env.DB.prepare("SELECT COUNT(*) AS count FROM albums WHERE owner_user_id = ? AND deleted_at IS NULL")
    .bind(session.user_id).first<{ count: number }>();
  if ((count?.count ?? 0) >= MAX_ALBUMS_PER_USER) return formError("/manage/albums/new", "album_limit_reached");

  const now = Date.now();
  const id = crypto.randomUUID();
  const code = await allocateShortCode(env);
  const statements = [
    env.DB.prepare(`INSERT INTO albums
      (id, owner_user_id, title, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(id, session.user_id, title, description, now, now),
    env.DB.prepare("INSERT INTO short_links (code, target_type, target_id, created_at) VALUES (?, 'album', ?, ?)")
      .bind(code, id, now),
    ...imageIds.map((imageId, position) => env.DB.prepare(
      "INSERT INTO album_images (album_id, image_id, position, added_at) VALUES (?, ?, ?, ?)",
    ).bind(id, imageId, position, now)),
  ];
  await env.DB.batch(statements);
  return new Response(null, { status: 303, headers: { location: `/manage/albums/${id}` } });
}

export async function updateAlbum(request: Request, env: CloudflareEnv, id: string): Promise<Response> {
  const session = await authenticateSession(request, env);
  if (!session) return new Response(null, { status: 404 });
  const album = await ownedAlbum(env, session.user_id, id);
  if (!album) return new Response(null, { status: 404 });

  const form = await request.formData();
  const title = requiredText(form.get("title"), 100);
  const description = normalizeOptionalText(form.get("description"), 1000);
  const requestedIds = uniqueStrings(form.getAll("imageIds"));
  const errorPath = `/manage/albums/${id}`;
  if (!title || description === undefined || requestedIds === null || requestedIds.length > MAX_IMAGES_PER_ALBUM) {
    return formError(errorPath, "invalid_album");
  }
  if (!await ownsAllImages(env, session.user_id, requestedIds)) return formError(errorPath, "invalid_images");

  const existing = await env.DB.prepare("SELECT image_id, position FROM album_images WHERE album_id = ? ORDER BY position")
    .bind(id).all<{ image_id: string; position: number }>();
  const desired = new Set(requestedIds);
  const retained = existing.results.map((row) => row.image_id).filter((imageId) => desired.has(imageId));
  const retainedSet = new Set(retained);
  const orderedIds = [...retained, ...requestedIds.filter((imageId) => !retainedSet.has(imageId))];
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare("UPDATE albums SET title = ?, description = ?, updated_at = ? WHERE id = ? AND owner_user_id = ? AND deleted_at IS NULL")
      .bind(title, description, now, id, session.user_id),
    env.DB.prepare("DELETE FROM album_images WHERE album_id = ?").bind(id),
    ...orderedIds.map((imageId, position) => env.DB.prepare(
      "INSERT INTO album_images (album_id, image_id, position, added_at) VALUES (?, ?, ?, ?)",
    ).bind(id, imageId, position, now)),
  ]);
  return new Response(null, { status: 303, headers: { location: errorPath } });
}

export async function reorderAlbum(request: Request, env: CloudflareEnv, id: string): Promise<Response> {
  const session = await authenticateSession(request, env);
  if (!session) return Response.json({ error: "not_found" }, { status: 404 });
  if (!await ownedAlbum(env, session.user_id, id)) return Response.json({ error: "not_found" }, { status: 404 });
  const body = await safeJson<{ imageIds?: unknown }>(request);
  if (!Array.isArray(body?.imageIds) || body.imageIds.some((value) => typeof value !== "string")) {
    return Response.json({ error: "invalid_order" }, { status: 400 });
  }
  const imageIds = uniqueStrings(body.imageIds);
  if (imageIds === null || imageIds.length > MAX_IMAGES_PER_ALBUM) {
    return Response.json({ error: "invalid_order" }, { status: 400 });
  }
  const current = await albumImages(env, id);
  if (current.length !== imageIds.length || !sameSet(current.map((image) => image.id), imageIds)) {
    return Response.json({ error: "album_changed" }, { status: 409 });
  }
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM album_images WHERE album_id = ?").bind(id),
    ...imageIds.map((imageId, position) => env.DB.prepare(
      "INSERT INTO album_images (album_id, image_id, position, added_at) VALUES (?, ?, ?, ?)",
    ).bind(id, imageId, position, now)),
    env.DB.prepare("UPDATE albums SET updated_at = ? WHERE id = ?").bind(now, id),
  ]);
  return Response.json({ saved: true }, { headers: { "cache-control": "no-store" } });
}

export async function deleteAlbum(request: Request, env: CloudflareEnv, id: string): Promise<Response> {
  const session = await authenticateSession(request, env);
  if (!session) return new Response(null, { status: 404 });
  const album = await ownedAlbum(env, session.user_id, id);
  if (!album) return new Response(null, { status: 404 });
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare("UPDATE albums SET deleted_at = ?, updated_at = ? WHERE id = ? AND owner_user_id = ? AND deleted_at IS NULL")
      .bind(now, now, id, session.user_id),
    env.DB.prepare("UPDATE short_links SET retired_at = ? WHERE code = ? AND retired_at IS NULL").bind(now, album.code),
    env.DB.prepare("DELETE FROM album_images WHERE album_id = ?").bind(id),
  ]);
  return new Response(null, { status: 303, headers: { location: "/manage" } });
}

async function ownedAlbum(env: CloudflareEnv, userId: string, id: string): Promise<AlbumRow | null> {
  return env.DB.prepare(`SELECT a.id, a.owner_user_id, a.title, a.description, a.created_at,
      a.updated_at, a.deleted_at, s.code
    FROM albums a JOIN short_links s ON s.target_type = 'album' AND s.target_id = a.id AND s.retired_at IS NULL
    WHERE a.id = ? AND a.owner_user_id = ? AND a.deleted_at IS NULL`)
    .bind(id, userId).first<AlbumRow>();
}

async function albumImages(env: CloudflareEnv, albumId: string): Promise<AlbumImageRow[]> {
  const rows = await env.DB.prepare(`SELECT i.id, i.title, i.r2_key, i.byte_size, i.width, i.height,
      i.created_at, i.expires_at, i.deleted_at, s.code, ai.position
    FROM album_images ai JOIN images i ON i.id = ai.image_id
      JOIN short_links s ON s.target_type = 'image' AND s.target_id = i.id AND s.retired_at IS NULL
    WHERE ai.album_id = ? AND i.deleted_at IS NULL AND i.expires_at > ?
    ORDER BY ai.position`)
    .bind(albumId, Date.now()).all<AlbumImageRow>();
  return rows.results;
}

async function ownsAllImages(env: CloudflareEnv, userId: string, imageIds: string[]): Promise<boolean> {
  if (imageIds.length === 0) return true;
  const placeholders = imageIds.map(() => "?").join(",");
  const row = await env.DB.prepare(`SELECT COUNT(*) AS count FROM images
    WHERE id IN (${placeholders}) AND owner_user_id = ? AND deleted_at IS NULL AND expires_at > ?`)
    .bind(...imageIds, userId, Date.now()).first<{ count: number }>();
  return (row?.count ?? 0) === imageIds.length;
}

function requiredText(value: FormDataEntryValue | null, maxLength: number): string | null {
  const normalized = normalizeOptionalText(value, maxLength);
  return typeof normalized === "string" ? normalized : null;
}

function uniqueStrings(values: unknown[]): string[] | null {
  if (values.some((value) => typeof value !== "string")) return null;
  const strings = values as string[];
  const unique = [...new Set(strings)];
  return unique.length === strings.length ? unique : null;
}

function sameSet(left: string[], right: string[]): boolean {
  const rightSet = new Set(right);
  return left.length === right.length && left.every((value) => rightSet.has(value));
}

async function safeJson<T>(request: Request): Promise<T | null> {
  try { return await request.json() as T; } catch { return null; }
}

function formError(path: string, error: string): Response {
  return new Response(null, { status: 303, headers: { location: `${path}?error=${encodeURIComponent(error)}` } });
}
