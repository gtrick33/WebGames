-- Sigilfall's game masters (Admin › Sigilfall).
-- An order: what an admin asked the game to do to a hero. The player's own game carries it out and reports back.
CREATE TABLE IF NOT EXISTS sigilfall_orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  -- the hero's slot and when it was made; -1 and 0 for an order to the player, not a hero
  slot INTEGER NOT NULL,
  created INTEGER NOT NULL,
  hero_name TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL,
  payload TEXT NOT NULL,
  summary TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  -- when the game carried it out, and how: '' for done, otherwise why it couldn't be
  applied_at INTEGER,
  result TEXT NOT NULL DEFAULT '',
  cancelled_at INTEGER
);
CREATE INDEX IF NOT EXISTS sigilfall_orders_waiting ON sigilfall_orders (user_id, applied_at, cancelled_at);

-- A hero's last copy when it left the save (deleted by the player), so a game master can bring it back. Kept 120 days.
CREATE TABLE IF NOT EXISTS sigilfall_graves (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created INTEGER NOT NULL,
  name TEXT NOT NULL,
  cls TEXT NOT NULL,
  level INTEGER NOT NULL,
  data TEXT NOT NULL,
  deleted_at INTEGER NOT NULL,
  restored_at INTEGER,
  UNIQUE (user_id, created)
);
CREATE INDEX IF NOT EXISTS sigilfall_graves_age ON sigilfall_graves (deleted_at);

-- The player list reads one kind of save across every player.
CREATE INDEX IF NOT EXISTS game_saves_key ON game_saves (key, updated_at);
