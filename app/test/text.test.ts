import { describe, expect, it } from "vitest";
import { decodeMetadataHeader, normalizeOptionalText } from "../src/service";

describe("normalizeOptionalText", () => {
  it("trims ordinary text", () => {
    expect(normalizeOptionalText("  Minecraft night  ", 100)).toBe("Minecraft night");
  });

  it("turns blank input into null", () => {
    expect(normalizeOptionalText("   ", 100)).toBeNull();
    expect(normalizeOptionalText(null, 100)).toBeNull();
  });

  it("counts Unicode code points", () => {
    expect(normalizeOptionalText("🌸".repeat(100), 100)).toBe("🌸".repeat(100));
    expect(normalizeOptionalText("🌸".repeat(101), 100)).toBeUndefined();
  });
});

describe("decodeMetadataHeader", () => {
  const encode = (value: string) => {
    const bytes = new TextEncoder().encode(value);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
  };

  it("decodes UTF-8 Base64URL metadata", () => {
    expect(decodeMetadataHeader(encode("アジ鯖 Life"), 100)).toBe("アジ鯖 Life");
    expect(decodeMetadataHeader(encode("play.example.com:25565"), 255)).toBe("play.example.com:25565");
  });

  it("accepts omitted metadata", () => {
    expect(decodeMetadataHeader(null, 100)).toBeNull();
  });

  it("rejects malformed, control, and oversized metadata", () => {
    expect(decodeMetadataHeader("not+base64", 100)).toBeUndefined();
    expect(decodeMetadataHeader(encode("bad\nname"), 100)).toBeUndefined();
    expect(decodeMetadataHeader(encode("a".repeat(101)), 100)).toBeUndefined();
  });
});
