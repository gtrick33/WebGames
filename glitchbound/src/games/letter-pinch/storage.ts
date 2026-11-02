import { addDays } from '../../platform/dates';
import { MAX_GUESSES } from './logic';

/** Letter Pinch's own device-local save (progress, streaks, settings). Nothing leaves the browser. */

export interface DayProgress {
  guesses: string[];
  /** Epoch ms of the first typed letter (the first guess in older saves). */
  startedAt: number;
  /** Epoch ms when the puzzle was solved or missed. */
  endedAt?: number;
  /** Time the board was open and visible, in ms (the solve clock). Missing in older saves. */
  activeMs?: number;
}

/** A friends' challenge round on this device: one attempt, so it survives reloads and restarts. */
export interface ChallengeProgress extends DayProgress {
  /** The end was sent to the challenge (exactly once per round). */
  reported?: boolean;
}

/** The practice board left open, so a reload or Restart resumes it. */
export interface OpenPractice extends DayProgress {
  secret: string;
}

export interface Tally {
  played: number;
  wins: number;
  /** Wins by guesses used: dist[0] = solved in 1, dist[5] = solved in 6. */
  dist: number[];
}

export interface DailyStats extends Tally {
  streak: number;
  maxStreak: number;
  lastWin: string | null;
  lastPlayed: string | null;
}

export interface PinchSave {
  v: 1;
  days: Record<string, DayProgress>;
  stats: DailyStats;
  practice: Tally;
  seenHelp: boolean;
  muted: boolean;
  /** Keyed `${challenge.id}:${round}`; the most recent few are kept. */
  challenges: Record<string, ChallengeProgress>;
  openPractice: OpenPractice | null;
  /** The tab last played, so a reload stays in Practice. */
  lastMode: 'daily' | 'practice';
}

const KEY = 'glitchbound.letter-pinch';
const KEEP_DAYS = 14;
const KEEP_CHALLENGES = 30;
/** Counters never grow past this (a tampered save cannot break the stats row). */
const MAX_COUNT = 999_999;

const tally = (): Tally => ({ played: 0, wins: 0, dist: Array<number>(MAX_GUESSES).fill(0) });

export const emptyPinchSave = (): PinchSave => ({
  v: 1,
  days: {},
  stats: { ...tally(), streak: 0, maxStreak: 0, lastWin: null, lastPlayed: null },
  practice: tally(),
  seenHelp: false,
  muted: false,
  challenges: {},
  openPractice: null,
  lastMode: 'daily',
});

function record(t: Tally, won: boolean, guesses: number): void {
  t.played += 1;
  if (won) {
    t.wins += 1;
    const i = Math.min(MAX_GUESSES, Math.max(1, guesses)) - 1;
    t.dist[i] = (t.dist[i] ?? 0) + 1;
  }
}

/**
 * Records a finished daily. A solve on the day after the last solve extends the streak. A day counts
 * once, and an older day finished late (an old challenge link) never rewinds the streak.
 */
export function finishDaily(save: PinchSave, day: string, won: boolean, guesses: number): void {
  const s = save.stats;
  if (s.lastPlayed && day <= s.lastPlayed) return;
  record(s, won, guesses);
  s.lastPlayed = day;
  if (won) {
    s.streak = s.lastWin === addDays(day, -1) ? s.streak + 1 : 1;
    s.lastWin = day;
    s.maxStreak = Math.max(s.maxStreak, s.streak);
  } else s.streak = 0;
}

export function finishPractice(save: PinchSave, won: boolean, guesses: number): void {
  record(save.practice, won, guesses);
}

/** The streak as it stands today: still alive if the last solve was today or yesterday. */
export function shownStreak(s: DailyStats, today: string): number {
  return s.lastWin === today || s.lastWin === addDays(today, -1) ? s.streak : 0;
}

/* ------------------------------------------------------------------ persistence */

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const nat = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
const count = (v: unknown): number => Math.min(MAX_COUNT, nat(v));
const word = (v: unknown): v is string => typeof v === 'string' && /^[a-z]{5}$/.test(v);

/** A board's progress, or null when it is not one. */
function cleanProgress(p: unknown): DayProgress | null {
  if (!isObj(p) || !Array.isArray(p.guesses)) return null;
  return {
    guesses: p.guesses.filter(word).slice(0, MAX_GUESSES),
    startedAt: nat(p.startedAt),
    ...(p.endedAt !== undefined ? { endedAt: nat(p.endedAt) } : {}),
    ...(p.activeMs !== undefined ? { activeMs: Math.min(nat(p.activeMs), 365 * 86400_000) } : {}),
  };
}
const dayOrNull = (v: unknown): string | null => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

function cleanTally(raw: unknown): Tally {
  const t = tally();
  if (!isObj(raw)) return t;
  t.played = count(raw.played);
  t.wins = count(raw.wins);
  if (Array.isArray(raw.dist)) t.dist = t.dist.map((_, i) => count((raw.dist as unknown[])[i]));
  return t;
}

/** Turns any parsed JSON into a valid save, keeping whatever parts are valid. */
export function sanitize(raw: unknown): PinchSave {
  const save = emptyPinchSave();
  if (!isObj(raw) || raw.v !== 1) return save;
  if (isObj(raw.days)) {
    for (const [day, p] of Object.entries(raw.days)) {
      const clean = dayOrNull(day) ? cleanProgress(p) : null;
      if (clean) save.days[day] = clean;
    }
  }
  if (isObj(raw.challenges)) {
    for (const [key, p] of Object.entries(raw.challenges)) {
      const clean = /^[\w-]{1,40}:\d{1,3}$/.test(key) ? cleanProgress(p) : null;
      if (clean) save.challenges[key] = { ...clean, ...(isObj(p) && p.reported === true ? { reported: true } : {}) };
    }
  }
  if (isObj(raw.openPractice) && word(raw.openPractice.secret)) {
    const clean = cleanProgress(raw.openPractice);
    if (clean) save.openPractice = { ...clean, secret: raw.openPractice.secret };
  }
  save.lastMode = raw.lastMode === 'practice' ? 'practice' : 'daily';
  if (isObj(raw.stats)) {
    save.stats = {
      ...cleanTally(raw.stats),
      streak: count(raw.stats.streak),
      maxStreak: count(raw.stats.maxStreak),
      lastWin: dayOrNull(raw.stats.lastWin),
      lastPlayed: dayOrNull(raw.stats.lastPlayed),
    };
  }
  save.practice = cleanTally(raw.practice);
  save.seenHelp = raw.seenHelp === true;
  save.muted = raw.muted === true;
  return save;
}

/** The stored save, or null when storage cannot be read (blocked): then the caller keeps its own copy. */
export function readSave(): PinchSave | null {
  let text: string | null;
  try {
    text = window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
  try {
    return text ? sanitize(JSON.parse(text)) : emptyPinchSave();
  } catch {
    return emptyPinchSave();
  }
}

export function loadSave(): PinchSave {
  return readSave() ?? emptyPinchSave();
}

/** The save's storage key, for a `storage` listener (another tab wrote it). */
export const SAVE_KEY = KEY;

export function storeSave(save: PinchSave, today: string): void {
  const oldest = addDays(today, -KEEP_DAYS);
  for (const day of Object.keys(save.days)) if (day < oldest) delete save.days[day];
  const rounds = Object.entries(save.challenges).sort((a, b) => b[1].startedAt - a[1].startedAt);
  for (const [key] of rounds.slice(KEEP_CHALLENGES)) delete save.challenges[key];
  try {
    window.localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    /* storage full or blocked: progress lasts for this visit only */
  }
}
