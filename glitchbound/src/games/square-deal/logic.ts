/**
 * Square Deal rules: an 8x8 board, a tray of three pieces, full rows and columns clear. Pure and
 * seeded: the same seed deals the same pieces in the same order to everyone (the daily, challenges).
 */

export const SIZE = 8;
export const TRAY = 3;

/** mulberry32: a tiny deterministic RNG, so a seed gives everyone the same round. */
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

/** A piece: its cells as [row, col] offsets from its top-left, and a color index. */
export interface Piece {
  id: number;
  cells: [number, number][];
  w: number;
  h: number;
  color: number;
}

/** Shapes as rows of '#' (cell) and '.' (gap), with a deal weight. Pieces never rotate. */
const SHAPES: [string[], number][] = [
  [['#'], 2],
  [['##'], 5],
  [['#', '#'], 5],
  [['###'], 6],
  [['#', '#', '#'], 6],
  [['####'], 4],
  [['#', '#', '#', '#'], 4],
  [['#####'], 2],
  [['#', '#', '#', '#', '#'], 2],
  [['##', '##'], 7],
  [['###', '###', '###'], 3],
  [['###', '###'], 3],
  [['##', '##', '##'], 3],
  [['#.', '##'], 4],
  [['.#', '##'], 4],
  [['##', '#.'], 4],
  [['##', '.#'], 4],
  [['#..', '#..', '###'], 2],
  [['..#', '..#', '###'], 2],
  [['###', '#..', '#..'], 2],
  [['###', '..#', '..#'], 2],
  [['#.', '#.', '##'], 3],
  [['.#', '.#', '##'], 3],
  [['##', '#.', '#.'], 3],
  [['##', '.#', '.#'], 3],
  [['###', '#..'], 3],
  [['###', '..#'], 3],
  [['#..', '###'], 3],
  [['..#', '###'], 3],
  [['###', '.#.'], 3],
  [['.#.', '###'], 3],
  [['#.', '##', '#.'], 3],
  [['.#', '##', '.#'], 3],
  [['##.', '.##'], 2],
  [['.##', '##.'], 2],
  [['#.', '##', '.#'], 2],
  [['.#', '##', '#.'], 2],
  [['#.', '.#'], 2],
  [['.#', '#.'], 2],
];

const SHAPE_CELLS: [number, number][][] = SHAPES.map(([rows]) => rows.flatMap((r, y) => [...r].flatMap((c, x): [number, number][] => (c === '#' ? [[y, x]] : []))));
const TOTAL_WEIGHT = SHAPES.reduce((a, [, w]) => a + w, 0);
export const COLORS = 7;

/** Piece number `n` of the round with this seed: the same for everyone, and pure (no hidden RNG state). */
export function pieceAt(seed: number, n: number): Piece {
  const r = rng((seed ^ Math.imul(n + 1, 0x9e3779b1)) >>> 0);
  r();
  let pick = r() * TOTAL_WEIGHT;
  let i = 0;
  while (pick >= SHAPES[i]![1]) pick -= SHAPES[i++]![1];
  const cells = SHAPE_CELLS[i]!;
  return {
    id: n,
    cells,
    w: Math.max(...cells.map(([, x]) => x)) + 1,
    h: Math.max(...cells.map(([y]) => y)) + 1,
    color: Math.floor(r() * COLORS),
  };
}

/** Deals pieces from a seed, in order. */
export function dealer(seed: number): () => Piece {
  let n = 0;
  return () => pieceAt(seed, n++);
}

/** The board: SIZE*SIZE cells, -1 empty or a color index. */
export type Board = number[];

export const emptyBoard = (): Board => new Array<number>(SIZE * SIZE).fill(-1);

export function fits(board: Board, piece: Piece, row: number, col: number): boolean {
  for (const [y, x] of piece.cells) {
    const r = row + y;
    const c = col + x;
    if (r < 0 || c < 0 || r >= SIZE || c >= SIZE || board[r * SIZE + c] !== -1) return false;
  }
  return true;
}

export function fitsAnywhere(board: Board, piece: Piece): boolean {
  for (let r = 0; r <= SIZE - piece.h; r++) for (let c = 0; c <= SIZE - piece.w; c++) if (fits(board, piece, r, c)) return true;
  return false;
}

/** Rows and columns that would be full after placing `piece` at (row, col). */
export function linesAfter(board: Board, piece: Piece, row: number, col: number): { rows: number[]; cols: number[] } {
  const b = board.slice();
  for (const [y, x] of piece.cells) b[(row + y) * SIZE + col + x] = piece.color;
  return fullLines(b);
}

export function fullLines(b: Board): { rows: number[]; cols: number[] } {
  const rows: number[] = [];
  const cols: number[] = [];
  for (let i = 0; i < SIZE; i++) {
    let row = true;
    let colFull = true;
    for (let j = 0; j < SIZE; j++) {
      if (b[i * SIZE + j] === -1) row = false;
      if (b[j * SIZE + i] === -1) colFull = false;
    }
    if (row) rows.push(i);
    if (colFull) cols.push(i);
  }
  return { rows, cols };
}

/** Points for clearing `lines` lines in one move, before the streak multiplier. */
export const linePoints = (lines: number): number => 10 * lines * lines;
/** Clearing on consecutive moves builds a streak: x1, x1.5, x2 … up to x4. */
export const streakMultiplier = (streak: number): number => 1 + Math.min(6, Math.max(0, streak - 1)) * 0.5;

export interface State {
  seed: number;
  /** How many pieces have been dealt (the next one is pieceAt(seed, dealt)). */
  dealt: number;
  board: Board;
  tray: (Piece | null)[];
  score: number;
  lines: number;
  /** Moves in a row that cleared at least one line. */
  streak: number;
  bestStreak: number;
  moves: number;
  over: boolean;
}

export function newGame(seed: number): State {
  return { seed, dealt: TRAY, board: emptyBoard(), tray: Array.from({ length: TRAY }, (_, i) => pieceAt(seed, i)), score: 0, lines: 0, streak: 0, bestStreak: 0, moves: 0, over: false };
}

export interface MoveResult {
  ok: boolean;
  /** Cells that were cleared (for the burst animation). */
  cleared: number[];
  lines: number;
  points: number;
}

/** Places tray piece `slot` with its top-left at (row, col). Pure: returns the next state. */
export function place(prev: State, slot: number, row: number, col: number): { state: State; result: MoveResult } {
  const piece = prev.tray[slot];
  if (prev.over || !piece || !fits(prev.board, piece, row, col)) return { state: prev, result: { ok: false, cleared: [], lines: 0, points: 0 } };
  const board = prev.board.slice();
  for (const [y, x] of piece.cells) board[(row + y) * SIZE + col + x] = piece.color;
  const { rows, cols } = fullLines(board);
  const clearedSet = new Set<number>();
  for (const r of rows) for (let c = 0; c < SIZE; c++) clearedSet.add(r * SIZE + c);
  for (const c of cols) for (let r = 0; r < SIZE; r++) clearedSet.add(r * SIZE + c);
  for (const i of clearedSet) board[i] = -1;
  const lines = rows.length + cols.length;
  const streak = lines > 0 ? prev.streak + 1 : 0;
  const points = piece.cells.length + Math.round(linePoints(lines) * streakMultiplier(streak));
  let tray = prev.tray.slice();
  tray[slot] = null;
  let dealt = prev.dealt;
  if (tray.every((p) => p === null)) {
    tray = Array.from({ length: TRAY }, (_, i) => pieceAt(prev.seed, dealt + i));
    dealt += TRAY;
  }
  const state: State = {
    ...prev,
    dealt,
    board,
    tray,
    score: prev.score + points,
    lines: prev.lines + lines,
    streak,
    bestStreak: Math.max(prev.bestStreak, streak),
    moves: prev.moves + 1,
    over: !tray.some((p) => p && fitsAnywhere(board, p)),
  };
  return { state, result: { ok: true, cleared: [...clearedSet], lines, points } };
}

/** Spoiler-free share line: score band squares plus the run's numbers (the best streak as its multiplier). */
export function resultLine(score: number, lines: number, bestStreak: number): string {
  const bands = [100, 300, 600, 1000, 1500, 2500, 4000, 6000];
  const filled = bands.filter((b) => score >= b).length;
  return `${'🟧'.repeat(filled)}${'⬜'.repeat(bands.length - filled)}\n🧹 ${lines} lines · 🔥 ×${streakMultiplier(bestStreak)}`;
}

/** A round in progress as plain data (to resume today's deal): the tray as piece numbers. */
export interface Saved {
  seed: number;
  dealt: number;
  board: number[];
  tray: (number | null)[];
  score: number;
  lines: number;
  streak: number;
  bestStreak: number;
  moves: number;
}

export const toSaved = (s: State): Saved => ({ seed: s.seed, dealt: s.dealt, board: s.board.slice(), tray: s.tray.map((p) => (p ? p.id : null)), score: s.score, lines: s.lines, streak: s.streak, bestStreak: s.bestStreak, moves: s.moves });

const isInt = (v: unknown, min = 0): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min;

/** Rebuilds a saved round, or null when the data is not a valid one. */
export function fromSaved(v: unknown): State | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Partial<Record<keyof Saved, unknown>>;
  const nums = [o.seed, o.dealt, o.score, o.lines, o.streak, o.bestStreak, o.moves];
  if (!nums.every((n) => isInt(n))) return null;
  const [seed, dealt, score, lines, streak, bestStreak, moves] = nums as number[];
  const board = o.board;
  const ids = o.tray;
  if (!Array.isArray(board) || board.length !== SIZE * SIZE || !board.every((c) => isInt(c, -1) && c < COLORS)) return null;
  if (!Array.isArray(ids) || ids.length !== TRAY || !ids.every((id) => id === null || (isInt(id) && id < dealt!))) return null;
  const tray = (ids as (number | null)[]).map((id) => (id === null ? null : pieceAt(seed!, id)));
  const b = (board as number[]).slice();
  return { seed: seed!, dealt: dealt!, board: b, tray, score: score!, lines: lines!, streak: streak!, bestStreak: bestStreak!, moves: moves!, over: !tray.some((p) => p && fitsAnywhere(b, p)) };
}
