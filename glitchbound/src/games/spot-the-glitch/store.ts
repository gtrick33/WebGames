/**
 * Spot the Glitch's device-local save: daily results (and resume), streaks, Glitch Rush and relax
 * records. Nothing leaves the browser.
 */
import { addDays } from '../../platform/dates';
import { currentStreak } from '../../platform/daily';
import { DIFFS } from './diffs';
import { DAILY_PICTURES, MAX_PICTURE, totalScore, type PictureResult, type PictureProgress } from './logic';

export const STORE_KEY = 'glitchbound.spot-the-glitch';
const KEEP_DAYS = 400;

export interface SgSave {
  v: 1;
  daily: Record<string, PictureResult[]>;
  rush: { runs: number; bestFound: number; bestScore: number };
  relax: { pictures: number; difficulty: number };
  fastest: number;
  muted: boolean;
  /**
   * Today's unfinished daily picture (finds, misses, hints and time so far). Leaving or reloading picks
   * it up again instead of starting it over: the daily is one try a day.
   */
  progress: (PictureProgress & { day: string; index: number }) | null;
}

export const emptySgSave = (): SgSave => ({ v: 1, daily: {}, rush: { runs: 0, bestFound: 0, bestScore: 0 }, relax: { pictures: 0, difficulty: 1 }, fastest: 0, muted: false, progress: null });

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);

function cleanResult(v: unknown): PictureResult | null {
  if (!v || typeof v !== 'object') return null;
  const r = v as Record<string, unknown>;
  if (typeof r.score !== 'number') return null;
  return { score: Math.min(MAX_PICTURE, num(r.score)), found: Math.min(5, num(r.found)), misses: num(r.misses), hints: num(r.hints), seconds: num(r.seconds) };
}

export function sanitizeSg(raw: unknown): SgSave {
  const s = emptySgSave();
  if (!raw || typeof raw !== 'object') return s;
  const o = raw as Record<string, unknown>;
  if (o.v !== 1) return s;
  if (o.daily && typeof o.daily === 'object') {
    for (const [day, list] of Object.entries(o.daily as Record<string, unknown>)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Array.isArray(list)) continue;
      const rs = list.map(cleanResult).filter((r): r is PictureResult => !!r).slice(0, DAILY_PICTURES);
      if (rs.length) s.daily[day] = rs;
    }
  }
  const r = (o.rush ?? {}) as Record<string, unknown>;
  s.rush = { runs: num(r.runs), bestFound: num(r.bestFound), bestScore: num(r.bestScore) };
  const x = (o.relax ?? {}) as Record<string, unknown>;
  s.relax = { pictures: num(x.pictures), difficulty: Math.min(2, num(x.difficulty)) };
  s.fastest = num(o.fastest);
  s.muted = o.muted === true;
  const p = o.progress as Record<string, unknown> | null | undefined;
  if (p && typeof p.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.day) && Array.isArray(p.found) && Array.isArray(p.misses)) {
    const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
    s.progress = {
      day: p.day,
      index: Math.min(DAILY_PICTURES - 1, num(p.index)),
      found: p.found.filter((d): d is number => Number.isInteger(d) && (d as number) >= 0 && (d as number) < DIFFS).slice(0, DIFFS),
      misses: (p.misses as unknown[])
        .filter((m): m is { x: number; y: number } => !!m && typeof m === 'object' && isNum((m as { x: unknown }).x) && isNum((m as { y: unknown }).y))
        .map(({ x, y }) => ({ x, y })),
      hints: num(p.hints),
      hinted: Number.isInteger(p.hinted) && (p.hinted as number) >= 0 && (p.hinted as number) < DIFFS ? (p.hinted as number) : null,
      ms: num(p.ms),
    };
  }
  return s;
}

export function loadSg(): SgSave {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? sanitizeSg(JSON.parse(raw)) : emptySgSave();
  } catch {
    return emptySgSave();
  }
}

export function saveSg(s: SgSave, today: string): void {
  const cutoff = addDays(today, -KEEP_DAYS);
  for (const day of Object.keys(s.daily)) if (day < cutoff) delete s.daily[day];
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {
    /* private mode or full storage */
  }
}

/** Records a finished picture; full solves update the fastest time. */
export function recordPicture(s: SgSave, r: PictureResult, daily: string | null, relax = false): SgSave {
  const next: SgSave = {
    ...s,
    daily: { ...s.daily },
    fastest: r.found === 5 && r.hints === 0 && (s.fastest === 0 || r.seconds < s.fastest) ? Math.max(1, r.seconds) : s.fastest,
    relax: relax ? { ...s.relax, pictures: s.relax.pictures + 1 } : s.relax,
  };
  if (daily) {
    next.daily[daily] = [...(s.daily[daily] ?? []), r].slice(0, DAILY_PICTURES);
    next.progress = null;
  }
  return next;
}

export function recordRush(s: SgSave, found: number, score: number): SgSave {
  return { ...s, rush: { runs: s.rush.runs + 1, bestFound: Math.max(s.rush.bestFound, found), bestScore: Math.max(s.rush.bestScore, score) } };
}

export const isComplete = (rs: readonly PictureResult[] | undefined): boolean => (rs?.length ?? 0) >= DAILY_PICTURES;

export function sgStats(s: SgSave, today: string): { played: number; streak: number; best: number; avg: number } {
  const done = Object.entries(s.daily).filter(([, r]) => isComplete(r));
  const totals = done.map(([, r]) => totalScore(r));
  return {
    played: done.length,
    streak: currentStreak(new Set(done.map(([d]) => d)), today),
    best: Math.max(0, ...totals),
    avg: totals.length ? Math.round(totals.reduce((a, b) => a + b, 0) / totals.length) : 0,
  };
}
