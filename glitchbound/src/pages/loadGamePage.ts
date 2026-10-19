import type { GamePage } from './GamePage';
import { fresh } from '../platform/freshBuild';

/**
 * The game page's code is a chunk of its own, so the home page's first load stays small. A game
 * page's HTML preloads it (vite.config.ts) and main.tsx waits for it before the first render there;
 * everywhere else it loads once the page is idle, so opening a game from a tile doesn't wait either.
 */
let loaded: typeof GamePage | undefined;

export const loadGamePage = fresh(() => import('./GamePage').then((m) => (loaded = m.GamePage)));

type GamePageModule = { default: typeof GamePage };

/** For React.lazy: the game page, at once when its code is already here, else once it loads. */
export function gamePageModule(): Promise<GamePageModule> {
  const page = loaded;
  if (!page) return loadGamePage().then((GamePage) => ({ default: GamePage }));
  // A thenable that calls back straight away: React.lazy then renders the page in the same pass,
  // instead of showing the loading placeholder for a frame.
  const ready = { then: (done: (m: GamePageModule) => void) => done({ default: page }) };
  return ready as unknown as Promise<GamePageModule>;
}
