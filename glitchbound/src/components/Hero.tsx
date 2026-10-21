import { useEffect, useState } from 'react';
import { useT } from '../i18n';
import { useLiveCatalog } from '../platform/liveCatalog';
import { useNow } from '../platform/hooks';
import { dayKey } from '../platform/dates';
import { Link } from '../router/router';
import { Icon } from './Icon';
import { Dot, Star, Tri } from './Shapes';
import { DailyCard } from './DailyCard';
import { FreeBanner } from './FreeBanner';
import { SurpriseButton } from './Surprise';
import { ThemeStrip } from './ThemeStrip';
import { latestGame } from '../catalog/catalog';
import { activeHoliday } from '../platform/seasons';
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

/**
 * The intro above the catalogue: brand line, today's pick and Surprise me on the left; on the right
 * today at a glance (the day's theme, the daily challenge, and the free promise on wide screens). The
 * games themselves start right below (the flagship row).
 */
export function Hero() {
  const t = useT();
  const live = useLiveCatalog();
  const gameCount = live.games.length;
  // Today's pick: an admin's spotlight, else the newest game.
  const pick = live.spotlight ?? latestGame(live.games);
  const glitching = useGlitchPulse();
  const now = useNow(1000);
  const holiday = activeHoliday(live.raw.season, dayKey(now));

  return (
    <section className="intro-band wrap" aria-labelledby="hero-title">
      <div className="intro-copy">
        {holiday && (
          <p className="season-greeting">
            <span aria-hidden="true">{holiday.emoji}</span> {t(holiday.greeting)}
          </p>
        )}
        <p className="eyebrow">
          <span className="live-dot" /> {t('Independent browser arcade')} · {gameCount === 1 ? t('1 game') : t('{n} games', { n: gameCount })}
        </p>
        <h1 id="hero-title" className="intro-title">
          {t('Small games.')}{' '}
          <span className={`glitch intro-hl${glitching ? ' is-glitching' : ''}`} data-text={t('Big obsessions.')}>
            {t('Big obsessions.')}
          </span>
        </h1>
        <p className="intro-sub">{t('Five minutes, endless replayability. Every game starts in a second, no installs. Beat your best, then come back for tomorrow’s challenge.')}</p>
        <div className="intro-ctas">
          {pick && (
            <Link href={`/games/${pick.slug}`} className="btn btn-primary btn-lg intro-pick" data-accent={pick.accent}>
              <img src={pick.art.tile} alt="" width={34} height={34} style={{ background: pick.art.bg }} />
              <span>
                <small className="mono">{t('Today’s pick')}</small>
                {pick.title}
              </span>
              <Icon name="play" />
            </Link>
          )}
          <SurpriseButton className="btn btn-lg intro-surprise" />
        </div>
      </div>

      {/* Today, at a glance: the day's theme, the daily challenge and (on wide screens) the free promise. */}
      <div className="intro-side">
        <ThemeStrip embedded />
        <DailyCard variant="hero" />
        <FreeBanner mini />
      </div>

      <div className="intro-deco" aria-hidden="true">
        <Tri className="deco d1" fill="#b6e62c" />
        <Dot className="deco d2" fill="#ff4fc8" />
        <Star className="deco d3" fill="#ffc928" />
      </div>
    </section>
  );
}
