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
  /** Longest sequence (saves from before it was kept have none). */
  longest?: number;
}

/**
 * Where an unfinished run stands: the next pattern to play and the totals so far. `shown` is set to `round`
 * once that pattern's playback has begun: a run left after that has used its look and ends there as a slip.
 */
export interface DailyProgress {
  day: string;
  round: number;
  cleared: number;
  longest: number;
  score: number;
  taps: number;
  correctTaps: number;
  inputMs: number;
  shown?: number;
}

/** A friends' challenge round (keyed `id:round`): where it stands, and whether its end was reported. */
export interface ChallengeProgress extends DailyProgress {
  done?: boolean;
  complete?: boolean;
}

export interface Records {
  best: Partial<Record<Mode, ModeBest>>;
  board: Partial<Record<Mode, BoardRow[]>>;
  /** Today's Daily Challenge result (one attempt a day). */
  daily: DailyResult | null;
  /** The day a Daily Challenge was last started: starting it uses up the day's one try. */
  dailyStarted?: string;
  /** Today's unfinished Daily Challenge, saved after every cleared pattern so leaving or reloading resumes it. */
  dailyRun?: DailyProgress;
  /** Friends' challenge rounds played on this device: one attempt each, kept for a month. */
  challenges?: Record<string, ChallengeProgress>;
  streak: { last: string | null; count: number; best: number };
  muted: boolean;
}

export function emptyRecords(): Records {
  return { best: {}, board: {}, daily: null, streak: { last: null, count: 0, best: 0 }, muted: false };
}

/** Whole days from a to b for YYYY-MM-DD keys. */
export function dayDiff(a: string, b: string): number {
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

/** Today's unfinished Daily Challenge to pick up again, if any (the try is used, the run isn't over). */
export const dailyToResume = (r: Records, today: string): DailyProgress | null => (!playedDailyToday(r, today) && r.dailyRun?.day === today ? r.dailyRun : null);

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
    delete records.dailyRun;
    records.daily = { day: today, cleared: run.cleared, score: run.score, accuracy: run.accuracy, longest: run.longest };
    const count = liveStreak(prev, today) + 1;
    records.streak = { last: today, count, best: Math.max(prev.streak.best, count) };
  }
  return { records, newBest, place, officialDaily };
}

/** A run's totals so far as a finished run (ended by a slip, or by leaving after a pattern was shown). */
export function progressSummary(p: DailyProgress, mode: RunSummary['mode'], complete = false): RunSummary {
  const accuracy = p.taps > 0 ? Math.round((p.correctTaps / p.taps) * 100) : 0;
  return { mode, score: p.score, cleared: p.cleared, longest: p.longest, accuracy, taps: p.taps, inputMs: p.inputMs, complete };
}

export interface Settled {
  records: Records;
  /** The daily that was ended, and its day; undefined when only a stale leftover was dropped. */
  summary?: RunSummary;
  day?: string;
}

/**
 * Ends a Daily Challenge that can't go on, so its points and the streak day still count: one from an
 * earlier day (recorded under its own day), today's when its pattern was shown before the player left
 * (one slip ends it), or one started before unfinished runs were saved. Null when there is nothing to settle.
 */
export function settleDaily(r: Records, today: string): Settled | null {
  const dr = r.dailyRun;
  if (dr) {
    if (r.daily && dayDiff(dr.day, r.daily.day) >= 0) {
      const records = { ...r };
      delete records.dailyRun;
      return { records };
    }
    const past = dayDiff(dr.day, today) > 0;
    if (!past && !(dr.day === today && dr.shown === dr.round)) return null;
    const summary = progressSummary(dr, 'daily');
    return { records: recordRun(r, summary, dr.day).records, summary, day: dr.day };
  }
  if (r.dailyStarted === today && !playedDailyToday(r, today)) {
    const summary: RunSummary = { mode: 'daily', score: 0, cleared: 0, longest: 0, accuracy: 0, taps: 0, inputMs: 0, complete: false };
    return { records: recordRun(r, summary, today).records, summary, day: today };
  }
  return null;
}

/** Drops challenge rounds older than a month (they can't be played any more). */
export function pruneChallenges(c: Records['challenges'], today: string): Records['challenges'] {
  if (!c) return c;
  const keep = Object.entries(c).filter(([, p]) => Math.abs(dayDiff(p.day, today)) <= 31);
  return Object.fromEntries(keep.slice(-50));
}

/* ------------------------------------------------------------------ persistence */

/** Caps for stored values: anything beyond is not a real run (a tampered or corrupt save) and is dropped. */
const MAX_ROUND = 500;
const MAX_SCORE = 10_000_000;
const MAX_TAPS = 1_000_000;
const MAX_MS = 100_000_000;
const MAX_DAYS = 100_000;

const isNum = (v: unknown, max = MAX_SCORE): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max;

function parseProgress(v: unknown): DailyProgress | null {
  const dr = v as Record<string, unknown> | null | undefined;
  if (!dr || typeof dr !== 'object' || !isDay(dr.day)) return null;
  if (!isNum(dr.round, MAX_ROUND) || dr.round < 1 || !isNum(dr.cleared, MAX_ROUND) || dr.cleared >= dr.round || !isNum(dr.longest, MAX_ROUND + 5)) return null;
  if (!isNum(dr.score) || !isNum(dr.taps, MAX_TAPS) || !isNum(dr.correctTaps, MAX_TAPS) || !isNum(dr.inputMs, MAX_MS)) return null;
  const n = (k: string): number => Math.floor(dr[k] as number);
  const p: DailyProgress = { day: dr.day, round: n('round'), cleared: n('cleared'), longest: n('longest'), score: n('score'), taps: n('taps'), correctTaps: Math.min(n('correctTaps'), n('taps')), inputMs: n('inputMs') };
  if (dr.shown === p.round) p.shown = p.round;
  return p;
}
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
    if (b && isNum(b.score) && isNum(b.longest, MAX_ROUND + 5) && isNum(b.accuracy, 100) && isNum(b.plays, MAX_TAPS)) {
      r.best[m] = { score: b.score, longest: b.longest, accuracy: b.accuracy, plays: b.plays, ...(isNum(b.fastest) ? { fastest: b.fastest } : {}) };
    }
    const rows = board[m];
    if (Array.isArray(rows)) {
      r.board[m] = rows
        .filter((x): x is BoardRow => !!x && isNum((x as BoardRow).score) && isNum((x as BoardRow).longest, MAX_ROUND + 5) && isDay((x as BoardRow).day))
        .slice(0, BOARD_SIZE)
        .map(({ score, longest, day }) => ({ score, longest, day }));
    }
  }
  const d = data.daily as Record<string, unknown> | null | undefined;
  if (d && isDay(d.day) && isNum(d.cleared, MAX_ROUND) && isNum(d.score) && isNum(d.accuracy, 100)) {
    r.daily = { day: d.day, cleared: d.cleared, score: d.score, accuracy: d.accuracy, ...(isNum(d.longest, MAX_ROUND + 5) ? { longest: d.longest } : {}) };
  }
  const s = data.streak as Record<string, unknown> | undefined;
  if (s && isNum(s.count, MAX_DAYS) && isNum(s.best, MAX_DAYS) && (s.last === null || isDay(s.last))) r.streak = { last: s.last as string | null, count: s.count, best: s.best };
  if (isDay(data.dailyStarted)) r.dailyStarted = data.dailyStarted;
  const dr = parseProgress(data.dailyRun);
  if (dr) r.dailyRun = dr;
  const ch = data.challenges as Record<string, unknown> | undefined;
  if (ch && typeof ch === 'object' && !Array.isArray(ch)) {
    const out: Record<string, ChallengeProgress> = {};
    for (const [k, v] of Object.entries(ch).slice(-50)) {
      const p = parseProgress(v);
      if (!p || k.length > 120) continue;
      const raw = v as Record<string, unknown>;
      out[k] = { ...p, ...(raw.done === true ? { done: true } : {}), ...(raw.complete === true ? { complete: true } : {}) };
    }
    r.challenges = out;
  }
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

/** The stored records, for a read-modify-write (another tab may have saved since); `fallback` when storage is blocked. */
export function freshRecords(fallback: Records): Records {
  try {
    return parseRecords(window.localStorage.getItem(RECORDS_KEY));
  } catch {
    return fallback;
  }
}

export function saveRecords(r: Records): void {
  try {
    window.localStorage.setItem(RECORDS_KEY, JSON.stringify(r));
  } catch {
    /* storage full or blocked: records just won't persist */
  }
}
