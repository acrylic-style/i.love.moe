import { describe, expect, it } from "vitest";
import { parseMinecraftProfileHeaders } from "../src/service";

function encoded(value: string): string {
  return btoa(value).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

describe("Minecraft profile upload metadata", () => {
  it("normalizes a complete UUID and Minecraft ID pair", () => {
    expect(
      parseMinecraftProfileHeaders(
        new Headers({
          "x-minecraft-player-uuid": "123E4567-E89B-12D3-A456-426614174000",
          "x-minecraft-player-name": encoded("Player_1"),
        }),
      ),
    ).toEqual({
      uuid: "123e4567-e89b-12d3-a456-426614174000",
      name: "Player_1",
    });
  });

  it("allows uploads that do not include profile metadata", () => {
    expect(parseMinecraftProfileHeaders(new Headers())).toBeNull();
  });

  it("rejects partial or malformed profile metadata", () => {
    expect(
      parseMinecraftProfileHeaders(
        new Headers({ "x-minecraft-player-uuid": "123e4567-e89b-12d3-a456-426614174000" }),
      ),
    ).toBeUndefined();
    expect(
      parseMinecraftProfileHeaders(
        new Headers({
          "x-minecraft-player-uuid": "not-a-uuid",
          "x-minecraft-player-name": encoded("Player_1"),
        }),
      ),
    ).toBeUndefined();
    expect(
      parseMinecraftProfileHeaders(
        new Headers({
          "x-minecraft-player-uuid": "123e4567-e89b-12d3-a456-426614174000",
          "x-minecraft-player-name": encoded("invalid name"),
        }),
      ),
    ).toBeUndefined();
  });
});
