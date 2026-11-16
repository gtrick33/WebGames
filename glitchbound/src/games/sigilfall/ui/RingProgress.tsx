import { useState } from 'react';
import { ABILITIES } from '../arena/abilities';
import { rankOf } from '../arena/ranks';
import { CHALLENGE_TITLES, dailyOf, dayEnds, dayKey, MASTERY_STEPS, masteryWins, seasonEnds, seasonOf, weekEnds, weekKey, weeklyOf, type Challenge, type ChallengeRun, type RingRecord } from '../arena/record';
import { CLASSES, CLASS_IDS } from '../data/classes';
import { classEmblem } from './classEmblem';

/**
 * The Ring's record, behind one link on the main screen (the owner: "make sure the UI on the main menu is still clear
 * for newcomers and is not overloaded with info"): the day's and the week's challenges, class mastery, the season and
 * the last matches, each on its own tab of one window.
 */

type Tab = 'challenges' | 'mastery' | 'season' | 'history';

/** How long until a time, in a few words ("5h 12m", "3 days"). */
export function until(at: number, now: number): string {
  const ms = Math.max(0, at - now);
  const h = Math.floor(ms / 3_600_000);
  if (h >= 48) return `${Math.floor(h / 24)} days`;
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** How many of today's and this week's challenges are done, out of how many. */
export function challengeCount(rec: RingRecord, now: number): { done: number; of: number } {
  const day = dailyOf(now);
  const week = weeklyOf(now);
  const d = rec.daily?.key === dayKey(now) ? day.filter((c) => rec.daily!.done.includes(c.id)).length : 0;
  const w = rec.weekly?.key === weekKey(now) ? week.filter((c) => rec.weekly!.done.includes(c.id)).length : 0;
  return { done: d + w, of: day.length + week.length };
}

/** The link on the main screen: one line, with how many of the challenges are done. */
export function ProgressLink({ record, onOpen }: { record: RingRecord; onOpen: () => void }) {
  const now = Date.now();
  const { done, of } = challengeCount(record, now);
  return (
    <button className="rb-linkbtn rb-pg-link" onClick={onOpen}>
      Progress <small>{done}/{of} challenges</small>
    </button>
  );
}

function Bar({ got, goal }: { got: number; goal: number }) {
  return (
    <span className="rb-pg-bar">
      <i style={{ width: `${Math.min(100, (got / goal) * 100)}%` }} />
    </span>
  );
}

function ChallengeList({ title, list, run, ends, now }: { title: string; list: Challenge[]; run: ChallengeRun | undefined; ends: number; now: number }) {
  return (
    <section className="rb-pg-block">
      <h3>
        {title} <small>new ones in {until(ends, now)}</small>
      </h3>
      <ul className="rb-pg-list">
        {list.map((c) => {
          const done = !!run?.done.includes(c.id);
          const got = done ? c.goal : Math.min(c.goal, run?.got[c.id] ?? 0);
          return (
            <li key={c.id} className={done ? 'is-done' : ''}>
              <span>{c.text}</span>
              <Bar got={got} goal={c.goal} />
              <em>{done ? 'Done' : `${got.toLocaleString('en-US')}/${c.goal.toLocaleString('en-US')}`}</em>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function ProgressDialog({ record, onClose }: { record: RingRecord; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('challenges');
  const now = Date.now();
  const daily = record.daily?.key === dayKey(now) ? record.daily : undefined;
  const weekly = record.weekly?.key === weekKey(now) ? record.weekly : undefined;
  const finished = record.finished ?? 0;
  const nextTitle = CHALLENGE_TITLES.find((t) => finished < t.finished);
  const season = record.season?.n === seasonOf(now) ? record.season : undefined;
  const n = seasonOf(now);
  return (
    <div className="rb-ring-dialog-wrap" role="dialog" aria-label="Progress" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="rb-ring-dialog rb-pg-dialog">
        <h2>Progress</h2>
        <div className="rb-pg-tabs" role="tablist" aria-label="Progress">
          {(['challenges', 'mastery', 'season', 'history'] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} className={`rb-pg-tab${tab === t ? ' is-on' : ''}`} onClick={() => setTab(t)}>
              {t === 'challenges' ? 'Challenges' : t === 'mastery' ? 'Mastery' : t === 'season' ? 'Season' : 'History'}
            </button>
          ))}
        </div>
        <div className="rb-pg-body" role="tabpanel">
          {tab === 'challenges' && (
            <>
              <ChallengeList title="Today" list={dailyOf(now)} run={daily} ends={dayEnds(now)} now={now} />
              <ChallengeList title="This week" list={weeklyOf(now)} run={weekly} ends={weekEnds(now)} now={now} />
              <p className="rb-pg-note">
                Rated matches count. {finished} finished in all{nextTitle ? `: ${nextTitle.finished} gives the title ${nextTitle.name}.` : '. Every challenge title is yours.'}
              </p>
            </>
          )}
          {tab === 'mastery' && (
            <>
              <p className="rb-pg-note">Rated wins with each class. {MASTERY_STEPS.map((s) => `${s.wins} gives its ${s.word} title`).join(', ')}.</p>
              <ul className="rb-pg-mastery">
                {CLASS_IDS.map((cls) => {
                  const wins = masteryWins(record, cls);
                  const next = MASTERY_STEPS.find((s) => wins < s.wins);
                  const prev = [...MASTERY_STEPS].reverse().find((s) => wins >= s.wins);
                  return (
                    <li key={cls} style={{ ['--c' as string]: CLASSES[cls].colors.accent }}>
                      <img src={classEmblem(cls)} alt="" draggable={false} />
                      <span>
                        <b>{CLASSES[cls].name}</b>
                        <small>{prev ? `${CLASSES[cls].name} ${prev.word}` : `${wins} win${wins === 1 ? '' : 's'}`}</small>
                      </span>
                      {next ? <Bar got={wins} goal={next.wins} /> : <span className="rb-pg-bar is-full" />}
                      <em>{next ? `${wins}/${next.wins}` : 'Mastered'}</em>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          {tab === 'season' && (
            <>
              <section className="rb-pg-block">
                <h3>
                  Season {n} <small>ends in {until(seasonEnds(n), now)}</small>
                </h3>
                <p className="rb-pg-note">When a season ends, every rating comes halfway back toward 1000 for a new climb. Your best ever, and every title and armor it earned, stay yours.</p>
                <ul className="rb-pg-list">
                  {(['1', '2', '3'] as const).map((f) => {
                    const best = season?.best[f];
                    return (
                      <li key={f}>
                        <span>
                          {f}v{f}
                        </span>
                        <em>{best ? `${best}, ${rankOf(best).name}` : 'Not played yet'}</em>
                      </li>
                    );
                  })}
                </ul>
              </section>
              {!!record.season?.past.length && (
                <section className="rb-pg-block">
                  <h3>Seasons gone by</h3>
                  <ul className="rb-pg-list">
                    {record.season.past.map((p) => (
                      <li key={p.n}>
                        <span>Season {p.n}</span>
                        <em>
                          {(['1', '2', '3'] as const)
                            .filter((f) => p.best[f])
                            .map((f) => `${f}v${f} ${p.best[f]}`)
                            .join(' · ') || 'No rated matches'}
                        </em>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
          {tab === 'history' &&
            (record.history?.length ? (
              <ul className="rb-pg-history">
                {record.history.map((h) => {
                  const best = h.best ? ABILITIES[h.best.ab] : undefined;
                  return (
                    <li key={h.at} className={h.draw ? 'is-draw' : h.won ? 'is-win' : 'is-loss'}>
                      <b>{h.draw ? 'Draw' : h.won ? 'Win' : 'Loss'}</b>
                      <span>
                        {CLASSES[h.cls]?.name ?? h.cls} · {h.format}v{h.format}
                        {h.rival ? ` · ${h.rival}` : ''}
                        <small>
                          {h.dmg.toLocaleString('en-US')} damage · {h.heal.toLocaleString('en-US')} healing · {h.combos} combos
                          {best && h.best ? ` · best: ${h.best.combo ?? best.name} ${h.best.n}` : ''}
                        </small>
                      </span>
                      <em>{h.change === null ? 'Friendly' : `${h.change > 0 ? '+' : h.change < 0 ? '−' : ''}${Math.abs(h.change)}`}</em>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="rb-pg-note">No matches yet. Your last twenty show here.</p>
            ))}
        </div>
        <div className="rb-vigil-actions">
          <button className="rb-btn is-gold" onClick={onClose} autoFocus>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
