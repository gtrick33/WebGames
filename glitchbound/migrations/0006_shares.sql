-- Short share links (/s/<code>): where they lead and the title/description chat apps show in the
-- link preview. Rows expire after 180 days.
CREATE TABLE IF NOT EXISTS shares (
  code TEXT PRIMARY KEY,
  path TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image TEXT NOT NULL DEFAULT '',
  visitor TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS shares_created ON shares (created_at);
CREATE INDEX IF NOT EXISTS shares_visitor ON shares (visitor, created_at);
