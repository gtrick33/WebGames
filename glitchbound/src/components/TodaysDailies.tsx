import { useState } from 'react';
import { useT } from '../i18n';
import { useLiveCatalog } from '../platform/liveCatalog';
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
export function TodaysDailies({ headingLevel = 2, games: given, variant = 'full' }: { headingLevel?: 2 | 3; games?: GameEntry[]; variant?: 'full' | 'row' }) {
  const live = useLiveCatalog();
  // Games an admin paused are left out of today's list.
  const games = (given ?? live.games).filter((g) => !live.settings(g.slug).maintenance);
  const t = useT();
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
    setShareMsg(outcome === 'copied' ? t('Copied! Paste it anywhere.') : outcome === 'failed' ? t('Could not share from this browser.') : '');
  };

  // The home page's one-line version: progress, streak, and every game's daily as a tappable icon.
  if (variant === 'row')
    return (
      <section className="wrap today-row" aria-labelledby="today-title">
        <div className="today-head">
          <H id="today-title" className="today-title">
            {t('Today’s dailies')}
          </H>
          <span className="mono today-meta">
            {t('{a} of {b} done', { a: doneCount, b: list.length })}
            {streak > 0 && (
              <>
                {' · '}
                <Icon name="flame" size={14} /> {streak}
              </>
            )}
          </span>
          <Link href="/daily" className="today-all">
            {t('All dailies')} <Icon name="arrowRight" size={16} />
          </Link>
        </div>
        <div className={`dailies-progress${all ? ' is-sweep' : ''}`} aria-hidden="true">
          <i style={{ width: `${(doneCount / list.length) * 100}%` }} />
        </div>
        <ul className="today-list">
          {list.map((g) => {
            const done = finished.has(g.slug);
            return (
              <li key={g.slug}>
                <Link href={`/games/${g.slug}`} className={`today-chip${done ? ' is-done' : ''}`} data-accent={g.accent} title={`${g.title}: ${t(g.ownDaily!.label)}`}>
                  <span className="today-icon">
                    <img src={g.art.tile} alt="" width={60} height={60} loading="lazy" style={{ background: g.art.bg }} />
                    {done && (
                      <span className="today-check" aria-hidden="true">
                        ✓
                      </span>
                    )}
                  </span>
                  <span className="today-name">{g.title}</span>
                  <span className="sr-only">{done ? t('Done') : t('Play')}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    );

  return (
    <section className="dailies" aria-labelledby="dailies-title">
      <div className="dailies-head">
        <H id="dailies-title" className="dailies-title">
          {t('Today’s dailies')}
        </H>
        <p className="dailies-meta mono">
          {t('{a} of {b} done', { a: doneCount, b: list.length })} · <Icon name="flame" size={14} /> {t('{n} day streak', { n: streak })}
        </p>
      </div>
      <div className={`dailies-progress${all ? ' is-sweep' : ''}`} role="progressbar" aria-valuemin={0} aria-valuemax={list.length} aria-valuenow={doneCount} aria-label={t('Today’s dailies done')}>
        <i style={{ width: `${(doneCount / list.length) * 100}%` }} />
      </div>
      {atRisk && (
        <p className="dailies-risk">
          <Icon name="flame" size={20} />
          <span>
            {t('Keep your {n}-day streak alive: finish any daily before midnight.', { n: streak })} <span className="mono">{formatCountdown(msUntilMidnight(now))}</span>
          </span>
        </p>
      )}
      {doneCount > 0 && (
        <div className="dailies-share">
          <p>
            {all ? (
              <>
                <b>{t('Daily sweep!')}</b> {t('Every daily done. New puzzles in')} <span className="mono">{formatCountdown(msUntilMidnight(now))}</span>
              </>
            ) : (
              <>
                {t('{n} still waiting for you today.', { n: list.length - doneCount })}
              </>
            )}
          </p>
          <button className="btn btn-sm btn-primary" onClick={() => void share()}>
            <Icon name="share" size={16} /> {t('Share today')}
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
                  <span>{t(g.ownDaily!.label)}</span>
                </span>
                <span className="daily-chip-state mono">{done ? t('Done') : t('Play')}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
