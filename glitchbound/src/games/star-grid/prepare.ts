/**
 * Grids made ahead of time. Making a grid can take a moment on a slow phone (a 9×9 most of all), so
 * pressing Play should never wait for it: seeded grids (the daily, a challenge) are kept once made,
 * and a spare endless grid per size is made in idle time while the player is on a menu or a result.
 */
import { hashString } from '../../platform/dates';
import { DAILY_SIZES, makePuzzle, type Puzzle } from './logic';

const made = new Map<string, Puzzle>();
const KEEP = 12;

/** The grid for a seed, made once. */
export function seeded(seed: number, size: number): Puzzle {
  const k = `${seed >>> 0}:${size}`;
  let p = made.get(k);
  if (!p) {
    p = makePuzzle(seed, size);
    if (made.size >= KEEP) made.delete(made.keys().next().value!);
    made.set(k, p);
  }
  return p;
}

/** A day's three grids, the same for everyone. */
export const dailyPuzzles = (day: string): Puzzle[] => DAILY_SIZES.map((s) => seeded(hashString(`star-grid:${day}:${s}`), s));

const randomSeed = (): number => (Math.random() * 2 ** 32) >>> 0;
const spare = new Map<number, Puzzle>();

/** A brand-new endless grid: the spare one made earlier when there is one. */
export function endlessPuzzle(size: number): Puzzle {
  const p = spare.get(size);
  spare.delete(size);
  return p ?? makePuzzle(randomSeed(), size);
}

type IdleWindow = Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (h: number) => void };

/** Runs the jobs one at a time in idle time. Returns a stop function. */
export function whenIdle(jobs: (() => void)[]): () => void {
  const w = window as IdleWindow;
  const queue = jobs.slice();
  let stopped = false;
  let handle: number | undefined;
  const next = (): void => {
    const job = queue.shift();
    if (stopped || !job) return;
    const run = (): void => {
      handle = undefined;
      if (stopped) return;
      job();
      next();
    };
    handle = w.requestIdleCallback ? w.requestIdleCallback(run, { timeout: 3000 }) : window.setTimeout(run, 250);
  };
  next();
  return () => {
    stopped = true;
    if (handle === undefined) return;
    if (w.cancelIdleCallback) w.cancelIdleCallback(handle);
    else window.clearTimeout(handle);
  };
}

/** Makes, in idle time, a spare endless grid for each size (first one first) and a day's daily. */
export function prepare(sizes: number[], day?: string): () => void {
  const jobs: (() => void)[] = [];
  if (day) for (const s of DAILY_SIZES) jobs.push(() => void seeded(hashString(`star-grid:${day}:${s}`), s));
  for (const s of sizes)
    jobs.push(() => {
      if (!spare.has(s)) spare.set(s, makePuzzle(randomSeed(), s));
    });
  return whenIdle(jobs);
}

/** For tests: whether a spare endless grid of this size is waiting. */
export const hasSpare = (size: number): boolean => spare.has(size);
