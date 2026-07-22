PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  created_at INTEGER NOT NULL
);

CREATE TABLE devices (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  user_id TEXT REFERENCES users(id),
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);

CREATE TABLE images (
  id TEXT PRIMARY KEY,
  owner_device_id TEXT NOT NULL REFERENCES devices(id),
  owner_user_id TEXT REFERENCES users(id),
  r2_key TEXT NOT NULL UNIQUE,
  byte_size INTEGER NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  deleted_at INTEGER
);

CREATE TABLE short_links (
  code TEXT PRIMARY KEY,
  target_type TEXT NOT NULL CHECK (target_type IN ('image', 'album')),
  target_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  retired_at INTEGER
);

CREATE TABLE magic_link_tokens (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  device_id TEXT NOT NULL REFERENCES devices(id),
  email TEXT NOT NULL COLLATE NOCASE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX images_device_created_idx ON images(owner_device_id, created_at);
CREATE INDEX images_user_created_idx ON images(owner_user_id, created_at);
CREATE INDEX images_expiry_idx ON images(expires_at);
CREATE INDEX short_links_target_idx ON short_links(target_type, target_id);
CREATE INDEX magic_link_hash_idx ON magic_link_tokens(token_hash);
CREATE INDEX sessions_hash_idx ON sessions(token_hash);
