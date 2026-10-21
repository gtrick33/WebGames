import { useState } from 'react';
import { useT } from '../i18n';
import { useLiveCatalog } from '../platform/liveCatalog';
import type { GameEntry } from '../catalog/types';
import { track } from '../platform/analytics';
import { dayKey, formatCountdown, msUntilMidnight } from '../platform/dates';
import { streakState, sweepShare } from '../platform/engage';
import { SITE_URL } from '../platform/env';
import { useDaily, useNow } from '../platform/hooks';
import { shareOrCopy } from '../platform/share';
import { doneDays } from '../platform/save';
import { useSave } from '../platform/store';
import { Link } from '../router/router';
import { useFlagships } from '../platform/useFlagships';
import { DailyCard } from './DailyCard';
import { Icon } from './Icon';
import { ThemeStrip } from './ThemeStrip';
import './TodaysDailies.css';

/**
 * Every game's own daily puzzle in one strip, with what this player has finished today. Finishing
 * any of them (or the arcade challenge) keeps the shared streak alive. Hidden when no released game
 * has its own daily. `featured` is the home page's Today section: the day's theme on top, the daily
 * challenge as the big card, and the flagship dailies still open as chips.
 */
export function TodaysDailies({ headingLevel = 2, games: given, variant = 'full' }: { headingLevel?: 2 | 3; games?: GameEntry[]; variant?: 'full' | 'row' | 'featured' }) {
  const live = useLiveCatalog();
  // Games an admin paused are left out of today's list.
  const games = (given ?? live.games).filter((g) => !live.settings(g.slug).maintenance);
  const t = useT();
  const save = useSave();
  const now = useNow(1000);
  const today = dayKey(now);
  const [shareMsg, setShareMsg] = useState('');
  // Only the featured variant uses these; the hooks run every time so React sees the same order.
  const daily = useDaily(now);
  const flagships = useFlagships().list;
  const list = games.filter((g) => g.ownDaily && g.released <= today).sort((a, b) => a.title.localeCompare(b.title));
  if (list.length === 0) return null;
  const finished = new Set(save.gameDailies[today] ?? []);
  const doneCount = list.filter((g) => finished.has(g.slug)).length;
  const { streak, atRisk } = streakState(doneDays(save), today);
  const H = `h${headingLevel}` as const;
  const all = doneCount === list.length;
  // The Daily Sweep: an emoji row for chats, and a picture card with every game's tile ticked or not.
  const share = async (where: string): Promise<void> => {
    track('daily_share', { done: doneCount, where });
    const sweep = sweepShare({ day: today, games: list.map((g) => ({ emoji: g.emoji, done: finished.has(g.slug) })), streak, url: `${SITE_URL}/daily` });
    const tiles = list.map((g) => ({ src: g.art.tile, bg: g.art.bg, done: finished.has(g.slug) }));
    const outcome = await shareOrCopy({ title: sweep.title, text: sweep.text, url: `${SITE_URL}/daily`, card: { lines: sweep.cardLines, tiles, cta: t('Can you sweep them all?') } });
    setShareMsg(outcome === 'copied' ? t('Copied! Paste it anywhere.') : outcome === 'failed' ? t('Could not share from this browser.') : '');
  };

  const chip = (g: GameEntry) => {
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
  };

  // The home page's Today section: the theme as its header, the daily challenge as the big card, and
  // the flagship dailies this player has not done yet as chips. The rest are one link away on /daily.
  if (variant === 'featured') {
    const listed = new Set(list.map((g) => g.slug));
    const bandSlug = daily?.challenge.game.slug;
    const chips = flagships.map((f) => f.game).filter((g) => listed.has(g.slug) && !finished.has(g.slug) && g.slug !== bandSlug);
    return (
      <section className="wrap today-featured" aria-labelledby="today-title">
        <div className="today-head">
          <H id="today-title" className="today-title">
            {t('Today')}
          </H>
          <span className="mono today-meta">
            {t('{a} of {b} dailies done', { a: doneCount, b: list.length })}
            {streak > 0 && (
              <>
                {' · '}
                <Icon name="flame" size={14} /> {streak}
              </>
            )}
          </span>
          <span className="today-links">
            {doneCount > 0 && (
              <button className="today-share" onClick={() => void share('home')}>
                <Icon name="share" size={15} /> {t('Share today')}
              </button>
            )}
            <Link href="/daily" className="today-all">
              {t('All dailies')} <Icon name="arrowRight" size={16} />
            </Link>
          </span>
        </div>
        {shareMsg && (
          <p className="today-msg" role="status">
            {shareMsg}
          </p>
        )}
        <ThemeStrip embedded />
        <DailyCard variant="band" headingLevel={3} />
        {chips.length > 0 && (
          <div className="today-more">
            <p className="today-more-label mono">{t('Also waiting for you today')}</p>
            <ul className="today-list">{chips.map(chip)}</ul>
          </div>
        )}
      </section>
    );
  }

  // The one-line version: progress, streak, and every game's daily as a tappable icon.
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
          <span className="today-links">
            {doneCount > 0 && (
              <button className="today-share" onClick={() => void share('home')}>
                <Icon name="share" size={15} /> {t('Share today')}
              </button>
            )}
            <Link href="/daily" className="today-all">
              {t('All dailies')} <Icon name="arrowRight" size={16} />
            </Link>
          </span>
        </div>
        {shareMsg && (
          <p className="today-msg" role="status">
            {shareMsg}
          </p>
        )}
        <div className={`dailies-progress${all ? ' is-sweep' : ''}`} aria-hidden="true">
          <i style={{ width: `${(doneCount / list.length) * 100}%` }} />
        </div>
        <ul className="today-list">{list.map(chip)}</ul>
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
          <button className="btn btn-sm btn-primary" onClick={() => void share('daily')}>
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
