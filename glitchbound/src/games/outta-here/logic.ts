/**
 * Outta Here rules: a grid of straight arrows, each 1 to 3 cells long. Tapping an arrow sends it off
 * the board in the direction it points, but only if nothing is in its way; a blocked tap costs a
 * heart. Pure and seeded. Levels are built backwards (each new arrow gets a clear path past the
 * arrows already placed), so removing them in reverse order always works: every level is solvable.
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

/** 0 up, 1 right, 2 down, 3 left. */
export type Dir = 0 | 1 | 2 | 3;
export const DR = [-1, 0, 1, 0] as const;
export const DC = [0, 1, 0, -1] as const;

export interface Arrow {
  id: number;
  /** Cell indices (row * size + col), tail first, head last. */
  cells: number[];
  dir: Dir;
  color: number;
}

export interface Level {
  size: number;
  arrows: Arrow[];
}

export const HEARTS = 3;
export const DAILY_LEVELS = 5;
export const COLORS = 6;

/** Board size of level n (1-based): 5x5 at first, 8x8 from level 7. */
export const sizeFor = (n: number): number => Math.min(8, 5 + Math.floor((n - 1) / 2));

/** Cells from just past `head` to the edge, in direction `dir`. */
export function pathAhead(size: number, head: number, dir: Dir): number[] {
  const out: number[] = [];
  let r = Math.floor(head / size) + DR[dir];
  let c = (head % size) + DC[dir];
  while (r >= 0 && c >= 0 && r < size && c < size) {
    out.push(r * size + c);
    r += DR[dir];
    c += DC[dir];
  }
  return out;
}

/** Builds level `n` of the round with this seed. */
export function makeLevel(seed: number, n: number): Level {
  const size = sizeFor(n);
  const r = rng((seed ^ Math.imul(n, 0x85ebca6b)) >>> 0);
  const occ = new Array<number>(size * size).fill(-1);
  const arrows: Arrow[] = [];
  const target = Math.floor(size * size * (0.78 + Math.min(0.12, n * 0.015)));
  let filled = 0;
  for (let tries = 0; tries < 4000 && filled < target; tries++) {
    const start = Math.floor(r() * size * size);
    if (occ[start] !== -1) continue;
    const dir = Math.floor(r() * 4) as Dir;
    const roll = r();
    const len = roll < 0.45 ? 1 : roll < 0.85 ? 2 : 3;
    // The arrow runs tail → head in its own direction.
    const cells = [start];
    let ok = true;
    for (let k = 1; k < len && ok; k++) {
      const prev = cells[k - 1]!;
      const rr = Math.floor(prev / size) + DR[dir];
      const cc = (prev % size) + DC[dir];
      if (rr < 0 || cc < 0 || rr >= size || cc >= size || occ[rr * size + cc] !== -1) ok = false;
      else cells.push(rr * size + cc);
    }
    if (!ok) continue;
    // Its way out must be clear of everything placed so far (they will still be there when it leaves).
    if (pathAhead(size, cells[cells.length - 1]!, dir).some((i) => occ[i] !== -1)) continue;
    const id = arrows.length;
    for (const i of cells) occ[i] = id;
    arrows.push({ id, cells, dir, color: Math.floor(r() * COLORS) });
    filled += cells.length;
  }
  return { size, arrows };
}

/** True when the arrow can leave the board right now. */
export function canLeave(level: Level, gone: ReadonlySet<number>, arrow: Arrow): boolean {
  const occupied = new Set<number>();
  for (const a of level.arrows) if (!gone.has(a.id) && a.id !== arrow.id) for (const i of a.cells) occupied.add(i);
  return !pathAhead(level.size, arrow.cells[arrow.cells.length - 1]!, arrow.dir).some((i) => occupied.has(i));
}

/** The arrow occupying a cell, if any is still on the board. */
export function arrowAt(level: Level, gone: ReadonlySet<number>, cell: number): Arrow | null {
  return level.arrows.find((a) => !gone.has(a.id) && a.cells.includes(cell)) ?? null;
}

/** Points for one level: arrows, a clear bonus growing with the level, a no-mistake bonus and speed. */
export function levelPoints(level: Level, n: number, mistakes: number, seconds: number): number {
  return level.arrows.length * 10 + 50 * n + (mistakes === 0 ? 100 : 0) + Math.max(0, Math.round(60 - seconds));
}

/** One emoji per level played: 💨 clean, 🟡 with mistakes, 💥 where the run ended. */
export function resultLine(levels: { mistakes: number; cleared: boolean }[]): string {
  return levels.map((l) => (!l.cleared ? '💥' : l.mistakes === 0 ? '💨' : '🟡')).join('');
}
