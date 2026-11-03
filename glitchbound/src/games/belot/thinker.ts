/**
 * The computer players' moves for the single-player table. The expert simulates many deals per card
 * (up to a second on a phone), so it thinks in a Web Worker and the table stays responsive; the other
 * levels are quick and play on the page. Without workers (old browsers, tests) everything plays here.
 */
import { applyBot, type Level } from './ai';
import { rng, type Deal } from './logic';

interface Ask {
  deal: Deal;
  level: Level;
  seed: number;
  done: (d: Deal) => void;
}

let worker: Worker | null | undefined;
let nextId = 0;
const waiting = new Map<number, Ask>();

const here = (a: Ask): void => a.done(applyBot(a.deal, a.level, rng(a.seed)));

function dropWorker(): void {
  worker?.terminate();
  worker = null;
  // whatever was asked is answered on the page instead
  const left = [...waiting.values()];
  waiting.clear();
  left.forEach(here);
}

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = typeof Worker === 'undefined' ? null : new Worker(new URL('./ai.worker.ts', import.meta.url), { type: 'module' });
  } catch {
    worker = null;
  }
  if (worker) {
    worker.onmessage = (e: MessageEvent<{ id: number; deal: Deal }>) => {
      const a = waiting.get(e.data.id);
      waiting.delete(e.data.id);
      a?.done(e.data.deal);
    };
    worker.onerror = dropWorker;
  }
  return worker;
}

/** The deal after the computer's move at `level`, seeded so the same position plays the same. */
export function think(deal: Deal, level: Level, seed: number, done: (d: Deal) => void): void {
  const a: Ask = { deal, level, seed, done };
  const w = level === 'expert' ? getWorker() : null;
  if (!w) return here(a);
  const id = ++nextId;
  waiting.set(id, a);
  try {
    w.postMessage({ id, deal, level, seed });
  } catch {
    dropWorker();
  }
}
