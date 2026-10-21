import { chosenFlagships, flagshipGames, FLAGSHIP_MAX, housePicks, type Flagship } from '../catalog/flagships';
import { useLang } from '../i18n';
import { orderByLayout } from '../catalog/settings';
import { dayKey } from './dates';
import { useNow } from './hooks';
import { useLiveCatalog } from './liveCatalog';
import { themeOf, type DayTheme } from './themes';

/**
 * The "Start here" games as players see them right now (the admins' list in its order, pauses
 * applied, house picks filling in) and today's theme, which decides the flagship that leads the row.
 * Shared by the home page, the arcade grid's order and the game page's "next up".
 */
export function useFlagships(): { list: Flagship[]; theme: DayTheme } {
  const live = useLiveCatalog();
  const lang = useLang();
  const theme = themeOf(dayKey(useNow(60_000)));
  const games = orderByLayout(live.games, live.layout).filter((g) => !live.settings(g.slug).maintenance);
  return { list: flagshipGames(games, chosenFlagships(live.raw, games), theme, FLAGSHIP_MAX, housePicks(lang)), theme };
}
