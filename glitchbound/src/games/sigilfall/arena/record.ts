import { CLASSES, CLASS_IDS } from '../data/classes';
import type { ClassId } from '../data/types';
import { RING_KEY, seasonOf, seasonReset, type Format, type Standing } from './ranks';
// (the seasons are counted in ranks.ts, where the server's ladder reads them too)
export { SEASON_LENGTH, SEASON_START, seasonEnds, seasonOf, seasonReset } from './ranks';
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
 * - The season's track (the owner, asked what the challenges give: "implement the first one", the season track):
 *   each challenge finished is worth points (a day's 10, a week's 30), and the season's points climb ten tiers, each
 *   with a reward kept for good: nameplate frames, and titles, the last of them that season's own. The points start
 *   again with each season. All of it to be looked at, nothing that changes a fight.
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
  /** The season track's points (TRACK_POINTS for each challenge finished this season). */
  points?: number;
  /** Seasons gone by, newest first: their number, the best each format reached and the track's points. */
  past: { n: number; best: Partial<Record<string, number>>; points?: number }[];
}

export interface RingRecord {
  history?: MatchEntry[];
  mastery?: Partial<Record<ClassId, { wins: number; played: number }>>;
  daily?: ChallengeRun;
  weekly?: ChallengeRun;
  /** Challenges finished, ever. */
  finished?: number;
  season?: SeasonRecord;
  /** What the season track has given, for good (`frame:gold`, `title:ring-contender`): TrackReward ids. */
  earned?: string[];
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
  /** Its picture, from the game's icons. */
  icon: string;
  goal: number;
  /** How much a match adds (for one that counts different things: the thing it counts). */
  add: (m: MatchFacts) => number | string | null;
  /** Counts different things seen (classes, formats), not a sum. */
  distinct?: boolean;
}

export const HISTORY_MAX = 20;

export const DAILY: readonly Challenge[] = [
  { id: 'd-play', icon: 'war_banner_on_a_pole_with_a_red_pattern_on_red', text: 'Play 3 rated matches', goal: 3, add: () => 1 },
  { id: 'd-win', icon: 'radiant_crown_of_light_on_gold', text: 'Win 2 rated matches', goal: 2, add: (m) => (m.won ? 1 : 0) },
  { id: 'd-combos', icon: 'chain_of_three_slash_marks_on_red', text: 'Land 10 combos', goal: 10, add: (m) => m.combos },
  { id: 'd-kicks', icon: 'silenced_status_muted_bell_on_violet', text: 'Interrupt 3 casts', goal: 3, add: (m) => m.kicks },
  { id: 'd-supers', icon: 'crit_up_status_star_burst_on_gold', text: 'Unleash your super 3 times', goal: 3, add: (m) => m.supers },
  { id: 'd-dmg', icon: 'exploding_fire_burst_on_orange', text: 'Deal 5,000 damage', goal: 5000, add: (m) => m.dmg },
  { id: 'd-heal', icon: 'healing_hand_with_green_gold_sparkles_on_gold', text: 'Heal 3,000', goal: 3000, add: (m) => m.heal },
  { id: 'd-team', icon: 'bond_heart_link_on_teal', text: 'Win a 2v2 or a 3v3', goal: 1, add: (m) => (m.won && m.format > 1 ? 1 : 0) },
  { id: 'd-duel', icon: 'crossed_sword_and_axe_on_red', text: 'Win a 1v1', goal: 1, add: (m) => (m.won && m.format === 1 ? 1 : 0) },
];

export const WEEKLY: readonly Challenge[] = [
  { id: 'w-wins', icon: 'radiant_crown_of_light_on_gold', text: 'Win 10 rated matches', goal: 10, add: (m) => (m.won ? 1 : 0) },
  { id: 'w-classes', icon: 'chain_lightning_between_three_dots_on_violet', text: 'Win with 3 different classes', goal: 3, add: (m) => (m.won ? m.cls : null), distinct: true },
  { id: 'w-combos', icon: 'chain_of_three_slash_marks_on_red', text: 'Land 60 combos', goal: 60, add: (m) => m.combos },
  { id: 'w-kicks', icon: 'silenced_status_muted_bell_on_violet', text: 'Interrupt 20 casts', goal: 20, add: (m) => m.kicks },
  { id: 'w-formats', icon: 'sword_with_three_stacked_chevrons_on_red', text: 'Play a 1v1, a 2v2 and a 3v3', goal: 3, add: (m) => String(m.format), distinct: true },
  { id: 'w-dmg', icon: 'burning_sword_on_black', text: 'Deal 40,000 damage', goal: 40000, add: (m) => m.dmg },
];

const DAY = 86_400_000;

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
  const season = { ...rollSeason(out.season, now) };
  if (e.rating !== null) season.best = { ...season.best, [e.format]: Math.max(season.best[e.format] ?? 0, e.rating) };
  season.points = (season.points ?? 0) + d.finished * TRACK_POINTS.daily + w.finished * TRACK_POINTS.weekly;
  out.season = season;
  // (what the season's points have reached, given for good)
  const earned = new Set(out.earned ?? []);
  for (const t of trackOf(season.n)) if (season.points >= t.at) earned.add(t.reward.id);
  if (earned.size) out.earned = [...earned];
  return out;
}

/** The season as it stands now: the same, or a new one with the one before put by. */
function rollSeason(s: SeasonRecord | undefined, now: number): SeasonRecord {
  const n = seasonOf(now);
  if (!s) return { n, best: {}, past: [] };
  if (s.n >= n) return s;
  return { n, best: {}, points: 0, past: [{ n: s.n, best: s.best, ...(s.points ? { points: s.points } : {}) }, ...s.past].slice(0, 12) };
}


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

/* ------------------------------------------------------------------ the season track */

/** What a challenge finished is worth on the track. */
export const TRACK_POINTS = { daily: 10, weekly: 30 } as const;

/** A nameplate frame: drawn round a fighter's nameplate in the Ring, for everyone to see (Game.css .is-frame-<id>). */
export interface NameFrame {
  id: string;
  name: string;
  /** Its two colors, edge and glow. */
  colors: [string, string];
}

const FRAMES: readonly NameFrame[] = [
  { id: 'bronze', name: 'Bronze frame', colors: ['#c88a4a', '#7a4a1e'] },
  { id: 'silver', name: 'Silver frame', colors: ['#e4ecf4', '#8a9aac'] },
  { id: 'gold', name: 'Gold frame', colors: ['#ffd257', '#b8862a'] },
  { id: 'ember', name: 'Ember frame', colors: ['#ff8a3a', '#c8341e'] },
];

/** Each season's own frame: its colors turn with the season, so no two seasons' look alike. */
export const seasonFrame = (n: number): NameFrame => {
  const h = (n * 67 + 260) % 360;
  return { id: `season-${n}`, name: `Season ${n} frame`, colors: [`hsl(${h} 90% 72%)`, `hsl(${(h + 40) % 360} 80% 48%)`] };
};

/** A frame by its id (one of the four, or a season's), if it is one. */
export function frameOf(id: string | null | undefined): NameFrame | null {
  if (!id) return null;
  const f = FRAMES.find((x) => x.id === id);
  if (f) return f;
  const m = /^season-(\d{1,3})$/.exec(id);
  return m ? seasonFrame(Number(m[1])) : null;
}

/** The titles the track gives (as titles any hero can wear: progress/titles.ts), the season's own built from its number. */
export const TRACK_TITLES: readonly { id: string; name: string; fx: string }[] = [
  { id: 'ring-contender', name: 'Contender', fx: 'gleam' },
  { id: 'ring-challenger', name: 'Challenger', fx: 'tide' },
  { id: 'ring-ringtested', name: 'Ringtested', fx: 'ember' },
  { id: 'ring-relentless', name: 'the Relentless', fx: 'storm' },
];
export const seasonTitle = (n: number): { id: string; name: string; fx: string } => ({ id: `ring-s${n}-champion`, name: `Season ${n} Champion`, fx: 'starfall' });
/** How many seasons' own titles the title list knows ahead (four years of them). */
export const SEASON_TITLES_AHEAD = 26;

export type TrackReward = { kind: 'frame'; id: string; name: string } | { kind: 'title'; id: string; name: string };

/** A season's ten tiers: the points each wants, and what it gives. */
export function trackOf(n: number): { at: number; reward: TrackReward }[] {
  const frame = (f: NameFrame): TrackReward => ({ kind: 'frame', id: `frame:${f.id}`, name: f.name });
  const title = (t: { id: string; name: string }): TrackReward => ({ kind: 'title', id: `title:${t.id}`, name: `Title: ${t.name}` });
  const fr = (id: string): NameFrame => FRAMES.find((f) => f.id === id)!;
  const ti = (id: string) => TRACK_TITLES.find((t) => t.id === id)!;
  return [
    { at: 60, reward: frame(fr('bronze')) },
    { at: 150, reward: title(ti('ring-contender')) },
    { at: 260, reward: frame(fr('silver')) },
    { at: 390, reward: title(ti('ring-challenger')) },
    { at: 540, reward: frame(fr('gold')) },
    { at: 710, reward: title(ti('ring-ringtested')) },
    { at: 900, reward: frame(fr('ember')) },
    { at: 1080, reward: title(ti('ring-relentless')) },
    { at: 1280, reward: frame(seasonFrame(n)) },
    { at: 1500, reward: title(seasonTitle(n)) },
  ];
}

/** Where a season's points stand on its track: the tier reached (0 for none) and the next, if any. */
export function trackPlace(points: number, n: number): { tier: number; next: { at: number; reward: TrackReward } | null; from: number } {
  const t = trackOf(n);
  const tier = t.filter((x) => points >= x.at).length;
  return { tier, next: t[tier] ?? null, from: t[tier - 1]?.at ?? 0 };
}

/** What a match did to the season track: the points it added, where they stand, and the rewards it gave. */
export interface TrackGain {
  gained: number;
  points: number;
  tier: number;
  rewards: TrackReward[];
}

/** The track before a match and after it, as the result screen tells it (null when it didn't move). */
export function trackGain(was: RingRecord | undefined, now: RingRecord): TrackGain | null {
  const n = now.season?.n ?? 1;
  const before = was?.season?.n === n ? (was.season.points ?? 0) : 0;
  const points = now.season?.points ?? 0;
  if (points <= before) return null;
  const had = new Set(was?.earned ?? []);
  const rewards = trackOf(n)
    .map((t) => t.reward)
    .filter((r) => (now.earned ?? []).includes(r.id) && !had.has(r.id));
  return { gained: points - before, points, tier: trackPlace(points, n).tier, rewards };
}

/** The frames the track has given this player. */
export const framesOwned = (rec: RingRecord): NameFrame[] => (rec.earned ?? []).filter((id) => id.startsWith('frame:')).map((id) => frameOf(id.slice(6))).filter((f): f is NameFrame => !!f);

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
  if (Array.isArray(o.earned)) out.earned = o.earned.filter((x): x is string => typeof x === 'string' && /^(frame|title):[a-z0-9-]{1,32}$/.test(x)).slice(0, 200);
  if (o.season && typeof o.season === 'object') {
    const s = o.season as Record<string, unknown>;
    if (typeof s.n === 'number') out.season = { n: s.n, best: s.best && typeof s.best === 'object' ? (s.best as SeasonRecord['best']) : {}, ...(typeof s.points === 'number' ? { points: num(s.points) } : {}), past: Array.isArray(s.past) ? (s.past as SeasonRecord['past']) : [] };
  }
  return out;
}
