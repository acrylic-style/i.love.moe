export interface EmailBinding {
  send(message: {
    to: string;
    from: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<{ messageId: string }>;
}

export interface Env {
  DB: D1Database;
  IMAGES: R2Bucket;
  IMAGE_TRANSFORM: ImagesBinding;
  EMAIL: EmailBinding;
  PUBLIC_BASE_URL: string;
  MINECRAFT_PUBLIC_BASE_URL: string;
  EMAIL_FROM: string;
  RATE_LIMIT_SALT: string;
  TURNSTILE_SITE_KEY: string;
  TURNSTILE_SECRET_KEY: string;
  ASSETS: Fetcher;
  RETENTION_QUEUE: Queue<RetentionMessage>;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  STRIPE_PLUS_PRICE_ID: string;
  CLOUDFLARE_SAAS_API_TOKEN?: string;
  CLOUDFLARE_SAAS_ZONE_ID?: string;
  SAAS_CNAME_TARGET?: string;
  SAAS_FALLBACK_ORIGIN?: string;
  LEGAL_NOTICE_URL?: string;
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
  AWS_REGION: string;
  ABUSE_CONTACT_EMAIL: string;
}

export interface RetentionMessage {
  imageId: string;
}

export interface DeviceRow {
  id: string;
  user_id: string | null;
}

export type Visibility = "unlisted" | "private" | "passphrase";
export type Discoverability = "hidden" | "public";

export interface AccessControlledRow {
  id: string;
  owner_user_id: string | null;
  code: string;
  visibility: Visibility;
  access_version: number;
}

export interface ImageRow {
  id: string;
  title: string | null;
  server_address: string | null;
  server_name: string | null;
  r2_key: string;
  byte_size: number;
  width: number;
  height: number;
  created_at: number;
  expires_at: number;
  deleted_at: number | null;
  code: string;
  visibility: Visibility;
  access_version: number;
  has_passphrase?: number;
  storage_tier: "free" | "plus";
  upload_source?: "mod" | "web";
  moderated_at?: number | null;
  moderation_model_version?: string | null;
  minecraft_uuid?: string | null;
  minecraft_name?: string | null;
  minecraft_id_public?: number;
  discoverability: Discoverability;
  server_id: string | null;
  server_host_ascii?: string | null;
  server_port?: number | null;
  favorited_at?: number | null;
}

export const TAG_COLORS = [
  "gray",
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
] as const;

export type TagColor = (typeof TAG_COLORS)[number];

export interface TagRow {
  id: string;
  owner_user_id: string;
  name: string;
  normalized_name: string;
  color: TagColor;
  created_at: number;
  updated_at: number;
  image_count?: number;
}

export interface LibraryImageRow extends ImageRow {
  tags: TagRow[];
}

export interface AlbumRow {
  id: string;
  owner_user_id: string;
  title: string;
  description: string | null;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  code: string;
  cover_code?: string | null;
  image_count?: number;
  visibility: Visibility;
  access_version: number;
  has_passphrase?: number;
  discoverability: Discoverability;
  server_id: string | null;
}

export interface ServerRow {
  id: string;
  code: string;
  slug: string | null;
  display_name: string | null;
  description: string | null;
  owner_user_id: string | null;
  pending_owner_user_id: string | null;
  pending_owner_created_at: number | null;
  verification_method: "dns" | "motd" | null;
  verified_at: number | null;
  icon_key: string | null;
  banner_key: string | null;
  theme_color: string | null;
  accent_color: string | null;
  featured_image_id: string | null;
  created_at: number;
  updated_at: number;
  host_ascii?: string;
  port?: number;
  display_address?: string;
}

export interface AlbumImageRow extends ImageRow {
  position: number;
}

export interface ImageLookupRow extends ImageRow {
  owner_device_id: string;
  owner_user_id: string | null;
}

export interface SessionRow {
  id: string;
  user_id: string;
}

export interface MagicLinkRow {
  id: string;
  device_id: string;
  email: string;
  expires_at: number;
  used_at: number | null;
}

export interface BrowserLoginChallengeRow {
  id: string;
  device_id: string;
  expires_at: number;
  used_at: number | null;
}
