import { addDays } from '../../platform/dates';
import { MAX_GUESSES } from './logic';

/** Letter Pinch's own device-local save (progress, streaks, settings). Nothing leaves the browser. */

export interface DayProgress {
  guesses: string[];
  /** Epoch ms of the first guess. */
  startedAt: number;
  /** Epoch ms when the puzzle was solved or missed. */
  endedAt?: number;
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
}

const KEY = 'glitchbound.letter-pinch';
const KEEP_DAYS = 14;

const tally = (): Tally => ({ played: 0, wins: 0, dist: Array<number>(MAX_GUESSES).fill(0) });

export const emptyPinchSave = (): PinchSave => ({
  v: 1,
  days: {},
  stats: { ...tally(), streak: 0, maxStreak: 0, lastWin: null, lastPlayed: null },
  practice: tally(),
  seenHelp: false,
  muted: false,
});

function record(t: Tally, won: boolean, guesses: number): void {
  t.played += 1;
  if (won) {
    t.wins += 1;
    const i = Math.min(MAX_GUESSES, Math.max(1, guesses)) - 1;
    t.dist[i] = (t.dist[i] ?? 0) + 1;
  }
}

/** Records a finished daily. A solve on the day after the last solve extends the streak. */
export function finishDaily(save: PinchSave, day: string, won: boolean, guesses: number): void {
  const s = save.stats;
  if (s.lastPlayed === day) return;
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
const dayOrNull = (v: unknown): string | null => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

function cleanTally(raw: unknown): Tally {
  const t = tally();
  if (!isObj(raw)) return t;
  t.played = nat(raw.played);
  t.wins = nat(raw.wins);
  if (Array.isArray(raw.dist)) t.dist = t.dist.map((_, i) => nat((raw.dist as unknown[])[i]));
  return t;
}

/** Turns any parsed JSON into a valid save, keeping whatever parts are valid. */
export function sanitize(raw: unknown): PinchSave {
  const save = emptyPinchSave();
  if (!isObj(raw) || raw.v !== 1) return save;
  if (isObj(raw.days)) {
    for (const [day, p] of Object.entries(raw.days)) {
      if (!dayOrNull(day) || !isObj(p) || !Array.isArray(p.guesses)) continue;
      const guesses = p.guesses.filter((g): g is string => typeof g === 'string' && /^[a-z]{5}$/.test(g)).slice(0, MAX_GUESSES);
      save.days[day] = { guesses, startedAt: nat(p.startedAt), ...(p.endedAt !== undefined ? { endedAt: nat(p.endedAt) } : {}) };
    }
  }
  if (isObj(raw.stats)) {
    save.stats = {
      ...cleanTally(raw.stats),
      streak: nat(raw.stats.streak),
      maxStreak: nat(raw.stats.maxStreak),
      lastWin: dayOrNull(raw.stats.lastWin),
      lastPlayed: dayOrNull(raw.stats.lastPlayed),
    };
  }
  save.practice = cleanTally(raw.practice);
  save.seenHelp = raw.seenHelp === true;
  save.muted = raw.muted === true;
  return save;
}

export function loadSave(): PinchSave {
  try {
    const text = window.localStorage.getItem(KEY);
    return text ? sanitize(JSON.parse(text)) : emptyPinchSave();
  } catch {
    return emptyPinchSave();
  }
}

export function storeSave(save: PinchSave, today: string): void {
  const oldest = addDays(today, -KEEP_DAYS);
  for (const day of Object.keys(save.days)) if (day < oldest) delete save.days[day];
  try {
    window.localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    /* storage full or blocked: progress lasts for this visit only */
  }
}
