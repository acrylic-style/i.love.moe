import { afterEach, describe, expect, it, vi } from "vitest";
import {
  decodeUserImageCursor,
  encodeUserImageCursor,
  publicUserDetail,
  serveUserAvatar,
  updateUserProfile,
} from "../src/users";

const profile = {
  user_id: "user-1",
  display_name: "Player One",
  bio: "Builder",
  primary_minecraft_uuid: "123e4567-e89b-12d3-a456-426614174000",
  minecraft_name: "Player_1",
  slug: "player-one",
  published_at: 10,
  created_at: 1,
  updated_at: 10,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("public user profiles", () => {
  it("round-trips scoped cursors and rejects another sort", () => {
    const cursor = encodeUserImageCursor({
      scope: "public-user",
      sort: "favorites",
      favoriteCount: 4,
      createdAt: 123,
      id: "image-1",
    });
    expect(decodeUserImageCursor(cursor, "favorites")).toEqual({
      scope: "public-user",
      sort: "favorites",
      favoriteCount: 4,
      createdAt: 123,
      id: "image-1",
    });
    expect(decodeUserImageCursor(cursor, "newest")).toBeNull();
    expect(decodeUserImageCursor("not-a-cursor", "newest")).toBeNull();
  });

  it("queries only public active work and supports favorite sorting", async () => {
    const sql: string[] = [];
    const env = {
      DB: {
        prepare(query: string) {
          sql.push(query);
          return {
            bind() {
              return this;
            },
            async first() {
              return profile;
            },
            async all() {
              return { results: [] };
            },
          };
        },
      },
    } as unknown as CloudflareEnv;
    const detail = await publicUserDetail(env, "player-one", {
      sort: "favorites",
      voterIpHash: "hash",
    });
    expect(detail?.profile.display_name).toBe("Player One");
    const imageSql = sql.find((query) => query.includes("FROM images i"));
    expect(imageSql).toContain("i.owner_user_id = ?");
    expect(imageSql).toContain("i.discoverability = 'public'");
    expect(imageSql).toContain("i.visibility = 'unlisted'");
    expect(imageSql).toContain("i.deleted_at IS NULL");
    expect(imageSql).toContain("favorite_count DESC");
    const albumSql = sql.find((query) => query.includes("FROM albums a"));
    expect(albumSql).toContain("a.owner_user_id = ?");
    expect(albumSql).toContain("a.discoverability = 'public'");
  });

  it("proxies an avatar by verified UUID without exposing it in the route", async () => {
    const requests: string[] = [];
    const requestOptions: RequestInit[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        requests.push(String(input));
        requestOptions.push(init ?? {});
        return new Response(new Uint8Array([1, 2, 3]), {
          headers: { "content-type": "image/png" },
        });
      }),
    );
    const env = {
      DB: {
        prepare() {
          return {
            bind() {
              return this;
            },
            async first() {
              return profile;
            },
          };
        },
      },
    } as unknown as CloudflareEnv;
    const response = await serveUserAvatar(env, "player-one");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(requests[0]).toContain(profile.primary_minecraft_uuid);
    expect(requestOptions[0]?.redirect).toBe("manual");
  });

  it("returns a local SVG when the avatar provider fails", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 503 })),
    );
    const env = {
      DB: {
        prepare() {
          return {
            bind() {
              return this;
            },
            async first() {
              return profile;
            },
          };
        },
      },
    } as unknown as CloudflareEnv;
    const response = await serveUserAvatar(env, "player-one");
    expect(response.headers.get("content-type")).toContain("image/svg+xml");
    expect(warning).toHaveBeenCalledWith("user_avatar_upstream_invalid", {
      status: 503,
      contentType: null,
      hasBody: false,
    });
    warning.mockRestore();
  });

  it("logs the error type without profile identifiers when the avatar request throws", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw Object.assign(
          new TypeError(
            `Fetch API cannot load https://mc-heads.net/avatar/${profile.primary_minecraft_uuid}/160.png`,
          ),
          { cause: { code: "network_error" } },
        );
      }),
    );
    const env = {
      DB: {
        prepare() {
          return {
            bind() {
              return this;
            },
            async first() {
              return profile;
            },
          };
        },
      },
    } as unknown as CloudflareEnv;
    const response = await serveUserAvatar(env, "player-one");
    expect(response.headers.get("content-type")).toContain("image/svg+xml");
    expect(error).toHaveBeenCalledWith("user_avatar_fetch_failed", {
      errorName: "TypeError",
      message: "Fetch API cannot load [redacted-url]",
      causeCode: "network_error",
    });
    expect(JSON.stringify(error.mock.calls)).not.toContain(profile.primary_minecraft_uuid);
    expect(JSON.stringify(error.mock.calls)).not.toContain("player-one");
    error.mockRestore();
  });

  it("creates and publishes a profile with a verified Minecraft identity", async () => {
    const batches: string[][] = [];
    const env = profileUpdateEnv(true, batches);
    const form = new FormData();
    form.set("displayName", " Player One ");
    form.set("bio", " Builder ");
    form.set("slug", "Player-One");
    form.set("primaryMinecraftUuid", profile.primary_minecraft_uuid);
    form.set("published", "1");
    const response = await updateUserProfile(
      new Request("https://example.com/manage/profile/update", {
        method: "POST",
        headers: { cookie: "session=test-token", origin: "https://example.com" },
        body: form,
      }),
      env,
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      saved: true,
      slug: "player-one",
      published: true,
    });
    expect(batches[0]?.some((query) => query.includes("INSERT INTO user_profiles"))).toBe(true);
    expect(
      batches[0]?.some((query) => query.includes("INSERT INTO user_profile_identifiers")),
    ).toBe(true);
  });

  it("rejects a primary Minecraft identity that is not verified for the user", async () => {
    const batches: string[][] = [];
    const env = profileUpdateEnv(false, batches);
    const form = new FormData();
    form.set("displayName", "Player One");
    form.set("slug", "player-one");
    form.set("primaryMinecraftUuid", profile.primary_minecraft_uuid);
    const response = await updateUserProfile(
      new Request("https://example.com/manage/profile/update", {
        method: "POST",
        headers: { cookie: "session=test-token", origin: "https://example.com" },
        body: form,
      }),
      env,
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_primary_profile" });
    expect(batches).toHaveLength(0);
  });
});

function profileUpdateEnv(verified: boolean, batches: string[][]): CloudflareEnv {
  return {
    DB: {
      prepare(query: string) {
        const statement = {
          query,
          bind() {
            return this;
          },
          async first() {
            if (query.includes("FROM sessions")) return { id: "session-1", user_id: "user-1" };
            if (query.includes("FROM user_minecraft_profiles"))
              return verified ? { found: 1 } : null;
            return null;
          },
        };
        return statement;
      },
      async batch(statements: Array<{ query: string }>) {
        batches.push(statements.map((statement) => statement.query));
        return [];
      },
    },
  } as unknown as CloudflareEnv;
}
