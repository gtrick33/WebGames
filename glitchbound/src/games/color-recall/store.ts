/**
 * Color Recall's own device-local save: daily results (also used to resume an unfinished daily),
 * streaks and practice records. Nothing leaves the browser.
 */
import { addDays } from '../../platform/dates';
import { currentStreak } from '../../platform/daily';
import { MAX_POINTS, verdictFor } from './color';
import { ROUNDS, totalScore, type RoundResult } from './logic';

export const STORE_KEY = 'glitchbound.color-recall';
const KEEP_DAYS = 400;

export interface CrSave {
  v: 1;
  /** Results per day (YYYY-MM-DD); a day is complete with ROUNDS results. */
  daily: Record<string, RoundResult[]>;
  practice: { games: number; best: number; total: number };
  /** Best single color ever and how many perfect colors, across both modes. */
  bestColor: number;
  perfects: number;
  difficulty: string;
  sliders: 'hsb' | 'rgb';
  muted: boolean;
  /** The last daily color whose peek was shown, so leaving and resuming never shows it twice. */
  dailySeen: { day: string; round: number } | null;
}

export const emptyCrSave = (): CrSave => ({
  v: 1,
  daily: {},
  practice: { games: 0, best: 0, total: 0 },
  bestColor: 0,
  perfects: 0,
  difficulty: 'normal',
  sliders: 'hsb',
  muted: false,
  dailySeen: null,
});

/** Index of the last daily color already shown today, or -1. */
export function seenDailyRound(s: CrSave, day: string): number {
  return s.dailySeen?.day === day ? s.dailySeen.round : -1;
}

export function markDailySeen(s: CrSave, day: string, round: number): CrSave {
  return { ...s, dailySeen: { day, round: Math.max(round, seenDailyRound(s, day)) } };
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);

function cleanResult(v: unknown): RoundResult | null {
  if (!v || typeof v !== 'object') return null;
  const r = v as Record<string, unknown>;
  if (typeof r.targetId !== 'string' || typeof r.guess !== 'string' || !/^#[0-9A-F]{6}$/i.test(r.guess)) return null;
  return { targetId: r.targetId, guess: r.guess, dE: num(r.dE), points: Math.min(MAX_POINTS, Math.round(num(r.points))) };
}

export function sanitizeCr(raw: unknown): CrSave {
  const s = emptyCrSave();
  if (!raw || typeof raw !== 'object') return s;
  const o = raw as Record<string, unknown>;
  if (o.v !== 1) return s;
  if (o.daily && typeof o.daily === 'object') {
    for (const [day, list] of Object.entries(o.daily as Record<string, unknown>)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Array.isArray(list)) continue;
      const results = list.map(cleanResult).filter((r): r is RoundResult => !!r).slice(0, ROUNDS);
      if (results.length) s.daily[day] = results;
    }
  }
  const p = (o.practice ?? {}) as Record<string, unknown>;
  s.practice = { games: Math.floor(num(p.games)), best: Math.floor(num(p.best)), total: Math.floor(num(p.total)) };
  s.bestColor = Math.floor(num(o.bestColor));
  s.perfects = Math.floor(num(o.perfects));
  if (typeof o.difficulty === 'string') s.difficulty = o.difficulty;
  if (o.sliders === 'rgb') s.sliders = 'rgb';
  s.muted = o.muted === true;
  const seen = o.dailySeen as Record<string, unknown> | null | undefined;
  if (seen && typeof seen.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(seen.day)) s.dailySeen = { day: seen.day, round: Math.min(ROUNDS - 1, Math.floor(num(seen.round))) };
  return s;
}

export function loadCr(): CrSave {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? sanitizeCr(JSON.parse(raw)) : emptyCrSave();
  } catch {
    return emptyCrSave();
  }
}

export function saveCr(s: CrSave, today: string): void {
  // Trim very old daily history so the save never grows without bound.
  const cutoff = addDays(today, -KEEP_DAYS);
  for (const day of Object.keys(s.daily)) if (day < cutoff) delete s.daily[day];
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {
    /* private mode or full storage: the game still works, it just forgets */
  }
}

/** Records one finished color (daily or practice) into the all-time numbers. */
export function recordColor(s: CrSave, r: RoundResult, daily: string | null): CrSave {
  const next: CrSave = { ...s, daily: { ...s.daily }, bestColor: Math.max(s.bestColor, r.points), perfects: s.perfects + (verdictFor(r.points) === 'perfect' ? 1 : 0) };
  if (daily) next.daily[daily] = [...(s.daily[daily] ?? []), r].slice(0, ROUNDS);
  return next;
}

export function recordPracticeGame(s: CrSave, score: number): CrSave {
  return { ...s, practice: { games: s.practice.games + 1, best: Math.max(s.practice.best, score), total: s.practice.total + score } };
}

export const isComplete = (results: RoundResult[] | undefined): boolean => (results?.length ?? 0) >= ROUNDS;

export interface CrStats {
  dailyPlayed: number;
  streak: number;
  bestStreak: number;
  bestDaily: number;
  avgDaily: number;
  practiceGames: number;
  practiceBest: number;
  bestColor: number;
  perfects: number;
  /** Completed daily totals bucketed by 1,000 (0-999, 1,000-1,999, ... 4,000-5,000). */
  histogram: number[];
}

export function crStats(s: CrSave, today: string): CrStats {
  const done = Object.entries(s.daily).filter(([, r]) => isComplete(r));
  const days = new Set(done.map(([d]) => d));
  const totals = done.map(([, r]) => totalScore(r));
  let bestStreak = 0;
  for (const d of days) {
    if (days.has(addDays(d, -1))) continue; // only count from the first day of each run
    let n = 0;
    let cur = d;
    while (days.has(cur)) {
      n++;
      cur = addDays(cur, 1);
    }
    bestStreak = Math.max(bestStreak, n);
  }
  const histogram = [0, 0, 0, 0, 0];
  for (const t of totals) histogram[Math.min(4, Math.floor(t / 1000))]!++;
  return {
    dailyPlayed: done.length,
    streak: currentStreak(days, today),
    bestStreak,
    bestDaily: Math.max(0, ...totals),
    avgDaily: totals.length ? Math.round(totals.reduce((a, b) => a + b, 0) / totals.length) : 0,
    practiceGames: s.practice.games,
    practiceBest: s.practice.best,
    bestColor: s.bestColor,
    perfects: s.perfects,
    histogram,
  };
}
