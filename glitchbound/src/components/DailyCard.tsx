import { useState } from 'react';
import { track } from '../platform/analytics';
import { dailyShareText, fmt } from '../platform/daily';
import { formatCountdown, msUntilMidnight } from '../platform/dates';
import { SITE_URL } from '../platform/env';
import { useDaily, useNow } from '../platform/hooks';
import { shareOrCopy } from '../platform/share';
import { Link } from '../router/router';
import { Icon } from './Icon';
import { Star } from './Shapes';
import './DailyCard.css';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/**
 * The daily challenge, in three densities: `band` (homepage), `page` (/daily) and `compact` (game page).
 * Renders nothing if no game in the catalog supports daily challenges.
 */
export function DailyCard({ variant = 'band', headingLevel = 2 }: { variant?: 'band' | 'page' | 'compact'; headingLevel?: 2 | 3 }) {
  const now = useNow(1000);
  const daily = useDaily(now);
  const [shareMsg, setShareMsg] = useState('');
  if (!daily) return null;
  const { challenge: c, best, done, streak, week } = daily;
  const unit = c.unit ? ` ${c.unit}` : '';
  const progress = Math.min(1, best / c.target);
  const H = `h${headingLevel}` as const;
  const weekLabels = week.map((_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (6 - i));
    return WEEKDAYS[(d.getDay() + 6) % 7]!;
  });

  const share = async (): Promise<void> => {
    track('share_click', { what: 'daily', day: c.number });
    const outcome = await shareOrCopy({
      title: `GlitchBound Daily #${c.number}`,
      text: dailyShareText(c, best, streak, week, `${SITE_URL}/daily`),
    });
    setShareMsg(outcome === 'copied' ? 'Result copied. Paste it anywhere.' : outcome === 'shared' ? 'Shared!' : outcome === 'failed' ? 'Could not share from this browser.' : '');
  };

  return (
    <section className={`daily daily-${variant}${done ? ' is-done' : ''}`} aria-labelledby={`daily-title-${variant}`}>
      <div className="daily-badge" aria-hidden="true">
        <Star className="daily-star" fill={done ? '#ffffff' : '#ffd12e'} />
        <span className="daily-badge-text">
          <span className="mono">Daily</span>
          <b>#{c.number}</b>
        </span>
      </div>

      <div className="daily-main">
        <p className="eyebrow">
          <Icon name="calendar" size={16} /> Today&rsquo;s challenge · {c.game.title}
        </p>
        <H id={`daily-title-${variant}`} className="daily-title">
          {c.label}.
        </H>
        <div className="daily-progress" role="group" aria-label="Your progress today">
          <div className="daily-bar" aria-hidden="true">
            <i style={{ width: `${progress * 100}%` }} />
          </div>
          <p className="mono daily-numbers">
            {best > 0 ? (
              <>
                Best today {fmt(best)}
                {unit} / {fmt(c.target)}
                {unit}
              </>
            ) : (
              <>Not attempted yet · target {fmt(c.target)}{unit}</>
            )}
          </p>
        </div>
      </div>

      <div className="daily-side">
        {done ? (
          <p className="daily-state daily-state-done">
            <Icon name="check" size={22} /> Cleared
          </p>
        ) : (
          <p className="daily-state">{best > 0 ? 'Keep going' : 'Up for grabs'}</p>
        )}
        <div className="daily-streak" aria-label={`Streak: ${streak} ${streak === 1 ? 'day' : 'days'}. Last 7 days: ${week.filter(Boolean).length} cleared.`}>
          <span className="daily-streak-n">
            <Icon name="flame" size={18} /> {streak} day streak
          </span>
          <span className="daily-week" aria-hidden="true">
            {week.map((d, i) => (
              <span key={i} className={`daily-day${d ? ' on' : ''}${i === 6 ? ' today' : ''}`}>
                {weekLabels[i]}
              </span>
            ))}
          </span>
        </div>
        <p className="daily-countdown mono" aria-live="off">
          Next challenge in <time>{formatCountdown(msUntilMidnight(now))}</time>
        </p>
        <div className="daily-actions">
          {variant !== 'compact' && (
            <Link href={`/games/${c.game.slug}`} className={`btn ${done ? '' : 'btn-ink'}`}>
              <Icon name="play" /> {done ? 'Play again' : 'Play today’s challenge'}
            </Link>
          )}
          {done && (
            <button className="btn btn-lime" onClick={() => void share()}>
              <Icon name="share" /> Share result
            </button>
          )}
        </div>
        <p className="daily-share-msg" role="status">
          {shareMsg}
        </p>
      </div>
    </section>
  );
}
