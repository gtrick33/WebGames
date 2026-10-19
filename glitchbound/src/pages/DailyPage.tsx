import { DailyCard } from '../components/DailyCard';
import { Icon } from '../components/Icon';
import { addDays } from '../platform/dates';
import { DAILY_HISTORY_DAYS, doneDays } from '../platform/save';
import { TodaysDailies } from '../components/TodaysDailies';
import { useDaily, useNow } from '../platform/hooks';
import { usePageMeta } from '../platform/meta';
import { useSave } from '../platform/store';
import { Link } from '../router/router';
import './InfoPages.css';

export function DailyPage() {
  usePageMeta({
    title: 'Daily Challenge',
    description: 'One new GlitchBound challenge every day, the same for everyone. Clear it, keep your streak alive and share your result.',
    path: '/daily',
  });
  const now = useNow(60_000);
  const daily = useDaily(now);
  const save = useSave();

  if (!daily) {
    return (
      <div className="wrap info-page">
        <h1 className="info-title">Daily Challenge</h1>
        <p className="info-lead">There is no daily challenge right now. It returns as soon as a game that supports it is in the arcade.</p>
        <div className="nf-actions">
          <Link href="/#arcade" className="btn btn-primary">
            Browse the arcade
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
        <Icon name="calendar" size={16} /> Every day at local midnight
      </p>
      <h1 className="info-title">Daily Challenge</h1>
      <p className="info-lead">One challenge a day, the same for everyone. Clear it in a single round, keep your streak alive, and share the result without spoiling anything.</p>

      <DailyCard variant="page" headingLevel={2} />

      <TodaysDailies headingLevel={2} />

      <div className="info-cols">
        <section className="panel info-block" aria-labelledby="how-daily">
          <h2 id="how-daily">How it works</h2>
          <ol className="info-steps">
            <li>A new challenge unlocks at midnight in your time zone. Everyone on the same date gets the same one.</li>
            <li>Play the game here on GlitchBound. Every finished round is a new try at today&rsquo;s target.</li>
            <li>Games with their own daily puzzle are listed under Today&rsquo;s dailies. Finishing any of them, or clearing the challenge, keeps your streak going.</li>
            <li>Play on consecutive days to build a streak. Miss a day and the streak starts over.</li>
            <li>Progress is saved in this browser. If you are signed in, cleared challenges are also saved to your account.</li>
          </ol>
        </section>
        <section className="panel info-block" aria-labelledby="history-daily">
          <h2 id="history-daily">Last 4 weeks</h2>
          <ol className="calendar" aria-label="Daily challenge history">
            {days.map((d) => {
              const rec = save.daily[d];
              const state = done.has(d) ? 'done' : rec ? 'tried' : 'none';
              const label = `${new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: ${state === 'done' ? 'cleared' : state === 'tried' ? 'attempted' : 'not played'}`;
              return (
                <li key={d} className={`cal-day cal-${state}${d === daily.today ? ' cal-today' : ''}`} aria-label={label} title={label}>
                  {Number(d.slice(8))}
                </li>
              );
            })}
          </ol>
          <p className="info-small">
            Streak: <b>{daily.streak}</b> · History is kept for {DAILY_HISTORY_DAYS} days.
          </p>
        </section>
      </div>
    </div>
  );
}
