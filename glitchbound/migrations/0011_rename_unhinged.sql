-- The party card game "Unhinged" is now "Crass Act" (slug crass-act): the old name is another company's
-- registered trademark for card games. Moves everything stored under the old slug to the new one.
-- OR IGNORE: a row that would collide with an existing crass-act row keeps the old slug (nothing is lost).

UPDATE OR IGNORE favorites SET game = 'crass-act' WHERE game = 'unhinged';
UPDATE OR IGNORE bests SET game = 'crass-act' WHERE game = 'unhinged';
UPDATE runs SET game = 'crass-act' WHERE game = 'unhinged';
UPDATE dailies SET game = 'crass-act' WHERE game = 'unhinged';
UPDATE events SET game = 'crass-act' WHERE game = 'unhinged';
UPDATE errors SET game = 'crass-act' WHERE game = 'unhinged';
UPDATE announcements SET game = 'crass-act' WHERE game = 'unhinged';
UPDATE feedback SET game = 'crass-act' WHERE game = 'unhinged';
UPDATE bug_reports SET game = 'crass-act' WHERE game = 'unhinged';
UPDATE OR IGNORE error_issues SET game = 'crass-act' WHERE game = 'unhinged';
UPDATE challenges SET game = 'crass-act' WHERE game = 'unhinged';
UPDATE OR IGNORE discord_instances SET game = 'crass-act' WHERE game = 'unhinged';
UPDATE coin_grants SET game = 'crass-act' WHERE game = 'unhinged';

-- Admin settings: the game's own row loses its old text overrides (they named the old game).
UPDATE OR IGNORE game_settings
  SET slug = 'crass-act', data = json_remove(data, '$.title', '$.tagline', '$.description')
  WHERE slug = 'unhinged';
UPDATE daily_picks SET slug = 'crass-act' WHERE slug = 'unhinged';

-- Home layout, Party Mode settings and the site notice keep the game under its new id and name.
UPDATE site_settings
  SET value = replace(replace(replace(value, '/games/unhinged', '/games/crass-act'), '"unhinged"', '"crass-act"'), 'Unhinged', 'Crass Act')
  WHERE value LIKE '%nhinged%';

-- Shared links that pointed at the old page.
UPDATE shares
  SET path = replace(path, '/games/unhinged', '/games/crass-act'),
      image = replace(image, '/games/unhinged', '/games/crass-act'),
      title = replace(title, 'Unhinged', 'Crass Act'),
      description = replace(description, 'Unhinged', 'Crass Act')
  WHERE path LIKE '/games/unhinged%' OR image LIKE '/games/unhinged%' OR title LIKE '%Unhinged%';
