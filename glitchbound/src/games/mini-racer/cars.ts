import { CAR, type CarSpec } from './physics';
import type { Surface } from './track';

/**
 * The car collection. Cars are earned with coins (or medals) and differ a little in handling. Every
 * trade-off is small and balanced (a test keeps each car's lap times within a few percent of the
 * starter car on every track), so the leaderboard stays fair whichever car you drive.
 */

export type CarShape = 'coupe' | 'buggy' | 'formula' | 'van' | 'bubble';

export type CarUnlock = { type: 'starter' } | { type: 'coins'; price: number } | { type: 'golds'; count: number };

export interface CarDef {
  id: string;
  name: string;
  tagline: string;
  shape: CarShape;
  body: string;
  accent: string;
  /** Multipliers on the base car (1 = starter). */
  tune: { speed: number; accel: number; grip: number; turn: number; loose: number };
  unlock: CarUnlock;
}

export const CARS: CarDef[] = [
  {
    id: 'pip',
    name: 'Pip',
    tagline: 'The plucky starter. Balanced at everything.',
    shape: 'coupe',
    body: '#ff5a6c',
    accent: '#fff6e6',
    tune: { speed: 1, accel: 1, grip: 1, turn: 1, loose: 1 },
    unlock: { type: 'starter' },
  },
  {
    id: 'dune-bug',
    name: 'Dune Bug',
    tagline: 'Fat tyres: happier on dirt, gravel and sand.',
    shape: 'buggy',
    body: '#ffc51f',
    accent: '#1b1035',
    tune: { speed: 0.975, accel: 1.02, grip: 0.97, turn: 1, loose: 1.12 },
    unlock: { type: 'coins', price: 150 },
  },
  {
    id: 'brick',
    name: 'Brick',
    tagline: 'Boxy and planted. Grips like glue, tops out a bit lower.',
    shape: 'van',
    body: '#22d3b4',
    accent: '#fff6e6',
    tune: { speed: 0.975, accel: 1.06, grip: 1.12, turn: 0.98, loose: 1 },
    unlock: { type: 'coins', price: 300 },
  },
  {
    id: 'zip',
    name: 'Zip',
    tagline: 'Long and low. Quick on the straights, loose in the bends.',
    shape: 'formula',
    body: '#2eb8ff',
    accent: '#ffffff',
    tune: { speed: 1.035, accel: 1.02, grip: 0.91, turn: 0.97, loose: 1 },
    unlock: { type: 'coins', price: 400 },
  },
  {
    id: 'bubble',
    name: 'Bubble',
    tagline: 'Tiny and twitchy. Turns on a coin, slides happily.',
    shape: 'bubble',
    body: '#ff8fc4',
    accent: '#fff6e6',
    tune: { speed: 0.98, accel: 1.05, grip: 0.92, turn: 1.08, loose: 1 },
    unlock: { type: 'coins', price: 600 },
  },
  {
    id: 'rally',
    name: 'Rally Lime',
    tagline: 'Stripes and mud flaps. A little better off the tarmac.',
    shape: 'coupe',
    body: '#b8e82a',
    accent: '#1b1035',
    tune: { speed: 0.992, accel: 0.98, grip: 0.95, turn: 1.02, loose: 1.1 },
    unlock: { type: 'coins', price: 800 },
  },
  {
    id: 'toaster',
    name: 'Toaster',
    tagline: 'Warm, square and surprisingly sticky.',
    shape: 'van',
    body: '#ff8a3d',
    accent: '#ffe7c2',
    tune: { speed: 0.978, accel: 1.04, grip: 1.08, turn: 1.01, loose: 1.02 },
    unlock: { type: 'golds', count: 2 },
  },
  {
    id: 'comet',
    name: 'Comet',
    tagline: 'Top speed hero. Brake... oh wait. Steer early.',
    shape: 'formula',
    body: '#9a6bff',
    accent: '#ffd12e',
    tune: { speed: 1.035, accel: 0.97, grip: 0.91, turn: 0.98, loose: 1.02 },
    unlock: { type: 'coins', price: 1200 },
  },
  {
    id: 'sandy',
    name: 'Sandy',
    tagline: 'The beach buggy, sun-bleached and sideways.',
    shape: 'buggy',
    body: '#f6e3b4',
    accent: '#ff5a6c',
    tune: { speed: 0.985, accel: 1, grip: 0.93, turn: 1.04, loose: 1.12 },
    unlock: { type: 'coins', price: 1600 },
  },
  {
    id: 'golden-pip',
    name: 'Golden Pip',
    tagline: 'For gold on every handmade track. Same handling, all the glory.',
    shape: 'coupe',
    body: '#ffd12e',
    accent: '#fff6e6',
    tune: { speed: 1, accel: 1, grip: 1, turn: 1, loose: 1 },
    unlock: { type: 'golds', count: 6 },
  },
];

export const DEFAULT_CAR = 'pip';

export function getCar(id: string): CarDef {
  return CARS.find((c) => c.id === id) ?? CARS[0]!;
}

/** Surfaces where `loose` (tyre type) matters. */
export const LOOSE: ReadonlySet<Surface> = new Set<Surface>(['dirt', 'gravel', 'sand', 'grass', 'mud', 'snow']);

/** Physics spec for a car. Loose-surface skill is applied by the sim per surface. */
export function specFor(car: CarDef): CarSpec {
  const t = car.tune;
  return {
    ...CAR,
    maxSpeed: CAR.maxSpeed * t.speed,
    accel: CAR.accel * t.accel,
    grip: CAR.grip * t.grip,
    driftGrip: CAR.driftGrip * t.grip,
    turnRate: CAR.turnRate * t.turn,
    loose: t.loose,
  };
}

/** 1..5 bars for the garage card. */
export function statBars(car: CarDef): { label: string; value: number }[] {
  const bar = (v: number, lo: number, hi: number): number => Math.max(1, Math.min(5, Math.round(1 + ((v - lo) / (hi - lo)) * 4)));
  const t = car.tune;
  return [
    { label: 'Speed', value: bar(t.speed, 0.95, 1.05) },
    { label: 'Accel', value: bar(t.accel, 0.95, 1.07) },
    { label: 'Grip', value: bar(t.grip, 0.85, 1.15) },
    { label: 'Turn', value: bar(t.turn, 0.96, 1.08) },
    { label: 'Off-road', value: bar(t.loose, 0.93, 1.17) },
  ];
}

export function unlockText(u: CarUnlock): string {
  if (u.type === 'coins') return `${u.price} coins`;
  if (u.type === 'golds') return `${u.count} gold medal${u.count === 1 ? '' : 's'}`;
  return 'Starter';
}

/** Coins for a finished race (a podium against AI pays extra). */
export function raceCoins(r: { validLaps: number; medal: 'gold' | 'silver' | 'bronze' | null; newBest: boolean; firstDaily: boolean; position?: number | null }): number {
  const medal = r.medal === 'gold' ? 25 : r.medal === 'silver' ? 15 : r.medal === 'bronze' ? 8 : 0;
  const podium = r.position === 1 ? 20 : r.position === 2 ? 10 : r.position === 3 ? 5 : 0;
  return 10 + r.validLaps * 3 + medal + podium + (r.newBest ? 10 : 0) + (r.firstDaily ? 30 : 0);
}
