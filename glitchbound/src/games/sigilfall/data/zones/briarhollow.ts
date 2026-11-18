import { withDoorGround } from '../greatworks';
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

/** The plan's own scale: its houses, lanes and yards all grow together, so a house is a house next to a hero. */
const SPREAD = 1.4;

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

  c.prop('market-stall', 28, 25, true, CALM);
  c.prop('market-stall', 36, 25, true, CALM);
  // (and someone to sell from each, before its counter)
  c.prop('post-vendor', 28, 26, false, CALM);
  c.prop('post-vendor', 36, 26, false, CALM);

  // the guard yard by the gate: Mara's dummies
  c.fill(18, 14, 26, 18, 'path');
  c.marker(20, 15, { kind: 'dummy' });
  c.marker(23, 15, { kind: 'dummy' });
  c.marker(25, 17, { kind: 'dummy', shooter: true });

  // the chapel and its silent bell, north-east; the crypt stair opens beside it
  c.building('temple', 44, 13, 4, 4, { name: 'Chapel of the Bell', art: 'rk:chapel' });
  c.fill(44, 17, 48, 19, 'cobble');
  c.fill(40, 19, 44, 21, 'cobble');
  c.marker(49, 18, { kind: 'exit', to: 'crypt', label: 'The crypt stair, under the chapel' }, is('briar-below', 'started'));
  c.marker(48, 20, { kind: 'spot', id: 'briar-crypt-stair', name: 'The Crypt Stair', r: 2 }, is('briar-below', 'started'));
  // the chapel's own light (the owner: the people by it "can barely be seen" at night): torches either side of
  // its door, lamps at the corners of its yard, and the survivors' fire before it the night after the raid
  c.prop('iron-torch', 44, 17);
  c.prop('iron-torch', 48, 17);
  c.prop('lamp', 41, 19);
  c.prop('lamp', 51, 18);
  c.prop('campfire', 44, 19, true, NIGHT);

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
  c.fence(22, 41, 29, 41);
  c.fence(22, 48, 29, 48);
  c.fence(22, 41, 22, 48);
  c.fence(29, 41, 29, 48);
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
    // up the north road, out of the lamps' reach: where the courier comes from; and where he falls, just inside
    // the gate (his own spot: the people of the story stand where the markers below say)
    ['briar-road', 32, 3],
    ['briar-courier-falls', 32, 15],
    // the east wall's roofs, where the raiders came over
    ['briar-east-roofs', 47, 32],
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
  // after the burning begins: the chapel's side while the camera is on the bell, the east wall's as it gets there,
  // the scene starting three seconds in, once the fight at the gate has died down: data/scenes.ts briar-the-toll);
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
  // (as the camera comes to it from the courier: data/scenes.ts briar-the-inn-catches)
  c.marker(15, 20, { kind: 'fire', size: 3, delay: 2.6 }, is('briar-the-inn', 'started'));
  c.marker(17, 21, { kind: 'fire', size: 2, delay: 3.4 }, is('briar-the-inn', 'started'));

  // the people: who stands where depends on the night
  // (not while she commands the relief of Highwall and the Last March: Act IV until the camp goes home)
  c.npc('mara-venn', 31, 14, all(CALM, any(not(is('the-wall-burns', 'started')), is('epilogue-the-camp-goes-home', 'started'))));
  // the courier lies where he fell, just inside the gate
  c.npc('oskar-fell', 32, 15, is('briar-the-seal', 'active'));
  c.npc('maren', 38, 37, CALM);
  c.npc('maren', 45, 20, NIGHT);
  c.npc('old-haldor', 43, 18, CALM);
  c.npc('herbwife-thessa', 22, 37, CALM);
  c.npc('smith-hollin', 44, 24, CALM);
  c.npc('trader-ilse', 50, 24, CALM);
  c.npc('goodwife-bramble', 18, 25, CALM);
  // Elyra keeps the camp with Thessa until she goes south with the hero after the sigils (Act III): she travelled
  // with them and stood in the camp at the same time
  c.npc('elyra', 24, 23, all(CAMP, not(is('the-sun-kings-tomb', 'started'))));
  // home with Thessa after it is all over
  c.npc('elyra', 24, 36, HOME);
  c.npc('mara-venn', 47, 20, NIGHT);
  c.npc('elyra', 43, 20, NIGHT);
  c.npc('briar-oda', 24, 44, CALM);
  // The camp at dawn: the burned inn's guests under canvas, on the inn's own lawn between it and the square, their
  // cookfire before the tents. (It was three round huts set down in the square itself, one against the Elder's Hall
  // and one against the cottage behind it; the owner: "a 'warcamp' right in the middle of the square next to the
  // house". The square is the market's; the camp is a place of its own, and of canvas: these are villagers.)
  c.prop('camp-tent', 20, 21, true, CAMPED(CAMP));
  c.prop('camp-tent', 22, 20, true, CAMPED(CAMP));
  c.prop('camp-tent', 25, 21, true, CAMPED(CAMP));
  c.prop('campfire', 22, 23, true, CAMPED(CAMP));
  c.prop('bedroll', 20, 23, false, CAMPED(CAMP));
  c.prop('cauldron', 24, 22, true, CAMPED(CAMP));
  c.prop('post-traveler', 21, 23, false, all(CAMPED(CAMP), CALM));

  // the camp grows (Act I): every village the hero saves sends its people, and they stay
  // Fernstead's rangers keep a watchfire by the gate
  c.prop('campfire', 40, 15, true, CAMPED(is('camp-scouts', 'done')));
  c.prop('camp-tent', 37, 17, true, CAMPED(is('camp-scouts', 'done')));
  c.npc('ranger-cole', 39, 16, all(is('camp-scouts', 'done'), CALM, not(HOME)));
  // Millbrook's grain carts by the west road, and Tobin's hens (the sheep would not come)
  c.prop('cart', 8, 17, true, CAMPED(is('camp-grain', 'done')));
  c.prop('cart', 10, 19, true, CAMPED(is('camp-grain', 'done')));
  c.prop('hay', 7, 19, true, CAMPED(is('camp-grain', 'done')));
  c.prop('hay', 12, 16, true, CAMPED(is('camp-grain', 'done')));
  c.prop('chickens', 9, 21, false, CAMPED(is('camp-grain', 'done')));
  c.npc('carter-wenna', 11, 18, all(is('camp-grain', 'done'), CALM, not(HOME)));
  // Hearthstead's riders and their banners south-east of the square
  c.prop('flag', 41, 28, true, CAMPED(is('camp-riders', 'done')));
  c.prop('blue-banner', 44, 28, true, CAMPED(is('camp-riders', 'done')));
  c.npc('rider-alder', 42, 29, all(is('camp-riders', 'done'), CALM, not(HOME)));
  // Fernstead's people under canvas, from the Herald's ambush (the village lost) until it is taken back (Act III):
  // they are never nowhere while their quests wait
  const FERN_CAMP = all(is('the-heralds-ambush', 'done'), not(is('fern-retaken', 'done')), not(is('epilogue-the-camp-goes-home', 'done')));
  c.prop('camp-tent', 15, 32, true, FERN_CAMP);
  c.prop('camp-tent', 19, 32, true, FERN_CAMP);
  c.prop('campfire', 17, 33, true, FERN_CAMP);
  // (round the fire, before the tents: behind them, the canvas hid them)
  c.npc('warden-hollis', 16, 33, FERN_CAMP);
  c.npc('mother-alsa', 18, 33, FERN_CAMP);
  c.npc('pip-tanner', 14, 33, FERN_CAMP);
  // rebuilt (the Epilogue): market carts back in the square, lanterns on the lanes, new thatch by the inn
  c.prop('market-stall', 28, 27, true, HOME);
  c.prop('market-stall', 36, 27, true, HOME);
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
  c.fence(7, 5, 23, 5);
  c.fence(7, 10, 23, 10);
  c.fence(7, 5, 7, 10);
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
  // (the stair down to the crypt is cut into the three tiles behind its door)
  placed: withDoorGround(built.placed, 'crypt', [[-1, -3, 1, -1]]),
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
      // the Epilogue: home, and what Elyra's choice cost at the Duskspire Gate, or didn't
      { when: { quest: 'crownfall-one-hour', state: 'taken' }, lines: ['We held the Duskspire Gate for the King’s hour. Forty-one of ours fell in it. I wrote down every name.', 'Elyra says he needed that hour. I hope she’s right. Now I’m going to fix our gate. It sticks when it rains.'] },
      { when: { quest: 'crownfall-break-it', state: 'taken' }, lines: ['When the Crown broke, the Host fell down in the snow in front of our shields, all at once. Then it was quiet.', 'Now I’m going to fix our gate. It sticks when it rains.'] },
      { when: { quest: 'briar-dusk', state: 'active' }, lines: ['Stop there. The gate shuts at dusk. Eleven people have gone missing on the north road in three weeks.', 'I’m Mara Venn, the village guard. The other two guards went out to look for them. They didn’t come back either.', 'Wait. Behind you, on the road. Grey soldiers, no torches, and not a sound.', 'They’re the ones who have been taking people. Draw your weapon and stand with me!'] },
      { when: { quest: 'briar-below', state: 'active' }, lines: ['They stopped fighting us and started digging under the chapel.', 'They want whatever is down there more than they want us dead. We have to get to it first.'] },
      { when: { quest: 'the-warden', state: 'active' }, lines: ['I’ll hold the top of the stair. Nothing else comes up it while you’re down there.'] },
      { when: { quest: 'close-the-rift', state: 'active' }, lines: ['I’ll hold the top of the stair. Nothing else comes up it while you’re down there.'] },
      { when: { quest: 'the-empty-tomb', state: 'active' }, lines: ['You came up out of that crypt with Elyra shining like a lamp. Show Maren what you found. She’s waited all night.'] },
      { when: { quest: 'fern-retaken', state: 'offered' }, lines: ['Fernstead’s people have lived in tents in our camp for a week. That’s long enough.', 'Hollis’s rangers, Dunmore’s riders, you and me. We’re taking Fernstead back tonight. Will you come?'] },
      { when: { quest: 'fern-retaken', state: 'active' }, lines: ['The Host left soldiers in Fernstead’s square. They think they’ve already won. Let’s go and prove them wrong.'] },
      { when: { quest: 'the-heralds-ambush', state: 'done' }, lines: ['The Pale Herald took Elyra from right beside you, and five sigils with her. Nyx led him to her.', 'I don’t trust magic. I trusted Elyra. Whatever it costs, we bring her home.'] },
      { when: { quest: 'festival-the-champion', state: 'done' }, lines: ['Crane sold the wardens’ map to the Pale Herald. Now the Host knows every place marked on it.', 'You’re taking Elyra to those four places. Bring her back to us. I mean it.'] },
      { when: { quest: 'orders-from-the-north', state: 'done' }, lines: ['The Host has a sigil now, and Vosk is carrying it north. Somebody in the Crown City paid for his road.', 'I’ll hold the camp. You find out who opened our roads to them.'] },
      { when: { quest: 'the-empty-tomb', state: 'done' }, lines: ['We buried three this morning, and the courier. Everyone we pulled out of the inn is alive.', 'Maren wants the other villages with us. I’ll come with you when you need me, and guard the gate when you don’t.'] },
      { lines: ['The gate stays shut after dark.', 'Stay inside the wall at night. The roads aren’t safe anymore.'] },
    ],
  },
  elyra: {
    id: 'elyra',
    name: 'Elyra',
    title: 'Hedge-mage, Thessa’s apprentice',
    sprite: 'villager',
    talk: [
      // the Epilogue (the sigils spent unmaking the Crown; the lullaby given back by the bell; the rest still gone)
      { when: { quest: 'epilogue-the-bell', state: 'active' }, lines: ['Haldor is going to ring the bell at last. I want to be standing there when he does.', 'My mother used to sing me to sleep with a song. I can still hum it. I still can’t find the words.'] },
      { when: { quest: 'crownfall-break-it', state: 'taken' }, lines: ['The sigils are gone, and I’m a hedge-mage again. I keep milk fresh and wasps off the plums, and I hum my mother’s song while I work.', 'I sent Marit’s scarf home to Hearthstead with Dunmore’s riders. Somebody should get back what they lost.'] },
      { when: { quest: 'crownfall-one-hour', state: 'taken' }, lines: ['There’s a stone by the chapel now with four names on it, from a kingdom nobody remembers. I go and sit beside it.', 'Forty-one people died at the gate in that hour. I wanted it for him anyway. I think about them every day.', 'I sent Marit’s scarf home to Hearthstead with Dunmore’s riders.'] },
      { when: { quest: 'briar-below', state: 'active' }, lines: ['There’s something under the chapel. I can feel it. It’s warm, like a fire in a cold house.', 'That’s what the raiders are after. We have to reach it before they do.'] },
      { when: { quest: 'the-empty-tomb', state: 'active' }, lines: ['The sigil is inside me now. When I touched it, it sank into my hand and stayed there. It’s warm, all the time.', 'Morgrave’s journal says there are six more sigils, and a king in the north who wants them. Show it to Elder Maren.'] },
      { when: { quest: 'orders-from-the-north', state: 'done' }, lines: ['I felt the Stone leave with Vosk. It’s like hearing someone walk away in the next room, and I can’t follow.', 'One sigil for us, one for them. I hate that they have one.'] },
      { when: { quest: 'the-empty-tomb', state: 'done' }, lines: ['When the sigil went into me, it took my mother’s lullaby. I can hum it, but I can’t remember the words.', 'If the other sigils take things too, I’ll lose more. I’m coming with you anyway. The Host can’t have them.'] },
      { when: { quest: 'close-the-rift', state: 'active' }, lines: ['Tonight I held up a burning roof over three children. I don’t know how I did it.'] },
      { lines: ['Before tonight, I could only cast small wards. I kept milk from souring and wasps off the plums.', 'Then I held up a burning roof over three children. I don’t know how I did it.'] },
    ],
  },
  'oskar-fell': {
    id: 'oskar-fell',
    name: 'Oskar Fell',
    title: 'King’s courier, dying',
    sprite: 'villager',
    down: true,
    talk: [{ lines: ['Take it. It’s for the Regent, in the Crown City. I was carrying this one to her myself.', 'I wrote her eight before it. She never answered one.', 'Your chapel is in it. They’re coming for your chapel. I tried to get here first.', 'Tell her Oskar Fell rode the whole way. Tell her I didn’t stop.'] }],
  },
  maren: {
    id: 'maren',
    name: 'Elder Maren',
    title: 'Elder of Briarhollow',
    sprite: 'elder',
    talk: [
      { when: { quest: 'epilogue-the-camp-goes-home', state: 'active' }, lines: ['Look at them. They came here with nothing, and they’re going home with carts.', 'Stand with me. I want them to see us waving goodbye.'] },
      { when: { quest: 'epilogue-the-bell', state: 'active' }, lines: ['Haldor has been standing under the chapel bell since dawn. Go to him. I think he’s waiting for you.'] },
      { when: { quest: 'epilogue-the-bell', state: 'done' }, lines: ['Everyone has gone home. Briarhollow is just a village again, and that’s enough for me.', 'If you ever come back this way, the inn has a new roof. You’ll always have a bed here.'] },
      { when: { quest: 'the-last-march', state: 'started' }, lines: ['Every banner the camp ever raised has gone north to the Pale Reach. Rangers, riders, Millbrook’s lads with their pitchforks.', 'I stayed to keep the book. Come back and tell me whose names to cross out. And come back yourself.'] },
      { when: { quest: 'the-gloam-gate', state: 'done' }, lines: ['Mara sent word that Elyra is free, and five sigils are back with her. I read it out to the whole camp.', 'Now you go into the Hallow King’s own country. Nobody living has walked there in three hundred years.'] },
      { when: { quest: 'the-long-night-ends', state: 'done' }, lines: ['Highwall holds. I read Mara’s letter to the camp, and nobody said a word for a long time.', 'That’s one gate of three. Elyra is behind the next one. Bring her home.'] },
      { when: { quest: 'into-the-wood', state: 'active' }, lines: ['The Host came to us through the Whisperwood, and the beasts there have gone mad.', 'Go north while it’s light and thin them out on the trails. Our north road has to be safe.'] },
      { when: { quest: 'alpha', state: 'active' }, lines: ['The maddened beasts all follow one huge boar. The woodcutters call it Grimtusk.', 'Its den is at the east end of the Whisperwood. Kill it, and the wood will calm down.'] },
      { when: { quest: 'the-warden', state: 'active' }, lines: ['The crypt is older than the village. Its guardian, Warden Ossric, died three hundred years ago and still guards it.', 'The raiders went down there for something. Get to it before they do.'] },
      { when: { quest: 'close-the-rift', state: 'active' }, lines: ['Past the warden is the reliquary. As a girl, I was told what it holds, and told never to say.', 'It holds a piece of the Starlight Crown.', 'The raiders’ leader is down there with it now. Stop him.'] },
      { when: { quest: 'the-empty-tomb', state: 'active' }, lines: ['Morgrave’s journal says it plainly. The raiders are the Ashen Host, the army of the Hallow King.', 'Three hundred years ago, King Vaelor of Vaelmoor broke his crown to bring his dead family back. His kingdom died, and its dead became the Host.', 'Our wardens broke our own crown, the Starlight Crown, into seven sigils and hid them. Then they sealed him in Duskspire, far in the north.', 'With all seven, he breaks out. Last night he came for ours, and now it lives in Elyra. He will come back for her, with more.', 'And someone told him where to dig. That secret was kept for three hundred years.', 'So we don’t run. Briarhollow becomes a camp, and we ask Fernstead, Millbrook and Hearthstead to join it.', 'Give me the courier’s letter. I’ll dry it by the fire and find out what he died to tell the Regent.'] },
      { when: { quest: 'west-road', state: 'active' }, lines: ['Fernstead is west of here, in the Brackenridge Hills. Their dead are climbing out of the old barrows.', 'Find Warden Hollis and help her. If her rangers join us, we’ll see the Host coming.'] },
      { when: { quest: 'south-road', state: 'active' }, lines: ['Millbrook is south of here, in Thornvale. A gang called the Gallows Gang has taken its mill.', 'Find Reeve Aldous and help him free the mill. Then Millbrook can send its grain to us.'] },
      { when: { quest: 'hollow-gold', state: 'active' }, lines: ['The Herald is buying the Vale one person at a time. Morgrave. Harlan. Who else is taking his coin?', 'From now on I want to know where every coin in this camp came from.'] },
      { when: { quest: 'the-regents-council', state: 'active' }, lines: ['Someone in the Crown City is stopping Oskar’s letters. And someone told the Host where to dig. I think it’s the same person.', 'Until we know who, we ask the Crown City for nothing.', 'And there’s news from the east. Hearthstead’s marshal has written to us for help.'] },
      { when: { quest: 'refugees-on-the-road', state: 'active' }, lines: ['Hearthstead is out on the Amberfield. Take the east road out of Thornvale.', 'Dunmore writes that whole villages are walking in from the east, with the Host behind them. I want to know what it wants out there.'] },
      { when: { quest: 'fall-of-fernstead', state: 'active' }, lines: ['Fernstead has burned. Its people are coming up the west road with whatever they could carry.', 'Go and meet them. Let them see a face they know.'] },
      { when: { quest: 'fall-of-fernstead', state: 'done' }, lines: ['Fernstead burned the same night the Herald took Elyra. The Host chose that night on purpose.', 'Hollis’s people sleep under canvas by the infirmary. I’ve written every one of their names in the book.'] },
      { when: { quest: 'festival-the-champion', state: 'done' }, lines: ['Crane sold the wardens’ map. The Host knows every place on it, and it’s already digging.', 'Elyra goes with you. Thessa cried all night, and she never once asked her to stay.'] },
      { when: { quest: 'orders-from-the-north', state: 'done' }, lines: ['Rangers from Fernstead, grain from Millbrook, riders from Hearthstead. In the spring, Briarhollow stood alone.', 'Now the Host has a sigil, and someone in the Crown City paid for its road. Follow Vosk north, and find out who.'] },
      { lines: ['Every village you help sends people to the camp. I write each new name in the camp book.', 'The square fills up a little more every week. That’s your doing.'] },
    ],
  },
  'old-haldor': {
    id: 'old-haldor',
    name: 'Old Haldor',
    title: 'Bell-ringer',
    sprite: 'elder',
    talk: [
      { when: { quest: 'epilogue-the-bell', state: 'active' }, lines: ['Forty years I’ve rung that bell, and I never rang it like that.', 'Robin won’t come home. I’ve known it a long while. Thank you for standing with me while I rang it.'] },
      { when: { quest: 'epilogue-the-bell', state: 'done' }, lines: ['They heard the bell in Fernstead. Hollis sent a rider to ask what was wrong.', 'I told him the war is over. He sat down on the chapel step and wept.'] },
      { when: { quest: 'the-last-march', state: 'started' }, lines: ['Every young back in the camp has gone north with the banners. It’s old men and children in the square now.', 'I climb the tower every morning and look north. I hold the rope. I don’t pull it.'] },
      { when: { quest: 'fall-of-fernstead', state: 'done' }, lines: ['Elyra used to sit on the chapel step and hum while I oiled the bell. Now the Herald has her.', 'I hold the rope every morning. I don’t pull it. It isn’t over.'] },
      { when: { quest: 'the-empty-tomb', state: 'done' }, lines: ['I go up to the bell every morning and hold the rope.', 'My grandson Robin went out after dark three weeks ago and never came back. Then, the night of the raid, the bell rang three times on its own.', 'I won’t ring it until he’s home, or until this is over.'] },
      { lines: ['I haven’t rung the chapel bell since my grandson Robin went missing after dark.', 'The bell calls people home. I won’t ring it while it isn’t safe to come home.'] },
    ],
  },
  'herbwife-thessa': {
    id: 'herbwife-thessa',
    name: 'Herbwife Thessa',
    title: 'Healer, Elyra’s teacher',
    sprite: 'villager',
    talk: [
      { when: { quest: 'epilogue-the-bell', state: 'done' }, lines: ['When Haldor rang the bell, Elyra sang along. Every word of her mother’s lullaby came back to her.', 'The rest is still gone. She says she’ll learn my face again, one morning at a time.'] },
      { when: { quest: 'gloam-out-of-the-cells', state: 'done' }, lines: ['Elyra is free. Mara writes that she doesn’t remember the night of the fire, when she first met you. She trusts you all the same.', 'She won’t know my face when she comes home. One of the sigils took it. I’ll tell her my name, and she’ll know that.'] },
      { when: { quest: 'the-heralds-ambush', state: 'done' }, lines: ['I set out a cup for Elyra every morning. Then I remember she’s gone.', 'When you find her, tell her I’m waiting for her. Tell her that first.'] },
      { when: { quest: 'festival-the-champion', state: 'done' }, lines: ['Elyra goes with you to the places on that map. I made her promise to come home between them.', 'Every sigil takes something from her. Bring back as much of her as you can.'] },
      { when: { quest: 'the-empty-tomb', state: 'done' }, lines: ['My kitchen is the camp’s infirmary now. Mostly I treat burns.', 'That sigil is taking things from Elyra. Please bring her back to me safe.'] },
      { lines: ['I’m Thessa, the herbwife. My apprentice Elyra should have been home by now.', 'Nobody stays out after dark anymore. Not since people started vanishing.'] },
    ],
  },
  'smith-hollin': {
    id: 'smith-hollin',
    name: 'Hollin',
    title: 'Blacksmith',
    sprite: 'smith',
    shop: 'weapons',
    shopName: 'Hollin’s Forge',
    talk: [
      { when: { quest: 'the-last-march', state: 'started' }, lines: ['I forged every spearhead the camp carried north. My arms ache, and I’m proud of every one.'] },
      { when: { quest: 'fall-of-fernstead', state: 'done' }, lines: ['Maren wants two hundred spears by the spring. I sleep beside the anvil now.', 'Swords, bows and staffs, if you need them. Simple, but well made.'] },
      { when: { quest: 'orders-from-the-north', state: 'done' }, lines: ['Hearthstead’s riders brought me their lances to mend. Every head came back grey, as if it had been in ash.', 'Swords, bows and staffs. Simple, but well made.'] },
      { lines: ['Swords, bows and staffs. Simple, but well made.', 'The glowing beasts in the Whisperwood drop shards of violet glass. Bring me three, and I’ll forge you a better weapon.'] },
    ],
  },
  'trader-ilse': {
    id: 'trader-ilse',
    name: 'Ilse',
    title: 'Trader',
    sprite: 'villager',
    shop: 'armor',
    shopName: 'Ilse’s Stall',
    talk: [
      { when: { quest: 'fall-of-fernstead', state: 'done' }, lines: ['Fernstead’s people came in with nothing. I’ve given away most of the stall, and I’d do it again.', 'Coats, boots and hats. What’s left of them.'] },
      { lines: ['Coats, boots and hats. Most of it is second-hand now.'] },
    ],
  },
  'goodwife-bramble': {
    id: 'goodwife-bramble',
    name: 'Goodwife Bramble',
    title: 'Keeper of the Bramble & Barrel',
    sprite: 'villager',
    shop: 'inn',
    shopName: 'The Bramble & Barrel',
    talk: [
      { when: { quest: 'fall-of-fernstead', state: 'done' }, lines: ['I have Fernstead children sleeping in my cellar now, next to the three from the fire.', 'Potions are where they always were. Take what you need.'] },
      { when: { quest: 'the-empty-tomb', state: 'done' }, lines: ['The roof is gone, but the kettle still works. Potions are where they always were.', 'The three children from the fire are staying with me. Their mother was one of the people who vanished on the north road.'] },
      { lines: ['Potions, a bed and a hot meal. We close the shutters at sunset.'] },
    ],
  },
  'briar-tam': {
    id: 'briar-tam',
    name: 'Tam',
    title: 'A boy of the village',
    sprite: 'villager',
    talk: [
      { when: { quest: 'the-empty-tomb', state: 'done' }, lines: ['You carried Wenna out over your shoulder! I saw! Do it again!'] },
      { lines: ['Mom says don’t go past the fence. Pip went past the fence.'] },
    ],
  },
  'briar-oda': {
    id: 'briar-oda',
    name: 'Oda',
    title: 'Farmer',
    sprite: 'villager',
    talk: [
      { when: { quest: 'camp-grain', state: 'done' }, lines: ['Grain from Millbrook! Twelve carts! We won’t go hungry this winter.', 'Tobin sent his hens too.'] },
      { lines: ['The field is ready to sow, but nobody dares stay out in it after dark.'] },
    ],
  },
  /* the camp's newcomers (Act I): one for each village that sent its people */
  'ranger-cole': {
    id: 'ranger-cole',
    name: 'Cole Brannagh',
    title: 'Ranger of Fernstead, at the watchfire',
    sprite: 'villager',
    talk: [
      { when: { quest: 'fern-retaken', state: 'done' }, lines: ['Fernstead is ours again. Half of us went home with Hollis. I stayed. Somebody has to watch this road.'] },
      { when: { quest: 'fall-of-fernstead', state: 'done' }, lines: ['Fernstead is gone. My mother’s house, the Harvest Stones, all of it.', 'I keep the watch anyway. It’s the only thing I’m good for now.'] },
      { when: { quest: 'hearth-the-ram', state: 'done' }, lines: ['We sent two rangers to Hearthstead’s towers. Ansel didn’t come back.', 'Vosk’s riders went north after Hearthstead. We followed their tracks for a day. They never stopped to rest.'] },
      { when: { quest: 'the-regents-council', state: 'done' }, lines: ['We’ve seen grey riders on the Amberfield, east of here. There are more every night.', 'They’re gathering around Hearthstead.'] },
      { lines: ['Six of us came from Fernstead. We take turns watching the north road.', 'You laid the Grey Lady to rest. Keeping watch for Briarhollow is how we thank you.'] },
    ],
  },
  'carter-wenna': {
    id: 'carter-wenna',
    name: 'Wenna Holt',
    title: 'Carter, from Millbrook',
    sprite: 'villager',
    talk: [
      { when: { quest: 'fall-of-fernstead', state: 'done' }, lines: ['Millbrook sends a cart a week now. Fernstead’s people eat Millbrook bread.', 'Reeve Aldous says Millbrook won’t forget who opened its mill.'] },
      { lines: ['I drove one of the twelve grain carts up from Millbrook.', 'The mill is turning again, thanks to you. Millbrook will keep this camp fed all winter.'] },
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
    talk: [
      { when: { quest: 'the-last-march', state: 'started' }, lines: ['Mara took every rider north for the Last March but me. Someone has to ride for help if the camp is attacked.'] },
      { lines: ['Twenty of us came from Hearthstead to serve Elder Maren. We buried thirty-one of our own before we left.', 'We held the wall with you. Wherever she sends us now, we’ll ride.'] },
    ],
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
    arrive: { pets: ['fern-ranger', 'mill-carter', 'mill-carter', 'hearth-horseman'], from: 'briar-square', to: 'briar-south' },
    banner: 'Going home',
    start: [{ who: 'maren', text: 'Fernstead, Millbrook, Hearthstead! I wrote every one of you into the camp book. Now go home.' }],
    waves: [],
    end: [{ who: 'mara-venn', text: 'That’s the last of them. Briarhollow is just a village again.' }],
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
    start: [{ who: 'mara', text: 'Stand with me! Don’t let them through the gate!' }],
    waves: [
      { enemies: ['ash-raider', 'ash-raider'], from: ['briar-north'], hint: 'attack' },
      { enemies: ['ash-raider', 'ash-raider', 'ash-raider'], from: ['briar-north'], hint: 'skill', barks: [{ who: 'mara', text: 'Three more! Use your skill!' }] },
      { enemies: ['ash-archer', 'ash-raider'], from: ['briar-north'], hint: 'dodge', barks: [{ who: 'mara', text: 'Archer! Dodge when it draws!' }] },
    ],
    retry: [{ who: 'mara', text: 'Up! Back to the gate, they’re coming again!' }],
    end: [{ who: 'mara', text: 'That’s the last of them on the road. They didn’t bleed. They fell apart like cold ash.' }],
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
    // (one line: the companions leave once their last words are read, and the courier is already on the road)
    end: [{ who: 'mara', text: 'The streets are clear. A horse just stopped on the north road. Go to the gate! I’ll hold the square.' }],
  },
  // the king's courier: his horse dead on the road, he walks the last of it with an arrow in his back
  'briar-courier': {
    id: 'briar-courier',
    region: 'briarhollow',
    kind: 'arrival',
    at: 'briar-gate',
    radius: 6,
    arrive: { pets: ['courier'], from: 'briar-road', to: 'briar-courier-falls' },
    banner: 'A rider',
    start: [
      { who: 'courier', text: 'In the King’s name… the gate…' },
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
    // (the roads they name are the far side of the village: they come in from just out of sight, that way)
    close: true,
    rescue: { pets: ['briar-child', 'briar-child', 'briar-child'], at: 'briar-inn', to: 'briar-chapel', into: 'briar-chapel-door' },
    start: [
      { who: 'elyra', text: 'I can’t hold the roof much longer! Take them!' },
      { who: 'elyra', text: 'Take them to the chapel. It’s stone, so it won’t burn. Go!' },
    ],
    waves: [
      { enemies: ['ash-raider', 'ash-hound'], from: ['briar-west'] },
      { enemies: ['ash-raider', 'ash-archer', 'ash-raider'], from: ['briar-south', 'briar-north'], barks: [{ who: 'elyra', text: 'More of them! Keep the children behind you!' }] },
    ],
    retry: [{ who: 'elyra', text: 'Up! The children are hiding. We try again!' }],
    end: [
      { who: 'elyra', text: 'All three. All three!' },
      { who: 'elyra', text: 'Into the chapel, all of you, and bar the door. More of them are coming.' },
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
    close: true,
    ward: { pet: 'chapel-door', at: 'briar-chapel-door', name: 'the chapel door' },
    start: [
      { who: 'mara', text: 'They want the chapel door. Keep them away from it!' },
      { who: 'elyra', text: 'I’ll ward it as long as I can. Keep them off me!' },
    ],
    waves: [
      { enemies: ['ash-raider', 'ash-raider', 'ash-archer', 'ash-raider'], from: ['briar-north', 'briar-east'] },
      { enemies: ['ash-hound', 'ash-hound', 'ash-raider', 'ash-raider'], from: ['briar-square', 'briar-east'], barks: [{ who: 'mara', text: 'Hold the line! The door!' }] },
      { enemies: ['ash-raider', 'ash-raider', 'ash-archer', 'ash-archer', 'ash-hound', 'ash-raider'], from: ['briar-north', 'briar-square', 'briar-east'], barks: [{ who: 'elyra', text: 'My ward is cracking! I can feel every blow!' }] },
    ],
    retry: [
      { who: 'mara', text: 'The door is down! Fall back and bar it again!' },
      { who: 'elyra', text: 'I can ward it again. Just once more.' },
    ],
    end: [
      { who: 'mara', text: 'They’ve stopped. Why have they stopped?' },
      { who: 'elyra', text: 'They’re not running away. They’re going behind the chapel. They’re digging under it!' },
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
    text: 'You reach Briarhollow, a village on the edge of the Vale, as its lamps are lit. For three weeks its people have been vanishing on the roads after dark, and not one has been found. A single guard is still on watch at the north gate.',
    objective: { kind: 'talk', npc: 'mara-venn', label: 'Talk to the guard at the gate' },
    reward: { xp: 20, gold: 5 },
  },
  {
    id: 'briar-nightfall',
    name: 'Nightfall',
    giver: 'mara-venn',
    auto: true,
    zone: 'briarhollow',
    text: 'While you held the gate, more raiders climbed over the east wall. The chapel bell is ringing by itself, Briarhollow is on fire, and the grey soldiers are in the streets. Drive them out of the square.',
    objective: { kind: 'event', event: 'briar-raid', label: 'Drive the raiders out of the streets' },
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
    text: 'A horse was galloping down the north road, and then it stopped. Someone is walking the rest of the way to the gate, very slowly. Go and meet them.',
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
    text: 'The rider is a royal courier, and he has a grey arrow in his back. He has fallen in the gateway, holding a letter with a broken royal seal. He is trying to say something.',
    objective: { kind: 'talk', npc: 'oskar-fell', label: 'Kneel by the courier' },
    after: ['briar-the-rider'],
    find: {
      name: 'The Courier’s Letter',
      kind: 'letter',
      about: 'The letter Oskar Fell, the King’s courier, pressed into your hand as he died in Briarhollow’s gateway. Rain and blood have soaked through it, and only a few words can still be read. Elder Maren may be able to dry it by the fire and read the rest.',
      body: ['To Her Grace the Regent, at the Crown City…', '…this is the ninth time I have written to you, and…', '…the bell-chapel at Briarhollow…', '…they are hunting…', '…for the love of Aster, answer me.'],
      sign: 'Oskar Fell, King’s Courier',
    },
    reward: { xp: 60, gold: 15, text: 'The courier, Oskar Fell, dies in the gateway with his hand still on yours. He rode all this way to warn Briarhollow, and he came too late. Behind you, the inn’s roof catches fire.' },
  },
  {
    id: 'briar-the-inn',
    name: 'The Burning Inn',
    giver: 'mara-venn',
    auto: true,
    zone: 'briarhollow',
    text: 'The Bramble & Barrel inn is on fire with three children inside. Elyra, the herbwife’s apprentice, is holding up the roof with magic. Get the children out and take them to the stone chapel.',
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
    text: 'The villagers are hiding in the chapel, and the raiders are coming for its door. Mara is holding the steps, and Elyra is shielding the door with a ward. Keep the raiders off them.',
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
    text: 'The raiders stopped fighting and went around behind the chapel. The dying courier said they were coming for it, and now they are digging under it. The old crypt stair beside the chapel wall has been broken open.',
    objective: { kind: 'explore', spot: 'briar-crypt-stair', label: 'Find the crypt stair behind the chapel' },
    after: ['briar-hold-the-door'],
    reward: { xp: 120, gold: 20, unlock: 'crypt', text: 'The raiders have smashed the old door over the crypt stair. Cold air comes up it, and far below you can hear picks on stone. Whatever they want, it has been under Briarhollow’s chapel all along.' },
  },
];
