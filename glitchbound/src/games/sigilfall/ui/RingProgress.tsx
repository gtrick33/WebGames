import { useState, type ReactNode } from 'react';
import { ABILITIES } from '../arena/abilities';
import { rankOf } from '../arena/ranks';
import { RING_REWARDS } from '../arena/rewards';
import { CHALLENGE_TITLES, dailyOf, dayEnds, dayKey, frameOf, MASTERY_STEPS, masteryWins, seasonEnds, seasonOf, TRACK_POINTS, trackOf, trackPlace, weekEnds, weekKey, weeklyOf, type Challenge, type ChallengeRun, type RingRecord, type TrackReward } from '../arena/record';
import { CLASSES, CLASS_IDS } from '../data/classes';
import { classEmblem } from './classEmblem';
import { iconPicture } from '../render/art/gameIcons';

/**
 * The Ring's record, behind one link on the main screen (the owner: "make sure the UI on the main menu is still clear
 * for newcomers and is not overloaded with info"): the day's and the week's challenges, class mastery, the season and
 * the last matches, each on its own tab of one window.
 */

export type ProgressTab = 'challenges' | 'mastery' | 'season' | 'history';
type Tab = ProgressTab;

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

/** A challenge as it stands: how far along, and whether it is done. */
const standOf = (c: Challenge, run: ChallengeRun | undefined): { got: number; done: boolean } => {
  const done = !!run?.done.includes(c.id);
  return { done, got: done ? c.goal : Math.min(c.goal, run?.got[c.id] ?? 0) };
};
const n = (x: number): string => x.toLocaleString('en-US');

/**
 * The strip on the main screen, made as the rewards' strip beside it is: today's three challenges as pips, the next one
 * to do and how far along it is, and the way into the rest. ("Progress 2/6 challenges" stays its name for a reader.)
 */
export function ProgressLink({ record, onOpen }: { record: RingRecord; onOpen: () => void }) {
  // (the time as the lobby was opened: the count is read again with each match the record keeps)
  const [now] = useState(() => Date.now());
  const { done, of } = challengeCount(record, now);
  const run = record.daily?.key === dayKey(now) ? record.daily : undefined;
  const today = dailyOf(now);
  const next = today.find((c) => !standOf(c, run).done);
  return (
    <button className="rb-rw-strip rb-pg-strip" onClick={onOpen} aria-label={`Progress ${done}/${of} challenges`} data-tut="progress">
      <span className="rb-pg-seal" aria-hidden="true">
        <img src={iconPicture(next?.icon ?? 'scholar_scroll_on_violet')} alt="" draggable={false} />
      </span>
      <span className="rb-rw-next">
        {next ? (
          <>
            <b>{next.text}</b>
            <small>
              {n(standOf(next, run).got)}/{n(next.goal)} · +{TRACK_POINTS.daily} season points
            </small>
          </>
        ) : (
          <>
            <b>Today’s challenges done</b>
            <small>New ones in {until(dayEnds(now), now)}</small>
          </>
        )}
      </span>
      <span className="rb-pg-pips" aria-hidden="true">
        {today.map((c) => (
          <i key={c.id} className={standOf(c, run).done ? 'is-on' : ''} />
        ))}
      </span>
      <span className="rb-rw-more">Progress</span>
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

function ChallengeList({ title, list, run, ends, now, worth }: { title: string; list: Challenge[]; run: ChallengeRun | undefined; ends: number; now: number; worth: number }) {
  const all = list.filter((c) => standOf(c, run).done).length;
  return (
    <section className="rb-pg-block">
      <h3 className="rb-pg-head">
        <span>{title}</span>
        <i aria-hidden="true" />
        <small>
          {all}/{list.length} · new in {until(ends, now)}
        </small>
      </h3>
      <ul className="rb-pg-cards">
        {list.map((c) => {
          const { got, done } = standOf(c, run);
          return (
            <li key={c.id} className={`rb-pg-card${done ? ' is-done' : ''}`}>
              <span className="rb-pg-icon">
                <img src={iconPicture(c.icon)} alt="" draggable={false} />
                {done && <b aria-hidden="true">✓</b>}
              </span>
              <span className="rb-pg-what">
                <strong>
                  {c.text}
                  <span className="rb-pg-worth">+{worth}</span>
                </strong>
                <Bar got={got} goal={c.goal} />
              </span>
              <em>{done ? 'Done' : `${n(got)}/${n(c.goal)}`}</em>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** A tier won (filled) or still to win, as the rewards' diamonds. */
function Tiers({ wins }: { wins: number }) {
  return (
    <span className="rb-pg-tiers" aria-hidden="true">
      {MASTERY_STEPS.map((s) => (
        <i key={s.wins} className={wins >= s.wins ? 'is-on' : ''} title={s.word} />
      ))}
    </span>
  );
}

/** A reward's look on the track: a frame as a small nameplate in its colors, a title as a scroll mark. */
function RewardMark({ reward }: { reward: TrackReward }) {
  const fr = reward.kind === 'frame' ? frameOf(reward.id.slice(6)) : null;
  return fr ? (
    <span className="rb-rw-frame has-frame rb-pg-reward" style={{ ['--f1' as string]: fr.colors[0], ['--f2' as string]: fr.colors[1] }} aria-hidden="true" />
  ) : (
    <span className="rb-pg-reward is-title" aria-hidden="true">
      <img src={iconPicture('scholar_scroll_on_violet')} alt="" draggable={false} />
    </span>
  );
}

/**
 * The season's track (the owner chose it as what the challenges give): its points, a road through its ten tiers with a
 * stone at each, the next reward and how far it is, and the ten rewards, each earned or still to come.
 */
export function SeasonTrack({ points, n: sn, now, earned }: { points: number; n: number; now: number; earned: readonly string[] }) {
  const track = trackOf(sn);
  const { tier, next } = trackPlace(points, sn);
  const top = track[track.length - 1]!.at;
  return (
    <section className="rb-pg-season rb-pg-track">
      <strong>Season {sn} track</strong>
      <small>
        {n(points)} points · tier {tier} of {track.length} · ends in {until(seasonEnds(sn), now)}
      </small>
      <div className="rb-pg-road" aria-hidden="true">
        <i style={{ width: `${Math.min(100, (points / top) * 100)}%` }} />
        {track.map((t, k) => (
          <b key={t.at} className={points >= t.at ? 'is-on' : ''} data-n={k + 1} style={{ left: `${(t.at / top) * 100}%` }} />
        ))}
      </div>
      {next ? (
        <p className="rb-pg-next">
          <RewardMark reward={next.reward} />
          <span>
            Next: <b>{next.reward.name}</b> in {n(next.at - points)} points
          </span>
        </p>
      ) : (
        <p className="rb-pg-next">Every reward this season is yours.</p>
      )}
      <ol className="rb-pg-tiers-list">
        {track.map((t, k) => {
          const has = earned.includes(t.reward.id) || points >= t.at;
          return (
            <li key={t.at} className={has ? 'is-on' : ''}>
              <span className="rb-pg-tier-n">{k + 1}</span>
              <RewardMark reward={t.reward} />
              <span className="rb-pg-tier-what" title={t.reward.name}>{t.reward.name}</span>
              <em>{has ? 'Earned' : `${n(t.at)} pts`}</em>
            </li>
          );
        })}
      </ol>
      <p className="rb-pg-note">
        A day’s challenge is worth {TRACK_POINTS.daily} points, a week’s {TRACK_POINTS.weekly}. Wear a frame on your nameplate from Title & armor.
      </p>
    </section>
  );
}

/**
 * The record at a glance on the Ring's main screen, each part a way into its own page (the owner, 2026-11-17: "make sure
 * the progress, challenges, history and etc are present in the main screen as well"): how many of today's and this
 * week's challenges are done, how many classes are mastered, the season's points, the last few matches won and lost,
 * and the next reward of the climb. The same window of the record opens on the page pressed (ProgressDialog `tab`), and
 * the rewards their own; the layer where the fight is chosen keeps its strips of both as well.
 */
export function RecordBar({ record, best, onOpen, onRewards }: { record: RingRecord; best: number; onOpen: (tab: Tab) => void; onRewards: () => void }) {
  const [now] = useState(() => Date.now());
  const count = challengeCount(record, now);
  const mastered = CLASS_IDS.filter((c) => masteryWins(record, c) >= MASTERY_STEPS[0]!.wins).length;
  const sn = seasonOf(now);
  const points = (record.season?.n === sn ? record.season.points : 0) ?? 0;
  const last = (record.history ?? []).slice(0, 5);
  const next = RING_REWARDS.find((r) => r.at > best);
  const pill = (key: string, icon: string, name: string, value: ReactNode, onClick: () => void, said: string) => (
    <button key={key} type="button" className={`rb-rec is-${key}`} onClick={onClick} aria-label={said} title={said}>
      <img src={iconPicture(icon)} alt="" draggable={false} />
      <span>
        <b>{name}</b>
        <small>{value}</small>
      </span>
    </button>
  );
  return (
    <nav className="rb-ringvl-record" aria-label="Your record" data-tut="record">
      {pill('challenges', 'scholar_scroll_on_violet', 'Challenges', `${count.done}/${count.of}`, () => onOpen('challenges'), `Challenges: ${count.done} of ${count.of} done`)}
      {pill('mastery', 'radiant_crown_of_light_on_gold', 'Mastery', `${mastered}/${CLASS_IDS.length}`, () => onOpen('mastery'), `Mastery: ${mastered} of ${CLASS_IDS.length} classes`)}
      {pill('season', 'war_banner_on_a_pole_with_a_red_pattern_on_red', `Season ${sn}`, `${n(points)} pts`, () => onOpen('season'), `Season ${sn}: ${points} points`)}
      {pill(
        'history',
        'dark_tome_open_on_black',
        'History',
        last.length ? (
          <span className="rb-rec-dots" aria-hidden="true">
            {last.map((h) => (
              <i key={h.at} className={h.draw ? 'is-draw' : h.won ? 'is-win' : 'is-loss'} />
            ))}
          </span>
        ) : (
          'No matches'
        ),
        () => onOpen('history'),
        last.length ? `History: the last ${last.length} matches, ${last.filter((h) => h.won).length} won` : 'History: no matches yet',
      )}
      {pill('rewards', 'crit_up_status_star_burst_on_gold', 'Rewards', next ? `Next at ${next.at}` : 'All earned', onRewards, next ? `Rewards: the next, ${next.rank}, at ${next.at}` : 'Rewards: all earned')}
    </nav>
  );
}

export function ProgressDialog({ record, onClose, tab: first = 'challenges' }: { record: RingRecord; onClose: () => void; tab?: Tab }) {
  const [tab, setTab] = useState<Tab>(first);
  const [now] = useState(() => Date.now());
  const daily = record.daily?.key === dayKey(now) ? record.daily : undefined;
  const weekly = record.weekly?.key === weekKey(now) ? record.weekly : undefined;
  const finished = record.finished ?? 0;
  const nextTitle = CHALLENGE_TITLES.find((t) => finished < t.finished);
  const season = record.season?.n === seasonOf(now) ? record.season : undefined;
  const sn = seasonOf(now);
  const count = challengeCount(record, now);
  const mastered = CLASS_IDS.filter((c) => masteryWins(record, c) >= MASTERY_STEPS[0]!.wins).length;
  const label: Record<Tab, string> = { challenges: 'Challenges', mastery: 'Mastery', season: 'Season', history: 'History' };
  const badge: Record<Tab, string | null> = { challenges: `${count.done}/${count.of}`, mastery: `${mastered}/${CLASS_IDS.length}`, season: null, history: record.history?.length ? String(record.history.length) : null };
  return (
    <div className="rb-ring-dialog-wrap" role="dialog" aria-label="Progress" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="rb-ring-dialog rb-pg-dialog">
        <header className="rb-pg-top">
          <span className="rb-pg-seal is-big" aria-hidden="true">
            <img src={iconPicture('scholar_scroll_on_violet')} alt="" draggable={false} />
          </span>
          <span>
            <h2>Progress</h2>
            <small>
              Season {sn} · {until(seasonEnds(sn), now)} left · {finished} challenge{finished === 1 ? '' : 's'} finished
            </small>
          </span>
        </header>
        <div className="rb-rs-tabs rb-pg-tabs" role="tablist" aria-label="Progress">
          {(['challenges', 'mastery', 'season', 'history'] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'is-on' : ''} onClick={() => setTab(t)}>
              {label[t]}
              {badge[t] && <b>{badge[t]}</b>}
            </button>
          ))}
        </div>
        <div className="rb-pg-body" role="tabpanel">
          {tab === 'challenges' && (
            <>
              <ChallengeList title="Today" list={dailyOf(now)} run={daily} ends={dayEnds(now)} now={now} worth={TRACK_POINTS.daily} />
              <ChallengeList title="This week" list={weeklyOf(now)} run={weekly} ends={weekEnds(now)} now={now} worth={TRACK_POINTS.weekly} />
              <p className="rb-pg-note">
                Rated matches count, and each challenge finished moves you up the <b>season track</b>.{nextTitle ? (
                  <>
                    {' '}
                    Finish <b>{nextTitle.finished - finished}</b> more for the title <b>{nextTitle.name}</b>.
                  </>
                ) : (
                  ' Every challenge title is yours.'
                )}
              </p>
            </>
          )}
          {tab === 'mastery' && (
            <>
              <p className="rb-pg-note">
                Rated wins with each class. {MASTERY_STEPS.map((s) => `${s.wins} wins: ${s.word}`).join(' · ')}.
              </p>
              <ul className="rb-pg-mastery">
                {CLASS_IDS.map((cls) => {
                  const wins = masteryWins(record, cls);
                  const next = MASTERY_STEPS.find((s) => wins < s.wins);
                  const prev = [...MASTERY_STEPS].reverse().find((s) => wins >= s.wins);
                  return (
                    <li key={cls} className={prev ? 'is-tier' : ''} style={{ ['--c' as string]: CLASSES[cls].colors.accent }}>
                      <span className="rb-pg-icon is-emblem">
                        <img src={classEmblem(cls)} alt="" draggable={false} />
                      </span>
                      <span className="rb-pg-what">
                        <strong>
                          {CLASSES[cls].name}
                          <Tiers wins={wins} />
                        </strong>
                        {next ? <Bar got={wins} goal={next.wins} /> : <span className="rb-pg-bar is-full" />}
                        <small>{prev ? `${CLASSES[cls].name} ${prev.word}` : `${wins} win${wins === 1 ? '' : 's'}`}</small>
                      </span>
                      <em>{next ? `${wins}/${next.wins}` : 'Mastered'}</em>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          {tab === 'season' && (
            <>
              <SeasonTrack points={season?.points ?? 0} n={sn} now={now} earned={record.earned ?? []} />
              <section className="rb-pg-season is-bests">
                <strong>Best this season</strong>
                <div className="rb-pg-formats">
                  {(['1', '2', '3'] as const).map((f) => {
                    const best = season?.best[f];
                    const r = best ? rankOf(best) : null;
                    return (
                      <span key={f} className="rb-pg-format" style={r ? { ['--r' as string]: r.color } : undefined}>
                        <small>
                          {f}v{f}
                        </small>
                        <b>{best ?? '—'}</b>
                        <em>{r ? r.name : 'Not played yet'}</em>
                      </span>
                    );
                  })}
                </div>
                <p className="rb-pg-note">When a season ends, every rating comes halfway back toward 1000 and the track starts again. Your best ever, and everything the track and your rank gave you, stay yours.</p>
              </section>
              {!!record.season?.past.length && (
                <section className="rb-pg-block">
                  <h3 className="rb-pg-head">
                    <span>Seasons gone by</span>
                    <i aria-hidden="true" />
                  </h3>
                  <ul className="rb-pg-cards">
                    {record.season.past.map((p) => (
                      <li key={p.n} className="rb-pg-card">
                        <span className="rb-pg-what">
                          <strong>Season {p.n}</strong>
                        </span>
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
                  const kind = h.draw ? 'is-draw' : h.won ? 'is-win' : 'is-loss';
                  return (
                    <li key={h.at} className={kind} style={{ ['--c' as string]: CLASSES[h.cls]?.colors.accent }}>
                      <span className="rb-pg-icon is-emblem">
                        <img src={classEmblem(h.cls)} alt="" draggable={false} />
                      </span>
                      <span className="rb-pg-what">
                        <strong>
                          <b className={`rb-pg-verdict ${kind}`}>{h.draw ? 'Draw' : h.won ? 'Win' : 'Loss'}</b> {CLASSES[h.cls]?.name ?? h.cls} · {h.format}v{h.format}
                          {h.rival ? ` · ${h.rival}` : ''}
                        </strong>
                        <small>
                          {n(h.dmg)} damage · {n(h.heal)} healing · {h.combos} combos
                          {best && h.best ? ` · best: ${h.best.combo ?? best.name} ${h.best.n}` : ''}
                        </small>
                      </span>
                      <em className={h.change === null ? '' : h.change >= 0 ? 'is-up' : 'is-down'}>{h.change === null ? 'Friendly' : `${h.change > 0 ? '+' : h.change < 0 ? '−' : ''}${Math.abs(h.change)}`}</em>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="rb-pg-note rb-pg-empty">No matches yet. Your last twenty show here.</p>
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
