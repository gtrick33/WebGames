/**
 * Color Lab rules and solver. Pure functions only (no React, no DOM), unit tested.
 *
 * Tubes hold stacked layers of colour (bottom first). A pour moves the top run of one colour from
 * one tube to another that is empty or has the same colour on top, as much as fits. The puzzle is
 * solved when every colour is gathered into a single tube holding nothing else.
 */

export interface Tube {
  cap: number;
  /** Colour ids, bottom to top. */
  layers: number[];
}

export type Board = Tube[];

export interface Move {
  from: number;
  to: number;
}

export const cloneBoard = (b: Board): Board => b.map((t) => ({ cap: t.cap, layers: [...t.layers] }));

export const top = (t: Tube): number | undefined => t.layers[t.layers.length - 1];

/** Length of the same-colour run at the top of a tube. */
export function topRun(t: Tube): number {
  const c = top(t);
  let n = 0;
  for (let i = t.layers.length - 1; i >= 0 && t.layers[i] === c; i--) n++;
  return n;
}

export const isMono = (t: Tube): boolean => t.layers.every((c) => c === t.layers[0]);

export function canPour(b: Board, from: number, to: number): boolean {
  if (from === to) return false;
  const a = b[from];
  const d = b[to];
  if (!a || !d || a.layers.length === 0 || d.layers.length >= d.cap) return false;
  return d.layers.length === 0 || top(d) === top(a);
}

/** Units a pour would move (0 when it is not allowed). */
export function pourAmount(b: Board, from: number, to: number): number {
  if (!canPour(b, from, to)) return 0;
  return Math.min(topRun(b[from]!), b[to]!.cap - b[to]!.layers.length);
}

/** The board after a pour, or the same board when the pour is not allowed. */
export function pour(b: Board, from: number, to: number): Board {
  const n = pourAmount(b, from, to);
  if (!n) return b;
  const next = b.map((t, i) => (i === from || i === to ? { cap: t.cap, layers: [...t.layers] } : t));
  const c = top(next[from]!)!;
  next[from]!.layers.length -= n;
  for (let i = 0; i < n; i++) next[to]!.layers.push(c);
  return next;
}

/** Solved: every non-empty tube is a single colour and no colour is split over two tubes. */
export function isSolved(b: Board): boolean {
  const seen = new Set<number>();
  for (const t of b) {
    if (!t.layers.length) continue;
    if (!isMono(t) || seen.has(t.layers[0]!)) return false;
    seen.add(t.layers[0]!);
  }
  return true;
}

/** Tubes that are finished: one colour, holding every unit of that colour. */
export function doneTubes(b: Board): boolean[] {
  const total = new Map<number, number>();
  for (const t of b) for (const c of t.layers) total.set(c, (total.get(c) ?? 0) + 1);
  return b.map((t) => t.layers.length > 0 && isMono(t) && total.get(t.layers[0]!) === t.layers.length);
}

/** Moves worth considering: legal, and not pointless shuffles of a whole single-colour tube into an empty one. */
export function usefulMoves(b: Board): Move[] {
  const out: Move[] = [];
  for (let from = 0; from < b.length; from++) {
    const a = b[from]!;
    if (!a.layers.length) continue;
    const wholeMono = isMono(a);
    const triedEmptyCap = new Set<number>();
    for (let to = 0; to < b.length; to++) {
      if (!canPour(b, from, to)) continue;
      const d = b[to]!;
      if (d.layers.length === 0) {
        // Moving a whole one-colour tube into an identical empty tube changes nothing.
        if (wholeMono && d.cap === a.cap) continue;
        // Empty tubes of the same size are interchangeable: try one of each size.
        if (triedEmptyCap.has(d.cap)) continue;
        triedEmptyCap.add(d.cap);
      }
      out.push({ from, to });
    }
  }
  return out;
}

/** Stuck: not solved and no legal pour changes anything useful. */
export const isStuck = (b: Board): boolean => !isSolved(b) && usefulMoves(b).length === 0;

/** Canonical key: tubes of equal size are interchangeable, so the key ignores their order. */
export function boardKey(b: Board): string {
  return b
    .map((t) => `${t.cap}:${t.layers.join('.')}`)
    .sort()
    .join('|');
}

/**
 * Lower bound on the moves left (admissible): every run that is not the bottom run must move at
 * least once, and every colour split across k tubes needs at least k - 1 pours to gather.
 */
export function lowerBound(b: Board): number {
  let runs = 0;
  const tubesWith = new Map<number, number>();
  for (const t of b) {
    let prev = -1;
    let blocks = 0;
    const colors = new Set<number>();
    for (const c of t.layers) {
      if (c !== prev) blocks++;
      prev = c;
      colors.add(c);
    }
    runs += Math.max(0, blocks - 1);
    for (const c of colors) tubesWith.set(c, (tubesWith.get(c) ?? 0) + 1);
  }
  let split = 0;
  for (const n of tubesWith.values()) split += n - 1;
  return Math.max(runs, split);
}

/** Binary min-heap keyed by number. */
class Heap<T> {
  private items: { k: number; v: T }[] = [];
  get size(): number {
    return this.items.length;
  }
  push(k: number, v: T): void {
    const a = this.items;
    a.push({ k, v });
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p]!.k <= a[i]!.k) break;
      [a[p], a[i]] = [a[i]!, a[p]!];
      i = p;
    }
  }
  pop(): T | undefined {
    const a = this.items;
    if (!a.length) return undefined;
    const out = a[0]!.v;
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l]!.k < a[m]!.k) m = l;
        if (r < a.length && a[r]!.k < a[m]!.k) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i]!, a[m]!];
        i = m;
      }
    }
    return out;
  }
}

export interface Solution {
  moves: Move[];
  /** True when the search proved this is the fewest moves possible. */
  optimal: boolean;
}

interface Node {
  board: Board;
  g: number;
  parent: Node | null;
  move: Move | null;
}

/**
 * A* search for a solution. With `weight` 1 the answer is optimal; a higher weight is much faster but
 * may be a few moves longer. Returns null when no solution was found within `maxNodes`.
 */
export function solve(start: Board, opts: { weight?: number; maxNodes?: number } = {}): Solution | null {
  const weight = opts.weight ?? 1;
  const maxNodes = opts.maxNodes ?? 60_000;
  if (isSolved(start)) return { moves: [], optimal: true };
  const open = new Heap<Node>();
  const best = new Map<string, number>();
  open.push(weight * lowerBound(start), { board: start, g: 0, parent: null, move: null });
  best.set(boardKey(start), 0);
  let expanded = 0;
  while (open.size) {
    const node = open.pop()!;
    if (node.g > (best.get(boardKey(node.board)) ?? Infinity)) continue;
    if (isSolved(node.board)) {
      const moves: Move[] = [];
      for (let n: Node | null = node; n?.move; n = n.parent) moves.unshift(n.move);
      return { moves, optimal: weight === 1 };
    }
    if (++expanded > maxNodes) return null;
    for (const m of usefulMoves(node.board)) {
      const board = pour(node.board, m.from, m.to);
      const key = boardKey(board);
      const g = node.g + 1;
      if (g >= (best.get(key) ?? Infinity)) continue;
      best.set(key, g);
      open.push(g + weight * lowerBound(board), { board, g, parent: node, move: m });
    }
  }
  return null;
}

/** Best available solution: exact when the puzzle is small enough, otherwise a quick near-optimal one. */
export function solveBest(b: Board, budget = 40_000): Solution | null {
  return solve(b, { maxNodes: budget }) ?? solve(b, { weight: 1.6, maxNodes: budget * 2 }) ?? solve(b, { weight: 4, maxNodes: budget * 4 });
}

/** Next move towards a solution from here (for hints), or null when the board is a dead end. */
export function hint(b: Board): Move | null {
  return solve(b, { weight: 2, maxNodes: 30_000 })?.moves[0] ?? solve(b, { weight: 6, maxNodes: 80_000 })?.moves[0] ?? null;
}
