CREATE TABLE minecraft_profiles (
  uuid TEXT PRIMARY KEY,
  current_name TEXT NOT NULL,
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);

CREATE TABLE user_minecraft_profiles (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  minecraft_uuid TEXT NOT NULL REFERENCES minecraft_profiles(uuid) ON DELETE CASCADE,
  source_device_id TEXT REFERENCES devices(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'reported'
    CHECK (status IN ('reported', 'verified')),
  linked_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, minecraft_uuid)
);

CREATE INDEX user_minecraft_profiles_uuid_idx
  ON user_minecraft_profiles(minecraft_uuid);

ALTER TABLE images ADD COLUMN minecraft_uuid TEXT
  REFERENCES minecraft_profiles(uuid);
ALTER TABLE images ADD COLUMN minecraft_name TEXT
  CHECK (minecraft_name IS NULL OR length(minecraft_name) BETWEEN 1 AND 16);
ALTER TABLE images ADD COLUMN minecraft_id_public INTEGER NOT NULL DEFAULT 1
  CHECK (minecraft_id_public IN (0, 1));

CREATE INDEX images_minecraft_uuid_idx
  ON images(minecraft_uuid, created_at);
