import { describe, expect, it } from "vitest";
import {
  asciiHostname,
  displayServerAddress,
  isDisallowedHost,
  parseServerAddress,
  serverFavoriteIpHash,
} from "../src/servers";

describe("Minecraft server address normalization", () => {
  it("normalizes IDN hostnames and the default port", () => {
    expect(parseServerAddress("例え.テスト")).toEqual({
      hostAscii: "xn--r8jz45g.xn--zckzah",
      port: 25565,
      displayAddress: "xn--r8jz45g.xn--zckzah",
    });
  });

  it("preserves a non-default port", () => {
    expect(parseServerAddress("PLAY.Example.COM:25566")).toEqual({
      hostAscii: "play.example.com",
      port: 25566,
      displayAddress: "play.example.com:25566",
    });
  });

  it("supports bracketed IPv6 addresses", () => {
    expect(parseServerAddress("[2606:4700:4700::1111]:25566")).toEqual({
      hostAscii: "2606:4700:4700::1111",
      port: 25566,
      displayAddress: "[2606:4700:4700::1111]:25566",
    });
  });

  it("decodes internationalized hostnames for display", () => {
    expect(displayServerAddress("xn--r8jz45g.xn--zckzah:25566")).toBe("例え.テスト:25566");
  });

  it("rejects local and private destinations", () => {
    expect(parseServerAddress("localhost")).toBeNull();
    expect(parseServerAddress("127.0.0.1")).toBeNull();
    expect(parseServerAddress("10.0.0.1:25565")).toBeNull();
    expect(parseServerAddress("[::1]")).toBeNull();
    expect(isDisallowedHost("192.168.1.2")).toBe(true);
  });

  it("requires a qualified hostname", () => {
    expect(asciiHostname("example")).toBeNull();
    expect(parseServerAddress("singleplayer")).toBeNull();
  });

  it("uses a stable keyed IP hash for anonymous favorites", async () => {
    const env = { RATE_LIMIT_SALT: "s".repeat(32) } as CloudflareEnv;
    const first = await serverFavoriteIpHash(
      env,
      new Headers({ host: "example.com", "cf-connecting-ip": "203.0.113.9" }),
    );
    const second = await serverFavoriteIpHash(
      env,
      new Headers({ host: "example.com", "cf-connecting-ip": "203.0.113.9" }),
    );
    const other = await serverFavoriteIpHash(
      env,
      new Headers({ host: "example.com", "cf-connecting-ip": "203.0.113.10" }),
    );
    expect(first).toBe(second);
    expect(first).not.toBe(other);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
  });
});
