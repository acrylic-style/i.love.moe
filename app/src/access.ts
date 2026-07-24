import {
  decodeBase64Url,
  encodeBase64Url,
  hmacSha256,
  pbkdf2Sha256,
  randomToken,
  sha256,
  timingSafeEqual,
} from "./crypto";
import type { AccessControlledRow, Visibility } from "./types";

export type TargetType = "image" | "album";

// Cloudflare Workers Web Crypto currently accepts at most 100,000 PBKDF2 iterations.
const PASSPHRASE_ITERATIONS = 100_000;
const GRANT_LIFETIME_MS = 24 * 60 * 60 * 1000;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const ATTEMPT_LIMIT = 10;

interface PassphraseRecord {
  passphrase_salt: string | null;
  passphrase_hash: string | null;
  passphrase_iterations: number | null;
}

export function parseVisibility(value: FormDataEntryValue | null): Visibility | null {
  return value === "unlisted" || value === "private" || value === "passphrase" ? value : null;
}

export function parseShareMode(
  value: FormDataEntryValue | null,
): { visibility: Visibility; discoverability: "hidden" | "public" } | null {
  if (value === "public") return { visibility: "unlisted", discoverability: "public" };
  const visibility = parseVisibility(value);
  return visibility ? { visibility, discoverability: "hidden" } : null;
}

export function validPassphrase(value: FormDataEntryValue | null): value is string {
  return (
    typeof value === "string" && Array.from(value).length >= 4 && Array.from(value).length <= 100
  );
}

export async function createPassphraseRecord(passphrase: string): Promise<{
  passphrase_salt: string;
  passphrase_hash: string;
  passphrase_iterations: number;
}> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2Sha256(passphrase, salt, PASSPHRASE_ITERATIONS);
  return {
    passphrase_salt: encodeBase64Url(salt),
    passphrase_hash: encodeBase64Url(hash),
    passphrase_iterations: PASSPHRASE_ITERATIONS,
  };
}

export async function authorizeTarget(
  cookieHeader: string | null,
  env: CloudflareEnv,
  targetType: TargetType,
  target: AccessControlledRow,
): Promise<boolean> {
  if (target.visibility === "unlisted") return true;
  const sessionToken = cookieFromHeader(cookieHeader, "session");
  const session = sessionToken
    ? await env.DB.prepare(
        "SELECT id, user_id FROM sessions WHERE token_hash = ? AND expires_at > ?",
      )
        .bind(await sha256(sessionToken), Date.now())
        .first<{ id: string; user_id: string }>()
    : null;
  if (session && target.owner_user_id === session.user_id) return true;
  if (target.visibility === "private") return false;

  const token = cookieFromHeader(cookieHeader, grantCookieName(target.code));
  if (!token) return false;
  const grant = await env.DB.prepare(
    `SELECT id FROM share_access_grants
      WHERE token_hash = ? AND target_type = ? AND target_id = ? AND access_version = ? AND expires_at > ?`,
  )
    .bind(await sha256(token), targetType, target.id, target.access_version, Date.now())
    .first<{ id: string }>();
  return Boolean(grant);
}

export async function authorizeAlbumForImage(
  cookieHeader: string | null,
  env: CloudflareEnv,
  albumCode: string,
  imageId: string,
): Promise<boolean> {
  const album = await env.DB.prepare(
    `SELECT a.id, a.owner_user_id, a.visibility, a.access_version, s.code
      FROM short_links s JOIN albums a ON a.id = s.target_id
      JOIN album_images ai ON ai.album_id = a.id
      WHERE s.code = ? AND s.target_type = 'album' AND s.retired_at IS NULL
        AND a.deleted_at IS NULL AND ai.image_id = ?`,
  )
    .bind(albumCode, imageId)
    .first<AccessControlledRow>();
  return album ? authorizeTarget(cookieHeader, env, "album", album) : false;
}

export async function unlockTarget(
  request: Request,
  env: CloudflareEnv,
  targetType: TargetType,
  target: AccessControlledRow,
): Promise<Response> {
  if (target.visibility !== "passphrase") return new Response(null, { status: 404 });
  const form = await request.formData();
  const passphrase = form.get("passphrase");
  const redirectPath = `/${target.code}`;
  if (typeof passphrase !== "string" || Array.from(passphrase).length > 100) {
    return redirectError(redirectPath, "invalid_passphrase");
  }
  if (!(await consumeAttempt(request, env, target.code)))
    return redirectError(redirectPath, "too_many_attempts");

  const table = targetType === "image" ? "images" : "albums";
  const record = await env.DB.prepare(
    `SELECT passphrase_salt, passphrase_hash, passphrase_iterations FROM ${table} WHERE id = ?`,
  )
    .bind(target.id)
    .first<PassphraseRecord>();
  if (!record || !(await verifyPassphrase(passphrase, record)))
    return redirectError(redirectPath, "invalid_passphrase");

  const now = Date.now();
  const token = randomToken();
  await env.DB.prepare(
    `DELETE FROM share_access_grants WHERE id IN (
      SELECT id FROM share_access_grants WHERE expires_at <= ? LIMIT 500
    )`,
  )
    .bind(now)
    .run();
  await env.DB.prepare(
    `INSERT INTO share_access_grants
      (id, token_hash, target_type, target_id, access_version, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      await sha256(token),
      targetType,
      target.id,
      target.access_version,
      now,
      now + GRANT_LIFETIME_MS,
    )
    .run();
  return new Response(null, {
    status: 303,
    headers: {
      location: redirectPath,
      "cache-control": "no-store",
      "set-cookie": `${grantCookieName(target.code)}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${GRANT_LIFETIME_MS / 1000}`,
    },
  });
}

export async function revokeTargetGrants(
  env: CloudflareEnv,
  targetType: TargetType,
  targetId: string,
): Promise<void> {
  await env.DB.prepare("DELETE FROM share_access_grants WHERE target_type = ? AND target_id = ?")
    .bind(targetType, targetId)
    .run();
}

async function verifyPassphrase(passphrase: string, record: PassphraseRecord): Promise<boolean> {
  if (!record.passphrase_salt || !record.passphrase_hash || !record.passphrase_iterations)
    return false;
  const salt = decodeBase64Url(record.passphrase_salt);
  const expected = decodeBase64Url(record.passphrase_hash);
  if (
    !salt ||
    !expected ||
    record.passphrase_iterations < 100_000 ||
    record.passphrase_iterations > PASSPHRASE_ITERATIONS
  )
    return false;
  return timingSafeEqual(
    await pbkdf2Sha256(passphrase, salt, record.passphrase_iterations),
    expected,
  );
}

async function consumeAttempt(
  request: Request,
  env: CloudflareEnv,
  code: string,
): Promise<boolean> {
  const ip =
    request.headers.get("cf-connecting-ip")?.trim().toLowerCase() ??
    (isLocalhost(request.url) ? "local-development" : null);
  if (!ip || !env.RATE_LIMIT_SALT || env.RATE_LIMIT_SALT.length < 32) return false;
  const now = Date.now();
  const windowStart = now - ATTEMPT_WINDOW_MS;
  const ipHash = await hmacSha256(env.RATE_LIMIT_SALT, ip);
  await env.DB.prepare(
    `DELETE FROM share_access_attempts WHERE id IN (
      SELECT id FROM share_access_attempts WHERE created_at <= ? LIMIT 500
    )`,
  )
    .bind(windowStart)
    .run();
  const result = await env.DB.prepare(
    `INSERT INTO share_access_attempts (ip_hash, code, created_at)
      SELECT ?, ?, ? WHERE (
        SELECT COUNT(*) FROM share_access_attempts WHERE ip_hash = ? AND code = ? AND created_at > ?
      ) < ?`,
  )
    .bind(ipHash, code, now, ipHash, code, windowStart, ATTEMPT_LIMIT)
    .run();
  return (result.meta.changes ?? 0) === 1;
}

function cookieFromHeader(header: string | null, name: string): string | null {
  for (const part of (header ?? "").split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) {
      try {
        return decodeURIComponent(value.join("="));
      } catch {
        return null;
      }
    }
  }
  return null;
}

function grantCookieName(code: string): string {
  return `share_${code}`;
}

function redirectError(path: string, error: string): Response {
  return new Response(null, {
    status: 303,
    headers: { location: `${path}?error=${error}`, "cache-control": "no-store" },
  });
}

function isLocalhost(url: string): boolean {
  const hostname = new URL(url).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}
