/**
 * Level generation for Color Lab. Seeded and pure: the same seed always gives the same puzzle, so the
 * daily is identical for every player. Every generated level is checked by the solver, which also
 * sets its par (the move count to beat). Pure, unit tested.
 */
import { daysBetween, hashString } from '../../platform/dates';
import { doneTubes, isSolved, solveBest, type Board, type Move } from './sort';

export const EPOCH = '2026-10-18';
export const DAILY_LEVELS = 5;
/** Colors available (see Game.css for their swatches and patterns). */
export const COLOR_COUNT = 16;
/** Dailies up to this day were published with the first 12 colors and one fixed recipe; they stay as they were. */
export const CLASSIC_UNTIL = '2026-10-18';
const CLASSIC_COLORS = 12;
/**
 * From this day on, the harder of the daily's two twist puzzles is always puzzle 5, and a mystery
 * puzzle's par gets MYSTERY_SLACK extra moves (its par is solved with the hidden layers known).
 * Earlier dailies stay exactly as they were published.
 */
export const ORDERED_FROM = '2026-11-16';
export const MYSTERY_SLACK = 2;

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

/** A level's recipe: how many colors, layers per tube, spare tubes, and whether tube sizes vary. */
export interface LevelSpec {
  colors: number;
  cap: number;
  empty: number;
  /** Mixed tube sizes and uneven color amounts (like a tall tube and short ones). */
  odd: boolean;
}

export interface Level {
  spec: LevelSpec;
  board: Board;
  par: number;
  /** Whether par was proven to be the fewest moves possible. */
  parOptimal: boolean;
  /** Color ids used (index into the shared palette). */
  palette: number[];
  /** Mystery level: layers under the top run stay hidden until they are uncovered. */
  mystery: boolean;
  /** The route the solver found (par moves, or par minus parSlack), reused for hints. */
  solution?: Move[];
  /** Extra moves added to the solver's par (mystery levels, see MYSTERY_SLACK). */
  parSlack?: number;
}

/** Difficulty ladder; Endless keeps climbing past the end by adding colors. */
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
  // Past the ladder: more colors every few levels, with the tube height and shapes varying so the
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
 * odd shapes, many colors in short tubes... The first three stay a gentle warm-up.
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
 * Odd layout: tubes of different heights. Each color has exactly as many layers as its home tube
 * holds, so every color ends up filling a tube to the brim. Spare tubes reuse those heights.
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
  // Spares come in the tallest height, so any color can be parked while you dig.
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
    const level: Level = { spec, board, par: sol.moves.length, parOptimal: sol.optimal, palette, mystery, solution: sol.moves };
    // Prefer levels that need a little thought: par comfortably above the color count.
    if (sol.moves.length >= spec.colors + 2) return level;
    fallback ??= level;
  }
  if (fallback) return fallback;
  // Practically unreachable: retry with an extra spare tube, which always makes it solvable.
  return makeLevel(r, { ...spec, empty: spec.empty + 1, odd: false }, mystery, colorCount);
}

/** The daily level as first published: the recipe for `index`, generated from its own seed. */
function publishedDaily(day: string, index: number, mystery: boolean): Level {
  const r = rng(hashString(`color-lab:${day}:${index}`));
  if (day <= CLASSIC_UNTIL) return makeLevel(r, specFor([0, 1, 2, 4, 5][index] ?? index, r), mystery, CLASSIC_COLORS);
  const twist = (k: number): LevelSpec => DAILY_TWISTS[(hashString(`color-lab:twist:${day}`) + k * 3) % DAILY_TWISTS.length]!;
  const spec = index >= 3 ? twist(index - 3) : specFor([0, 1, 2][index] ?? index, r);
  return makeLevel(r, spec, mystery);
}

/** Harder: higher par, then more colors. */
const harder = (a: Level, b: Level): boolean => a.par > b.par || (a.par === b.par && a.spec.colors > b.spec.colors);

/** A mystery level's par allows for not seeing the hidden layers. */
const withMysterySlack = (lv: Level): Level => (lv.mystery ? { ...lv, par: lv.par + MYSTERY_SLACK, parSlack: MYSTERY_SLACK } : lv);

/** Levels are pure functions of their inputs and slow to make, so each is made once per page. */
const levelMemo = new Map<string, Level>();
function memo(key: string, make: () => Level): Level {
  let lv = levelMemo.get(key);
  if (!lv) {
    if (levelMemo.size > 64) levelMemo.clear();
    lv = make();
    levelMemo.set(key, lv);
  }
  return lv;
}

/**
 * Daily level `index` (0-4). Every third day the last level is a mystery level. From ORDERED_FROM the
 * two twist puzzles are ordered so puzzle 5 is the harder one.
 */
export function dailyLevel(day: string, index: number): Level {
  return memo(`d:${day}:${index}`, () => {
    const mystery = index === DAILY_LEVELS - 1 && hashString(`color-lab:${day}`) % 3 === 0;
    if (day < ORDERED_FROM || index < 3) return publishedDaily(day, index, mystery);
    const a = publishedDaily(day, 3, false);
    const b = publishedDaily(day, 4, false);
    const [easy, hard] = harder(a, b) ? [b, a] : [a, b];
    return index === 3 ? easy : withMysterySlack({ ...hard, mystery });
  });
}

/** Endless / Precision level at a step of the ladder; from step 6, every fourth level is a mystery. */
export function ladderLevel(seed: number, step: number): Level {
  return memo(`l:${seed}:${step}`, () => {
    const r = rng(seed);
    return withMysterySlack(makeLevel(r, specFor(step, r), step >= 6 && step % 4 === 2));
  });
}

export function dailyNumber(day: string): number {
  return Math.max(1, daysBetween(EPOCH, day) + 1);
}

/** Which level to make, as plain data (so a worker can make it). */
export type LevelReq = { kind: 'daily'; day: string; index: number } | { kind: 'practice'; seed: number; size: number } | { kind: 'ladder'; seed: number; step: number };

export const levelReqKey = (q: LevelReq): string => (q.kind === 'daily' ? `d:${q.day}:${q.index}` : q.kind === 'practice' ? `p:${q.seed}:${q.size}` : `l:${q.seed}:${q.step}`);

export function levelOf(q: LevelReq): Level {
  if (q.kind === 'daily') return dailyLevel(q.day, q.index);
  if (q.kind === 'ladder') return ladderLevel(q.seed, q.step);
  return memo(levelReqKey(q), () => {
    const r = rng(q.seed);
    return makeLevel(r, specFor(q.size, r));
  });
}
