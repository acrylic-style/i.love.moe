CREATE TABLE server_favorites (
  server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  voter_ip_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (server_id, voter_ip_hash)
);

CREATE INDEX server_favorites_count_idx
  ON server_favorites(server_id, created_at);
