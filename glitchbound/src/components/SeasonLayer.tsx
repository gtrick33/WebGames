import { useEffect, useState } from 'react';
import { dayKey } from '../platform/dates';
import { useNow } from '../platform/hooks';
import { music } from '../platform/music';
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
    <>
      <div className="season-decor" aria-hidden="true">
        {SPOTS.map(([left, delay, dur, size], i) => (
          <span key={i} style={{ left: `${left}%`, animationDelay: `-${delay}s`, animationDuration: `${dur}s`, fontSize: size }}>
            {holiday.decor[i % holiday.decor.length]}
          </span>
        ))}
      </div>
      {holiday.id === 'halloween' && <Bats />}
    </>
  );
}

interface Bat {
  id: number;
  /** Start and end points (vw/vh), the height of the swoop, the flight time and the size. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  swoop: number;
  secs: number;
  size: number;
}

let batIds = 0;

/** A new bat entering from one side and leaving on the other, at a random height. */
function newBat(): Bat {
  const ltr = Math.random() < 0.5;
  const y0 = 8 + Math.random() * 70;
  return {
    id: ++batIds,
    x0: ltr ? -12 : 112,
    x1: ltr ? 112 : -12,
    y0,
    y1: Math.max(4, Math.min(88, y0 + (Math.random() - 0.5) * 50)),
    swoop: (Math.random() - 0.5) * 30,
    secs: 5 + Math.random() * 5,
    size: 36 + Math.random() * 34,
  };
}

/** Halloween: now and then a bat flaps across the screen, in front of everything (never in the way of a click). */
function Bats() {
  const [bats, setBats] = useState<Bat[]>([]);
  useEffect(() => {
    let timer = 0;
    const spawn = (): void => {
      if (!document.hidden) setBats((b) => (b.length >= 3 ? b : [...b, newBat()]));
      timer = window.setTimeout(spawn, 2500 + Math.random() * 6000);
    };
    timer = window.setTimeout(spawn, 1200);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <div className="season-bats" aria-hidden="true">
      {bats.map((b) => (
        <span
          key={b.id}
          className="season-bat"
          style={{
            ['--x0' as string]: `${b.x0}vw`,
            ['--x1' as string]: `${b.x1}vw`,
            ['--y0' as string]: `${b.y0}vh`,
            ['--y1' as string]: `${b.y1}vh`,
            ['--swoop' as string]: `${b.swoop}vh`,
            ['--flip' as string]: b.x1 > b.x0 ? 1 : -1,
            animationDuration: `${b.secs}s`,
            width: b.size,
          }}
          onAnimationEnd={() => setBats((all) => all.filter((x) => x.id !== b.id))}
        >
          <svg viewBox="0 0 64 32" className="bat-svg">
            <path className="bat-wing bat-wing-l" d="M30 14 C24 4 14 2 2 6 C7 8 8 11 7 14 C11 12 14 14 15 17 C18 14 22 15 24 18 C26 15 28 15 30 17Z" />
            <path className="bat-wing bat-wing-r" d="M34 14 C40 4 50 2 62 6 C57 8 56 11 57 14 C53 12 50 14 49 17 C46 14 42 15 40 18 C38 15 36 15 34 17Z" />
            <ellipse cx="32" cy="16" rx="4.2" ry="6" />
            <path d="M29 11 L28.4 7.6 L30.6 10 Z M35 11 L35.6 7.6 L33.4 10 Z" />
            <circle cx="30.6" cy="14" r="0.9" className="bat-eye" />
            <circle cx="33.4" cy="14" r="0.9" className="bat-eye" />
          </svg>
        </span>
      ))}
    </div>
  );
}
