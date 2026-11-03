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
  /**
   * Friends' challenge rounds, by `${id}:${round}`: one attempt each, so a round left halfway resumes
   * and a finished one shows its result instead of a replay. Pruned like the dailies.
   */
  challenges: Record<string, ChallengeEntry>;
}

export interface ChallengeEntry {
  /** The day it was played (for pruning). */
  day: string;
  results: PictureResult[];
  progress: PictureProgress | null;
  /** The round's end was reported to the arcade (exactly once). */
  reported: boolean;
}

export const emptySgSave = (): SgSave => ({ v: 1, daily: {}, rush: { runs: 0, bestFound: 0, bestScore: 0 }, relax: { pictures: 0, difficulty: 1 }, fastest: 0, muted: false, progress: null, challenges: {} });

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);

function cleanResult(v: unknown): PictureResult | null {
  if (!v || typeof v !== 'object') return null;
  const r = v as Record<string, unknown>;
  if (typeof r.score !== 'number') return null;
  return { score: Math.min(MAX_PICTURE, num(r.score)), found: Math.min(5, num(r.found)), misses: num(r.misses), hints: num(r.hints), seconds: num(r.seconds) };
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function cleanProgress(p: Record<string, unknown>): PictureProgress | null {
  if (!Array.isArray(p.found) || !Array.isArray(p.misses)) return null;
  return {
    found: p.found.filter((d): d is number => Number.isInteger(d) && (d as number) >= 0 && (d as number) < DIFFS).slice(0, DIFFS),
    misses: (p.misses as unknown[])
      .filter((m): m is { x: number; y: number } => !!m && typeof m === 'object' && isNum((m as { x: unknown }).x) && isNum((m as { y: unknown }).y))
      .map(({ x, y }) => ({ x, y })),
    hints: num(p.hints),
    hinted: Number.isInteger(p.hinted) && (p.hinted as number) >= 0 && (p.hinted as number) < DIFFS ? (p.hinted as number) : null,
    ms: num(p.ms),
  };
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
  const progress = p && typeof p === 'object' && typeof p.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.day) ? cleanProgress(p) : null;
  if (p && progress) s.progress = { day: p.day as string, index: Math.min(DAILY_PICTURES - 1, num(p.index)), ...progress };
  if (o.challenges && typeof o.challenges === 'object') {
    for (const [key, v] of Object.entries(o.challenges as Record<string, unknown>)) {
      if (!v || typeof v !== 'object' || key.length > 80) continue;
      const c = v as Record<string, unknown>;
      if (typeof c.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(c.day)) continue;
      const results = Array.isArray(c.results) ? c.results.map(cleanResult).filter((r): r is PictureResult => !!r).slice(0, DAILY_PICTURES) : [];
      const cp = c.progress && typeof c.progress === 'object' ? cleanProgress(c.progress as Record<string, unknown>) : null;
      s.challenges[key] = { day: c.day, results, progress: results.length >= DAILY_PICTURES ? null : cp, reported: c.reported === true };
    }
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
  for (const [key, c] of Object.entries(s.challenges)) if (c.day < cutoff) delete s.challenges[key];
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {
    /* private mode or full storage */
  }
}

/**
 * Applies a change to the save as stored now (another tab may have written since this one loaded it)
 * and writes it back.
 */
export function updateSg(change: (s: SgSave) => SgSave, today: string): SgSave {
  const next = change(loadSg());
  saveSg(next, today);
  return next;
}

/**
 * Records a finished picture; full solves update the fastest time. `index` is the daily picture's
 * number: when another tab already recorded it, nothing changes.
 */
export function recordPicture(s: SgSave, r: PictureResult, daily: string | null, relax = false, index?: number): SgSave {
  if (daily && index !== undefined && (s.daily[daily]?.length ?? 0) !== index) return s;
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

/** Records a challenge round's finished picture (or its unfinished one's progress, with no result). */
export function recordChallenge(s: SgSave, key: string, day: string, change: Partial<ChallengeEntry>): SgSave {
  const prev = s.challenges[key] ?? { day, results: [], progress: null, reported: false };
  return { ...s, challenges: { ...s.challenges, [key]: { ...prev, ...change } } };
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
