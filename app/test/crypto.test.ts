import { describe, expect, it } from "vitest";
import { hmacSha256, randomBase62, randomToken, sha256 } from "../src/crypto";

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
});
