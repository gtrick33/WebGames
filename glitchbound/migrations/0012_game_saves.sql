-- Signed-in players' saves: the arcade save and each game's own save (today's dailies, a half-played
-- daily, bests), so they follow the account to every device and survive a browser clearing its storage.
-- One row per player and save, replaced on every sync (never appended). Rows nobody touched for 120 days
-- are deleted (functions/api/saves.ts), and the next sync from a device that still has the save writes it back.
CREATE TABLE IF NOT EXISTS game_saves (
  user_id TEXT NOT NULL,
  key TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, key)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS game_saves_updated ON game_saves (updated_at);
