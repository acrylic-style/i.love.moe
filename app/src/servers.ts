import { randomBase62, randomToken, sha256 } from "./crypto";
import { resolve4, resolve6, resolveSrv } from "node:dns/promises";
import { createConnection } from "node:net";
import { domainToUnicode } from "node:url";
import { planLimits } from "./plans";
import { authenticateSession, normalizeOptionalText } from "./service";
import type { ImageRow, ServerRow } from "./types";

const CHALLENGE_LIFETIME_MS = 30 * 60 * 1000;
const ATTEMPT_WINDOW_MS = 60 * 60 * 1000;
const USER_ATTEMPT_LIMIT = 10;
const SERVER_ATTEMPT_LIMIT = 5;
const IDENTIFIER_PATTERN = /^[0-9A-Za-z]{8}$/;
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/;

export interface ParsedServerAddress {
  hostAscii: string;
  port: number;
  displayAddress: string;
}

export function displayServerAddress(address: string | null): string {
  if (!address || address.startsWith("[")) return address ?? "";
  const match = address.match(/^([^:]+)(:\d+)?$/);
  if (!match) return address;
  return `${domainToUnicode(match[1]!) || match[1]}${match[2] ?? ""}`;
}

export interface ServerDetail {
  server: ServerRow;
  images: ImageRow[];
  albums: Array<{
    id: string;
    title: string;
    description: string | null;
    code: string;
    cover_code: string | null;
    image_count: number;
  }>;
}

export interface ManagedServerDetail {
  server: ServerRow;
  role: "owner" | "editor";
  addresses: Array<{
    id: string;
    host_ascii: string;
    port: number;
    display_address: string;
    verified_at: number | null;
    is_primary: number;
    pending_server_id: string | null;
  }>;
}

export function parseServerAddress(value: string | null): ParsedServerAddress | null {
  const input = value?.trim();
  if (!input || input.length > 255 || input.toLowerCase() === "singleplayer") return null;
  let host = input;
  let port = 25565;
  if (input.startsWith("[")) {
    const match = input.match(/^\[([^\]]+)\](?::(\d{1,5}))?$/);
    if (!match) return null;
    host = match[1]!;
    if (match[2]) port = Number(match[2]);
  } else {
    const colonCount = (input.match(/:/g) ?? []).length;
    if (colonCount === 1) {
      const [candidate, portText] = input.split(":");
      if (!candidate || !portText || !/^\d{1,5}$/.test(portText)) return null;
      host = candidate;
      port = Number(portText);
    } else if (colonCount > 1) {
      host = input;
    }
  }
  if (port < 1 || port > 65535) return null;
  const hostAscii = asciiHostname(host);
  if (!hostAscii || isDisallowedHost(hostAscii)) return null;
  const displayHost = hostAscii.includes(":") ? `[${hostAscii}]` : hostAscii;
  return {
    hostAscii,
    port,
    displayAddress: port === 25565 ? displayHost : `${displayHost}:${port}`,
  };
}

export function asciiHostname(value: string): string | null {
  const normalized = value.trim().replace(/\.$/, "").toLowerCase();
  if (!normalized || normalized.length > 253) return null;
  if (normalized.includes(":")) return /^[0-9a-f:]+$/i.test(normalized) ? normalized : null;
  try {
    const ascii = new URL(`http://${normalized}`).hostname.toLowerCase();
    if (
      ascii.length > 253 ||
      !ascii.includes(".") ||
      ascii.split(".").some((label) => !label || label.length > 63)
    )
      return null;
    return ascii;
  } catch {
    return null;
  }
}

export function isDisallowedHost(host: string): boolean {
  const normalized = host.toLowerCase();
  if (normalized.startsWith("::ffff:")) return isDisallowedHost(normalized.slice(7));
  if (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    normalized.startsWith("ff") ||
    normalized.startsWith("100:") ||
    normalized.startsWith("2001:db8:") ||
    normalized.startsWith("2001:10:") ||
    normalized.startsWith("2001:2:")
  )
    return true;
  const octets = normalized.split(".").map(Number);
  if (
    octets.length !== 4 ||
    octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  )
    return false;
  const a = octets[0]!;
  const b = octets[1]!;
  const c = octets[2]!;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 88 || b === 168)) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113)
  );
}

export async function ensureServerForAddress(
  env: CloudflareEnv,
  address: string | null,
): Promise<string | null> {
  const parsed = parseServerAddress(address);
  if (!parsed) return null;
  const existing = await env.DB.prepare(
    `SELECT a.server_id, a.verified_at, s.owner_user_id FROM server_addresses a
      JOIN servers s ON s.id = a.server_id WHERE a.host_ascii = ? AND a.port = ?`,
  )
    .bind(parsed.hostAscii, parsed.port)
    .first<{ server_id: string; verified_at: number | null; owner_user_id: string | null }>();
  if (existing) return existing.verified_at || !existing.owner_user_id ? existing.server_id : null;
  const now = Date.now();
  for (let attempt = 0; attempt < 10; attempt++) {
    const id = crypto.randomUUID();
    const code = randomBase62(8);
    try {
      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO servers (id, code, created_at, updated_at) VALUES (?, ?, ?, ?)`,
        ).bind(id, code, now, now),
        env.DB.prepare(
          `INSERT INTO server_addresses
            (id, server_id, host_ascii, port, display_address, is_primary)
            VALUES (?, ?, ?, ?, ?, 1)`,
        ).bind(crypto.randomUUID(), id, parsed.hostAscii, parsed.port, parsed.displayAddress),
      ]);
      return id;
    } catch (error) {
      const raced = await env.DB.prepare(
        "SELECT server_id FROM server_addresses WHERE host_ascii = ? AND port = ?",
      )
        .bind(parsed.hostAscii, parsed.port)
        .first<{ server_id: string }>();
      if (raced) return raced.server_id;
      if (attempt === 9) throw error;
    }
  }
  return null;
}

export async function findServer(
  env: CloudflareEnv,
  identifier: string,
): Promise<ServerRow | null> {
  const normalized = identifier.toLowerCase();
  const row = await env.DB.prepare(
    `SELECT s.*, a.host_ascii, a.port, a.display_address
      FROM servers s
      JOIN server_addresses a ON a.server_id = s.id AND a.is_primary = 1
      WHERE lower(s.code) = ? OR lower(s.slug) = ?
      LIMIT 1`,
  )
    .bind(normalized, normalized)
    .first<ServerRow>();
  if (row) return row;
  const history = await env.DB.prepare(
    "SELECT server_id FROM server_slug_history WHERE identifier = ?",
  )
    .bind(normalized)
    .first<{ server_id: string }>();
  return history
    ? env.DB.prepare(
        `SELECT s.*, a.host_ascii, a.port, a.display_address FROM servers s
          JOIN server_addresses a ON a.server_id = s.id AND a.is_primary = 1 WHERE s.id = ?`,
      )
        .bind(history.server_id)
        .first<ServerRow>()
    : null;
}

export async function unclaimedServerById(
  env: CloudflareEnv,
  serverId: string,
): Promise<(ServerRow & { address_id: string }) | null> {
  return env.DB.prepare(
    `SELECT s.*, a.id AS address_id, a.host_ascii, a.port, a.display_address
      FROM servers s JOIN server_addresses a ON a.server_id = s.id AND a.is_primary = 1
      WHERE s.id = ? AND s.owner_user_id IS NULL`,
  )
    .bind(serverId)
    .first<ServerRow & { address_id: string }>();
}

export async function publicServerDetail(
  env: CloudflareEnv,
  identifier: string,
): Promise<ServerDetail | null> {
  const server = await findServer(env, identifier);
  if (!server) return null;
  const [images, albums] = await Promise.all([
    env.DB.prepare(
      `SELECT i.*, sl.code FROM images i
        JOIN short_links sl ON sl.target_type = 'image' AND sl.target_id = i.id AND sl.retired_at IS NULL
        LEFT JOIN server_feed_hidden h ON h.server_id = i.server_id AND h.image_id = i.id
        WHERE i.server_id = ? AND i.discoverability = 'public' AND i.visibility = 'unlisted'
          AND i.deleted_at IS NULL AND i.expires_at > ? AND h.image_id IS NULL
        ORDER BY i.created_at DESC LIMIT 60`,
    )
      .bind(server.id, Date.now())
      .all<ImageRow>(),
    env.DB.prepare(
      `SELECT a.id, a.title, a.description, sl.code,
        (SELECT isl.code FROM album_images ai
          JOIN images i ON i.id = ai.image_id
          JOIN short_links isl ON isl.target_type = 'image' AND isl.target_id = i.id
          WHERE ai.album_id = a.id AND i.deleted_at IS NULL AND i.expires_at > ?
          ORDER BY ai.position LIMIT 1) AS cover_code,
        (SELECT COUNT(*) FROM album_images ai JOIN images i ON i.id = ai.image_id
          WHERE ai.album_id = a.id AND i.deleted_at IS NULL AND i.expires_at > ?) AS image_count
        FROM albums a JOIN short_links sl ON sl.target_type = 'album' AND sl.target_id = a.id
          AND sl.retired_at IS NULL
        WHERE a.server_id = ? AND a.discoverability = 'public' AND a.visibility = 'unlisted'
          AND a.deleted_at IS NULL
        ORDER BY a.updated_at DESC LIMIT 30`,
    )
      .bind(Date.now(), Date.now(), server.id)
      .all<ServerDetail["albums"][number]>(),
  ]);
  if (!server.owner_user_id && images.results.length === 0) return null;
  const plus = await canUseServerPlus(env, server.id);
  if (!plus) {
    server.icon_key = null;
    server.banner_key = null;
    server.featured_image_id = null;
  }
  const orderedImages = [...images.results];
  if (server.featured_image_id)
    orderedImages.sort((left, right) =>
      left.id === server.featured_image_id ? -1 : right.id === server.featured_image_id ? 1 : 0,
    );
  return { server, images: orderedImages, albums: albums.results };
}

export async function listPublicServers(env: CloudflareEnv, query: string): Promise<ServerRow[]> {
  const q = `%${query.trim().slice(0, 100).replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
  const rows = await env.DB.prepare(
    `SELECT s.*, a.host_ascii, a.port, a.display_address FROM servers s
      JOIN server_addresses a ON a.server_id = s.id AND a.is_primary = 1
      WHERE (s.owner_user_id IS NOT NULL OR EXISTS (
        SELECT 1 FROM images i WHERE i.server_id = s.id AND i.discoverability = 'public'
          AND i.deleted_at IS NULL AND i.expires_at > ?
      )) AND (? = '%%' OR s.display_name LIKE ? ESCAPE '\\' COLLATE NOCASE
        OR a.display_address LIKE ? ESCAPE '\\' COLLATE NOCASE)
      ORDER BY COALESCE(s.verified_at, 0) DESC, s.updated_at DESC LIMIT 50`,
  )
    .bind(Date.now(), q, q, q)
    .all<ServerRow>();
  return rows.results;
}

export async function managedServers(env: CloudflareEnv, userId: string): Promise<ServerRow[]> {
  const rows = await env.DB.prepare(
    `SELECT s.*, a.host_ascii, a.port, a.display_address FROM servers s
      JOIN server_addresses a ON a.server_id = s.id AND a.is_primary = 1
      LEFT JOIN server_members m ON m.server_id = s.id AND m.user_id = ?
      WHERE s.owner_user_id = ? OR m.user_id = ?
      ORDER BY s.updated_at DESC`,
  )
    .bind(userId, userId, userId)
    .all<ServerRow>();
  return rows.results;
}

export async function managedServerDetail(
  env: CloudflareEnv,
  userId: string,
  serverId: string,
): Promise<ManagedServerDetail | null> {
  const server = await env.DB.prepare(
    `SELECT s.*, a.host_ascii, a.port, a.display_address,
      CASE WHEN s.owner_user_id = ? THEN 'owner' ELSE m.role END AS member_role
      FROM servers s
      JOIN server_addresses a ON a.server_id = s.id AND a.is_primary = 1
      LEFT JOIN server_members m ON m.server_id = s.id AND m.user_id = ?
      WHERE s.id = ? AND (s.owner_user_id = ? OR m.user_id = ?)`,
  )
    .bind(userId, userId, serverId, userId, userId)
    .first<ServerRow & { member_role: "owner" | "editor" }>();
  if (!server) return null;
  const addresses = await env.DB.prepare(
    `SELECT id, host_ascii, port, display_address, verified_at, is_primary, pending_server_id
      FROM server_addresses WHERE server_id = ? OR pending_server_id = ?
      ORDER BY is_primary DESC, display_address`,
  )
    .bind(serverId, serverId)
    .all<ManagedServerDetail["addresses"][number]>();
  return { server, role: server.member_role, addresses: addresses.results };
}

export async function uploadServerBranding(
  request: Request,
  env: CloudflareEnv,
  serverId: string,
): Promise<Response> {
  const session = await authenticateSession(request, env);
  if (
    !session ||
    !(await canManageServer(env, serverId, session.user_id)) ||
    !(await canUseServerPlus(env, serverId))
  )
    return new Response(null, { status: 404 });
  const form = await request.formData();
  const kind = form.get("kind");
  const file = form.get("file");
  if (
    (kind !== "icon" && kind !== "banner") ||
    !(file instanceof File) ||
    file.size <= 0 ||
    file.size > (kind === "icon" ? 2 * 1024 * 1024 : 8 * 1024 * 1024) ||
    !["image/png", "image/jpeg", "image/webp"].includes(file.type)
  )
    return Response.json({ error: "invalid_branding_image" }, { status: 400 });
  const extension = file.type === "image/png" ? "png" : file.type === "image/jpeg" ? "jpg" : "webp";
  const key = `servers/${serverId}/${kind}-${crypto.randomUUID()}.${extension}`;
  const column = kind === "icon" ? "icon_key" : "banner_key";
  const current = await env.DB.prepare(`SELECT ${column} AS r2_key FROM servers WHERE id = ?`)
    .bind(serverId)
    .first<{ r2_key: string | null }>();
  await env.IMAGES.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type, cacheControl: "public, max-age=3600" },
  });
  await env.DB.prepare(`UPDATE servers SET ${column} = ?, updated_at = ? WHERE id = ?`)
    .bind(key, Date.now(), serverId)
    .run();
  if (current?.r2_key) await env.IMAGES.delete(current.r2_key);
  return new Response(null, {
    status: 303,
    headers: { location: `/manage/servers/${serverId}` },
  });
}

export async function managedServerImages(
  env: CloudflareEnv,
  serverId: string,
): Promise<Array<ImageRow & { hidden_from_feed: number }>> {
  const rows = await env.DB.prepare(
    `SELECT i.*, sl.code, (h.image_id IS NOT NULL) AS hidden_from_feed
      FROM images i
      JOIN short_links sl ON sl.target_type = 'image' AND sl.target_id = i.id AND sl.retired_at IS NULL
      LEFT JOIN server_feed_hidden h ON h.server_id = i.server_id AND h.image_id = i.id
      WHERE i.server_id = ? AND i.discoverability = 'public' AND i.visibility = 'unlisted'
        AND i.deleted_at IS NULL AND i.expires_at > ?
      ORDER BY i.created_at DESC LIMIT 100`,
  )
    .bind(serverId, Date.now())
    .all<ImageRow & { hidden_from_feed: number }>();
  return rows.results;
}

export async function updateServerFeed(
  request: Request,
  env: CloudflareEnv,
  serverId: string,
): Promise<Response> {
  const session = await authenticateSession(request, env);
  if (!session || !(await canManageServer(env, serverId, session.user_id)))
    return new Response(null, { status: 404 });
  const form = await request.formData();
  const imageId = form.get("imageId");
  const action = form.get("action");
  if (
    typeof imageId !== "string" ||
    !["hide", "show", "feature", "unfeature"].includes(String(action))
  )
    return Response.json({ error: "invalid_action" }, { status: 400 });
  const image = await env.DB.prepare(
    `SELECT id FROM images WHERE id = ? AND server_id = ? AND discoverability = 'public'
      AND visibility = 'unlisted' AND deleted_at IS NULL AND expires_at > ?`,
  )
    .bind(imageId, serverId, Date.now())
    .first();
  if (!image) return new Response(null, { status: 404 });
  if ((action === "feature" || action === "unfeature") && !(await canUseServerPlus(env, serverId)))
    return Response.json({ error: "plus_required" }, { status: 403 });
  if (action === "hide")
    await env.DB.prepare(
      `INSERT OR IGNORE INTO server_feed_hidden
        (server_id, image_id, hidden_by_user_id, created_at) VALUES (?, ?, ?, ?)`,
    )
      .bind(serverId, imageId, session.user_id, Date.now())
      .run();
  else if (action === "show")
    await env.DB.prepare("DELETE FROM server_feed_hidden WHERE server_id = ? AND image_id = ?")
      .bind(serverId, imageId)
      .run();
  else
    await env.DB.prepare("UPDATE servers SET featured_image_id = ?, updated_at = ? WHERE id = ?")
      .bind(action === "feature" ? imageId : null, Date.now(), serverId)
      .run();
  return new Response(null, {
    status: 303,
    headers: { location: `/manage/servers/${serverId}` },
  });
}

export async function inviteServerEditor(
  request: Request,
  env: CloudflareEnv,
  serverId: string,
): Promise<Response> {
  const session = await authenticateSession(request, env);
  const owner = session
    ? await env.DB.prepare(
        `SELECT s.owner_user_id, s.display_name, a.display_address FROM servers s
          JOIN server_addresses a ON a.server_id = s.id AND a.is_primary = 1 WHERE s.id = ?`,
      )
        .bind(serverId)
        .first<{
          owner_user_id: string | null;
          display_name: string | null;
          display_address: string;
        }>()
    : null;
  if (
    !session ||
    owner?.owner_user_id !== session.user_id ||
    !(await canUseServerPlus(env, serverId))
  )
    return new Response(null, { status: 404 });
  const form = await request.formData();
  const rawEmail = form.get("email");
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
    return Response.json({ error: "invalid_email" }, { status: 400 });
  const count = await env.DB.prepare(
    `SELECT
      (SELECT COUNT(*) FROM server_members WHERE server_id = ? AND role = 'editor') +
      (SELECT COUNT(*) FROM server_invitations WHERE server_id = ? AND accepted_at IS NULL AND expires_at > ?)
      AS count`,
  )
    .bind(serverId, serverId, Date.now())
    .first<{ count: number }>();
  if ((count?.count ?? 0) >= 10)
    return Response.json({ error: "editor_limit_reached" }, { status: 409 });
  const token = randomToken();
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO server_invitations
      (id, server_id, email, token_hash, invited_by_user_id, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      serverId,
      email,
      await sha256(token),
      session.user_id,
      now,
      now + 7 * 24 * 60 * 60 * 1000,
    )
    .run();
  const name = owner.display_name ?? owner.display_address;
  const link = `${env.PUBLIC_BASE_URL.replace(/\/$/, "")}/manage/servers/invitations/${token}`;
  await env.EMAIL.send({
    to: email,
    from: env.EMAIL_FROM,
    subject: `Invitation to manage ${name} / ${name} の管理への招待`,
    text: `You have been invited to manage the server page for ${name}.\nSign in with this email address, then open:\n${link}\n\n${name} のサーバーページ管理に招待されました。\nこのメールアドレスでログインしてから、次のURLを開いてください。\n${link}`,
    html: `<p>You have been invited to manage the server page for <strong>${escapeHtml(name)}</strong>.</p><p>Sign in with this email address, then <a href="${link}">accept the invitation</a>.</p><hr><p><strong>${escapeHtml(name)}</strong> のサーバーページ管理に招待されました。</p><p>このメールアドレスでログインしてから、<a href="${link}">招待を承認してください</a>。</p>`,
  });
  return new Response(null, {
    status: 303,
    headers: { location: `/manage/servers/${serverId}` },
  });
}

export async function acceptServerEditorInvitation(
  request: Request,
  env: CloudflareEnv,
  token: string,
): Promise<Response> {
  const session = await authenticateSession(request, env);
  if (!session) return new Response(null, { status: 404 });
  const invitation = await env.DB.prepare(
    `SELECT i.id, i.server_id, i.email, u.email AS user_email
      FROM server_invitations i JOIN users u ON u.id = ?
      WHERE i.token_hash = ? AND i.accepted_at IS NULL AND i.expires_at > ?`,
  )
    .bind(session.user_id, await sha256(token), Date.now())
    .first<{ id: string; server_id: string; email: string; user_email: string }>();
  if (!invitation || invitation.email.toLowerCase() !== invitation.user_email.toLowerCase())
    return new Response(null, { status: 404 });
  if (!(await canUseServerPlus(env, invitation.server_id)))
    return Response.json({ error: "plus_required" }, { status: 403 });
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO server_members (server_id, user_id, role, created_at)
        VALUES (?, ?, 'editor', ?)
        ON CONFLICT(server_id, user_id) DO UPDATE SET role = 'editor'`,
    ).bind(invitation.server_id, session.user_id, Date.now()),
    env.DB.prepare("UPDATE server_invitations SET accepted_at = ? WHERE id = ?").bind(
      Date.now(),
      invitation.id,
    ),
  ]);
  return Response.redirect(
    `${env.PUBLIC_BASE_URL.replace(/\/$/, "")}/manage/servers/${invitation.server_id}`,
    303,
  );
}

export async function removeServerEditor(
  request: Request,
  env: CloudflareEnv,
  serverId: string,
  userId: string,
): Promise<Response> {
  const session = await authenticateSession(request, env);
  const server = session
    ? await env.DB.prepare("SELECT owner_user_id FROM servers WHERE id = ?")
        .bind(serverId)
        .first<{ owner_user_id: string | null }>()
    : null;
  if (!session || server?.owner_user_id !== session.user_id)
    return new Response(null, { status: 404 });
  await env.DB.prepare(
    "DELETE FROM server_members WHERE server_id = ? AND user_id = ? AND role = 'editor'",
  )
    .bind(serverId, userId)
    .run();
  return new Response(null, { status: 204 });
}

export async function requestServerOwnershipTransfer(
  request: Request,
  env: CloudflareEnv,
  serverId: string,
): Promise<Response> {
  const session = await authenticateSession(request, env);
  const server = session
    ? await env.DB.prepare("SELECT owner_user_id FROM servers WHERE id = ?")
        .bind(serverId)
        .first<{ owner_user_id: string | null }>()
    : null;
  if (!session || server?.owner_user_id !== session.user_id)
    return new Response(null, { status: 404 });
  const form = await request.formData();
  const userId = form.get("userId");
  if (typeof userId !== "string") return Response.json({ error: "invalid_user" }, { status: 400 });
  const editor = await env.DB.prepare(
    "SELECT 1 AS found FROM server_members WHERE server_id = ? AND user_id = ? AND role = 'editor'",
  )
    .bind(serverId, userId)
    .first();
  if (!editor) return Response.json({ error: "editor_not_found" }, { status: 404 });
  await env.DB.prepare(
    "UPDATE servers SET pending_owner_user_id = ?, pending_owner_created_at = ?, updated_at = ? WHERE id = ?",
  )
    .bind(userId, Date.now(), Date.now(), serverId)
    .run();
  return new Response(null, {
    status: 303,
    headers: { location: `/manage/servers/${serverId}` },
  });
}

export async function serveServerBranding(
  env: CloudflareEnv,
  serverId: string,
  kind: string,
): Promise<Response> {
  if (kind !== "icon" && kind !== "banner") return new Response(null, { status: 404 });
  const column = kind === "icon" ? "icon_key" : "banner_key";
  const row = await env.DB.prepare(`SELECT ${column} AS r2_key FROM servers WHERE id = ?`)
    .bind(serverId)
    .first<{ r2_key: string | null }>();
  if (!row?.r2_key) return new Response(null, { status: 404 });
  const object = await env.IMAGES.get(row.r2_key);
  if (!object) return new Response(null, { status: 404 });
  return new Response(object.body, {
    headers: {
      "content-type": object.httpMetadata?.contentType ?? "application/octet-stream",
      "cache-control": "public, max-age=3600",
      "x-content-type-options": "nosniff",
      etag: object.httpEtag,
    },
  });
}

export async function createVerificationChallenge(
  request: Request,
  env: CloudflareEnv,
  serverId: string,
  addressId?: string,
): Promise<Response> {
  const session = await authenticateSession(request, env);
  if (!session) return Response.json({ error: "not_found" }, { status: 404 });
  const server = await env.DB.prepare(
    `SELECT s.owner_user_id, s.pending_owner_user_id, s.pending_owner_created_at, a.id AS address_id,
      a.host_ascii, a.port, a.display_address
      FROM servers s JOIN server_addresses a
        ON a.server_id = s.id OR a.pending_server_id = s.id
      WHERE s.id = ?
        AND a.id = COALESCE(?, (
        SELECT id FROM server_addresses WHERE server_id = s.id AND is_primary = 1
      ))`,
  )
    .bind(serverId, addressId ?? null)
    .first<{
      owner_user_id: string | null;
      pending_owner_user_id: string | null;
      pending_owner_created_at: number | null;
      address_id: string;
      host_ascii: string;
      port: number;
      display_address: string;
    }>();
  if (
    !server ||
    (server.owner_user_id &&
      server.owner_user_id !== session.user_id &&
      (server.pending_owner_user_id !== session.user_id ||
        (server.pending_owner_created_at ?? 0) < Date.now() - 7 * 24 * 60 * 60 * 1000))
  )
    return Response.json({ error: "not_found" }, { status: 404 });
  const body = await request.formData();
  const method = body.get("method");
  if (method !== "dns" && method !== "motd")
    return Response.json({ error: "invalid_method" }, { status: 400 });
  const token = randomToken()
    .replace(/[^0-9A-Za-z]/g, "")
    .slice(0, 32);
  const now = Date.now();
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO server_verification_challenges
      (id, server_id, user_id, method, purpose, address_id, host_ascii, port, display_address,
        token_hash, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      serverId,
      session.user_id,
      method,
      server.pending_owner_user_id === session.user_id
        ? "transfer"
        : server.owner_user_id
          ? "address"
          : "claim",
      server.address_id,
      server.host_ascii,
      server.port,
      server.display_address,
      await sha256(token),
      now,
      now + CHALLENGE_LIFETIME_MS,
    )
    .run();
  return Response.json({
    id,
    method,
    token,
    dnsName: `_i-love-moe.${server.host_ascii}`,
    dnsValue: `i-love-moe-verification=${token}`,
    motdValue: token,
    expiresAt: new Date(now + CHALLENGE_LIFETIME_MS).toISOString(),
  });
}

export async function verifyServerChallenge(
  request: Request,
  env: CloudflareEnv,
  serverId: string,
  challengeId: string,
): Promise<Response> {
  const session = await authenticateSession(request, env);
  if (!session) return Response.json({ error: "not_found" }, { status: 404 });
  const now = Date.now();
  const [userAttempts, serverAttempts] = await Promise.all([
    env.DB.prepare(
      "SELECT COUNT(*) AS count FROM server_verification_attempts WHERE user_id = ? AND created_at > ?",
    )
      .bind(session.user_id, now - ATTEMPT_WINDOW_MS)
      .first<{ count: number }>(),
    env.DB.prepare(
      "SELECT COUNT(*) AS count FROM server_verification_attempts WHERE server_id = ? AND created_at > ?",
    )
      .bind(serverId, now - ATTEMPT_WINDOW_MS)
      .first<{ count: number }>(),
  ]);
  if (
    (userAttempts?.count ?? 0) >= USER_ATTEMPT_LIMIT ||
    (serverAttempts?.count ?? 0) >= SERVER_ATTEMPT_LIMIT
  )
    return Response.json({ error: "rate_limited" }, { status: 429 });
  const challenge = await env.DB.prepare(
    `SELECT c.method, c.purpose, c.token_hash, c.address_id, c.host_ascii, c.port, c.display_address
      FROM server_verification_challenges c
      WHERE c.id = ? AND c.server_id = ? AND c.user_id = ? AND c.expires_at > ?
        AND c.verified_at IS NULL`,
  )
    .bind(challengeId, serverId, session.user_id, now)
    .first<{
      method: "dns" | "motd";
      purpose: "claim" | "address" | "transfer";
      token_hash: string;
      address_id: string | null;
      host_ascii: string;
      port: number;
      display_address: string;
    }>();
  if (!challenge) return Response.json({ error: "challenge_expired" }, { status: 404 });
  await env.DB.prepare(
    "INSERT INTO server_verification_attempts (id, server_id, user_id, created_at) VALUES (?, ?, ?, ?)",
  )
    .bind(crypto.randomUUID(), serverId, session.user_id, now)
    .run();
  const values =
    challenge.method === "dns"
      ? await dnsVerificationValues(challenge.host_ascii)
      : [await fetchMinecraftMotd(challenge.host_ascii, challenge.port)];
  const matched = (
    await Promise.all(
      values
        .filter((value): value is string => Boolean(value))
        .map(async (value) => ({
          raw: value,
          hash: await sha256(
            challenge.method === "dns"
              ? value.replace(/^i-love-moe-verification=/, "")
              : stripMinecraftFormatting(value).trim(),
          ),
        })),
    )
  ).some(({ hash }) => hash === challenge.token_hash);
  if (!matched) return Response.json({ error: "verification_not_found" }, { status: 409 });
  let previousOwner: string | null = null;
  if (challenge.purpose === "transfer") {
    const server = await env.DB.prepare(
      "SELECT owner_user_id, pending_owner_user_id FROM servers WHERE id = ?",
    )
      .bind(serverId)
      .first<{ owner_user_id: string | null; pending_owner_user_id: string | null }>();
    if (!server || server.pending_owner_user_id !== session.user_id)
      return Response.json({ error: "transfer_changed" }, { status: 409 });
    previousOwner = server.owner_user_id;
    const transferred = await env.DB.prepare(
      `UPDATE servers SET owner_user_id = ?, pending_owner_user_id = NULL,
        pending_owner_created_at = NULL, verified_at = ?, verification_method = ?, updated_at = ?
        WHERE id = ? AND pending_owner_user_id = ?`,
    )
      .bind(session.user_id, now, challenge.method, now, serverId, session.user_id)
      .run();
    if ((transferred.meta.changes ?? 0) !== 1)
      return Response.json({ error: "transfer_changed" }, { status: 409 });
  } else {
    const claimed = await env.DB.prepare(
      `UPDATE servers SET owner_user_id = ?, verified_at = COALESCE(verified_at, ?),
        verification_method = COALESCE(verification_method, ?), updated_at = ?
        WHERE id = ? AND (owner_user_id IS NULL OR owner_user_id = ?)`,
    )
      .bind(session.user_id, now, challenge.method, now, serverId, session.user_id)
      .run();
    if ((claimed.meta.changes ?? 0) !== 1)
      return Response.json({ error: "server_claimed" }, { status: 409 });
  }
  const addressOwner = await env.DB.prepare(
    "SELECT server_id, pending_server_id FROM server_addresses WHERE id = ?",
  )
    .bind(challenge.address_id)
    .first<{ server_id: string; pending_server_id: string | null }>();
  if (addressOwner?.server_id !== serverId) {
    if (addressOwner?.pending_server_id !== serverId)
      return Response.json({ error: "address_changed" }, { status: 409 });
    await mergeUnclaimedServerAddress(env, addressOwner.server_id, serverId, challenge.address_id!);
  }
  await env.DB.batch([
    env.DB.prepare("UPDATE server_verification_challenges SET verified_at = ? WHERE id = ?").bind(
      now,
      challengeId,
    ),
    env.DB.prepare(
      "UPDATE server_addresses SET verified_at = ?, pending_server_id = NULL WHERE id = ?",
    ).bind(now, challenge.address_id),
    env.DB.prepare(
      `INSERT INTO server_members (server_id, user_id, role, created_at)
        VALUES (?, ?, 'owner', ?)
        ON CONFLICT(server_id, user_id) DO UPDATE SET role = 'owner'`,
    ).bind(serverId, session.user_id, now),
    ...(previousOwner && previousOwner !== session.user_id
      ? [
          env.DB.prepare(
            `INSERT INTO server_members (server_id, user_id, role, created_at)
              VALUES (?, ?, 'editor', ?)
              ON CONFLICT(server_id, user_id) DO UPDATE SET role = 'editor'`,
          ).bind(serverId, previousOwner, now),
        ]
      : []),
  ]);
  await env.DB.prepare(
    `UPDATE images SET server_id = ? WHERE server_host_ascii = ? AND server_port = ?
      AND discoverability = 'public'`,
  )
    .bind(serverId, challenge.host_ascii, challenge.port)
    .run();
  return Response.json({ verified: true });
}

export async function addServerAddress(
  request: Request,
  env: CloudflareEnv,
  serverId: string,
): Promise<Response> {
  const session = await authenticateSession(request, env);
  const owner = session
    ? await env.DB.prepare("SELECT owner_user_id FROM servers WHERE id = ?")
        .bind(serverId)
        .first<{ owner_user_id: string | null }>()
    : null;
  if (!session || owner?.owner_user_id !== session.user_id)
    return Response.json({ error: "not_found" }, { status: 404 });
  const form = await request.formData();
  const raw = form.get("address");
  const parsed = typeof raw === "string" ? parseServerAddress(raw) : null;
  if (!parsed) return Response.json({ error: "invalid_server_address" }, { status: 400 });
  const existing = await env.DB.prepare(
    `SELECT a.id, a.server_id, s.owner_user_id FROM server_addresses a
      JOIN servers s ON s.id = a.server_id WHERE a.host_ascii = ? AND a.port = ?`,
  )
    .bind(parsed.hostAscii, parsed.port)
    .first<{ id: string; server_id: string; owner_user_id: string | null }>();
  if (existing?.server_id === serverId)
    return Response.json({ id: existing.id, alreadyAdded: true });
  if (existing?.owner_user_id) return Response.json({ error: "address_claimed" }, { status: 409 });

  const addressId = existing?.id ?? crypto.randomUUID();
  if (existing) {
    await env.DB.prepare(
      "UPDATE server_addresses SET pending_server_id = ? WHERE id = ? AND verified_at IS NULL",
    )
      .bind(serverId, addressId)
      .run();
  } else {
    await env.DB.prepare(
      `INSERT INTO server_addresses
        (id, server_id, pending_server_id, host_ascii, port, display_address, is_primary)
        VALUES (?, ?, ?, ?, ?, ?, 0)`,
    )
      .bind(addressId, serverId, serverId, parsed.hostAscii, parsed.port, parsed.displayAddress)
      .run();
  }
  return Response.json({ id: addressId, address: parsed.displayAddress }, { status: 201 });
}

export async function removeServerAddress(
  request: Request,
  env: CloudflareEnv,
  serverId: string,
  addressId: string,
): Promise<Response> {
  const session = await authenticateSession(request, env);
  const owner = session
    ? await env.DB.prepare("SELECT owner_user_id FROM servers WHERE id = ?")
        .bind(serverId)
        .first<{ owner_user_id: string | null }>()
    : null;
  if (!session || owner?.owner_user_id !== session.user_id)
    return new Response(null, { status: 404 });
  const address = await env.DB.prepare(
    `SELECT server_id, pending_server_id, is_primary FROM server_addresses
      WHERE id = ? AND (server_id = ? OR pending_server_id = ?)`,
  )
    .bind(addressId, serverId, serverId)
    .first<{ server_id: string; pending_server_id: string | null; is_primary: number }>();
  if (!address || address.is_primary)
    return Response.json({ error: "primary_address" }, { status: 409 });
  if (address.server_id !== serverId && address.pending_server_id === serverId) {
    await env.DB.prepare(
      "UPDATE server_addresses SET pending_server_id = NULL WHERE id = ? AND pending_server_id = ?",
    )
      .bind(addressId, serverId)
      .run();
    return new Response(null, { status: 204 });
  }
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE images SET server_id = NULL WHERE server_id = ? AND server_host_ascii = (SELECT host_ascii FROM server_addresses WHERE id = ?) AND server_port = (SELECT port FROM server_addresses WHERE id = ?)",
    ).bind(serverId, addressId, addressId),
    env.DB.prepare("DELETE FROM server_addresses WHERE id = ? AND server_id = ?").bind(
      addressId,
      serverId,
    ),
  ]);
  return new Response(null, { status: 204 });
}

async function mergeUnclaimedServerAddress(
  env: CloudflareEnv,
  sourceServerId: string,
  targetServerId: string,
  addressId: string,
): Promise<void> {
  await env.DB.batch([
    env.DB.prepare("UPDATE images SET server_id = ? WHERE server_id = ?").bind(
      targetServerId,
      sourceServerId,
    ),
    env.DB.prepare(
      "UPDATE server_addresses SET server_id = ?, pending_server_id = NULL, is_primary = 0 WHERE id = ?",
    ).bind(targetServerId, addressId),
    env.DB.prepare("DELETE FROM servers WHERE id = ? AND owner_user_id IS NULL").bind(
      sourceServerId,
    ),
  ]);
}

export async function updateServerProfile(
  request: Request,
  env: CloudflareEnv,
  serverId: string,
): Promise<Response> {
  const session = await authenticateSession(request, env);
  if (!session || !(await canManageServer(env, serverId, session.user_id)))
    return new Response(null, { status: 404 });
  const form = await request.formData();
  const displayName = normalizeOptionalText(form.get("displayName"), 100);
  const description = normalizeOptionalText(form.get("description"), 2000);
  const slugValue = normalizeOptionalText(form.get("slug"), 32);
  const slug = slugValue?.toLowerCase() ?? null;
  if (
    displayName === undefined ||
    description === undefined ||
    slugValue === undefined ||
    (slug && (!SLUG_PATTERN.test(slug) || IDENTIFIER_PATTERN.test(slug)))
  )
    return Response.json({ error: "invalid_profile" }, { status: 400 });
  const current = await env.DB.prepare("SELECT slug FROM servers WHERE id = ?")
    .bind(serverId)
    .first<{ slug: string | null }>();
  if (!current) return new Response(null, { status: 404 });
  try {
    const statements = [
      env.DB.prepare(
        "UPDATE servers SET display_name = ?, description = ?, slug = ?, updated_at = ? WHERE id = ?",
      ).bind(displayName, description, slug, Date.now(), serverId),
    ];
    if (current.slug && current.slug !== slug)
      statements.push(
        env.DB.prepare(
          "INSERT OR IGNORE INTO server_slug_history (identifier, server_id, created_at) VALUES (?, ?, ?)",
        ).bind(current.slug, serverId, Date.now()),
      );
    await env.DB.batch(statements);
  } catch {
    return Response.json({ error: "slug_unavailable" }, { status: 409 });
  }
  return Response.json({ saved: true, slug });
}

export async function canManageServer(
  env: CloudflareEnv,
  serverId: string,
  userId: string,
): Promise<boolean> {
  const row = await env.DB.prepare(
    `SELECT s.owner_user_id, m.role FROM servers s
      LEFT JOIN server_members m ON m.server_id = s.id AND m.user_id = ?
      WHERE s.id = ? AND (s.owner_user_id = ? OR m.user_id = ?)`,
  )
    .bind(userId, serverId, userId, userId)
    .first<{ owner_user_id: string | null; role: "owner" | "editor" | null }>();
  if (!row) return false;
  if (row.owner_user_id === userId) return true;
  return (
    row.role === "editor" &&
    Boolean(row.owner_user_id) &&
    (await planLimits(env, row.owner_user_id!)).name === "plus"
  );
}

export async function canUseServerPlus(env: CloudflareEnv, serverId: string): Promise<boolean> {
  const owner = await env.DB.prepare("SELECT owner_user_id FROM servers WHERE id = ?")
    .bind(serverId)
    .first<{ owner_user_id: string | null }>();
  return owner?.owner_user_id
    ? (await planLimits(env, owner.owner_user_id)).name === "plus"
    : false;
}

async function dnsVerificationValues(hostname: string): Promise<string[]> {
  const response = await fetch(
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(`_i-love-moe.${hostname}`)}&type=TXT`,
    { headers: { accept: "application/dns-json" } },
  );
  if (!response.ok) return [];
  const body = (await response.json()) as { Answer?: Array<{ data?: string }> };
  return (body.Answer ?? [])
    .map((answer) => answer.data?.replace(/^"|"$/g, "").replace(/"\s*"/g, "") ?? "")
    .filter(Boolean);
}

function stripMinecraftFormatting(value: string): string {
  return value.replace(/§[0-9A-FK-OR]/gi, "");
}

async function fetchMinecraftMotd(host: string, port: number): Promise<string> {
  let targetHost = host;
  let targetPort = port;
  if (port === 25565 && !isIpLiteral(host)) {
    try {
      const records = await resolveSrv(`_minecraft._tcp.${host}`);
      const selected = [...records].sort(
        (left, right) => left.priority - right.priority || right.weight - left.weight,
      )[0];
      if (selected) {
        targetHost = selected.name.replace(/\.$/, "").toLowerCase();
        targetPort = selected.port;
      }
    } catch {
      // A missing SRV record means the original hostname and default port are used.
    }
  }
  const addresses = isIpLiteral(targetHost)
    ? [targetHost]
    : [
        ...(await resolve4(targetHost).catch(() => [])),
        ...(await resolve6(targetHost).catch(() => [])),
      ];
  const connectHost = addresses.find((address) => !isDisallowedHost(address));
  if (!connectHost) throw new Error("minecraft_status_address_rejected");
  const hostBytes = new TextEncoder().encode(host);
  const handshake = concatBytes(
    encodeVarInt(0),
    encodeVarInt(767),
    encodeVarInt(hostBytes.length),
    hostBytes,
    new Uint8Array([(targetPort >> 8) & 0xff, targetPort & 0xff]),
    encodeVarInt(1),
  );
  const requestPacket = concatBytes(
    encodeVarInt(handshake.length),
    handshake,
    new Uint8Array([1, 0]),
  );
  return new Promise<string>((resolve, reject) => {
    const socket = createConnection({ host: connectHost, port: targetPort });
    let received: Uint8Array<ArrayBufferLike> = new Uint8Array();
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error("minecraft_status_timeout"));
    }, 5000);
    socket.once("connect", () => socket.write(requestPacket));
    socket.on("data", (chunk: Uint8Array) => {
      received = concatBytes(received, chunk);
      if (received.length > 65_536) {
        socket.destroy();
        clearTimeout(timer);
        reject(new Error("minecraft_status_too_large"));
        return;
      }
      try {
        const parsed = parseStatusPacket(received);
        if (parsed !== null) {
          clearTimeout(timer);
          socket.end();
          resolve(parsed);
        }
      } catch (error) {
        clearTimeout(timer);
        socket.destroy();
        reject(error);
      }
    });
    socket.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    socket.once("end", () => {
      clearTimeout(timer);
      if (received.length === 0) reject(new Error("invalid_minecraft_status"));
    });
  });
}

function isIpLiteral(host: string): boolean {
  return /^[0-9.]+$/.test(host) || host.includes(":");
}

function parseStatusPacket(bytes: Uint8Array): string | null {
  const packetLength = readVarInt(bytes, 0);
  if (!packetLength) return null;
  if (bytes.length < packetLength.next + packetLength.value) return null;
  const packetId = readVarInt(bytes, packetLength.next);
  if (!packetId || packetId.value !== 0) throw new Error("invalid_status_packet");
  const stringLength = readVarInt(bytes, packetId.next);
  if (!stringLength || stringLength.value > 65_536) throw new Error("invalid_status_length");
  const end = stringLength.next + stringLength.value;
  if (bytes.length < end) return null;
  const json = JSON.parse(new TextDecoder().decode(bytes.slice(stringLength.next, end))) as {
    description?: string | { text?: string; extra?: Array<{ text?: string }> };
  };
  if (typeof json.description === "string") return json.description;
  return `${json.description?.text ?? ""}${(json.description?.extra ?? []).map((item) => item.text ?? "").join("")}`;
}

function encodeVarInt(value: number): Uint8Array {
  const result: number[] = [];
  let current = value >>> 0;
  do {
    let byte = current & 0x7f;
    current >>>= 7;
    if (current) byte |= 0x80;
    result.push(byte);
  } while (current);
  return new Uint8Array(result);
}

function readVarInt(bytes: Uint8Array, offset: number): { value: number; next: number } | null {
  let value = 0;
  for (let index = 0; index < 5; index++) {
    if (offset + index >= bytes.length) return null;
    const byte = bytes[offset + index]!;
    value |= (byte & 0x7f) << (7 * index);
    if (!(byte & 0x80)) return { value, next: offset + index + 1 };
  }
  throw new Error("varint_too_large");
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!,
  );
}
