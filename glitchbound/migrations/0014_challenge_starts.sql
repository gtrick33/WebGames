-- A challenge round counts from when a player started it (POST /api/challenges/<id>/start), so the
-- score that follows can be checked against the time played, and a reload doesn't restart the clock.
CREATE TABLE IF NOT EXISTS challenge_starts (
  challenge_id TEXT NOT NULL,
  round INTEGER NOT NULL,
  player TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  PRIMARY KEY (challenge_id, round, player)
);
-- When the current round opened (a rematch), for scores sent without a start.
ALTER TABLE challenges ADD COLUMN round_at INTEGER;
