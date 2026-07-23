import { describe, expect, it } from "vitest";
import { buildUploadUrls } from "../src/service";

describe("buildUploadUrls", () => {
  it("returns separate web and Minecraft-facing URLs", () => {
    expect(
      buildUploadUrls("https://i.xn--29jub.moe/", "https://mc.moe.pictures/", "AbCd1234"),
    ).toEqual({
      url: "https://i.xn--29jub.moe/AbCd1234",
      minecraftUrl: "https://mc.moe.pictures/AbCd1234",
    });
  });
});
