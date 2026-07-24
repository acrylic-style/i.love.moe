import { decodeBase64Url, encodeBase64Url } from "./crypto";

const DISCORD_WEBHOOK_PATH = /^\/api(?:\/v\d+)?\/webhooks\/\d{17,20}\/[A-Za-z0-9._-]{20,}$/;

export interface ManagedDiscordWebhook {
  id: string;
  display_name: string;
  created_at: number;
  status: "enabled" | "disabled";
  disabled_at: number | null;
  embed_title: string;
  server_field_title: string;
  minecraft_id_field_title: string;
  last_success_at: number | null;
  last_failure_at: number | null;
  last_error_code: string | null;
}

interface PublishedImageWebhookRow {
  id: string;
  title: string | null;
  created_at: number;
  minecraft_name: string | null;
  minecraft_id_public: number;
  code: string;
  server_id: string;
  server_name: string | null;
  display_address: string;
  accent_color: string | null;
}

interface StoredWebhookRow extends ManagedDiscordWebhook {
  encrypted_url: string;
  encryption_iv: string;
}

export function normalizeDiscordWebhookUrl(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || value.length > 500) return null;
  try {
    const url = new URL(value.trim());
    if (
      url.protocol !== "https:" ||
      url.hostname !== "discord.com" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !DISCORD_WEBHOOK_PATH.test(url.pathname)
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function discordWebhookStatusForResponse(status: number): "enabled" | "disabled" {
  return status === 403 || status === 404 ? "disabled" : "enabled";
}

export interface DiscordWebhookEmbedCopy {
  embedTitle: string;
  serverFieldTitle: string;
  minecraftIdFieldTitle: string;
}

export async function encryptWebhookUrl(
  url: string,
  encryptionSecret: string,
): Promise<{ encryptedUrl: string; encryptionIv: string }> {
  const key = await webhookEncryptionKey(encryptionSecret, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    new TextEncoder().encode(url),
  );
  return {
    encryptedUrl: encodeBase64Url(new Uint8Array(encrypted)),
    encryptionIv: encodeBase64Url(iv),
  };
}

export async function decryptWebhookUrl(
  encryptedUrl: string,
  encryptionIv: string,
  encryptionSecret: string,
): Promise<string> {
  const encrypted = decodeBase64Url(encryptedUrl);
  const iv = decodeBase64Url(encryptionIv);
  if (!encrypted || !iv || iv.byteLength !== 12) throw new Error("invalid_encrypted_webhook");
  const key = await webhookEncryptionKey(encryptionSecret, ["decrypt"]);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    encrypted as BufferSource,
  );
  return new TextDecoder("utf-8", { fatal: true }).decode(decrypted);
}

export async function notifyDiscordWebhooksForPublishedImage(
  env: CloudflareEnv,
  imageId: string,
): Promise<void> {
  const image = await env.DB.prepare(
    `SELECT i.id, i.title, i.created_at, i.minecraft_name, i.minecraft_id_public,
      sl.code, s.id AS server_id, s.display_name AS server_name, a.display_address,
      s.accent_color
    FROM images i
    JOIN short_links sl ON sl.target_type = 'image' AND sl.target_id = i.id
      AND sl.retired_at IS NULL
    JOIN servers s ON s.id = i.server_id AND s.verified_at IS NOT NULL
    JOIN server_addresses a ON a.server_id = s.id AND a.is_primary = 1
    WHERE i.id = ? AND i.visibility = 'unlisted' AND i.discoverability = 'public'
      AND i.deleted_at IS NULL AND i.expires_at > ?`,
  )
    .bind(imageId, Date.now())
    .first<PublishedImageWebhookRow>();
  if (!image) return;

  const webhooks = await env.DB.prepare(
    `SELECT id, display_name, encrypted_url, encryption_iv, created_at, status, disabled_at,
      embed_title, server_field_title, minecraft_id_field_title,
      last_success_at, last_failure_at, last_error_code
    FROM server_discord_webhooks
    WHERE server_id = ? AND status = 'enabled' ORDER BY created_at`,
  )
    .bind(image.server_id)
    .all<StoredWebhookRow>();
  if (webhooks.results.length === 0) return;

  await Promise.all(
    webhooks.results.map(async (webhook) => {
      const attemptedAt = Date.now();
      const claim = await env.DB.prepare(
        `INSERT OR IGNORE INTO server_discord_webhook_deliveries
          (webhook_id, image_id, attempted_at) VALUES (?, ?, ?)`,
      )
        .bind(webhook.id, imageId, attemptedAt)
        .run();
      if ((claim.meta.changes ?? 0) !== 1) return;
      try {
        const url = await decryptWebhookUrl(
          webhook.encrypted_url,
          webhook.encryption_iv,
          env.WEBHOOK_ENCRYPTION_KEY,
        );
        const endpoint = new URL(url);
        endpoint.searchParams.set("wait", "true");
        const payload = buildDiscordWebhookPayload(image, env.PUBLIC_BASE_URL, {
          embedTitle: webhook.embed_title,
          serverFieldTitle: webhook.server_field_title,
          minecraftIdFieldTitle: webhook.minecraft_id_field_title,
        });
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) {
          const body = await response.text();
          const disabled = discordWebhookStatusForResponse(response.status) === "disabled";
          if (disabled) {
            await env.DB.prepare(
              `UPDATE server_discord_webhooks SET status = 'disabled', disabled_at = ?
                WHERE id = ?`,
            )
              .bind(Date.now(), webhook.id)
              .run();
          }
          throw new Error(`discord_http_${response.status}:${discordErrorCode(body)}`);
        }
        const deliveredAt = Date.now();
        await env.DB.batch([
          env.DB.prepare(
            `UPDATE server_discord_webhooks SET status = 'enabled', disabled_at = NULL,
              last_success_at = ?, last_failure_at = NULL, last_error_code = NULL WHERE id = ?`,
          ).bind(deliveredAt, webhook.id),
          env.DB.prepare(
            `UPDATE server_discord_webhook_deliveries
              SET delivered_at = ?, error_code = NULL
              WHERE webhook_id = ? AND image_id = ?`,
          ).bind(deliveredAt, webhook.id, imageId),
        ]);
      } catch (error) {
        const code = webhookErrorCode(error);
        console.error(
          "discord_webhook_delivery_failed",
          JSON.stringify({ webhookId: webhook.id, serverId: image.server_id, imageId, code }),
        );
        const failedAt = Date.now();
        await env.DB.batch([
          env.DB.prepare(
            `UPDATE server_discord_webhooks SET last_failure_at = ?,
              last_error_code = ? WHERE id = ?`,
          ).bind(failedAt, code, webhook.id),
          env.DB.prepare(
            `UPDATE server_discord_webhook_deliveries SET error_code = ?
              WHERE webhook_id = ? AND image_id = ?`,
          ).bind(code, webhook.id, imageId),
        ]);
      }
    }),
  );
}

export function buildDiscordWebhookPayload(
  image: PublishedImageWebhookRow,
  publicBaseUrl: string,
  copy: DiscordWebhookEmbedCopy = {
    embedTitle: "New Minecraft screenshot",
    serverFieldTitle: "Server",
    minecraftIdFieldTitle: "Minecraft ID",
  },
): Record<string, unknown> {
  const base = publicBaseUrl.replace(/\/$/, "");
  const shareUrl = `${base}/${image.code}`;
  const fields: Array<{ name: string; value: string; inline: boolean }> = [
    {
      name: truncate(copy.serverFieldTitle, 256),
      value: truncate(image.server_name ?? image.display_address, 1024),
      inline: true,
    },
  ];
  if (image.minecraft_id_public && image.minecraft_name) {
    fields.push({
      name: truncate(copy.minecraftIdFieldTitle, 256),
      value: truncate(image.minecraft_name, 1024),
      inline: true,
    });
  }
  return {
    username: "i.らぶ.moe",
    allowed_mentions: { parse: [] },
    embeds: [
      {
        type: "rich",
        title: truncate(copy.embedTitle, 256),
        ...(image.title?.trim() ? { description: truncate(image.title.trim(), 4096) } : {}),
        url: shareUrl,
        color: discordColor(image.accent_color),
        fields,
        image: { url: `${base}/raw/${image.code}` },
        timestamp: new Date(image.created_at).toISOString(),
        footer: { text: "i.らぶ.moe" },
      },
    ],
  };
}

async function webhookEncryptionKey(secret: string, usages: KeyUsage[]): Promise<CryptoKey> {
  if (!secret || secret.length < 32) throw new Error("webhook_encryption_key_unavailable");
  const keyBytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, usages);
}

function discordColor(value: string | null): number {
  return /^#[0-9a-f]{6}$/i.test(value ?? "") ? Number.parseInt(value!.slice(1), 16) : 0xe889b6;
}

function truncate(value: string, limit: number): string {
  const characters = Array.from(value);
  return characters.length <= limit ? value : `${characters.slice(0, limit - 1).join("")}…`;
}

function discordErrorCode(body: string): string {
  try {
    const value = JSON.parse(body) as { code?: unknown };
    return typeof value.code === "number" || typeof value.code === "string"
      ? String(value.code).slice(0, 100)
      : "unknown";
  } catch {
    return "unknown";
  }
}

function webhookErrorCode(error: unknown): string {
  if (!(error instanceof Error)) return "unknown";
  if (error.message.startsWith("discord_http_")) return error.message.slice(0, 200);
  if (error.message === "webhook_encryption_key_unavailable") return error.message;
  return error.name === "TypeError" ? "network_error" : "delivery_error";
}
