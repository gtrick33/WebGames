/** Color Lab's solver off the main thread: hints and new levels (see solver.ts). */
import { levelOf } from './levels';
import { hint } from './sort';
import type { SolverJob } from './solver';

self.onmessage = (e: MessageEvent<{ id: number; job: SolverJob }>) => {
  const { id, job } = e.data;
  const result = job.type === 'hint' ? hint(job.board, job.level) : levelOf(job.req);
  self.postMessage({ id, result });
};
