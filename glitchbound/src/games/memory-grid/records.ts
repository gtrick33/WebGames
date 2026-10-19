/**
 * Memory Grid's own local records: per-mode bests, a small local leaderboard, the daily result and streak,
 * and the mute setting. Pure update functions plus a tolerant load/save (storage may be blocked or corrupt).
 */
import { MODES, type Mode } from './pattern';
import type { RunSummary } from './scoring';

export const RECORDS_KEY = 'glitchbound.memory-grid.v1';
export const BOARD_SIZE = 5;

export interface ModeBest {
  score: number;
  longest: number;
  accuracy: number;
  /** Perfect Recall: fastest completed ladder, seconds. */
  fastest?: number;
  plays: number;
}

export interface BoardRow {
  score: number;
  longest: number;
  day: string;
}

export interface DailyResult {
  day: string;
  /** Rounds reached (1-based round in which the run ended) and patterns cleared. */
  cleared: number;
  score: number;
  accuracy: number;
}

export interface Records {
  best: Partial<Record<Mode, ModeBest>>;
  board: Partial<Record<Mode, BoardRow[]>>;
  /** Today's Daily Challenge result (one attempt a day). */
  daily: DailyResult | null;
  /** The day a Daily Challenge was last started: starting it uses up the day's one try. */
  dailyStarted?: string;
  streak: { last: string | null; count: number; best: number };
  muted: boolean;
}

export function emptyRecords(): Records {
  return { best: {}, board: {}, daily: null, streak: { last: null, count: 0, best: 0 }, muted: false };
}

/** Whole days from a to b for YYYY-MM-DD keys. */
function dayDiff(a: string, b: string): number {
  const t = (k: string) => Date.UTC(Number(k.slice(0, 4)), Number(k.slice(5, 7)) - 1, Number(k.slice(8, 10)));
  return Math.round((t(b) - t(a)) / 86_400_000);
}

/** Current streak as of `today`: it survives until the end of the day after the last played day. */
export function liveStreak(r: Records, today: string): number {
  if (!r.streak.last) return 0;
  return dayDiff(r.streak.last, today) <= 1 ? r.streak.count : 0;
}

/** Whether today's official Daily Challenge attempt has been used. */
export function playedDailyToday(r: Records, today: string): boolean {
  return r.daily?.day === today;
}

/** The daily is one try a day: finished, or started and left. */
export const dailyUsedToday = (r: Records, today: string): boolean => playedDailyToday(r, today) || r.dailyStarted === today;

export interface RecordOutcome {
  records: Records;
  /** Stats in which this run set a new personal best for its mode. */
  newBest: Array<'score' | 'longest' | 'fastest'>;
  /** 1-based place on the local leaderboard, or null when it did not make it. */
  place: number | null;
  /** Whether this run was the official daily attempt. */
  officialDaily: boolean;
}

export function recordRun(prev: Records, run: RunSummary, today: string): RecordOutcome {
  const records: Records = { ...prev, best: { ...prev.best }, board: { ...prev.board }, streak: { ...prev.streak } };
  const old = prev.best[run.mode];
  const newBest: RecordOutcome['newBest'] = [];
  if (run.score > 0 && run.score > (old?.score ?? 0)) newBest.push('score');
  if (run.longest > 0 && run.longest > (old?.longest ?? 0)) newBest.push('longest');
  const secs = Math.max(1, Math.round(run.inputMs / 1000));
  const fastest = run.mode === 'perfect' && run.complete ? Math.min(secs, old?.fastest ?? Infinity) : old?.fastest;
  if (run.mode === 'perfect' && run.complete && (old?.fastest === undefined || secs < old.fastest)) newBest.push('fastest');
  records.best[run.mode] = {
    score: Math.max(run.score, old?.score ?? 0),
    longest: Math.max(run.longest, old?.longest ?? 0),
    accuracy: Math.max(run.taps > 0 ? run.accuracy : 0, old?.accuracy ?? 0),
    ...(fastest !== undefined ? { fastest } : {}),
    plays: (old?.plays ?? 0) + 1,
  };

  let place: number | null = null;
  if (run.score > 0) {
    const rows = [...(prev.board[run.mode] ?? [])];
    const row = { score: run.score, longest: run.longest, day: today };
    let i = rows.findIndex((r) => run.score > r.score);
    if (i === -1) i = rows.length;
    if (i < BOARD_SIZE) {
      rows.splice(i, 0, row);
      records.board[run.mode] = rows.slice(0, BOARD_SIZE);
      place = i + 1;
    }
  }

  const officialDaily = run.mode === 'daily' && !playedDailyToday(prev, today);
  if (officialDaily) {
    records.daily = { day: today, cleared: run.cleared, score: run.score, accuracy: run.accuracy };
    const count = liveStreak(prev, today) + 1;
    records.streak = { last: today, count, best: Math.max(prev.streak.best, count) };
  }
  return { records, newBest, place, officialDaily };
}

/* ------------------------------------------------------------------ persistence */

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Parses stored JSON, keeping only well-formed parts. */
export function parseRecords(raw: string | null): Records {
  const r = emptyRecords();
  if (!raw) return r;
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return r;
  }
  if (!data || typeof data !== 'object') return r;
  const best = (data.best ?? {}) as Record<string, Record<string, unknown>>;
  const board = (data.board ?? {}) as Record<string, unknown>;
  for (const m of MODES) {
    const b = best[m];
    if (b && isNum(b.score) && isNum(b.longest) && isNum(b.accuracy) && isNum(b.plays)) {
      r.best[m] = { score: b.score, longest: b.longest, accuracy: b.accuracy, plays: b.plays, ...(isNum(b.fastest) ? { fastest: b.fastest } : {}) };
    }
    const rows = board[m];
    if (Array.isArray(rows)) {
      r.board[m] = rows
        .filter((x): x is BoardRow => !!x && isNum((x as BoardRow).score) && isNum((x as BoardRow).longest) && isDay((x as BoardRow).day))
        .slice(0, BOARD_SIZE)
        .map(({ score, longest, day }) => ({ score, longest, day }));
    }
  }
  const d = data.daily as Record<string, unknown> | null | undefined;
  if (d && isDay(d.day) && isNum(d.cleared) && isNum(d.score) && isNum(d.accuracy)) r.daily = { day: d.day, cleared: d.cleared, score: d.score, accuracy: d.accuracy };
  const s = data.streak as Record<string, unknown> | undefined;
  if (s && isNum(s.count) && isNum(s.best) && (s.last === null || isDay(s.last))) r.streak = { last: s.last as string | null, count: s.count, best: s.best };
  if (isDay(data.dailyStarted)) r.dailyStarted = data.dailyStarted;
  r.muted = data.muted === true;
  return r;
}

export function loadRecords(): Records {
  try {
    return parseRecords(window.localStorage.getItem(RECORDS_KEY));
  } catch {
    return emptyRecords();
  }
}

export function saveRecords(r: Records): void {
  try {
    window.localStorage.setItem(RECORDS_KEY, JSON.stringify(r));
  } catch {
    /* storage full or blocked: records just won't persist */
  }
}
