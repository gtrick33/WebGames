/**
 * The home page's "Start here" games: the four we would show a friend first. Admins choose and order
 * them in Admin › Games › Our best games (a list of its own, like the banner layout); without one the
 * house picks fill in. Pure: shared by the home page, the admin editor, the arcade grid's order and
 * the end-of-round "next up" suggestion.
 */
import { themeGames, type DayTheme } from '../platform/themes';
import type { PublicCatalog } from './settings';
import type { GameEntry } from './types';

/** The owner's flagships, in order: the row when admins have not chosen, and the fill when they chose fewer. */
export const FLAGSHIP_FALLBACK = ['wait-what', 'launch-control', 'color-recall', 'letter-pinch'];
export const FLAGSHIP_MAX = 4;

export interface Flagship {
  game: GameEntry;
  /** The day's theme points at this game: it leads the row and wears the theme's sticker. */
  themed: boolean;
}

/**
 * The admins' best games in their order: the saved list, else (settings saved before the list existed)
 * the games that had the old per-game switch on, in the order `games` comes in.
 */
export function chosenFlagships(cat: PublicCatalog, games: readonly { slug: string }[]): string[] {
  if (Array.isArray(cat.flagships)) return cat.flagships;
  return games.filter((g) => cat.settings[g.slug]?.flagship).map((g) => g.slug);
}

/**
 * The row players see: the chosen games first (those still playable), then the house picks, then any
 * other game, up to `max` and without repeats. When the day's theme fits one of them, that one moves
 * to the front.
 */
export function flagshipGames(games: readonly GameEntry[], chosen: readonly string[], theme?: DayTheme | null, max = FLAGSHIP_MAX): Flagship[] {
  const out: GameEntry[] = [];
  const add = (g: GameEntry | undefined): void => {
    if (g && out.length < max && !out.includes(g)) out.push(g);
  };
  for (const slug of chosen) add(games.find((g) => g.slug === slug));
  for (const slug of FLAGSHIP_FALLBACK) add(games.find((g) => g.slug === slug));
  for (const g of games) add(g);
  const lead = theme ? themeGames(theme, out)[0] : undefined;
  const ordered = lead ? [lead, ...out.filter((g) => g !== lead)] : out;
  return ordered.map((game) => ({ game, themed: game === lead }));
}

/** The four slugs as stored (no theme reordering): what the admin editor starts from. */
export const flagshipSlugs = (games: readonly GameEntry[], chosen: readonly string[], max = FLAGSHIP_MAX): string[] => flagshipGames(games, chosen, null, max).map((f) => f.game.slug);

/**
 * Puts `slug` into the list or takes it out, keeping it full: a game switched on takes the last slot,
 * a game switched off makes room for the first house pick (else the first game) not already listed.
 */
export function toggleFlagship(games: readonly GameEntry[], current: readonly string[], slug: string, on: boolean, max = FLAGSHIP_MAX): string[] {
  const list = flagshipSlugs(games, current, max);
  if (on) {
    if (list.includes(slug)) return list;
    return list.length < max ? [...list, slug] : [...list.slice(0, max - 1), slug];
  }
  if (!list.includes(slug)) return list;
  const rest = list.filter((s) => s !== slug);
  const fill = [...FLAGSHIP_FALLBACK, ...games.map((g) => g.slug)].find((s) => s !== slug && !rest.includes(s) && games.some((g) => g.slug === s));
  return fill ? [...rest, fill] : rest;
}

/**
 * The home grid's order: `first` (the flagships, then any other pinned game), then games played on
 * this device (most recent first), then the rest as given.
 */
export function rankForHome<T extends { slug: string }>(games: readonly T[], first: readonly string[], recent: readonly string[]): T[] {
  const rank = new Map<string, number>();
  for (const s of first) if (!rank.has(s)) rank.set(s, rank.size);
  for (const s of recent) if (!rank.has(s)) rank.set(s, rank.size);
  return games
    .map((g, i) => ({ g, i, k: rank.get(g.slug) ?? Infinity }))
    .sort((a, b) => a.k - b.k || a.i - b.i)
    .map((x) => x.g);
}
