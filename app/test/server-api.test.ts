import { describe, expect, it } from "vitest";
import { createServerApiToken, serverApiImages } from "../src/server-api";

describe("server API", () => {
  it("requires a server API bearer token", async () => {
    const response = await serverApiImages(
      new Request("https://i.example/api/v1/server/images"),
      {} as CloudflareEnv,
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe("Bearer");
  });

  it("does not issue a token without Plus", async () => {
    const sql: string[] = [];
    const database = {
      prepare(query: string) {
        sql.push(query);
        return {
          bind() {
            return this;
          },
          async first() {
            if (query.includes("FROM sessions")) return { id: "session-1", user_id: "owner-1" };
            if (query.includes("owner_user_id = ?")) return { found: 1 };
            if (query.includes("SELECT owner_user_id FROM servers")) {
              return { owner_user_id: "owner-1" };
            }
            if (query.includes("FROM subscriptions")) return null;
            return null;
          },
          async run() {
            return { meta: { changes: 0 } };
          },
        };
      },
    };
    const response = await createServerApiToken(
      new Request("https://i.example/manage/servers/server-1/api-tokens", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie: "session=session-secret",
          origin: "https://i.example",
        },
        body: new URLSearchParams({ name: "Website" }),
      }),
      {
        DB: database,
        STRIPE_PLUS_PRICE_ID: "price-plus",
      } as unknown as CloudflareEnv,
      "server-1",
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "plus_required" });
    expect(sql.some((query) => query.includes("INSERT INTO server_api_tokens"))).toBe(false);
  });

  it("returns only the server's public image metadata and honors Minecraft ID visibility", async () => {
    const sql: string[] = [];
    const token = `ilms_${"a".repeat(50)}`;
    const database = {
      prepare(query: string) {
        sql.push(query);
        return {
          bind() {
            return this;
          },
          async first() {
            if (query.includes("FROM server_api_tokens")) {
              return { id: "token-1", server_id: "server-1" };
            }
            if (query.includes("SELECT owner_user_id FROM servers")) {
              return { owner_user_id: "owner-1" };
            }
            if (query.includes("FROM subscriptions")) {
              return {
                stripe_price_id: "price-plus",
                status: "active",
                current_period_end: Date.now() + 60_000,
              };
            }
            return null;
          },
          async run() {
            return { meta: { changes: 1 } };
          },
          async all() {
            if (!query.includes("FROM images i")) return { results: [] };
            return {
              results: [
                {
                  id: "123e4567-e89b-42d3-a456-426614174000",
                  title: "Spawn",
                  description: null,
                  server_address: "play.example.com",
                  server_name: "Example",
                  byte_size: 123,
                  width: 1920,
                  height: 1080,
                  created_at: 1,
                  expires_at: 2,
                  visibility: "unlisted",
                  discoverability: "public",
                  minecraft_uuid: "123e4567-e89b-42d3-a456-426614174001",
                  minecraft_name: "HiddenPlayer",
                  minecraft_id_public: 0,
                  code: "Image001",
                },
              ],
            };
          },
        };
      },
    };
    const response = await serverApiImages(
      new Request("https://i.example/api/v1/server/images", {
        headers: { authorization: `Bearer ${token}` },
      }),
      {
        DB: database,
        PUBLIC_BASE_URL: "https://i.example",
        STRIPE_PLUS_PRICE_ID: "price-plus",
      } as unknown as CloudflareEnv,
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      images: Array<{ visibility: string; minecraft: unknown; contentUrl: string }>;
    };
    expect(body.images).toEqual([
      expect.objectContaining({
        visibility: "public",
        minecraft: null,
        contentUrl:
          "https://i.example/api/v1/server/images/123e4567-e89b-42d3-a456-426614174000/content",
      }),
    ]);
    expect(sql.some((query) => query.includes("i.discoverability = 'public'"))).toBe(true);
    expect(sql.some((query) => query.includes("i.visibility = 'unlisted'"))).toBe(true);
  });

  it("rejects an existing token while the server owner does not have Plus", async () => {
    const sql: string[] = [];
    const database = {
      prepare(query: string) {
        sql.push(query);
        return {
          bind() {
            return this;
          },
          async first() {
            if (query.includes("FROM server_api_tokens")) {
              return { id: "token-1", server_id: "server-1" };
            }
            if (query.includes("SELECT owner_user_id FROM servers")) {
              return { owner_user_id: "owner-1" };
            }
            if (query.includes("FROM subscriptions")) return null;
            return null;
          },
          async run() {
            return { meta: { changes: 1 } };
          },
          async all() {
            return { results: [] };
          },
        };
      },
    };
    const response = await serverApiImages(
      new Request("https://i.example/api/v1/server/images", {
        headers: { authorization: `Bearer ilms_${"b".repeat(50)}` },
      }),
      {
        DB: database,
        PUBLIC_BASE_URL: "https://i.example",
        STRIPE_PLUS_PRICE_ID: "price-plus",
      } as unknown as CloudflareEnv,
    );

    expect(response.status).toBe(401);
    expect(sql.some((query) => query.includes("UPDATE server_api_tokens"))).toBe(false);
    expect(sql.some((query) => query.includes("FROM images i"))).toBe(false);
  });
});
