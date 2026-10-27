import type { Stats } from '../data/types';

/**
 * Paragon levels: experience past level 60 keeps counting. Every Paragon level is a point to put into one of
 * four lines (the Hero panel): Might and Vigor without end, Precision and Toughness up to PARA_CAP points each.
 * With Riftstone loot it is what lets a hero climb a stone further every week. Points are free to take back.
 */

export type ParaStat = 'might' | 'vigor' | 'precision' | 'toughness';
export const PARA_STATS: ParaStat[] = ['might', 'vigor', 'precision', 'toughness'];

/** The most points Precision and Toughness take. */
export const PARA_CAP = 50;

export const PARAGON: Record<ParaStat, { name: string; text: string; cap?: number; stats: Partial<Stats> }> = {
  might: { name: 'Might', text: '+1% damage', stats: { power: 1 } },
  vigor: { name: 'Vigor', text: '+1% health', stats: { hpPct: 1 } },
  precision: { name: 'Precision', text: '+0.2% critical chance, +1% critical damage', cap: PARA_CAP, stats: { crit: 0.2, critDmg: 1 } },
  toughness: { name: 'Toughness', text: '+2 armor, +0.1 health a second', cap: PARA_CAP, stats: { armor: 2, regen: 0.1 } },
};

export interface Paragon {
  /** Paragon level (points earned). */
  l: number;
  /** Experience toward the next. */
  x: number;
  /** Points put into each line. */
  p: Record<ParaStat, number>;
}

export const newParagon = (): Paragon => ({ l: 0, x: 0, p: { might: 0, vigor: 0, precision: 0, toughness: 0 } });

/** Experience from one Paragon level to the next (a little more each time). */
export const paragonXp = (l: number): number => 30_000 + 1_500 * l;

/** Experience past the cap: the Paragon levels it reaches. */
export function addParagonXp(p: Paragon, n: number): number[] {
  const reached: number[] = [];
  p.x += Math.max(0, Math.round(n));
  while (p.x >= paragonXp(p.l)) {
    p.x -= paragonXp(p.l);
    p.l += 1;
    reached.push(p.l);
  }
  return reached;
}

export const paragonSpent = (p: Paragon): number => PARA_STATS.reduce((a, s) => a + p.p[s], 0);
export const paragonFree = (p: Paragon): number => p.l - paragonSpent(p);

/** One point into a line, if there is one to spend and the line takes it. */
export function spendParagon(p: Paragon, s: ParaStat, n = 1): boolean {
  const cap = PARAGON[s].cap ?? Infinity;
  const k = Math.min(n, paragonFree(p), cap - p.p[s]);
  if (k <= 0) return false;
  p.p[s] += k;
  return true;
}

/** Every point back (free). */
export function resetParagon(p: Paragon): void {
  for (const s of PARA_STATS) p.p[s] = 0;
}

/** What the spent points add to the hero's stats. */
export function paragonStats(p: Paragon): Partial<Stats> {
  const out: Partial<Stats> = {};
  for (const s of PARA_STATS) for (const [k, v] of Object.entries(PARAGON[s].stats) as [keyof Stats, number][]) out[k] = (out[k] ?? 0) + v * p.p[s];
  return out;
}

/** A Paragon from a save: levels and experience within reason, points no more than earned and within caps. */
export function validateParagon(v: unknown): Paragon {
  const p = newParagon();
  if (!v || typeof v !== 'object') return p;
  const o = v as Record<string, unknown>;
  const int = (x: unknown, hi: number): number => (typeof x === 'number' && Number.isFinite(x) ? Math.max(0, Math.min(hi, Math.floor(x))) : 0);
  p.l = int(o.l, 100_000);
  p.x = Math.min(int(o.x, 1e9), paragonXp(p.l) - 1);
  const pts = o.p && typeof o.p === 'object' ? (o.p as Record<string, unknown>) : {};
  for (const s of PARA_STATS) p.p[s] = Math.min(int(pts[s], 100_000), PARAGON[s].cap ?? Infinity);
  if (paragonSpent(p) > p.l) resetParagon(p);
  return p;
}
