import { useEffect, useState, type CSSProperties } from 'react';
import { useT } from '../i18n';
import { useLiveCatalog } from '../platform/liveCatalog';
import { useNow } from '../platform/hooks';
import { dayKey } from '../platform/dates';
import { Link } from '../router/router';
import { Icon } from './Icon';
import { Dot, Star, Tri } from './Shapes';
import { SurpriseButton } from './Surprise';
import { GamePreview, hasPreview } from './GamePreview';
import { gamePath, latestGame, playPath, SECTION_GAMES } from '../catalog/catalog';
import type { GameEntry } from '../catalog/types';
import { useFlagships } from '../platform/useFlagships';
import { activeHoliday } from '../platform/seasons';
import { cardImg } from '../platform/cardImg';
import './Hero.css';

/** Re-triggers the glitch class every few seconds. */
function useGlitchPulse(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let off = 0;
    const id = window.setInterval(() => {
      setOn(true);
      off = window.setTimeout(() => setOn(false), 480);
    }, 4200);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(off);
    };
  }, []);
  return on;
}

const WALL_COLUMNS = 3;

/**
 * The game wall: every game's art in three tilted columns drifting past each other (two rows sliding
 * sideways on a phone). It says "look how much is here" before a word is read. A shortcut for the
 * mouse (a card under it plays its game's live preview); keyboards and screen readers get the same games,
 * properly, in the sections below.
 */
function GameWall({ games }: { games: GameEntry[] }) {
  const columns = Array.from({ length: WALL_COLUMNS }, (_, c) => games.filter((_, i) => i % WALL_COLUMNS === c));
  // the card under the mouse plays its game's live preview, as the arcade's cards do (the wall stands still meanwhile)
  const [hover, setHover] = useState<string | null>(null);
  return (
    <div className="hero-wall" aria-hidden="true">
      <div className="wall-tilt">
        {columns.map((col, c) => (
          <div key={c} className="wall-col" style={{ '--dur': `${38 + c * 9}s` } as CSSProperties}>
            {/* the column twice over, so the loop never shows a seam */}
            <div className="wall-track">
              {[...col, ...col].map((g, i) => (
                <Link
                  key={`${g.slug}-${i}`}
                  href={gamePath(g)}
                  className="wall-tile"
                  data-accent={g.accent}
                  tabIndex={-1}
                  onPointerEnter={(e) => e.pointerType === 'mouse' && hasPreview(g.slug) && setHover(`${c}:${i}`)}
                  onPointerLeave={() => setHover(null)}
                >
                  <img src={g.art.tile} alt="" width={512} height={512} {...cardImg(i < 3, i < 4)} style={{ background: g.art.bg }} />
                  {hover === `${c}:${i}` && <GamePreview slug={g.slug} className="wall-preview" />}
                  <span className="wall-name">{g.title}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The first screen says what GlitchBound is in one breath: the line, one sentence, today's pick and
 * Surprise me, and the promise (free, no sign-up, nothing to install). Beside it the game wall. Today
 * (the day's theme and the daily challenge) is a section of its own further down.
 */
export function Hero() {
  const t = useT();
  const live = useLiveCatalog();
  const gameCount = live.games.length;
  // Today's pick: an admin's spotlight, else the newest game.
  const pick = live.spotlight ?? latestGame(live.games);
  const glitching = useGlitchPulse();
  const now = useNow(60_000);
  const holiday = activeHoliday(live.raw.season, dayKey(now));
  // The wall: the best games spread over the columns first, then every other game, then the RPG.
  const best = useFlagships().list.map((f) => f.game);
  const playable = live.games.filter((g) => !live.settings(g.slug).maintenance);
  const sections = SECTION_GAMES.filter((g) => !live.settings(g.slug).hidden);
  const wall = [...best, ...sections, ...playable.filter((g) => !best.includes(g))];

  return (
    <section className="hero wrap" aria-labelledby="hero-title">
      <div className="hero-copy">
        {holiday && (
          <p className="season-greeting">
            <span aria-hidden="true">{holiday.emoji}</span> {t(holiday.greeting)}
          </p>
        )}
        <p className="eyebrow">
          <span className="live-dot" /> {t('Free browser arcade')} · {gameCount === 1 ? t('1 game') : t('{n} games', { n: gameCount })}
        </p>
        <h1 id="hero-title" className="hero-title">
          {t('Small games.')}{' '}
          <span className={`glitch hero-hl${glitching ? ' is-glitching' : ''}`} data-text={t('Big obsessions.')}>
            {t('Big obsessions.')}
          </span>
        </h1>
        <p className="hero-sub">{t('Quick games that start in a second: trivia, word puzzles, racing, card games and a whole fantasy RPG. Right here in your browser.')}</p>
        <div className="hero-ctas">
          {pick && (
            <Link href={playPath(pick)} className="btn btn-primary btn-lg hero-pick" data-accent={pick.accent}>
              <img src={pick.art.tile} alt="" width={40} height={40} style={{ background: pick.art.bg }} />
              <span>
                <small className="mono">{t('Today’s pick')}</small>
                {pick.title}
              </span>
              <Icon name="play" />
            </Link>
          )}
          <SurpriseButton className="btn btn-lg hero-surprise" />
        </div>
        <ul className="hero-promise" aria-label={t('The GlitchBound promise')}>
          {[t('Free, always'), t('No sign-up'), t('Nothing to install'), t('Phone or computer')].map((p) => (
            <li key={p}>
              <Icon name="check" size={16} /> {p}
            </li>
          ))}
        </ul>
      </div>

      <GameWall games={wall} />

      <div className="hero-deco" aria-hidden="true">
        <Tri className="deco d1" fill="#b6e62c" />
        <Dot className="deco d2" fill="#ff4fc8" />
        <Star className="deco d3" fill="#ffc928" />
      </div>
    </section>
  );
}
