/**
 * Star Grid rules (the classic "star battle" logic puzzle, one star each): an N by N grid split into
 * N coloured regions. Place exactly one star in every row, every column and every region, and no two
 * stars may touch, not even diagonally. Pure and seeded; every puzzle has exactly one solution.
 */

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

export interface Puzzle {
  size: number;
  /** Region index per cell (row * size + col). */
  regions: number[];
  /** The solution: the star's column in each row. */
  stars: number[];
}

export const DAILY_SIZES = [6, 7, 8];

function shuffle<T>(a: T[], r: () => number): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** A random valid star layout: one per row and column, no two touching. */
function layout(size: number, r: () => number): number[] | null {
  const cols: number[] = [];
  const used = new Set<number>();
  const go = (row: number): boolean => {
    if (row === size) return true;
    for (const c of shuffle([...Array(size).keys()], r)) {
      if (used.has(c) || (row > 0 && Math.abs(c - cols[row - 1]!) < 2)) continue;
      cols.push(c);
      used.add(c);
      if (go(row + 1)) return true;
      cols.pop();
      used.delete(c);
    }
    return false;
  };
  return go(0) ? cols : null;
}

/** Grows one region from each star until every cell belongs to one. */
function grow(size: number, stars: number[], r: () => number): number[] {
  const regions = new Array<number>(size * size).fill(-1);
  const frontier: number[][] = stars.map(() => []);
  stars.forEach((c, row) => {
    regions[row * size + c] = row;
    frontier[row]!.push(row * size + c);
  });
  let left = size * size - size;
  while (left > 0) {
    const k = Math.floor(r() * size);
    const cells = frontier[k]!;
    if (!cells.length) continue;
    const from = cells[Math.floor(r() * cells.length)]!;
    const row = Math.floor(from / size);
    const col = from % size;
    const options = [
      [row - 1, col],
      [row + 1, col],
      [row, col - 1],
      [row, col + 1],
    ].filter(([y, x]) => y! >= 0 && x! >= 0 && y! < size && x! < size && regions[y! * size + x!] === -1);
    if (!options.length) {
      cells.splice(cells.indexOf(from), 1);
      continue;
    }
    const [y, x] = options[Math.floor(r() * options.length)]!;
    regions[y! * size + x!] = k;
    cells.push(y! * size + x!);
    left--;
  }
  return regions;
}

/** Counts solutions, stopping at `limit`. */
export function countSolutions(size: number, regions: number[], limit = 2): number {
  const cols = new Array<number>(size).fill(-1);
  const usedCol = new Array<boolean>(size).fill(false);
  const usedReg = new Array<boolean>(size).fill(false);
  let found = 0;
  const go = (row: number): void => {
    if (found >= limit) return;
    if (row === size) {
      found++;
      return;
    }
    for (let c = 0; c < size; c++) {
      const reg = regions[row * size + c]!;
      if (usedCol[c] || usedReg[reg] || (row > 0 && Math.abs(c - cols[row - 1]!) < 2)) continue;
      cols[row] = c;
      usedCol[c] = usedReg[reg] = true;
      go(row + 1);
      usedCol[c] = usedReg[reg] = false;
    }
  };
  go(0);
  return found;
}

/** Any solution other than `stars`, or null when `stars` is the only one. */
function otherSolution(size: number, regions: number[], stars: number[]): number[] | null {
  const cols = new Array<number>(size).fill(-1);
  const usedCol = new Array<boolean>(size).fill(false);
  const usedReg = new Array<boolean>(size).fill(false);
  let out: number[] | null = null;
  const go = (row: number): boolean => {
    if (row === size) {
      if (cols.some((c, i) => c !== stars[i])) out = cols.slice();
      return out !== null;
    }
    for (let c = 0; c < size; c++) {
      const reg = regions[row * size + c]!;
      if (usedCol[c] || usedReg[reg] || (row > 0 && Math.abs(c - cols[row - 1]!) < 2)) continue;
      cols[row] = c;
      usedCol[c] = usedReg[reg] = true;
      if (go(row + 1)) return true;
      usedCol[c] = usedReg[reg] = false;
    }
    return false;
  };
  go(0);
  return out;
}

const neighbours = (size: number, i: number): number[] => {
  const row = Math.floor(i / size);
  const col = i % size;
  const out: number[] = [];
  if (row > 0) out.push(i - size);
  if (row < size - 1) out.push(i + size);
  if (col > 0) out.push(i - 1);
  if (col < size - 1) out.push(i + 1);
  return out;
};

/** True when region `reg` stays in one piece without cell `skip`. */
function connectedWithout(size: number, regions: number[], reg: number, skip: number): boolean {
  const cells = regions.flatMap((r, i) => (r === reg && i !== skip ? [i] : []));
  if (!cells.length) return false;
  const seen = new Set([cells[0]!]);
  const queue = [cells[0]!];
  while (queue.length) {
    const i = queue.pop()!;
    for (const j of neighbours(size, i)) {
      if (j === skip || regions[j] !== reg || seen.has(j)) continue;
      seen.add(j);
      queue.push(j);
    }
  }
  return seen.size === cells.length;
}

/**
 * Builds the puzzle for a seed. Regions grow from a random star layout; while another solution
 * exists, one of its stars' cells moves to a neighbouring region (keeping every region in one piece
 * and every planned star where it is) until the planned layout is the only solution.
 */
export function makePuzzle(seed: number, size: number): Puzzle {
  const r = rng(seed ^ Math.imul(size, 0x9e3779b1));
  for (let attempt = 0; attempt < 200; attempt++) {
    const stars = layout(size, r);
    if (!stars) continue;
    const starCells = new Set(stars.map((c, row) => row * size + c));
    const regions = grow(size, stars, r);
    for (let fix = 0; fix < 400; fix++) {
      const other = otherSolution(size, regions, stars);
      if (!other) return { size, regions, stars };
      const rows = other.map((_, row) => row).filter((row) => other[row] !== stars[row]);
      const moves: [number, number][] = [];
      for (const row of rows) {
        const cell = row * size + other[row]!;
        if (starCells.has(cell)) continue;
        for (const n of neighbours(size, cell)) {
          const to = regions[n]!;
          if (to !== regions[cell] && connectedWithout(size, regions, regions[cell]!, cell)) moves.push([cell, to]);
        }
      }
      if (!moves.length) break;
      const [cell, to] = moves[Math.floor(r() * moves.length)]!;
      regions[cell] = to;
    }
  }
  throw new Error(`no unique ${size}x${size} puzzle for seed ${seed}`);
}

/** Cell marks: 0 empty, 1 crossed out, 2 star. */
export type Mark = 0 | 1 | 2;

/** Stars that break a rule right now (same row, column or region, or touching). */
export function conflicts(p: Puzzle, marks: Mark[]): Set<number> {
  const bad = new Set<number>();
  const stars = marks.flatMap((m, i) => (m === 2 ? [i] : []));
  for (let a = 0; a < stars.length; a++)
    for (let b = a + 1; b < stars.length; b++) {
      const i = stars[a]!;
      const j = stars[b]!;
      const ri = Math.floor(i / p.size);
      const ci = i % p.size;
      const rj = Math.floor(j / p.size);
      const cj = j % p.size;
      if (ri === rj || ci === cj || p.regions[i] === p.regions[j] || (Math.abs(ri - rj) <= 1 && Math.abs(ci - cj) <= 1)) {
        bad.add(i);
        bad.add(j);
      }
    }
  return bad;
}

export function solved(p: Puzzle, marks: Mark[]): boolean {
  return marks.filter((m) => m === 2).length === p.size && conflicts(p, marks).size === 0;
}

/** Points for a solve: a base by size, minus 3 a second, never below a quarter of the base. */
export const BASE: Record<number, number> = { 6: 600, 7: 800, 8: 1000, 9: 1200 };
export const solvePoints = (size: number, seconds: number): number => {
  const base = BASE[size] ?? 1000;
  return Math.max(Math.round(base / 4), Math.round(base - 3 * seconds));
};

/** Share line: a star per solved puzzle with its time. */
export function resultLine(times: number[]): string {
  return times.map((t, i) => `${['🟩', '🟨', '🟥'][i] ?? '⭐'} ${fmtTime(t)}`).join('  ');
}

export const fmtTime = (s: number): string => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
