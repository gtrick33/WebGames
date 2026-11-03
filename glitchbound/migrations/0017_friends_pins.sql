-- Friends (added by a code or link, never by searching), blocks, invites into a game, and Trophy Shelf pins.

-- The code a player shares to be added. Made the first time it is asked for; a new one retires the old.
ALTER TABLE users ADD COLUMN friend_code TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_friend_code ON users (friend_code) WHERE friend_code IS NOT NULL;

-- One row each way per friendship.
CREATE TABLE IF NOT EXISTS friends (
  user_id TEXT NOT NULL,
  friend_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, friend_id)
);
CREATE INDEX IF NOT EXISTS friends_friend ON friends (friend_id);

CREATE TABLE IF NOT EXISTS blocks (
  user_id TEXT NOT NULL,
  blocked_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, blocked_id)
);
CREATE INDEX IF NOT EXISTS blocks_blocked ON blocks (blocked_id);

-- "Join me": a friend's invitation into a game's room. It carries no words of the sender's, only the room's code.
CREATE TABLE IF NOT EXISTS friend_invites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  game TEXT NOT NULL,
  code TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS friend_invites_to ON friend_invites (to_id, expires_at);
CREATE INDEX IF NOT EXISTS friend_invites_from ON friend_invites (from_id, to_id, game);

-- A pin, once earned, is kept for good.
CREATE TABLE IF NOT EXISTS pins (
  user_id TEXT NOT NULL,
  pin TEXT NOT NULL,
  at INTEGER NOT NULL,
  PRIMARY KEY (user_id, pin)
);
CREATE INDEX IF NOT EXISTS pins_pin ON pins (pin);
