ALTER TABLE images ADD COLUMN description TEXT
  CHECK (description IS NULL OR length(description) BETWEEN 1 AND 1000);
