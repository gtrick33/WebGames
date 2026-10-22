/** Small math helpers shared by the simulation and the renderer. No DOM, no React. */

export const TAU = Math.PI * 2;

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const dist2 = (ax: number, ay: number, bx: number, by: number): number => (ax - bx) * (ax - bx) + (ay - by) * (ay - by);
export const dist = (ax: number, ay: number, bx: number, by: number): number => Math.sqrt(dist2(ax, ay, bx, by));
export const len = (x: number, y: number): number => Math.sqrt(x * x + y * y);

/** Smallest signed difference between two angles, in -PI..PI. */
export function angleDiff(a: number, b: number): number {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

/** Turns angle `a` toward `b` by at most `max` radians. */
export function turnToward(a: number, b: number, max: number): number {
  const d = angleDiff(a, b);
  return Math.abs(d) <= max ? b : a + Math.sign(d) * max;
}

/** Exponential smoothing that behaves the same at any frame rate. */
export const damp = (a: number, b: number, rate: number, dt: number): number => lerp(a, b, 1 - Math.exp(-rate * dt));

/** mulberry32: a tiny deterministic RNG, so a seed gives the same loot rolls and layouts. */
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

/** A stable 32-bit hash of integers (tile coordinates, seeds) for decoration noise. */
export function hash2(x: number, y: number, seed = 0): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1442695041)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Value noise in 0..1, smooth between integer lattice points. */
export function noise2(x: number, y: number, seed = 0): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const s = (t: number): number => t * t * (3 - 2 * t);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  const u = s(xf);
  const v = s(yf);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

/** Picks an entry by weight. */
export function pickWeighted<T>(items: readonly T[], weight: (t: T) => number, r: number): T {
  let total = 0;
  for (const it of items) total += Math.max(0, weight(it));
  let x = r * total;
  for (const it of items) {
    x -= Math.max(0, weight(it));
    if (x <= 0) return it;
  }
  return items[items.length - 1]!;
}

export const randInt = (r: () => number, lo: number, hi: number): number => lo + Math.floor(r() * (hi - lo + 1));

/** Point-in-shape tests used by telegraphs and area attacks. */
export function inCone(px: number, py: number, ox: number, oy: number, angle: number, halfArc: number, radius: number): boolean {
  const dx = px - ox;
  const dy = py - oy;
  if (dx * dx + dy * dy > radius * radius) return false;
  return Math.abs(angleDiff(angle, Math.atan2(dy, dx))) <= halfArc;
}

/** Distance from point P to the segment AB. */
export function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const vx = bx - ax;
  const vy = by - ay;
  const l2 = vx * vx + vy * vy;
  const t = l2 > 0 ? clamp(((px - ax) * vx + (py - ay) * vy) / l2, 0, 1) : 0;
  return dist(px, py, ax + vx * t, ay + vy * t);
}

/** Whether a circle at P with radius r touches a rotated rectangle from O along `angle`, `length` long and `width` wide. */
export function inLine(px: number, py: number, r: number, ox: number, oy: number, angle: number, length: number, width: number): boolean {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const dx = px - ox;
  const dy = py - oy;
  const along = dx * c + dy * s;
  const across = -dx * s + dy * c;
  return along >= -r && along <= length + r && Math.abs(across) <= width / 2 + r;
}

export const fmtInt = (n: number): string => Math.round(n).toLocaleString('en-US');
