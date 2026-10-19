/**
 * Where's the Ball? device-local save: daily results (and resume), streaks and Endless bests.
 * Nothing leaves the browser.
 */
import { addDays } from '../../platform/dates';
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
}

export const emptyWbSave = (): WbSave => ({ v: 1, daily: {}, endless: { runs: 0, bestLevels: 0, bestScore: 0 }, fastest: 0, muted: false, progress: null });

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
  const p = o.progress as Record<string, unknown> | null | undefined;
  if (p && typeof p.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.day) && Array.isArray(p.wrong)) {
    s.progress = {
      day: p.day,
      index: Math.min(DAILY_LEVELS - 1, Math.floor(num(p.index))),
      wrong: p.wrong.filter(isGuess).map(({ x, y, heat }) => ({ x, y, heat })),
      hints: Math.floor(num(p.hints)),
      ms: Math.floor(num(p.ms)),
    };
  }
  return s;
}

export function loadWb(): WbSave {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? sanitizeWb(JSON.parse(raw)) : emptyWbSave();
  } catch {
    return emptyWbSave();
  }
}

export function saveWb(s: WbSave, today: string): void {
  const cutoff = addDays(today, -KEEP_DAYS);
  for (const day of Object.keys(s.daily)) if (day < cutoff) delete s.daily[day];
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {
    /* private mode or full storage */
  }
}

export function recordLevel(s: WbSave, r: LevelResult, daily: string | null): WbSave {
  const next: WbSave = { ...s, daily: { ...s.daily }, fastest: r.found && (s.fastest === 0 || r.seconds < s.fastest) ? r.seconds : s.fastest };
  if (daily) {
    next.daily[daily] = [...(s.daily[daily] ?? []), r].slice(0, DAILY_LEVELS);
    next.progress = null;
  }
  return next;
}

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
