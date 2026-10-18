-- Friends' challenges: up to 6 players play the same seed, each when it suits them, over one or
-- more rounds (a rematch starts the next round with a new seed).
CREATE TABLE IF NOT EXISTS challenges (
  id TEXT PRIMARY KEY,
  game TEXT NOT NULL,
  -- 'daily' (today's content of the game) or 'fresh' (a new random seed).
  mode TEXT NOT NULL DEFAULT 'fresh',
  day TEXT NOT NULL DEFAULT '',
  seed INTEGER NOT NULL,
  round INTEGER NOT NULL DEFAULT 1,
  options TEXT NOT NULL DEFAULT '{}',
  host TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS challenges_updated ON challenges (updated_at);

-- player: 'u:<user id>' for members, 'g:<device key>' for guests.
CREATE TABLE IF NOT EXISTS challenge_players (
  challenge_id TEXT NOT NULL,
  player TEXT NOT NULL,
  name TEXT NOT NULL,
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (challenge_id, player)
);
CREATE INDEX IF NOT EXISTS challenge_players_player ON challenge_players (player, joined_at);

-- The first finished score per player and round counts (no retries).
CREATE TABLE IF NOT EXISTS challenge_scores (
  challenge_id TEXT NOT NULL,
  round INTEGER NOT NULL,
  player TEXT NOT NULL,
  score INTEGER NOT NULL,
  stats TEXT NOT NULL DEFAULT '{}',
  -- Optional replay (e.g. a Mini Racer ghost) for the others to race against.
  replay TEXT NOT NULL DEFAULT '',
  at INTEGER NOT NULL,
  PRIMARY KEY (challenge_id, round, player)
);
