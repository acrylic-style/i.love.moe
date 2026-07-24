ALTER TABLE server_discord_webhooks
  ADD COLUMN embed_title TEXT NOT NULL DEFAULT 'New Minecraft screenshot';

ALTER TABLE server_discord_webhooks
  ADD COLUMN server_field_title TEXT NOT NULL DEFAULT 'Server';

ALTER TABLE server_discord_webhooks
  ADD COLUMN minecraft_id_field_title TEXT NOT NULL DEFAULT 'Minecraft ID';
