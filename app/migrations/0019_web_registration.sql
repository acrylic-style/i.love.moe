ALTER TABLE devices ADD COLUMN kind TEXT NOT NULL DEFAULT 'mod'
  CHECK (kind IN ('mod', 'web'));

CREATE UNIQUE INDEX devices_web_user_idx
  ON devices(user_id) WHERE kind = 'web' AND user_id IS NOT NULL;

ALTER TABLE user_minecraft_profiles ADD COLUMN verified_at INTEGER;

CREATE UNIQUE INDEX user_minecraft_profiles_verified_uuid_idx
  ON user_minecraft_profiles(minecraft_uuid) WHERE status = 'verified';

CREATE TABLE minecraft_verification_codes (
  id TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL UNIQUE,
  minecraft_uuid TEXT NOT NULL,
  minecraft_name TEXT NOT NULL
    CHECK (length(minecraft_name) BETWEEN 1 AND 16),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  reserved_email_hash TEXT,
  reserved_at INTEGER,
  used_at INTEGER
);

CREATE INDEX minecraft_verification_codes_uuid_idx
  ON minecraft_verification_codes(minecraft_uuid, created_at);
CREATE INDEX minecraft_verification_codes_expiry_idx
  ON minecraft_verification_codes(expires_at);

CREATE TABLE web_magic_link_tokens (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL COLLATE NOCASE,
  purpose TEXT NOT NULL CHECK (purpose IN ('login', 'register')),
  verification_code_id TEXT REFERENCES minecraft_verification_codes(id),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);

CREATE INDEX web_magic_link_tokens_hash_idx
  ON web_magic_link_tokens(token_hash);
CREATE INDEX web_magic_link_tokens_expiry_idx
  ON web_magic_link_tokens(expires_at);

CREATE TABLE web_auth_attempts (
  id TEXT PRIMARY KEY,
  email_hash TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('login', 'register', 'link')),
  created_at INTEGER NOT NULL
);

CREATE INDEX web_auth_attempts_email_time_idx
  ON web_auth_attempts(email_hash, created_at);
CREATE INDEX web_auth_attempts_ip_time_idx
  ON web_auth_attempts(ip_hash, created_at);
