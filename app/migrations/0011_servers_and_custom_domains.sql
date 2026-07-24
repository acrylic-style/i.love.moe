CREATE TABLE servers (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  slug TEXT UNIQUE COLLATE NOCASE,
  display_name TEXT CHECK (display_name IS NULL OR length(display_name) BETWEEN 1 AND 100),
  description TEXT CHECK (description IS NULL OR length(description) <= 2000),
  owner_user_id TEXT REFERENCES users(id),
  pending_owner_user_id TEXT REFERENCES users(id),
  pending_owner_created_at INTEGER,
  verification_method TEXT CHECK (verification_method IS NULL OR verification_method IN ('dns', 'motd')),
  verified_at INTEGER,
  icon_key TEXT,
  banner_key TEXT,
  featured_image_id TEXT REFERENCES images(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE server_addresses (
  id TEXT PRIMARY KEY,
  server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  pending_server_id TEXT REFERENCES servers(id) ON DELETE SET NULL,
  host_ascii TEXT NOT NULL COLLATE NOCASE,
  port INTEGER NOT NULL CHECK (port BETWEEN 1 AND 65535),
  display_address TEXT NOT NULL,
  verified_at INTEGER,
  is_primary INTEGER NOT NULL DEFAULT 1 CHECK (is_primary IN (0, 1)),
  UNIQUE(host_ascii, port)
);

CREATE TABLE server_members (
  server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'editor')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (server_id, user_id)
);

CREATE TABLE server_slug_history (
  identifier TEXT PRIMARY KEY COLLATE NOCASE,
  server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);

CREATE TABLE server_verification_challenges (
  id TEXT PRIMARY KEY,
  server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  method TEXT NOT NULL CHECK (method IN ('dns', 'motd')),
  purpose TEXT NOT NULL DEFAULT 'claim' CHECK (purpose IN ('claim', 'address', 'transfer')),
  address_id TEXT REFERENCES server_addresses(id) ON DELETE CASCADE,
  host_ascii TEXT NOT NULL COLLATE NOCASE,
  port INTEGER NOT NULL CHECK (port BETWEEN 1 AND 65535),
  display_address TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  verified_at INTEGER
);

CREATE TABLE server_verification_attempts (
  id TEXT PRIMARY KEY,
  server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);

CREATE TABLE server_feed_hidden (
  server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  image_id TEXT NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  hidden_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (server_id, image_id)
);

CREATE TABLE server_invitations (
  id TEXT PRIMARY KEY,
  server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  email TEXT NOT NULL COLLATE NOCASE,
  token_hash TEXT NOT NULL UNIQUE,
  invited_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  accepted_at INTEGER
);

CREATE TABLE server_custom_domains (
  id TEXT PRIMARY KEY,
  server_id TEXT NOT NULL UNIQUE REFERENCES servers(id) ON DELETE CASCADE,
  hostname_ascii TEXT NOT NULL UNIQUE COLLATE NOCASE,
  cloudflare_hostname_id TEXT UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'grace', 'error', 'deprovisioned')),
  hostname_status TEXT,
  ssl_status TEXT,
  validation_records_json TEXT,
  last_error TEXT,
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  grace_ends_at INTEGER
);

ALTER TABLE images ADD COLUMN discoverability TEXT NOT NULL DEFAULT 'hidden'
  CHECK (discoverability IN ('hidden', 'public'));
ALTER TABLE images ADD COLUMN server_id TEXT REFERENCES servers(id);
ALTER TABLE images ADD COLUMN server_host_ascii TEXT;
ALTER TABLE images ADD COLUMN server_port INTEGER;

ALTER TABLE albums ADD COLUMN discoverability TEXT NOT NULL DEFAULT 'hidden'
  CHECK (discoverability IN ('hidden', 'public'));
ALTER TABLE albums ADD COLUMN server_id TEXT REFERENCES servers(id);

CREATE INDEX servers_owner_idx ON servers(owner_user_id, updated_at);
CREATE INDEX server_addresses_server_idx ON server_addresses(server_id, is_primary);
CREATE INDEX server_addresses_pending_idx ON server_addresses(pending_server_id);
CREATE INDEX server_members_user_idx ON server_members(user_id, role);
CREATE INDEX server_challenges_lookup_idx ON server_verification_challenges(server_id, user_id, expires_at);
CREATE INDEX server_attempts_rate_idx ON server_verification_attempts(user_id, server_id, created_at);
CREATE INDEX server_domains_status_idx ON server_custom_domains(status, updated_at);
CREATE INDEX images_server_public_idx ON images(server_id, discoverability, created_at);
CREATE INDEX images_server_address_idx ON images(server_host_ascii, server_port, discoverability);
CREATE INDEX albums_server_public_idx ON albums(server_id, discoverability, updated_at);
