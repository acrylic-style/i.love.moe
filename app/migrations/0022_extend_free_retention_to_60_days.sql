UPDATE images
SET expires_at = MAX(expires_at, created_at + 60 * 24 * 60 * 60 * 1000)
WHERE storage_tier = 'free'
  AND deleted_at IS NULL
  AND expires_at > unixepoch('now') * 1000;
