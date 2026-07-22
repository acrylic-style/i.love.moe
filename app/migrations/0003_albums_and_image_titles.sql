ALTER TABLE images ADD COLUMN title TEXT CHECK (title IS NULL OR length(title) BETWEEN 1 AND 100);

CREATE TABLE albums (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 100),
  description TEXT CHECK (description IS NULL OR length(description) BETWEEN 1 AND 1000),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);

CREATE TABLE album_images (
  album_id TEXT NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  image_id TEXT NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position >= 0),
  added_at INTEGER NOT NULL,
  PRIMARY KEY (album_id, image_id)
);

CREATE INDEX albums_owner_updated_idx ON albums(owner_user_id, updated_at);
CREATE INDEX album_images_album_position_idx ON album_images(album_id, position);
CREATE INDEX album_images_image_idx ON album_images(image_id);
