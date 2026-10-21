/**
 * The home page's "Live multiplayer games": games friends play together at the same moment, each on
 * their own device (a live room, see GameEntry.live). Admins choose and order them in Admin › Games ›
 * Live multiplayer games (a list of its own, like the best games); without one every game with a live
 * room is shown, in the order the games come in. An empty saved list hides the section. Pure: shared
 * by the home page and the admin editor.
 */
import type { GameEntry } from './types';

export const MULTIPLAYER_MAX = 8;

/** The games to show: the saved list (those still playable, in its order), else every live game. */
export function multiplayerGames(games: readonly GameEntry[], chosen: readonly string[] | null | undefined, max = MULTIPLAYER_MAX): GameEntry[] {
  if (Array.isArray(chosen)) return chosen.flatMap((slug) => games.filter((g) => g.slug === slug)).slice(0, max);
  return games.filter((g) => g.live).slice(0, max);
}

/** The slugs as stored, what the admin editor starts from. */
export const multiplayerSlugs = (games: readonly GameEntry[], chosen: readonly string[] | null | undefined, max = MULTIPLAYER_MAX): string[] => multiplayerGames(games, chosen, max).map((g) => g.slug);
