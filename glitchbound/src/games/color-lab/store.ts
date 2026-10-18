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
  /** Patterns on the colours (on by default; helps colour-blind players). */
  patterns: boolean;
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
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {
    /* private mode or full storage: the game still works, it just forgets */
  }
}

/** Records one finished level (any mode); `daily` is today's date for daily levels. */
export function recordLevel(s: ClSave, r: LevelResult, daily: string | null, practice = false): ClSave {
  const next: ClSave = {
    ...s,
    daily: { ...s.daily },
    history: r.solved ? [...s.history, Math.max(0, r.moves - r.par)].slice(-HISTORY) : s.history,
    solved: s.solved + (r.solved ? 1 : 0),
    underPar: s.underPar + (r.solved && r.moves <= r.par ? 1 : 0),
    practice: practice && r.solved ? { ...s.practice, solved: s.practice.solved + 1 } : s.practice,
  };
  if (daily) next.daily[daily] = [...(s.daily[daily] ?? []), r].slice(0, DAILY_LEVELS);
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
