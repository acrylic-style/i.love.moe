ALTER TABLE images ADD COLUMN favorited_at INTEGER;

CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 30),
  normalized_name TEXT NOT NULL,
  color TEXT NOT NULL CHECK (color IN ('gray', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (owner_user_id, normalized_name)
);

CREATE TABLE image_tags (
  image_id TEXT NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (image_id, tag_id)
);

CREATE INDEX images_owner_favorite_idx
  ON images(owner_user_id, favorited_at, created_at);
CREATE INDEX tags_owner_name_idx
  ON tags(owner_user_id, normalized_name);
CREATE INDEX image_tags_tag_image_idx
  ON image_tags(tag_id, image_id);
