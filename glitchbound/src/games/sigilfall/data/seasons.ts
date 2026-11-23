import type { Mod } from './types';

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
    keeper: { name: 'Perrin', title: 'Shrinewright', pal: { t: '#3a8ac9', T: '#1e4a7a', p: '#1a2a40', P: '#101a2a', o: '#a8e0ff', O: '#5ab8ff' }, lines: ['Even down there are holy places, if you know where to step.'] },
    title: { id: 'season-shrines', name: 'Shrinewalker' },
    built: false,
  },
  {
    mechanic: 'kinship',
    name: 'The Season of Kinship',
    short: 'In the Riftstones a set’s six-piece bonus works with four pieces on.',
    keeper: { name: 'Celandine', title: 'Setwarden', pal: { t: '#36a878', T: '#1e6a48', p: '#14301e', P: '#0e2016', o: '#a8ffd8', O: '#36e0a8' }, lines: ['Pieces of a set know each other. This month, they know each other from further off.'] },
    title: { id: 'season-kinship', name: 'Kinbound' },
    built: false,
  },
  {
    mechanic: 'borrowed',
    name: 'The Season of Borrowed Legends',
    short: 'Name one legendary you own at the keeper: its power works in the Riftstones without wearing it.',
    keeper: { name: 'Ysolt', title: 'Lorekeeper', pal: { t: '#d88a2a', T: '#8a5214', p: '#3a2410', P: '#24160a', o: '#ffe0a8', O: '#ff9a2a' }, lines: ['A legend is a story. Stories can be lent.'] },
    title: { id: 'season-legends', name: 'Legendbearer' },
    built: false,
  },
  {
    mechanic: 'boons',
    name: 'The Season of Boons',
    short: 'After each boss in a Riftstone run, choose one of three boons for the rest of the run.',
    keeper: { name: 'Ismene', title: 'Boon-giver', pal: { t: '#c8a83a', T: '#7a6420', p: '#3a3014', P: '#24200c', o: '#fff0a8', O: '#ffd84a' }, lines: ['Every boss you fell down there leaves a gift. Take the one you need.'] },
    title: { id: 'season-boons', name: 'Boonblessed' },
    built: false,
  },
  {
    mechanic: 'altar',
    name: 'The Season of Offerings',
    short: 'Offer Sigil Marks at the keeper’s altar to light ten blessings in turn, for the whole season.',
    keeper: { name: 'Brother Theodric', title: 'Altar-keeper', pal: { t: '#8a4ae0', T: '#4a2a8a', p: '#2a1a4a', P: '#1a1030', o: '#e0c8ff', O: '#b07aff' }, lines: ['Give to the altar, and the stones give back. Not always kindly, but always more.'] },
    title: { id: 'season-offerings', name: 'Altarsworn' },
    built: false,
  },
  {
    mechanic: 'bloodlust',
    name: 'The Season of Bloodlust',
    short: 'Kill quickly and keep killing: a streak makes you faster and harder-hitting, and a long one stops the clock a moment.',
    keeper: { name: 'Greta', title: 'Huntswoman', pal: { t: '#a82a2a', T: '#5a1414', p: '#2a1010', P: '#1a0a0a', o: '#ffa8a8', O: '#ff4a4a' }, lines: ['Don’t stop. The moment you stop, you are prey.'] },
    title: { id: 'season-bloodlust', name: 'Bloodbound' },
    built: false,
  },
  {
    mechanic: 'twin',
    name: 'The Season of Twin Paths',
    short: 'Put one skill of another specialization of your calling on your bar in the Riftstones.',
    keeper: { name: 'Corwen', title: 'Pathfinder', pal: { t: '#4a8a6a', T: '#2a5a40', p: '#1a3024', P: '#102018', o: '#c8ffe0', O: '#6ad8a0' }, lines: ['You walk one road. This month, the stones let you borrow a step from another.'] },
    title: { id: 'season-twin', name: 'Twin-pathed' },
    built: false,
  },
  {
    mechanic: 'nemesis',
    name: 'The Season of the Hunter',
    short: 'A hunter stalks the Riftstones: every one you beat makes you stronger for the rest of the season.',
    keeper: { name: 'Sable', title: 'Bounty-keeper', pal: { t: '#4a4a5a', T: '#2a2a3a', p: '#1a1a24', P: '#101018', o: '#d8d8e8', O: '#9a9ab8' }, lines: ['Something down there has learned your name. Make it regret that.'] },
    title: { id: 'season-hunter', name: 'Huntbreaker' },
    built: false,
  },
  {
    mechanic: 'echoes',
    name: 'The Season of Echoes',
    short: 'In the Riftstones every fifth skill you cast comes again by itself.',
    keeper: { name: 'Lisette', title: 'Echo-speaker', pal: { t: '#5ab8d8', T: '#2a6a8a', p: '#14303a', P: '#0c2028', o: '#d8f6ff', O: '#8ae0ff' }, lines: ['Listen. Everything you do down there is said twice.'] },
    title: { id: 'season-echoes', name: 'Twice-spoken' },
    built: false,
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
  { goals: [g('time-1', 'Beat the clock in a Riftstone run', 1, (s) => s.runs), g('mechanic', 'Use the season’s power (at its keeper in the Riftward)', 1, (s) => (s.mechanic ? 1 : 0))], reward: { marks: 25 } },
  { goals: [g('stone-5', 'Beat the clock at Riftstone +5', 5, (s) => s.best), g('dungeons-3', 'Beat the clock in 3 different dungeons', 3, (s) => s.dungeons)], reward: { pieces: 2 } },
  { goals: [g('stone-10', 'Beat the clock at Riftstone +10', 10, (s) => s.best), g('dungeons-6', 'Beat the clock in 6 different dungeons', 6, (s) => s.dungeons), g('flawless', 'Beat the clock without falling once', 1, (s) => s.flawless)], reward: { pieces: 2 } },
  { goals: [g('stone-15', 'Beat the clock at Riftstone +15', 15, (s) => s.best), g('dungeons-10', 'Beat the clock in 10 different dungeons', 10, (s) => s.dungeons)], reward: { pieces: 2 } },
  { goals: [g('stone-20', 'Beat the clock at Riftstone +20', 20, (s) => s.best), g('dungeons-14', 'Beat the clock in every dungeon', 14, (s) => s.dungeons)], reward: { title: true, marks: 100 } },
];
