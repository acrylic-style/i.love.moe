import { hmacSha256, randomBase62, randomToken, sha256 } from "./crypto";
import { inspectPng, MAX_IMAGE_BYTES } from "./png";
import type { DeviceRow, ImageLookupRow, ImageRow, MagicLinkRow, SessionRow } from "./types";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
const DEVICE_REGISTRATION_WINDOW_MS = 24 * 60 * 60 * 1000;
const DEVICE_REGISTRATION_LIMIT = 3;
export const SHORT_CODE_PATTERN = /^[0-9A-Za-z]{8}$/;

export async function withApiErrors(operation: () => Promise<Response>): Promise<Response> {
  try {
    return await operation();
  } catch (error) {
    console.error("request_failed", error instanceof Error ? error.message : "unknown");
    return apiError("internal_error", 500);
  }
}

export async function registerDevice(request: Request, env: CloudflareEnv): Promise<Response> {
  const clientIp = request.headers.get("cf-connecting-ip")?.trim().toLowerCase();
  if (!clientIp) return apiError("client_ip_unavailable", 400);
  if (!env.RATE_LIMIT_SALT || env.RATE_LIMIT_SALT.length < 32) {
    console.error("RATE_LIMIT_SALT is missing or too short");
    return apiError("rate_limit_unavailable", 503);
  }

  const now = Date.now();
  const windowStart = now - DEVICE_REGISTRATION_WINDOW_MS;
  const ipHash = await hmacSha256(env.RATE_LIMIT_SALT, clientIp);

  // OpenNext owns the Worker entrypoint, so stale attempts are pruned in small batches here.
  await env.DB.prepare(`DELETE FROM device_registration_attempts WHERE id IN (
      SELECT id FROM device_registration_attempts WHERE created_at <= ? LIMIT 500
    )`).bind(windowStart).run();

  const attempt = await env.DB.prepare(`INSERT INTO device_registration_attempts (ip_hash, created_at)
      SELECT ?, ?
      WHERE (SELECT COUNT(*) FROM device_registration_attempts WHERE ip_hash = ? AND created_at > ?) < ?`)
    .bind(ipHash, now, ipHash, windowStart, DEVICE_REGISTRATION_LIMIT)
    .run();

  if ((attempt.meta.changes ?? 0) !== 1) {
    const oldest = await env.DB.prepare(`SELECT MIN(created_at) AS created_at
        FROM device_registration_attempts WHERE ip_hash = ? AND created_at > ?`)
      .bind(ipHash, windowStart)
      .first<{ created_at: number | null }>();
    const retryAfterSeconds = Math.max(1, Math.ceil(
      ((oldest?.created_at ?? now) + DEVICE_REGISTRATION_WINDOW_MS - now) / 1000,
    ));
    return Response.json(
      { error: "device_registration_rate_limited", retryAfterSeconds },
      { status: 429, headers: { "cache-control": "no-store", "retry-after": String(retryAfterSeconds) } },
    );
  }

  const id = crypto.randomUUID();
  const token = randomToken();
  await env.DB.prepare("INSERT INTO devices (id, token_hash, created_at, last_seen_at) VALUES (?, ?, ?, ?)")
    .bind(id, await sha256(token), now, now)
    .run();
  return json({ token }, 201);
}

export async function uploadImage(request: Request, env: CloudflareEnv): Promise<Response> {
  const device = await authenticateDevice(request, env);
  if (!device) return apiError("unauthorized", 401);
  if (request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== "image/png") {
    return apiError("invalid_image_type", 415);
  }
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_IMAGE_BYTES) return apiError("image_too_large", 413);

  const body = new Uint8Array(await request.arrayBuffer());
  if (body.byteLength === 0 || body.byteLength > MAX_IMAGE_BYTES) return apiError("image_too_large", 413);
  const png = inspectPng(body);
  if (!png) return apiError("invalid_png", 400);

  const now = Date.now();
  const quotaStart = now - THIRTY_DAYS_MS;
  const quota = device.user_id
    ? await env.DB.prepare("SELECT COUNT(*) AS count FROM images WHERE owner_user_id = ? AND created_at >= ?")
        .bind(device.user_id, quotaStart).first<{ count: number }>()
    : await env.DB.prepare("SELECT COUNT(*) AS count FROM images WHERE owner_device_id = ? AND created_at >= ?")
        .bind(device.id, quotaStart).first<{ count: number }>();
  if ((quota?.count ?? 0) >= 50) return apiError("upload_limit_reached", 429);

  const id = crypto.randomUUID();
  const code = await allocateShortCode(env);
  const r2Key = `free/${id}.png`;
  const expiresAt = now + THIRTY_DAYS_MS;
  await env.IMAGES.put(r2Key, body, {
    httpMetadata: { contentType: "image/png", cacheControl: "public, max-age=3600" },
    customMetadata: { imageId: id },
  });

  try {
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO images
        (id, owner_device_id, owner_user_id, r2_key, byte_size, width, height, created_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(id, device.id, device.user_id, r2Key, body.byteLength, png.width, png.height, now, expiresAt),
      env.DB.prepare("INSERT INTO short_links (code, target_type, target_id, created_at) VALUES (?, 'image', ?, ?)")
        .bind(code, id, now),
    ]);
  } catch (error) {
    await env.IMAGES.delete(r2Key);
    throw error;
  }
  return json({ id, url: `${publicBaseUrl(env)}/${code}`, expiresAt: new Date(expiresAt).toISOString() }, 201);
}

export async function listImages(request: Request, env: CloudflareEnv): Promise<Response> {
  const device = await authenticateDevice(request, env);
  if (!device) return apiError("unauthorized", 401);
  const images = await ownedImages(env, device.id, device.user_id);
  return json({ images: images.map((image) => publicImage(image, env)) });
}

export async function deleteImage(request: Request, env: CloudflareEnv, id: string): Promise<Response> {
  const device = await authenticateDevice(request, env);
  if (!device) return apiError("unauthorized", 401);
  const image = await findOwnedImage(env, id, device.id, device.user_id);
  if (!image || image.deleted_at !== null) return apiError("not_found", 404);
  await retireImage(env, image.id, image.code);
  await env.IMAGES.delete(image.r2_key);
  return new Response(null, { status: 204 });
}

export async function requestMagicLink(request: Request, env: CloudflareEnv): Promise<Response> {
  const device = await authenticateDevice(request, env);
  if (!device) return apiError("unauthorized", 401);
  const data = await readJson<{ email?: unknown }>(request);
  const email = typeof data?.email === "string" ? data.email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return apiError("invalid_email", 400);

  const now = Date.now();
  const recent = await env.DB.prepare("SELECT COUNT(*) AS count FROM magic_link_tokens WHERE device_id = ? AND created_at >= ?")
    .bind(device.id, now - 10 * 60 * 1000).first<{ count: number }>();
  if ((recent?.count ?? 0) >= 3) return apiError("too_many_requests", 429);

  const id = crypto.randomUUID();
  const token = randomToken();
  const expiresAt = now + FIFTEEN_MINUTES_MS;
  await env.DB.prepare(`INSERT INTO magic_link_tokens
    (id, token_hash, device_id, email, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(id, await sha256(token), device.id, email, now, expiresAt).run();

  const link = `${publicBaseUrl(env)}/auth/verify?token=${encodeURIComponent(token)}`;
  try {
    await env.EMAIL.send({
      to: email,
      from: env.EMAIL_FROM,
      subject: "Your i.らぶ.moe login link / i.らぶ.moe ログインリンク",
      text: `Open the link below within 15 minutes.\n\n${link}\n\nIf you did not request this email, you can safely ignore it.\n\n---\n\n次のリンクを15分以内に開いてください。\n\n${link}\n\n心当たりがない場合は、このメールを破棄してください。`,
      html: `<div lang="en"><p>Open the link below within 15 minutes.</p><p><a href="${link}">Log in to i.らぶ.moe</a></p><p>If you did not request this email, you can safely ignore it.</p></div><hr><div lang="ja"><p>次のリンクを15分以内に開いてください。</p><p><a href="${link}">i.らぶ.moeへログイン</a></p><p>心当たりがない場合は、このメールを破棄してください。</p></div>`,
    });
  } catch (error) {
    await env.DB.prepare("DELETE FROM magic_link_tokens WHERE id = ?").bind(id).run();
    console.error("email_send_failed", error instanceof Error ? error.message : "unknown");
    return apiError("email_unavailable", 503);
  }
  return json({ accepted: true }, 202);
}

export async function verifyMagicLink(url: URL, env: CloudflareEnv): Promise<Response> {
  const invalid = (message: string) => authErrorPage("リンクが無効です", message, 400);
  const token = url.searchParams.get("token");
  if (!token) return invalid("ログインリンクをご確認ください。");
  const now = Date.now();
  const magic = await env.DB.prepare(`SELECT id, device_id, email, expires_at, used_at
      FROM magic_link_tokens WHERE token_hash = ?`)
    .bind(await sha256(token)).first<MagicLinkRow>();
  if (!magic || magic.used_at !== null || magic.expires_at <= now) {
    return invalid("このリンクは使用済みか、有効期限が切れています。");
  }
  const consumed = await env.DB.prepare("UPDATE magic_link_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL")
    .bind(now, magic.id).run();
  if ((consumed.meta.changes ?? 0) !== 1) return invalid("このリンクは既に使用されています。");

  await env.DB.prepare("INSERT INTO users (id, email, created_at) VALUES (?, ?, ?) ON CONFLICT(email) DO NOTHING")
    .bind(crypto.randomUUID(), magic.email, now).run();
  const user = await env.DB.prepare("SELECT id FROM users WHERE email = ? COLLATE NOCASE")
    .bind(magic.email).first<{ id: string }>();
  if (!user) throw new Error("user_creation_failed");
  await env.DB.batch([
    env.DB.prepare("UPDATE devices SET user_id = ? WHERE id = ?").bind(user.id, magic.device_id),
    env.DB.prepare("UPDATE images SET owner_user_id = ? WHERE owner_device_id = ? AND owner_user_id IS NULL")
      .bind(user.id, magic.device_id),
  ]);

  const sessionToken = randomToken();
  await env.DB.prepare("INSERT INTO sessions (id, token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), await sha256(sessionToken), user.id, now, now + SESSION_LIFETIME_MS).run();
  return new Response(null, {
    status: 302,
    headers: { location: "/manage", "set-cookie": sessionCookie(sessionToken, SESSION_LIFETIME_MS / 1000), "cache-control": "no-store" },
  });
}

export async function serveRawImage(code: string, env: CloudflareEnv): Promise<Response> {
  if (!SHORT_CODE_PATTERN.test(code)) return new Response(null, { status: 404 });
  const image = await findActiveImageByCode(env, code);
  if (!image) return new Response(null, { status: 404 });
  const object = await env.IMAGES.get(image.r2_key);
  if (!object) return new Response(null, { status: 404 });
  return new Response(object.body, { headers: {
    "content-type": "image/png",
    "content-length": String(object.size),
    "cache-control": "public, max-age=3600",
    "x-content-type-options": "nosniff",
    "content-security-policy": "default-src 'none'; sandbox",
    etag: object.httpEtag,
  } });
}

export async function deleteManagedImage(request: Request, env: CloudflareEnv, id: string): Promise<Response> {
  const session = await authenticateSession(request, env);
  if (!session) return new Response(null, { status: 404 });
  const image = await env.DB.prepare(`SELECT i.id, i.r2_key, i.byte_size, i.width, i.height, i.created_at,
      i.expires_at, i.deleted_at, i.owner_device_id, i.owner_user_id, s.code
    FROM images i JOIN short_links s ON s.target_type = 'image' AND s.target_id = i.id
    WHERE i.id = ? AND i.owner_user_id = ?`)
    .bind(id, session.user_id).first<ImageLookupRow>();
  if (!image || image.deleted_at !== null) return new Response(null, { status: 404 });
  await retireImage(env, image.id, image.code);
  await env.IMAGES.delete(image.r2_key);
  return new Response(null, { status: 303, headers: { location: "/manage" } });
}

export async function logout(request: Request, env: CloudflareEnv): Promise<Response> {
  const token = cookieValue(request, "session");
  if (token) await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(token)).run();
  return new Response(null, { status: 303, headers: { location: "/", "set-cookie": sessionCookie("", 0) } });
}

export async function authenticateSessionToken(token: string | undefined, env: CloudflareEnv): Promise<SessionRow | null> {
  if (!token) return null;
  return env.DB.prepare("SELECT id, user_id FROM sessions WHERE token_hash = ? AND expires_at > ?")
    .bind(await sha256(token), Date.now()).first<SessionRow>();
}

export async function managedImages(env: CloudflareEnv, userId: string): Promise<ImageRow[]> {
  const rows = await env.DB.prepare(`SELECT i.id, i.r2_key, i.byte_size, i.width, i.height, i.created_at,
      i.expires_at, i.deleted_at, s.code
    FROM images i JOIN short_links s ON s.target_type = 'image' AND s.target_id = i.id
    WHERE i.owner_user_id = ? AND i.deleted_at IS NULL AND i.expires_at > ?
    ORDER BY i.created_at DESC LIMIT 100`)
    .bind(userId, Date.now()).all<ImageRow>();
  return rows.results;
}

export async function findActiveImageByCode(env: CloudflareEnv, code: string): Promise<ImageLookupRow | null> {
  return env.DB.prepare(`SELECT i.id, i.owner_device_id, i.owner_user_id, i.r2_key, i.byte_size, i.width,
      i.height, i.created_at, i.expires_at, i.deleted_at, s.code
    FROM short_links s JOIN images i ON i.id = s.target_id
    WHERE s.code = ? AND s.target_type = 'image' AND s.retired_at IS NULL
      AND i.deleted_at IS NULL AND i.expires_at > ?`)
    .bind(code, Date.now()).first<ImageLookupRow>();
}

async function authenticateDevice(request: Request, env: CloudflareEnv): Promise<DeviceRow | null> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice(7);
  if (token.length < 32 || token.length > 128) return null;
  const device = await env.DB.prepare("SELECT id, user_id FROM devices WHERE token_hash = ?")
    .bind(await sha256(token)).first<DeviceRow>();
  if (device) await env.DB.prepare("UPDATE devices SET last_seen_at = ? WHERE id = ?").bind(Date.now(), device.id).run();
  return device;
}

async function authenticateSession(request: Request, env: CloudflareEnv): Promise<SessionRow | null> {
  return authenticateSessionToken(cookieValue(request, "session") ?? undefined, env);
}

async function allocateShortCode(env: CloudflareEnv): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomBase62(8);
    if (!await env.DB.prepare("SELECT 1 AS found FROM short_links WHERE code = ?").bind(code).first()) return code;
  }
  throw new Error("short_code_exhausted");
}

async function ownedImages(env: CloudflareEnv, deviceId: string, userId: string | null): Promise<ImageRow[]> {
  const ownerClause = userId ? "i.owner_user_id = ?" : "i.owner_device_id = ?";
  const rows = await env.DB.prepare(`SELECT i.id, i.r2_key, i.byte_size, i.width, i.height, i.created_at,
      i.expires_at, i.deleted_at, s.code
    FROM images i JOIN short_links s ON s.target_type = 'image' AND s.target_id = i.id
    WHERE ${ownerClause} AND i.deleted_at IS NULL AND i.expires_at > ?
    ORDER BY i.created_at DESC LIMIT 100`)
    .bind(userId ?? deviceId, Date.now()).all<ImageRow>();
  return rows.results;
}

async function findOwnedImage(env: CloudflareEnv, id: string, deviceId: string, userId: string | null): Promise<ImageLookupRow | null> {
  const ownerClause = userId ? "i.owner_user_id = ?" : "i.owner_device_id = ?";
  return env.DB.prepare(`SELECT i.id, i.owner_device_id, i.owner_user_id, i.r2_key, i.byte_size, i.width,
      i.height, i.created_at, i.expires_at, i.deleted_at, s.code
    FROM images i JOIN short_links s ON s.target_type = 'image' AND s.target_id = i.id
    WHERE i.id = ? AND ${ownerClause}`)
    .bind(id, userId ?? deviceId).first<ImageLookupRow>();
}

async function retireImage(env: CloudflareEnv, id: string, code: string): Promise<void> {
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare("UPDATE images SET deleted_at = COALESCE(deleted_at, ?) WHERE id = ?").bind(now, id),
    env.DB.prepare("UPDATE short_links SET retired_at = COALESCE(retired_at, ?) WHERE code = ?").bind(now, code),
  ]);
}

function publicImage(image: ImageRow, env: CloudflareEnv): Record<string, unknown> {
  return {
    id: image.id,
    url: `${publicBaseUrl(env)}/${image.code}`,
    width: image.width,
    height: image.height,
    byteSize: image.byte_size,
    createdAt: new Date(image.created_at).toISOString(),
    expiresAt: new Date(image.expires_at).toISOString(),
  };
}

function publicBaseUrl(env: CloudflareEnv): string {
  return env.PUBLIC_BASE_URL.replace(/\/$/, "");
}

function cookieValue(request: Request, name: string): string | null {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

function sessionCookie(value: string, maxAgeSeconds: number): string {
  return `session=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.floor(maxAgeSeconds)}`;
}

async function readJson<T>(request: Request): Promise<T | null> {
  try { return await request.json() as T; } catch { return null; }
}

function json(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: { "cache-control": "no-store" } });
}

function apiError(code: string, status: number): Response {
  return json({ error: code }, status);
}

function authErrorPage(title: string, message: string, status: number): Response {
  return new Response(`<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title} | i.らぶ.moe</title><body><main><h1>${title}</h1><p>${message}</p><a href="/">トップへ戻る</a></main></body></html>`, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'" },
  });
}
