import { lazy, Suspense, useEffect } from 'react';
import { dayKey } from '../platform/dates';
import { useNow } from '../platform/hooks';
import { music } from '../platform/music';
import { useLiveCatalog } from '../platform/liveCatalog';
import { activeHoliday } from '../platform/seasons';
import { matchRoute, useLocation } from '../router/router';
import './SeasonLayer.css';
import { fresh } from '../platform/freshBuild';

const SeasonDecor = lazy(fresh(() => import('./SeasonDecor')));

/**
 * The holiday look (see platform/seasons.ts): sets the season's colours and logo sticker on the page,
 * and lets a few decorations drift down lobby pages (never over a game, never with reduced motion).
 * On the arcade and party pages the holiday also dresses up every card and button (seasonSkins.ts).
 */
export function SeasonLayer() {
  const live = useLiveCatalog();
  const day = dayKey(useNow(60_000));
  const holiday = activeHoliday(live.raw.season, day);
  const { pathname } = useLocation();
  const inGame = matchRoute(pathname).name === 'game';

  // The lobby music follows the holiday too (the everyday tune otherwise).
  const songId = holiday?.id ?? 'default';
  useEffect(() => music.setSong(songId), [songId]);

  useEffect(() => {
    const root = document.documentElement;
    if (!holiday) {
      delete root.dataset.season;
      return;
    }
    root.dataset.season = holiday.id;
    root.style.setProperty('--season-1', holiday.colors[0]);
    root.style.setProperty('--season-2', holiday.colors[1]);
    root.style.setProperty('--season-emoji', `"${holiday.emoji}"`);
    return () => {
      delete root.dataset.season;
    };
  }, [holiday]);

  if (!holiday || inGame) return null;
  return (
    <Suspense fallback={null}>
      <SeasonDecor holiday={holiday} />
    </Suspense>
  );
}
