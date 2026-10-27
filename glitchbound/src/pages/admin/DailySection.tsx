import { useMemo, useState } from 'react';
import { GAMES } from '../../catalog/games';
import { dailyRules, type DailyPick } from '../../catalog/settings';
import type { AdminCatalog } from '../../platform/apiTypes';
import { challengeForDay, fmt } from '../../platform/daily';
import { addDays, dayKey } from '../../platform/dates';
import type { Send } from './useAdminCatalog';

const dayLabel = (d: string, today: string): string =>
  d === today ? 'Today' : d === addDays(today, 1) ? 'Tomorrow' : new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

/** Admin › Daily challenges: the next 14 days of the arcade's daily challenge, each one can be hand-picked. */
export function DailyPlanner({ data, send, busy }: { data: AdminCatalog; send: Send; busy: boolean }) {
  const today = dayKey();
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));
  const rules = useMemo(() => dailyRules(data), [data]);
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <section className="panel info-block" aria-labelledby="ag-daily">
      <h2 id="ag-daily">Today’s challenge · next 14 days</h2>
      <p className="info-small">
        The arcade’s daily challenge rotates automatically through games that have one. Pick a game (and optionally the goal) for any day; hidden, paused or excluded games are skipped by the rotation.
      </p>
      <ul className="ag-days">
        {days.map((d) => {
          const c = challengeForDay(d, GAMES, rules);
          const pick = data.picks[d];
          return (
            <li key={d} className={pick ? 'is-picked' : ''}>
              <div className="ag-day-row">
                <span className="ag-day mono">{dayLabel(d, today)}</span>
                <span className="ag-day-game">
                  {c ? (
                    <>
                      <b>{c.game.title}</b> · {c.label}
                    </>
                  ) : (
                    'No challenge'
                  )}
                </span>
                {pick && <span className="ag-chip is-on">Hand-picked</span>}
                <button className="btn btn-sm" onClick={() => setEditing(editing === d ? null : d)} aria-expanded={editing === d}>
                  {editing === d ? 'Close' : 'Change'}
                </button>
              </div>
              {editing === d && <DailyEditor day={d} current={c?.game.slug ?? ''} pick={pick} send={send} busy={busy} onDone={() => setEditing(null)} />}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function DailyEditor({ day, current, pick, send, busy, onDone }: { day: string; current: string; pick: DailyPick | undefined; send: Send; busy: boolean; onDone: () => void }) {
  const choices = GAMES.filter((g) => g.daily?.length);
  const [slug, setSlug] = useState(pick?.slug ?? current ?? choices[0]?.slug ?? '');
  const game = choices.find((g) => g.slug === slug);
  const [template, setTemplate] = useState<number | null>(pick?.template ?? null);
  const [target, setTarget] = useState(pick?.target ? String(pick.target) : '');
  const tpl = game && template !== null ? game.daily![template] : undefined;
  return (
    <form
      className="ag-form ag-sub"
      onSubmit={(e) => {
        e.preventDefault();
        const t = Number(target);
        void send({ action: 'daily', day, pick: { slug, template, target: target && t > 0 ? t : null } }, 'Daily challenge set').then((ok) => ok && onDone());
      }}
    >
      <label className="ag-field">
        <span>Game</span>
        <select
          className="field"
          value={slug}
          onChange={(e) => {
            setSlug(e.target.value);
            setTemplate(null);
            setTarget('');
          }}
        >
          {choices.map((g) => (
            <option key={g.slug} value={g.slug}>
              {g.title}
            </option>
          ))}
        </select>
      </label>
      <label className="ag-field">
        <span>Goal</span>
        <select className="field" value={template ?? ''} onChange={(e) => setTemplate(e.target.value === '' ? null : Number(e.target.value))}>
          <option value="">Automatic</option>
          {game?.daily?.map((d, i) => (
            <option key={i} value={i}>
              {d.label.replace('{n}', '…')}
            </option>
          ))}
        </select>
      </label>
      <label className="ag-field">
        <span>Target (optional)</span>
        <input className="field" type="number" min={1} step="any" value={target} onChange={(e) => setTarget(e.target.value)} placeholder={tpl ? `e.g. ${fmt(tpl.targets[0]!)}` : 'Automatic'} />
      </label>
      <div className="reset-row ag-wide">
        <button className="btn btn-sm btn-primary" disabled={busy || !slug}>
          Save for {day}
        </button>
        {pick && (
          <button type="button" className="btn btn-sm btn-ghost" disabled={busy} onClick={() => void send({ action: 'daily', day, pick: null }, 'Back to automatic').then((ok) => ok && onDone())}>
            Use automatic
          </button>
        )}
      </div>
    </form>
  );
}
