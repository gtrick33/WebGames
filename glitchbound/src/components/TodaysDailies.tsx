import { GAMES } from '../catalog/games';
import type { GameEntry } from '../catalog/types';
import { currentStreak } from '../platform/daily';
import { dayKey } from '../platform/dates';
import { useNow } from '../platform/hooks';
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
  const today = dayKey(useNow(60_000));
  const list = games.filter((g) => g.ownDaily && g.released <= today).sort((a, b) => a.title.localeCompare(b.title));
  if (list.length === 0) return null;
  const finished = new Set(save.gameDailies[today] ?? []);
  const doneCount = list.filter((g) => finished.has(g.slug)).length;
  const streak = currentStreak(doneDays(save), today);
  const H = `h${headingLevel}` as const;

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
