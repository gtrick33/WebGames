/** mulberry32: a tiny deterministic RNG, so a seed gives everyone the same race. */
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

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** "9.874" seconds. */
export const fmtEt = (s: number): string => s.toFixed(3);
/** "1,250" */
export const fmtCash = (n: number): string => Math.round(n).toLocaleString('en-US');
/** "$12.5k" style for tight UI. */
export function fmtShort(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
  if (n >= 1e4) return `${(n / 1e3).toFixed(n >= 1e5 ? 0 : 1)}k`;
  return Math.round(n).toLocaleString('en-US');
}

/** Darken (t < 0) or lighten (t > 0) a #rrggbb color. */
export function shade(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number): number => Math.round(clamp(t < 0 ? v * (1 + t) : v + (255 - v) * t, 0, 255));
  const r = ch(n >> 16);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
