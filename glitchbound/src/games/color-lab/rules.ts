/**
 * One Color Lab level as a pure reducer (no React, no DOM, no timers): pours, undo, restart, the spare
 * tube, hints, the move limit and scoring. Illegal or late inputs return the same state, so rapid taps
 * can never corrupt a level.
 */
import type { Level } from './levels';
import { cloneBoard, isSolved, isStuck, pour, topRun, type Board } from './sort';

export type Mode = 'daily' | 'endless' | 'precision' | 'practice';

/** Points for a perfect level; a 5-level daily is out of 50. */
export const MAX_POINTS = 10;
export const HINT_COST = 2;
export const SPARE_COST = 3;
/** Endless: lives, lost by finishing a level this many moves over par (or more). */
export const LIVES = 3;
export const ENDLESS_SLACK = 5;

export interface LevelState {
  level: Level;
  board: Board;
  /** Boards before each move, for undo. */
  history: Board[];
  moves: number;
  hints: number;
  spare: boolean;
  /** Precision: moves allowed (par), or null. */
  limit: number | null;
  /** Mystery levels: which starting layers have been uncovered, per tube. */
  seen: boolean[][];
  status: 'play' | 'won' | 'failed';
}

export type LevelAction = { type: 'pour'; from: number; to: number } | { type: 'undo' } | { type: 'restart' } | { type: 'spare' } | { type: 'hint' };

/** Marks every tube's top run as seen (it is visible from above). */
function reveal(board: Board, seen: boolean[][]): boolean[][] {
  return seen.map((row, t) => {
    const tube = board[t];
    if (!tube) return row;
    const run = topRun(tube);
    const from = tube.layers.length - run;
    return row.some((v, i) => !v && i >= from && i < tube.layers.length) ? row.map((v, i) => v || (i >= from && i < tube.layers.length)) : row;
  });
}

export function startLevel(level: Level, mode: Mode): LevelState {
  const board = cloneBoard(level.board);
  const seen = reveal(
    board,
    board.map((t) => t.layers.map(() => !level.mystery)),
  );
  return { level, board, history: [], moves: 0, hints: 0, spare: false, limit: mode === 'precision' ? level.par : null, seen, status: 'play' };
}

/** Whether a layer is drawn as a mystery "?" (only on mystery levels, before it was uncovered). */
export function isHidden(s: LevelState, tube: number, index: number): boolean {
  const row = s.seen[tube];
  return !!row && index < row.length && !row[index];
}

export function reduceLevel(s: LevelState, a: LevelAction): LevelState {
  if (s.status !== 'play' && a.type !== 'restart') return s;
  switch (a.type) {
    case 'pour': {
      const board = pour(s.board, a.from, a.to);
      if (board === s.board) return s;
      const moves = s.moves + 1;
      const seen = reveal(board, s.seen);
      const won = isSolved(board);
      const failed = !won && s.limit !== null && moves >= s.limit;
      return { ...s, board, seen, history: [...s.history, s.board], moves, status: won ? 'won' : failed ? 'failed' : 'play' };
    }
    case 'undo': {
      const prev = s.history[s.history.length - 1];
      if (!prev) return s;
      return { ...s, board: prev, history: s.history.slice(0, -1), moves: s.moves - 1 };
    }
    case 'restart': {
      const fresh = startLevel(s.level, s.limit !== null ? 'precision' : 'practice');
      // Hints and the spare tube stay paid for; what was seen stays seen.
      const board = s.spare ? [...fresh.board, { cap: maxCap(s.level.board), layers: [] }] : fresh.board;
      return { ...fresh, board, spare: s.spare, hints: s.hints, seen: s.seen };
    }
    case 'spare':
      if (s.spare) return s;
      return { ...s, spare: true, board: [...s.board, { cap: maxCap(s.level.board), layers: [] }], history: s.history.map((b) => [...b, { cap: maxCap(s.level.board), layers: [] }]) };
    case 'hint':
      return { ...s, hints: s.hints + 1 };
  }
}

const maxCap = (b: Board): number => Math.max(...b.map((t) => t.cap));

/** Stuck: no pour helps; undo or restart. */
export const stuck = (s: LevelState): boolean => s.status === 'play' && isStuck(s.board);

export interface LevelResult {
  solved: boolean;
  moves: number;
  par: number;
  hints: number;
  spare: boolean;
  points: number;
  stars: number;
}

/** 3 stars at or under par, 2 within 3 over, else 1 (0 when not solved). Help costs a star. */
export function starsFor(solved: boolean, moves: number, par: number, hints: number, spare: boolean): number {
  if (!solved) return 0;
  const base = moves <= par ? 3 : moves <= par + 3 ? 2 : 1;
  return Math.max(1, base - (hints > 0 || spare ? 1 : 0));
}

/** 10 at or under par, minus 1 per 2 moves over (never below 4), minus help; at least 1 for a solve. */
export function pointsFor(solved: boolean, moves: number, par: number, hints: number, spare: boolean): number {
  if (!solved) return 0;
  const over = Math.max(0, moves - par);
  const base = Math.max(4, MAX_POINTS - Math.ceil(over / 2));
  return Math.max(1, base - hints * HINT_COST - (spare ? SPARE_COST : 0));
}

export function resultOf(s: LevelState): LevelResult {
  const solved = s.status === 'won';
  return {
    solved,
    moves: s.moves,
    par: s.level.par,
    hints: s.hints,
    spare: s.spare,
    points: pointsFor(solved, s.moves, s.level.par, s.hints, s.spare),
    stars: starsFor(solved, s.moves, s.level.par, s.hints, s.spare),
  };
}

export const totalPoints = (rs: readonly LevelResult[]): number => rs.reduce((n, r) => n + r.points, 0);
export const totalStars = (rs: readonly LevelResult[]): number => rs.reduce((n, r) => n + r.stars, 0);
export const underPar = (rs: readonly LevelResult[]): number => rs.filter((r) => r.solved && r.moves <= r.par).length;

/** What the arcade gets at the end of a run. */
export function endStats(mode: Mode, rs: readonly LevelResult[]): { score: number; stats: Record<string, number> } {
  const stats: Record<string, number> = { stars: totalStars(rs), underPar: underPar(rs) };
  if (mode === 'endless') stats.levels = rs.filter((r) => r.solved).length;
  if (mode === 'precision') stats.parLevels = rs.filter((r) => r.solved).length;
  return { score: totalPoints(rs), stats };
}

const STAR_EMOJI = ['⬛', '🟧', '🟨', '🟩'];

/** Spoiler-free result: one square per level and the move counts against par. */
export function shareText(opts: { label: string; results: readonly LevelResult[]; streak?: number; url: string }): string {
  const squares = opts.results.map((r) => STAR_EMOJI[r.stars] ?? '⬛').join('');
  const moves = opts.results.map((r) => (r.solved ? `${r.moves}/${r.par}` : 'x')).join(' ');
  const lines = [`Color Lab ${opts.label} 🧪`, `${squares}  ${totalPoints(opts.results)}/${opts.results.length * MAX_POINTS}`, `Moves vs par: ${moves}`];
  if (opts.streak && opts.streak > 1) lines.push(`🔥 ${opts.streak}-day streak`);
  lines.push(opts.url);
  return lines.join('\n');
}
