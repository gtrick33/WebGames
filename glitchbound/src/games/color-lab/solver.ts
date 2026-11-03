/**
 * Runs Color Lab's slow solver work (hints, making a level) in a Web Worker so a big board never
 * freezes the page, and remembers finished levels so the next one is usually ready before it is asked
 * for. Without workers (old browsers, tests) the same pure functions run here.
 */
import { levelOf, levelReqKey, type Level, type LevelReq } from './levels';
import { hint, type Board, type Move } from './sort';

export type SolverJob = { type: 'hint'; board: Board; level?: { board: Board; solution?: Move[] } } | { type: 'level'; req: LevelReq };

const run = (job: SolverJob): unknown => (job.type === 'hint' ? hint(job.board, job.level) : levelOf(job.req));

let worker: Worker | null | undefined;
let nextId = 1;
const pending = new Map<number, { job: SolverJob; done: (v: unknown) => void }>();

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = typeof Worker !== 'undefined' ? new Worker(new URL('./solver.worker.ts', import.meta.url), { type: 'module' }) : null;
  } catch {
    worker = null;
  }
  if (worker) {
    worker.onmessage = (e: MessageEvent<{ id: number; result: unknown }>) => {
      const p = pending.get(e.data.id);
      pending.delete(e.data.id);
      p?.done(e.data.result);
    };
    // A worker that fails to load: finish what it was asked here, and stop using it.
    worker.onerror = () => {
      worker?.terminate();
      worker = null;
      const left = [...pending.values()];
      pending.clear();
      for (const p of left) p.done(run(p.job));
    };
  }
  return worker;
}

function ask<T>(job: SolverJob): Promise<T> {
  const w = getWorker();
  if (!w) return Promise.resolve(run(job) as T);
  return new Promise<T>((resolve) => {
    const id = nextId++;
    pending.set(id, { job, done: (v) => resolve(v as T) });
    w.postMessage({ id, job });
  });
}

/** The next move towards a solution, worked out off the main thread. */
export const hintAsync = (board: Board, level?: Level): Promise<Move | null> =>
  ask<Move | null>({ type: 'hint', board, level: level ? { board: level.board, solution: level.solution } : undefined });

const made = new Map<string, Level>();
const making = new Map<string, Promise<Level>>();

/** A level made before (or prefetched and ready), or null. */
export const levelReady = (q: LevelReq): Level | null => made.get(levelReqKey(q)) ?? null;

/** Makes a level off the main thread (once; later calls share the result). */
export function levelAsync(q: LevelReq): Promise<Level> {
  const key = levelReqKey(q);
  const ready = made.get(key);
  if (ready) return Promise.resolve(ready);
  let p = making.get(key);
  if (!p) {
    p = ask<Level>({ type: 'level', req: q }).then((lv) => {
      making.delete(key);
      if (made.size > 32) made.clear();
      made.set(key, lv);
      return lv;
    });
    making.set(key, p);
  }
  return p;
}

/** A level right now: ready-made when it was prefetched, else made here (small levels are quick). */
export function levelNow(q: LevelReq): Level {
  return levelReady(q) ?? levelOf(q);
}

/** Stops the worker (the game was closed); pending answers are dropped. */
export function disposeSolver(): void {
  worker?.terminate();
  worker = undefined;
  pending.clear();
  making.clear();
}
