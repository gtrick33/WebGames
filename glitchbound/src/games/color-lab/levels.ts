/**
 * Level generation for Color Lab. Seeded and pure: the same seed always gives the same puzzle, so the
 * daily is identical for every player. Every generated level is checked by the solver, which also
 * sets its par (the move count to beat). Pure, unit tested.
 */
import { daysBetween, hashString } from '../../platform/dates';
import { doneTubes, isSolved, solveBest, type Board } from './sort';

export const EPOCH = '2026-10-18';
export const DAILY_LEVELS = 5;
/** Colours available (see Game.css for their swatches and patterns). */
export const COLOR_COUNT = 12;

/** Small, fast, seedable PRNG (mulberry32). Floats in [0, 1). */
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

type R = () => number;

/** A level's recipe: how many colours, layers per tube, spare tubes, and whether tube sizes vary. */
export interface LevelSpec {
  colors: number;
  cap: number;
  empty: number;
  /** Mixed tube sizes and uneven colour amounts (like a tall tube and short ones). */
  odd: boolean;
}

export interface Level {
  spec: LevelSpec;
  board: Board;
  par: number;
  /** Whether par was proven to be the fewest moves possible. */
  parOptimal: boolean;
  /** Colour ids used (index into the shared palette). */
  palette: number[];
  /** Mystery level: layers under the top run stay hidden until they are uncovered. */
  mystery: boolean;
}

/** Difficulty ladder; Endless keeps climbing past the end by adding colours. */
export function specFor(step: number, r: R): LevelSpec {
  const ladder: LevelSpec[] = [
    { colors: 3, cap: 3, empty: 2, odd: false },
    { colors: 4, cap: 4, empty: 2, odd: false },
    { colors: 4, cap: 4, empty: 2, odd: true },
    { colors: 5, cap: 4, empty: 2, odd: false },
    { colors: 6, cap: 4, empty: 2, odd: r() < 0.4 },
    { colors: 7, cap: 4, empty: 2, odd: false },
    { colors: 7, cap: 5, empty: 2, odd: r() < 0.3 },
    { colors: 8, cap: 4, empty: 2, odd: false },
    { colors: 9, cap: 4, empty: 2, odd: false },
  ];
  if (step < ladder.length) return ladder[step]!;
  return { colors: Math.min(COLOR_COUNT, 9 + Math.floor((step - ladder.length) / 3)), cap: 4 + (step % 4 === 3 ? 1 : 0), empty: 2, odd: false };
}

const shuffle = <T>(a: T[], r: R): T[] => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
};

/** Classic layout: `colors` full tubes of `cap` layers, shuffled, plus empty tubes. */
function classicBoard(spec: LevelSpec, r: R): Board {
  const units: number[] = [];
  for (let c = 0; c < spec.colors; c++) for (let i = 0; i < spec.cap; i++) units.push(c);
  shuffle(units, r);
  const board: Board = [];
  for (let t = 0; t < spec.colors; t++) board.push({ cap: spec.cap, layers: units.slice(t * spec.cap, (t + 1) * spec.cap) });
  for (let e = 0; e < spec.empty; e++) board.push({ cap: spec.cap, layers: [] });
  return board;
}

/**
 * Odd layout: tubes of different heights and colours in different amounts. Each colour gets a
 * "home" tube tall enough for all of it, so the puzzle is always fair.
 */
function oddBoard(spec: LevelSpec, r: R): Board {
  const amounts = Array.from({ length: spec.colors }, () => Math.max(2, spec.cap - 1 + Math.floor(r() * 4) - 1));
  const caps = amounts.map((a) => Math.max(a, spec.cap - 1 + Math.floor(r() * 3)));
  for (let e = 0; e < spec.empty; e++) caps.push(spec.cap - 1 + Math.floor(r() * 3));
  const units: number[] = [];
  amounts.forEach((a, c) => {
    for (let i = 0; i < a; i++) units.push(c);
  });
  shuffle(units, r);
  const board: Board = caps.map((cap) => ({ cap, layers: [] }));
  // Fill the colour tubes (not the spares) with the shuffled units, as evenly as their sizes allow.
  let t = 0;
  for (const u of units) {
    for (let tries = 0; tries < spec.colors; tries++) {
      const tube = board[t % spec.colors]!;
      t++;
      if (tube.layers.length < tube.cap) {
        tube.layers.push(u);
        break;
      }
    }
  }
  return shuffle(board, r);
}

/** A puzzle is too easy when it starts solved or with a finished tube. */
function boring(b: Board): boolean {
  return isSolved(b) || doneTubes(b).some(Boolean) || b.some((t) => t.layers.length > 1 && t.layers.every((c) => c === t.layers[0]) && t.layers.length >= t.cap - 1);
}

export function makeLevel(r: R, spec: LevelSpec, mystery = false): Level {
  let fallback: Level | null = null;
  for (let attempt = 0; attempt < 12; attempt++) {
    const board = spec.odd ? oddBoard(spec, r) : classicBoard(spec, r);
    const palette = shuffle(Array.from({ length: COLOR_COUNT }, (_, i) => i), r).slice(0, spec.colors);
    if (boring(board)) continue;
    const sol = solveBest(board, spec.colors <= 4 ? 40_000 : 12_000);
    if (!sol || sol.moves.length < spec.colors) continue;
    const level = { spec, board, par: sol.moves.length, parOptimal: sol.optimal, palette, mystery };
    // Prefer levels that need a little thought: par comfortably above the colour count.
    if (sol.moves.length >= spec.colors + 2) return level;
    fallback ??= level;
  }
  if (fallback) return fallback;
  // Practically unreachable: retry with an extra spare tube, which always makes it solvable.
  return makeLevel(r, { ...spec, empty: spec.empty + 1, odd: false }, mystery);
}

/** Daily level `index` (0-4). Every third day the last level is a mystery level. */
export function dailyLevel(day: string, index: number): Level {
  const r = rng(hashString(`color-lab:${day}:${index}`));
  const mystery = index === DAILY_LEVELS - 1 && hashString(`color-lab:${day}`) % 3 === 0;
  return makeLevel(r, specFor([0, 1, 2, 4, 5][index] ?? index, r), mystery);
}

/** Endless / Precision level at a step of the ladder; from step 6, every fourth level is a mystery. */
export function ladderLevel(seed: number, step: number): Level {
  const r = rng(seed);
  return makeLevel(r, specFor(step, r), step >= 6 && step % 4 === 2);
}

export function dailyNumber(day: string): number {
  return Math.max(1, daysBetween(EPOCH, day) + 1);
}
