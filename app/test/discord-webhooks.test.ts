import { describe, expect, it } from "vitest";
import {
  buildDiscordWebhookPayload,
  decryptWebhookUrl,
  discordWebhookStatusForResponse,
  encryptWebhookUrl,
  normalizeDiscordWebhookUrl,
} from "../src/discord-webhooks";

describe("Discord webhook URLs", () => {
  it("accepts only Discord incoming webhook URLs without extra URL parts", () => {
    expect(
      normalizeDiscordWebhookUrl(
        "https://discord.com/api/webhooks/12345678901234567/abcdefghijklmnopqrstuvwxyz_ABC-123",
      ),
    ).toBe("https://discord.com/api/webhooks/12345678901234567/abcdefghijklmnopqrstuvwxyz_ABC-123");
    expect(
      normalizeDiscordWebhookUrl(
        "https://discord.com/api/v10/webhooks/12345678901234567/abcdefghijklmnopqrstuvwxyz_ABC-123",
      ),
    ).not.toBeNull();
    expect(
      normalizeDiscordWebhookUrl(
        "https://example.com/api/webhooks/12345678901234567/abcdefghijklmnopqrstuvwxyz_ABC-123",
      ),
    ).toBeNull();
    expect(
      normalizeDiscordWebhookUrl(
        "https://discord.com/api/webhooks/12345678901234567/abcdefghijklmnopqrstuvwxyz_ABC-123?wait=true",
      ),
    ).toBeNull();
  });

  it("encrypts webhook URLs with authenticated encryption", async () => {
    const url =
      "https://discord.com/api/webhooks/12345678901234567/abcdefghijklmnopqrstuvwxyz_ABC-123";
    const encrypted = await encryptWebhookUrl(url, "test-secret-that-is-longer-than-32-characters");

    expect(encrypted.encryptedUrl).not.toContain("discord");
    await expect(
      decryptWebhookUrl(
        encrypted.encryptedUrl,
        encrypted.encryptionIv,
        "test-secret-that-is-longer-than-32-characters",
      ),
    ).resolves.toBe(url);
    await expect(
      decryptWebhookUrl(
        encrypted.encryptedUrl,
        encrypted.encryptionIv,
        "another-secret-that-is-longer-than-32-characters",
      ),
    ).rejects.toThrow();
  });

  it("disables only webhooks rejected with 403 or missing with 404", () => {
    expect(discordWebhookStatusForResponse(403)).toBe("disabled");
    expect(discordWebhookStatusForResponse(404)).toBe("disabled");
    expect(discordWebhookStatusForResponse(204)).toBe("enabled");
    expect(discordWebhookStatusForResponse(429)).toBe("enabled");
    expect(discordWebhookStatusForResponse(500)).toBe("enabled");
  });
});

describe("Discord webhook payload", () => {
  it("uses a rich embed and disables every mention type", () => {
    const payload = buildDiscordWebhookPayload(
      {
        id: "image-1",
        title: "@everyone A screenshot",
        created_at: Date.parse("2026-07-24T00:00:00Z"),
        minecraft_name: "Player_1",
        minecraft_id_public: 1,
        code: "AbCd1234",
        server_id: "server-1",
        server_name: "Example server",
        display_address: "play.example.com",
        accent_color: "#12abef",
      },
      "https://i.example.com/",
      {
        embedTitle: "A new memory arrived",
        serverFieldTitle: "Played on",
        minecraftIdFieldTitle: "Player",
      },
    );

    expect(payload.allowed_mentions).toEqual({ parse: [] });
    expect(payload.embeds).toEqual([
      expect.objectContaining({
        type: "rich",
        title: "A new memory arrived",
        description: "@everyone A screenshot",
        url: "https://i.example.com/AbCd1234",
        color: 0x12abef,
        fields: [
          { name: "Played on", value: "Example server", inline: true },
          { name: "Player", value: "Player_1", inline: true },
        ],
        image: { url: "https://i.example.com/raw/AbCd1234" },
      }),
    ]);
  });

  it("omits the description when the image has no title", () => {
    const payload = buildDiscordWebhookPayload(
      {
        id: "image-2",
        title: null,
        created_at: Date.parse("2026-07-25T00:00:00Z"),
        minecraft_name: null,
        minecraft_id_public: 0,
        code: "EfGh5678",
        server_id: "server-1",
        server_name: null,
        display_address: "play.example.com",
        accent_color: null,
      },
      "https://i.example.com",
    ) as { embeds: Array<Record<string, unknown>> };

    expect(payload.embeds[0]).not.toHaveProperty("description");
  });
});
