-- Friends see who is playing right now (the friends list inside Sigilfall, and the site's Friends page).
-- `online_at` is when a signed-in player's open tab last said it was there (it asks for invitations every 45
-- seconds; Sigilfall every 20), written at most once a minute. `online_in` is the game they said it from, or ''
-- for the site. Only friends are ever told, and only as "online" or not: the time itself never leaves the server.
ALTER TABLE users ADD COLUMN online_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN online_in TEXT NOT NULL DEFAULT '';
