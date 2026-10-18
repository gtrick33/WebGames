/**
 * Spot the Glitch rules as pure functions (no React, no DOM, no timers): taps, misses, hints, the
 * anti-spam lock, scoring and the daily set. Time comes in as `now` (ms) on each action.
 */
import { daysBetween, hashString } from '../../platform/dates';
import { diffAt, DIFFS, makePuzzle, type Puzzle } from './diffs';

export const EPOCH = '2026-10-18';
export const DAILY_PICTURES = 3;
export const MAX_PICTURE = 1000;
export const MISS_COST = 40;
export const HINT_COST = 150;
/** Three misses within this window lock taps for LOCK_MS (stops tap-spamming the picture). */
export const SPAM_WINDOW_MS = 4000;
export const LOCK_MS = 2000;
/** Glitch Rush clock. */
export const RUSH_START_S = 60;
export const RUSH_BONUS_S = 8;

export interface Miss {
  x: number;
  y: number;
  at: number;
}

export interface PictureState {
  puzzle: Puzzle;
  /** Differences found, in the order they were found. */
  found: number[];
  misses: Miss[];
  hints: number;
  /** Difference currently highlighted by a hint. */
  hinted: number | null;
  lockedUntil: number;
  startedAt: number;
  finishedAt: number | null;
  gaveUp: boolean;
}


export type TapOutcome = 'found' | 'again' | 'miss' | 'locked' | 'ignored';

export function startPicture(puzzle: Puzzle, now: number): PictureState {
  return { puzzle, found: [], misses: [], hints: 0, hinted: null, lockedUntil: 0, startedAt: now, finishedAt: null, gaveUp: false };
}

export const isDone = (s: PictureState): boolean => s.finishedAt !== null;

/** Applies a tap and says what happened (for sound and visual feedback). */
export function tap(s: PictureState, x: number, y: number, slop: number, now: number): { state: PictureState; outcome: TapOutcome; diff: number } {
  if (isDone(s)) return { state: s, outcome: 'ignored', diff: -1 };
  if (now < s.lockedUntil) return { state: s, outcome: 'locked', diff: -1 };
  const d = diffAt(s.puzzle, x, y, slop);
  if (d >= 0 && s.found.includes(d)) return { state: s, outcome: 'again', diff: d };
  if (d >= 0) {
    const found = [...s.found, d];
    const done = found.length >= s.puzzle.diffs.length;
    return { state: { ...s, found, hinted: s.hinted === d ? null : s.hinted, finishedAt: done ? now : null }, outcome: 'found', diff: d };
  }
  const misses = [...s.misses, { x, y, at: now }];
  const recent = misses.filter((m) => now - m.at < SPAM_WINDOW_MS).length;
  return { state: { ...s, misses, lockedUntil: recent >= 3 ? now + LOCK_MS : s.lockedUntil }, outcome: 'miss', diff: -1 };
}

/** Highlights the area of one unfound difference (the first unfound, so hints are predictable). */
export function applyHint(s: PictureState): PictureState {
  if (isDone(s)) return s;
  const next = s.puzzle.diffs.findIndex((_, i) => !s.found.includes(i));
  if (next < 0 || s.hinted === next) return s;
  return { ...s, hints: s.hints + 1, hinted: next };
}

export function giveUp(s: PictureState, now: number): PictureState {
  return isDone(s) ? s : { ...s, gaveUp: true, finishedAt: now };
}

export const seconds = (s: PictureState, now: number): number => Math.max(0, ((s.finishedAt ?? now) - s.startedAt) / 1000);

/** Time penalty: nothing for the first 20 s, then 4 points a second, at most 400. */
export const timePenalty = (secs: number): number => Math.min(400, Math.max(0, Math.floor(secs) - 20) * 4);

/**
 * Score for one picture, 0-1000. A full solve keeps at least 100 per difference (500), so a slow,
 * careful solve still beats giving up; giving up scores 100 per difference found.
 */
export function pictureScore(s: PictureState, now: number): number {
  const found = s.found.length;
  if (s.gaveUp || found < DIFFS) return found * 100;
  const raw = MAX_PICTURE - s.misses.length * MISS_COST - s.hints * HINT_COST - timePenalty(seconds(s, now));
  return Math.max(found * 100, raw);
}

export interface PictureResult {
  score: number;
  found: number;
  misses: number;
  hints: number;
  seconds: number;
}

export function resultOf(s: PictureState): PictureResult {
  const now = s.finishedAt ?? s.startedAt;
  return { score: pictureScore(s, now), found: s.found.length, misses: s.misses.length, hints: s.hints, seconds: Math.round(seconds(s, now)) };
}

/* ------------------------------------------------------------------ daily */

/** Dailies up to this day were published with the first five themes; they are rebuilt exactly. */
export const CLASSIC_UNTIL = '2026-10-18';

export function dailyPuzzle(day: string, index: number): Puzzle {
  return makePuzzle(hashString(`spot-the-glitch:${day}:${index}`), Math.min(2, index), undefined, day <= CLASSIC_UNTIL);
}

export function dailyNumber(day: string): number {
  return Math.max(1, daysBetween(EPOCH, day) + 1);
}

/** Glitch Rush: difficulty climbs every two pictures. */
export const rushDifficulty = (pictures: number): number => Math.min(2, Math.floor(pictures / 2));

export const totalScore = (rs: readonly PictureResult[]): number => rs.reduce((n, r) => n + r.score, 0);

/** Stats for the arcade at the end of a daily or Rush run. */
export function endStats(rs: readonly PictureResult[], extra: Record<string, number> = {}): { score: number; stats: Record<string, number> } {
  const found = rs.reduce((n, r) => n + r.found, 0);
  const clean = rs.filter((r) => r.found === DIFFS && r.misses === 0 && r.hints === 0).length;
  return { score: totalScore(rs), stats: { found, clean, ...extra } };
}

/** One row per picture: a 🟩 per glitch found, ⬛ per glitch missed. Never where they are. */
export const pictureSquares = (r: PictureResult): string => `${'🟩'.repeat(r.found)}${'⬛'.repeat(Math.max(0, DIFFS - r.found))}`;
export const resultGrid = (rs: readonly PictureResult[]): string => rs.map(pictureSquares).join('\n');

/** Spoiler-free share text: found counts and times, never where the glitches are. */
export function shareText(day: string, rs: readonly PictureResult[], streak: number, url: string): string {
  const rows = rs.map((r) => `${pictureSquares(r)} ${r.seconds}s${r.misses ? ` ·${r.misses}✗` : ''}`);
  const lines = [`Spot the Glitch #${dailyNumber(day)} 👾`, ...rows, `${totalScore(rs).toLocaleString('en-US')} / ${(DAILY_PICTURES * MAX_PICTURE).toLocaleString('en-US')}`];
  if (streak > 1) lines.push(`🔥 ${streak}-day streak`);
  lines.push(url);
  return lines.join('\n');
}
