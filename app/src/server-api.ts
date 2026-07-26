import { randomToken, sha256 } from "./crypto";
import { planLimits } from "./plans";
import { acceptsFormOrigin, authenticateSession, normalizeOptionalText } from "./service";

const MAX_ACTIVE_TOKENS = 10;
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 50;

export interface ManagedServerApiToken {
  id: string;
  name: string;
  token_prefix: string;
  created_at: number;
  last_used_at: number | null;
}

interface ServerApiPrincipal {
  tokenId: string;
  serverId: string;
}

interface PageCursor {
  timestamp: number;
  id: string;
}

export async function managedServerApiTokens(
  env: CloudflareEnv,
  serverId: string,
): Promise<ManagedServerApiToken[]> {
  const rows = await env.DB.prepare(
    `SELECT id, name, token_prefix, created_at, last_used_at
      FROM server_api_tokens
      WHERE server_id = ? AND revoked_at IS NULL
      ORDER BY created_at DESC`,
  )
    .bind(serverId)
    .all<ManagedServerApiToken>();
  return rows.results;
}

export async function createServerApiToken(
  request: Request,
  env: CloudflareEnv,
  serverId: string,
): Promise<Response> {
  if (!acceptsFormOrigin(request.headers.get("origin"), request.url)) {
    return json({ error: "invalid_origin" }, 403);
  }
  const session = await authenticateSession(request, env);
  if (!session || !(await ownsServer(env, serverId, session.user_id))) {
    return json({ error: "not_found" }, 404);
  }
  if (!(await serverOwnerHasPlus(env, serverId))) {
    return json({ error: "plus_required" }, 403);
  }
  const form = await request.formData();
  const name = normalizeOptionalText(form.get("name"), 100);
  if (!name) return json({ error: "invalid_name" }, 400);

  const now = Date.now();
  const token = `ilms_${randomToken()}`;
  const result = await env.DB.prepare(
    `INSERT INTO server_api_tokens
      (id, server_id, name, token_hash, token_prefix, created_by_user_id, created_at)
      SELECT ?, ?, ?, ?, ?, ?, ?
      WHERE (SELECT COUNT(*) FROM server_api_tokens
        WHERE server_id = ? AND revoked_at IS NULL) < ?`,
  )
    .bind(
      crypto.randomUUID(),
      serverId,
      name,
      await sha256(token),
      token.slice(0, 13),
      session.user_id,
      now,
      serverId,
      MAX_ACTIVE_TOKENS,
    )
    .run();
  if ((result.meta.changes ?? 0) !== 1) return json({ error: "token_limit_reached" }, 409);
  return json({ token, prefix: token.slice(0, 13), name }, 201);
}

export async function revokeServerApiToken(
  request: Request,
  env: CloudflareEnv,
  serverId: string,
  tokenId: string,
): Promise<Response> {
  if (!acceptsFormOrigin(request.headers.get("origin"), request.url)) {
    return json({ error: "invalid_origin" }, 403);
  }
  const session = await authenticateSession(request, env);
  if (!session || !(await ownsServer(env, serverId, session.user_id))) {
    return json({ error: "not_found" }, 404);
  }
  const result = await env.DB.prepare(
    `UPDATE server_api_tokens SET revoked_at = ?
      WHERE id = ? AND server_id = ? AND revoked_at IS NULL`,
  )
    .bind(Date.now(), tokenId, serverId)
    .run();
  if ((result.meta.changes ?? 0) !== 1) return json({ error: "not_found" }, 404);
  return json({ revoked: true });
}

export async function serverApiImages(request: Request, env: CloudflareEnv): Promise<Response> {
  const principal = await authenticateServerApiToken(request, env);
  if (!principal) return unauthorized();
  const url = new URL(request.url);
  const limit = pageSize(url.searchParams.get("limit"));
  const cursor = decodeCursor(url.searchParams.get("cursor"));
  const clauses = [
    "i.server_id = ?",
    "i.visibility = 'unlisted'",
    "i.discoverability = 'public'",
    "i.deleted_at IS NULL",
    "i.expires_at > ?",
    "sl.retired_at IS NULL",
  ];
  const bindings: unknown[] = [principal.serverId, Date.now()];
  if (cursor) {
    clauses.push("(i.created_at < ? OR (i.created_at = ? AND i.id < ?))");
    bindings.push(cursor.timestamp, cursor.timestamp, cursor.id);
  }
  bindings.push(limit + 1);
  const rows = await env.DB.prepare(
    `SELECT i.id, i.title, i.description, i.server_address, i.server_name,
      i.byte_size, i.width, i.height, i.created_at, i.expires_at,
      i.visibility, i.discoverability, i.minecraft_uuid, i.minecraft_name,
      i.minecraft_id_public, sl.code
    FROM images i
    JOIN short_links sl ON sl.target_type = 'image' AND sl.target_id = i.id
    WHERE ${clauses.join(" AND ")}
    ORDER BY i.created_at DESC, i.id DESC
    LIMIT ?`,
  )
    .bind(...bindings)
    .all<{
      id: string;
      title: string | null;
      description: string | null;
      server_address: string | null;
      server_name: string | null;
      byte_size: number;
      width: number;
      height: number;
      created_at: number;
      expires_at: number;
      visibility: string;
      discoverability: string;
      minecraft_uuid: string | null;
      minecraft_name: string | null;
      minecraft_id_public: number;
      code: string;
    }>();
  const page = rows.results.slice(0, limit);
  const last = page.at(-1);
  return json({
    images: page.map((image) => ({
      id: image.id,
      code: image.code,
      title: image.title,
      description: image.description,
      serverAddress: image.server_address,
      serverName: image.server_name,
      byteSize: image.byte_size,
      width: image.width,
      height: image.height,
      createdAt: new Date(image.created_at).toISOString(),
      expiresAt: new Date(image.expires_at).toISOString(),
      visibility: shareMode(image.visibility, image.discoverability),
      minecraft:
        image.minecraft_uuid && image.minecraft_id_public !== 0
          ? { uuid: image.minecraft_uuid, name: image.minecraft_name }
          : null,
      shareUrl: `${env.PUBLIC_BASE_URL.replace(/\/$/, "")}/${image.code}`,
      contentUrl: `${env.PUBLIC_BASE_URL.replace(/\/$/, "")}/api/v1/server/images/${image.id}/content`,
    })),
    nextCursor: rows.results.length > limit && last ? encodeCursor(last.created_at, last.id) : null,
  });
}

export async function serverApiImageContent(
  request: Request,
  env: CloudflareEnv,
  imageId: string,
): Promise<Response> {
  const principal = await authenticateServerApiToken(request, env);
  if (!principal) return unauthorized();
  const image = await env.DB.prepare(
    `SELECT i.r2_key FROM images i
      WHERE i.id = ? AND i.deleted_at IS NULL AND i.expires_at > ?
        AND (
          (i.server_id = ? AND i.visibility = 'unlisted' AND i.discoverability = 'public')
          OR EXISTS (
            SELECT 1 FROM album_images ai
            JOIN albums a ON a.id = ai.album_id
            WHERE ai.image_id = i.id AND a.server_id = ?
              AND a.visibility = 'unlisted' AND a.discoverability = 'public'
              AND a.deleted_at IS NULL
          )
        )`,
  )
    .bind(imageId, Date.now(), principal.serverId, principal.serverId)
    .first<{ r2_key: string }>();
  if (!image) return json({ error: "not_found" }, 404);
  const object = await env.IMAGES.get(image.r2_key);
  if (!object) return json({ error: "not_found" }, 404);
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("content-type", "image/png");
  headers.set("cache-control", "private, no-store");
  headers.set("content-disposition", `inline; filename="${imageId}.png"`);
  return new Response(object.body, { headers });
}

export async function serverApiAlbums(request: Request, env: CloudflareEnv): Promise<Response> {
  const principal = await authenticateServerApiToken(request, env);
  if (!principal) return unauthorized();
  const url = new URL(request.url);
  const limit = pageSize(url.searchParams.get("limit"));
  const cursor = decodeCursor(url.searchParams.get("cursor"));
  const clauses = [
    "a.server_id = ?",
    "a.visibility = 'unlisted'",
    "a.discoverability = 'public'",
    "a.deleted_at IS NULL",
    "sl.retired_at IS NULL",
  ];
  const bindings: unknown[] = [principal.serverId];
  if (cursor) {
    clauses.push("(a.updated_at < ? OR (a.updated_at = ? AND a.id < ?))");
    bindings.push(cursor.timestamp, cursor.timestamp, cursor.id);
  }
  bindings.push(limit + 1);
  const rows = await env.DB.prepare(
    `SELECT a.id, a.title, a.description, a.created_at, a.updated_at,
      a.visibility, a.discoverability, sl.code
    FROM albums a
    JOIN short_links sl ON sl.target_type = 'album' AND sl.target_id = a.id
    WHERE ${clauses.join(" AND ")}
    ORDER BY a.updated_at DESC, a.id DESC
    LIMIT ?`,
  )
    .bind(...bindings)
    .all<{
      id: string;
      title: string;
      description: string | null;
      created_at: number;
      updated_at: number;
      visibility: string;
      discoverability: string;
      code: string;
    }>();
  const page = rows.results.slice(0, limit);
  const memberships = page.length
    ? await env.DB.prepare(
        `SELECT ai.album_id, ai.position, i.id, sl.code
          FROM album_images ai
          JOIN images i ON i.id = ai.image_id
          JOIN short_links sl ON sl.target_type = 'image' AND sl.target_id = i.id
            AND sl.retired_at IS NULL
          WHERE ai.album_id IN (${page.map(() => "?").join(",")})
            AND i.deleted_at IS NULL AND i.expires_at > ?
          ORDER BY ai.album_id, ai.position`,
      )
        .bind(...page.map((album) => album.id), Date.now())
        .all<{ album_id: string; position: number; id: string; code: string }>()
    : { results: [] };
  const imagesByAlbum = new Map<string, Array<{ id: string; code: string; position: number }>>();
  for (const membership of memberships.results) {
    const images = imagesByAlbum.get(membership.album_id) ?? [];
    images.push({ id: membership.id, code: membership.code, position: membership.position });
    imagesByAlbum.set(membership.album_id, images);
  }
  const last = page.at(-1);
  return json({
    albums: page.map((album) => ({
      id: album.id,
      code: album.code,
      title: album.title,
      description: album.description,
      createdAt: new Date(album.created_at).toISOString(),
      updatedAt: new Date(album.updated_at).toISOString(),
      visibility: shareMode(album.visibility, album.discoverability),
      shareUrl: `${env.PUBLIC_BASE_URL.replace(/\/$/, "")}/${album.code}`,
      images: (imagesByAlbum.get(album.id) ?? []).map((image) => ({
        ...image,
        contentUrl: `${env.PUBLIC_BASE_URL.replace(/\/$/, "")}/api/v1/server/images/${image.id}/content`,
      })),
    })),
    nextCursor: rows.results.length > limit && last ? encodeCursor(last.updated_at, last.id) : null,
  });
}

async function authenticateServerApiToken(
  request: Request,
  env: CloudflareEnv,
): Promise<ServerApiPrincipal | null> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice(7).trim();
  if (!token.startsWith("ilms_") || token.length < 40 || token.length > 128) return null;
  const row = await env.DB.prepare(
    `SELECT id, server_id FROM server_api_tokens
      WHERE token_hash = ? AND revoked_at IS NULL`,
  )
    .bind(await sha256(token))
    .first<{ id: string; server_id: string }>();
  if (!row) return null;
  if (!(await serverOwnerHasPlus(env, row.server_id))) return null;
  await env.DB.prepare("UPDATE server_api_tokens SET last_used_at = ? WHERE id = ?")
    .bind(Date.now(), row.id)
    .run();
  return { tokenId: row.id, serverId: row.server_id };
}

async function ownsServer(env: CloudflareEnv, serverId: string, userId: string): Promise<boolean> {
  const row = await env.DB.prepare(
    "SELECT 1 AS found FROM servers WHERE id = ? AND owner_user_id = ?",
  )
    .bind(serverId, userId)
    .first<{ found: number }>();
  return Boolean(row);
}

async function serverOwnerHasPlus(env: CloudflareEnv, serverId: string): Promise<boolean> {
  const server = await env.DB.prepare("SELECT owner_user_id FROM servers WHERE id = ?")
    .bind(serverId)
    .first<{ owner_user_id: string | null }>();
  return server?.owner_user_id
    ? (await planLimits(env, server.owner_user_id)).name === "plus"
    : false;
}

function pageSize(value: string | null): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0
    ? Math.min(parsed, MAX_PAGE_SIZE)
    : DEFAULT_PAGE_SIZE;
}

function encodeCursor(timestamp: number, id: string): string {
  return `${timestamp}:${id}`;
}

function decodeCursor(value: string | null): PageCursor | null {
  if (!value) return null;
  const match = /^(\d{1,16}):([0-9a-f-]{36})$/i.exec(value);
  if (!match) return null;
  const timestamp = Number(match[1]);
  return Number.isSafeInteger(timestamp) ? { timestamp, id: match[2]! } : null;
}

function shareMode(visibility: string, discoverability: string): string {
  return visibility === "unlisted" && discoverability === "public" ? "public" : visibility;
}

function unauthorized(): Response {
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "www-authenticate": "Bearer",
    },
  });
}

function json(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: { "cache-control": "no-store" } });
}
