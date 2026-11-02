/// <reference lib="webworker" />
/**
 * The expert's search off the page's thread: it gets a deal, a level and a seed and sends back the
 * deal after the computer's move (the same move applyBot makes on the page, so a seed plays the same).
 */
import { applyBot, type Level } from './ai';
import { rng, type Deal } from './logic';

self.onmessage = (e: MessageEvent<{ id: number; deal: Deal; level: Level; seed: number }>) => {
  const { id, deal, level, seed } = e.data;
  self.postMessage({ id, deal: applyBot(deal, level, rng(seed)) });
};
