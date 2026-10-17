import { useEffect, useState } from 'react';
import { GAMES } from '../catalog/games';
import { useAccount } from '../platform/account';
import { useDaily, useNow } from '../platform/hooks';
import { formatCountdown, msUntilMidnight } from '../platform/dates';
import { Link } from '../router/router';
import { Icon } from './Icon';
import { Dot, Star, Tri } from './Shapes';
import { openSignIn } from './SignIn';
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
 * The compact intro above the catalogue: brand line on the left, today's status on the right
 * (daily challenge + member level or a sign-in invite). Short on purpose: the games come first.
 */
export function Hero() {
  const glitching = useGlitchPulse();
  const now = useNow(1000);
  const daily = useDaily(now);
  const { me, status } = useAccount();
  const ready = me?.quests.filter((q) => q.done && !q.claimed).length ?? 0;

  return (
    <section className="intro-band wrap" aria-labelledby="hero-title">
      <div className="intro-copy">
        <p className="eyebrow">
          <span className="live-dot" /> Independent browser arcade · {GAMES.length} {GAMES.length === 1 ? 'game' : 'games'}
        </p>
        <h1 id="hero-title" className="intro-title">
          One more round.{' '}
          <span className={`glitch intro-hl${glitching ? ' is-glitching' : ''}`} data-text="Then another.">
            Then another.
          </span>
        </h1>
        <p className="intro-sub">Small, sharp games that start in a second. No installs. Pick a cabinet and press play.</p>
      </div>

      <div className="intro-side">
        {daily && (
          <Link href="/daily" className={`intro-card intro-daily${daily.done ? ' is-done' : ''}`}>
            <span className="intro-card-icon">
              <Icon name="calendar" size={20} />
            </span>
            <span className="intro-card-text">
              <span className="mono">Daily #{daily.challenge.number}{daily.done ? ' · cleared' : ''}</span>
              <strong>{daily.challenge.label}</strong>
              <span className="mono intro-count">Resets in {formatCountdown(msUntilMidnight(now))}</span>
            </span>
            <Icon name="arrowRight" />
          </Link>
        )}
        {me ? (
          <Link href="/me" className="intro-card intro-member">
            <span className="intro-card-icon">
              <Icon name="bolt" size={20} />
            </span>
            <span className="intro-card-text">
              <span className="mono">Level {me.level} · {me.nickname}</span>
              <strong>{ready > 0 ? `${ready} quest ${ready === 1 ? 'reward' : 'rewards'} ready` : `${me.quests.filter((q) => !q.done).length} member quests today`}</strong>
            </span>
            <Icon name="arrowRight" />
          </Link>
        ) : (
          <button className="intro-card intro-member" onClick={() => openSignIn()} disabled={status === 'loading'}>
            <span className="intro-card-icon">
              <Icon name="star" size={20} />
            </span>
            <span className="intro-card-text">
              <span className="mono">Free membership</span>
              <strong>Daily quests, levels and leaderboards</strong>
            </span>
            <Icon name="arrowRight" />
          </button>
        )}
      </div>

      <div className="intro-deco" aria-hidden="true">
        <Tri className="deco d1" fill="#c4f034" />
        <Dot className="deco d2" fill="#ff3fd2" />
        <Star className="deco d3" fill="#22e4ff" />
      </div>
    </section>
  );
}
