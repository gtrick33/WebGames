/**
 * Pattern generation and difficulty for Memory Grid. Pure and deterministic: the same seed always gives the
 * same patterns, which is what makes the Daily Challenge identical for every player on a date.
 */

export type Mode = 'classic' | 'speed' | 'daily' | 'perfect';

export const MODES: Mode[] = ['classic', 'speed', 'daily', 'perfect'];

/** How one pattern is played: grid side, number of steps and how long each step stays lit. */
export interface Level {
  size: number;
  length: number;
  /** Milliseconds a tile stays lit during playback. */
  litMs: number;
  /** Milliseconds of darkness between two steps. */
  gapMs: number;
}

/** Speed Run: seconds on the clock. The clock only runs while it is the player's turn. */
export const SPEED_SECONDS = 60;
/** Speed Run: seconds lost for a wrong tap. */
export const SPEED_PENALTY_SECONDS = 5;

/** Perfect Recall: a fixed ladder, the same for everyone, cleared without a single mistake. */
export const PERFECT_LADDER: ReadonlyArray<Pick<Level, 'size' | 'length' | 'litMs'>> = [
  { size: 3, length: 3, litMs: 560 },
  { size: 3, length: 4, litMs: 540 },
  { size: 3, length: 5, litMs: 520 },
  { size: 4, length: 5, litMs: 520 },
  { size: 4, length: 6, litMs: 500 },
  { size: 4, length: 7, litMs: 480 },
  { size: 4, length: 8, litMs: 460 },
  { size: 5, length: 8, litMs: 460 },
  { size: 5, length: 9, litMs: 440 },
  { size: 5, length: 10, litMs: 420 },
];

const withGap = (l: Pick<Level, 'size' | 'length' | 'litMs'>): Level => ({ ...l, gapMs: Math.round(l.litMs * 0.4) });

/**
 * Difficulty for a pattern. `round` is 1-based (the pattern being played); `cleared` is how many patterns the
 * player has completed so far (they differ only in Speed Run, where a miss moves on without clearing).
 * Each step changes one thing a little: one more tile in the sequence, a slightly faster playback, and the
 * grid grows only at a few gentle checkpoints.
 */
export function levelFor(mode: Mode, round: number, cleared = round - 1): Level {
  if (mode === 'perfect') return withGap(PERFECT_LADDER[Math.min(round, PERFECT_LADDER.length) - 1]!);
  if (mode === 'speed') {
    const size = cleared < 4 ? 3 : cleared < 10 ? 4 : 5;
    return withGap({ size, length: 3 + Math.floor(cleared / 2), litMs: Math.max(320, 460 - cleared * 10) });
  }
  // Classic and Daily share one progression.
  const size = round <= 4 ? 3 : round <= 9 ? 4 : 5;
  return withGap({ size, length: round + 2, litMs: Math.max(360, 640 - (round - 1) * 25) });
}

/** Number of patterns in a mode, or Infinity when it runs until a mistake / the clock. */
export function roundsIn(mode: Mode): number {
  return mode === 'perfect' ? PERFECT_LADDER.length : Infinity;
}

/** Small, fast, seedable PRNG (mulberry32). Returns floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 32-bit FNV-1a. */
export function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Seed for the Daily Challenge on a local date (YYYY-MM-DD). */
export function dailySeed(day: string): string {
  return `memory-grid:daily:v1:${day}`;
}

/** Seed for Perfect Recall's predefined patterns. */
export const PERFECT_SEED = 'memory-grid:perfect:v1';

/** A fresh random seed for Classic and Speed Run. */
export function randomSeed(): string {
  const n = typeof crypto !== 'undefined' && crypto.getRandomValues ? crypto.getRandomValues(new Uint32Array(1))[0]! : Math.floor(Math.random() * 2 ** 32);
  return `memory-grid:run:${n.toString(36)}`;
}

/**
 * A fair sequence of tile indexes on a size x size grid:
 * - the same tile never lights twice in a row (a repeat is hard to see and feels like a glitch);
 * - no back-and-forth A-B-A bounce on grids with room to avoid it;
 * - no tile is used much more often than the others.
 */
export function generateSequence(rand: () => number, length: number, size: number): number[] {
  const tiles = size * size;
  const maxUses = Math.ceil(length / tiles) + 1;
  const uses = new Array<number>(tiles).fill(0);
  const seq: number[] = [];
  for (let i = 0; i < length; i++) {
    const prev = seq[i - 1];
    const prev2 = seq[i - 2];
    let options = [];
    for (let t = 0; t < tiles; t++) {
      if (t === prev || uses[t]! >= maxUses) continue;
      if (tiles > 4 && t === prev2) continue;
      options.push(t);
    }
    if (options.length === 0) options = Array.from({ length: tiles }, (_, t) => t).filter((t) => t !== prev);
    const pick = options[Math.floor(rand() * options.length)]!;
    uses[pick]!++;
    seq.push(pick);
  }
  return seq;
}

/** The pattern for one round of a run. Each round has its own derived seed, so it never depends on play. */
export function patternFor(seed: string, round: number, level: Level): number[] {
  return generateSequence(mulberry32(hash(`${seed}:${round}:${level.size}`)), level.length, level.size);
}
