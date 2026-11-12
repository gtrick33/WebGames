-- Sigilfall's shop prices come down (the owner's call, 2026-11-12): low enough that a new player tries one.
-- The Gloamknight Pack 9.99 -> 4.99; mounts 2.99-5.99 -> 1.49-2.99; helms 1.99 -> 0.99; armor 2.49 -> 1.49.
--
-- The code holds the new prices (src/catalog/shop.ts), but a list saved in Admin > Ads & shop holds its own copy
-- of every price and that copy wins. So where a saved price is still exactly the old default, nobody chose it, and
-- it moves to the new one here. A price an admin set by hand (any other number) is left alone, as are the items
-- admins made themselves, and the list keeps its order. With no saved list there is nothing to do.
WITH lower(id, was, now) AS (
  VALUES
    ('sigilfall-gloamknight', 999, 499),
    ('sigilfall-crownforged-wyrm', 599, 299),
    ('sigilfall-galecrest-drake', 399, 199),
    ('sigilfall-runetusk-boar', 349, 199),
    ('sigilfall-cinderhorn-hart', 299, 149),
    ('sigilfall-moonglass-hart', 299, 149),
    ('sigilfall-gloamwing-drake', 599, 299),
    ('sigilfall-crownforged-helm', 199, 99),
    ('sigilfall-celestine-crown', 199, 99),
    ('sigilfall-gloamquill-cowl', 199, 99),
    ('sigilfall-duskborn-helm', 199, 99),
    ('sigilfall-crownforged-plate', 249, 149),
    ('sigilfall-celestine-mantle', 249, 149),
    ('sigilfall-gloamquill-mantle', 249, 149),
    ('sigilfall-duskborn-plate', 249, 149)
)
UPDATE site_settings
SET value = (
  SELECT json_group_array(json(CASE WHEN l.now IS NULL THEN j.value ELSE json_set(j.value, '$.cents', l.now) END))
  FROM (SELECT key, value FROM json_each(site_settings.value) ORDER BY key) AS j
  LEFT JOIN lower AS l ON l.id = json_extract(j.value, '$.id') AND l.was = json_extract(j.value, '$.cents')
)
WHERE key = 'shop_items' AND json_valid(value) AND json_type(value) = 'array';
