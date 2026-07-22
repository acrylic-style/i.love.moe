CREATE TABLE device_registration_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX device_registration_attempts_ip_time_idx
  ON device_registration_attempts(ip_hash, created_at);

CREATE INDEX device_registration_attempts_time_idx
  ON device_registration_attempts(created_at);

