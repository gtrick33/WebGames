-- Admin catalog controls: per-game settings, hand-picked daily challenges, a site notice and an
-- audit log of admin changes. Games themselves still live in the code (src/catalog/games.ts);
-- these rows only override how they are shown.

-- One row per game an admin has changed (missing row = defaults).
CREATE TABLE IF NOT EXISTS game_settings (
  slug TEXT PRIMARY KEY,
  -- JSON object with the overridden fields (see src/catalog/settings.ts).
  data TEXT NOT NULL DEFAULT '{}',
  updated_at INTEGER NOT NULL,
  updated_by TEXT NOT NULL DEFAULT ''
);

-- "Today's challenge" chosen by an admin for a date (missing row = automatic rotation).
CREATE TABLE IF NOT EXISTS daily_picks (
  day TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  -- Index into the game's daily templates, or NULL for the automatic one.
  template INTEGER,
  -- Target to reach, or NULL for the template's automatic target.
  target REAL,
  updated_at INTEGER NOT NULL,
  updated_by TEXT NOT NULL DEFAULT ''
);

-- Small key/value settings for the whole site (e.g. key 'notice').
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  updated_by TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS admin_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  admin TEXT NOT NULL,
  action TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS admin_log_ts ON admin_log (ts);
