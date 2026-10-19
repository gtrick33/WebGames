/**
 * Whatsit rules. A round is a theme, a secret thing from it and a line-up of 12 of the theme's things
 * (the secret among them). The player asks the theme's yes/no questions, then sees the line-up and picks
 * one. No React, no DOM; randomness only from a seed.
 */
import { addDays, daysBetween } from '../../platform/dates';
import { THEMES, themeById, thingById, type Theme, type Thing } from './bank';

export const EPOCH = '2026-10-19';
export const LINEUP = 12;
export const MAX_SCORE = 1000;
/** Questions that cost nothing; each one after these takes off PER_QUESTION points. */
export const FREE_QUESTIONS = 3;
export const PER_QUESTION = 75;
export const MIN_WIN_SCORE = 200;

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

function shuffled<T>(xs: readonly T[], r: () => number): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export interface Round {
  theme: string;
  /** The secret thing's id. */
  secret: string;
  /** The 12 thing ids shown at the end, in display order (the secret among them). */
  lineup: string[];
}

/** 11 other things from the theme around the secret, shuffled. */
function lineupFor(theme: Theme, secret: string, r: () => number): string[] {
  const others = shuffled(
    theme.things.map((t) => t.id).filter((id) => id !== secret),
    r,
  ).slice(0, LINEUP - 1);
  return shuffled([secret, ...others], r);
}

export function makeRound(seed: number, themeId?: string): Round {
  const r = rng(seed);
  const theme = (themeId && themeById(themeId)) || THEMES[Math.floor(r() * THEMES.length)]!;
  const secret = theme.things[Math.floor(r() * theme.things.length)]!.id;
  return { theme: theme.id, secret, lineup: lineupFor(theme, secret, r) };
}

/**
 * Today's round, the same for everyone: the themes take turns (one a day) and each theme works through
 * its 16 things in a fixed shuffled order, so a thing comes back only after every other thing in its theme.
 */
export function dailyRound(day: string, hash: (s: string) => number): Round {
  const d = Math.max(0, daysBetween(EPOCH, day));
  const theme = THEMES[d % THEMES.length]!;
  const visit = Math.floor(d / THEMES.length);
  const order = shuffled(theme.things, rng(hash(`whatsit:order:${theme.id}`)));
  const secret = order[visit % order.length]!.id;
  return { theme: theme.id, secret, lineup: lineupFor(theme, secret, rng(hash(`whatsit:${day}`))) };
}

/** The daily's date `n` days after the first one (#1). */
export const dayOf = (n: number): string => addDays(EPOCH, n);

export const answer = (thing: Thing, question: string): boolean => thing.yes.has(question);

/** Whether a thing fits every answer so far (asked: the question ids, in order). */
export function fits(thing: Thing, secret: Thing, asked: readonly string[]): boolean {
  return asked.every((q) => answer(thing, q) === answer(secret, q));
}

/** The line-up things that fit all the answers. */
export function stillFitting(round: Round, asked: readonly string[]): string[] {
  const secret = thingById(round.secret)!;
  return round.lineup.filter((id) => fits(thingById(id)!, secret, asked));
}

export function scoreOf(questions: number, solved: boolean): number {
  if (!solved) return 0;
  return Math.max(MIN_WIN_SCORE, MAX_SCORE - PER_QUESTION * Math.max(0, questions - FREE_QUESTIONS));
}

/** The spoiler-free share line: 🟩 a yes, 🟥 a no, in the order asked. */
export function answerLine(round: Round, asked: readonly string[]): string {
  const secret = thingById(round.secret)!;
  return asked.map((q) => (answer(secret, q) ? '🟩' : '🟥')).join('');
}

/** Checks a saved round still matches the bank (a later deploy may have changed it). */
export function validRound(r: unknown): r is Round {
  if (!r || typeof r !== 'object') return false;
  const { theme, secret, lineup } = r as Partial<Round>;
  const t = typeof theme === 'string' ? themeById(theme) : undefined;
  if (!t || typeof secret !== 'string' || !Array.isArray(lineup) || lineup.length !== LINEUP) return false;
  const ids = new Set(t.things.map((x) => x.id));
  return ids.has(secret) && lineup.includes(secret) && new Set(lineup).size === LINEUP && lineup.every((id) => typeof id === 'string' && ids.has(id));
}
