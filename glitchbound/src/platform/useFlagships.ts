import { flagshipGames, type Flagship } from '../catalog/flagships';
import { dayKey } from './dates';
import { useNow } from './hooks';
import { useLiveCatalog } from './liveCatalog';
import { themeOf, type DayTheme } from './themes';

/**
 * The "Start here" games as players see them right now (admin pins and pauses applied) and today's
 * theme, which decides the flagship that leads the row. Shared by the home page, the arcade grid's
 * order and the game page's "next up".
 */
export function useFlagships(): { list: Flagship[]; theme: DayTheme } {
  const live = useLiveCatalog();
  const theme = themeOf(dayKey(useNow(60_000)));
  const games = live.games.filter((g) => !live.settings(g.slug).maintenance);
  return { list: flagshipGames(games, (slug) => live.settings(slug).pinned, theme), theme };
}
