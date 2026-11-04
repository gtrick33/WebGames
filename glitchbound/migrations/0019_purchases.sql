-- One-time purchases (src/catalog/shop.ts, server/shop.ts). Nothing writes here until the shop is opened in Admin › Ads & shop.
-- A row is made when a member goes to checkout (pending), and the payment provider's webhook marks it paid or refunded:
-- the browser never decides what someone owns. `user_id` goes null when the account is deleted: the record stays for the
-- accounts, no longer linked to anyone. `agreed_at` and `terms` keep the buyer's agreement to get the item right away.
CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  product TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  provider_ref TEXT,
  amount INTEGER,
  currency TEXT,
  agreed_at INTEGER NOT NULL,
  terms TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  paid_at INTEGER,
  refunded_at INTEGER
);
CREATE INDEX IF NOT EXISTS purchases_user ON purchases (user_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS purchases_ref ON purchases (provider_ref);
