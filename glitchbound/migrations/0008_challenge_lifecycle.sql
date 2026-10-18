-- Challenges end: the host can end one, a player can leave one, and quiet ones close on their own
-- (see CHALLENGE_LOBBY_MS / CHALLENGE_IDLE_MS in src/platform/challenge.ts).
ALTER TABLE challenges ADD COLUMN closed_at INTEGER;
ALTER TABLE challenge_players ADD COLUMN left_at INTEGER;
