import type { EmailBinding } from "./src/types";

declare global {
  interface CloudflareEnv {
    DB: D1Database;
    IMAGES: R2Bucket;
    IMAGE_TRANSFORM: ImagesBinding;
    EMAIL: EmailBinding;
    ASSETS: Fetcher;
    PUBLIC_BASE_URL: string;
    MINECRAFT_PUBLIC_BASE_URL: string;
    EMAIL_FROM: string;
    RATE_LIMIT_SALT: string;
    TURNSTILE_SITE_KEY: string;
    TURNSTILE_SECRET_KEY: string;
    RETENTION_QUEUE: Queue<import("./src/types").RetentionMessage>;
    STRIPE_SECRET_KEY: string;
    STRIPE_WEBHOOK_SECRET: string;
    STRIPE_PLUS_PRICE_ID: string;
    CLOUDFLARE_SAAS_API_TOKEN?: string;
    CLOUDFLARE_SAAS_ZONE_ID?: string;
    SAAS_CNAME_TARGET?: string;
    SAAS_FALLBACK_ORIGIN?: string;
    LEGAL_NOTICE_URL: string;
    AWS_ACCESS_KEY_ID: string;
    AWS_SECRET_ACCESS_KEY: string;
    AWS_REGION: string;
    ABUSE_CONTACT_EMAIL: string;
    WEBHOOK_ENCRYPTION_KEY: string;
  }
}

export {};
