-- A challenge round is one attempt: the first start (POST /api/challenges/<id>/start) names it with a token the
-- page keeps (a reload resumes the same attempt). A start or score under another token is a replay and is refused.
-- NULL for starts recorded before this (and by pages that don't send one yet): those rounds keep the old rules.
ALTER TABLE challenge_starts ADD COLUMN attempt TEXT;
