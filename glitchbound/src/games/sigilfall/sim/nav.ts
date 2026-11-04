import { circleHitsWall, K, TILE, type TileMap } from './map';

/**
 * How people who aren't the player get about (the owner: "the npcs bump into various objects on their trajectory
 * path, can we redo the math"): they plan a way round what stands, and walk it.
 *
 * The plan is A* on a half-tile grid, asking the same collision test everyone else moves by (map.ts circleHitsWall), so
 * it knows about a lamp post as well as it knows about a wall. Each cell is tested once per plan, lazily. It prefers the
 * roads and keeps a little off anything it passes, then pulls the path tight wherever a straight line is clear for a
 * body a little wider than the walker. Nothing here allocates per frame while walking.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Route {
  pts: Point[];
  /** The point being walked to. */
  at: number;
}

export interface RouteOpts {
  /** The body to keep clear for (a little wider than the walker's own: it's what keeps them off things). */
  r: number;
  /** Cells it may look at before giving up (a plan is a walk's worth of thought, not a frame's). */
  budget?: number;
  /** Prefer the roads. */
  roads?: boolean;
}

/** The grid's spacing. Its points fall on the tiles' middles and edges: a corridor a tile wide has a line down its middle. */
const CELL = TILE / 2;
/** Near this to a corner they're already turning for the next stretch. */
const CORNER = 9;
/** A walker this close to the end of their route has got there. */
export const THERE = 3;

interface Grids {
  gw: number;
  gh: number;
  /** A plan's number times four, plus 1 (free) or 2 (blocked). */
  cells: Int32Array;
  /** The plan that last reached a cell, and how; the plan that's done with it. */
  reached: Int32Array;
  closed: Int32Array;
  cost: Float32Array;
  from: Int32Array;
  plan: number;
}

const gridsOf = new WeakMap<TileMap, Grids>();

function grids(m: TileMap): Grids {
  let g = gridsOf.get(m);
  if (!g) {
    const gw = m.w * 2 + 1;
    const gh = m.h * 2 + 1;
    const n = gw * gh;
    g = { gw, gh, cells: new Int32Array(n), reached: new Int32Array(n), closed: new Int32Array(n), cost: new Float32Array(n), from: new Int32Array(n), plan: 0 };
    gridsOf.set(m, g);
  }
  return g;
}

/** Whether a circle of radius r can walk straight from one point to another. */
export function clearLine(m: TileMap, x0: number, y0: number, x1: number, y1: number, r: number): boolean {
  const d = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.max(1, Math.ceil(d / Math.max(3, r * 0.75)));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    if (circleHitsWall(m, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r)) return false;
  }
  return true;
}

/** A small binary heap of cells by their score (reused from plan to plan). */
const heapC: number[] = [];
const heapF: number[] = [];

function heapPush(c: number, f: number): void {
  let i = heapC.length;
  heapC.push(c);
  heapF.push(f);
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (heapF[p]! <= f) break;
    heapC[i] = heapC[p]!;
    heapF[i] = heapF[p]!;
    i = p;
  }
  heapC[i] = c;
  heapF[i] = f;
}

function heapPop(): number {
  const top = heapC[0]!;
  const c = heapC.pop()!;
  const f = heapF.pop()!;
  const n = heapC.length;
  if (n) {
    let i = 0;
    for (;;) {
      let l = i * 2 + 1;
      if (l >= n) break;
      if (l + 1 < n && heapF[l + 1]! < heapF[l]!) l++;
      if (heapF[l]! >= f) break;
      heapC[i] = heapC[l]!;
      heapF[i] = heapF[l]!;
      i = l;
    }
    heapC[i] = c;
    heapF[i] = f;
  }
  return top;
}

const ROAD = new Set<number>([K.Path, K.Cobble, K.Bridge]);

/**
 * A way from one spot to another for a body of radius `r`, as the fewest straight stretches; null if there's none
 * within the budget. Either end may be a little inside something (a door, the spot beside a stall): it starts and ends
 * at the nearest cell that's free.
 */
export function findRoute(m: TileMap, x0: number, y0: number, x1: number, y1: number, o: RouteOpts): Route | null {
  const g = grids(m);
  const plan = ++g.plan;
  const { gw, gh } = g;
  const r = o.r;
  const cells = g.cells;
  const free = (c: number): boolean => {
    const v = cells[c]!;
    if (v >> 2 === plan) return (v & 3) === 1;
    const cx = c % gw;
    const cy = (c - cx) / gw;
    const ok = !circleHitsWall(m, cx * CELL, cy * CELL, r);
    cells[c] = plan * 4 + (ok ? 1 : 2);
    return ok;
  };
  const cellAt = (x: number, y: number): number => {
    const cx = Math.round(x / CELL);
    const cy = Math.round(y / CELL);
    return cx < 0 || cy < 0 || cx >= gw || cy >= gh ? -1 : cy * gw + cx;
  };
  /** The nearest free cell to a spot, within a tile and a half. */
  const snap = (x: number, y: number): number => {
    const c = cellAt(x, y);
    if (c >= 0 && free(c)) return c;
    const cx0 = Math.round(x / CELL);
    const cy0 = Math.round(y / CELL);
    for (let d = 1; d <= 3; d++) {
      let best = -1;
      let bd = Infinity;
      for (let dy = -d; dy <= d; dy++) {
        for (let dx = -d; dx <= d; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== d) continue;
          const cx = cx0 + dx;
          const cy = cy0 + dy;
          if (cx < 0 || cy < 0 || cx >= gw || cy >= gh) continue;
          const k = cy * gw + cx;
          if (!free(k)) continue;
          const e = Math.hypot(cx * CELL - x, cy * CELL - y);
          if (e < bd) {
            bd = e;
            best = k;
          }
        }
      }
      if (best >= 0) return best;
    }
    return -1;
  };
  const start = snap(x0, y0);
  const goal = snap(x1, y1);
  if (start < 0 || goal < 0) return null;
  const gx = goal % gw;
  const gy = (goal - gx) / gw;
  const h = (c: number): number => {
    const cx = c % gw;
    const cy = (c - cx) / gw;
    const dx = Math.abs(cx - gx);
    const dy = Math.abs(cy - gy);
    return Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
  };
  heapC.length = 0;
  heapF.length = 0;
  g.reached[start] = plan;
  g.cost[start] = 0;
  g.from[start] = -1;
  heapPush(start, h(start));
  let budget = o.budget ?? 5000;
  let done = false;
  while (heapC.length && budget-- > 0) {
    const c = heapPop();
    // (a better way here was already taken)
    if (g.closed[c] === plan) continue;
    g.closed[c] = plan;
    if (c === goal) {
      done = true;
      break;
    }
    const base = g.cost[c]!;
    const cx = c % gw;
    const cy = (c - cx) / gw;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
        const k = ny * gw + nx;
        if (!free(k)) continue;
        // (no cutting a corner)
        if (dx && dy && (!free(cy * gw + nx) || !free(ny * gw + cx))) continue;
        let step = dx && dy ? 1.414 : 1;
        if (o.roads && !ROAD.has(m.kind[Math.min(m.h - 1, ny >> 1) * m.w + Math.min(m.w - 1, nx >> 1)]!)) step *= 1.3;
        // (a little dearer alongside anything, so that paths keep off things where there's room)
        if (!free(cy * gw + nx) || !free(ny * gw + cx)) step += 0.5;
        const total = base + step;
        if (g.reached[k] === plan && g.cost[k]! <= total) continue;
        g.reached[k] = plan;
        g.cost[k] = total;
        g.from[k] = c;
        heapPush(k, total + h(k));
      }
    }
  }
  if (!done) return null;
  const raw: Point[] = [];
  for (let c = goal; c >= 0; c = g.from[c]!) {
    const cx = c % gw;
    raw.push({ x: cx * CELL, y: ((c - cx) / gw) * CELL });
  }
  raw.reverse();
  // the very ends, where they asked for, if that's clear
  if (raw.length && !circleHitsWall(m, x1, y1, r) && clearLine(m, raw[raw.length - 1]!.x, raw[raw.length - 1]!.y, x1, y1, r)) raw[raw.length - 1] = { x: x1, y: y1 };
  // pulled tight: from each point, the furthest it can see
  const pts: Point[] = [];
  let i = 0;
  while (i < raw.length - 1) {
    let j = Math.min(raw.length - 1, i + 48);
    while (j > i + 1 && !clearLine(m, raw[i]!.x, raw[i]!.y, raw[j]!.x, raw[j]!.y, r)) j--;
    pts.push(raw[j]!);
    i = j;
  }
  if (!pts.length) pts.push(raw[raw.length - 1] ?? { x: x1, y: y1 });
  return { pts, at: 0 };
}

const steer = { x: 0, y: 0 };

/**
 * Where to head to keep to a route, as a unit direction (the same object every call); null once the route is done.
 * It moves on to the next stretch near a corner, and is already easing round it, so a walk is a line and not a zigzag.
 */
export function aimAlong(route: Route, x: number, y: number): Point | null {
  const pts = route.pts;
  let t = pts[route.at];
  if (!t) return null;
  let d = Math.hypot(t.x - x, t.y - y);
  while (d < CORNER && route.at < pts.length - 1) {
    t = pts[++route.at]!;
    d = Math.hypot(t.x - x, t.y - y);
  }
  if (route.at === pts.length - 1 && d < THERE) return null;
  let ax = (t.x - x) / (d || 1);
  let ay = (t.y - y) / (d || 1);
  const next = pts[route.at + 1];
  if (next && d < CORNER * 2.2) {
    const nd = Math.hypot(next.x - x, next.y - y) || 1;
    const k = 1 - d / (CORNER * 2.2);
    ax += ((next.x - x) / nd - ax) * k * 0.5;
    ay += ((next.y - y) / nd - ay) * k * 0.5;
    const l = Math.hypot(ax, ay) || 1;
    ax /= l;
    ay /= l;
  }
  steer.x = ax;
  steer.y = ay;
  return steer;
}

/** How much of a turn to make in one step: never more than `rate` radians a second, the short way round. */
export function turnToward(a: number, want: number, rate: number, dt: number): number {
  let d = (want - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  const most = rate * dt;
  return a + Math.max(-most, Math.min(most, d));
}
