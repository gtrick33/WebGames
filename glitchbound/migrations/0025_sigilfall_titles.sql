-- Sigilfall titles an admin gives a member (Admin › Sigilfall, and Admin › Ads & shop): the words, the light they wear
-- (src/catalog/titleFx.ts) and whether they read before the name ("Blooded Ash") or after it ("Ash the Kingslayer").
-- Account-wide: any of the member's heroes can wear one. Taking one back keeps the row, with when, for the record.
CREATE TABLE IF NOT EXISTS sigilfall_titles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  fx TEXT NOT NULL,
  -- 1: before the name, 0: after it
  before_name INTEGER NOT NULL DEFAULT 0,
  -- the admin who gave it
  given_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  revoked_at INTEGER
);
CREATE INDEX IF NOT EXISTS sigilfall_titles_user ON sigilfall_titles (user_id, revoked_at);

-- What the admin's lists read by: the latest sales first (one page at a time, however many there are), and the members
-- seen last first (the player picker, before anything is typed).
CREATE INDEX IF NOT EXISTS purchases_at ON purchases (COALESCE(paid_at, created_at));
CREATE INDEX IF NOT EXISTS users_last_seen ON users (last_seen);
