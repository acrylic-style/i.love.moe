ALTER TABLE images ADD COLUMN server_address TEXT CHECK (server_address IS NULL OR length(server_address) BETWEEN 1 AND 255);
ALTER TABLE images ADD COLUMN server_name TEXT CHECK (server_name IS NULL OR length(server_name) BETWEEN 1 AND 100);
