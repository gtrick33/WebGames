import { CityPlan } from '../citygen';
import { seasonDef, type SeasonNow } from '../seasons';
import type { NpcDef, QuestDef, RegionDef } from '../types';

/**
 * The Riftward: where the Riftstone is run, and only here (the owner, 2026-11-22: "dedicated riftstone zone - the quest
 * should lead you there - zone with all the merchants etc", "starting a riftstone ... should be done only through the
 * dedicated zone"). A walled sanctuary the wardens raised round a tear the Ash Crown left in the world: the Riftgate in
 * its square, ringed by standing stones and braziers, the Keeper of the Riftgate beside it; round the square every merchant
 * a hero at the top needs (the Riftbroker's marks and wagers, a smith, an armorer, a curio dealer, an inn and a mystic to
 * reset talents) and a waystone home. Opened by the postgame's quest (data/story.ts, "The Stone That Remembers"), and
 * where a hero chosen in the main menu's Riftstone mode wakes (ui/RiftScreen.tsx).
 */
function plan(): CityPlan {
  const c = new CityPlan(56, 46, 4471);
  c.woods(2, 4);
  c.walls(5, 4, 50, 41);
  c.building('tower', 4, 3, 3, 3, { pave: false });
  c.building('tower', 49, 3, 3, 3, { pave: false });
  c.building('tower', 4, 40, 3, 3, { pave: false });
  c.building('tower', 49, 40, 3, 3, { pave: false });

  // the square, and the Riftgate in its middle: a ring of standing stones round a dais, braziers between them
  c.fill(16, 14, 39, 31, 'cobble');
  c.fill(26, 32, 29, 40, 'cobble');
  for (const [x, y] of [
    [24, 18],
    [31, 18],
    [22, 22],
    [33, 22],
    [24, 26],
    [31, 26],
  ] as const)
    c.prop('standing-stone', x, y);
  for (const [x, y] of [
    [27, 17],
    [28, 27],
    [21, 20],
    [34, 24],
  ] as const)
    c.prop('brazier', x, y);
  c.marker(27, 21, { kind: 'place', id: 'rift-gate' });
  c.npc('riftkeeper', 28, 23);
  // the season's keeper, by the square's south-west stone (data/seasons.ts: each season dresses them as its own)
  c.npc('rw-season', 20, 28);
  c.marker(27, 29, { kind: 'waystone' });
  c.marker(28, 34, { kind: 'start' });
  for (const [x, y] of [
    [17, 15],
    [38, 15],
    [17, 30],
    [38, 30],
  ] as const)
    c.prop('lamp', x, y);

  // the merchants round the square: the broker's tower, the forge, the armory, the curio shop, the inn, the shrine
  c.building('tower', 9, 9, 4, 4, { npc: 'rw-broker', name: 'The Broker’s Tower' });
  c.building('smithy', 18, 7, 6, 4, { npc: 'rw-smith', name: 'Riftward Forge' });
  c.building('shop', 31, 7, 6, 4, { npc: 'rw-armorer', name: 'The Warden’s Armory' });
  c.building('temple', 42, 8, 6, 5, { npc: 'rw-mystic', name: 'Shrine of the Eight' });
  c.building('shop', 9, 22, 5, 4, { npc: 'rw-curios', name: 'Stones & Settings' });
  c.building('inn', 42, 22, 6, 5, { npc: 'rw-innkeeper', name: 'The Last Lantern' });
  c.prop('anvil', 25, 12);
  c.prop('weapon-rack', 16, 12);
  c.prop('market-stall', 33, 33, true);
  c.prop('crate', 35, 33);
  c.prop('barrel', 36, 33);
  for (const x of [20, 35]) c.prop('blue-banner', x, 13, false);
  c.plant(6, 33, 24, 40, 0.04, 0.15);
  c.plant(32, 34, 49, 40, 0.04, 0.15);
  c.lamps(26, 33, 26, 40, 4);
  c.lamps(29, 33, 29, 40, 4);
  return c;
}

const built = plan().build();

export const RIFTWARD: RegionDef = {
  id: 'riftward',
  name: 'The Riftward',
  subtitle: 'Where the Riftstone is run',
  theme: 'rift',
  kind: 'town',
  level: 60,
  levels: [60, 60],
  at: [62, 18],
  dark: true,
  safe: true,
  music: 'riftward',
  map: built.map,
  markers: {},
  placed: built.placed,
  encounters: [],
  blurb: 'The wardens’ sanctuary round the Riftgate: the Keeper of the Riftgate, the Riftbroker, a forge, an armory, curios, an inn and a shrine.',
};

/** The Riftward's people: the Keeper at the gate, and every merchant a hero at the top needs. */
export const RIFTWARD_NPCS: Record<string, NpcDef> = {
  // the season's keeper (dressed as the season running by dressSeasonKeeper; the first season's until then)
  'rw-season': {
    id: 'rw-season',
    name: seasonDef(1).keeper.name,
    title: seasonDef(1).keeper.title,
    sprite: 'mystic',
    service: 'season',
    pal: seasonDef(1).keeper.pal,
    talk: [{ lines: seasonDef(1).keeper.lines }],
  },
  riftkeeper: {
    id: 'riftkeeper',
    name: 'Keeper Isolde',
    title: 'Keeper of the Riftgate',
    sprite: 'mystic',
    service: 'rift',
    pal: { t: '#8a4ae0', T: '#4a2a8a', p: '#2a1a4a', P: '#1a1030', o: '#c8a8ff', O: '#8a6ad8' },
    talk: [
      { when: { quest: 'postgame-the-riftward', state: 'active' }, lines: ['You carry a splinter of the Crown. I can feel it from here.', 'Show it to me.'] },
      { lines: ['The Gate is open to you. Hold your stone to it and choose a memory: any dungeon the Crown fed on, against the clock.', 'Beat the clock and the stone opens deeper memories. Fall behind and you lose nothing but time.'] },
    ],
  },
  'rw-broker': {
    id: 'rw-broker',
    name: 'Vashti',
    title: 'Riftbroker',
    sprite: 'elder',
    shop: 'quartermaster',
    shopName: 'The Riftbroker',
    pal: { g: '#5a2a9a', G: '#2a1a5a', w: '#3a2a4a', W: '#1e1428' },
    talk: [{ lines: ['Sigil Marks for the best gear there is, or a wager on a piece unseen.', 'The higher your stone, the better what I turn over.'] }],
  },
  'rw-smith': {
    id: 'rw-smith',
    name: 'Dunstan',
    title: 'Smith',
    sprite: 'smith',
    shop: 'weapons',
    shopName: 'Riftward Forge',
    service: 'smith',
    talk: [{ lines: ['Weapons for your hands, made to your level. Gear you don’t want, I’ll buy.'] }],
  },
  'rw-armorer': {
    id: 'rw-armorer',
    name: 'Brienne',
    title: 'Armorer',
    sprite: 'smith',
    shop: 'armor',
    shopName: 'The Warden’s Armory',
    pal: { h: '#3a3a4a', H: '#5a5a6a', a: '#5a4a78', A: '#3a2a58', c: '#d8dce6' },
    talk: [{ lines: ['Helms, armor, gloves and boots. The Riftgate chews through steel; come back often.'] }],
  },
  'rw-curios': {
    id: 'rw-curios',
    name: 'Orrin',
    title: 'Curio dealer',
    sprite: 'mystic',
    shop: 'curios',
    shopName: 'Stones & Settings',
    pal: { t: '#4a9ac9', T: '#2a5a8a', p: '#3a6a8a', P: '#24405a', o: '#ffe066', O: '#ffaa22' },
    talk: [{ lines: ['Rings, amulets, relics. Some remember a little of the Riftgate.'] }],
  },
  'rw-innkeeper': {
    id: 'rw-innkeeper',
    name: 'Hesper',
    title: 'Innkeeper',
    sprite: 'villager',
    shop: 'inn',
    shopName: 'The Last Lantern',
    pal: { y: '#7a4ac9', Y: '#4a2a8a', b: '#a85a3a', B: '#7a3a20' },
    talk: [{ lines: ['Potions for the clock. Nobody runs the Gate without a full belt twice.'] }],
  },
  'rw-mystic': {
    id: 'rw-mystic',
    name: 'Sister Amaranth',
    title: 'Mystic',
    sprite: 'mystic',
    service: 'respec',
    talk: [{ lines: ['I can reset your talents for a little gold, before you try a deeper stone.'] }],
  },
};

export const RIFTWARD_QUESTS: QuestDef[] = [];

/**
 * Dresses the season's keeper as the season running (or, before the first, as the first, saying when it begins):
 * their name, their colors, what they say. Called whenever the Riftward is entered.
 */
export function dressSeasonKeeper(now: SeasonNow | null): void {
  const npc = RIFTWARD_NPCS['rw-season']!;
  const def = now?.def ?? seasonDef(1);
  npc.name = def.keeper.name;
  npc.title = def.keeper.title;
  npc.pal = def.keeper.pal;
  npc.talk = [{ lines: now ? def.keeper.lines : ['The first season of the stones begins on the first of December.', 'Come back then. I will have a heart for you.'] }];
}
