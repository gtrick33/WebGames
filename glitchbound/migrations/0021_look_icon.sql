-- The profile icon a member chose to wear in place of their picture (src/catalog/looks.ts). Empty means none. Like the
-- border and banner, it shows only while its purchase is paid (server/looks.ts).
ALTER TABLE users ADD COLUMN look_icon TEXT NOT NULL DEFAULT '';
