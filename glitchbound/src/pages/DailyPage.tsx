import { DailyCard } from '../components/DailyCard';
import { Icon } from '../components/Icon';
import { addDays } from '../platform/dates';
import { DAILY_HISTORY_DAYS, doneDays } from '../platform/save';
import { ThemeStrip } from '../components/ThemeStrip';
import { TodaysDailies } from '../components/TodaysDailies';
import { useDaily, useNow } from '../platform/hooks';
import { usePageMeta } from '../platform/meta';
import { useSave } from '../platform/store';
import { Link } from '../router/router';
import { getLang, useT } from '../i18n';
import './InfoPages.css';

export function DailyPage() {
  usePageMeta({
    title: 'Daily Challenge',
    description: 'One new GlitchBound challenge every day, the same for everyone. Clear it, keep your streak alive and share your result.',
    path: '/daily',
  });
  const t = useT();
  const now = useNow(60_000);
  const daily = useDaily(now);
  const save = useSave();

  if (!daily) {
    return (
      <div className="wrap info-page">
        <h1 className="info-title">{t('Daily Challenge')}</h1>
        <p className="info-lead">{t('There is no daily challenge right now. It returns as soon as a game that supports it is in the arcade.')}</p>
        <div className="nf-actions">
          <Link href="/#arcade" className="btn btn-primary">
            {t('Browse the arcade')}
          </Link>
        </div>
      </div>
    );
  }

  const days = Array.from({ length: 28 }, (_, i) => addDays(daily.today, i - 27));
  const done = doneDays(save);

  return (
    <div className="wrap info-page">
      <p className="eyebrow">
        <Icon name="calendar" size={16} /> {t('Every day at local midnight')}
      </p>
      <h1 className="info-title">{t('Daily Challenge')}</h1>
      <p className="info-lead">{t('One challenge a day, the same for everyone. Clear it in a single round, keep your streak alive, and share the result without spoiling anything.')}</p>

      <DailyCard variant="page" headingLevel={2} />

      <div className="daily-theme">
        <ThemeStrip embedded />
      </div>

      <TodaysDailies headingLevel={2} />

      <div className="info-cols">
        <section className="panel info-block" aria-labelledby="how-daily">
          <h2 id="how-daily">{t('How it works')}</h2>
          <ol className="info-steps">
            <li>{t('A new challenge unlocks at midnight in your time zone. Everyone on the same date gets the same one.')}</li>
            <li>{t('Play the game here on GlitchBound. Every finished round is a new try at today’s target.')}</li>
            <li>{t('Games with their own daily puzzle are listed under Today’s dailies. Only clearing the challenge keeps your streak going.')}</li>
            <li>{t('Play on consecutive days to build a streak. Miss a day and the streak starts over.')}</li>
            <li>{t('Progress is saved in this browser. Signed in, it is also saved to your account, so it follows you to every device.')}</li>
          </ol>
        </section>
        <section className="panel info-block" aria-labelledby="history-daily">
          <h2 id="history-daily">{t('Last 4 weeks')}</h2>
          <ol className="calendar" aria-label={t('Daily challenge history')}>
            {days.map((d) => {
              const rec = save.daily[d];
              const state = done.has(d) ? 'done' : rec ? 'tried' : 'none';
              const label = `${new Date(`${d}T12:00:00`).toLocaleDateString(getLang(), { month: 'short', day: 'numeric' })}: ${state === 'done' ? t('cleared') : state === 'tried' ? t('attempted') : t('not played')}`;
              return (
                <li key={d} className={`cal-day cal-${state}${d === daily.today ? ' cal-today' : ''}`} aria-label={label} title={label}>
                  {Number(d.slice(8))}
                </li>
              );
            })}
          </ol>
          <p className="info-small">
            {t('Streak')}: <b>{daily.streak}</b> · {t('History is kept for {n} days.', { n: DAILY_HISTORY_DAYS })}
          </p>
        </section>
      </div>
    </div>
  );
}
