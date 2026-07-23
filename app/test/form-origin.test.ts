import { describe, expect, it } from "vitest";
import { acceptsFormOrigin } from "../src/service";

describe("acceptsFormOrigin", () => {
  const requestUrl = "https://mc.moe.pictures/auth/browser-login";

  it("accepts the matching HTTPS origin", () => {
    expect(acceptsFormOrigin("https://mc.moe.pictures", requestUrl)).toBe(true);
  });

  it("accepts omitted and opaque origins", () => {
    expect(acceptsFormOrigin(null, requestUrl)).toBe(true);
    expect(acceptsFormOrigin("null", requestUrl)).toBe(true);
  });

  it("rejects a different origin", () => {
    expect(acceptsFormOrigin("https://example.com", requestUrl)).toBe(false);
  });
});
