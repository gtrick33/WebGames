-- The Ring's ranked ladder, kept by the server (server/ring.ts, functions/api/sigilfall/ring.ts). A signed-in player's
-- rating in each format lives here, and only the server moves it: from the reports of every player in a match against
-- people, or from a ticket it wrote for a match against the computer (src/games/sigilfall/arena/ranked.ts has the
-- rules, and what they do against win trading).

-- One row per player and format: the rating shown, the hidden matchmaking rating, the best reached, and the season
-- they were last counted in (a new season brings both ratings halfway back toward 1000 as they are next read).
CREATE TABLE ring_standings (
  user_id TEXT NOT NULL,
  format INTEGER NOT NULL,
  season INTEGER NOT NULL,
  rating INTEGER NOT NULL,
  mmr INTEGER NOT NULL,
  best INTEGER NOT NULL,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, format)
);

-- A rated match: against people (`r-<room>-<run>-<seed>`, made from the room's own roster when it began) or against
-- the computer (`b-<random>`, a ticket with the computer's rating drawn here). `result` once settled: 't0', 't1',
-- 'draw' or 'void'; `note` says why a match counted for nothing ('disputed', 'short', 'dupe'). `settle_key` is the
-- settling that claimed it: two players reporting at once start two, and only the one whose key is kept writes.
CREATE TABLE ring_matches (
  id TEXT PRIMARY KEY,
  format INTEGER NOT NULL,
  kind TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  rival INTEGER NOT NULL DEFAULT 0,
  settled_at INTEGER,
  settle_key TEXT,
  result TEXT,
  note TEXT
);
CREATE INDEX ring_matches_open ON ring_matches (settled_at, created_at);

-- Who played in it: their side, a hash of the network they played from (never the address itself), whether they came
-- as a party, their ratings as it began, their own report of it, and what it did to them once settled.
CREATE TABLE ring_match_players (
  match_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  team INTEGER NOT NULL,
  net TEXT NOT NULL DEFAULT '',
  party INTEGER NOT NULL DEFAULT 0,
  rating INTEGER NOT NULL,
  mmr INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  report TEXT,
  reported_at INTEGER,
  change INTEGER,
  note TEXT,
  PRIMARY KEY (match_id, user_id)
);
CREATE INDEX ring_match_players_user ON ring_match_players (user_id, created_at);

-- The Ring's rankings came from each player's own device until now, where anyone could write any number: they start
-- again from the server's ladder.
DELETE FROM sigilfall_ranks WHERE board = 'ring' OR board LIKE 'ring:%';
