CREATE TABLE browser_login_challenges (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  device_id TEXT NOT NULL REFERENCES devices(id),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);

CREATE INDEX browser_login_challenges_hash_idx
  ON browser_login_challenges(token_hash);

CREATE INDEX browser_login_challenges_device_created_idx
  ON browser_login_challenges(device_id, created_at);

CREATE INDEX browser_login_challenges_expiry_idx
  ON browser_login_challenges(expires_at);

CREATE TABLE magic_link_email_attempts (
  id TEXT PRIMARY KEY,
  email_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX magic_link_email_attempts_email_time_idx
  ON magic_link_email_attempts(email_hash, created_at);

CREATE INDEX magic_link_email_attempts_time_idx
  ON magic_link_email_attempts(created_at);
