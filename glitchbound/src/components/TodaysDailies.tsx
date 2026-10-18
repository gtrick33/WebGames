import { useState } from 'react';
import { GAMES } from '../catalog/games';
import type { GameEntry } from '../catalog/types';
import { track } from '../platform/analytics';
import { dayKey, formatCountdown, msUntilMidnight } from '../platform/dates';
import { streakState, sweepShareText } from '../platform/engage';
import { SITE_URL } from '../platform/env';
import { useNow } from '../platform/hooks';
import { shareOrCopy } from '../platform/share';
import { doneDays } from '../platform/save';
import { useSave } from '../platform/store';
import { Link } from '../router/router';
import { Icon } from './Icon';
import './TodaysDailies.css';

/**
 * Every game's own daily puzzle in one strip, with what this player has finished today. Finishing
 * any of them (or the arcade challenge) keeps the shared streak alive. Hidden when no released game
 * has its own daily.
 */
export function TodaysDailies({ headingLevel = 2, games = GAMES }: { headingLevel?: 2 | 3; games?: GameEntry[] }) {
  const save = useSave();
  const now = useNow(1000);
  const today = dayKey(now);
  const [shareMsg, setShareMsg] = useState('');
  const list = games.filter((g) => g.ownDaily && g.released <= today).sort((a, b) => a.title.localeCompare(b.title));
  if (list.length === 0) return null;
  const finished = new Set(save.gameDailies[today] ?? []);
  const doneCount = list.filter((g) => finished.has(g.slug)).length;
  const { streak, atRisk } = streakState(doneDays(save), today);
  const H = `h${headingLevel}` as const;
  const all = doneCount === list.length;
  const share = async (): Promise<void> => {
    track('daily_share', { done: doneCount });
    const text = sweepShareText({ day: today, games: list.map((g) => ({ title: g.title, done: finished.has(g.slug) })), streak, url: `${SITE_URL}/daily` });
    const outcome = await shareOrCopy({ title: 'GlitchBound dailies', text });
    setShareMsg(outcome === 'copied' ? 'Copied! Paste it anywhere.' : outcome === 'failed' ? 'Could not share from this browser.' : '');
  };

  return (
    <section className="dailies" aria-labelledby="dailies-title">
      <div className="dailies-head">
        <H id="dailies-title" className="dailies-title">
          Today&rsquo;s dailies
        </H>
        <p className="dailies-meta mono">
          {doneCount} of {list.length} done · <Icon name="flame" size={14} /> {streak} day streak
        </p>
      </div>
      <div className={`dailies-progress${all ? ' is-sweep' : ''}`} role="progressbar" aria-valuemin={0} aria-valuemax={list.length} aria-valuenow={doneCount} aria-label="Today's dailies done">
        <i style={{ width: `${(doneCount / list.length) * 100}%` }} />
      </div>
      {atRisk && (
        <p className="dailies-risk">
          <Icon name="flame" size={20} />
          <span>
            Keep your {streak}-day streak alive: finish any daily before midnight. <span className="mono">{formatCountdown(msUntilMidnight(now))}</span>
          </span>
        </p>
      )}
      {doneCount > 0 && (
        <div className="dailies-share">
          <p>
            {all ? (
              <>
                <b>Daily sweep!</b> Every daily done. New puzzles in <span className="mono">{formatCountdown(msUntilMidnight(now))}</span>
              </>
            ) : (
              <>
                {list.length - doneCount} still waiting for you today.
              </>
            )}
          </p>
          <button className="btn btn-sm btn-primary" onClick={() => void share()}>
            <Icon name="share" size={16} /> Share today
          </button>
          {shareMsg && (
            <span className="info-small" role="status">
              {shareMsg}
            </span>
          )}
        </div>
      )}
      <ul className="dailies-list">
        {list.map((g) => {
          const done = finished.has(g.slug);
          return (
            <li key={g.slug}>
              <Link href={`/games/${g.slug}`} className={`daily-chip${done ? ' is-done' : ''}`} data-accent={g.accent}>
                <img src={g.art.tile} alt="" width={56} height={56} loading="lazy" style={{ background: g.art.bg }} />
                <span className="daily-chip-text">
                  <strong>{g.title}</strong>
                  <span>{g.ownDaily!.label}</span>
                </span>
                <span className="daily-chip-state mono">{done ? 'Done' : 'Play'}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
