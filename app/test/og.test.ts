import { describe, expect, it } from "vitest";
import { buildOpenGraphImage } from "../src/og";

const image = {
  code: "AbCd1234",
  width: 1920,
  height: 1080,
  title: "A Minecraft sunset",
};

describe("buildOpenGraphImage", () => {
  it("builds a direct screenshot preview", () => {
    expect(buildOpenGraphImage("https://i.xn--29jub.moe", "unlisted", image)).toEqual({
      url: "https://i.xn--29jub.moe/raw/AbCd1234",
      width: 1920,
      height: 1080,
      alt: "A Minecraft sunset",
    });
  });

  it("builds an album-authorized cover URL", () => {
    expect(
      buildOpenGraphImage("https://i.xn--29jub.moe/", "unlisted", image, "Album123"),
    ).toMatchObject({
      url: "https://i.xn--29jub.moe/raw/AbCd1234?album=Album123",
    });
  });

  it("does not expose protected images", () => {
    expect(buildOpenGraphImage("https://i.xn--29jub.moe", "private", image)).toBeUndefined();
    expect(buildOpenGraphImage("https://i.xn--29jub.moe", "passphrase", image)).toBeUndefined();
  });
});
