-- The Discord Activity (docs/discord-activity.md): which challenge or Unhinged room each Discord call
-- (an Activity instance: one voice channel or DM call) shares, so everyone in the call plays together.
CREATE TABLE IF NOT EXISTS discord_instances (
  instance_id TEXT NOT NULL,
  -- 'wait-what' (ref: a challenge id) or 'unhinged' (ref: a room code).
  game TEXT NOT NULL,
  ref TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (instance_id, game)
);
CREATE INDEX IF NOT EXISTS discord_instances_updated ON discord_instances (updated_at);
