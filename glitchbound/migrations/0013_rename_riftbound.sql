-- The action RPG "Riftbound" is now "Sigilfall" (slug sigilfall, page /sigilfall): Riftbound is also the
-- name of another company's trading card game. Moves everything stored under the old slug to the new one.
-- OR IGNORE: a row that would collide with an existing sigilfall row keeps the old slug (nothing is lost).

UPDATE OR IGNORE favorites SET game = 'sigilfall' WHERE game = 'riftbound';
UPDATE OR IGNORE bests SET game = 'sigilfall' WHERE game = 'riftbound';
UPDATE runs SET game = 'sigilfall' WHERE game = 'riftbound';
UPDATE dailies SET game = 'sigilfall' WHERE game = 'riftbound';
UPDATE events SET game = 'sigilfall' WHERE game = 'riftbound';
UPDATE errors SET game = 'sigilfall' WHERE game = 'riftbound';
UPDATE announcements SET game = 'sigilfall' WHERE game = 'riftbound';
UPDATE feedback SET game = 'sigilfall' WHERE game = 'riftbound';
UPDATE bug_reports SET game = 'sigilfall' WHERE game = 'riftbound';
UPDATE OR IGNORE error_issues SET game = 'sigilfall' WHERE game = 'riftbound';
UPDATE challenges SET game = 'sigilfall' WHERE game = 'riftbound';
UPDATE OR IGNORE discord_instances SET game = 'sigilfall' WHERE game = 'riftbound';
UPDATE coin_grants SET game = 'sigilfall' WHERE game = 'riftbound';

-- Admin settings (whether the section is on, above all): the row moves; text overrides named the old game.
UPDATE OR IGNORE game_settings
  SET slug = 'sigilfall', data = json_remove(data, '$.title', '$.tagline', '$.description')
  WHERE slug = 'riftbound';
UPDATE daily_picks SET slug = 'sigilfall' WHERE slug = 'riftbound';

-- Home layout, Party Mode settings and the site notice keep the game under its new id, address and name.
UPDATE site_settings
  SET value = replace(replace(replace(replace(value, '/games/riftbound', '/games/sigilfall'), '/riftbound', '/sigilfall'), '"riftbound"', '"sigilfall"'), 'Riftbound', 'Sigilfall')
  WHERE value LIKE '%iftbound%';

-- Shared links: the page is /sigilfall, the art lives in /games/sigilfall.
UPDATE shares
  SET path = replace(replace(path, '/games/riftbound', '/sigilfall'), '/riftbound', '/sigilfall'),
      image = replace(image, '/games/riftbound', '/games/sigilfall'),
      title = replace(title, 'Riftbound', 'Sigilfall'),
      description = replace(description, 'Riftbound', 'Sigilfall')
  WHERE path LIKE '/games/riftbound%' OR path LIKE '/riftbound%' OR image LIKE '/games/riftbound%' OR title LIKE '%Riftbound%';

-- Signed-in players' heroes: their cloud copy moves to the new save key.
UPDATE OR IGNORE game_saves SET key = 'glitchbound.sigilfall' WHERE key = 'glitchbound.riftbound';
