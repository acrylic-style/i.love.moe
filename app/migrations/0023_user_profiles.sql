CREATE TABLE user_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL
    CHECK (length(display_name) BETWEEN 1 AND 100),
  bio TEXT
    CHECK (bio IS NULL OR length(bio) <= 2000),
  primary_minecraft_uuid TEXT NOT NULL,
  published_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id, primary_minecraft_uuid)
    REFERENCES user_minecraft_profiles(user_id, minecraft_uuid)
);

CREATE TABLE user_profile_identifiers (
  identifier TEXT PRIMARY KEY COLLATE NOCASE,
  user_id TEXT NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  is_current INTEGER NOT NULL DEFAULT 1
    CHECK (is_current IN (0, 1)),
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX user_profile_current_identifier_idx
  ON user_profile_identifiers(user_id) WHERE is_current = 1;

CREATE INDEX user_profiles_published_idx
  ON user_profiles(published_at, updated_at);
