CREATE TABLE server_discord_webhooks (
  id TEXT PRIMARY KEY,
  server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  encrypted_url TEXT NOT NULL,
  encryption_iv TEXT NOT NULL,
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'enabled'
    CHECK (status IN ('enabled', 'disabled')),
  disabled_at INTEGER,
  last_success_at INTEGER,
  last_failure_at INTEGER,
  last_error_code TEXT
);

CREATE INDEX server_discord_webhooks_server_idx
  ON server_discord_webhooks(server_id, created_at);

CREATE TABLE server_discord_webhook_deliveries (
  webhook_id TEXT NOT NULL REFERENCES server_discord_webhooks(id) ON DELETE CASCADE,
  image_id TEXT NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  attempted_at INTEGER NOT NULL,
  delivered_at INTEGER,
  error_code TEXT,
  PRIMARY KEY (webhook_id, image_id)
);

CREATE INDEX server_discord_webhook_deliveries_image_idx
  ON server_discord_webhook_deliveries(image_id);
