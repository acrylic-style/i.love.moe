ALTER TABLE images ADD COLUMN upload_source TEXT NOT NULL DEFAULT 'mod'
  CHECK (upload_source IN ('mod', 'web'));
ALTER TABLE images ADD COLUMN moderated_at INTEGER;
ALTER TABLE images ADD COLUMN moderation_model_version TEXT;

CREATE TABLE image_upload_attempts (
  id TEXT PRIMARY KEY,
  actor_key TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX image_upload_attempts_actor_idx
  ON image_upload_attempts(actor_key, created_at);

CREATE INDEX image_upload_attempts_ip_idx
  ON image_upload_attempts(ip_hash, created_at);
