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
  }
}

export {};
