import { describe, expect, it } from "vitest";
import { decodeBase64Url, encodeBase64Url, hmacSha256, pbkdf2Sha256, randomBase62, randomToken, sha256, timingSafeEqual } from "../src/crypto";

describe("crypto helpers", () => {
  it("creates base62 short codes", () => {
    expect(randomBase62(8)).toMatch(/^[0-9A-Za-z]{8}$/);
  });

  it("creates URL-safe tokens", () => {
    expect(randomToken()).toMatch(/^[0-9A-Za-z_-]+$/);
  });

  it("hashes values deterministically", async () => {
    expect(await sha256("test")).toBe("9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08");
  });

  it("creates an HMAC-SHA-256 digest", async () => {
    expect(await hmacSha256("key", "The quick brown fox jumps over the lazy dog"))
      .toBe("f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8");
  });

  it("round-trips URL-safe binary values", () => {
    const bytes = new Uint8Array([0, 1, 127, 128, 254, 255]);
    expect(decodeBase64Url(encodeBase64Url(bytes))).toEqual(bytes);
  });

  it("derives and compares PBKDF2 values", async () => {
    const salt = new Uint8Array([1, 2, 3, 4]);
    const first = await pbkdf2Sha256("合言葉", salt, 1_000);
    const second = await pbkdf2Sha256("合言葉", salt, 1_000);
    const different = await pbkdf2Sha256("別の言葉", salt, 1_000);
    expect(timingSafeEqual(first, second)).toBe(true);
    expect(timingSafeEqual(first, different)).toBe(false);
  });
});
