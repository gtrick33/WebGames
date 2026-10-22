import { CityPlan } from '../citygen';
import type { RegionDef } from '../types';

/**
 * Emberwick, the Ember City: where every hero starts. Walls with gates east (the Whisperwood) and south
 * (Thornvale); the Regent's keep at the head of the main avenue; the market square with the waystone;
 * the training grounds and the barracks to the north-west, the temple of the Sigil-wardens to the
 * north-east; taverns and the inn to the south-west; the forge, the armory and the curio shop to the
 * south-east; houses, gardens and a pond between.
 */
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
  c.gate('e', 41, 4, 94, 95, { to: 'whisperwood', label: 'East gate: the road to the Whisperwood' });
  c.gate('s', 52, 4, 73, 74, { to: 'thornvale', label: 'South gate: the road to Thornvale', minLevel: 7 });
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
  c.npc('regent-elowen', 51, 20);
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
  c.npc('maren', 26, 31);
  c.npc('guard-gate', 89, 37);

  // the temple of the Sigil-wardens
  c.building('temple', 72, 12, 8, 5, { pave: false });
  c.fill(71, 17, 80, 20, 'cobble');
  c.fill(74, 21, 76, 38, 'path');
  c.npc('ysolde', 73, 19);

  // the tavern quarter: the Drunken Wyvern and the Ember Hearth
  c.fill(12, 51, 39, 52, 'cobble');
  c.building('tavern', 14, 46, 6, 4, { npc: 'gorran', name: 'The Drunken Wyvern' });
  c.building('inn', 24, 46, 6, 4, { npc: 'tamsin', name: 'The Ember Hearth' });
  c.building('house', 33, 46, 4, 3);
  c.building('house', 14, 55, 4, 3);
  c.building('house', 20, 55, 4, 3);
  c.building('house', 14, 63, 4, 3);
  c.lamps(13, 53, 38, 53, 6);

  // the crafts quarter: the forge, the armory, the curio shop
  c.fill(63, 50, 91, 51, 'cobble');
  c.building('smithy', 65, 45, 5, 3, { npc: 'brannoc', name: 'Brannoc’s Forge' });
  c.prop('anvil', 70, 49);
  c.building('shop', 74, 45, 5, 3, { npc: 'odo', name: 'Odo’s Armory' });
  c.building('shop', 82, 45, 5, 3, { npc: 'wren', name: 'Wren’s Curios' });
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
  at: [30, 50],
  dark: false,
  safe: true,
  music: 'village',
  map: built.map,
  markers: {},
  placed: built.placed,
  encounters: [],
  blurb: 'The capital: the Regent’s keep, the market, taverns and the inn, the forge, the temple and the training grounds.',
};
