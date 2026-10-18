import { useEffect } from 'react';
import { dayKey } from '../platform/dates';
import { useNow } from '../platform/hooks';
import { useLiveCatalog } from '../platform/liveCatalog';
import { activeHoliday } from '../platform/seasons';
import { matchRoute, useLocation } from '../router/router';
import './SeasonLayer.css';

/** Where each floating decoration starts: [left %, delay s, duration s, size px]. */
const SPOTS: [number, number, number, number][] = [
  [4, 0, 19, 26],
  [14, 7, 23, 20],
  [27, 3, 21, 30],
  [41, 11, 25, 22],
  [55, 5, 20, 28],
  [68, 14, 24, 20],
  [81, 2, 22, 26],
  [93, 9, 26, 22],
];

/**
 * The holiday look (see platform/seasons.ts): sets the season's colours and logo sticker on the page,
 * and lets a few decorations drift down lobby pages (never over a game, never with reduced motion).
 */
export function SeasonLayer() {
  const live = useLiveCatalog();
  const day = dayKey(useNow(60_000));
  const holiday = activeHoliday(live.raw.season, day);
  const { pathname } = useLocation();
  const inGame = matchRoute(pathname).name === 'game';

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
    <div className="season-decor" aria-hidden="true">
      {SPOTS.map(([left, delay, dur, size], i) => (
        <span key={i} style={{ left: `${left}%`, animationDelay: `-${delay}s`, animationDuration: `${dur}s`, fontSize: size }}>
          {holiday.decor[i % holiday.decor.length]}
        </span>
      ))}
    </div>
  );
}
