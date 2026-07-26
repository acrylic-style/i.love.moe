import { describe, expect, it } from "vitest";
import { serverApiImages } from "../src/server-api";

describe("server API", () => {
  it("requires a server API bearer token", async () => {
    const response = await serverApiImages(
      new Request("https://i.example/api/v1/server/images"),
      {} as CloudflareEnv,
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe("Bearer");
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
});
