/**
 * Where's the Ball? device-local save: daily results (and resume), streaks and Endless bests.
 * Nothing leaves the browser.
 */
import { addDays, daysBetween } from '../../platform/dates';
import { currentStreak } from '../../platform/daily';
import { DAILY_LEVELS, MAX_LEVEL, totalScore, type Guess, type LevelProgress, type LevelResult } from './logic';

export const STORE_KEY = 'glitchbound.wheres-the-ball';
const KEEP_DAYS = 400;

export interface WbSave {
  v: 1;
  daily: Record<string, LevelResult[]>;
  endless: { runs: number; bestLevels: number; bestScore: number };
  fastest: number;
  muted: boolean;
  /**
   * Today's unfinished daily shot (wrong guesses, hints and time so far). Leaving or reloading picks it
   * up again instead of starting it over with fresh tries: the daily is one try a day.
   */
  progress: (LevelProgress & { day: string; index: number }) | null;
  /**
   * Friends' challenge rounds played on this device, by `${id}:${round}`: one attempt each, so leaving
   * or reloading picks the round up where it was and a finished one shows its result. Kept for a month.
   */
  challenges: Record<string, WbRound>;
}

/** A friends' challenge round: its shots so far, the unfinished one, and whether it is over. */
export interface WbRound {
  day: string;
  results: LevelResult[];
  progress: (LevelProgress & { index: number }) | null;
  done: boolean;
}

export const emptyWbSave = (): WbSave => ({ v: 1, daily: {}, endless: { runs: 0, bestLevels: 0, bestScore: 0 }, fastest: 0, muted: false, progress: null, challenges: {} });

const HEATS: Guess['heat'][] = ['hot', 'warm', 'cold'];
const isGuess = (g: unknown): g is Guess => {
  const o = g as Record<string, unknown> | null;
  return !!o && typeof o === 'object' && Number.isFinite(o.x) && Number.isFinite(o.y) && HEATS.includes(o.heat as Guess['heat']);
};

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);

function cleanResult(v: unknown): LevelResult | null {
  if (!v || typeof v !== 'object') return null;
  const r = v as Record<string, unknown>;
  if (typeof r.found !== 'boolean') return null;
  return { found: r.found, score: Math.min(MAX_LEVEL, Math.floor(num(r.score))), seconds: num(r.seconds), wrong: Math.floor(num(r.wrong)), hints: Math.floor(num(r.hints)) };
}

export function sanitizeWb(raw: unknown): WbSave {
  const s = emptyWbSave();
  if (!raw || typeof raw !== 'object') return s;
  const o = raw as Record<string, unknown>;
  if (o.v !== 1) return s;
  if (o.daily && typeof o.daily === 'object') {
    for (const [day, list] of Object.entries(o.daily as Record<string, unknown>)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Array.isArray(list)) continue;
      const rs = list.map(cleanResult).filter((r): r is LevelResult => !!r).slice(0, DAILY_LEVELS);
      if (rs.length) s.daily[day] = rs;
    }
  }
  const e = (o.endless ?? {}) as Record<string, unknown>;
  s.endless = { runs: Math.floor(num(e.runs)), bestLevels: Math.floor(num(e.bestLevels)), bestScore: Math.floor(num(e.bestScore)) };
  s.fastest = num(o.fastest);
  s.muted = o.muted === true;
  const p = cleanProgress(o.progress);
  if (p && typeof (o.progress as Record<string, unknown>).day === 'string') {
    const day = (o.progress as Record<string, unknown>).day as string;
    if (DAY.test(day)) s.progress = { day, ...p };
  }
  if (o.challenges && typeof o.challenges === 'object') {
    for (const [key, v] of Object.entries(o.challenges as Record<string, unknown>).slice(-MAX_ROUNDS)) {
      const r = v as Record<string, unknown> | null;
      if (!r || typeof r !== 'object' || typeof r.day !== 'string' || !DAY.test(r.day) || !Array.isArray(r.results)) continue;
      const results = r.results.map(cleanResult).filter((x): x is LevelResult => !!x).slice(0, DAILY_LEVELS);
      const progress = cleanProgress(r.progress);
      s.challenges[key] = { day: r.day, results, progress: progress && progress.index === results.length ? progress : null, done: r.done === true || results.length >= DAILY_LEVELS };
    }
  }
  return s;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ROUNDS = 50;

function cleanProgress(v: unknown): (LevelProgress & { index: number }) | null {
  const p = v as Record<string, unknown> | null | undefined;
  if (!p || typeof p !== 'object' || !Array.isArray(p.wrong)) return null;
  return {
    index: Math.min(DAILY_LEVELS - 1, Math.floor(num(p.index))),
    wrong: p.wrong.filter(isGuess).map(({ x, y, heat }) => ({ x, y, heat })),
    hints: Math.floor(num(p.hints)),
    ms: Math.floor(num(p.ms)),
  };
}

export function loadWb(): WbSave {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? sanitizeWb(JSON.parse(raw)) : emptyWbSave();
  } catch {
    return emptyWbSave();
  }
}

/** The save as stored right now (another tab may have changed it), or null when there is none to read. */
export function readWb(): WbSave | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? sanitizeWb(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveWb(s: WbSave, today: string): void {
  const cutoff = addDays(today, -KEEP_DAYS);
  for (const day of Object.keys(s.daily)) if (day < cutoff) delete s.daily[day];
  // Challenge rounds older than a month can't be played any more.
  const rounds = Object.entries(s.challenges).filter(([, r]) => Math.abs(daysBetween(r.day, today)) <= 31);
  s.challenges = Object.fromEntries(rounds.slice(-MAX_ROUNDS));
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {
    /* private mode or full storage */
  }
}

/**
 * Records a finished shot. A daily shot goes under its day as shot `index` (when given): if the save
 * already holds that shot (another tab finished it first), it is not added a second time.
 */
export function recordLevel(s: WbSave, r: LevelResult, daily: string | null, index?: number): WbSave {
  if (daily && index !== undefined && (s.daily[daily]?.length ?? 0) !== index) return s;
  const next: WbSave = { ...s, daily: { ...s.daily }, fastest: r.found && (s.fastest === 0 || r.seconds < s.fastest) ? r.seconds : s.fastest };
  if (daily) {
    next.daily[daily] = [...(s.daily[daily] ?? []), r].slice(0, DAILY_LEVELS);
    next.progress = null;
  }
  return next;
}

/** Records shot `index` of a challenge round played on its own (not as the day's daily). */
export function recordRound(s: WbSave, key: string, day: string, r: LevelResult, index: number): WbSave {
  const old = s.challenges[key] ?? { day, results: [], progress: null, done: false };
  if (old.done || old.results.length !== index) return s;
  return { ...s, challenges: { ...s.challenges, [key]: { ...old, results: [...old.results, r], progress: null } } };
}

/** Marks a challenge round over with its shots: reopening it shows the result and never replays it. */
export const closeRound = (s: WbSave, key: string, day: string, results: readonly LevelResult[]): WbSave => ({
  ...s,
  challenges: { ...s.challenges, [key]: { day, results: results.slice(0, DAILY_LEVELS), progress: null, done: true } },
});

export function recordEndless(s: WbSave, rs: readonly LevelResult[]): WbSave {
  const levels = rs.filter((r) => r.found).length;
  return { ...s, endless: { runs: s.endless.runs + 1, bestLevels: Math.max(s.endless.bestLevels, levels), bestScore: Math.max(s.endless.bestScore, totalScore(rs)) } };
}

export const isComplete = (rs: readonly LevelResult[] | undefined): boolean => (rs?.length ?? 0) >= DAILY_LEVELS;

export function wbStats(s: WbSave, today: string): { played: number; streak: number; best: number; perfect: number } {
  const done = Object.entries(s.daily).filter(([, r]) => isComplete(r));
  return {
    played: done.length,
    streak: currentStreak(new Set(done.map(([d]) => d)), today),
    best: Math.max(0, ...done.map(([, r]) => totalScore(r))),
    perfect: done.filter(([, r]) => r.every((x) => x.found)).length,
  };
}
