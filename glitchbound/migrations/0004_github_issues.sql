-- Bug reports and in-game crashes are mirrored to the GitHub issues board (label "bug").

-- The GitHub issue number a bug report was filed as (NULL = not filed: no token, or over the daily cap).
ALTER TABLE bug_reports ADD COLUMN github_issue INTEGER;

-- One row per distinct crash (fingerprint = kind + game + normalized message), so a crash that hits
-- many players becomes one issue with a running count instead of hundreds of issues.
CREATE TABLE IF NOT EXISTS error_issues (
  fp TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  game TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  issue INTEGER,
  count INTEGER NOT NULL DEFAULT 1,
  first_ts INTEGER NOT NULL,
  last_ts INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS error_issues_first ON error_issues (first_ts);
