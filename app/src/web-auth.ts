import { hmacSha256, randomToken, sha256, timingSafeEqual } from "./crypto";
import { acceptsFormOrigin, authenticateSession, verifyTurnstile } from "./service";

const CODE_LIFETIME_MS = 10 * 60 * 1000;
const MAGIC_LINK_LIFETIME_MS = 15 * 60 * 1000;
const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
const ATTEMPT_WINDOW_MS = 60 * 60 * 1000;
const ATTEMPT_LIMIT = 5;

interface VerificationCodeRow {
  id: string;
  minecraft_uuid: string;
  minecraft_name: string;
  expires_at: number;
  reserved_email_hash: string | null;
  used_at: number | null;
}

interface WebMagicLinkRow {
  id: string;
  email: string;
  purpose: "login" | "register";
  verification_code_id: string | null;
  expires_at: number;
  used_at: number | null;
}

export interface VerifiedMinecraftProfile {
  uuid: string;
  name: string;
  verifiedAt: number;
}

export function webRegistrationEnabled(env: CloudflareEnv): boolean {
  return env.WEB_REGISTRATION_ENABLED === "true";
}

export function normalizeVerificationCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase().replaceAll("-", "").replaceAll(" ", "");
  return /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/.test(normalized) ? normalized : null;
}

export async function registerMinecraftVerificationCode(
  request: Request,
  env: CloudflareEnv,
): Promise<Response> {
  if (!(await authorizedVerificationServer(request, env))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    code?: unknown;
    minecraftUuid?: unknown;
    minecraftName?: unknown;
  } | null;
  const code = normalizeVerificationCode(body?.code);
  const minecraftUuid =
    typeof body?.minecraftUuid === "string" ? body.minecraftUuid.trim().toLowerCase() : "";
  const minecraftName = typeof body?.minecraftName === "string" ? body.minecraftName.trim() : "";
  if (
    !code ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      minecraftUuid,
    ) ||
    !/^[0-9A-Za-z_]{1,16}$/.test(minecraftName)
  ) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  const now = Date.now();
  const codeHash = await verificationCodeHash(env, code);
  const existing = await env.DB.prepare(
    `SELECT id, minecraft_uuid, expires_at, used_at
      FROM minecraft_verification_codes WHERE code_hash = ?`,
  )
    .bind(codeHash)
    .first<{
      id: string;
      minecraft_uuid: string;
      expires_at: number;
      used_at: number | null;
    }>();
  if (existing) {
    if (
      existing.minecraft_uuid === minecraftUuid &&
      existing.used_at === null &&
      existing.expires_at > now
    ) {
      return Response.json(
        { expiresAt: new Date(existing.expires_at).toISOString() },
        { status: 200 },
      );
    }
    return Response.json({ error: "code_conflict" }, { status: 409 });
  }
  const id = crypto.randomUUID();
  const expiresAt = now + CODE_LIFETIME_MS;
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE minecraft_verification_codes SET used_at = ?
        WHERE minecraft_uuid = ? AND used_at IS NULL AND reserved_email_hash IS NULL`,
    ).bind(now, minecraftUuid),
    env.DB.prepare(
      `INSERT INTO minecraft_verification_codes
        (id, code_hash, minecraft_uuid, minecraft_name, created_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(id, codeHash, minecraftUuid, minecraftName, now, expiresAt),
  ]);
  return Response.json({ expiresAt: new Date(expiresAt).toISOString() }, { status: 201 });
}

export async function requestWebLogin(request: Request, env: CloudflareEnv): Promise<Response> {
  const form = await request.formData();
  const email = normalizeEmail(form.get("email"));
  if (!acceptsFormOrigin(request.headers.get("origin"), request.url)) {
    return redirect("/login", "invalid_request");
  }
  if (!email) return redirect("/login", "invalid_email");
  if (!(await verifyTurnstile(request, env, formToken(form), "web_login"))) {
    return redirect("/login", "turnstile_failed");
  }
  if (!(await consumeAttempt(request, env, email, "login"))) return redirect("/login", "sent");
  const user = await env.DB.prepare("SELECT id FROM users WHERE email = ? COLLATE NOCASE")
    .bind(email)
    .first<{ id: string }>();
  if (user) await sendWebMagicLink(env, email, "login", null);
  return redirect("/login", "sent");
}

export async function requestWebRegistration(
  request: Request,
  env: CloudflareEnv,
): Promise<Response> {
  if (!webRegistrationEnabled(env)) return redirect("/register", "disabled");
  const form = await request.formData();
  const email = normalizeEmail(form.get("email"));
  const code = normalizeVerificationCode(form.get("code"));
  if (!acceptsFormOrigin(request.headers.get("origin"), request.url)) {
    return redirect("/register", "invalid_request");
  }
  if (!email) return redirect("/register", "invalid_email");
  if (!code) return redirect("/register", "invalid_code");
  if (!(await verifyTurnstile(request, env, formToken(form), "web_register"))) {
    return redirect("/register", "turnstile_failed");
  }
  if (!(await consumeAttempt(request, env, email, "register")))
    return redirect("/register", "sent");
  const codeHash = await verificationCodeHash(env, code);
  const now = Date.now();
  const verification = await env.DB.prepare(
    `SELECT id, minecraft_uuid, minecraft_name, expires_at, reserved_email_hash, used_at
      FROM minecraft_verification_codes WHERE code_hash = ?`,
  )
    .bind(codeHash)
    .first<VerificationCodeRow>();
  if (
    !verification ||
    verification.used_at !== null ||
    verification.expires_at <= now ||
    verification.reserved_email_hash !== null
  ) {
    return redirect("/register", "invalid_code");
  }
  const emailHash = await hmacSha256(env.RATE_LIMIT_SALT, email);
  const reserved = await env.DB.prepare(
    `UPDATE minecraft_verification_codes
      SET reserved_email_hash = ?, reserved_at = ?
      WHERE id = ? AND used_at IS NULL AND reserved_email_hash IS NULL AND expires_at > ?`,
  )
    .bind(emailHash, now, verification.id, now)
    .run();
  if ((reserved.meta.changes ?? 0) !== 1) return redirect("/register", "invalid_code");
  try {
    await sendWebMagicLink(env, email, "register", verification.id);
  } catch (error) {
    await env.DB.prepare(
      `UPDATE minecraft_verification_codes
        SET reserved_email_hash = NULL, reserved_at = NULL
        WHERE id = ? AND used_at IS NULL AND reserved_email_hash = ?`,
    )
      .bind(verification.id, emailHash)
      .run();
    throw error;
  }
  return redirect("/register", "sent");
}

export async function verifyWebMagicLink(url: URL, env: CloudflareEnv): Promise<Response> {
  const token = url.searchParams.get("token");
  if (!token || token.length < 32 || token.length > 128)
    return authError("リンクが無効です", "ログインリンクをご確認ください。", 400);
  const now = Date.now();
  const magic = await env.DB.prepare(
    `SELECT id, email, purpose, verification_code_id, expires_at, used_at
      FROM web_magic_link_tokens WHERE token_hash = ?`,
  )
    .bind(await sha256(token))
    .first<WebMagicLinkRow>();
  if (!magic || magic.used_at !== null || magic.expires_at <= now) {
    return authError("リンクが無効です", "このリンクは使用済みか、有効期限が切れています。", 400);
  }
  let verification: VerificationCodeRow | null = null;
  if (magic.purpose === "register") {
    verification = await env.DB.prepare(
      `SELECT id, minecraft_uuid, minecraft_name, expires_at, reserved_email_hash, used_at
        FROM minecraft_verification_codes WHERE id = ?`,
    )
      .bind(magic.verification_code_id)
      .first<VerificationCodeRow>();
    const expectedEmailHash = await hmacSha256(env.RATE_LIMIT_SALT, magic.email);
    if (
      !verification ||
      verification.used_at !== null ||
      verification.reserved_email_hash !== expectedEmailHash
    ) {
      return authError("認証コードが無効です", "認証サーバーへ再接続してください。", 400);
    }
  }
  const existingUser = await env.DB.prepare("SELECT id FROM users WHERE email = ? COLLATE NOCASE")
    .bind(magic.email)
    .first<{ id: string }>();
  if (magic.purpose === "login" && !existingUser) {
    return authError("アカウントがありません", "新規登録からお進みください。", 400);
  }
  const userId = existingUser?.id ?? crypto.randomUUID();
  if (verification) {
    const owner = await env.DB.prepare(
      `SELECT user_id FROM user_minecraft_profiles
        WHERE minecraft_uuid = ? AND status = 'verified'`,
    )
      .bind(verification.minecraft_uuid)
      .first<{ user_id: string }>();
    if (owner && owner.user_id !== userId) {
      return authError(
        "Minecraft IDは登録済みです",
        "このMinecraft IDは別のアカウントで認証されています。",
        409,
      );
    }
  }
  const sessionToken = randomToken();
  const statements: D1PreparedStatement[] = [];
  if (!existingUser) {
    statements.push(
      env.DB.prepare("INSERT INTO users (id, email, created_at) VALUES (?, ?, ?)").bind(
        userId,
        magic.email,
        now,
      ),
    );
  }
  const webDevice = await env.DB.prepare(
    "SELECT id FROM devices WHERE user_id = ? AND kind = 'web'",
  )
    .bind(userId)
    .first<{ id: string }>();
  if (!webDevice) {
    statements.push(
      env.DB.prepare(
        `INSERT INTO devices (id, token_hash, user_id, created_at, last_seen_at, kind)
          VALUES (?, ?, ?, ?, ?, 'web')`,
      ).bind(crypto.randomUUID(), await sha256(randomToken()), userId, now, now),
    );
  }
  if (verification) {
    statements.push(
      env.DB.prepare(
        `INSERT INTO minecraft_profiles
          (uuid, current_name, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?)
          ON CONFLICT(uuid) DO UPDATE SET
            current_name = excluded.current_name, last_seen_at = excluded.last_seen_at`,
      ).bind(verification.minecraft_uuid, verification.minecraft_name, now, now),
      env.DB.prepare(
        `INSERT INTO user_minecraft_profiles
          (user_id, minecraft_uuid, source_device_id, status, linked_at, last_seen_at, verified_at)
          VALUES (?, ?, NULL, 'verified', ?, ?, ?)
          ON CONFLICT(user_id, minecraft_uuid) DO UPDATE SET
            status = 'verified', last_seen_at = excluded.last_seen_at,
            verified_at = excluded.verified_at`,
      ).bind(userId, verification.minecraft_uuid, now, now, now),
      env.DB.prepare(
        "UPDATE minecraft_verification_codes SET used_at = ? WHERE id = ? AND used_at IS NULL",
      ).bind(now, verification.id),
    );
  }
  statements.push(
    env.DB.prepare(
      "UPDATE web_magic_link_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL",
    ).bind(now, magic.id),
    env.DB.prepare(
      "INSERT INTO sessions (id, token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
    ).bind(crypto.randomUUID(), await sha256(sessionToken), userId, now, now + SESSION_LIFETIME_MS),
  );
  await env.DB.batch(statements);
  return new Response(null, {
    status: 303,
    headers: {
      location: "/manage",
      "set-cookie": sessionCookie(sessionToken, SESSION_LIFETIME_MS / 1000),
      "cache-control": "no-store",
    },
  });
}

export async function linkMinecraftProfile(
  request: Request,
  env: CloudflareEnv,
): Promise<Response> {
  if (!acceptsFormOrigin(request.headers.get("origin"), request.url))
    return redirect("/manage", "invalid_request");
  const session = await authenticateSession(request, env);
  if (!session) return new Response(null, { status: 404 });
  const form = await request.formData();
  const code = normalizeVerificationCode(form.get("code"));
  if (!code) return redirect("/manage", "invalid_code");
  const user = await env.DB.prepare("SELECT email FROM users WHERE id = ?")
    .bind(session.user_id)
    .first<{ email: string }>();
  if (!user || !(await consumeAttempt(request, env, user.email, "link")))
    return redirect("/manage", "invalid_code");
  const now = Date.now();
  const verification = await env.DB.prepare(
    `SELECT id, minecraft_uuid, minecraft_name, expires_at, reserved_email_hash, used_at
      FROM minecraft_verification_codes WHERE code_hash = ?`,
  )
    .bind(await verificationCodeHash(env, code))
    .first<VerificationCodeRow>();
  if (
    !verification ||
    verification.used_at !== null ||
    verification.expires_at <= now ||
    verification.reserved_email_hash !== null
  ) {
    return redirect("/manage", "invalid_code");
  }
  const owner = await env.DB.prepare(
    `SELECT user_id FROM user_minecraft_profiles
      WHERE minecraft_uuid = ? AND status = 'verified'`,
  )
    .bind(verification.minecraft_uuid)
    .first<{ user_id: string }>();
  if (owner && owner.user_id !== session.user_id) return redirect("/manage", "profile_linked");
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO minecraft_profiles
        (uuid, current_name, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?)
        ON CONFLICT(uuid) DO UPDATE SET
          current_name = excluded.current_name, last_seen_at = excluded.last_seen_at`,
    ).bind(verification.minecraft_uuid, verification.minecraft_name, now, now),
    env.DB.prepare(
      `INSERT INTO user_minecraft_profiles
        (user_id, minecraft_uuid, source_device_id, status, linked_at, last_seen_at, verified_at)
        VALUES (?, ?, NULL, 'verified', ?, ?, ?)
        ON CONFLICT(user_id, minecraft_uuid) DO UPDATE SET
          status = 'verified', last_seen_at = excluded.last_seen_at,
          verified_at = excluded.verified_at`,
    ).bind(session.user_id, verification.minecraft_uuid, now, now, now),
    env.DB.prepare(
      "UPDATE minecraft_verification_codes SET used_at = ? WHERE id = ? AND used_at IS NULL",
    ).bind(now, verification.id),
  ]);
  return redirect("/manage", "profile_linked_success");
}

export async function verifiedMinecraftProfiles(
  env: CloudflareEnv,
  userId: string,
): Promise<VerifiedMinecraftProfile[]> {
  const rows = await env.DB.prepare(
    `SELECT p.uuid, p.current_name AS name, ump.verified_at
      FROM user_minecraft_profiles ump
      JOIN minecraft_profiles p ON p.uuid = ump.minecraft_uuid
      WHERE ump.user_id = ? AND ump.status = 'verified'
      ORDER BY ump.verified_at, ump.linked_at`,
  )
    .bind(userId)
    .all<{ uuid: string; name: string; verified_at: number }>();
  return rows.results.map((row) => ({
    uuid: row.uuid,
    name: row.name,
    verifiedAt: row.verified_at,
  }));
}

async function sendWebMagicLink(
  env: CloudflareEnv,
  email: string,
  purpose: "login" | "register",
  verificationCodeId: string | null,
): Promise<void> {
  const now = Date.now();
  const token = randomToken();
  const tokenId = crypto.randomUUID();
  const link = `${env.PUBLIC_BASE_URL.replace(/\/$/, "")}/auth/web-verify?token=${encodeURIComponent(token)}`;
  await env.DB.prepare(
    `INSERT INTO web_magic_link_tokens
      (id, token_hash, email, purpose, verification_code_id, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      tokenId,
      await sha256(token),
      email,
      purpose,
      verificationCodeId,
      now,
      now + MAGIC_LINK_LIFETIME_MS,
    )
    .run();
  try {
    await env.EMAIL.send({
      to: email,
      from: env.EMAIL_FROM,
      subject: "Your i.らぶ.moe confirmation link / i.らぶ.moe 確認リンク",
      text: `Open this link within 15 minutes.\n\n${link}\n\n次のリンクを15分以内に開いてください。\n\n${link}`,
      html: `<div lang="en"><p>Open this link within 15 minutes.</p><p><a href="${link}">Continue to i.らぶ.moe</a></p></div><hr><div lang="ja"><p>次のリンクを15分以内に開いてください。</p><p><a href="${link}">i.らぶ.moeへ進む</a></p></div>`,
    });
  } catch (error) {
    await env.DB.prepare("DELETE FROM web_magic_link_tokens WHERE id = ?").bind(tokenId).run();
    throw error;
  }
}

async function consumeAttempt(
  request: Request,
  env: CloudflareEnv,
  email: string,
  purpose: "login" | "register" | "link",
): Promise<boolean> {
  const ip = request.headers.get("cf-connecting-ip")?.trim().toLowerCase();
  if (!ip || !env.RATE_LIMIT_SALT || env.RATE_LIMIT_SALT.length < 32) return false;
  const now = Date.now();
  const windowStart = now - ATTEMPT_WINDOW_MS;
  const emailHash = await hmacSha256(env.RATE_LIMIT_SALT, email);
  const ipHash = await hmacSha256(env.RATE_LIMIT_SALT, ip);
  await env.DB.prepare("DELETE FROM web_auth_attempts WHERE created_at <= ?")
    .bind(windowStart)
    .run();
  const result = await env.DB.prepare(
    `INSERT INTO web_auth_attempts (id, email_hash, ip_hash, purpose, created_at)
      SELECT ?, ?, ?, ?, ?
      WHERE (SELECT COUNT(*) FROM web_auth_attempts
        WHERE (email_hash = ? OR ip_hash = ?) AND created_at > ?) < ?`,
  )
    .bind(
      crypto.randomUUID(),
      emailHash,
      ipHash,
      purpose,
      now,
      emailHash,
      ipHash,
      windowStart,
      ATTEMPT_LIMIT,
    )
    .run();
  return (result.meta.changes ?? 0) === 1;
}

async function verificationCodeHash(env: CloudflareEnv, code: string): Promise<string> {
  if (!env.RATE_LIMIT_SALT || env.RATE_LIMIT_SALT.length < 32)
    throw new Error("RATE_LIMIT_SALT is missing or too short");
  return hmacSha256(env.RATE_LIMIT_SALT, `minecraft-verification:${code}`);
}

async function authorizedVerificationServer(
  request: Request,
  env: CloudflareEnv,
): Promise<boolean> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ") || !env.MINECRAFT_VERIFICATION_TOKEN) return false;
  const actual = new TextEncoder().encode(await sha256(authorization.slice(7)));
  const expected = new TextEncoder().encode(await sha256(env.MINECRAFT_VERIFICATION_TOKEN));
  return timingSafeEqual(actual, expected);
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function formToken(form: FormData): string {
  const value = form.get("cf-turnstile-response");
  return typeof value === "string" ? value : "";
}

function sessionCookie(value: string, maxAgeSeconds: number): string {
  return `session=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.floor(maxAgeSeconds)}`;
}

function redirect(path: string, status: string): Response {
  return new Response(null, {
    status: 303,
    headers: {
      location: `${path}?status=${encodeURIComponent(status)}`,
      "cache-control": "no-store",
    },
  });
}

function authError(title: string, message: string, status: number): Response {
  return new Response(
    `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title} | i.らぶ.moe</title><body><main><h1>${title}</h1><p>${message}</p><a href="/">トップへ戻る</a></main></body></html>`,
    {
      status,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "content-security-policy":
          "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
      },
    },
  );
}
