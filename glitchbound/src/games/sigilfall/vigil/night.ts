import { SPELLS, VIGIL_MAPS, type RuleId, type StrengthId, type VigilMap } from './kit';

/**
 * Sigilfall: what makes one night of the Vigil unlike the last. The things that happen during a night (events), the
 * rule each land plays by, what a keeper earns that lasts between nights (motes, spent on boons and wild spells), and
 * the week's watch: one seed, one land and one omen for everyone. Plain data and pure functions of the seed and the
 * clock, so the host's game and a friend's agree without a word passing between them (vigil/snapshot.ts).
 */

const TAU = Math.PI * 2;

/** A number from 0 to 1 that is always the same for the same seed and pair. */
export function hash(seed: number, a: number, b = 0): number {
  let h = (seed ^ Math.imul(a | 0, 0x9e3779b1) ^ Math.imul(b | 0, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/* ---------------------------------------------------------------- the lands' rules */

export interface LandRule {
  id: RuleId;
  name: string;
  /** What it does, in a line: on the land's card, and when the night begins. */
  text: string;
}

export const RULES: Record<RuleId, LandRule> = {
  glade: { id: 'glade', name: 'Whispering Glade', text: 'Glades of light open now and then: stand in one to mend.' },
  bramble: { id: 'bramble', name: 'Creeping Bramble', text: 'Thorns sprout where you walk, cutting and slowing.' },
  rockfall: { id: 'rockfall', name: 'Loose Stone', text: 'Rocks fall on marked ground and crush the Host as well.' },
  mire: { id: 'mire', name: 'Sucking Mire', text: 'Bog pools slow everything in them; a dash gets you out.' },
  tide: { id: 'tide', name: 'The Tide', text: 'The tide brings a flood of the Host, then the sparks to you.' },
  gale: { id: 'gale', name: 'Mountain Gale', text: 'Gusts shove you about, the way the arrow shows.' },
  graves: { id: 'graves', name: 'Restless Graves', text: 'Some of the fallen get up again where they fell.' },
  storm: { id: 'storm', name: 'Scouring Wind', text: 'Sandstorms speed the Host and scatter the sparks.' },
  cold: { id: 'cold', name: 'Biting Cold', text: 'Stand still and the cold bites: keep moving.' },
  venom: { id: 'venom', name: 'Jungle Venom', text: 'Wounds keep biting for a while; meat cures them.' },
  vents: { id: 'vents', name: 'Fire Vents', text: 'Vents erupt on a rhythm and burn whatever stands on them.' },
  fade: { id: 'fade', name: 'Hollow Light', text: 'Sparks left lying fade away: gather them while they glow.' },
};
export const RULE_IDS = Object.keys(RULES) as RuleId[];

/** A rule that comes and goes on the clock: every so many seconds, from this second of the round to that one. */
export interface Phase {
  every: number;
  from: number;
  to: number;
  /** How long before it starts the keeper is told. */
  warn: number;
}
export const TIDE: Phase = { every: 44, from: 26, to: 38, warn: 3 };
export const GALE: Phase = { every: 22, from: 13, to: 19, warn: 3 };
export const STORM: Phase = { every: 42, from: 26, to: 36, warn: 3 };
export const inPhase = (t: number, p: Phase): boolean => {
  const u = t % p.every;
  return u >= p.from && u < p.to;
};
/** About to begin: the warning before it. */
export const nearPhase = (t: number, p: Phase): boolean => {
  const u = t % p.every;
  return u >= p.from - p.warn && u < p.from;
};
/** Whether the clock passed `at` seconds into a round of `every` between two moments. */
export const crossed = (was: number, now: number, every: number, at: number): boolean => Math.floor((was - at) / every) < Math.floor((now - at) / every);

/** Which way the gale blows in the round the clock is in. */
export const galeAngle = (seed: number, t: number): number => hash(seed + 31, Math.floor(t / GALE.every)) * TAU;
export const GALE_PUSH = 34;

/** A place on the ground that is always there in this night: a bog pool, a vent. */
export interface Spot {
  x: number;
  y: number;
  r: number;
  /** Its own offset on the clock, in seconds. */
  off: number;
}
export const MIRE_CELL = 150;
export const VENT_CELL = 170;
export const VENT_EVERY = 9;
export const VENT_WARN = 1.6;
/** No vent goes off in a night's first seconds. */
export const VENT_QUIET = 8;

/** The one spot a square of ground may hold, wholly inside it, so whoever stands in a square only asks about its own. */
function spotIn(seed: number, cx: number, cy: number, cell: number, chance: number, rMin: number, rMax: number): Spot | null {
  if (hash(seed, cx, cy) > chance) return null;
  return { x: (cx + 0.34 + hash(seed + 1, cx, cy) * 0.32) * cell, y: (cy + 0.34 + hash(seed + 2, cx, cy) * 0.32) * cell, r: rMin + hash(seed + 3, cx, cy) * (rMax - rMin), off: hash(seed + 4, cx, cy) * VENT_EVERY };
}
export const mireIn = (seed: number, cx: number, cy: number): Spot | null => spotIn(seed + 101, cx, cy, MIRE_CELL, 0.55, 30, 46);
export const ventIn = (seed: number, cx: number, cy: number): Spot | null => spotIn(seed + 211, cx, cy, VENT_CELL, 0.6, 30, 36);
/** Where a vent is in its round: it erupts as this wraps to nothing, and warns for the last `VENT_WARN` of it. */
export const ventClock = (s: Spot, t: number): number => (t + s.off) % VENT_EVERY;

/** Every spot within reach of a point, for the drawing. */
export function spotsNear(seed: number, kind: 'mire' | 'vents', x: number, y: number, reach: number): Spot[] {
  const cell = kind === 'mire' ? MIRE_CELL : VENT_CELL;
  const of = kind === 'mire' ? mireIn : ventIn;
  const out: Spot[] = [];
  for (let cx = Math.floor((x - reach) / cell); cx <= Math.floor((x + reach) / cell); cx++) {
    for (let cy = Math.floor((y - reach) / cell); cy <= Math.floor((y + reach) / cell); cy++) {
      const s = of(seed, cx, cy);
      if (s) out.push(s);
    }
  }
  return out;
}

/* ---------------------------------------------------------------- what happens during a night */

export type EventKind = 'pack' | 'run' | 'ring' | 'swarm' | 'lantern' | 'thief' | 'hour' | 'gilded' | 'wisps' | 'hound';

export interface EventDef {
  id: EventKind;
  name: string;
  /** What to do about it, at a glance. */
  text: string;
  /** How long it is on the card. */
  secs: number;
}

export const EVENTS: Record<EventKind, EventDef> = {
  pack: { id: 'pack', name: 'Ashsworn Pack', text: 'Fell every one of them for a chest.', secs: 45 },
  run: { id: 'run', name: 'The Wild Run', text: 'Get off the marked paths before the herd comes through.', secs: 6.5 },
  ring: { id: 'ring', name: 'The Closing Ring', text: 'They come from every side. Break through.', secs: 9 },
  swarm: { id: 'swarm', name: 'Night Swarm', text: 'A swarm pours in from one side.', secs: 9 },
  lantern: { id: 'lantern', name: 'Dawn Lantern', text: 'Stand in its light until it catches.', secs: 30 },
  thief: { id: 'thief', name: 'Spark Thief', text: 'Catch it before it slips away. It carries a chest.', secs: 20 },
  hour: { id: 'hour', name: 'The Ember Hour', text: 'Twice the Host, and twice the sparks.', secs: 18 },
  // (added after the owner played it: "the random events throughout the runs are what makes it alive right now, we
  // could add couple more variations of those")
  gilded: { id: 'gilded', name: 'The Gilded Host', text: 'Fell three in four before they scatter: they drop gold sparks.', secs: 16 },
  wisps: { id: 'wisps', name: 'The Lost Lights', text: 'Touch every light before they go out.', secs: 24 },
  hound: { id: 'hound', name: 'The Bloodhound', text: 'It hunts you alone. Fell it for a chest.', secs: 25 },
};
export const EVENT_KINDS = Object.keys(EVENTS) as EventKind[];

/** What marks out an Ashsworn pack (0 is nothing; 4 is the Spark Thief's own mark). */
export const TRAIT = { none: 0, swift: 1, stone: 2, venom: 3, thief: 4, gilded: 5, hound: 6 } as const;
export const TRAITS: Record<number, { name: string; text: string; color: string }> = {
  [TRAIT.swift]: { name: 'Swift', text: 'They are fast.', color: '#6ae0ff' },
  [TRAIT.stone]: { name: 'Stoneskin', text: 'Nothing stops or throws them.', color: '#c8c0b0' },
  [TRAIT.venom]: { name: 'Venomous', text: 'Their wounds keep biting.', color: '#8ae85a' },
};
/** The marks of what an event brings that isn't a pack: the Gilded Host's gold, the Bloodhound's red. */
export const EVENT_MARKS: Record<number, string> = { [TRAIT.gilded]: '#ffd257', [TRAIT.hound]: '#ff3a3a' };
/** How many Lost Lights there are to touch, and how many of a Gilded Host must fall. */
export const WISPS = 5;
export const GILDED_SHARE = 0.75;

export const LANTERN_R = 36;
/** Seconds of standing in the lantern's light to light it. */
export const LANTERN_HOLD = 5;
export const LANE_WARN = 1.8;
export const LANE_RUN = 1.4;
export const LANE_LEN = 560;
export const LANE_W = 20;
/** How near a caller's voice carries. */
export const RALLY_R = 78;

/* ---------------------------------------------------------------- what lasts between nights */

export type BoonId = 'hearth' | 'edge' | 'stride' | 'lode' | 'rethink';

/** A small strength a keeper carries into every night. The pictures are the relics' own (kit.ts). */
export const BOONS: Record<BoonId, { id: BoonId; name: string; text: string; icon: StrengthId }> = {
  hearth: { id: 'hearth', name: 'Hearthblood', text: '+4% health', icon: 'vigor' },
  edge: { id: 'edge', name: 'Whetted Edge', text: '+3% damage', icon: 'might' },
  stride: { id: 'stride', name: 'Sure Stride', text: '+2% move speed', icon: 'swift' },
  lode: { id: 'lode', name: 'Sparkcall', text: 'Sparks come from a little farther', icon: 'magnet' },
  rethink: { id: 'rethink', name: 'Second Thoughts', text: '+1 reroll each night', icon: 'fortune' },
};
export const BOON_IDS = Object.keys(BOONS) as BoonId[];
export const BOON_MAX = 3;
/** What each rank of a boon costs, in motes. */
export const BOON_COST: readonly number[] = [8, 20, 40];

/**
 * The wild spells: one from each free class, that a keeper of any other class can learn and carry as a seventh spell
 * their cards may offer. (None from a class sold in the shop: its spells stay its own.)
 */
export const WILD_SPELLS: readonly string[] = ['chain-spark', 'steel-tempest', 'wolf-pack', 'mending-light', 'judging-light', 'pit-imps', 'moonbeams'];
export const WILD_COST = 30;

/** What one hero carries into a night from the nights before. */
export interface HeroKit {
  boons: Partial<Record<BoonId, number>>;
  /** The wild spell carried, if any. */
  wild: string | null;
}
export const NO_KIT: HeroKit = { boons: {}, wild: null };

/** A kit from anywhere (a save, a friend's game), kept to what the game allows. */
export function cleanKit(raw: unknown): HeroKit {
  const out: HeroKit = { boons: {}, wild: null };
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as { boons?: unknown; wild?: unknown };
  if (r.boons && typeof r.boons === 'object') {
    for (const id of BOON_IDS) {
      const n = (r.boons as Record<string, unknown>)[id];
      if (typeof n === 'number' && n >= 1) out.boons[id] = Math.min(BOON_MAX, Math.floor(n));
    }
  }
  if (typeof r.wild === 'string' && WILD_SPELLS.includes(r.wild) && SPELLS[r.wild]) out.wild = r.wild;
  return out;
}

/** The wild spells a class could carry: every one but its own. */
export const wildsFor = (cls: string): string[] => WILD_SPELLS.filter((id) => SPELLS[id]?.cls !== cls);

/** What a night earns: for the time held, each champion felled and each event won. */
export interface Feats {
  champions: number;
  events: number;
}
export const motesFor = (seconds: number, feats: Feats): number => Math.floor(Math.max(0, seconds) / 30) + feats.champions * 3 + feats.events * 2;

/* ---------------------------------------------------------------- the week's watch */

const DAY = 86_400_000;
/** Weeks begin on Monday at midnight, UTC (the 5th of January 1970 was a Monday). */
export const weekOf = (now: number): number => Math.floor((now - 4 * DAY) / (7 * DAY));
export const weekEnds = (week: number): number => (week + 1) * 7 * DAY + 4 * DAY;

export interface Weekly {
  week: number;
  seed: number;
  map: VigilMap;
  /** A second rule, borrowed from another land for the week. */
  omen: RuleId;
  rules: RuleId[];
}

/** The week's watch: the same night for everyone, whoever and wherever they are. */
export function weeklyOf(week: number): Weekly {
  const seed = (Math.floor(hash(0x5161, week, 1) * 4294967296) >>> 0) || 1;
  const map = VIGIL_MAPS[Math.floor(hash(0x5161, week, 2) * VIGIL_MAPS.length)]!;
  const others = RULE_IDS.filter((r) => r !== map.rule);
  const omen = others[Math.floor(hash(0x5161, week, 3) * others.length)]!;
  return { week, seed, map, omen, rules: [map.rule, omen] };
}
/** Holding the week's watch this long earns its bounty, once a week. */
export const WEEKLY_HOLD = 180;
export const WEEKLY_BOUNTY = 15;
