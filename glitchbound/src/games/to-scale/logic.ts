/**
 * To Scale rules (pure: no React, no DOM, no Math.random). A shot pairs a reference thing with a
 * target thing between 1.8 and 8 times bigger or smaller. The player sets the target's size as a
 * multiple of the reference (the "ratio"); points depend on how close that is on a log scale, so
 * guessing half or double is equally wrong.
 */
import { THINGS } from './objects';

export const SHOTS = 5;
export const LIVES = 3;
/** Below this, an Endless shot costs a life. */
export const MISS_POINTS = 250;
export const MAX_POINTS = 1000;

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

export interface Shot {
  ref: number;
  target: number;
  /** The true target size as a multiple of the reference. */
  ratio: number;
  /** The slider's range, the same for every shot. */
  min: number;
  max: number;
  /** Where the target starts (always well off). */
  start: number;
}

const pairOk = (a: number, b: number): boolean => {
  const r = THINGS[b]!.size / THINGS[a]!.size;
  return (r >= 1.8 && r <= 8) || (r <= 1 / 1.8 && r >= 1 / 8);
};

/** Every thing that can be paired with `i`. */
export const partners = (i: number): number[] => THINGS.map((_, j) => j).filter((j) => j !== i && pairOk(i, j));

/** The slider runs from 1/RANGE to RANGE times the reference for every shot, so its middle gives nothing away. */
export const RANGE = 12;

/** A shot from a random number source, avoiding targets already used in this game. */
export function makeShot(r: () => number, usedTargets: ReadonlySet<number> = new Set()): Shot {
  for (let tries = 0; tries < 200; tries++) {
    const target = Math.floor(r() * THINGS.length);
    if (usedTargets.has(target)) continue;
    const refs = partners(target);
    if (!refs.length) continue;
    const ref = refs[Math.floor(r() * refs.length)]!;
    const ratio = THINGS[target]!.size / THINGS[ref]!.size;
    // Start somewhere random on the slider, but at least 1.7x off.
    let start = ratio >= 1 ? ratio / 2.5 : ratio * 2.5;
    for (let k = 0; k < 40; k++) {
      const s = Math.exp((r() * 2 - 1) * Math.log(RANGE * 0.8));
      if (Math.max(s, ratio) / Math.min(s, ratio) >= 1.7) {
        start = s;
        break;
      }
    }
    return { ref, target, ratio, min: 1 / RANGE, max: RANGE, start };
  }
  throw new Error('no shot');
}

/** The five shots of a seeded game (daily or challenge): five different targets. */
export function makeShots(seed: number): Shot[] {
  const r = rng(seed);
  const used = new Set<number>();
  return Array.from({ length: SHOTS }, () => {
    const s = makeShot(r, used);
    used.add(s.target);
    return s;
  });
}

/** How close a guess is, 0 to 1 (1 = exact): the smaller ratio over the bigger. */
export const accuracy = (guess: number, truth: number): number => Math.min(guess, truth) / Math.max(guess, truth);

/** Points for a guess: 1000 when exact, falling to 0 at 2.8x off either way. */
export function pointsFor(guess: number, truth: number): number {
  const off = Math.abs(Math.log2(guess / truth));
  return Math.round(MAX_POINTS * Math.max(0, 1 - off / 1.5));
}

/** One emoji per shot for the spoiler-free result line. */
export function mark(points: number): string {
  if (points >= 900) return '🎯';
  if (points >= 700) return '🟩';
  if (points >= 450) return '🟨';
  if (points >= MISS_POINTS) return '🟧';
  return '🟥';
}

/** A ratio in words: "2.4×", "15×", "0.71×", "1/3". */
export function ratioText(r: number): string {
  if (r >= 1) return `${r < 10 ? Math.round(r * 10) / 10 : Math.round(r)}×`;
  const inv = 1 / r;
  if (inv < 2) return `${Math.round(r * 100) / 100}×`;
  return `1/${inv < 10 ? Math.round(inv * 10) / 10 : Math.round(inv)}`;
}
