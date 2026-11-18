import { CityPlan } from './citygen';
import { after, any, is, not } from './cond';
import type { NpcDef, RegionDef, RegionId, StoryCond } from './types';
import type { ZoneModule } from './zones';

/**
 * Interiors (blueprint §3.2 and Prompts 2 and 12): the buildings that a door leads into, so a door that looks
 * like a door is one. Each is a small hand-laid room in the Royal Keep language, furnished in
 * the game's own style (render/art/furniture.ts), with people who talk about what has just happened in the
 * story, and furniture and banners that come and go with it. Interiors are safe, never on the world map,
 * and walked into and out of through their door.
 */

/** Briarhollow's night of the raid and the dark after it: the doors are barred (the inn is burning). */
const BRIAR_NIGHT = any(is('first-steps', 'active'), is('briar-nightfall', 'active'), is('briar-the-rider', 'active'), is('briar-the-seal', 'active'), is('briar-the-inn', 'active'), is('briar-hold-the-door', 'active'), is('briar-below', 'active'), is('the-warden', 'active'), is('close-the-rift', 'active'), is('the-empty-tomb', 'active'));
/** The Briarhollow doors open: before the raid, and from dawn on. */
export const BRIAR_DOORS_OPEN = not(BRIAR_NIGHT);
const CAMP = after('the-empty-tomb');

/**
 * A room: walls round it (two rows on the north, where the wall's face shows), a floor of planks or
 * flagstones, and the door in the middle of the south wall, leading back out.
 */
function room(w: number, h: number, seed: number, wood: boolean, door: number, out: { to: RegionId; label: string }): CityPlan {
  const c = new CityPlan(w, h, seed);
  c.fill(0, 0, w - 1, h - 1, 'wall');
  c.fill(1, 2, w - 2, h - 2, wood ? 'bridge' : 'floor');
  c.set(door, h - 1, wood ? 'bridge' : 'floor');
  c.marker(door, h - 1, { kind: 'exit', to: out.to, label: out.label, door: true });
  return c;
}

/** Wide furniture: the picture on its middle tile, and solid tiles under the rest of it. */
function wide(c: CityPlan, prop: string, x: number, y: number, tiles: number, when?: StoryCond): void {
  c.prop(prop, x, y, true, when);
  const half = Math.floor(tiles / 2);
  for (let dx = -half; dx <= half; dx++) if (dx) c.prop('block', x + dx, y, true, when);
}

const region = (id: RegionId, name: string, subtitle: string, theme: RegionDef['theme'], town: RegionId, built: ReturnType<CityPlan['build']>, npcs: string[], blurb: string): RegionDef => ({
  id,
  name,
  subtitle,
  theme,
  kind: 'town',
  interior: true,
  level: 1,
  levels: [1, 1],
  // where its town is (interiors are not drawn on the world map)
  at: town === 'emberwick' ? [44, 68] : [56, 70],
  dark: false,
  safe: true,
  // an inn or a forge plays a jig; the chapel its hymn; the Great Hall a pavane
  music: theme === 'tavern' ? 'tavern' : id === 'great-hall' ? 'court' : 'chapel',
  map: built.map,
  markers: {},
  placed: built.placed,
  holds: { exits: [town], npcs, spots: [] },
  encounters: [],
  blurb,
});

/* ------------------------------------------------------- the Bramble & Barrel */

function brambleAndBarrel(): CityPlan {
  const c = room(22, 14, 811, true, 11, { to: 'briarhollow', label: 'Out into Briarhollow' });
  // the north wall: bottles, casks, the hearth, the stair up to the rooms
  c.prop('shelf', 3, 2);
  c.prop('casks', 7, 2);
  wide(c, 'hearth', 15, 2, 3);
  c.prop('stair', 19, 2);
  c.prop('block', 19, 3);
  c.prop('rug:#7a2a2a', 15, 4, false);
  // the bar, and Hob behind it
  wide(c, 'counter', 5, 5, 3);
  c.npc('hob-bramble', 5, 3);
  // tables and stools; the long table for the camp's suppers
  for (const [x, y] of [
    [10, 7],
    [17, 7],
    [14, 10],
  ] as const) {
    c.prop('table', x, y);
    c.prop('stool', x - 1, y, false);
    c.prop('stool', x + 1, y, false);
  }
  wide(c, 'longtable', 7, 10, 3);
  c.prop('bench', 7, 11, false);
  c.prop('barrel', 1, 11);
  c.prop('barrel', 1, 12);
  c.prop('crate', 20, 12);
  c.npc('fiddler-wil', 18, 9);
  c.npc('old-jory', 11, 8);
  // from dawn on, the inn's back room sleeps the people the raid left with no roof
  c.prop('cot:#5a6a3a', 2, 7, true, CAMP);
  c.prop('cot:#6a4a7a', 2, 9, true, CAMP);
  c.marker(11, 12, { kind: 'start' });
  return c;
}

/* --------------------------------------------------------- the Chapel of the Bell */

function chapelOfTheBell(): CityPlan {
  const c = room(16, 16, 812, false, 8, { to: 'briarhollow', label: 'Out into Briarhollow' });
  wide(c, 'altar', 8, 3, 3);
  c.prop('candles', 5, 3);
  c.prop('candles', 11, 3);
  c.prop('bell-rope', 13, 2, false);
  c.prop('banner:#2a4a7a', 2, 2, false);
  c.prop('banner:#2a4a7a', 14, 2, false);
  c.prop('rug:#2a3a6a', 8, 5, false);
  for (const y of [7, 9, 11]) {
    wide(c, 'pew', 5, y, 3);
    wide(c, 'pew', 11, y, 3);
  }
  c.npc('sister-anwen', 9, 5);
  // a candle for every one of the taken, lit from the night the Herald took Elyra
  c.prop('candles', 2, 13, true, after('the-heralds-ambush'));
  c.prop('candles', 14, 13, true, after('the-heralds-ambush'));
  c.marker(8, 14, { kind: 'start' });
  return c;
}

/* ---------------------------------------------------------- the Elder's Hall */

/** The banners of the villages that sent their people to the camp, hung as each one comes (Act I–II). */
const CAMP_BANNERS: [string, string, number][] = [
  ['camp-scouts', '#3a6a3a', 2],
  ['camp-grain', '#c8a040', 4],
  ['camp-riders', '#8a2a2a', 14],
];

function eldersHall(): CityPlan {
  const c = room(19, 13, 813, true, 9, { to: 'briarhollow', label: 'Out into Briarhollow' });
  for (const [quest, col, x] of CAMP_BANNERS) c.prop(`banner:${col}`, x, 2, false, after(quest));
  c.prop('bookshelf', 9, 2);
  c.prop('cupboard', 8, 2);
  c.prop('block', 10, 2);
  // the elder's long table; from dawn on, the camp's war table with Rook's ledger beside it
  wide(c, 'longtable', 9, 6, 3, not(CAMP));
  wide(c, 'war-table', 9, 6, 3, CAMP);
  for (const x of [7, 11]) c.prop('chair', x, 8, false);
  c.prop('chair', 9, 4, false);
  c.prop('candles', 3, 8);
  c.prop('candles', 15, 8);
  c.prop('rug:#5a3a2a', 9, 9, false);
  c.npc('ledger-rook', 13, 6);
  c.marker(9, 11, { kind: 'start' });
  return c;
}

/* ------------------------------------------------------ the Crown City: the Ember Hearth */

function emberHearth(): CityPlan {
  const c = room(24, 14, 821, true, 12, { to: 'emberwick', label: 'Out into the Crown City' });
  c.prop('shelf', 3, 2);
  c.prop('casks', 7, 2);
  c.prop('casks', 11, 2);
  wide(c, 'hearth', 18, 2, 3);
  c.prop('rug:#2a4a6a', 18, 4, false);
  wide(c, 'counter', 6, 5, 3);
  for (const [x, y] of [
    [12, 7],
    [17, 8],
    [20, 6],
    [9, 10],
  ] as const) {
    c.prop('table', x, y);
    c.prop('stool', x - 1, y, false);
    c.prop('stool', x + 1, y, false);
  }
  wide(c, 'longtable', 16, 11, 3);
  c.prop('stair', 22, 3);
  c.prop('block', 22, 4);
  c.npc('minstrel-corra', 14, 4);
  c.npc('merchant-dace', 19, 10);
  // the war fills the inn with soldiers' kit (Act III–IV)
  c.prop('weapon-rack', 2, 9, true, after('the-heralds-ambush'));
  c.prop('cot:#4a5a7a', 2, 11, true, after('the-heralds-ambush'));
  c.marker(12, 12, { kind: 'start' });
  return c;
}

/* ------------------------------------------------------ the Crown City: the Great Hall */

/**
 * The Great Hall of the Ember Keep (the owner: "inside also seems empty, make it feel glorious"; then: the statues
 * lined up either side as a path to the throne, the carpets joined, all round it glorious): a long hall of
 * columns under tall windows of colored glass, their light across the floor; a floor of dark polished stone with
 * gilt seams, and between the colonnades one of ivory marble edged in gold, and down it the crimson runner from the door up the steps of the dais to the
 * high throne between its braziers, the crown's banner over it, gilt lions at the foot of the steps; either side
 * of the runner the realm's great in stone, kings, queens, knights and sages, a path of them to the throne; in the
 * aisles the old kings along the walls, armor between them, the court's long tables on their rugs.
 */
function greatHall(): CityPlan {
  const c = room(31, 26, 822, false, 15, { to: 'emberwick', label: 'Out into the Crown City' });
  // the north wall: its windows, the crown's banner over the throne, banners either side of it and between them
  for (const x of [4, 9, 21, 26]) {
    c.prop('window', x, 1);
    c.prop('sunbeam', x, 7, false);
  }
  c.prop('great-banner', 15, 1);
  for (const x of [12, 18]) c.prop('banner:#8a1a2a', x, 1);
  for (const x of [6, 24]) c.prop('banner:#2a3a7a', x, 1);
  // the floor, wall to wall (laid before the dais, which stands on it); the dais and the high throne on it, between
  // its braziers; the Steward beside it
  c.prop('hall-floor', 15, 24, false);
  c.prop('dais', 15, 5, false);
  wide(c, 'high-throne', 15, 3, 3);
  c.set(10, 4, 'brazier');
  c.set(20, 4, 'brazier');
  c.npc('steward-aldous', 19, 5);
  // the runner from the door to the dais (its carpet runs on up the steps)
  for (let y = 6; y <= 24; y++) c.prop('runner:#8a1a2a', 15, y, false);
  // gilt lions at the foot of the steps; then the path of the realm's great in stone either side of the runner, up
  // to them from the door: knights nearest the door, then sages, queens and kings nearest the throne
  c.prop('lion', 12, 6);
  c.prop('lion', 18, 6);
  for (const [y, who] of [
    [8, 'king'],
    [11, 'queen'],
    [14, 'sage'],
    [17, 'knight'],
    [20, 'knight'],
  ] as const) {
    c.prop(`statue:${who}`, 12, y);
    c.prop(`statue:${who}`, 18, y);
  }
  // the colonnades, the crown's banner on every column
  for (const y of [8, 11, 14, 17, 20]) {
    c.prop('column:#8a1a2a', 9, y);
    c.prop('column:#8a1a2a', 21, y);
  }
  // the aisles: the old kings in stone along the walls, armor between them, fires in the corners
  for (const y of [9, 15, 21]) {
    c.prop('statue', 3, y);
    c.prop('statue', 27, y);
  }
  for (const y of [12, 18]) {
    c.prop('armor-stand', 3, y);
    c.prop('armor-stand', 27, y);
  }
  c.set(3, 4, 'brazier');
  c.set(27, 4, 'brazier');
  // the long tables of the court on their rugs, and from the Night of Knives the war council's map and its racks
  c.prop('rug:#8a1a2a', 6, 13, false);
  c.prop('rug:#8a1a2a', 24, 13, false);
  wide(c, 'longtable', 6, 12, 3, not(after('festival-the-knives')));
  wide(c, 'war-table', 6, 12, 3, after('festival-the-knives'));
  wide(c, 'longtable', 24, 12, 3);
  for (const [x, y] of [
    [6, 10],
    [24, 10],
    [6, 15],
    [24, 15],
  ] as const)
    c.prop('candles', x, y);
  c.prop('weapon-rack', 6, 20, true, after('festival-the-knives'));
  c.prop('weapon-rack', 24, 20, true, after('festival-the-knives'));
  // braziers either side of the way in
  c.set(12, 23, 'brazier');
  c.set(18, 23, 'brazier');
  c.marker(14, 23, { kind: 'start' });
  return c;
}

/* ------------------------------------------------------ the Crown City: Brannoc's Forge */

function brannocsForge(): CityPlan {
  const c = room(17, 12, 823, false, 8, { to: 'emberwick', label: 'Out into the Crown City' });
  wide(c, 'forge', 8, 2, 3);
  c.prop('weapon-rack', 3, 2);
  c.prop('weapon-rack', 13, 2);
  // (a working smithy: coal by the fire, a quench bucket at the anvil, a bench of half-done work, mail on a stand)
  c.prop('coal-heap', 5, 2);
  c.prop('armor-stand', 11, 2);
  c.prop('anvil', 7, 5);
  c.prop('bucket', 9, 5);
  c.prop('table', 13, 5);
  c.prop('trough', 12, 7);
  c.prop('grindstone', 3, 7);
  c.prop('barrel', 1, 9);
  c.prop('sacks', 2, 10);
  c.prop('crate', 15, 9);
  c.prop('crate', 15, 10);
  c.npc('apprentice-kit', 5, 6);
  c.marker(8, 10, { kind: 'start' });
  return c;
}

/* ----------------------------------------------------------------- people */

const NPCS: Record<string, NpcDef> = {
  'hob-bramble': {
    id: 'hob-bramble',
    name: 'Hob Bramble',
    title: 'Behind the bar of the Bramble & Barrel',
    sprite: 'villager',
    shop: 'inn',
    shopName: 'The Bramble & Barrel',
    talk: [
      { when: { quest: 'the-long-night-ends', state: 'done' }, lines: ['Highwall held! Mom cried when she heard.', 'Every cot in the back holds someone who lost their home to the Host. They all ask about you.'] },
      { when: { quest: 'the-heralds-ambush', state: 'done' }, lines: ['Wil tried to play Elyra’s favorite song last night. He stopped halfway through.', 'Please eat something. You need it.'] },
      { when: { quest: 'camp-riders', state: 'done' }, lines: ['Hearthstead’s riders drink here every night. They’re loud, but they pay.', 'Four villages share this roof now: Briarhollow, Fernstead, Millbrook and Hearthstead.'] },
      { when: { quest: 'the-empty-tomb', state: 'done' }, lines: ['The roof only held over the bar, so everyone sleeps by the bar now.', 'The potions survived the fire. They’re on the shelf.'] },
      { lines: ['Ale, broth and a bed upstairs. Mom’s potions are on the shelf.', 'We close the shutters at sunset. People have been going missing after dark.'] },
    ],
  },
  'fiddler-wil': {
    id: 'fiddler-wil',
    name: 'Wil Tanglefoot',
    title: 'Fiddler, plays for his supper',
    sprite: 'villager',
    talk: [
      { when: { quest: 'fern-retaken', state: 'done' }, lines: ['I’m writing a song about how we took Fernstead back.', 'They say Mara Venn smiled when Fernstead’s banner went up.'] },
      { when: { quest: 'the-heralds-ambush', state: 'done' }, lines: ['They say the Pale Herald himself took Elyra at the Tear. A man in white with no face, walking out of the grey.', 'I tried to write a song about it. I couldn’t finish it.'] },
      { when: { quest: 'festival-the-champion', state: 'done' }, lines: ['Champion of Aster! I’ve already written a verse about you.', 'They say the Chancellor ran into the catacombs under the Crown City, and nobody has found him.'] },
      { when: { quest: 'orders-from-the-north', state: 'done' }, lines: ['Travelers say grey riders use the King’s Road at night, and the road wardens let them pass.', 'The roads office closed that road to everyone else. So who opened it for the Host?'] },
      { when: { quest: 'the-empty-tomb', state: 'done' }, lines: ['Elder Maren told the whole village what lay under the chapel. It was a piece of the old Starlight Crown, and the Hallow King in the north wants it.', 'This tune is for you, for pulling those children out of the fire.'] },
      { lines: ['The chapel bell hasn’t rung in three weeks. Haldor won’t ring it.', 'People have gone missing on the Whisperwood road after dark. Nobody has found a trace of them.'] },
    ],
  },
  'old-jory': {
    id: 'old-jory',
    name: 'Old Jory',
    title: 'Has had the same stool for forty years',
    sprite: 'villager',
    talk: [
      { when: { quest: 'the-long-night-ends', state: 'done' }, lines: ['My grandfather always said the dead would come out of the north one day.', 'Nobody believed him. He was right.'] },
      { when: { quest: 'the-empty-tomb', state: 'done' }, lines: ['I lost my stool in the fire. Hob made me a new one.', 'The grey raiders didn’t take gold or grain. Every hearth they passed went cold.'] },
      { lines: ['I’ve sat on this stool for forty years.', 'You’re not from around here. Sit down and have a drink.'] },
    ],
  },
  'sister-anwen': {
    id: 'sister-anwen',
    name: 'Sister Anwen',
    title: 'Keeper of the Chapel of the Bell',
    sprite: 'villager',
    talk: [
      { when: { quest: 'the-long-night-ends', state: 'done' }, lines: ['Haldor climbs the tower every morning and puts his hand on the bell. He says it isn’t over yet.', 'He’ll ring it when the war is over.'] },
      { when: { quest: 'the-heralds-ambush', state: 'done' }, lines: ['I light a candle for everyone the Host has taken. Elyra’s is the one by the door.', 'She sat on that pew as a girl. I miss her.'] },
      { when: { quest: 'the-empty-tomb', state: 'done' }, lines: ['Haldor stopped ringing the bell when his grandson went missing. Then, the night of the raid, it rang three times by itself.', 'I think the sigil under the chapel rang it, to warn us.'] },
      { lines: ['The bell hasn’t rung in three weeks. Haldor won’t ring it until his grandson comes home.', 'Sit if you need to. It’s quiet in here.'] },
    ],
  },
  'ledger-rook': {
    id: 'ledger-rook',
    name: 'Rook',
    title: 'Keeps the camp’s ledger',
    sprite: 'villager',
    talk: [
      { when: { quest: 'the-last-march', state: 'started' }, lines: ['Everyone who could carry a spear has gone north with the banners. The Elder’s book has more than four hundred names in it.', 'I’ve started a second book, for the ones who don’t come back.'] },
      { when: { quest: 'camp-riders', state: 'done' }, lines: ['There are four banners on the wall now, one for each village in the camp.', 'Elder Maren reads the list of names every night.'] },
      { when: { quest: 'camp-scouts', state: 'done' }, lines: ['Fernstead’s rangers keep our watchfire, so Fernstead’s banner hangs on the wall.', 'I write down what each village brings to the camp, and what it has lost.'] },
      { when: { quest: 'the-empty-tomb', state: 'done' }, lines: ['The Elder’s table is a war table now. I keep the records of beds, bread, arrows and names.', 'Right now the camp is one village. The Elder says the others will join us.'] },
      { lines: ['This is the Elder’s hall. I keep the village records.', 'Lately I write down more burials than births.'] },
    ],
  },
  'minstrel-corra': {
    id: 'minstrel-corra',
    name: 'Corra of the Nine Strings',
    title: 'Minstrel of the Ember Hearth',
    sprite: 'villager',
    talk: [
      { when: { quest: 'the-long-night-ends', state: 'done' }, lines: ['“The night is long, the wall is high, and Highwall did not fall.” That’s my new song.', 'The whole city is singing it already.'] },
      { when: { quest: 'the-heralds-ambush', state: 'done' }, lines: ['Nobody wants to hear songs about the Tear. I won’t write another until we win something.'] },
      { when: { quest: 'festival-the-knives', state: 'done' }, lines: ['I was in the square on the Night of Knives. The knives came for the Regent, and she didn’t run.', 'She stood still and watched you fight for her.'] },
      { when: { quest: 'sir-corvane', state: 'done' }, lines: ['A knight of the Ninefold Watch came in last night and asked for the song of the nine days.', 'Halfway through, he put his head down on the table. I sang it to the end for him.'] },
      { lines: ['I sing the songs of the Ninefold Watch, the knights who guarded the downs.', 'Hardly anyone in the city remembers them now.'] },
    ],
  },
  'merchant-dace': {
    id: 'merchant-dace',
    name: 'Dace Woolwright',
    title: 'Wool merchant, stuck in the city',
    sprite: 'villager',
    talk: [
      { when: { quest: 'festival-the-knives', state: 'done' }, lines: ['So it was the Chancellor. He closed the King’s Road to us and kept it open for the Host.', 'My wool has been stuck in this city for three months because of him.'] },
      { when: { quest: 'orders-from-the-north', state: 'done' }, lines: ['I have forty bales of wool and no road to sell them on. The roads office says the King’s Road is closed for repairs.', 'But I’ve seen grey riders use that road at night.'] },
      { lines: ['Wool, linen, and dyed silk, if you have the gold. I’d sell more if the roads were open.'] },
    ],
  },
  'steward-aldous': {
    id: 'steward-aldous',
    name: 'Steward Aldous',
    title: 'Keeper of the Ember Keep',
    sprite: 'villager',
    talk: [
      { when: { quest: 'the-gloam-gate', state: 'done' }, lines: ['The Regent slept in a bed last night, for the first time since Highwall. Elyra is free.', 'The map on the council table goes north now, past the Gloam Gate, into country nobody has drawn in three hundred years.'] },
      { when: { quest: 'the-long-night-ends', state: 'done' }, lines: ['The war council has met in this hall every night since Highwall held.', 'One gate is left between us and the Dead Kingdom: the Gloam Gate, where they keep Elyra. The Regent sleeps in her chair by the map.'] },
      { when: { quest: 'festival-the-knives', state: 'done' }, lines: ['After the Night of Knives, the court became a war council. I took the tapestries down to make room for the map.', 'The Chancellor’s chair is still at the table. Nobody sits in it.'] },
      { when: { quest: 'city-the-cellar', state: 'done' }, lines: ['The Starfall Festival is tonight, and every lord in the kingdom is in the city.', 'Be careful. The Chancellor’s men are all over the keep.'] },
      { lines: ['This is the Great Hall of the Ember Keep. The King held court here before he fell ill.'] },
    ],
  },
  'apprentice-kit': {
    id: 'apprentice-kit',
    name: 'Kit',
    title: 'Brannoc’s apprentice',
    sprite: 'villager',
    talk: [
      { when: { quest: 'festival-the-knives', state: 'done' }, lines: ['We haven’t made a plowshare since the Night of Knives. Only spears and shields.', 'Brannoc works all day and half the night.'] },
      { lines: ['I pump the bellows, quench the blades and sweep the floor.', 'Brannoc is out front, if you want to buy something.'] },
    ],
  },
};

/* ------------------------------------------------------------------ the rooms */

const build = (c: CityPlan): ReturnType<CityPlan['build']> => c.build();

export const INTERIORS: ZoneModule[] = [
  { region: region('bramble-and-barrel', 'The Bramble & Barrel', 'Briarhollow’s inn', 'tavern', 'briarhollow', build(brambleAndBarrel()), ['hob-bramble', 'fiddler-wil', 'old-jory'], 'A low warm room of casks and gossip, its hearth always lit.'), npcs: { 'hob-bramble': NPCS['hob-bramble']!, 'fiddler-wil': NPCS['fiddler-wil']!, 'old-jory': NPCS['old-jory']! }, quests: [] },
  { region: region('chapel-of-the-bell', 'Chapel of the Bell', 'Briarhollow’s chapel', 'greathall', 'briarhollow', build(chapelOfTheBell()), ['sister-anwen'], 'Pews, candles and a bell rope that swings with nobody on it.'), npcs: { 'sister-anwen': NPCS['sister-anwen']! }, quests: [] },
  { region: region('elders-hall', 'The Elder’s Hall', 'Briarhollow’s council room', 'tavern', 'briarhollow', build(eldersHall()), ['ledger-rook'], 'Where the village argued about harvests, and the camp plans a war.'), npcs: { 'ledger-rook': NPCS['ledger-rook']! }, quests: [] },
  { region: region('ember-hearth', 'The Ember Hearth', 'An inn of the Crown City', 'tavern', 'emberwick', build(emberHearth()), ['minstrel-corra', 'merchant-dace'], 'The city’s best hearth and its worst gossip.'), npcs: { 'minstrel-corra': NPCS['minstrel-corra']!, 'merchant-dace': NPCS['merchant-dace']! }, quests: [] },
  { region: region('great-hall', 'The Great Hall', 'The Ember Keep', 'greathall', 'emberwick', build(greatHall()), ['steward-aldous'], 'The king’s court hall; the Regent’s war room.'), npcs: { 'steward-aldous': NPCS['steward-aldous']! }, quests: [] },
  { region: region('brannocs-forge', 'Brannoc’s Forge', 'A smithy of the Crown City', 'tavern', 'emberwick', build(brannocsForge()), ['apprentice-kit'], 'Bellows, quench and the ring of the anvil.'), npcs: { 'apprentice-kit': NPCS['apprentice-kit']! }, quests: [] },
];

/** The doors in the towns that lead into the interiors: [region, tile x, tile y, interior, label, open while]. */
export const INTERIOR_DOORS: { town: RegionId; x: number; y: number; to: RegionId; label: string; when?: StoryCond }[] = [
  { town: 'briarhollow', x: 16, y: 24, to: 'bramble-and-barrel', label: 'The Bramble & Barrel', when: BRIAR_DOORS_OPEN },
  { town: 'briarhollow', x: 46, y: 17, to: 'chapel-of-the-bell', label: 'Chapel of the Bell', when: BRIAR_DOORS_OPEN },
  { town: 'briarhollow', x: 36, y: 36, to: 'elders-hall', label: 'The Elder’s Hall', when: BRIAR_DOORS_OPEN },
  { town: 'emberwick', x: 27, y: 50, to: 'ember-hearth', label: 'The Ember Hearth' },
  { town: 'emberwick', x: 52, y: 18, to: 'great-hall', label: 'The Great Hall' },
  { town: 'emberwick', x: 67, y: 48, to: 'brannocs-forge', label: 'Brannoc’s Forge' },
];

/** A town's doors into its interiors, as markers to add to its map. */
export const doorsOf = (town: RegionId): { tx: number; ty: number; marker: { kind: 'exit'; to: RegionId; label: string; door: true }; when?: StoryCond }[] =>
  INTERIOR_DOORS.filter((d) => d.town === town).map((d) => ({ tx: d.x, ty: d.y, marker: { kind: 'exit', to: d.to, label: d.label, door: true }, ...(d.when ? { when: d.when } : {}) }));

