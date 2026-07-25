import { describe, expect, it } from "vitest";
import { normalizeVerificationCode } from "../src/web-auth";

describe("Minecraft verification codes", () => {
  it("normalizes readable codes", () => {
    expect(normalizeVerificationCode("abcd-efgh")).toBe("ABCDEFGH");
    expect(normalizeVerificationCode("ABCD EFGH")).toBe("ABCDEFGH");
  });

  it("rejects ambiguous, short, and malformed codes", () => {
    expect(normalizeVerificationCode("ABCD-EFG")).toBeNull();
    expect(normalizeVerificationCode("ABCD-EFGI")).toBeNull();
    expect(normalizeVerificationCode("ABCD-01GH")).toBeNull();
  });
});
