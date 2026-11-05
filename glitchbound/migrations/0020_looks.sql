-- The border and banner a member chose to wear (src/catalog/looks.ts). Empty means none. What shows is checked against
-- their paid purchases each time (server/looks.ts), so a refund takes a look off without touching these.
ALTER TABLE users ADD COLUMN look_border TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN look_banner TEXT NOT NULL DEFAULT '';
