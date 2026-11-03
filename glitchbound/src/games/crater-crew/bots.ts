/**
 * The computer crews' turns in single player. Each one searches about a thousand test shells through
 * the physics, so it runs in a worker (bots.worker.ts) when the browser has one, and here otherwise.
 * Either way the result is the same: the search is seeded by the battle and the turn.
 */
import { hashString } from '../../platform/dates';
import { botTurn } from './ai';
import { playTurn, type Match } from './match';

/** A computer crew's turn (the same for everyone on the same battle: the daily and challenges). */
export const botMove = (m: Match): Match => playTurn(m, botTurn(m, m.crews[m.crewTurn]!.bot!, hashString(`${m.seed}:${m.turn}`))).match;

/** The rest of the battle once your crew is out: the computer crews play on to the end. */
export function playOut(m: Match): Match {
  while (!m.over) m = m.crews[m.crewTurn]?.bot ? botMove(m) : playTurn(m, { walk: [], fire: null }).match;
  return m;
}

export type BotJob = 'move' | 'out';
const run = (job: BotJob, m: Match): Match => (job === 'move' ? botMove(m) : playOut(m));

/** Hands bot turns to the worker, one answer per request; falls back to the main thread if it fails. */
export class BotThinker {
  private worker: Worker | null = null;
  private nextId = 1;
  private readonly waiting = new Map<number, { job: BotJob; m: Match; done: (m: Match) => void }>();

  constructor() {
    try {
      this.worker = new Worker(new URL('./bots.worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e: MessageEvent<{ id: number; m: Match }>) => {
        const w = this.waiting.get(e.data.id);
        this.waiting.delete(e.data.id);
        w?.done(e.data.m);
      };
      this.worker.onerror = () => this.drop();
    } catch {
      this.worker = null;
    }
  }

  think(job: BotJob, m: Match): Promise<Match> {
    return new Promise((done) => {
      if (!this.worker) return done(run(job, m));
      const id = this.nextId++;
      this.waiting.set(id, { job, m, done });
      this.worker.postMessage({ id, job, m });
    });
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.waiting.clear();
  }

  /** The worker failed: what it was asked is worked out here instead. */
  private drop(): void {
    this.worker?.terminate();
    this.worker = null;
    const left = [...this.waiting.values()];
    this.waiting.clear();
    for (const w of left) w.done(run(w.job, w.m));
  }
}
