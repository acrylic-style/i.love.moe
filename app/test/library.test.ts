import { describe, expect, it } from "vitest";
import {
  decodeLibraryCursor,
  encodeLibraryCursor,
  isTagColor,
  normalizeTagName,
  parseLibraryFilters,
} from "../src/library";

describe("image library helpers", () => {
  it("normalizes Unicode tag names and preserves Japanese text", () => {
    expect(normalizeTagName("  ＰｖＰ　記録  ")).toEqual({
      name: "PvP 記録",
      normalized: "pvp 記録",
    });
    expect(normalizeTagName("日本語タグ")).toEqual({
      name: "日本語タグ",
      normalized: "日本語タグ",
    });
  });

  it("rejects blank and overlong tag names", () => {
    expect(normalizeTagName("　 ")).toBeNull();
    expect(normalizeTagName("🌸".repeat(31))).toBeNull();
    expect(normalizeTagName("🌸".repeat(30))?.name).toHaveLength(60);
  });

  it("allows only the fixed tag palette", () => {
    expect(isTagColor("pink")).toBe(true);
    expect(isTagColor("#ff00ff")).toBe(false);
  });

  it("round-trips an opaque cursor and rejects another sort", () => {
    const cursor = encodeLibraryCursor({ sort: "newest", value: 1234, id: "image-1" });
    expect(decodeLibraryCursor(cursor, "newest")).toEqual({
      sort: "newest",
      value: 1234,
      id: "image-1",
    });
    expect(decodeLibraryCursor(cursor, "oldest")).toBeNull();
    expect(decodeLibraryCursor("not-a-cursor", "newest")).toBeNull();
  });

  it("sanitizes URL filters", () => {
    expect(
      parseLibraryFilters({
        q: `  ${"x".repeat(120)}  `,
        visibility: "public",
        favorite: "1",
        from: "123",
        to: "-1",
        expiring: "1",
        sort: "title",
      }),
    ).toMatchObject({
      q: "x".repeat(100),
      visibility: "",
      favorite: true,
      from: 123,
      to: null,
      expiring: true,
      sort: "title",
    });
  });
});
