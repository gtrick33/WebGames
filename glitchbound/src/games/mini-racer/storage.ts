import { decodeGhost, encodeGhost, type Ghost } from './ghost';
import { CARS, DEFAULT_CAR } from './cars';
import { DEFAULT_AI_LEVEL, type RaceMode } from './sim';

/** Local-only saves (bests, ghosts, settings). Every access is guarded: storage can be missing or full. */

export const SAVE_KEY = 'gb.mini-racer.v1';
const GHOST_PREFIX = 'gb.mini-racer.ghost.';

/** Today's daily track gives this many races; the best one counts. */
export const DAILY_RACES = 3;
/** Entries kept in the per-race daily lists: a few days' worth. */
export const KEEP_DAILY = 9;
/** Friends' challenge rounds remembered (each has one attempt). */
export const KEEP_RUNS = 24;
/** Days whose best daily result is remembered (for a "Today's daily" challenge). */
export const KEEP_RESULTS = 7;
/** How many entries a per-race daily list has for one day. */
export const countDay = (days: readonly string[], day: string): number => days.reduce((n, d) => n + (d === day ? 1 : 0), 0);

export interface Bests {
  /** Best valid lap, seconds. */
  lap?: number;
  /** Best 3-lap race, seconds. */
  race?: number;
  /** Cumulative sector splits of the best lap with sector data (Time Trial reference). */
  splits?: number[];
  /** Best finishing position against AI. */
  position?: number;
  /** Highest AI level you have won a race against. */
  wonLevel?: number;
}

/** A friends' challenge round on this device: started, then ended exactly once. */
export interface ChallengeRun {
  /** `${challenge id}:${round}` */
  key: string;
  /** How it ended (unset while it is being raced): crossed the line, left mid-race, found started after a reload, or the day's daily result counted. */
  ended?: 'finished' | 'left' | 'reload' | 'daily';
  /** Race points reported for it. */
  score: number;
  /** Race time and best lap (seconds), when there were any. */
  race: number | null;
  lap: number | null;
  /** The day whose daily race it also was ("Today's daily" challenge played on its day). */
  daily?: string;
}

/** The best result reported for a day's daily (finished races, and races left unfinished). */
export interface DailyResult {
  day: string;
  score: number;
  race: number | null;
  lap: number | null;
  /** At least one of the day's races crossed the line. */
  finished: boolean;
}

export interface SaveData {
  bests: Record<string, Bests>;
  coins: number;
  /** Lifetime coins earned (for stats). */
  earned: number;
  cars: string[];
  car: string;
  muted: boolean;
  track: string;
  /** Days whose daily-track coin bonus was already paid. Only the latest few are kept. */
  dailyPaid: string[];
  /** One entry per daily race started (the daily is three races a day; a day appears once per race). Only the latest few are kept. */
  dailyRaced: string[];
  /** One entry per daily race that has reported its end (finished, or left and settled), so each is reported once. */
  dailyEnded: string[];
  /** One entry per daily race left unfinished (a race can't be resumed). */
  dailyLeft: string[];
  mode: RaceMode;
  /** AI level 0-100 for races. */
  aiLevel: number;
  /** Seed of the current random track (see randomTrack). */
  randomSeed: number;
  /** Friends' challenge rounds, latest last (only the latest few are kept). */
  challengeRuns: ChallengeRun[];
  /** Best daily result per day, latest last (only the latest few are kept). */
  dailyResults: DailyResult[];
}

function defaults(): SaveData {
  return { bests: {}, coins: 0, earned: 0, cars: [DEFAULT_CAR], car: DEFAULT_CAR, muted: false, track: 'sunny-bay', dailyPaid: [], dailyRaced: [], dailyEnded: [], dailyLeft: [], mode: 'trial', aiLevel: DEFAULT_AI_LEVEL, randomSeed: 1, challengeRuns: [], dailyResults: [] };
}

function store(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
const secs = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 && v < 3600 ? v : null);
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const ENDS = new Set(['finished', 'left', 'reload', 'daily']);

function readRun(v: unknown): ChallengeRun | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (typeof o.key !== 'string' || o.key.length > 80) return null;
  const run: ChallengeRun = { key: o.key, score: Math.min(num(o.score), 1e8), race: secs(o.race), lap: secs(o.lap) };
  if (typeof o.ended === 'string' && ENDS.has(o.ended)) run.ended = o.ended as ChallengeRun['ended'];
  if (typeof o.daily === 'string' && DAY.test(o.daily)) run.daily = o.daily;
  return run;
}

function readResult(v: unknown): DailyResult | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (typeof o.day !== 'string' || !DAY.test(o.day)) return null;
  return { day: o.day, score: Math.min(num(o.score), 1e8), race: secs(o.race), lap: secs(o.lap), finished: o.finished === true };
}

/** The stored save as text (null if there is none or storage is blocked): tells whether another tab wrote since. */
export function savedText(): string | null {
  try {
    return store()?.getItem(SAVE_KEY) ?? null;
  } catch {
    return null;
  }
}

export function loadSave(): SaveData {
  return parseSave(savedText());
}

/** Reads a stored save; anything missing, malformed or out of range falls back to the defaults. */
export function parseSave(raw: string | null): SaveData {
  const d = defaults();
  try {
    if (!raw) return d;
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (o.bests && typeof o.bests === 'object') {
      for (const [k, v] of Object.entries(o.bests as Record<string, unknown>)) {
        if (!v || typeof v !== 'object') continue;
        const b: Bests = {};
        for (const f of ['lap', 'race', 'position', 'wonLevel'] as const) {
          const n = (v as Bests)[f];
          if (typeof n === 'number' && Number.isFinite(n) && n > 0) b[f] = n;
        }
        const sp = (v as Bests).splits;
        if (Array.isArray(sp) && sp.length === 3 && sp.every((x) => typeof x === 'number' && Number.isFinite(x) && x > 0)) b.splits = sp;
        d.bests[k] = b;
      }
    }
    d.coins = num(o.coins);
    d.earned = num(o.earned);
    const known = new Set(CARS.map((c) => c.id));
    if (Array.isArray(o.cars)) d.cars = [...new Set([DEFAULT_CAR, ...o.cars.filter((c): c is string => typeof c === 'string' && known.has(c))])];
    d.car = typeof o.car === 'string' && d.cars.includes(o.car) ? o.car : DEFAULT_CAR;
    d.muted = o.muted === true;
    if (typeof o.track === 'string') d.track = o.track;
    if (o.mode === 'race') d.mode = 'race';
    if (typeof o.aiLevel === 'number' && Number.isFinite(o.aiLevel)) d.aiLevel = Math.max(0, Math.min(100, Math.round(o.aiLevel)));
    // Older saves stored a named difficulty.
    else if (o.difficulty === 'easy' || o.difficulty === 'medium' || o.difficulty === 'hard') d.aiLevel = { easy: 25, medium: 50, hard: 75 }[o.difficulty];
    if (typeof o.randomSeed === 'number' && Number.isFinite(o.randomSeed)) d.randomSeed = Math.abs(Math.floor(o.randomSeed)) % 2 ** 32;
    if (Array.isArray(o.dailyPaid)) d.dailyPaid = o.dailyPaid.filter((x): x is string => typeof x === 'string').slice(-7);
    if (Array.isArray(o.dailyRaced)) d.dailyRaced = o.dailyRaced.filter((x): x is string => typeof x === 'string').slice(-KEEP_DAILY);
    if (Array.isArray(o.dailyEnded)) d.dailyEnded = o.dailyEnded.filter((x): x is string => typeof x === 'string').slice(-KEEP_DAILY);
    if (Array.isArray(o.dailyLeft)) d.dailyLeft = o.dailyLeft.filter((x): x is string => typeof x === 'string').slice(-KEEP_DAILY);
    if (Array.isArray(o.challengeRuns)) d.challengeRuns = o.challengeRuns.map(readRun).filter((x): x is ChallengeRun => x !== null).slice(-KEEP_RUNS);
    if (Array.isArray(o.dailyResults)) d.dailyResults = o.dailyResults.map(readResult).filter((x): x is DailyResult => x !== null).slice(-KEEP_RESULTS);
    return d;
  } catch {
    return d;
  }
}

/** Writes the save; returns the text stored, or null if it couldn't be (storage full or blocked). */
export function writeSave(s: SaveData): string | null {
  try {
    const st = store();
    if (!st) return null;
    const text = JSON.stringify(s);
    st.setItem(SAVE_KEY, text);
    return text;
  } catch {
    /* full or blocked */
    return null;
  }
}

/** The save with a challenge round added or replaced (latest last, the oldest dropped). */
export function putRun(s: SaveData, run: ChallengeRun): SaveData {
  return { ...s, challengeRuns: [...s.challengeRuns.filter((r) => r.key !== run.key), run].slice(-KEEP_RUNS) };
}

/** The save with a day's daily result kept if it beats the one stored (a finished race always marks the day finished). */
export function putResult(s: SaveData, r: DailyResult): SaveData {
  const old = s.dailyResults.find((x) => x.day === r.day);
  const best = !old || r.score > old.score ? r : old;
  const kept = { ...best, finished: r.finished || (old?.finished ?? false) };
  return { ...s, dailyResults: [...s.dailyResults.filter((x) => x.day !== r.day), kept].slice(-KEEP_RESULTS) };
}

/** Bests of past daily tracks are never shown again: keeps only those of the given days, so the synced save stays small. */
export function pruneDailyBests(bests: Record<string, Bests>, keep: string[]): Record<string, Bests> {
  const ids = new Set(keep.map((d) => `daily-${d}`));
  return Object.fromEntries(Object.entries(bests).filter(([id]) => !id.startsWith('daily-') || ids.has(id)));
}

export function loadGhost(trackId: string): Ghost | null {
  try {
    return decodeGhost(store()?.getItem(GHOST_PREFIX + trackId) ?? null);
  } catch {
    return null;
  }
}

export function clearGhost(trackId: string): void {
  try {
    store()?.removeItem(GHOST_PREFIX + trackId);
  } catch {
    /* blocked */
  }
}

export function saveGhost(trackId: string, g: Ghost): void {
  const s = store();
  if (!s) return;
  try {
    // Daily ghosts expire with their day: drop the old ones first.
    if (trackId.startsWith('daily-')) {
      for (let i = s.length - 1; i >= 0; i--) {
        const k = s.key(i);
        if (k && k.startsWith(GHOST_PREFIX + 'daily-') && k !== GHOST_PREFIX + trackId) s.removeItem(k);
      }
    }
    s.setItem(GHOST_PREFIX + trackId, encodeGhost(g));
  } catch {
    /* full or blocked */
  }
}
