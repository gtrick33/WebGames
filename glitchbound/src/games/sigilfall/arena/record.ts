import { CLASSES, CLASS_IDS } from '../data/classes';
import type { ClassId } from '../data/types';
import { RING_KEY, type Format, type Standing } from './ranks';
import type { BestMoment } from './sim';

/**
 * The Ring's record, what keeps a player coming back past their first evening (the plan the owner took up: "daily
 * and weekly challenges, class mastery, seasons and match history", behind one entry on the main screen so that it
 * stays clear for a newcomer). Pure, apart from reading the Ring's save for the titles it gives.
 *
 * - Challenges: three a day and three a week, the same for everyone on the same day (drawn from the date), counted
 *   from rated matches only, so that they aren't farmed in a room of friends.
 * - Class mastery: rated wins with each class. 15 and 50 give that class's titles.
 * - Seasons: eight weeks each. When one turns, every format's rating comes halfway back toward 1000 (so there is a
 *   climb again) and the best each format reached that season is kept; the best ever reached is never touched, and
 *   with it every rank's title and armor (arena/rewards.ts).
 * - History: the last twenty matches, rated or friendly.
 */

/** One match as the history keeps it. */
export interface MatchEntry {
  at: number;
  format: Format;
  cls: ClassId;
  won: boolean;
  draw: boolean;
  /** The rating it moved, and to what (a friendly match: none). */
  change: number | null;
  rating: number | null;
  dmg: number;
  heal: number;
  combos: number;
  kicks: number;
  best?: BestMoment;
  rival?: string;
}

/** A day's or a week's challenges: which period, how far along each is, which are done. */
export interface ChallengeRun {
  key: string;
  got: Record<string, number>;
  done: string[];
  /** For "with three classes" and "every format": what has been counted so far. */
  seen?: string[];
}

export interface SeasonRecord {
  n: number;
  /** The best rating each format reached this season. */
  best: Partial<Record<string, number>>;
  /** Seasons gone by, newest first: their number and the best each format reached. */
  past: { n: number; best: Partial<Record<string, number>> }[];
}

export interface RingRecord {
  history?: MatchEntry[];
  mastery?: Partial<Record<ClassId, { wins: number; played: number }>>;
  daily?: ChallengeRun;
  weekly?: ChallengeRun;
  /** Challenges finished, ever. */
  finished?: number;
  season?: SeasonRecord;
}

/** What a match comes to, for the challenges. */
export interface MatchFacts {
  won: boolean;
  format: Format;
  cls: ClassId;
  dmg: number;
  heal: number;
  combos: number;
  kicks: number;
  supers: number;
}

export interface Challenge {
  id: string;
  text: string;
  goal: number;
  /** How much a match adds (for one that counts different things: the thing it counts). */
  add: (m: MatchFacts) => number | string | null;
  /** Counts different things seen (classes, formats), not a sum. */
  distinct?: boolean;
}

export const HISTORY_MAX = 20;

export const DAILY: readonly Challenge[] = [
  { id: 'd-play', text: 'Play 3 rated matches', goal: 3, add: () => 1 },
  { id: 'd-win', text: 'Win 2 rated matches', goal: 2, add: (m) => (m.won ? 1 : 0) },
  { id: 'd-combos', text: 'Land 10 combos', goal: 10, add: (m) => m.combos },
  { id: 'd-kicks', text: 'Interrupt 3 casts', goal: 3, add: (m) => m.kicks },
  { id: 'd-supers', text: 'Unleash your super 3 times', goal: 3, add: (m) => m.supers },
  { id: 'd-dmg', text: 'Deal 5,000 damage', goal: 5000, add: (m) => m.dmg },
  { id: 'd-heal', text: 'Heal 3,000', goal: 3000, add: (m) => m.heal },
  { id: 'd-team', text: 'Win a 2v2 or a 3v3', goal: 1, add: (m) => (m.won && m.format > 1 ? 1 : 0) },
  { id: 'd-duel', text: 'Win a 1v1', goal: 1, add: (m) => (m.won && m.format === 1 ? 1 : 0) },
];

export const WEEKLY: readonly Challenge[] = [
  { id: 'w-wins', text: 'Win 10 rated matches', goal: 10, add: (m) => (m.won ? 1 : 0) },
  { id: 'w-classes', text: 'Win with 3 different classes', goal: 3, add: (m) => (m.won ? m.cls : null), distinct: true },
  { id: 'w-combos', text: 'Land 60 combos', goal: 60, add: (m) => m.combos },
  { id: 'w-kicks', text: 'Interrupt 20 casts', goal: 20, add: (m) => m.kicks },
  { id: 'w-formats', text: 'Play a 1v1, a 2v2 and a 3v3', goal: 3, add: (m) => String(m.format), distinct: true },
  { id: 'w-dmg', text: 'Deal 40,000 damage', goal: 40000, add: (m) => m.dmg },
];

const DAY = 86_400_000;
/** The first season begins here (the day these were added), and each is eight weeks long. */
export const SEASON_START = Date.UTC(2026, 10, 16);
export const SEASON_LENGTH = 56 * DAY;

/** A day's key: its date, by the world's clock (the same day for everyone). */
export const dayKey = (now: number): string => new Date(now).toISOString().slice(0, 10);
/** A week's key: the date of its Monday. */
export const weekKey = (now: number): string => {
  const d = new Date(now);
  const back = (d.getUTCDay() + 6) % 7;
  return dayKey(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - back));
};
/** When the day's challenges, and the week's, are drawn again. */
export const dayEnds = (now: number): number => Date.parse(`${dayKey(now)}T00:00:00Z`) + DAY;
export const weekEnds = (now: number): number => Date.parse(`${weekKey(now)}T00:00:00Z`) + 7 * DAY;

/** Which season it is. */
export const seasonOf = (now: number): number => Math.max(1, 1 + Math.floor((now - SEASON_START) / SEASON_LENGTH));
export const seasonEnds = (n: number): number => SEASON_START + n * SEASON_LENGTH;

/** A string's own number, for drawing the same challenges for everyone from a date. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Three of a list, drawn from a period's key. */
function draw(pool: readonly Challenge[], key: string, n = 3): Challenge[] {
  const left = [...pool];
  const out: Challenge[] = [];
  let h = hash(key);
  while (out.length < n && left.length) {
    h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
    out.push(left.splice(h % left.length, 1)[0]!);
  }
  return out;
}

export const dailyOf = (now: number): Challenge[] => draw(DAILY, `d${dayKey(now)}`);
export const weeklyOf = (now: number): Challenge[] => draw(WEEKLY, `w${weekKey(now)}`);

/** A period's run as it stands now: a new one when the period has turned. */
const runFor = (run: ChallengeRun | undefined, key: string): ChallengeRun => (run && run.key === key ? run : { key, got: {}, done: [] });

/** A match counted into a period's challenges. Returns the run, and how many it finished. */
function countInto(run: ChallengeRun, list: Challenge[], m: MatchFacts): { run: ChallengeRun; finished: number } {
  const got = { ...run.got };
  const done = [...run.done];
  const seen = new Set(run.seen ?? []);
  let finished = 0;
  for (const c of list) {
    if (done.includes(c.id)) continue;
    const a = c.add(m);
    if (c.distinct) {
      if (typeof a === 'string') seen.add(`${c.id}:${a}`);
      got[c.id] = [...seen].filter((s) => s.startsWith(`${c.id}:`)).length;
    } else if (typeof a === 'number' && a > 0) got[c.id] = (got[c.id] ?? 0) + Math.round(a);
    if ((got[c.id] ?? 0) >= c.goal) {
      done.push(c.id);
      finished++;
    }
  }
  return { run: { key: run.key, got, done, ...(seen.size ? { seen: [...seen] } : {}) }, finished };
}

/**
 * A match settled into the record: kept in the history, and (a rated one) counted toward the challenges, the class's
 * mastery and the season's best. `rating` is the format's rating after it (a friendly match: null).
 */
export function recordMatch(rec: RingRecord | undefined, e: MatchEntry, facts: MatchFacts, now: number): RingRecord {
  const out: RingRecord = { ...rec, history: [e, ...(rec?.history ?? [])].slice(0, HISTORY_MAX) };
  if (e.change === null) return out;
  const m = out.mastery?.[e.cls] ?? { wins: 0, played: 0 };
  out.mastery = { ...out.mastery, [e.cls]: { wins: m.wins + (e.won ? 1 : 0), played: m.played + 1 } };
  const d = countInto(runFor(rec?.daily, dayKey(now)), dailyOf(now), facts);
  const w = countInto(runFor(rec?.weekly, weekKey(now)), weeklyOf(now), facts);
  out.daily = d.run;
  out.weekly = w.run;
  out.finished = (rec?.finished ?? 0) + d.finished + w.finished;
  const season = rollSeason(out.season, now);
  if (e.rating !== null) season.best = { ...season.best, [e.format]: Math.max(season.best[e.format] ?? 0, e.rating) };
  out.season = season;
  return out;
}

/** The season as it stands now: the same, or a new one with the one before put by. */
function rollSeason(s: SeasonRecord | undefined, now: number): SeasonRecord {
  const n = seasonOf(now);
  if (!s) return { n, best: {}, past: [] };
  if (s.n >= n) return s;
  return { n, best: {}, past: [{ n: s.n, best: s.best }, ...s.past].slice(0, 12) };
}

/** A rating brought halfway back toward where everyone starts, for a new season. */
export const seasonReset = (rating: number): number => Math.round(1000 + (rating - 1000) / 2);

/**
 * At the Ring's door: a season that has turned since the player last came puts its bests by and brings each format's
 * rating (and the hidden one it climbs toward) halfway back toward 1000. The best ever reached, the wins and the losses
 * stay. Nothing changes within a season, or for a record that has never seen one (it starts in this one).
 */
export function turnSeason(rec: RingRecord | undefined, standings: Record<string, Standing>, now: number): { record: RingRecord; standings: Record<string, Standing>; turned: boolean } {
  const n = seasonOf(now);
  if (!rec?.season) return { record: { ...rec, season: { n, best: {}, past: [] } }, standings, turned: false };
  if (rec.season.n >= n) return { record: rec, standings, turned: false };
  const next: Record<string, Standing> = {};
  for (const [f, s] of Object.entries(standings)) next[f] = { ...s, rating: seasonReset(s.rating), ...(typeof s.mmr === 'number' ? { mmr: seasonReset(s.mmr) } : {}), streak: 0 };
  return { record: { ...rec, season: rollSeason(rec.season, now) }, standings: next, turned: true };
}

/* ------------------------------------------------------------------ what it gives */

export const MASTERY_STEPS: readonly { wins: number; word: string }[] = [
  { wins: 15, word: 'Adept' },
  { wins: 50, word: 'Master' },
];

/** The titles mastery gives: a class's own, at 15 and 50 rated wins with it (worn before the name). */
export const MASTERY_TITLES: readonly { id: string; cls: ClassId; wins: number; name: string }[] = CLASS_IDS.flatMap((cls) => MASTERY_STEPS.map((s) => ({ id: `ring-${s.word.toLowerCase()}-${cls}`, cls, wins: s.wins, name: `${CLASSES[cls].name} ${s.word}` })));

/** The titles the challenges give, for so many finished. */
export const CHALLENGE_TITLES: readonly { id: string; finished: number; name: string }[] = [
  { id: 'ring-diligent', finished: 10, name: 'Diligent' },
  { id: 'ring-tireless', finished: 50, name: 'Tireless' },
];

/** The record as this device keeps it (for the titles, read where the Ring's screen isn't open). */
export function readRecord(): RingRecord {
  try {
    const raw = JSON.parse(localStorage.getItem(RING_KEY) ?? 'null') as { record?: RingRecord } | null;
    return raw?.record && typeof raw.record === 'object' ? raw.record : {};
  } catch {
    return {};
  }
}

export const masteryWins = (rec: RingRecord, cls: ClassId): number => rec.mastery?.[cls]?.wins ?? 0;

/** A record from storage, as far as it can be trusted (bad parts left out). */
export function recordOf(v: unknown): RingRecord | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  const num = (x: unknown): number => (typeof x === 'number' && Number.isFinite(x) ? x : 0);
  const out: RingRecord = {};
  if (Array.isArray(o.history)) out.history = o.history.filter((h): h is MatchEntry => !!h && typeof h === 'object' && typeof (h as MatchEntry).at === 'number' && typeof (h as MatchEntry).cls === 'string').slice(0, HISTORY_MAX);
  if (o.mastery && typeof o.mastery === 'object') {
    const m: RingRecord['mastery'] = {};
    for (const cls of CLASS_IDS) {
      const x = (o.mastery as Record<string, unknown>)[cls] as { wins?: unknown; played?: unknown } | undefined;
      if (x && typeof x === 'object') m[cls] = { wins: num(x.wins), played: num(x.played) };
    }
    out.mastery = m;
  }
  const run = (x: unknown): ChallengeRun | undefined => {
    if (!x || typeof x !== 'object') return undefined;
    const r = x as Record<string, unknown>;
    if (typeof r.key !== 'string') return undefined;
    const got: Record<string, number> = {};
    if (r.got && typeof r.got === 'object') for (const [k, n] of Object.entries(r.got as Record<string, unknown>)) got[k] = num(n);
    const words = (w: unknown): string[] => (Array.isArray(w) ? w.filter((s): s is string => typeof s === 'string') : []);
    return { key: r.key, got, done: words(r.done), ...(Array.isArray(r.seen) ? { seen: words(r.seen) } : {}) };
  };
  const d = run(o.daily);
  const w = run(o.weekly);
  if (d) out.daily = d;
  if (w) out.weekly = w;
  if (typeof o.finished === 'number') out.finished = num(o.finished);
  if (o.season && typeof o.season === 'object') {
    const s = o.season as Record<string, unknown>;
    if (typeof s.n === 'number') out.season = { n: s.n, best: s.best && typeof s.best === 'object' ? (s.best as SeasonRecord['best']) : {}, past: Array.isArray(s.past) ? (s.past as SeasonRecord['past']) : [] };
  }
  return out;
}
