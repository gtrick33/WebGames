-- The QA role: testers invited by an admin by email (admins themselves stay in ADMIN_EMAILS),
-- player bans, coins granted to a player for one game, emails staff send to a player, and the
-- legal audit trail of everything a QA tester does.

-- One row per invited address. status: invited (email sent) | active | blocked.
CREATE TABLE IF NOT EXISTS staff (
  email TEXT PRIMARY KEY,
  role TEXT NOT NULL DEFAULT 'qa',
  status TEXT NOT NULL,
  -- The account that accepted the invitation (signed in with this address).
  user_id TEXT,
  -- Only a hash of the invitation token is stored; cleared once it is accepted.
  invite_hash TEXT,
  invite_expires INTEGER,
  invited_by TEXT NOT NULL,
  invited_at INTEGER NOT NULL,
  accepted_at INTEGER,
  updated_by TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS staff_user ON staff (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS staff_invite ON staff (invite_hash);

-- A banned player is signed out everywhere, cannot sign in and is left off the leaderboards.
ALTER TABLE users ADD COLUMN banned_at INTEGER;
ALTER TABLE users ADD COLUMN ban_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN banned_by TEXT NOT NULL DEFAULT '';

-- Coins for one game's wallet; the game collects them the next time the player opens it signed in.
CREATE TABLE IF NOT EXISTS coin_grants (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  game TEXT NOT NULL,
  amount INTEGER NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  granted_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  claimed_at INTEGER
);
CREATE INDEX IF NOT EXISTS coin_grants_pending ON coin_grants (user_id, game, claimed_at);

-- Emails a QA tester or an admin sent to one player from the site's address.
CREATE TABLE IF NOT EXISTS player_emails (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  sent_by TEXT NOT NULL,
  sent_at INTEGER NOT NULL,
  ok INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS player_emails_user ON player_emails (user_id, sent_at);

-- Everything a QA tester does, for legal purposes: every API request they make (kind 'request'),
-- every QA tool they use (kind 'action') and their sign-ins (kind 'auth'). Admins are not logged.
-- Append-only: rows can never be changed or deleted (the triggers below refuse it).
CREATE TABLE IF NOT EXISTS qa_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  actor_id TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  kind TEXT NOT NULL,
  action TEXT NOT NULL,
  target_id TEXT,
  target_email TEXT,
  -- JSON: what was asked for and what happened.
  detail TEXT NOT NULL DEFAULT '{}',
  status INTEGER,
  ip TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS qa_audit_ts ON qa_audit (ts);
CREATE INDEX IF NOT EXISTS qa_audit_actor ON qa_audit (actor_email, ts);
CREATE INDEX IF NOT EXISTS qa_audit_target ON qa_audit (target_id, ts);
CREATE TRIGGER IF NOT EXISTS qa_audit_no_update BEFORE UPDATE ON qa_audit BEGIN SELECT RAISE(ABORT, 'qa_audit is append-only'); END;
CREATE TRIGGER IF NOT EXISTS qa_audit_no_delete BEFORE DELETE ON qa_audit BEGIN SELECT RAISE(ABORT, 'qa_audit is append-only'); END;
