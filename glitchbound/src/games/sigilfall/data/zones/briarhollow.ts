import { SpreadPlan } from '../citygen';
import { doorsOf } from '../interiors';
import type { EnemyDef, NpcDef, QuestDef, RegionDef, StoryCond, StoryEventDef } from '../types';

/**
 * Briarhollow, the Prologue (STORY_BIBLE.md §3, "The Night the Bells Stopped"): a border village of
 * thatch, orchards and a chapel whose bell has not rung in three weeks. The hero arrives at dusk; a king's
 * courier dies at the gate; at nightfall the Ashen Host burns the lanes, the hero pulls children out of the
 * burning inn and holds the chapel door with Mara and Elyra; the raiders dig under the chapel, and the
 * crypt below (the old crypt) holds the first fragment of the Starlight Crown. At dawn the village
 * becomes the resistance camp, and every village saved later sends its people here.
 *
 * The map is drawn with the city builder; people, fires and the camp come and go with the story
 * (each marker's `when`), and the region's states set night, flames and smoke.
 */

const is = (quest: string, state: 'offered' | 'active' | 'done' | 'started' | 'locked' | 'taken'): StoryCond => ({ quest, is: state });
const not = (c: StoryCond): StoryCond => ({ not: c });
const any = (...c: StoryCond[]): StoryCond => ({ any: c });
const all = (...c: StoryCond[]): StoryCond => ({ all: c });

/** The fight at the gate: night has come, and nothing burns yet (the bell and the fire come after it). */
const GATE = is('first-steps', 'active');
/** The night of the raid, from the fight at the gate to the door holding (the Prologue opens on it). */
const RAID = any(GATE, is('briar-nightfall', 'active'), is('briar-the-rider', 'active'), is('briar-the-seal', 'active'), is('briar-the-inn', 'active'), is('briar-hold-the-door', 'active'));
/** After the door held, until dawn: the raiders are below, the village is dark and smoking. */
const NIGHT = any(is('briar-below', 'active'), is('the-warden', 'active'), is('close-the-rift', 'active'), is('the-empty-tomb', 'active'));
/** Dawn: the camp. */
const CAMP = is('the-empty-tomb', 'done');
/** Village life (people out in the lanes): before the raid, and again after dawn. */
const CALM = not(any(RAID, NIGHT));
/** The Epilogue: the camp has gone home and Briarhollow is rebuilt (STORY_BIBLE.md §3, §4). */
const HOME = is('epilogue-the-camp-goes-home', 'done');
/** The camp while it stands: from the first dawn until it goes home. */
const CAMPED = (c: StoryCond): StoryCond => all(c, not(HOME));

/** How much roomier the village is than it was first drawn (64 × 54): houses keep their size, the lanes widen. */
/**
 * The plan's own scale: the village was once laid out 35% roomier, and the owner found it "vast": houses far
 * apart with open grass between. It is built at its plan's size again, with more houses along its roads.
 */
const SPREAD = 1;

function plan(): SpreadPlan {
  const c = new SpreadPlan(64, 54, 4417, SPREAD);
  c.woods(3, 6);
  // the roads: north to the Whisperwood, west to Fernstead, south to Millbrook
  c.fill(31, 0, 33, 19, 'path');
  c.fill(0, 26, 25, 27, 'path');
  c.fill(31, 31, 32, 53, 'path');
  c.fill(39, 26, 52, 27, 'path');
  c.marker(32, 0, { kind: 'exit', to: 'whisperwood', label: 'North road: the Whisperwood' });
  c.marker(0, 26, { kind: 'exit', to: 'brackenridge', label: 'West road: Fernstead and the Brackenridge Hills', minLevel: 5 }, is('the-empty-tomb', 'done'));
  c.marker(31, 53, { kind: 'exit', to: 'thornvale', label: 'South road: Millbrook and Thornvale', minLevel: 7 }, is('the-empty-tomb', 'done'));

  // the old stone wall along the north, toward the woods, with its gate where Mara keeps watch and a
  // watchtower on either side of it
  for (let x = 9; x <= 55; x++) if (x < 30 || x > 34) c.set(x, 12, 'rampart');
  // (the towers are the gate's posts: the wall ends at each, the road between them)
  c.prop('watchtower', 29, 12);
  c.prop('watchtower', 35, 12);
  c.marker(30, 13, { kind: 'prop', prop: 'lamp', solid: true });
  c.marker(34, 13, { kind: 'prop', prop: 'lamp', solid: true });

  // the square: the waystone, the well, the market (small, and full: the owner's references)
  c.fill(27, 22, 37, 29, 'cobble');
  c.marker(32, 22, { kind: 'waystone' });
  c.marker(32, 29, { kind: 'prop', prop: 'well', solid: true });
  for (const [x, y] of [
    [26, 21],
    [38, 21],
    [26, 30],
    [38, 30],
  ] as const)
    c.prop('lamp', x, y);
  // its edge planted: flowerbeds and planters, a bench at each side
  for (const [x, y, p] of [
    [26, 23, 'flowerbed'],
    [38, 23, 'flowerbed'],
    [26, 25, 'planter'],
    [38, 25, 'planter'],
    [28, 30, 'flowerbed'],
    [36, 30, 'planter'],
    [26, 28, 'bench'],
    [38, 28, 'bench'],
  ] as const)
    c.prop(p, x, y);
  // the stalls' goods, set beside them (the stalls themselves stand out on calm days, below)
  for (const [x, y, p] of [
    [27, 26, 'crate'],
    [37, 26, 'barrel'],
  ] as const)
    c.prop(p, x, y);
  // a market square, not an empty yard: the Regent's banners by the waystone, a bench by the well, and the
  // stall carts out while the village is calm
  c.prop('blue-banner', 29, 21);
  c.prop('blue-banner', 35, 21);
  c.prop('bench', 34, 30);
  // a bucket at the well
  c.prop('bucket', 31, 29, false);

  c.prop('market-cart', 28, 26, true, CALM);
  c.prop('market-cart', 36, 26, true, CALM);

  // the guard yard by the gate: Mara's dummies
  c.fill(18, 14, 26, 18, 'cobble');
  c.marker(20, 15, { kind: 'dummy' });
  c.marker(23, 15, { kind: 'dummy' });
  c.marker(25, 17, { kind: 'dummy', shooter: true });

  // the chapel and its silent bell, north-east; the crypt stair opens beside it
  c.building('temple', 44, 13, 4, 4, { name: 'Chapel of the Bell', art: 'rk:chapel' });
  c.fill(44, 17, 48, 19, 'cobble');
  c.fill(40, 19, 44, 21, 'cobble');
  c.marker(49, 18, { kind: 'exit', to: 'crypt', label: 'The crypt stair, under the chapel' }, is('briar-below', 'started'));
  c.marker(48, 20, { kind: 'spot', id: 'briar-crypt-stair', name: 'The Crypt Stair', r: 2 }, is('briar-below', 'started'));

  // the Bramble & Barrel, west of the square
  c.building('inn', 13, 20, 6, 4, { name: 'The Bramble & Barrel', art: 'rk:inn' });
  c.fill(13, 24, 24, 25, 'cobble');
  // the smithy and the trader east of the square
  c.building('smithy', 42, 21, 4, 3, { name: 'Hollin’s Forge' });
  c.prop('anvil', 46, 24);
  c.building('shop', 48, 21, 4, 3, { name: 'Ilse’s Stall' });
  // the elder's hall and the herbwife's cottage south of the square
  c.building('hall', 34, 33, 5, 3, { name: 'The Elder’s Hall' });
  c.building('house', 20, 34, 4, 3, { name: 'Thessa’s Cottage', art: 'gv:cosy_cottage' });
  // houses: along the west road and down the south road too, shoulder to shoulder as a village is built
  for (const [x, y] of [
    [8, 30],
    [8, 37],
    [45, 31],
    [52, 31],
    [45, 38],
    [53, 14],
    [13, 14],
    [25, 34],
    [38, 41],
    [37, 46],
    [49, 34],
    [8, 14],
    // and on what was open grass: by the gate yard, on the west road, by the forge, in the south
    [27, 16],
    [34, 14],
    [8, 22],
    [54, 20],
    [14, 38],
    [40, 38],
    [33, 43],
    [26, 49],
  ] as const)
    c.building('house', x, y, 4, 3);
  // lamps along the roads out of the square, flowers and benches by the doors
  for (const [x, y] of [
    [23, 28],
    [16, 28],
    [9, 28],
    [30, 36],
    [30, 43],
    [33, 49],
    [41, 28],
    [47, 28],
  ] as const)
    c.prop('lamp', x, y);
  // the orchard, the fields and the pond
  c.plant(42, 42, 58, 49, 0.18, 0.12);
  for (let x = 22; x <= 29; x++) {
    c.set(x, 41, 'fence');
    c.set(x, 48, 'fence');
  }
  for (let y = 41; y <= 48; y++) {
    c.set(22, y, 'fence');
    c.set(29, y, 'fence');
  }
  c.fill(23, 42, 28, 47, 'deco');
  c.set(29, 44, 'floor');
  c.pond(13, 45, 4, 2);
  // copses where a village's trees would be: between the outer houses, round the pond, along the edges, and
  // outside the wall toward the woods; flowers in the yards between (no more lone trees dotted everywhere)
  for (const [x, y, r] of [
    [4, 34, 3],
    [5, 43, 2.5],
    [19, 50, 3],
    [59, 36, 3],
    [60, 21, 2.5],
    [15, 8, 3],
    [47, 8, 3.5],
    [39, 50, 2.5],
  ] as const)
    c.grove(x, y, r);
  c.plant(6, 13, 58, 50, 0, 0.12);

  // where the story happens (silent places)
  for (const [id, x, y] of [
    ['briar-gate', 32, 14],
    ['briar-square', 32, 25],
    ['briar-inn', 16, 25],
    ['briar-chapel', 46, 19],
    // the chapel's doorstep, where the door is held and the saved go in
    ['briar-chapel-door', 46, 17],
    ['briar-north', 32, 8],
    // up the north road, out of the lamps' reach: where the courier comes from
    ['briar-road', 32, 3],
    // the east wall's roofs, where the raiders came over
    ['briar-east-roofs', 50, 31],
    ['briar-east', 56, 26],
    ['briar-west', 5, 26],
    ['briar-south', 31, 49],
    // where the Vale's people settle as they come (Act I)
    ['briar-watchfire', 39, 15],
    ['briar-granary', 10, 18],
    ['briar-infirmary', 16, 29],
    ['briar-forge', 56, 27],
    ['briar-riders', 42, 29],
    ['briar-dwarves', 42, 36],
    ['briar-fern-camp', 16, 31],
  ] as const)
    c.marker(x, y, { kind: 'place', id });

  // fires on the roofs while the village burns, catching one after another once the bell has rung (seconds
  // after the burning begins: the chapel's side while the camera is on the bell, the east wall's after);
  // the inn catches when its beat comes
  for (const [x, y, s, delay] of [
    [43, 21, 2, 5],
    [46, 31, 3, 8.5],
    [54, 31, 2, 9.5],
    [47, 38, 2, 11],
    [10, 30, 2, 13],
    [9, 37, 2, 14],
  ] as const)
    c.marker(x, y, { kind: 'fire', size: s, delay });
  c.marker(15, 20, { kind: 'fire', size: 3 }, is('briar-the-inn', 'started'));
  c.marker(17, 21, { kind: 'fire', size: 2, delay: 0.8 }, is('briar-the-inn', 'started'));

  // the people: who stands where depends on the night
  c.npc('mara-venn', 31, 14, CALM);
  // the courier lies where he fell, just inside the gate
  c.npc('oskar-fell', 32, 15, is('briar-the-seal', 'active'));
  c.npc('maren', 38, 37, CALM);
  c.npc('maren', 45, 20, NIGHT);
  c.npc('old-haldor', 43, 18, CALM);
  c.npc('herbwife-thessa', 22, 37, CALM);
  c.npc('smith-hollin', 44, 24, CALM);
  c.npc('trader-ilse', 50, 24, CALM);
  c.npc('goodwife-bramble', 18, 25, CALM);
  // Elyra keeps the camp with Thessa until the Pale Herald takes her at the Tear (Act III)
  c.npc('elyra', 28, 32, all(CAMP, not(is('the-heralds-ambush', 'done'))));
  // home with Thessa after it is all over
  c.npc('elyra', 24, 36, HOME);
  c.npc('mara-venn', 47, 20, NIGHT);
  c.npc('elyra', 43, 20, NIGHT);
  c.npc('briar-tam', 30, 27, CALM);
  c.npc('briar-oda', 24, 44, CALM);
  // the camp at dawn: tents and a cookfire in the square, the burned inn's guests under canvas
  c.prop('tent', 27, 28, true, CAMPED(CAMP));
  c.prop('tent', 36, 28, true, CAMPED(CAMP));
  c.prop('campfire', 30, 30, true, CAMPED(CAMP));
  c.prop('tent', 24, 30, true, CAMPED(CAMP));

  // the camp grows (Act I): every village the hero saves sends its people, and they stay
  // Fernstead's rangers keep a watchfire by the gate
  c.prop('campfire', 40, 15, true, CAMPED(is('camp-scouts', 'done')));
  c.prop('tent', 37, 17, true, CAMPED(is('camp-scouts', 'done')));
  c.npc('ranger-cole', 39, 16, all(is('camp-scouts', 'done'), CALM, not(HOME)));
  // Millbrook's grain carts by the west road, and Tobin's hens (the sheep would not come)
  c.prop('cart', 8, 17, true, CAMPED(is('camp-grain', 'done')));
  c.prop('cart', 10, 19, true, CAMPED(is('camp-grain', 'done')));
  c.prop('hay', 7, 19, true, CAMPED(is('camp-grain', 'done')));
  c.prop('hay', 12, 16, true, CAMPED(is('camp-grain', 'done')));
  c.prop('chickens', 9, 21, false, CAMPED(is('camp-grain', 'done')));
  c.npc('carter-wenna', 11, 18, all(is('camp-grain', 'done'), CALM, not(HOME)));
  // Reedwater's healers under canvas by Thessa's cottage
  c.prop('tent', 14, 29, true, CAMPED(is('camp-healers', 'done')));
  c.prop('tent', 18, 29, true, CAMPED(is('camp-healers', 'done')));
  c.prop('clay-pot', 16, 28, true, CAMPED(is('camp-healers', 'done')));
  c.npc('healer-brisa', 16, 30, all(is('camp-healers', 'done'), CALM, not(HOME)));
  // Gullport's forge and a cart of powder kegs, east of Hollin's
  c.prop('anvil', 57, 27, true, CAMPED(is('camp-smiths', 'done')));
  c.prop('barrel', 55, 29, true, CAMPED(is('camp-smiths', 'done')));
  c.prop('barrel', 56, 29, true, CAMPED(is('camp-smiths', 'done')));
  c.prop('cart', 55, 25, true, CAMPED(is('camp-smiths', 'done')));
  c.npc('forgewife-runa', 56, 27, all(is('camp-smiths', 'done'), CALM, not(HOME)));
  // Hearthstead's riders and their banners south-east of the square
  c.prop('flag', 41, 28, true, CAMPED(is('camp-riders', 'done')));
  c.prop('blue-banner', 44, 28, true, CAMPED(is('camp-riders', 'done')));
  c.npc('rider-alder', 42, 29, all(is('camp-riders', 'done'), CALM, not(HOME)));
  // Kragholt's dwarf-steel and Brenna's apprentice, beside the Elder's hall (Act II)
  c.prop('anvil', 44, 36, true, CAMPED(is('camp-dwarves', 'done')));
  c.prop('crate', 40, 36, true, CAMPED(is('camp-dwarves', 'done')));
  c.prop('blue-banner', 41, 34, true, CAMPED(is('camp-dwarves', 'done')));
  c.npc('dwarf-tova', 42, 36, all(is('camp-dwarves', 'done'), CALM, not(HOME)));
  // Fernstead's people under canvas, from the night it falls until it is taken back (Act III)
  const FERN_CAMP = all(is('fall-of-fernstead', 'done'), not(is('fern-retaken', 'done')));
  c.prop('tent', 15, 32, true, FERN_CAMP);
  c.prop('tent', 19, 32, true, FERN_CAMP);
  c.prop('campfire', 17, 33, true, FERN_CAMP);
  c.npc('warden-hollis', 16, 31, FERN_CAMP);
  c.npc('mother-alsa', 18, 31, FERN_CAMP);
  c.npc('pip-tanner', 14, 31, FERN_CAMP);
  // rebuilt (the Epilogue): market carts back in the square, lanterns on the lanes, new thatch by the inn
  c.prop('market-cart', 27, 27, true, HOME);
  c.prop('market-cart', 37, 27, true, HOME);
  c.prop('bench', 30, 30, true, HOME);
  c.prop('lantern', 25, 24, false, HOME);
  c.prop('lantern', 39, 24, false, HOME);
  c.prop('hay', 20, 23, true, HOME);
  c.prop('crate', 12, 24, true, HOME);
  // the answer Elyra was given at the end: the hour leaves four names on a stone by the chapel
  c.prop('standing-stone', 49, 22, true, all(HOME, is('crownfall-one-hour', 'taken')));
  // the farms outside the palisade, now the village has room: a fenced field with its hay and cart, a farmhouse,
  // the orchard along the north road and the mill beyond it
  c.fill(8, 6, 22, 9, 'deco');
  for (let x = 7; x <= 23; x++) {
    c.set(x, 5, 'fence');
    c.set(x, 10, 'fence');
  }
  for (let y = 6; y <= 9; y++) c.set(7, y, 'fence');
  c.set(23, 7, 'floor');
  c.prop('hay', 11, 7);
  c.prop('hay', 17, 8);
  c.prop('hay', 20, 6);
  c.prop('cart', 25, 9);
  c.building('house', 25, 4, 4, 3, { name: 'Wenna’s Farm' });
  c.plant(38, 4, 58, 10, 0.16, 0.18);
  c.prop('windmill', 54, 6);
  c.prop('barrel', 36, 9);
  c.prop('crate', 37, 10);
  // two more cottages in the south-east, with their gardens
  c.building('house', 49, 41, 4, 3, { name: 'Brisa’s House' });
  c.fill(48, 45, 53, 46, 'deco');
  c.prop('clay-pot', 48, 44);
  c.building('house', 54, 46, 4, 3);
  c.fill(53, 50, 58, 50, 'deco');
  c.prop('barrel', 58, 48);
  // a woodpile and a bench by the west road
  c.prop('crate', 8, 29);
  c.prop('crate', 9, 29);
  c.prop('bench', 18, 28, true);
  // the doors into the inn, the chapel and the Elder's hall (data/interiors.ts)
  for (const d of doorsOf('briarhollow')) c.marker(d.tx, d.ty, d.marker, d.when);
  c.marker(32, 12, { kind: 'start' });
  return c;
}

const built = plan().build();

export const BRIARHOLLOW: RegionDef = {
  id: 'briarhollow',
  name: 'Briarhollow',
  subtitle: 'A border village where the bell has stopped',
  theme: 'farm',
  kind: 'town',
  level: 4,
  levels: [1, 6],
  at: [56, 70],
  dark: false,
  safe: true,
  music: 'briarhollow',
  map: built.map,
  markers: {},
  placed: built.placed,
  holds: {
    exits: ['whisperwood', 'brackenridge', 'thornvale', 'crypt'],
    npcs: ['mara-venn', 'maren', 'old-haldor', 'herbwife-thessa', 'smith-hollin', 'trader-ilse', 'goodwife-bramble', 'elyra', 'oskar-fell', 'ranger-cole', 'carter-wenna', 'healer-brisa', 'forgewife-runa', 'rider-alder', 'dwarf-tova'],
    spots: ['briar-crypt-stair'],
  },
  encounters: [],
  states: [
    { id: 'gate', when: GATE, night: true, music: 'siege' },
    { id: 'raid', when: RAID, night: true, burning: true, music: 'siege' },
    { id: 'night', when: NIGHT, night: true, smoke: true },
    { id: 'rebuilt', when: HOME },
    { id: 'camp', when: CAMP },
    // the hero arrives as the lamps are lit; the Host is on the road behind them
    { id: 'dusk', when: not(is('first-steps', 'started')), dusk: true },
  ],
  blurb: 'Thatch, orchards and a silent chapel bell on the edge of the Vale. People vanish after dark.',
};

/* ------------------------------------------------------------------ foes */

/** The Ashen Host's raiders: memories with weapons, grey and soft-edged, smelling of cold hearths. */
export const BRIARHOLLOW_FOES: Record<string, EnemyDef> = {
  'ash-raider': {
    id: 'ash-raider',
    name: 'Ashen Raider',
    sprite: 'legion-scout',
    ai: 'melee',
    hp: 34,
    dmg: 9,
    speed: 54,
    radius: 6,
    mass: 1,
    xp: 8,
    gold: [1, 4],
    aggro: 200,
    reach: 18,
    windup: 0.45,
    recover: 0.5,
    attackCd: 1.3,
    flank: true,
    blurb: 'A soldier made of someone’s memory of one. It swings wide and slow; step inside the swing.',
  },
  'ash-archer': {
    id: 'ash-archer',
    name: 'Ashen Bowman',
    sprite: 'hollow-hunter',
    ai: 'ranged',
    hp: 26,
    dmg: 8,
    speed: 46,
    radius: 6,
    mass: 0.9,
    xp: 9,
    gold: [1, 4],
    aggro: 210,
    reach: 140,
    windup: 0.65,
    recover: 0.4,
    attackCd: 1.9,
    keep: 100,
    shot: { speed: 145, radius: 2.5, count: 1, spread: 0, color: '#c8a8ff' },
    blurb: 'Keeps its distance and looses grey arrows. Close in, or step aside when it draws.',
  },
  'ash-hound': {
    id: 'ash-hound',
    name: 'Ashen Hound',
    sprite: 'grave-hound',
    ai: 'charger',
    hp: 30,
    dmg: 9,
    speed: 66,
    radius: 6,
    mass: 1,
    xp: 8,
    gold: [1, 3],
    aggro: 220,
    reach: 110,
    windup: 0.55,
    recover: 0.7,
    attackCd: 2.2,
    rush: { speed: 230, dist: 110 },
    blurb: 'Lowers its head and rushes in a line. Dodge to the side and it skids past.',
  },
};

/* ----------------------------------------------------------------- people */

export const BRIARHOLLOW_NPCS: Record<string, NpcDef> = {
  'mara-venn': {
    id: 'mara-venn',
    name: 'Mara Venn',
    title: 'Village guard of Briarhollow',
    sprite: 'villager',
    talk: [
      { when: { quest: 'briar-dusk', state: 'active' }, lines: ['Stop there. Nobody comes through after the lamps are lit. Nobody goes out, either.', 'You’re not one of them, at least. They don’t talk.', 'Mara Venn. I keep the gate, since there’s nobody else left to keep it. If you’re staying, you’d better be able to swing that.', 'Wait. On the road behind you. Grey, and no torches. Turn around. Here they come.'] },
      { when: { quest: 'briar-below', state: 'active' }, lines: ['They stopped fighting us. Did you see? They just stopped, and started digging.', 'Whatever is under that chapel, they want it more than they want us dead. I don’t like that.'] },
      { when: { quest: 'fern-retaken', state: 'offered' }, lines: ['I have counted Fernstead’s tents every morning for a week. I am done counting.', 'Hollis’s rangers, Dunmore’s riders, you, and me. We take it back. Tonight, if you’ll come.'] },
      { when: { quest: 'fern-retaken', state: 'active' }, lines: ['Fernstead square. They’ve left a garrison that thinks it’s won. Let’s explain.'] },
      { when: { quest: 'the-heralds-ambush', state: 'done' }, lines: ['They took Elyra. Out of the middle of you. And Nyx walked away from it.', 'I don’t trust magic. I trusted Elyra. I’m going to get her back, and then I’m going to tell her I was wrong about the magic.'] },
      { when: { quest: 'the-empty-tomb', state: 'done' }, lines: ['Half the roofs gone, but nobody we pulled out of that inn died. I keep counting. Still nobody.', 'Maren says we gather the Vale. Fine. I’ll keep the gate while you find us people worth gathering.'] },
      { lines: ['The gate stays shut after dark. That isn’t going to change.', 'I don’t trust magic. I trust walls and people who show up.'] },
    ],
  },
  elyra: {
    id: 'elyra',
    name: 'Elyra',
    title: 'Hedge-mage, Thessa’s apprentice',
    sprite: 'villager',
    talk: [
      { when: { quest: 'crownfall-break-it', state: 'taken' }, lines: ['I still forget things. Small things. The name of the third cat, the second verse of things. But I know yours. I say it in the mornings to check. It’s always there.', 'Thessa says I’m allowed to be a hedge-witch again. Just a hedge-witch. Milk and wasps and plums. I’ve never wanted anything more.'] },
      { when: { quest: 'crownfall-one-hour', state: 'taken' }, lines: ['Thessa says I knew you. I believe her. You have a face I trust before I know why.', 'There’s a stone by the chapel with four names on it, from a kingdom nobody remembers. I go and sit by it. I don’t know why that either. It feels like the right kind of not knowing.'] },
      { when: { quest: 'briar-below', state: 'active' }, lines: ['I can feel it. Down there, under the chapel. Something warm, like a hearth in a cold house.', 'Thessa says I mustn’t say things like that out loud. I’m saying it anyway.'] },
      { when: { quest: 'the-empty-tomb', state: 'active' }, lines: ['It’s in me now. The fragment. When I touched it, it — went in. Like light through a window.', 'I can see better in the dark. I can hear the bell that isn’t ringing. Tell Maren. Please. Before I lose my nerve.'] },
      { when: { quest: 'the-empty-tomb', state: 'done' }, lines: ['Every time I use it, I forget something small. This morning it was the name of Thessa’s cat.', 'I’ll come when you need me. Just — tell me the cat’s name if I ask, will you? It’s Burr.'] },
      { lines: ['I was only ever good at small wards. Keeping milk from souring. Keeping wasps off the plums.', 'Last night I held a burning roof up over three children. I don’t know how.'] },
    ],
  },
  'oskar-fell': {
    id: 'oskar-fell',
    name: 'Oskar Fell',
    title: 'King’s courier, dying',
    sprite: 'villager',
    talk: [{ lines: ['Take it. The seal. Broken, I know, they broke it. But the letter is still… inside.', 'They’re hunting the crown. The old one. The pieces of it. The Crown City must know. Someone there has been… losing our letters.', 'Tell them Oskar Fell rode the whole way. Tell them I didn’t stop.'] }],
  },
  maren: {
    id: 'maren',
    name: 'Elder Maren',
    title: 'Elder of Briarhollow',
    sprite: 'elder',
    talk: [
      { when: { quest: 'epilogue-the-camp-goes-home', state: 'active' }, lines: ['Look at them. They came here with nothing, and they’re leaving with carts. Stand with me. I want them to see us waving.'] },
      { when: { quest: 'epilogue-the-bell', state: 'active' }, lines: ['Haldor has been under that bell since dawn. Go up to him. I think he’s waiting for permission, and I think it has to be you.'] },
      { when: { quest: 'epilogue-the-bell', state: 'done' }, lines: ['Every village that held was one more wall. And then they went home and took the walls with them, and it’s just us, and it’s enough.', 'If you ever come back this way, the inn has a new roof. The beer is exactly as bad as it was.'] },
      { when: { quest: 'into-the-wood', state: 'active' }, lines: ['Whatever shot that courier came out of the Whisperwood. So did the ones who burned us.', 'Go north while it’s light. Thin them out on the trails. Find out what they are.'] },
      { when: { quest: 'alpha', state: 'active' }, lines: ['The beasts of the wood have gone mad together, following one great boar with grey light in its eyes. Grimtusk, the woodcutters called it, before they stopped coming back.', 'It dens at the east end of the wood. Kill it and the wood calms, and we have one less thing at the door tonight.'] },
      { when: { quest: 'the-warden', state: 'active' }, lines: ['The crypt under the chapel is older than the village. Older than the chapel. The old warden still keeps it, they say, though he’s been dead three hundred years.', 'If the raiders went down there, they went for something. Bring it back before they do.'] },
      { when: { quest: 'close-the-rift', state: 'active' }, lines: ['Past the warden is the reliquary. I was told, as a girl, what it holds, and told never to say. I’ll say it now: a piece of the Starlight Crown.', 'Whoever leads those raiders is down there with it. Stop them.'] },
      { when: { quest: 'the-empty-tomb', state: 'active' }, lines: ['A fragment of the Starlight Crown, bonded to a hedge-witch’s apprentice. And the mark of the Ashen Host painted fresh on a crypt wall.', 'And a king’s seal, broken, from a man who rode all that way to die at our gate. His letter is soaked through. I’ll dry it by the fire.', 'Three hundred years ago the Sigil-wardens broke that crown so no king could use it again. Someone is putting it back together.', 'Then we don’t run. We gather the Vale: Fernstead, Millbrook, Reedwater, Gullport. Every village that holds is one more wall.'] },
      { when: { quest: 'west-road', state: 'active' }, lines: ['West, in the Brackenridge Hills: Fernstead. Their shrine at the Harvest Stones has gone grey, and the barrow dead walk.', 'Find Warden Hollis. If her scouts join us, we’ll see the Host coming.'] },
      { when: { quest: 'south-road', state: 'active' }, lines: ['South, Millbrook: a gang holds the mill bridge and taxes every cart. Paid in grey coin, the carters say.', 'Find Reeve Aldous. Free that bridge and Millbrook’s grain comes to us instead of to them.'] },
      { when: { quest: 'the-digging-dead', state: 'active' }, lines: ['Reedwater, out in the Greyfen marsh: their graves emptied from below, villagers taken into the reeds, the wells gone foul.', 'Find Marshwarden Tilde. Reedwater has the best healers in the Vale. We’ll need them.'] },
      { when: { quest: 'hollow-gold', state: 'active' }, lines: ['Ash-gold. It weighs nothing and it’s always cold. The Host pays its traitors with it.', 'Millbrook’s grain carts are already on the road to us. You did that. Look at the square tomorrow and you’ll see what it means.'] },
      { when: { quest: 'the-regents-council', state: 'active' }, lines: ['Sit. I’ve read Oskar Fell’s letter at last: I had to dry it by the fire first.', 'The king’s couriers have been warning the Crown City for months that the crown is being hunted. Every letter, lost. Someone in the city has been burying them.', 'We will have to go there ourselves, in the end. Not yet. First the Vale must hold.'] },
      { when: { quest: 'fall-of-fernstead', state: 'active' }, lines: ['Fernstead is burning. Its people are on the west road with whatever they could carry.', 'Go and meet them. Let them see a face they know.'] },
      { when: { quest: 'fall-of-fernstead', state: 'done' }, lines: ['The first village you saved. The Host knew exactly which one to take.', 'They’re learning us. We had better learn them faster.'] },
      { when: { quest: 'orders-from-the-north', state: 'done' }, lines: ['Rangers, grain, healers, smiths, riders. A month ago this was a village that nailed its shutters closed.', 'The Crown City is next, whether it wants us or not. Someone there has been burying the king’s letters. Go and dig them up.'] },
      { lines: ['Every village that holds is one more wall.', 'The square fills up a little more every week. That’s your doing.'] },
    ],
  },
  'old-haldor': {
    id: 'old-haldor',
    name: 'Old Haldor',
    title: 'Bell-ringer',
    sprite: 'elder',
    talk: [
      { when: { quest: 'epilogue-the-bell', state: 'active' }, lines: ['It’s over, then. I said I would ring her when it was over. Pip won’t hear it. I know that. I’ve known it a while.', 'Stand with me. Somebody should be standing with me.'] },
      { when: { quest: 'epilogue-the-bell', state: 'done' }, lines: ['Once for the dead, once for the living, and the rest because my arms remembered. They heard it in Fernstead. Hollis sent a rider to ask what was wrong.', 'Nothing’s wrong. That’s what it means. Nothing’s wrong.'] },
      { when: { quest: 'the-empty-tomb', state: 'done' }, lines: ['The rope’s still there. I go up every morning and hold it.', 'My grandson Pip went out after the lamps were lit, three weeks gone. The bell won’t ring for me until he’s home. Or until it’s all over.'] },
      { lines: ['Three weeks I haven’t rung it. Not since Pip went out after dark.', 'A bell calls people home. I won’t call them home to this.'] },
    ],
  },
  'herbwife-thessa': {
    id: 'herbwife-thessa',
    name: 'Herbwife Thessa',
    title: 'Healer, Elyra’s teacher',
    sprite: 'villager',
    talk: [
      { when: { quest: 'the-heralds-ambush', state: 'done' }, lines: ['I keep setting a cup out for her. Every morning. Brisa takes it away and doesn’t say anything.', 'She’ll be forgetting things, wherever she is. Our cat’s name is Burr. Tell her that, when you find her. Tell her first.'] },
      { when: { quest: 'the-empty-tomb', state: 'done' }, lines: ['The infirmary is my kitchen now. Burns, mostly. Burns and grief.', 'Elyra won’t tell me what it costs her. I can see it anyway. Bring her back to me in one piece.'] },
      { lines: ['There’s an old grove in the north-west of the wood, behind a hedge that isn’t there. My grandmother picked starwort in it.', 'If you find it, I’ll make it worth your while.'] },
    ],
  },
  'smith-hollin': {
    id: 'smith-hollin',
    name: 'Hollin',
    title: 'Blacksmith',
    sprite: 'smith',
    shop: 'weapons',
    shopName: 'Hollin’s Forge',
    talk: [{ lines: ['Blades, bows, staves. Not much, but honest.', 'The glowing ones out in the wood drop shards of something. Bring me three and I’ll make you something worth carrying.'] }],
  },
  'trader-ilse': {
    id: 'trader-ilse',
    name: 'Ilse',
    title: 'Trader',
    sprite: 'villager',
    shop: 'armor',
    shopName: 'Ilse’s Stall',
    talk: [{ lines: ['Coats, boots, a hat or two. Everything’s second-hand now. Everything.'] }],
  },
  'goodwife-bramble': {
    id: 'goodwife-bramble',
    name: 'Goodwife Bramble',
    title: 'Keeper of the Bramble & Barrel',
    sprite: 'villager',
    shop: 'inn',
    shopName: 'The Bramble & Barrel',
    talk: [
      { when: { quest: 'the-empty-tomb', state: 'done' }, lines: ['The roof’s gone and the cellar’s full of ash, but the kettle works. Potions are where they always were.', 'Those three children are mine to feed now. I don’t mind. I mind a little.'] },
      { lines: ['Potions, a bed, a bowl of something. We close the shutters at sunset.'] },
    ],
  },
  'briar-tam': {
    id: 'briar-tam',
    name: 'Tam',
    title: 'A boy of the village',
    sprite: 'villager',
    talk: [
      { when: { quest: 'the-empty-tomb', state: 'done' }, lines: ['You carried Wenna out over your shoulder! I saw! Do it again!'] },
      { lines: ['Mum says don’t go past the fence. Pip went past the fence.'] },
    ],
  },
  'briar-oda': {
    id: 'briar-oda',
    name: 'Oda',
    title: 'Farmer',
    sprite: 'villager',
    talk: [
      { when: { quest: 'camp-grain', state: 'done' }, lines: ['Grain from Millbrook! Twelve carts! I haven’t seen twelve of anything since spring.', 'And Tobin’s hens. Nobody asked for Tobin’s hens.'] },
      { lines: ['The field’s ready and nobody will stay out late enough to sow it.'] },
    ],
  },
  /* the camp's newcomers (Act I): one for each village that sent its people */
  'ranger-cole': {
    id: 'ranger-cole',
    name: 'Cole Brannagh',
    title: 'Ranger of Fernstead, at the watchfire',
    sprite: 'villager',
    talk: [
      { when: { quest: 'hearth-the-ram', state: 'done' }, lines: ['Two of ours were on Hearthstead’s towers. Both came back. Hollis will pretend she never doubted it.', 'The riders went north with something. We followed the tracks a day. They don’t stop to sleep.'] },
      { when: { quest: 'the-regents-council', state: 'done' }, lines: ['Grey riders on the Amberfield, a lot of them. More every night. Something is coming down from the north and it isn’t in a hurry.'] },
      { lines: ['Six of us, from Fernstead. Hollis sent her best and kept the rest. We watch the north road in turns.', 'Your Grey Lady is quiet. The barrow dogs sleep. We owed you a watch, so here we are.'] },
    ],
  },
  'carter-wenna': {
    id: 'carter-wenna',
    name: 'Wenna Holt',
    title: 'Carter, from Millbrook',
    sprite: 'villager',
    talk: [
      { when: { quest: 'the-drowned-fleet', state: 'done' }, lines: ['A smith from Gullport tried to buy my second cart for powder kegs. I said it carries bread. She said bread doesn’t explode. I said that’s the point.'] },
      { lines: ['Twelve carts of Millbrook grain, and Tobin’s hens, which nobody asked for.', 'The mill turns again. You burned that barricade so high we saw it from the road. Aldous wants the smoke back, he says. Joking. Mostly.'] },
    ],
  },
  'healer-brisa': {
    id: 'healer-brisa',
    name: 'Brisa Reed',
    title: 'Healer, from Reedwater',
    sprite: 'villager',
    shop: 'inn',
    shopName: 'The Infirmary Tent',
    talk: [
      { when: { quest: 'hearth-the-ram', state: 'done' }, lines: ['Burns from Hearthstead, coming in on every cart. I know these burns. They’re cold, not hot.', 'Thessa and I sit up with them. Elyra comes at night and puts her hand on them, and it helps, and she won’t say what it costs her.'] },
      { lines: ['Reedwater sent its herb-boats and me. Tilde says you brought Agna home. Agna says you carried her over the deep part.', 'Potions on the table. Thessa makes them stronger than I do. Don’t tell her I said so.'] },
    ],
  },
  'forgewife-runa': {
    id: 'forgewife-runa',
    name: 'Runa Saltforge',
    title: 'Smith, from Gullport',
    sprite: 'smith',
    shop: 'weapons',
    shopName: 'The Gullport Forge',
    talk: [
      { when: { quest: 'hearth-the-ram', state: 'done' }, lines: ['An ashen ram, they say. Bones and a beam. Next time, bring me a piece. I want to know what it’s lashed with.'] },
      { lines: ['Gullport’s forge, two apprentices and a cart of powder kegs. Hollin and I have agreed not to touch each other’s anvils.', 'Quill says the drowned have ships now. Then they’ll need fighting at sea, and that takes iron. Buy something.'] },
    ],
  },
  'dwarf-tova': {
    id: 'dwarf-tova',
    name: 'Tova Brightanvil',
    title: 'Brenna’s apprentice, from Kragholt',
    sprite: 'smith',
    shop: 'armor',
    shopName: 'Tova’s Dwarf-Steel',
    talk: [
      { lines: ['Brenna says the camp is to have the best steel the Deepforge makes, and that I’m to stay till it’s paid for. It will never be paid for. She knows.', 'Human anvils. So small. So brave.'] },
    ],
  },
  'rider-alder': {
    id: 'rider-alder',
    name: 'Alder Fenn',
    title: 'Rider of Hearthstead',
    sprite: 'villager',
    talk: [{ lines: ['Twenty riders from Hearthstead, for Elder Maren. We held the wall with you. We’ll ride wherever she points.', 'The Marshal says we eat too much. The Marshal is right.'] }],
  },
};

/* ----------------------------------------------------------------- events */

export const BRIARHOLLOW_EVENTS: Record<string, StoryEventDef> = {
  // the Epilogue: the camp packs up and every village's people go home down the south road
  'epilogue-the-camp': {
    id: 'epilogue-the-camp',
    region: 'briarhollow',
    kind: 'arrival',
    at: 'briar-square',
    radius: 16,
    arrive: { pets: ['fern-ranger', 'mill-carter', 'reed-healer', 'gull-smith', 'hearth-rider', 'dwarf-carter'], from: 'briar-square', to: 'briar-south' },
    banner: 'Going home',
    start: [{ who: 'maren', text: 'Fernstead, Millbrook, Reedwater, Gullport, Hearthstead, Kragholt. Go home. Go home and be ordinary. That’s an order.' }],
    waves: [],
    end: [{ who: 'mara-venn', text: 'That’s the last of them. The gate’s still sticking. I’m going to fix the gate.' }],
  },
  // the Prologue opens here: the Host comes down the north road behind the hero, and the first fight
  // teaches the controls (each wave shows the one it asks for)
  'briar-gate': {
    id: 'briar-gate',
    region: 'briarhollow',
    kind: 'raid',
    at: 'briar-gate',
    radius: 8,
    level: 1,
    allies: ['mara'],
    banner: 'Hold the gate!',
    start: [{ who: 'mara', text: 'Stand by me. Whatever they are, they bleed grey.' }],
    waves: [
      { enemies: ['ash-raider', 'ash-raider'], from: ['briar-north'], hint: 'attack' },
      { enemies: ['ash-raider', 'ash-raider', 'ash-raider'], from: ['briar-north'], hint: 'skill', barks: [{ who: 'mara', text: 'Three more! That trick I can see on you: use it!' }] },
      { enemies: ['ash-archer', 'ash-raider'], from: ['briar-north'], hint: 'dodge', barks: [{ who: 'mara', text: 'Bowman! When it draws, get out of the way!' }] },
    ],
    retry: [{ who: 'mara', text: 'Up! Back to the gate, they’re coming again!' }],
    end: [{ who: 'mara', text: 'That’s the last of them on the road.' }],
    // Mara stays for the bell (data/scenes.ts briar-the-toll); the raid's start sends her on
    stay: 40,
  },
  'briar-raid': {
    id: 'briar-raid',
    region: 'briarhollow',
    kind: 'raid',
    at: 'briar-square',
    radius: 6,
    level: 2,
    allies: ['mara'],
    // they come out of the smoke at the edge of sight, from their roads' side: no standing about
    close: true,
    start: [{ who: 'mara', text: 'Here they come! Keep them off the square, and off the chapel!' }],
    waves: [
      { enemies: ['ash-raider', 'ash-raider', 'ash-raider'], from: ['briar-north', 'briar-east'] },
      { enemies: ['ash-raider', 'ash-archer', 'ash-raider', 'ash-hound'], from: ['briar-west', 'briar-north'], barks: [{ who: 'mara', text: 'More from the west road! Keep them off the square!' }] },
      { enemies: ['ash-hound', 'ash-hound', 'ash-raider', 'ash-archer', 'ash-raider'], from: ['briar-east', 'briar-south'], barks: [{ who: 'mara', text: 'Hounds! Don’t let them get behind you!' }] },
    ],
    retry: [{ who: 'mara', text: 'Get up! Back to the square, we go again!' }],
    end: [
      { who: 'mara', text: 'That’s the lanes. Listen. Hooves on the north road… and now none.' },
      { who: 'mara', text: 'Someone’s coming in on foot. The gate, go! I’ll keep the square.' },
    ],
  },
  // the king's courier: his horse dead on the road, he walks the last of it with an arrow in his back
  'briar-courier': {
    id: 'briar-courier',
    region: 'briarhollow',
    kind: 'arrival',
    at: 'briar-gate',
    radius: 6,
    arrive: { pets: ['courier'], from: 'briar-road', to: 'briar-gate' },
    banner: 'A rider',
    start: [
      { who: 'courier', text: 'In the king’s name… the gate…' },
      { who: 'courier', text: 'Don’t close it. Don’t… close it…' },
    ],
    waves: [],
    end: [{ who: 'oskar-fell', text: 'You. Come here. Take it…' }],
  },
  'briar-inn': {
    id: 'briar-inn',
    region: 'briarhollow',
    kind: 'rescue',
    at: 'briar-inn',
    radius: 7,
    level: 2,
    allies: ['elyra'],
    // Elyra is at the inn, holding its roof up over them
    enter: 'briar-inn',
    rescue: { pets: ['briar-child', 'briar-child', 'briar-child'], at: 'briar-inn', to: 'briar-chapel', into: 'briar-chapel-door' },
    start: [
      { who: 'elyra', text: 'I can’t hold the roof much longer! Take them!' },
      { who: 'elyra', text: 'The chapel — it’s stone, it won’t burn. Go, go!' },
    ],
    waves: [
      { enemies: ['ash-raider', 'ash-hound'], from: ['briar-west'] },
      { enemies: ['ash-raider', 'ash-archer', 'ash-raider'], from: ['briar-south', 'briar-north'], barks: [{ who: 'elyra', text: 'More of them! Keep the children behind you!' }] },
    ],
    retry: [{ who: 'elyra', text: 'Up! The children are hiding, we try again!' }],
    end: [
      { who: 'elyra', text: 'All three. All three!' },
      { who: 'elyra', text: 'Into the chapel, all of you. Bar the door. They’re coming back, and more of them.' },
    ],
  },
  'briar-door': {
    id: 'briar-door',
    region: 'briarhollow',
    kind: 'defend',
    at: 'briar-chapel',
    radius: 9,
    level: 3,
    allies: ['mara', 'elyra'],
    // Mara comes up from the square she kept; Elyra is still here from the inn
    enter: 'briar-square',
    ward: { pet: 'chapel-door', at: 'briar-chapel-door', name: 'the chapel door' },
    start: [
      { who: 'mara', text: 'They want the door. They’re not getting it.' },
      { who: 'elyra', text: 'I’ll ward it as long as I can. Keep them off me!' },
    ],
    waves: [
      { enemies: ['ash-raider', 'ash-raider', 'ash-archer', 'ash-raider'], from: ['briar-north', 'briar-east'] },
      { enemies: ['ash-hound', 'ash-hound', 'ash-raider', 'ash-raider'], from: ['briar-square', 'briar-east'], barks: [{ who: 'mara', text: 'Hold the line! The door!' }] },
      { enemies: ['ash-raider', 'ash-raider', 'ash-archer', 'ash-archer', 'ash-hound', 'ash-raider'], from: ['briar-north', 'briar-square', 'briar-east'], barks: [{ who: 'elyra', text: 'The ward’s cracking — I can feel every blow!' }] },
    ],
    retry: [
      { who: 'mara', text: 'The door’s down! Fall back, rebuild it — once more!' },
      { who: 'elyra', text: 'I can ward it again. Just once more.' },
    ],
    end: [
      { who: 'mara', text: 'They’ve stopped. Why have they stopped?' },
      { who: 'elyra', text: 'They’re not running. They’re going around the back. Down. They’re digging under the chapel.' },
    ],
  },
};

/* ---------------------------------------------------------------- quests */

export const BRIARHOLLOW_QUESTS: QuestDef[] = [
  {
    id: 'briar-dusk',
    name: 'The Night the Bells Stopped',
    giver: 'mara-venn',
    auto: true,
    // the first moments speak for themselves: Mara's greeting, then the fight's own banner and lessons
    quiet: true,
    text: 'Briarhollow as the lamps are lit: half the shutters nailed shut, an empty market, a chapel bell that hasn’t rung in three weeks. Someone is waiting at the gate with a spear.',
    objective: { kind: 'talk', npc: 'mara-venn', label: 'Speak to the guard at the gate' },
    reward: { xp: 20, gold: 5 },
  },
  {
    id: 'briar-nightfall',
    name: 'Nightfall',
    giver: 'mara-venn',
    auto: true,
    zone: 'briarhollow',
    text: 'The gate held, but the grey things came over the east wall while you fought. Briarhollow is burning, and they are in the lanes.',
    objective: { kind: 'event', event: 'briar-raid', label: 'Drive the raiders out of the lanes' },
    after: ['first-steps'],
    // the night is where a new hero is armed (the Whisperwood's spoils come after it now)
    reward: { xp: 220, gold: 40, item: { rarity: 'uncommon' } },
  },
  {
    id: 'briar-the-rider',
    name: 'A Rider in the Dark',
    giver: 'mara-venn',
    auto: true,
    zone: 'briarhollow',
    text: 'Hooves on the north road, then no hooves. Someone is coming the rest of the way on foot, very slowly.',
    objective: { kind: 'event', event: 'briar-courier', label: 'Meet the rider at the north gate' },
    after: ['briar-nightfall'],
    reward: { xp: 40, gold: 10 },
  },
  {
    id: 'briar-the-seal',
    name: 'The Broken Seal',
    giver: 'mara-venn',
    auto: true,
    zone: 'briarhollow',
    text: 'A king’s courier walked the last mile in with a grey arrow in his back and a broken royal seal in his fist. He has fallen in the gateway.',
    objective: { kind: 'talk', npc: 'oskar-fell', label: 'Kneel by the courier' },
    after: ['briar-the-rider'],
    reward: { xp: 60, gold: 15, text: 'Oskar Fell dies in the gateway with his seal in your hand. Behind you, the roof of the inn catches.' },
  },
  {
    id: 'briar-the-inn',
    name: 'The Burning Inn',
    giver: 'mara-venn',
    auto: true,
    zone: 'briarhollow',
    text: 'The Bramble & Barrel is on fire with three children inside, and the hedge-mage Elyra holding the roof up over them with a ward she shouldn’t be able to cast.',
    objective: { kind: 'event', event: 'briar-inn', label: 'Lead the children from the inn to the chapel' },
    after: ['briar-the-seal'],
    reward: { xp: 240, gold: 40, item: { rarity: 'uncommon' } },
  },
  {
    id: 'briar-hold-the-door',
    name: 'Hold the Chapel Door',
    giver: 'mara-venn',
    auto: true,
    zone: 'briarhollow',
    text: 'The village is in the chapel, and the raiders are coming for the door. Mara holds the step, Elyra wards the wood. Keep them standing.',
    objective: { kind: 'event', event: 'briar-door', label: 'Hold the chapel door with Mara and Elyra' },
    after: ['briar-the-inn'],
    reward: { xp: 300, gold: 60, item: { rarity: 'rare' } },
  },
  {
    id: 'briar-below',
    name: 'What Lies Beneath',
    giver: 'mara-venn',
    auto: true,
    zone: 'briarhollow',
    text: 'The raiders stopped fighting and went to ground behind the chapel. They are digging. The old crypt stair is open beside the chapel wall.',
    objective: { kind: 'explore', spot: 'briar-crypt-stair', label: 'Find the crypt stair behind the chapel' },
    after: ['briar-hold-the-door'],
    reward: { xp: 120, gold: 20, unlock: 'crypt', text: 'The crypt under the chapel is open.' },
  },
];
