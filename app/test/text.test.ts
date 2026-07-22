import { describe, expect, it } from "vitest";
import { normalizeOptionalText } from "../src/service";

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
