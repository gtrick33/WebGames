/**
 * Color Lab's device-local save: daily results (also used to resume an unfinished daily), streaks,
 * personal bests and a rolling "moves over par" history. Nothing leaves the browser.
 */
import { addDays } from '../../platform/dates';
import { currentStreak } from '../../platform/daily';
import { DAILY_LEVELS } from './levels';
import { MAX_POINTS, totalPoints, type LevelResult } from './rules';

export const STORE_KEY = 'glitchbound.color-lab';
const KEEP_DAYS = 400;
/** Solved levels kept for the efficiency trend. */
export const HISTORY = 60;

export type PracticeSize = 'small' | 'medium' | 'large' | 'huge';

export interface ClSave {
  v: 2;
  daily: Record<string, LevelResult[]>;
  endless: { runs: number; bestLevels: number; bestScore: number };
  precision: { runs: number; bestLevels: number };
  practice: { solved: number; size: PracticeSize };
  /** Moves over par of recent solved levels, oldest first. */
  history: number[];
  solved: number;
  underPar: number;
  muted: boolean;
  /** Patterns on the colors (on by default; helps color-blind players). */
  patterns: boolean;
  /** Help paid for on today's unfinished daily puzzle, so leaving and coming back doesn't refund it. */
  help: { day: string; index: number; hints: number; spare: boolean } | null;
  /** Friends' challenge rounds, by `${id}:${round}`: one attempt each, resumed after a reload. */
  challenges: Record<string, ChallengeRec>;
}

export interface ChallengeRec {
  /** The day the round was started (for pruning). */
  day: string;
  results: LevelResult[];
  /** Help paid for on the puzzle in progress (index = results.length), so a reload doesn't refund it. */
  help: { hints: number; spare: boolean } | null;
  /** The round's end was reported: show its result, never replay it. */
  done: boolean;
}

export const emptyClSave = (): ClSave => ({
  v: 2,
  daily: {},
  endless: { runs: 0, bestLevels: 0, bestScore: 0 },
  precision: { runs: 0, bestLevels: 0 },
  practice: { solved: 0, size: 'medium' },
  history: [],
  solved: 0,
  underPar: 0,
  muted: false,
  patterns: true,
  help: null,
  challenges: {},
});

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
const SIZES: PracticeSize[] = ['small', 'medium', 'large', 'huge'];

function cleanResult(v: unknown): LevelResult | null {
  if (!v || typeof v !== 'object') return null;
  const r = v as Record<string, unknown>;
  if (typeof r.solved !== 'boolean') return null;
  return {
    solved: r.solved,
    moves: num(r.moves),
    par: num(r.par),
    hints: num(r.hints),
    spare: r.spare === true,
    points: Math.min(MAX_POINTS, num(r.points)),
    stars: Math.min(3, num(r.stars)),
  };
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_CHALLENGES = 200;

function cleanChallenge(v: unknown): ChallengeRec | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (typeof o.day !== 'string' || !DAY.test(o.day)) return null;
  const results = Array.isArray(o.results) ? o.results.map(cleanResult).filter((r): r is LevelResult => !!r).slice(0, DAILY_LEVELS) : [];
  const h = o.help as Record<string, unknown> | null | undefined;
  return { day: o.day, results, help: h && typeof h === 'object' ? { hints: num(h.hints), spare: h.spare === true } : null, done: o.done === true };
}

export function sanitizeCl(raw: unknown): ClSave {
  const s = emptyClSave();
  if (!raw || typeof raw !== 'object') return s;
  const o = raw as Record<string, unknown>;
  if (o.v !== 2) return s;
  if (o.daily && typeof o.daily === 'object') {
    for (const [day, list] of Object.entries(o.daily as Record<string, unknown>)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Array.isArray(list)) continue;
      const results = list.map(cleanResult).filter((r): r is LevelResult => !!r).slice(0, DAILY_LEVELS);
      if (results.length) s.daily[day] = results;
    }
  }
  const e = (o.endless ?? {}) as Record<string, unknown>;
  s.endless = { runs: num(e.runs), bestLevels: num(e.bestLevels), bestScore: num(e.bestScore) };
  const p = (o.precision ?? {}) as Record<string, unknown>;
  s.precision = { runs: num(p.runs), bestLevels: num(p.bestLevels) };
  const pr = (o.practice ?? {}) as Record<string, unknown>;
  s.practice = { solved: num(pr.solved), size: SIZES.includes(pr.size as PracticeSize) ? (pr.size as PracticeSize) : 'medium' };
  if (Array.isArray(o.history)) s.history = o.history.map(num).slice(-HISTORY);
  s.solved = num(o.solved);
  s.underPar = num(o.underPar);
  s.muted = o.muted === true;
  s.patterns = o.patterns !== false;
  const h = o.help as Record<string, unknown> | null | undefined;
  if (h && typeof h.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(h.day)) s.help = { day: h.day, index: Math.min(DAILY_LEVELS - 1, num(h.index)), hints: num(h.hints), spare: h.spare === true };
  if (o.challenges && typeof o.challenges === 'object') {
    for (const [key, v] of Object.entries(o.challenges as Record<string, unknown>).slice(-MAX_CHALLENGES)) {
      const c = key.length <= 120 ? cleanChallenge(v) : null;
      if (c) s.challenges[key] = c;
    }
  }
  return s;
}

export function loadCl(): ClSave {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? sanitizeCl(JSON.parse(raw)) : emptyClSave();
  } catch {
    return emptyClSave();
  }
}

export function saveCl(s: ClSave, today: string): void {
  const cutoff = addDays(today, -KEEP_DAYS);
  for (const day of Object.keys(s.daily)) if (day < cutoff) delete s.daily[day];
  for (const [key, c] of Object.entries(s.challenges)) if (c.day < cutoff) delete s.challenges[key];
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {
    /* private mode or full storage: the game still works, it just forgets */
  }
}

/**
 * Saves a change on top of what is stored now (not an in-memory copy), so a second open tab never
 * erases what the other one recorded. Returns the saved save.
 */
export function updateCl(change: (s: ClSave) => ClSave, today: string): ClSave {
  const next = change(loadCl());
  saveCl(next, today);
  return next;
}

/**
 * Records one finished level (any mode); `daily` is the daily's date for daily levels and `index` the
 * puzzle's place in it. A daily puzzle that is already recorded (another tab got there first) is kept.
 */
export function recordLevel(s: ClSave, r: LevelResult, daily: string | null, practice = false, index?: number): ClSave {
  if (daily && index !== undefined && (s.daily[daily]?.length ?? 0) !== index) return s;
  const next: ClSave = {
    ...s,
    daily: { ...s.daily },
    history: r.solved ? [...s.history, Math.max(0, r.moves - r.par)].slice(-HISTORY) : s.history,
    solved: s.solved + (r.solved ? 1 : 0),
    underPar: s.underPar + (r.solved && r.moves <= r.par ? 1 : 0),
    practice: practice && r.solved ? { ...s.practice, solved: s.practice.solved + 1 } : s.practice,
  };
  if (daily) {
    next.daily[daily] = [...(s.daily[daily] ?? []), r].slice(0, DAILY_LEVELS);
    next.help = null;
  }
  return next;
}

export function recordEndless(s: ClSave, rs: readonly LevelResult[]): ClSave {
  const levels = rs.filter((r) => r.solved).length;
  return { ...s, endless: { runs: s.endless.runs + 1, bestLevels: Math.max(s.endless.bestLevels, levels), bestScore: Math.max(s.endless.bestScore, totalPoints(rs)) } };
}

export function recordPrecision(s: ClSave, rs: readonly LevelResult[]): ClSave {
  return { ...s, precision: { runs: s.precision.runs + 1, bestLevels: Math.max(s.precision.bestLevels, rs.filter((r) => r.solved).length) } };
}

export const isComplete = (rs: readonly LevelResult[] | undefined): boolean => (rs?.length ?? 0) >= DAILY_LEVELS;

export interface ClStats {
  dailyPlayed: number;
  streak: number;
  bestStreak: number;
  bestDaily: number;
  avgDaily: number;
  /** Average moves over par of the last 10 solved levels, and the 10 before (null when too few). */
  recentOver: number | null;
  previousOver: number | null;
}

const mean = (xs: number[]): number | null => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);

export function clStats(s: ClSave, today: string): ClStats {
  const done = Object.entries(s.daily).filter(([, r]) => isComplete(r));
  const days = new Set(done.map(([d]) => d));
  const totals = done.map(([, r]) => totalPoints(r));
  let bestStreak = 0;
  for (const d of days) {
    if (days.has(addDays(d, -1))) continue;
    let n = 0;
    let cur = d;
    while (days.has(cur)) {
      n++;
      cur = addDays(cur, 1);
    }
    bestStreak = Math.max(bestStreak, n);
  }
  return {
    dailyPlayed: done.length,
    streak: currentStreak(days, today),
    bestStreak,
    bestDaily: Math.max(0, ...totals),
    avgDaily: totals.length ? Math.round((totals.reduce((a, b) => a + b, 0) / totals.length) * 10) / 10 : 0,
    recentOver: mean(s.history.slice(-10)),
    previousOver: s.history.length >= 20 ? mean(s.history.slice(-20, -10)) : null,
  };
}
