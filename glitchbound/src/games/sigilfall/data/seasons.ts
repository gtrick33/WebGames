import type { Effect, Mod } from './types';

/**
 * The Rift's seasons (the owner, 2026-11-23: "a content for 10 seasons that rotates each season ... just for the
 * endgame, leveling you should leave as it is, similar to diablo we want mechanics per season that are unique and can
 * boost rift progression even further", then "too complicated for mobile ... something similar but easier?"). Each
 * calendar month is a season; ten mechanics take turns, and after the tenth the first comes back. Only the Riftstones
 * and the Riftward feel them: a season's mechanic works in Riftstone runs alone, and the campaign is as it was.
 *
 * What every season has: its mechanic (one tap or none: chosen at the season's keeper in the Riftward, or working by
 * itself), a Journey of Riftstone goals that gives a whole Rift set and the season's title (progress/season.ts), a
 * ladder of the season's best stones that starts again with each season (functions/api/sigilfall/ranks.ts, boards
 * `season:s<n>` and `season:s<n>-<calling>`), and its keeper in the Riftward. Stones opened stay open when a season
 * ends; the mechanic sleeps until it comes round again. (The Ring keeps seasons of its own, eight weeks long:
 * arena/ranks.ts. These are the Rift's.)
 *
 * The rules are taken from the seasons of other games (LEGAL_REVIEW.md); the names, the keepers and the words are
 * this game's own.
 */

export type SeasonMechanic = 'heart' | 'shrines' | 'kinship' | 'borrowed' | 'boons' | 'altar' | 'bloodlust' | 'twin' | 'nemesis' | 'echoes';

export interface SeasonDef {
  mechanic: SeasonMechanic;
  /** "The Season of Hearts". */
  name: string;
  /** What it does, in one line for the season card. */
  short: string;
  /** The Journey's first goal, as this season words it (the season's power felt once). */
  goal: string;
  /** The keeper the Riftward has for it (the NPC `rw-season` wears this season's). */
  keeper: { name: string; title: string; pal: Record<string, string>; lines: string[] };
  /** The title the season's Journey gives, kept for good. */
  title: { id: string; name: string };
  /** Built and working: a season whose mechanic isn't built yet still has its Journey, ladder and keeper. */
  built: boolean;
}

export const SEASON_LOOP: readonly SeasonDef[] = [
  {
    mechanic: 'heart',
    name: 'The Season of Hearts',
    short: 'Choose a Season Heart at the keeper: its power works in every Riftstone run, and grows with your best stone this season.',
    goal: 'Choose a Season Heart at the keeper in the Riftward',
    keeper: {
      name: 'Yvaine',
      title: 'Keeper of Hearts',
      pal: { t: '#c0304a', T: '#7a1a2e', p: '#3a1420', P: '#24101a', o: '#ffb0c0', O: '#e05a78' },
      lines: ['Every heart the stones have broken beats here once a season.', 'Choose one. It will beat for you down there, and harder the deeper you go.'],
    },
    title: { id: 'season-hearts', name: 'Heartsworn' },
    built: true,
  },
  {
    mechanic: 'shrines',
    name: 'The Season of Shrines',
    short: 'Shrines rise in every Riftstone run: walk through one for a burst of power.',
    goal: 'Walk through a shrine in a Riftstone run',
    keeper: { name: 'Perrin', title: 'Shrinewright', pal: { t: '#3a8ac9', T: '#1e4a7a', p: '#1a2a40', P: '#101a2a', o: '#a8e0ff', O: '#5ab8ff' }, lines: ['Even down there are holy places, if you know where to step.'] },
    title: { id: 'season-shrines', name: 'Shrinewalker' },
    built: true,
  },
  {
    mechanic: 'kinship',
    name: 'The Season of Kinship',
    short: 'In the Riftstones every set counts two pieces more than you wear: four on make it whole.',
    goal: 'Wear two or more pieces of a set into a Riftstone run',
    keeper: { name: 'Celandine', title: 'Setwarden', pal: { t: '#36a878', T: '#1e6a48', p: '#14301e', P: '#0e2016', o: '#a8ffd8', O: '#36e0a8' }, lines: ['Pieces of a set know each other. This month, they know each other from further off.'] },
    title: { id: 'season-kinship', name: 'Kinbound' },
    built: true,
  },
  {
    mechanic: 'borrowed',
    name: 'The Season of Borrowed Legends',
    short: 'Name one legendary you own at the keeper: its power works in the Riftstones without wearing it.',
    goal: 'Borrow a legend at the keeper in the Riftward',
    keeper: { name: 'Ysolt', title: 'Lorekeeper', pal: { t: '#d88a2a', T: '#8a5214', p: '#3a2410', P: '#24160a', o: '#ffe0a8', O: '#ff9a2a' }, lines: ['A legend is a story. Stories can be lent.'] },
    title: { id: 'season-legends', name: 'Legendbearer' },
    built: true,
  },
  {
    mechanic: 'boons',
    name: 'The Season of Boons',
    short: 'After each boss in a Riftstone run, choose one of three boons for the rest of the run.',
    goal: 'Take a boon after a boss in a Riftstone run',
    keeper: { name: 'Ismene', title: 'Boon-giver', pal: { t: '#c8a83a', T: '#7a6420', p: '#3a3014', P: '#24200c', o: '#fff0a8', O: '#ffd84a' }, lines: ['Every boss you fell down there leaves a gift. Take the one you need.'] },
    title: { id: 'season-boons', name: 'Boonblessed' },
    built: true,
  },
  {
    mechanic: 'altar',
    name: 'The Season of Offerings',
    short: 'Offer Sigil Marks at the keeper’s altar to light ten blessings in turn, for the whole season.',
    goal: 'Light a blessing at the keeper’s altar in the Riftward',
    keeper: { name: 'Brother Theodric', title: 'Altar-keeper', pal: { t: '#8a4ae0', T: '#4a2a8a', p: '#2a1a4a', P: '#1a1030', o: '#e0c8ff', O: '#b07aff' }, lines: ['Give to the altar, and the stones give back. Not always kindly, but always more.'] },
    title: { id: 'season-offerings', name: 'Altarsworn' },
    built: true,
  },
  {
    mechanic: 'bloodlust',
    name: 'The Season of Bloodlust',
    short: 'Kill quickly and keep killing: a streak makes you faster and harder-hitting, and a long one stops the clock a moment.',
    goal: 'Reach a streak of 10 kills in a Riftstone run',
    keeper: { name: 'Greta', title: 'Huntswoman', pal: { t: '#a82a2a', T: '#5a1414', p: '#2a1010', P: '#1a0a0a', o: '#ffa8a8', O: '#ff4a4a' }, lines: ['Don’t stop. The moment you stop, you are prey.'] },
    title: { id: 'season-bloodlust', name: 'Bloodbound' },
    built: true,
  },
  {
    mechanic: 'twin',
    name: 'The Season of Twin Paths',
    short: 'Put one skill of another specialization of your calling on your bar in the Riftstones.',
    goal: 'Choose a twin path at the keeper in the Riftward',
    keeper: { name: 'Corwen', title: 'Pathfinder', pal: { t: '#4a8a6a', T: '#2a5a40', p: '#1a3024', P: '#102018', o: '#c8ffe0', O: '#6ad8a0' }, lines: ['You walk one road. This month, the stones let you borrow a step from another.'] },
    title: { id: 'season-twin', name: 'Twin-pathed' },
    built: true,
  },
  {
    mechanic: 'nemesis',
    name: 'The Season of the Hunter',
    short: 'A hunter stalks the Riftstones: every one you beat makes you stronger for the rest of the season.',
    goal: 'Beat the Hunter in a Riftstone run',
    keeper: { name: 'Sable', title: 'Bounty-keeper', pal: { t: '#4a4a5a', T: '#2a2a3a', p: '#1a1a24', P: '#101018', o: '#d8d8e8', O: '#9a9ab8' }, lines: ['Something down there has learned your name. Make it regret that.'] },
    title: { id: 'season-hunter', name: 'Huntbreaker' },
    built: true,
  },
  {
    mechanic: 'echoes',
    name: 'The Season of Echoes',
    short: 'In the Riftstones every fifth skill you cast comes again by itself.',
    goal: 'Hear a skill echo in a Riftstone run',
    keeper: { name: 'Lisette', title: 'Echo-speaker', pal: { t: '#5ab8d8', T: '#2a6a8a', p: '#14303a', P: '#0c2028', o: '#d8f6ff', O: '#8ae0ff' }, lines: ['Listen. Everything you do down there is said twice.'] },
    title: { id: 'season-echoes', name: 'Twice-spoken' },
    built: true,
  },
];

/** The first season begins on 1 December 2026 (the owner: "1st of each month"); before it, the first is coming. */
export const SEASON_EPOCH = Date.UTC(2026, 11, 1);

/** Months since the first season's (0 for its own month), from a time; negative before it. */
const monthIndex = (ms: number): number => {
  const d = new Date(ms);
  const e = new Date(SEASON_EPOCH);
  return (d.getUTCFullYear() - e.getUTCFullYear()) * 12 + (d.getUTCMonth() - e.getUTCMonth());
};

/** The start of a season (its first day, midnight UTC). */
export const seasonStart = (n: number): number => {
  const e = new Date(SEASON_EPOCH);
  return Date.UTC(e.getUTCFullYear(), e.getUTCMonth() + n - 1, 1);
};

/** A season's own definition: the loop of ten, round and round. */
export const seasonDef = (n: number): SeasonDef => SEASON_LOOP[(((n - 1) % SEASON_LOOP.length) + SEASON_LOOP.length) % SEASON_LOOP.length]!;

export interface SeasonNow {
  /** The season's number: 1 for December 2026, and one more every month. */
  n: number;
  def: SeasonDef;
  start: number;
  end: number;
}

/** The season running at a time, or null before the first. */
export function seasonAt(ms: number): SeasonNow | null {
  const i = monthIndex(ms);
  if (i < 0) return null;
  const n = i + 1;
  return { n, def: seasonDef(n), start: seasonStart(n), end: seasonStart(n + 1) };
}

/** When the next season begins (the first one's start, before it). */
export const nextSeasonAt = (ms: number): number => {
  const now = seasonAt(ms);
  return now ? now.end : SEASON_EPOCH;
};

/* --------------------------------------------------------------- Season 1: Hearts */

export type HeartId = 'fury' | 'ward' | 'storm' | 'greed';

export interface HeartDef {
  id: HeartId;
  name: string;
  color: string;
  /** What it does at a rank, in words. */
  text: (rank: number) => string;
  /** What it adds to the hero in a Riftstone run, at a rank. */
  mods: (rank: number) => Mod[];
}

/** More damage on every skill (on top of the gear's power, which a share of power would hardly move at the top). */
const harder = (pct: number): Mod => ({ t: 'skill', skill: '*', op: { op: 'damage', pct } });

/** The heart's rank: 1, and one more for every five stones of the season's best timed run (up to 8, from +35). */
export const HEART_MAX = 8;
export const heartRank = (best: number): number => Math.max(1, Math.min(HEART_MAX, 1 + Math.floor(Math.max(0, best) / 5)));

/** The Greed heart's extra items in a run's cache and its Sigil Marks (world.ts finishKeyRun). */
export const greedCache = (rank: number): number => (rank >= 6 ? 2 : rank >= 3 ? 1 : 0);
export const greedMarks = (rank: number): number => 10 * rank;

export const HEARTS: Record<HeartId, HeartDef> = {
  fury: {
    id: 'fury',
    name: 'Heart of Fury',
    color: '#ff5a4a',
    text: (r) => `Every skill deals ${30 + 15 * r}% more damage, and every kill mends you for 3% of your health.`,
    mods: (r) => [harder(30 + 15 * r), { t: 'proc', proc: { id: 'heart-fury', on: 'kill', chance: 1, icd: 0.2, effect: { kind: 'heal', pct: 3 }, text: 'Every kill mends you a little.' } }],
  },
  ward: {
    id: 'ward',
    name: 'Heart of the Ward',
    color: '#5ab8ff',
    text: (r) => `Every 3 s in a fight, a shield of ${20 + 3 * r}% of your health for 4 s, and every skill deals ${10 + 2 * r}% more damage.`,
    mods: (r) => [
      harder(10 + 2 * r),
      { t: 'proc', proc: { id: 'heart-ward', on: 'tick', chance: 1, icd: 3, effect: { kind: 'shield', pct: 20 + 3 * r, dur: 4 }, text: 'Every 3 s in a fight: a ward of blue light.' } },
    ],
  },
  storm: {
    id: 'storm',
    name: 'Heart of the Storm',
    color: '#bfa8ff',
    text: (r) => `Every 2 s in a fight, lightning bursts around you for ${Math.round((6 + 3 * r) * 100)}% damage and Shocks what it strikes (12% more damage taken).`,
    mods: (r) => [
      {
        t: 'proc',
        proc: {
          id: 'heart-storm',
          on: 'tick',
          chance: 1,
          icd: 2,
          effect: { kind: 'nova', radius: 70, mul: 6 + 3 * r, ref: true, dmgType: 'lightning', status: { status: 'shock', dur: 3, power: 12 } },
          text: 'Every 2 s in a fight: lightning bursts around you.',
        },
      },
    ],
  },
  greed: {
    id: 'greed',
    name: 'Heart of Greed',
    color: '#ffd84a',
    text: (r) => `Every skill deals ${15 + 4 * r}% more damage; +${greedMarks(r)}% Sigil Marks from a run${greedCache(r) ? `, and ${greedCache(r)} more ${greedCache(r) === 1 ? 'item' : 'items'} in a run’s cache` : ' (and more in a run’s cache from rank 3)'}.`,
    mods: (r) => [harder(15 + 4 * r)],
  },
};

export const HEART_IDS = Object.keys(HEARTS) as HeartId[];

/* --------------------------------------------------------------- the Journey */

/** What a season's Journey counts (progress/season.ts keeps it, hero by hero). */
export interface JourneyGoal {
  id: string;
  text: string;
  /** How far along it is, out of `need`. */
  of: (s: { best: number; runs: number; dungeons: number; flawless: number; mechanic: boolean }) => number;
  need: number;
}

export interface JourneyChapter {
  goals: JourneyGoal[];
  /** What it gives: Sigil Marks, two pieces of the hero's chosen Rift set (in slot order), or the season's title. */
  reward: { marks?: number; pieces?: 2; title?: true };
}

const g = (id: string, text: string, need: number, of: JourneyGoal['of']): JourneyGoal => ({ id, text, need, of });

export const JOURNEY: readonly JourneyChapter[] = [
  { goals: [g('time-1', 'Beat the clock in a Riftstone run', 1, (s) => s.runs), g('mechanic', 'Use the season’s power', 1, (s) => (s.mechanic ? 1 : 0))], reward: { marks: 25 } },
  { goals: [g('stone-5', 'Beat the clock at Riftstone +5', 5, (s) => s.best), g('dungeons-3', 'Beat the clock in 3 different dungeons', 3, (s) => s.dungeons)], reward: { pieces: 2 } },
  { goals: [g('stone-10', 'Beat the clock at Riftstone +10', 10, (s) => s.best), g('dungeons-6', 'Beat the clock in 6 different dungeons', 6, (s) => s.dungeons), g('flawless', 'Beat the clock without falling once', 1, (s) => s.flawless)], reward: { pieces: 2 } },
  { goals: [g('stone-15', 'Beat the clock at Riftstone +15', 15, (s) => s.best), g('dungeons-10', 'Beat the clock in 10 different dungeons', 10, (s) => s.dungeons)], reward: { pieces: 2 } },
  { goals: [g('stone-20', 'Beat the clock at Riftstone +20', 20, (s) => s.best), g('dungeons-14', 'Beat the clock in every dungeon', 14, (s) => s.dungeons)], reward: { title: true, marks: 100 } },
];

/* --------------------------------------------------------------- Season 2: Shrines */

export type ShrineId = 'might' | 'haste' | 'ward' | 'thunder';

export interface ShrineDef {
  id: ShrineId;
  name: string;
  color: string;
  /** Its light's second color (the shaft's core). */
  core: string;
  text: string;
}

/** How long a shrine's power lasts, and how many rise in a run. */
export const SHRINE_TIME = 20;
export const SHRINES_PER_RUN = 2;

export const SHRINES: Record<ShrineId, ShrineDef> = {
  might: { id: 'might', name: 'Shrine of Might', color: '#ff6a3a', core: '#ffd8a0', text: 'Every blow lands twice as hard for 20 s.' },
  haste: { id: 'haste', name: 'Shrine of Haste', color: '#4ae08a', core: '#d8ffe8', text: 'Move and cast 40% faster for 20 s.' },
  ward: { id: 'ward', name: 'Shrine of the Ward', color: '#5ab8ff', core: '#e0f4ff', text: 'Take 60% less damage for 20 s.' },
  thunder: { id: 'thunder', name: 'Shrine of Thunder', color: '#c88aff', core: '#f4e8ff', text: 'Lightning leaps from you into everything near, twice a second, for 20 s.' },
};
export const SHRINE_IDS = Object.keys(SHRINES) as ShrineId[];

/* --------------------------------------------------------------- Season 3: Kinship */

/** The pieces a set counts as having beyond those worn, in a Riftstone run of the Season of Kinship (at most six). */
export const KINSHIP_EXTRA = 2;

/* --------------------------------------------------------------- Season 5: Boons */

export interface BoonDef {
  id: string;
  name: string;
  color: string;
  text: string;
  /** What it adds to the hero for the rest of the run. */
  mods?: Mod[];
  /** Done by the run itself (sim/season.ts): a fall undone, kills off the clock, a richer cache, a lasting ward. */
  special?: 'revive' | 'time' | 'fortune' | 'bulwark' | 'echo';
}

const proc = (id: string, on: 'tick' | 'kill', icd: number, effect: Effect, text: string): Mod => ({ t: 'proc', proc: { id, on, chance: 1, icd, effect, text } });

export const BOONS: readonly BoonDef[] = [
  { id: 'wrath', name: 'Wrath', color: '#ff5a4a', text: 'Every skill deals 40% more damage.', mods: [harder(40)] },
  { id: 'bloodletting', name: 'Bloodletting', color: '#e0304a', text: 'Every kill mends you for 3% of your health.', mods: [proc('boon-bloodletting', 'kill', 0.15, { kind: 'heal', pct: 3 }, 'Every kill mends you.')] },
  { id: 'second-wind', name: 'Second Wind', color: '#ffe066', text: 'The next time you would fall, you rise at once with half your health.', special: 'revive' },
  { id: 'quicksilver', name: 'Quicksilver', color: '#7ae0ff', text: 'Move and cast 25% faster.', mods: [{ t: 'stat', stat: 'speed', v: 25 }, { t: 'stat', stat: 'haste', v: 25 }] },
  { id: 'bulwark', name: 'Bulwark', color: '#b8b8c8', text: 'Take 20% less damage.', special: 'bulwark' },
  { id: 'chain-reaction', name: 'Chain Reaction', color: '#ff9a2a', text: 'Enemies burst when they die, hurting everything near them.', mods: [proc('boon-chain', 'kill', 0.1, { kind: 'explode', radius: 46, mul: 4, dmgType: 'fire' }, 'Enemies burst when they die.')] },
  { id: 'storm-crown', name: 'Crown of Storms', color: '#bfa8ff', text: 'Every 2 s in a fight, lightning bursts around you.', mods: [proc('boon-storm', 'tick', 2, { kind: 'nova', radius: 64, mul: 8, ref: true, dmgType: 'lightning', status: { status: 'shock', dur: 3, power: 10 } }, 'Every 2 s in a fight: lightning bursts around you.')] },
  { id: 'echoing', name: 'Echoing', color: '#8ae0ff', text: 'Every 6 s in a fight, your specialization’s own skill comes again by itself.', special: 'echo' },
  { id: 'overcharge', name: 'Overcharge', color: '#ffd84a', text: 'Your ultimate charges 50% faster.', mods: [{ t: 'stat', stat: 'ultCharge', v: 50 }] },
  { id: 'time-thief', name: 'Time Thief', color: '#5ae0c8', text: 'Every kill takes a third of a second off the clock.', special: 'time' },
  { id: 'fortune', name: 'Fortune', color: '#ffc84a', text: 'Two more items in the run’s cache, and a quarter more Sigil Marks.', special: 'fortune' },
  { id: 'keen-edge', name: 'Keen Edge', color: '#ffffff', text: '+20% critical strike chance.', mods: [{ t: 'stat', stat: 'crit', v: 20 }] },
];
export const BOON_BY_ID: Record<string, BoonDef> = Object.fromEntries(BOONS.map((b) => [b.id, b]));
/** Seconds a Time Thief kill takes off the clock. */
export const THIEF_TIME = 1 / 3;

/* --------------------------------------------------------------- Season 6: Offerings */

export interface BlessingDef {
  /** Sigil Marks it takes to light. */
  cost: number;
  text: string;
  mods?: Mod[];
  /** Done at a run's start or end (sim/world.ts): more in the cache, more marks, a longer clock, a stone more. */
  cache?: number;
  marks?: number;
  clock?: number;
  up?: number;
}

export const BLESSINGS: readonly BlessingDef[] = [
  { cost: 20, text: 'Every skill deals 10% more damage.', mods: [harder(10)] },
  { cost: 30, text: '+10% health.', mods: [{ t: 'stat', stat: 'hpPct', v: 10 }] },
  { cost: 40, text: 'One more item in every Riftstone cache.', cache: 1 },
  { cost: 50, text: 'Every skill deals 10% more damage.', mods: [harder(10)] },
  { cost: 60, text: '+25% Sigil Marks from every run.', marks: 25 },
  { cost: 70, text: '+10% health.', mods: [{ t: 'stat', stat: 'hpPct', v: 10 }] },
  { cost: 80, text: 'Every skill deals 15% more damage.', mods: [harder(15)] },
  { cost: 90, text: 'The clock gives you 5% more time.', clock: 5 },
  { cost: 100, text: 'One more item in every Riftstone cache.', cache: 1 },
  { cost: 120, text: 'A run beaten in time opens one stone more.', up: 1 },
];

/* --------------------------------------------------------------- Season 7: Bloodlust */

/** Seconds a kill keeps the streak alive; each stack's damage (%) and speed; the most stacks; the kills that buy time back. */
export const STREAK_WINDOW = 3;
export const STREAK_DMG = 2;
export const STREAK_SPEED = 1;
export const STREAK_MAX = 20;
export const STREAK_TIME_EVERY = 50;
export const STREAK_TIME = 10;

/* --------------------------------------------------------------- Season 9: the Hunter */

/** The hunter's health against the room's own (many times a strong foe's), and the most the season's trophies give. */
export const HUNTER_HP = 8;
export const HUNTER_DMG = 1.3;
export const HUNT_MAX = 30;
/** Seconds into a run (out of the first room) before the hunter finds the hero. */
export const HUNTER_AFTER = 45;

/* --------------------------------------------------------------- Season 10: Echoes */

/** Every this many skills cast, the last comes again by itself. */
export const ECHO_EVERY = 5;
