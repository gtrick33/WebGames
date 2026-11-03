import { botMove, playOut, type BotJob } from './bots';
import type { Match } from './match';

/** Works out the computer crews' turns off the main thread (see bots.ts). */
self.onmessage = (e: MessageEvent<{ id: number; job: BotJob; m: Match }>) => {
  const { id, job, m } = e.data;
  (self as unknown as Worker).postMessage({ id, m: job === 'move' ? botMove(m) : playOut(m) });
};
