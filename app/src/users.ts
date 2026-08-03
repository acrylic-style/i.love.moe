import { acceptsFormOrigin, authenticateSession, normalizeOptionalText } from "./service";
import type { ImageRow } from "./types";

const USER_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;
const USER_IMAGE_PAGE_SIZE = 24;
const AVATAR_CACHE_SECONDS = 6 * 60 * 60;

export type PublicUserImageSort = "newest" | "favorites";

export interface UserProfileRow {
  user_id: string;
  display_name: string;
  bio: string | null;
  primary_minecraft_uuid: string;
  minecraft_name: string;
  slug: string;
  published_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface PublicUserAttribution {
  displayName: string;
  slug: string;
}

export interface PublicUserDetail {
  profile: UserProfileRow;
  requestedIdentifierIsCurrent: boolean;
  images: Array<ImageRow & { favorite_count: number; viewer_favorited: number }>;
  nextImageCursor: string | null;
  albums: Array<{
    id: string;
    title: string;
    description: string | null;
    code: string;
    cover_code: string | null;
    image_count: number;
  }>;
}

interface UserImageCursor {
  scope: "public-user";
  sort: PublicUserImageSort;
  favoriteCount?: number;
  createdAt: number;
  id: string;
}

export async function managedUserProfile(
  env: CloudflareEnv,
  userId: string,
): Promise<UserProfileRow | null> {
  return env.DB.prepare(
    `SELECT up.user_id, up.display_name, up.bio, up.primary_minecraft_uuid,
      up.published_at, up.created_at, up.updated_at, mpi.current_name AS minecraft_name,
      identifier.identifier AS slug
    FROM user_profiles up
    JOIN user_profile_identifiers identifier
      ON identifier.user_id = up.user_id AND identifier.is_current = 1
    JOIN user_minecraft_profiles ump
      ON ump.user_id = up.user_id AND ump.minecraft_uuid = up.primary_minecraft_uuid
      AND ump.status = 'verified'
    JOIN minecraft_profiles mpi ON mpi.uuid = ump.minecraft_uuid
    WHERE up.user_id = ?`,
  )
    .bind(userId)
    .first<UserProfileRow>();
}

export async function publicUserAttribution(
  env: CloudflareEnv,
  userId: string | null,
): Promise<PublicUserAttribution | null> {
  if (!userId) return null;
  return env.DB.prepare(
    `SELECT up.display_name AS displayName, identifier.identifier AS slug
    FROM user_profiles up
    JOIN user_profile_identifiers identifier
      ON identifier.user_id = up.user_id AND identifier.is_current = 1
    JOIN user_minecraft_profiles ump
      ON ump.user_id = up.user_id AND ump.minecraft_uuid = up.primary_minecraft_uuid
      AND ump.status = 'verified'
    WHERE up.user_id = ? AND up.published_at IS NOT NULL`,
  )
    .bind(userId)
    .first<PublicUserAttribution>();
}

export async function publicUserDetail(
  env: CloudflareEnv,
  identifier: string,
  options: {
    sort?: PublicUserImageSort;
    cursor?: string;
    voterIpHash?: string | null;
  } = {},
): Promise<PublicUserDetail | null> {
  const profile = await publicProfileByIdentifier(env, identifier);
  if (!profile) return null;
  const sort: PublicUserImageSort = options.sort === "favorites" ? "favorites" : "newest";
  const cursor = decodeUserImageCursor(options.cursor ?? "", sort);
  const favoriteCount = "(SELECT COUNT(*) FROM server_image_favorites f WHERE f.image_id = i.id)";
  const clauses = [
    "i.owner_user_id = ?",
    "i.discoverability = 'public'",
    "i.visibility = 'unlisted'",
    "i.deleted_at IS NULL",
    "i.expires_at > ?",
  ];
  const bindings: unknown[] = options.voterIpHash
    ? [options.voterIpHash, profile.user_id, Date.now()]
    : [profile.user_id, Date.now()];
  if (cursor) {
    if (sort === "favorites") {
      clauses.push(
        `(${favoriteCount} < ? OR (${favoriteCount} = ? AND
          (i.created_at < ? OR (i.created_at = ? AND i.id < ?))))`,
      );
      bindings.push(
        cursor.favoriteCount ?? 0,
        cursor.favoriteCount ?? 0,
        cursor.createdAt,
        cursor.createdAt,
        cursor.id,
      );
    } else {
      clauses.push("(i.created_at < ? OR (i.created_at = ? AND i.id < ?))");
      bindings.push(cursor.createdAt, cursor.createdAt, cursor.id);
    }
  }
  bindings.push(USER_IMAGE_PAGE_SIZE + 1);
  const [imageRows, albumRows] = await Promise.all([
    env.DB.prepare(
      `SELECT i.*, sl.code, ${favoriteCount} AS favorite_count,
        ${
          options.voterIpHash
            ? "EXISTS(SELECT 1 FROM server_image_favorites vf WHERE vf.image_id = i.id AND vf.voter_ip_hash = ?)"
            : "0"
        } AS viewer_favorited
      FROM images i
      JOIN short_links sl
        ON sl.target_type = 'image' AND sl.target_id = i.id AND sl.retired_at IS NULL
      WHERE ${clauses.join(" AND ")}
      ORDER BY ${sort === "favorites" ? "favorite_count DESC, " : ""}i.created_at DESC, i.id DESC
      LIMIT ?`,
    )
      .bind(...bindings)
      .all<ImageRow & { favorite_count: number; viewer_favorited: number }>(),
    env.DB.prepare(
      `SELECT a.id, a.title, a.description, sl.code,
        (SELECT image_link.code FROM album_images ai
          JOIN images image ON image.id = ai.image_id
          JOIN short_links image_link
            ON image_link.target_type = 'image' AND image_link.target_id = image.id
            AND image_link.retired_at IS NULL
          WHERE ai.album_id = a.id AND image.deleted_at IS NULL AND image.expires_at > ?
          ORDER BY ai.position LIMIT 1) AS cover_code,
        (SELECT COUNT(*) FROM album_images ai
          JOIN images image ON image.id = ai.image_id
          WHERE ai.album_id = a.id AND image.deleted_at IS NULL AND image.expires_at > ?) AS image_count
      FROM albums a
      JOIN short_links sl
        ON sl.target_type = 'album' AND sl.target_id = a.id AND sl.retired_at IS NULL
      WHERE a.owner_user_id = ? AND a.discoverability = 'public'
        AND a.visibility = 'unlisted' AND a.deleted_at IS NULL
      ORDER BY a.updated_at DESC, a.id DESC LIMIT 30`,
    )
      .bind(Date.now(), Date.now(), profile.user_id)
      .all<PublicUserDetail["albums"][number]>(),
  ]);
  const images = imageRows.results.slice(0, USER_IMAGE_PAGE_SIZE);
  const lastImage = images.at(-1);
  return {
    profile,
    requestedIdentifierIsCurrent: identifier.toLowerCase() === profile.slug.toLowerCase(),
    images,
    nextImageCursor:
      imageRows.results.length > USER_IMAGE_PAGE_SIZE && lastImage
        ? encodeUserImageCursor({
            scope: "public-user",
            sort,
            favoriteCount: sort === "favorites" ? lastImage.favorite_count : undefined,
            createdAt: lastImage.created_at,
            id: lastImage.id,
          })
        : null,
    albums: albumRows.results,
  };
}

export async function updateUserProfile(request: Request, env: CloudflareEnv): Promise<Response> {
  if (!acceptsFormOrigin(request.headers.get("origin"), request.url))
    return Response.json({ error: "invalid_origin" }, { status: 403 });
  const session = await authenticateSession(request, env);
  if (!session) return new Response(null, { status: 404 });
  const form = await request.formData();
  const displayName = normalizeOptionalText(form.get("displayName"), 100);
  const bio = normalizeOptionalText(form.get("bio"), 2000);
  const slugValue = normalizeOptionalText(form.get("slug"), 32);
  const slug = slugValue?.toLowerCase() ?? null;
  const primaryMinecraftUuid = form.get("primaryMinecraftUuid");
  const published = form.get("published") === "1";
  if (
    !displayName ||
    bio === undefined ||
    !slug ||
    !USER_SLUG_PATTERN.test(slug) ||
    typeof primaryMinecraftUuid !== "string" ||
    primaryMinecraftUuid.length > 64
  )
    return Response.json({ error: "invalid_profile" }, { status: 400 });
  const verified = await env.DB.prepare(
    `SELECT 1 AS found FROM user_minecraft_profiles
      WHERE user_id = ? AND minecraft_uuid = ? AND status = 'verified'`,
  )
    .bind(session.user_id, primaryMinecraftUuid)
    .first();
  if (!verified) return Response.json({ error: "invalid_primary_profile" }, { status: 400 });
  const current = await env.DB.prepare(
    `SELECT up.user_id, identifier.identifier AS slug
      FROM user_profiles up
      JOIN user_profile_identifiers identifier
        ON identifier.user_id = up.user_id AND identifier.is_current = 1
      WHERE up.user_id = ?`,
  )
    .bind(session.user_id)
    .first<{ user_id: string; slug: string }>();
  const unavailable = await env.DB.prepare(
    "SELECT user_id FROM user_profile_identifiers WHERE identifier = ?",
  )
    .bind(slug)
    .first<{ user_id: string }>();
  if (unavailable && unavailable.user_id !== session.user_id)
    return Response.json({ error: "slug_unavailable" }, { status: 409 });

  const now = Date.now();
  const statements: D1PreparedStatement[] = [];
  if (current) {
    statements.push(
      env.DB.prepare(
        `UPDATE user_profiles SET display_name = ?, bio = ?, primary_minecraft_uuid = ?,
          published_at = CASE WHEN ? = 1 THEN COALESCE(published_at, ?) ELSE NULL END,
          updated_at = ? WHERE user_id = ?`,
      ).bind(displayName, bio, primaryMinecraftUuid, published ? 1 : 0, now, now, session.user_id),
    );
    if (current.slug.toLowerCase() !== slug) {
      statements.push(
        env.DB.prepare(
          "UPDATE user_profile_identifiers SET is_current = 0 WHERE user_id = ? AND is_current = 1",
        ).bind(session.user_id),
        env.DB.prepare(
          `INSERT INTO user_profile_identifiers (identifier, user_id, is_current, created_at)
            VALUES (?, ?, 1, ?)`,
        ).bind(slug, session.user_id, now),
      );
    }
  } else {
    statements.push(
      env.DB.prepare(
        `INSERT INTO user_profiles
          (user_id, display_name, bio, primary_minecraft_uuid, published_at, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        session.user_id,
        displayName,
        bio,
        primaryMinecraftUuid,
        published ? now : null,
        now,
        now,
      ),
      env.DB.prepare(
        `INSERT INTO user_profile_identifiers (identifier, user_id, is_current, created_at)
          VALUES (?, ?, 1, ?)`,
      ).bind(slug, session.user_id, now),
    );
  }
  try {
    await env.DB.batch(statements);
  } catch {
    return Response.json({ error: "slug_unavailable" }, { status: 409 });
  }
  return Response.json({ saved: true, slug, published });
}

export async function serveUserAvatar(env: CloudflareEnv, identifier: string): Promise<Response> {
  const profile = await publicProfileByIdentifier(env, identifier);
  if (!profile) return new Response(null, { status: 404 });
  try {
    const upstream = await fetch(
      `https://mc-heads.net/avatar/${encodeURIComponent(profile.primary_minecraft_uuid)}/160.png`,
      {
        headers: { accept: "image/png" },
        redirect: "manual",
        cf: { cacheEverything: true, cacheTtl: AVATAR_CACHE_SECONDS },
      },
    );
    const contentType = upstream.headers.get("content-type");
    if (!upstream.ok || !upstream.body || !contentType?.toLowerCase().startsWith("image/png")) {
      console.warn("user_avatar_upstream_invalid", {
        status: upstream.status,
        contentType,
        hasBody: Boolean(upstream.body),
      });
      return defaultAvatar();
    }
    return new Response(upstream.body, {
      headers: {
        "content-type": "image/png",
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    console.error("user_avatar_fetch_failed", avatarFetchErrorDetails(error));
    return defaultAvatar();
  }
}

export function encodeUserImageCursor(cursor: UserImageCursor): string {
  const bytes = new TextEncoder().encode(JSON.stringify(cursor));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

export function decodeUserImageCursor(
  value: string,
  sort: PublicUserImageSort,
): UserImageCursor | null {
  if (!value || value.length > 512) return null;
  try {
    const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
    const cursor = JSON.parse(new TextDecoder().decode(bytes)) as Partial<UserImageCursor>;
    if (
      cursor.scope !== "public-user" ||
      cursor.sort !== sort ||
      typeof cursor.createdAt !== "number" ||
      !Number.isFinite(cursor.createdAt) ||
      typeof cursor.id !== "string" ||
      cursor.id.length > 64 ||
      (sort === "favorites" &&
        (typeof cursor.favoriteCount !== "number" || !Number.isFinite(cursor.favoriteCount)))
    )
      return null;
    return cursor as UserImageCursor;
  } catch {
    return null;
  }
}

async function publicProfileByIdentifier(
  env: CloudflareEnv,
  identifier: string,
): Promise<UserProfileRow | null> {
  if (!identifier || identifier.length > 32) return null;
  return env.DB.prepare(
    `SELECT up.user_id, up.display_name, up.bio, up.primary_minecraft_uuid,
      up.published_at, up.created_at, up.updated_at, mpi.current_name AS minecraft_name,
      current_identifier.identifier AS slug
    FROM user_profile_identifiers requested_identifier
    JOIN user_profiles up ON up.user_id = requested_identifier.user_id
    JOIN user_profile_identifiers current_identifier
      ON current_identifier.user_id = up.user_id AND current_identifier.is_current = 1
    JOIN user_minecraft_profiles ump
      ON ump.user_id = up.user_id AND ump.minecraft_uuid = up.primary_minecraft_uuid
      AND ump.status = 'verified'
    JOIN minecraft_profiles mpi ON mpi.uuid = ump.minecraft_uuid
    WHERE requested_identifier.identifier = ? AND up.published_at IS NOT NULL`,
  )
    .bind(identifier)
    .first<UserProfileRow>();
}

function defaultAvatar(): Response {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" rx="24" fill="#e5e7eb"/><circle cx="80" cy="60" r="30" fill="#9ca3af"/><path d="M30 144c4-31 23-48 50-48s46 17 50 48" fill="#9ca3af"/></svg>`;
  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function avatarFetchErrorDetails(error: unknown): {
  errorName: string;
  message: string | null;
  causeCode: string | null;
} {
  if (!(error instanceof Error)) {
    return { errorName: "UnknownError", message: null, causeCode: null };
  }
  const cause = error.cause;
  const causeCode =
    typeof cause === "object" && cause !== null && "code" in cause && typeof cause.code === "string"
      ? cause.code
      : null;
  return {
    errorName: error.name,
    message: error.message
      .replace(/https?:\/\/\S+/gi, "[redacted-url]")
      .replace(
        /[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}/gi,
        "[redacted-uuid]",
      )
      .slice(0, 240),
    causeCode,
  };
}
