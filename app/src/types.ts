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
  EMAIL: EmailBinding;
  PUBLIC_BASE_URL: string;
  EMAIL_FROM: string;
  RATE_LIMIT_SALT: string;
  ASSETS: Fetcher;
}

export interface DeviceRow {
  id: string;
  user_id: string | null;
}

export interface ImageRow {
  id: string;
  r2_key: string;
  byte_size: number;
  width: number;
  height: number;
  created_at: number;
  expires_at: number;
  deleted_at: number | null;
  code: string;
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
