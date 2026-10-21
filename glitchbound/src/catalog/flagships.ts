/**
 * The home page's "Start here" games: the four we would show a friend first. Admins choose them with
 * the "Best game" switch on a banner and order them like the banners; the fallback list fills whatever
 * is left. Pure: shared by the home page, the admin preview, the arcade grid's order and the
 * end-of-round "next up" suggestion.
 */
import { themeGames, type DayTheme } from '../platform/themes';
import type { GameEntry } from './types';

/** The owner's flagships, in order, used where fewer than four games carry the Best game switch. */
export const FLAGSHIP_FALLBACK = ['wait-what', 'launch-control', 'color-recall', 'letter-pinch'];
export const FLAGSHIP_MAX = 4;

export interface Flagship {
  game: GameEntry;
  /** The day's theme points at this game: it leads the row and wears the theme's sticker. */
  themed: boolean;
}

/**
 * The chosen games first, in the order `games` comes in (the admins' banner order), then the fallback
 * list fills up to `max`, without repeats. When the day's theme fits one of them, that one moves to
 * the front.
 */
export function flagshipGames(games: readonly GameEntry[], chosen: (slug: string) => boolean, theme?: DayTheme | null, max = FLAGSHIP_MAX): Flagship[] {
  const out: GameEntry[] = [];
  for (const g of games) if (out.length < max && chosen(g.slug)) out.push(g);
  for (const slug of FLAGSHIP_FALLBACK) {
    if (out.length >= max) break;
    const g = games.find((x) => x.slug === slug);
    if (g && !out.includes(g)) out.push(g);
  }
  const lead = theme ? themeGames(theme, out)[0] : undefined;
  const ordered = lead ? [lead, ...out.filter((g) => g !== lead)] : out;
  return ordered.map((game) => ({ game, themed: game === lead }));
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
