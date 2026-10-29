/**
 * Crater Crew's arithmetic: a seeded random source, hash noise and sine/cosine built from plain
 * multiplication. Every browser and the room server must simulate a shot to the same pixel, and
 * Math.sin/Math.cos may differ in the last bit between JavaScript engines; + - * / and Math.sqrt
 * never do. Nothing here touches the DOM.
 */

/** mulberry32: a tiny deterministic RNG, so a seed gives everyone the same battle. */
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

/** A hash of two integers, as 0..1. */
export function hash01(seed: number, i: number): number {
  let h = Math.imul((seed ^ 0x9e3779b9) >>> 0, 0x85ebca6b) ^ Math.imul(i | 0, 0xc2b2ae35);
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const smooth = (t: number): number => t * t * (3 - 2 * t);

/** Value noise along a line, 0..1. */
export function noise1(seed: number, x: number): number {
  const i = Math.floor(x);
  const a = hash01(seed, i);
  return a + (hash01(seed, i + 1) - a) * smooth(x - i);
}

/** Value noise on a plane, 0..1. */
export function noise2(seed: number, x: number, y: number): number {
  const i = Math.floor(x);
  const j = Math.floor(y);
  const fx = smooth(x - i);
  const fy = smooth(y - j);
  const row = (jj: number): number => {
    const s = (seed ^ Math.imul(jj, 0x27d4eb2d)) >>> 0;
    const a = hash01(s, i);
    return a + (hash01(s, i + 1) - a) * fx;
  };
  const top = row(j);
  return top + (row(j + 1) - top) * fy;
}

/** Fractal noise (octaves of value noise), 0..1. */
export function fbm1(seed: number, x: number, octaves = 4): number {
  let sum = 0;
  let amp = 1;
  let total = 0;
  let f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += noise1(seed + o * 1013, x * f) * amp;
    total += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / total;
}

export function fbm2(seed: number, x: number, y: number, octaves = 3): number {
  let sum = 0;
  let amp = 1;
  let total = 0;
  let f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += noise2(seed + o * 7919, x * f, y * f) * amp;
    total += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / total;
}

export const PI = 3.141592653589793;
const HALF_PI = PI / 2;
const TWO_PI = PI * 2;

/** sin(x) from a Taylor series: the same bits on every engine (error under 1e-9). */
export function dsin(x: number): number {
  let r = x - Math.floor((x + PI) / TWO_PI) * TWO_PI;
  if (r > HALF_PI) r = PI - r;
  else if (r < -HALF_PI) r = -PI - r;
  const r2 = r * r;
  return r * (1 - (r2 / 6) * (1 - (r2 / 20) * (1 - (r2 / 42) * (1 - (r2 / 72) * (1 - (r2 / 110) * (1 - r2 / 156))))));
}

export const dcos = (x: number): number => dsin(x + HALF_PI);

/** Tenths of a degree to radians. */
export const tenthsToRad = (t: number): number => (t / 1800) * PI;

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

export const smoothstep = (a: number, b: number, x: number): number => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
