/**
 * Game rules for Color Recall, kept free of React and the DOM so they are unit tested:
 * seeded daily picks, the round state machine, totals and the spoiler-free share text.
 */
import { addDays, daysBetween, hashString } from '../../platform/dates';
import { deltaE, hexToRgb, MAX_POINTS, pointsFor, rgbToHex, VERDICT_EMOJI, verdictFor, type Hsb, type Rgb } from './color';
import { ORIGINAL_TARGETS, randomWild, TARGETS, targetById, type ColorTarget } from './targets';

export const ROUNDS = 5;
/** Daily puzzle #1. */
export const EPOCH = '2026-10-18';
export const MAX_SCORE = ROUNDS * MAX_POINTS;

/** How long the target colour is shown before it hides, per difficulty. 0 = name and shape only. */
export const PEEK_MS = { easy: 5000, normal: 3000, hard: 1200, memory: 0 } as const;
export type Difficulty = keyof typeof PEEK_MS;
export const DAILY_DIFFICULTY: Difficulty = 'normal';

/** Small, fast, seedable PRNG (mulberry32). Returns floats in [0, 1). */
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

export interface RoundSpec {
  target: ColorTarget;
  /** Where the sliders start, so nobody starts on the answer. */
  start: Hsb;
}

/**
 * Picks `count` targets that look clearly different from each other (and use different shapes),
 * plus a starting colour for each round, all from `random`.
 */
export function pickRounds(random: () => number, count = ROUNDS, pool: ColorTarget[] = TARGETS): RoundSpec[] {
  const order = pool.map((t) => t);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  const picked: ColorTarget[] = [];
  for (const t of order) {
    if (picked.length >= count) break;
    const rgb = hexToRgb(t.hex);
    if (picked.some((p) => p.glyph === t.glyph || deltaE(hexToRgb(p.hex), rgb) < 15)) continue;
    picked.push(t);
  }
  // Tiny pools (tests) may not have enough variety; fill up without the variety rule.
  for (const t of order) if (picked.length < count && !picked.includes(t)) picked.push(t);
  return picked.map((target) => ({
    target,
    start: { h: Math.floor(random() * 360), s: 25 + Math.floor(random() * 50), b: 35 + Math.floor(random() * 50) },
  }));
}

/** First day whose daily mixes in a wild card and avoids last week's colors. */
export const WILD_FROM = '2026-10-19';

const dailyCache = new Map<string, RoundSpec[]>();

/** Today's five rounds: identical for every player on the same calendar day. */
export function dailyRounds(day: string): RoundSpec[] {
  if (day < WILD_FROM) return pickRounds(rng(hashString(`color-recall:${day}`)), ROUNDS, TARGETS.slice(0, ORIGINAL_TARGETS));
  // Each day avoids the curated colors of the previous 7 days, so days are built in order (and cached).
  if (!dailyCache.has(day)) {
    let d = day;
    const todo: string[] = [];
    while (d >= WILD_FROM && !dailyCache.has(d)) {
      todo.push(d);
      d = addDays(d, -1);
    }
    for (const x of todo.reverse()) dailyCache.set(x, buildDaily(x));
  }
  return dailyCache.get(day)!;
}

function buildDaily(day: string): RoundSpec[] {
  const random = rng(hashString(`color-recall:${day}`));
  const recent = new Set<string>();
  for (let i = 1; i <= 7; i++) for (const r of dailyRounds(addDays(day, -i))) recent.add(r.target.id);
  const pool = TARGETS.filter((t) => !recent.has(t.id));
  const rounds = pickRounds(random, ROUNDS - 1, pool.length >= 20 ? pool : TARGETS);
  return [...rounds, withStart(random, distinctWild(random, rounds))];
}

/** Practice: three curated colors and two wild cards, in a random order. */
export function practiceRounds(random: () => number): RoundSpec[] {
  const rounds = pickRounds(random, ROUNDS - 2);
  rounds.push(withStart(random, distinctWild(random, rounds)));
  rounds.push(withStart(random, distinctWild(random, rounds)));
  for (let i = rounds.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [rounds[i], rounds[j]] = [rounds[j]!, rounds[i]!];
  }
  return rounds;
}

/** A wild card with its own shape and a clearly different colour from the other rounds. */
function distinctWild(random: () => number, others: RoundSpec[]): ColorTarget {
  let t = randomWild(random);
  for (let i = 0; i < 50; i++) {
    const rgb = hexToRgb(t.hex);
    if (others.every((o) => o.target.glyph !== t.glyph && deltaE(hexToRgb(o.target.hex), rgb) >= 15)) break;
    t = randomWild(random);
  }
  return t;
}

const withStart = (random: () => number, target: ColorTarget): RoundSpec => ({
  target,
  start: { h: Math.floor(random() * 360), s: 25 + Math.floor(random() * 50), b: 35 + Math.floor(random() * 50) },
});

export function dailyNumber(day: string): number {
  return Math.max(1, daysBetween(EPOCH, day) + 1);
}

export interface RoundResult {
  targetId: string;
  guess: string;
  dE: number;
  points: number;
}

export function scoreGuess(target: ColorTarget, guess: Rgb): RoundResult {
  const dE = deltaE(hexToRgb(target.hex), guess);
  return { targetId: target.id, guess: rgbToHex(guess), dE: Math.round(dE * 10) / 10, points: pointsFor(dE) };
}

export type Phase = 'peek' | 'guess' | 'reveal' | 'done';

export interface GameState {
  mode: 'daily' | 'practice';
  peekMs: number;
  rounds: RoundSpec[];
  index: number;
  phase: Phase;
  results: RoundResult[];
}

export type Action = { type: 'hide' } | { type: 'submit'; guess: Rgb } | { type: 'next' };

/** A new game; `results` resumes an unfinished daily at the next round. */
export function newGame(mode: GameState['mode'], rounds: RoundSpec[], peekMs: number, results: RoundResult[] = []): GameState {
  const index = Math.min(results.length, rounds.length);
  return { mode, peekMs, rounds, index, results, phase: index >= rounds.length ? 'done' : peekMs > 0 ? 'peek' : 'guess' };
}

export function reduce(s: GameState, a: Action): GameState {
  switch (a.type) {
    case 'hide':
      return s.phase === 'peek' ? { ...s, phase: 'guess' } : s;
    case 'submit': {
      if (s.phase !== 'guess') return s;
      const round = s.rounds[s.index];
      if (!round) return s;
      return { ...s, phase: 'reveal', results: [...s.results, scoreGuess(round.target, a.guess)] };
    }
    case 'next': {
      if (s.phase !== 'reveal') return s;
      const index = s.index + 1;
      if (index >= s.rounds.length) return { ...s, phase: 'done' };
      return { ...s, index, phase: s.peekMs > 0 ? 'peek' : 'guess' };
    }
  }
}

export const totalScore = (results: RoundResult[]): number => results.reduce((n, r) => n + r.points, 0);

/** The numbers reported to the arcade at the end of a 5-colour game (keys declared in the registry). */
export function endStats(results: RoundResult[]): { score: number; stats: Record<string, number> } {
  const score = totalScore(results);
  return {
    score,
    stats: {
      accuracy: results.length ? Math.round((score / (results.length * MAX_POINTS)) * 100) : 0,
      bestColor: Math.max(0, ...results.map((r) => r.points)),
      perfects: results.filter((r) => verdictFor(r.points) === 'perfect').length,
    },
  };
}

/** Spoiler-free: shows how close each colour was, never which colours they were. */
export function shareText(day: string, results: RoundResult[], streak: number, url: string): string {
  const squares = results.map((r) => VERDICT_EMOJI[verdictFor(r.points)]).join('');
  const lines = [`Color Recall #${dailyNumber(day)} 🎨`, `${squares}  ${totalScore(results).toLocaleString('en-US')} / ${MAX_SCORE.toLocaleString('en-US')}`];
  if (streak > 1) lines.push(`🔥 ${streak}-day streak`);
  lines.push(url);
  return lines.join('\n');
}

export function resultTarget(r: RoundResult): ColorTarget | undefined {
  return targetById(r.targetId);
}
