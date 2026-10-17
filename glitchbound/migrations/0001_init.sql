-- GlitchBound accounts, rounds, leaderboards, quests, first-party analytics and email list (D1 / SQLite).
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  google_sub TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  avatar TEXT NOT NULL DEFAULT '',
  nickname TEXT NOT NULL,
  xp INTEGER NOT NULL DEFAULT 0,
  notify INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id);

CREATE TABLE IF NOT EXISTS favorites (
  user_id TEXT NOT NULL,
  game TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, game)
);

-- One row per round played by a signed-in player. status: open | ok | rejected
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  game TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  score INTEGER,
  stats TEXT,
  day TEXT,
  new_best INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open'
);
CREATE INDEX IF NOT EXISTS runs_user_day ON runs (user_id, day);
CREATE INDEX IF NOT EXISTS runs_game_time ON runs (game, status, ended_at);

CREATE TABLE IF NOT EXISTS bests (
  user_id TEXT NOT NULL,
  game TEXT NOT NULL,
  score INTEGER NOT NULL,
  stats TEXT NOT NULL DEFAULT '{}',
  at INTEGER NOT NULL,
  PRIMARY KEY (user_id, game)
);
CREATE INDEX IF NOT EXISTS bests_rank ON bests (game, score DESC);

CREATE TABLE IF NOT EXISTS dailies (
  user_id TEXT NOT NULL,
  day TEXT NOT NULL,
  game TEXT NOT NULL,
  best INTEGER NOT NULL DEFAULT 0,
  done INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

CREATE TABLE IF NOT EXISTS quest_claims (
  user_id TEXT NOT NULL,
  day TEXT NOT NULL,
  quest_id TEXT NOT NULL,
  xp INTEGER NOT NULL,
  at INTEGER NOT NULL,
  PRIMARY KEY (user_id, day, quest_id)
);

-- Anonymous product events. visitor = daily-rotating hash; no IPs, no cookies.
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  day TEXT NOT NULL,
  name TEXT NOT NULL,
  game TEXT NOT NULL DEFAULT '',
  visitor TEXT NOT NULL,
  user_id TEXT,
  props TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS events_day ON events (day, name);
CREATE INDEX IF NOT EXISTS events_game ON events (game, name, day);

CREATE TABLE IF NOT EXISTS errors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  kind TEXT NOT NULL,
  game TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  path TEXT NOT NULL DEFAULT '',
  browser TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS errors_ts ON errors (ts);

-- status: pending | confirmed | unsubscribed
CREATE TABLE IF NOT EXISTS subscribers (
  email TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  user_id TEXT,
  created_at INTEGER NOT NULL,
  confirmed_at INTEGER
);

CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game TEXT NOT NULL,
  subject TEXT NOT NULL,
  sent_at INTEGER NOT NULL,
  recipients INTEGER NOT NULL,
  sent_by TEXT NOT NULL
);
