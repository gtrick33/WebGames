/**
 * Crosswire grid generator: an arrowword (the "Scandinavian" crossword popular in Bulgarian and
 * Nordic newspapers). Clues sit in squares inside the grid, with an arrow pointing to their answer.
 * Generated from a seed by placing words that cross what is already there, so the supply of puzzles
 * never runs out and the daily is identical for everyone. Pure, unit tested.
 */
import { WORDS, type Entry } from './words';

export type Dir = 'across' | 'down';
/**
 * Where a clue square sits relative to its answer's first letter:
 * 'left' (→ across), 'above' (↓ down), 'aboveAcross' (↳ clue above, answer goes right),
 * 'leftDown' (↴ clue to the left, answer goes down).
 */
export type ClueSpot = 'left' | 'above' | 'aboveAcross' | 'leftDown';

export interface Placed {
  word: string;
  clue: string;
  row: number;
  col: number;
  dir: Dir;
  spot: ClueSpot;
  /** Clue square position. */
  cr: number;
  cc: number;
  n: number;
}

export type Cell = { kind: 'block' } | { kind: 'letter'; ch: string; mystery?: number } | { kind: 'clue'; clues: number[] };

export interface Puzzle {
  rows: number;
  cols: number;
  cells: Cell[][];
  words: Placed[];
  /** Bonus word whose letters sit in the circled squares (scrambled). */
  mystery: { word: string; clue: string } | null;
  seed: number;
}

/** Small, fast, seedable PRNG (mulberry32). */
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

type Work = (null | { k: 'L'; ch: string } | { k: 'C'; spots: ClueSpot[] })[][];

const step = (dir: Dir): [number, number] => (dir === 'across' ? [0, 1] : [1, 0]);

function clueCell(row: number, col: number, spot: ClueSpot): [number, number] {
  return spot === 'left' || spot === 'leftDown' ? [row, col - 1] : [row - 1, col];
}

const dirOf = (spot: ClueSpot): Dir => (spot === 'left' || spot === 'aboveAcross' ? 'across' : 'down');

/** Index: letter -> list of [entry, position]. */
function byLetter(entries: Entry[]): Map<string, [Entry, number][]> {
  const m = new Map<string, [Entry, number][]>();
  for (const e of entries) for (let i = 0; i < e.word.length; i++) {
    const list = m.get(e.word[i]!) ?? [];
    list.push([e, i]);
    m.set(e.word[i]!, list);
  }
  return m;
}

/** Checks a placement and returns how many letters it crosses, or -1 when it does not fit. */
function fits(g: Work, R: number, C: number, word: string, row: number, col: number, spot: ClueSpot): number {
  const dir = dirOf(spot);
  const [dr, dc] = step(dir);
  const [cr, cc] = clueCell(row, col, spot);
  if (cr < 0 || cc < 0 || cr >= R || cc >= C) return -1;
  const endR = row + dr * (word.length - 1);
  const endC = col + dc * (word.length - 1);
  if (endR >= R || endC >= C || row < 0 || col < 0) return -1;
  const clue = g[cr]![cc];
  if (clue && (clue.k !== 'C' || clue.spots.length >= 2 || clue.spots.some((s) => dirOf(s) === dir))) return -1;
  // The squares just before and after the word must not hold letters.
  const br = row - dr;
  const bc = col - dc;
  if (br >= 0 && bc >= 0 && g[br]![bc]?.k === 'L') return -1;
  const ar = endR + dr;
  const ac = endC + dc;
  if (ar < R && ac < C && g[ar]![ac]?.k === 'L') return -1;
  let crosses = 0;
  let fresh = 0;
  for (let i = 0; i < word.length; i++) {
    const r = row + dr * i;
    const c = col + dc * i;
    const cell = g[r]![c];
    if (cell) {
      if (cell.k !== 'L' || cell.ch !== word[i]) return -1;
      crosses++;
      continue;
    }
    if (r === cr && c === cc) return -1;
    fresh++;
    // A new letter must not touch letters sideways (that would spell unintended words).
    const [pr, pc] = dir === 'across' ? [1, 0] : [0, 1];
    for (const s of [-1, 1]) {
      const nr = r + pr * s;
      const nc = c + pc * s;
      if (nr >= 0 && nc >= 0 && nr < R && nc < C && g[nr]![nc]?.k === 'L') return -1;
    }
  }
  return fresh > 0 ? crosses : -1;
}

function place(g: Work, word: string, row: number, col: number, spot: ClueSpot): void {
  const [dr, dc] = step(dirOf(spot));
  for (let i = 0; i < word.length; i++) g[row + dr * i]![col + dc * i] = { k: 'L', ch: word[i]! };
  const [cr, cc] = clueCell(row, col, spot);
  const cur = g[cr]![cc];
  if (cur && cur.k === 'C') cur.spots.push(spot);
  else g[cr]![cc] = { k: 'C', spots: [spot] };
}

interface Attempt {
  g: Work;
  words: Omit<Placed, 'n'>[];
}

function attempt(R: number, C: number, r: () => number, targetWords: number): Attempt {
  const g: Work = Array.from({ length: R }, () => Array<null>(C).fill(null));
  const words: Omit<Placed, 'n'>[] = [];
  const used = new Set<string>();
  const index = byLetter(WORDS);
  // Start with a longish word along the top, its clue in the corner.
  const starters = WORDS.filter((e) => e.word.length >= Math.min(C - 2, 6) && e.word.length <= C - 1);
  const first = starters[Math.floor(r() * starters.length)]!;
  place(g, first.word, 0, 1, 'left');
  words.push({ word: first.word, clue: first.clue, row: 0, col: 1, dir: 'across', spot: 'left', cr: 0, cc: 0 });
  used.add(first.word);

  for (let guard = 0; guard < 120 && words.length < targetWords; guard++) {
    let best: { e: Entry; row: number; col: number; spot: ClueSpot; score: number } | null = null;
    // Try crossing a random sample of existing letters.
    const letters: [number, number][] = [];
    for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) if (g[i]![j]?.k === 'L') letters.push([i, j]);
    for (const [lr, lc] of letters) {
      const ch = (g[lr]![lc] as { ch: string }).ch;
      const options = index.get(ch) ?? [];
      for (let o = 0; o < 70 && options.length; o++) {
        const [e, pos] = options[Math.floor(r() * options.length)]!;
        if (used.has(e.word)) continue;
        for (const spot of ['left', 'above', 'aboveAcross', 'leftDown'] as const) {
          const dir = dirOf(spot);
          const [dr, dc] = step(dir);
          const row = lr - dr * pos;
          const col = lc - dc * pos;
          const crosses = fits(g, R, C, e.word, row, col, spot);
          if (crosses < 1) continue;
          // Prefer more crossings and longer words; plain arrows (→ ↓) over bent ones.
          const score = crosses * 10 + e.word.length * 2 + (spot === 'left' || spot === 'above' ? 3 : 0) + r() * 4;
          if (!best || score > best.score) best = { e, row, col, spot, score };
        }
      }
    }
    if (!best) break;
    place(g, best.e.word, best.row, best.col, best.spot);
    const [cr, cc] = clueCell(best.row, best.col, best.spot);
    words.push({ word: best.e.word, clue: best.e.clue, row: best.row, col: best.col, dir: dirOf(best.spot), spot: best.spot, cr, cc });
    used.add(best.e.word);
  }
  return { g, words };
}

const fill = (a: Attempt): number => a.g.flat().filter((c) => c?.k === 'L').length;

export const SIZES = {
  small: { rows: 7, cols: 7, words: 14 },
  medium: { rows: 9, cols: 9, words: 24 },
  large: { rows: 11, cols: 10, words: 34 },
} as const;
export type Size = keyof typeof SIZES;

/** Builds a puzzle: several attempts from the seed, keeping the densest grid. */
export function makePuzzle(seed: number, size: Size): Puzzle {
  const { rows: R, cols: C, words: target } = SIZES[size];
  const r = rng(seed);
  let best: Attempt | null = null;
  for (let t = 0; t < 14; t++) {
    const a = attempt(R, C, r, target);
    if (!best || fill(a) + a.words.length * 3 > fill(best) + best.words.length * 3) best = a;
  }
  const a = best!;
  // Number the clue squares in reading order.
  const order = [...a.words].sort((x, y) => x.cr - y.cr || x.cc - y.cc || (x.dir === 'across' ? -1 : 1));
  const words: Placed[] = order.map((w, i) => ({ ...w, n: i + 1 }));
  const cells: Cell[][] = a.g.map((row) => row.map((c): Cell => (c?.k === 'L' ? { kind: 'letter', ch: c.ch } : c?.k === 'C' ? { kind: 'clue', clues: [] } : { kind: 'block' })));
  words.forEach((w, i) => (cells[w.cr]![w.cc] as { clues: number[] }).clues.push(i));

  // Mystery word: a word not in the grid whose letters can all be found in distinct letter squares.
  let mystery: Puzzle['mystery'] = null;
  const pool: [number, number, string][] = [];
  cells.forEach((row, i) => row.forEach((c, j) => c.kind === 'letter' && pool.push([i, j, c.ch])));
  const inGrid = new Set(words.map((w) => w.word));
  const candidates = WORDS.filter((e) => e.word.length >= 5 && e.word.length <= 6 && !inGrid.has(e.word));
  for (let k = 0; k < 200 && !mystery; k++) {
    const e = candidates[Math.floor(r() * candidates.length)]!;
    const left = [...pool].sort(() => r() - 0.5);
    const chosen: [number, number][] = [];
    for (const ch of e.word) {
      const idx = left.findIndex((p) => p[2] === ch);
      if (idx < 0) break;
      chosen.push([left[idx]![0], left[idx]![1]]);
      left.splice(idx, 1);
    }
    if (chosen.length === e.word.length) {
      chosen.forEach(([i, j], n) => ((cells[i]![j] as { mystery?: number }).mystery = n));
      mystery = { word: e.word, clue: e.clue };
    }
  }
  return { rows: R, cols: C, cells, words, mystery, seed };
}

/** Cells of a word, first to last. */
export function wordCells(w: Placed): [number, number][] {
  const [dr, dc] = step(w.dir);
  return Array.from({ length: w.word.length }, (_, i) => [w.row + dr * i, w.col + dc * i]);
}

export const ARROW: Record<ClueSpot, string> = { left: '→', above: '↓', aboveAcross: '↳', leftDown: '↴' };
