import { describe, expect, it } from "vitest";
import {
  createPassphraseRecord,
  parseShareMode,
  parseVisibility,
  validPassphrase,
} from "../src/access";
import { decodeBase64Url, pbkdf2Sha256, timingSafeEqual } from "../src/crypto";

describe("share access helpers", () => {
  it("accepts only supported visibility values", () => {
    expect(parseVisibility("unlisted")).toBe("unlisted");
    expect(parseVisibility("private")).toBe("private");
    expect(parseVisibility("passphrase")).toBe("passphrase");
    expect(parseVisibility("public")).toBeNull();
  });

  it("keeps discovery separate from URL access", () => {
    expect(parseShareMode("public")).toEqual({
      visibility: "unlisted",
      discoverability: "public",
    });
    expect(parseShareMode("unlisted")).toEqual({
      visibility: "unlisted",
      discoverability: "hidden",
    });
  });

  it("validates passphrase length by Unicode characters", () => {
    expect(validPassphrase("あいうえ")).toBe(true);
    expect(validPassphrase("あいう")).toBe(false);
    expect(validPassphrase("🌸".repeat(100))).toBe(true);
    expect(validPassphrase("🌸".repeat(101))).toBe(false);
  });

  it("stores a salted PBKDF2 digest instead of the passphrase", async () => {
    const record = await createPassphraseRecord("春の合言葉");
    const salt = decodeBase64Url(record.passphrase_salt);
    const expected = decodeBase64Url(record.passphrase_hash);
    expect(salt).not.toBeNull();
    expect(expected).not.toBeNull();
    expect(record.passphrase_hash).not.toContain("春の合言葉");
    expect(record.passphrase_iterations).toBe(100_000);
    const actual = await pbkdf2Sha256("春の合言葉", salt!, record.passphrase_iterations);
    expect(timingSafeEqual(actual, expected!)).toBe(true);
  });
});
