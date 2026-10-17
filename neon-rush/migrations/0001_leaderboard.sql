-- NEON RUSH leaderboard schema (Cloudflare D1 / SQLite).
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  submitted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS runs_player ON runs (player_id, started_at);

-- One row per player per period: 'all' or 'd:YYYY-MM-DD' (UTC day).
CREATE TABLE IF NOT EXISTS scores (
  player_id TEXT NOT NULL,
  period TEXT NOT NULL,
  name TEXT NOT NULL,
  score INTEGER NOT NULL,
  meters INTEGER NOT NULL,
  skin TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (player_id, period)
);
CREATE INDEX IF NOT EXISTS scores_rank ON scores (period, score DESC);
