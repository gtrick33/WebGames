-- Player feedback (star ratings with an optional comment) and bug reports.
CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  stars INTEGER NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  -- The game the player was asked about ('' = the arcade as a whole).
  game TEXT NOT NULL DEFAULT '',
  -- What they would like more of (chip choice), optional.
  wish TEXT NOT NULL DEFAULT '',
  visitor TEXT NOT NULL,
  user_id TEXT,
  browser TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS feedback_ts ON feedback (ts);
CREATE INDEX IF NOT EXISTS feedback_game ON feedback (game, ts);

-- status: open | fixed | wontfix
CREATE TABLE IF NOT EXISTS bug_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  game TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'bug',
  severity TEXT NOT NULL DEFAULT 'annoying',
  device TEXT NOT NULL DEFAULT '',
  page TEXT NOT NULL DEFAULT '',
  contact TEXT NOT NULL DEFAULT '',
  visitor TEXT NOT NULL,
  user_id TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  admin_note TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS bug_reports_status ON bug_reports (status, ts);
CREATE INDEX IF NOT EXISTS bug_reports_user ON bug_reports (user_id, ts);
