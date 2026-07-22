ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;
CREATE UNIQUE INDEX users_stripe_customer_idx ON users(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

ALTER TABLE images ADD COLUMN storage_tier TEXT NOT NULL DEFAULT 'free'
  CHECK (storage_tier IN ('free', 'plus'));

CREATE TABLE subscriptions (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  stripe_price_id TEXT NOT NULL,
  status TEXT NOT NULL,
  current_period_end INTEGER NOT NULL,
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0 CHECK (cancel_at_period_end IN (0, 1)),
  grace_until INTEGER,
  last_event_created INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE stripe_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  event_created INTEGER NOT NULL,
  processed_at INTEGER NOT NULL
);

CREATE TABLE retention_jobs (
  image_id TEXT PRIMARY KEY REFERENCES images(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_key TEXT NOT NULL,
  target_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'complete', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX subscriptions_status_idx ON subscriptions(status, current_period_end);
CREATE INDEX retention_jobs_status_updated_idx ON retention_jobs(status, updated_at);
