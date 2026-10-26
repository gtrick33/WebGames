import { after, all, during, is, not, until } from '../cond';
import { CityPlan } from '../citygen';
import type { RegionDef } from '../types';

/**
 * Emberwick, the Crown City of Aster (STORY_BIBLE.md §3, Act II): walls with gates east (the King's Road
 * to Lantern Hill), south (the refugee road) and west (the mountain road); the Regent's keep at the head of
 * the main avenue; the market square with the waystone; the training grounds and the barracks to the
 * north-west, the temple of the Sigil-wardens to the north-east; taverns and the inn to the south-west;
 * the forge, the armory and the curio shop to the south-east; houses, gardens and a pond between.
 *
 * The story changes it: the treasury, the roads office and the Lord Chancellor's house are where the
 * countermanded order leads; the Starfall Festival fills the square with lanterns and stalls; the night
 * of the attack on the Regent burns them; the city is locked down after, Crane's house sealed; in Act IV
 * the market becomes a muster ground.
 */

/** The festival: lanterns and stalls in the square, from the evening it begins to the night it ends. */
const FESTIVAL = during('festival-the-lanterns', 'festival-the-knives');
/** The night of the knives in the square. */
const KNIVES = during('festival-the-knives');
/** The morning after: broken stalls, the city locked down. */
const AFTER = all(after('festival-the-knives'), until('festival-the-champion'));
/** At war (Act IV): the market is a muster ground. */
const WAR = is('the-wall-burns', 'started');
function plan(): CityPlan {
  const c = new CityPlan(104, 82, 2207);
  c.woods(3, 6);
  // outside the walls: a meadow
  c.walls(8, 7, 95, 74);
  // the corner towers
  c.building('tower', 7, 6, 3, 3, { pave: false });
  c.building('tower', 94, 6, 3, 3, { pave: false });
  c.building('tower', 7, 73, 3, 3, { pave: false });
  c.building('tower', 94, 73, 3, 3, { pave: false });

  // the avenues: north-south from the keep to the south gate, east-west from the west wall to the east gate
  c.fill(50, 19, 53, 72, 'cobble');
  c.fill(10, 39, 93, 42, 'cobble');
  // the Crown City opens to the hero in Act II, at the end of the King's Road (STORY_BIBLE.md §3)
  c.gate('e', 41, 4, 94, 95, { to: 'ashen-barrows', label: 'East gate: the King’s Road to Lantern Hill' });
  c.gate('s', 52, 4, 73, 74, { to: 'amberfield', label: 'South gate: the refugee road to Hearthstead' });
  c.gate('w', 41, 4, 8, 9, { to: 'ironpeak', label: 'West gate: the mountain road to Kragholt' });
  c.building('tower', 93, 35, 3, 3, { pave: false });
  c.building('tower', 93, 44, 3, 3, { pave: false });
  c.building('tower', 45, 72, 3, 3, { pave: false });
  c.building('tower', 56, 72, 3, 3, { pave: false });

  // the market square, the waystone in its middle
  c.fill(40, 32, 63, 49, 'cobble');
  c.marker(51, 37, { kind: 'waystone' });
  c.marker(52, 45, { kind: 'prop', prop: 'well', solid: true });
  c.marker(51, 43, { kind: 'start' });
  for (const [x, y] of [
    [42, 34],
    [61, 34],
    [42, 47],
    [61, 47],
  ] as const)
    c.prop('lamp', x, y);
  for (const [x, y, p] of [
    [44, 46, 'crate'],
    [45, 46, 'barrel'],
    [58, 46, 'crate'],
    [59, 46, 'barrel'],
    [44, 34, 'barrel'],
    [59, 34, 'crate'],
  ] as const)
    c.prop(p, x, y);

  // the Regent's keep at the head of the avenue, its courtyard, the barracks beside it
  c.building('keep', 45, 10, 14, 8, { pave: false });
  c.fill(43, 18, 60, 22, 'cobble');
  // the Regent in her courtyard, the Lord Chancellor at her side until the night he runs
  c.npc('regent-elowen', 51, 20, not(KNIVES));
  c.npc('chancellor-crane', 54, 20, until('festival-the-knives'));
  // her companions in the city: Cael at the keep stair, Orren at the temple, Nyx where the money is
  c.npc('cael-varrow', 48, 21, after('sir-corvane'));
  c.prop('lamp', 44, 19);
  c.prop('lamp', 59, 19);
  c.building('hall', 63, 13, 7, 4, { npc: 'hale', name: 'The Barracks' });
  c.fill(64, 17, 68, 18, 'cobble');

  // the training grounds: a fenced yard of dummies, Elder Maren at its gate
  c.fill(14, 12, 34, 12, 'fence').fill(14, 28, 34, 28, 'fence').fill(14, 12, 14, 28, 'fence').fill(34, 12, 34, 28, 'fence');
  c.fill(23, 28, 25, 28, 'floor');
  c.fill(23, 29, 25, 38, 'path');
  c.marker(19, 17, { kind: 'dummy' });
  c.marker(24, 16, { kind: 'dummy' });
  c.marker(29, 18, { kind: 'dummy' });
  c.marker(30, 24, { kind: 'dummy', shooter: true });
  c.npc('guard-gate', 89, 37);

  // the temple of the Sigil-wardens
  c.building('temple', 72, 12, 8, 5, { pave: false });
  c.fill(71, 17, 80, 20, 'cobble');
  c.fill(74, 21, 76, 38, 'path');
  c.npc('ysolde', 73, 19);
  c.npc('brother-orren', 77, 19, after('sir-corvane'));

  // the treasury, where the Ninefold Watch's pay was drawn ten years ago
  c.building('hall', 83, 11, 6, 4, { name: 'The Treasury', art: 'rk:house_tall_slate' });
  c.fill(83, 15, 88, 16, 'cobble');
  c.npc('clerk-amsel', 85, 16);
  // the Lord Chancellor's house, west of the avenue; its cellar, and the catacomb stair under it
  c.building('house', 41, 24, 5, 4, { name: 'The Chancellor’s House', art: 'rk:house_tall_slate' });
  c.fill(41, 28, 45, 29, 'cobble');
  c.marker(46, 29, { kind: 'spot', id: 'crane-catacombs', name: 'The Catacomb Stair', r: 2 }, is('festival-the-catacombs', 'started'));
  c.prop('danger-sign', 42, 29, false, after('festival-the-knives'));

  // the tavern quarter: the Drunken Wyvern and the Ember Hearth
  c.fill(12, 51, 39, 52, 'cobble');
  c.building('tavern', 14, 46, 6, 4, { npc: 'gorran', name: 'The Drunken Wyvern' });
  c.building('inn', 24, 46, 6, 4, { npc: 'tamsin', name: 'The Ember Hearth' });
  c.building('house', 33, 46, 4, 3);
  // the roads office, which closed the King's Road to refugees
  c.building('shop', 37, 55, 5, 3, { name: 'The Roads Office' });
  c.npc('roadwarden-hesk', 39, 58);
  c.building('house', 14, 55, 4, 3);
  c.building('house', 20, 55, 4, 3);
  c.building('house', 14, 63, 4, 3);
  c.lamps(13, 53, 38, 53, 6);

  // the crafts quarter: the forge, the armory, the curio shop
  c.fill(63, 50, 91, 51, 'cobble');
  c.building('smithy', 65, 45, 5, 3, { npc: 'brannoc', name: 'Brannoc’s Forge' });
  c.prop('anvil', 70, 49);
  c.building('shop', 74, 45, 5, 3, { npc: 'odo', name: 'Odo’s Armory' });
  c.building('shop', 82, 45, 5, 3, { npc: 'wren', name: 'Imelda’s Curios' });
  // Nyx: from the day she joins until the night at the Tear
  c.npc('nyx', 87, 49, all(after('nyx-joins'), until('the-heralds-ambush')));
  c.building('house', 66, 55, 4, 3);
  c.building('house', 72, 55, 4, 3);
  c.building('house', 80, 55, 4, 3);
  c.building('house', 86, 55, 4, 3);
  c.lamps(64, 52, 90, 52, 6);

  // houses to the north-east and north-west
  c.building('house', 82, 23, 4, 3);
  c.building('house', 88, 23, 4, 3);
  c.building('house', 82, 30, 4, 3);
  c.building('house', 88, 30, 4, 3);
  c.building('house', 37, 13, 4, 3);
  c.building('house', 37, 21, 4, 3);
  c.building('house', 14, 32, 4, 3);
  c.building('house', 36, 30, 4, 3);

  // where the story happens in the city (silent places)
  for (const [id, x, y] of [
    ['ember-dais', 56, 35],
    ['ember-n', 51, 25],
    ['ember-w', 38, 40],
    ['ember-e', 65, 40],
    ['ember-s', 51, 53],
    ['crane-door', 43, 28],
    ['crane-w', 35, 27],
    ['crane-e', 49, 27],
    ['crane-s', 43, 33],
  ] as const)
    c.marker(x, y, { kind: 'place', id });
  // the Starfall Festival: lanterns round the square, stalls, banners down the avenue, the parade route
  for (const [x, y] of [
    [41, 33],
    [47, 33],
    [56, 33],
    [62, 33],
    [41, 48],
    [47, 48],
    [56, 48],
    [62, 48],
  ] as const)
    c.prop('lantern', x, y, false, FESTIVAL);
  for (const [x, y] of [
    [44, 38],
    [59, 38],
    [44, 43],
    [59, 43],
  ] as const)
    c.prop('market-cart', x, y, true, all(FESTIVAL, not(after('festival-the-knives'))));
  // the star-lantern the Regent comes down to light
  c.prop('lantern', 56, 34, false, FESTIVAL);
  for (const y of [26, 34, 56, 64])
    for (const x of [48, 55]) c.prop('red-banner', x, y, false, FESTIVAL);
  c.marker(51, 62, { kind: 'spot', id: 'festival-parade', name: 'The Starfall Parade', r: 4 }, is('festival-the-lanterns', 'started'));
  // the night of the knives: the stalls burn; the morning after, what's left of them
  for (const [x, y, sz] of [
    [44, 37, 2],
    [59, 37, 3],
    [44, 42, 3],
    [59, 42, 2],
  ] as const)
    c.marker(x, y, { kind: 'fire', size: sz });
  for (const [x, y] of [
    [44, 38],
    [59, 38],
    [44, 43],
    [59, 43],
  ] as const)
    c.prop('debris', x, y, false, AFTER);
  // at war (Act IV): a muster ground of tents and banners in the market
  for (const [x, y] of [
    [43, 36],
    [60, 36],
    [43, 45],
    [60, 45],
  ] as const)
    c.prop('tent', x, y, true, WAR);
  for (const x of [46, 57]) c.prop('blue-banner', x, 33, false, WAR);
  c.prop('anvil', 63, 40, true, WAR);

  // the park and the pond to the south, where Pell keeps his chickens
  c.pond(33, 64, 5, 3);
  c.plant(24, 58, 46, 71, 0.07, 0.25);
  c.npc('pell', 41, 62);
  c.prop('chickens', 43, 64, false);
  c.plant(60, 59, 92, 71, 0.05, 0.2);
  c.plant(10, 9, 93, 72, 0.012, 0.1);
  // lamps down the avenue
  c.lamps(49, 24, 49, 71, 8);
  c.lamps(54, 24, 54, 71, 8);
  return c;
}

const built = plan().build();

export const EMBERWICK: RegionDef = {
  id: 'emberwick',
  name: 'Emberwick',
  subtitle: 'The Ember City',
  theme: 'village',
  kind: 'town',
  level: 1,
  levels: [1, 1],
  at: [44, 68],
  dark: false,
  safe: true,
  music: 'village',
  map: built.map,
  markers: {},
  placed: built.placed,
  encounters: [],
  states: [
    { id: 'festival', when: during('festival-the-lanterns'), dusk: true },
    { id: 'night-of-knives', when: KNIVES, night: true, burning: true, music: 'crypt' },
    { id: 'lockdown', when: AFTER, smoke: true },
  ],
  blurb: 'The Crown City: the Regent’s keep, the market, taverns and the inn, the forge, the temple and the training grounds.',
};
