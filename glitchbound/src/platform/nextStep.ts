/**
 * What to offer after a round, so the games chain into each other instead of ending at a menu:
 * today's challenge if it is still open, else a flagship you have not tried, else a game from the
 * day's theme, else one in the same mood, else another go. Pure, so it is tested on its own.
 */
import type { GameEntry } from '../catalog/types';
import { themeGames, type DayTheme } from './themes';

export type NextStep =
  | { kind: 'daily'; game: GameEntry }
  | { kind: 'flagship'; game: GameEntry }
  | { kind: 'theme'; game: GameEntry; theme: DayTheme }
  | { kind: 'mood'; game: GameEntry }
  /** Play this game again; `daily` when it is today's challenge and the target is still open. */
  | { kind: 'again'; daily: boolean };

export interface NextStepInput {
  /** The game just played. */
  game: GameEntry;
  /** The games the player can open right now. */
  games: readonly GameEntry[];
  /** Today's challenge and whether this player has cleared it. */
  daily: { game: GameEntry; done: boolean } | null;
  flagships: readonly GameEntry[];
  /** Games with at least one round on this device. */
  played: ReadonlySet<string>;
  theme: DayTheme;
}

export function nextStep(i: NextStepInput): NextStep {
  const unplayed = (g: GameEntry): boolean => g.slug !== i.game.slug && !i.played.has(g.slug);
  if (i.daily && !i.daily.done) return i.daily.game.slug === i.game.slug ? { kind: 'again', daily: true } : { kind: 'daily', game: i.daily.game };
  const flagship = i.flagships.find(unplayed);
  if (flagship) return { kind: 'flagship', game: flagship };
  const themed = themeGames(i.theme, i.games).find(unplayed);
  if (themed) return { kind: 'theme', game: themed, theme: i.theme };
  const mood = i.games.find((g) => unplayed(g) && g.moods?.some((m) => i.game.moods?.includes(m)));
  if (mood) return { kind: 'mood', game: mood };
  return { kind: 'again', daily: false };
}
