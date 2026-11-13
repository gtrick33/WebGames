-- Sigilfall's rankings: one best per player and board. The boards are the game's modes (the Rift Trials' highest
-- stone, overall and by calling; a story hero's own Riftstone; the Vigil's longest night, overall and by land; the
-- Ring's best rating; the highest hero level with its Paragon level). A row is only ever raised.
CREATE TABLE sigilfall_ranks (
  user_id TEXT NOT NULL,
  board TEXT NOT NULL,
  score INTEGER NOT NULL,
  at INTEGER NOT NULL,
  PRIMARY KEY (user_id, board)
);
CREATE INDEX sigilfall_ranks_board ON sigilfall_ranks (board, score DESC, at);
