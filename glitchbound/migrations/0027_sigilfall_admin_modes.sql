-- Admin › Sigilfall: the Campaign, the Ring and the Vigil, each looked after from the admin (server/sigilfallAdmin.ts).

-- What a player's own game says of a rated match it played (a JSON object: the class they played, the match's length
-- in seconds, and their damage, healing, crowd control, interrupts, combos and supers). Only ever shown to admins: a
-- match is settled by the reports alone, as before.
ALTER TABLE ring_match_players ADD COLUMN stats TEXT;

-- A player an admin took off one of Sigilfall's boards and keeps off it: what their device sends for that board is
-- left out (functions/api/sigilfall/ranks.ts) until an admin lets them back on.
CREATE TABLE sigilfall_rank_holds (
  user_id TEXT NOT NULL,
  board TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, board)
);
