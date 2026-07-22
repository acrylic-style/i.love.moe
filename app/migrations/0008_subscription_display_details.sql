ALTER TABLE subscriptions ADD COLUMN cancel_at INTEGER;
ALTER TABLE subscriptions ADD COLUMN price_unit_amount INTEGER;
ALTER TABLE subscriptions ADD COLUMN price_currency TEXT;
ALTER TABLE subscriptions ADD COLUMN price_interval TEXT;
ALTER TABLE subscriptions ADD COLUMN price_interval_count INTEGER;

-- Existing subscriptions use the original Plus price. Future webhook updates
-- replace these values with the actual Stripe Price attached to the subscription.
UPDATE subscriptions
SET price_unit_amount = 480,
    price_currency = 'jpy',
    price_interval = 'month',
    price_interval_count = 1
WHERE stripe_price_id IS NOT NULL;
