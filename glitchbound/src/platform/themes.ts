/**
 * Theme days: every day of the week has its own flavor, so there is always a reason to come back
 * ("it's Trivia Tuesday"). The theme picks which game the daily challenge comes from and what the
 * home page puts up front. Pure: the server uses it too, so everyone gets the same day.
 */
import type { GameEntry, MoodId } from '../catalog/types';

/** The first day the daily challenge follows the theme (earlier days keep their original pick). */
export const THEMES_SINCE = '2026-10-19';

export type ThemeId = 'chill' | 'rush' | 'trivia' | 'words' | 'throwdown' | 'party' | 'throttle';

export interface DayTheme {
  id: ThemeId;
  emoji: string;
  name: string;
  tagline: string;
  /** Games that fit: these slugs first, then any game with one of these moods. */
  games?: string[];
  moods?: MoodId[];
  /** The day's call to action besides playing (challenge a friend, party mode). */
  cta?: 'challenge' | 'party';
}

/** Sunday first, like Date.getUTCDay(). */
export const WEEK: DayTheme[] = [
  { id: 'chill', emoji: '🌿', name: 'Chill Sunday', tagline: 'Slow down: colors, pictures and puzzles, no rush.', moods: ['chill'] },
  { id: 'rush', emoji: '⚡', name: 'Monday Rush', tagline: 'Quick rounds to wake your brain up.', moods: ['quick'] },
  { id: 'trivia', emoji: '🤯', name: 'Trivia Tuesday', tagline: 'Facts that sound made up, but aren’t.', games: ['wait-what', 'to-scale'], moods: ['brainy'] },
  { id: 'words', emoji: '🔤', name: 'Word Wednesday', tagline: 'Letters, clues and one mystery word.', games: ['letter-pinch', 'crosswire'] },
  { id: 'throwdown', emoji: '⚔️', name: 'Throwdown Thursday', tagline: 'Send a friend a challenge: same round, one shot each.', cta: 'challenge' },
  { id: 'party', emoji: '🎉', name: 'Party Friday', tagline: 'Friends over? Pass the phone or open a room.', games: ['crass-act'], moods: ['friends'], cta: 'party' },
  { id: 'throttle', emoji: '🏁', name: 'Full-Throttle Saturday', tagline: 'Racers, flyers and near misses.', games: ['neon-rush', 'mini-racer', 'wing-it'], moods: ['action'] },
];

/** The theme of a calendar day (YYYY-MM-DD). */
export function themeOf(day: string): DayTheme {
  return WEEK[new Date(`${day}T12:00:00Z`).getUTCDay()]!;
}

/** Games that fit a theme, best fits first (its own list, then by mood); empty when any game fits. */
export function themeGames(theme: DayTheme, games: readonly GameEntry[]): GameEntry[] {
  const listed = (theme.games ?? []).map((s) => games.find((g) => g.slug === s)).filter((g): g is GameEntry => !!g);
  const byMood = games.filter((g) => !listed.includes(g) && theme.moods?.some((m) => g.moods?.includes(m)));
  return [...listed, ...byMood];
}
