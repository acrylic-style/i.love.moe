ALTER TABLE images ADD COLUMN visibility TEXT NOT NULL DEFAULT 'unlisted'
  CHECK (visibility IN ('unlisted', 'private', 'passphrase'));
ALTER TABLE images ADD COLUMN passphrase_salt TEXT;
ALTER TABLE images ADD COLUMN passphrase_hash TEXT;
ALTER TABLE images ADD COLUMN passphrase_iterations INTEGER;
ALTER TABLE images ADD COLUMN access_version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE albums ADD COLUMN visibility TEXT NOT NULL DEFAULT 'unlisted'
  CHECK (visibility IN ('unlisted', 'private', 'passphrase'));
ALTER TABLE albums ADD COLUMN passphrase_salt TEXT;
ALTER TABLE albums ADD COLUMN passphrase_hash TEXT;
ALTER TABLE albums ADD COLUMN passphrase_iterations INTEGER;
ALTER TABLE albums ADD COLUMN access_version INTEGER NOT NULL DEFAULT 1;

CREATE TABLE share_access_grants (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  target_type TEXT NOT NULL CHECK (target_type IN ('image', 'album')),
  target_id TEXT NOT NULL,
  access_version INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE share_access_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_hash TEXT NOT NULL,
  code TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX share_access_grants_target_idx
  ON share_access_grants(target_type, target_id, access_version, expires_at);
CREATE INDEX share_access_attempts_ip_code_created_idx
  ON share_access_attempts(ip_hash, code, created_at);
