import { daysBetween, hashString } from '../../platform/dates';
import { ALLOWED_PACKED, ANSWERS } from './words';

/**
 * Letter Pinch rules, all pure. Each tile of a guess says whether the secret letter in that column is
 * later (up), earlier (down) or exactly (hit) the guessed letter; each column keeps an alphabet window
 * that squeezes shut as clues arrive. See DESIGN.md.
 */

export const WORD_LEN = 5;
export const MAX_GUESSES = 6;
/** Daily #1. Every player gets the same secret on the same local date. */
export const EPOCH = '2026-10-18';
const SHUFFLE_SEED = 'letter-pinch-v1';

export type Mark = 'up' | 'down' | 'hit';

export interface Row {
  guess: string;
  marks: Mark[];
}

/** Inclusive alphabet window for one column, as letter indexes 0 (a) to 25 (z). */
export interface Window {
  lo: number;
  hi: number;
}

export const ANSWER_LIST: readonly string[] = ANSWERS.split(' ');

let allowed: Set<string> | null = null;

/** Whether a word is an accepted guess. The 13k-word set is built on first use. */
export function isAllowed(word: string): boolean {
  if (!allowed) {
    allowed = new Set();
    for (let i = 0; i < ALLOWED_PACKED.length; i += WORD_LEN) allowed.add(ALLOWED_PACKED.slice(i, i + WORD_LEN));
  }
  return allowed.has(word);
}

const idx = (ch: string): number => ch.charCodeAt(0) - 97;
export const letterAt = (i: number): string => String.fromCharCode(97 + i);

/** Feedback for one guess: per column, where the secret letter lies relative to the guessed one. */
export function feedback(guess: string, secret: string): Mark[] {
  const marks: Mark[] = [];
  for (let i = 0; i < WORD_LEN; i++) {
    const g = guess[i]!;
    const s = secret[i]!;
    marks.push(g === s ? 'hit' : s > g ? 'up' : 'down');
  }
  return marks;
}

export function fullWindows(): Window[] {
  return Array.from({ length: WORD_LEN }, () => ({ lo: 0, hi: 25 }));
}

/** Folds every clue so far into one window per column. */
export function windowsFor(rows: readonly Row[]): Window[] {
  const w = fullWindows();
  for (const { guess, marks } of rows) {
    marks.forEach((m, i) => {
      const c = idx(guess[i]!);
      const col = w[i]!;
      if (m === 'hit') {
        col.lo = c;
        col.hi = c;
      } else if (m === 'up') col.lo = Math.max(col.lo, c + 1);
      else col.hi = Math.min(col.hi, c - 1);
    });
  }
  return w;
}

/** Whether a word fits every window (could still be the secret). */
export function fits(word: string, w: readonly Window[]): boolean {
  for (let i = 0; i < WORD_LEN; i++) {
    const c = idx(word[i]!);
    if (c < w[i]!.lo || c > w[i]!.hi) return false;
  }
  return true;
}

export type KeyState = 'open' | 'out' | 'hit';

/** On-screen key color: "out" when the letter is impossible in every column still open. */
export function keyState(letter: string, w: readonly Window[]): KeyState {
  const c = idx(letter);
  let open = false;
  let hit = false;
  for (const col of w) {
    if (col.lo === col.hi) {
      if (col.lo === c) hit = true;
    } else if (c >= col.lo && c <= col.hi) open = true;
  }
  return open ? 'open' : hit ? 'hit' : 'out';
}

export type GuessError = 'short' | 'unknown';

/** Validates a typed guess; null when it can be played. */
export function checkGuess(word: string): GuessError | null {
  if (word.length !== WORD_LEN) return 'short';
  return isAllowed(word) ? null : 'unknown';
}

/* ------------------------------------------------------------------ daily */

/** Deterministic PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const orders = new Map<number, string[]>();

/**
 * Dailies already published before the answer list grew. They stay first in the first pass, so
 * growing the list never changes a puzzle someone may already have played.
 */
const PUBLISHED = ['aware'];

/**
 * The answer list in a fixed shuffled order, so dailies do not repeat for ANSWER_LIST.length days.
 * Each later pass through the list uses a fresh shuffle, so the sequence never repeats either.
 */
function dailyOrder(cycle = 0): string[] {
  let order = orders.get(cycle);
  if (!order) {
    const r = rng(hashString(cycle === 0 ? SHUFFLE_SEED : `${SHUFFLE_SEED}:cycle:${cycle}`));
    order = [...ANSWER_LIST];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [order[i], order[j]] = [order[j]!, order[i]!];
    }
    if (cycle === 0) order = [...PUBLISHED, ...order.filter((w) => !PUBLISHED.includes(w))];
    orders.set(cycle, order);
  }
  return order;
}

/** Daily number for a date (1 on EPOCH). Dates before the epoch clamp to 1. */
export function puzzleNumber(day: string): number {
  return Math.max(1, daysBetween(EPOCH, day) + 1);
}

export function dailySecret(day: string): string {
  const n = puzzleNumber(day) - 1;
  const cycle = Math.floor(n / ANSWER_LIST.length);
  return dailyOrder(cycle)[n % ANSWER_LIST.length]!;
}

/** A random practice secret that is never `avoid` (today's daily). */
export function practiceSecret(random: () => number = Math.random, avoid?: string): string {
  for (;;) {
    const w = ANSWER_LIST[Math.floor(random() * ANSWER_LIST.length)]!;
    if (w !== avoid) return w;
  }
}

/* ------------------------------------------------------------------ scoring */

export interface RoundSummary {
  solved: boolean;
  /** Guesses used. */
  guesses: number;
  seconds: number;
}

/** 200 for solving + 100 per unused guess + up to 100 for speed (-1 per 3 s). A miss scores 0. */
export function scoreRound({ solved, guesses, seconds }: RoundSummary): number {
  if (!solved) return 0;
  const spare = MAX_GUESSES - guesses;
  const speed = Math.max(0, 100 - Math.floor(Math.max(0, seconds) / 3));
  return 200 + spare * 100 + speed;
}

/** Stats reported to the arcade. Fewest-guess and fastest stats are only sent for solves. */
export function roundStats(r: RoundSummary, streak?: number): { score: number; stats: Record<string, number> } {
  const stats: Record<string, number> = { spare: r.solved ? MAX_GUESSES - r.guesses : 0 };
  if (r.solved) {
    stats.guesses = r.guesses;
    stats.seconds = Math.max(1, Math.round(r.seconds));
  }
  if (streak !== undefined) stats.streak = streak;
  return { score: scoreRound(r), stats };
}

const EMOJI: Record<Mark, string> = { up: '🔼', down: '🔽', hit: '🟩' };

/** Spoiler-free guess rows: arrows only, never letters. */
export const resultGrid = (rows: readonly Row[]): string => rows.map((r) => r.marks.map((m) => EMOJI[m]).join('')).join('\n');

/** Spoiler-free result: arrows only, never letters. */
export function shareText(opts: { rows: readonly Row[]; solved: boolean; daily?: number; url: string }): string {
  const head = `Letter Pinch ${opts.daily ? `#${opts.daily}` : 'practice'} ${opts.solved ? opts.rows.length : 'X'}/${MAX_GUESSES}`;
  return [head, resultGrid(opts.rows), opts.url].join('\n');
}
