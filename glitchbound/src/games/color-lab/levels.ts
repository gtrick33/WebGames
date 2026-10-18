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
export const COLOR_COUNT = 16;
/** Dailies up to this day were published with the first 12 colours and one fixed recipe; they stay as they were. */
export const CLASSIC_UNTIL = '2026-10-18';
const CLASSIC_COLORS = 12;

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
  // Past the ladder: more colours every few levels, with the tube height and shapes varying so the
  // long run never settles into one pattern.
  const k = step - ladder.length;
  const shape = k % 5;
  return {
    colors: Math.min(COLOR_COUNT, 9 + Math.floor(k / 3) - (shape === 2 ? 2 : 0)),
    cap: shape === 2 ? 5 : shape === 4 ? 3 : 4,
    empty: 2,
    odd: shape === 1 || (shape === 3 && r() < 0.5),
  };
}

/**
 * The daily's last two levels change recipe from day to day (after CLASSIC_UNTIL): short tall tubes,
 * odd shapes, many colours in short tubes... The first three stay a gentle warm-up.
 */
const DAILY_TWISTS: LevelSpec[] = [
  { colors: 6, cap: 4, empty: 2, odd: false },
  { colors: 5, cap: 5, empty: 2, odd: false },
  { colors: 6, cap: 4, empty: 2, odd: true },
  { colors: 8, cap: 3, empty: 2, odd: false },
  { colors: 7, cap: 4, empty: 2, odd: false },
  { colors: 5, cap: 4, empty: 2, odd: true },
  { colors: 6, cap: 5, empty: 2, odd: false },
];

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
 * Odd layout: tubes of different heights. Each colour has exactly as many layers as its home tube
 * holds, so every colour ends up filling a tube to the brim. Spare tubes reuse those heights.
 */
function oddBoard(spec: LevelSpec, r: R): Board {
  const caps = Array.from({ length: spec.colors }, () => Math.max(3, spec.cap - 1 + Math.floor(r() * 3)));
  const units: number[] = [];
  caps.forEach((cap, c) => {
    for (let i = 0; i < cap; i++) units.push(c);
  });
  shuffle(units, r);
  const board: Board = [];
  let at = 0;
  for (const cap of caps) {
    board.push({ cap, layers: units.slice(at, at + cap) });
    at += cap;
  }
  // Spares come in the tallest height, so any colour can be parked while you dig.
  const tallest = Math.max(...caps);
  for (let e = 0; e < spec.empty; e++) board.push({ cap: e === 0 ? tallest : caps[Math.floor(r() * caps.length)]!, layers: [] });
  return shuffle(board, r);
}

/** A puzzle is too easy when it starts solved or with a finished tube. */
function boring(b: Board): boolean {
  return isSolved(b) || doneTubes(b).some(Boolean) || b.some((t) => t.layers.length > 1 && t.layers.every((c) => c === t.layers[0]) && t.layers.length >= t.cap - 1);
}

export function makeLevel(r: R, spec: LevelSpec, mystery = false, colorCount = COLOR_COUNT): Level {
  let fallback: Level | null = null;
  for (let attempt = 0; attempt < 12; attempt++) {
    const board = spec.odd ? oddBoard(spec, r) : classicBoard(spec, r);
    const palette = shuffle(Array.from({ length: colorCount }, (_, i) => i), r).slice(0, spec.colors);
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
  return makeLevel(r, { ...spec, empty: spec.empty + 1, odd: false }, mystery, colorCount);
}

/** Daily level `index` (0-4). Every third day the last level is a mystery level. */
export function dailyLevel(day: string, index: number): Level {
  const r = rng(hashString(`color-lab:${day}:${index}`));
  const mystery = index === DAILY_LEVELS - 1 && hashString(`color-lab:${day}`) % 3 === 0;
  if (day <= CLASSIC_UNTIL) return makeLevel(r, specFor([0, 1, 2, 4, 5][index] ?? index, r), mystery, CLASSIC_COLORS);
  const twist = (k: number): LevelSpec => DAILY_TWISTS[(hashString(`color-lab:twist:${day}`) + k * 3) % DAILY_TWISTS.length]!;
  const spec = index >= 3 ? twist(index - 3) : specFor([0, 1, 2][index] ?? index, r);
  return makeLevel(r, spec, mystery);
}

/** Endless / Precision level at a step of the ladder; from step 6, every fourth level is a mystery. */
export function ladderLevel(seed: number, step: number): Level {
  const r = rng(seed);
  return makeLevel(r, specFor(step, r), step >= 6 && step % 4 === 2);
}

export function dailyNumber(day: string): number {
  return Math.max(1, daysBetween(EPOCH, day) + 1);
}
