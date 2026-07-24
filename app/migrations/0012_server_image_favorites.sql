CREATE TABLE server_image_favorites (
  image_id TEXT NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  voter_ip_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (image_id, voter_ip_hash)
);

CREATE TABLE server_favorite_attempts (
  id TEXT PRIMARY KEY,
  voter_ip_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX server_image_favorites_count_idx
  ON server_image_favorites(image_id, created_at);

CREATE INDEX server_favorite_attempts_rate_idx
  ON server_favorite_attempts(voter_ip_hash, created_at);
