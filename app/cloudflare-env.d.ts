import type { EmailBinding } from "./src/types";

declare global {
  interface CloudflareEnv {
    DB: D1Database;
    IMAGES: R2Bucket;
    EMAIL: EmailBinding;
    ASSETS: Fetcher;
    PUBLIC_BASE_URL: string;
    EMAIL_FROM: string;
    RATE_LIMIT_SALT: string;
    RETENTION_QUEUE: Queue<import("./src/types").RetentionMessage>;
    STRIPE_SECRET_KEY: string;
    STRIPE_WEBHOOK_SECRET: string;
    STRIPE_PLUS_PRICE_ID: string;
  }
}

export {};
