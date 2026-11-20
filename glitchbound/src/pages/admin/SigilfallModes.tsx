import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Icon } from '../../components/Icon';
import { NOTE_WORDS, type Note } from '../../games/sigilfall/arena/ranked';
import { RING_BOARDS, rankOf } from '../../games/sigilfall/arena/ranks';
import { CLASSES, CLASS_IDS } from '../../games/sigilfall/data/classes';
import { QUEST_DEFS } from '../../games/sigilfall/data/quests';
import { REGIONS } from '../../games/sigilfall/data/regions';
import type { ClassId, RegionId } from '../../games/sigilfall/data/types';
import { VIGIL_MAPS } from '../../games/sigilfall/vigil/kit';
import { api, ApiError } from '../../platform/account';
import type { BoardAdminRow, BoardSummary, CampaignAdminOverview, RingAdminMatch, RingAdminOverview, RingAdminPlayer, RingAdminStanding, VigilAdminOverview } from '../../platform/apiTypes';
import { Link, useLocation } from '../../router/router';
import './SigilfallModes.css';

/**
 * Admin › Sigilfall: the Campaign, the Ring and the Vigil, each a page of the section beside Players (server/
 * sigilfallAdmin.ts). Each shows the mode across every signed-in player, and lets an admin look after it: a Ring
 * rating set by hand, a match looked into and taken back, a row on any of the game's boards corrected, taken off,
 * or kept off. Every change goes in the change log with its reason. Guests' play stays on their own device.
 */

export type ModeView = 'players' | 'campaign' | 'ring' | 'vigil';
const VIEWS: { id: ModeView; label: string; icon: 'user' | 'crown' | 'sword' | 'moon' }[] = [
  { id: 'players', label: 'Players', icon: 'user' },
  { id: 'campaign', label: 'Campaign', icon: 'crown' },
  { id: 'ring', label: 'The Ring', icon: 'sword' },
  { id: 'vigil', label: 'The Vigil', icon: 'moon' },
];
export const viewOf = (v: string | null): ModeView => (VIEWS.some((x) => x.id === v) ? (v as ModeView) : 'players');
const viewHref = (v: ModeView): string => (v === 'players' ? '/admin?tab=sections' : `/admin?tab=sections&view=${v}`);

/* ------------------------------------------------------------------ small things */

const FORMAT_NAME: Record<number, string> = { 1: '1v1', 2: '2v2', 3: '3v3' };
const TIERS = ['Normal', 'Heroic', 'Mythic'];
const when = (ms: number): string => (ms ? new Date(ms).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—');
const n0 = (n: number): string => Math.round(n).toLocaleString('en-US');
export const clock = (secs: number | null): string => (secs === null ? '—' : `${Math.floor(secs / 60)}:${String(Math.round(secs) % 60).padStart(2, '0')}`);
const pct = (a: number, b: number): string => (b ? `${Math.round((a / b) * 100)}%` : '—');
const classOf = (cls: string): string => CLASSES[cls as ClassId]?.name ?? cls;
const landOf = (id: string): string => REGIONS[id as RegionId]?.name ?? (id || 'Not travelled yet');
const vigilLandOf = (id: string): string => VIGIL_MAPS.find((m) => m.id === id)?.name ?? id;
const noteOf = (n: string | null): string => (n ? (NOTE_WORDS[n as Note] ?? n) : '');
const errorText = (e: unknown, fallback: string): string => (e instanceof ApiError ? (e.message && e.message !== e.code ? e.message : fallback) : 'Network error. Try again.');
const signed = (n: number | null): string => (n === null ? '—' : n > 0 ? `+${n}` : String(n));

/** A board's name as the admin reads it. */
export function boardName(board: string): string {
  const [fam, part] = board.split(':');
  if (fam === 'ring') return part ? `The Ring ${RING_BOARDS.find((b) => b.part === part)?.name ?? part}` : 'The Ring (best of all)';
  if (fam === 'vigil') return part ? `The Vigil: ${vigilLandOf(part)}` : 'The Vigil (anywhere)';
  if (fam === 'trial') return part ? `Rift Trials: ${classOf(part)}` : 'Rift Trials (any calling)';
  if (fam === 'stone') return 'Story Riftstone';
  if (fam === 'level') return 'Highest hero';
  return board;
}

/** A score on a board, as the game shows it. */
export function scoreOn(board: string, score: number): string {
  if (board.startsWith('vigil')) return clock(score);
  if (board === 'level') return `${Math.floor(score / 10_000)}${score % 10_000 ? ` · Paragon ${score % 10_000}` : ''}`;
  return n0(score);
}

function useApi<T>(path: string | null): { data: T | null; error: string; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!path) return;
    let on = true;
    api<T>(path).then(
      (r) => {
        if (!on) return;
        setData(r);
        setError('');
      },
      (e: unknown) => on && setError(errorText(e, 'Could not load that.')),
    );
    return () => {
      on = false;
    };
  }, [path, n]);
  return { data, error, reload: useCallback(() => setN((x) => x + 1), []) };
}

/** Sends a change; says how it went in the toast. */
function useSend(onDone: () => void): { toast: string; send: (path: string, body: Record<string, unknown>, done: string) => Promise<boolean> } {
  const [toast, setToast] = useState('');
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(''), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);
  const send = useCallback(
    async (path: string, body: Record<string, unknown>, done: string): Promise<boolean> => {
      try {
        await api(path, { body });
        setToast(done);
        onDone();
        return true;
      } catch (e) {
        setToast(errorText(e, 'That didn’t work.'));
        return false;
      }
    },
    [onDone],
  );
  return { toast, send };
}

function Toast({ text }: { text: string }) {
  return (
    <p className="ag-toast" role="status" aria-live="polite">
      {text}
    </p>
  );
}

function Tile({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="gm-tile" title={hint}>
      <small className="mono">{label}</small>
      <b>{value}</b>
    </div>
  );
}

/** A row of horizontal bars, each a share of the largest. */
function Bars({ rows }: { rows: { label: string; value: number; sub?: string }[] }) {
  const top = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="sm-bars">
      {rows.map((r) => (
        <li key={r.label}>
          <span className="sm-bar-label">{r.label}</span>
          <span className="sm-bar-track" aria-hidden="true">
            <i style={{ width: `${(r.value / top) * 100}%` }} />
          </span>
          <span className="sm-bar-value mono">
            {n0(r.value)}
            {r.sub ? <small> {r.sub}</small> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Pages({ offset, page, total, onMove }: { offset: number; page: number; total: number; onMove: (o: number) => void }) {
  if (total <= page) return null;
  return (
    <div className="gm-pages">
      <button className="btn btn-sm" disabled={offset === 0} onClick={() => onMove(Math.max(0, offset - page))}>
        Back
      </button>
      <span className="mono info-small">
        {offset + 1}–{Math.min(offset + page, total)} of {total}
      </span>
      <button className="btn btn-sm" disabled={offset + page >= total} onClick={() => onMove(offset + page)}>
        Next
      </button>
    </div>
  );
}

const playerHref = (id: string): string => `/admin?tab=sections&player=${encodeURIComponent(id)}`;

/** Asks why, for the log; null when the admin thinks better of it. */
const askWhy = (question: string): string | null => window.prompt(`${question}\n\nWhy? (goes in the change log; leave empty to skip)`, '');

/* ------------------------------------------------------------------ the section's pages */

export function ModeTabs({ current }: { current: ModeView }) {
  return (
    <nav className="seg gm-tabs sm-tabs" aria-label="Sigilfall">
      {VIEWS.map((v) => (
        <Link key={v.id} href={viewHref(v.id)} className={current === v.id ? 'is-on' : ''} aria-current={current === v.id ? 'page' : undefined}>
          <Icon name={v.icon} size={16} /> {v.label}
        </Link>
      ))}
    </nav>
  );
}

/* ------------------------------------------------------------------ the Ring */

export function RingAdmin() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const { data: o, error, reload } = useApi<RingAdminOverview>('/api/admin/sigilfall/ring?view=overview');
  const [classFormat, setClassFormat] = useState(1);
  const [stamp, setStamp] = useState(0);
  const refresh = useCallback(() => {
    reload();
    setStamp((s) => s + 1);
  }, [reload]);
  const { toast, send } = useSend(refresh);
  const classes = (o?.classes ?? []).filter((c) => c.format === classFormat);
  return (
    <div className="gm sm">
      <Toast text={toast} />
      <section className="panel info-block" aria-labelledby="sm-ring">
        <div className="admin-row">
          <h2 id="sm-ring">
            <Icon name="sword" /> The Ring
          </h2>
          {o && (
            <span className="mono info-small">
              season {o.season} · ends {new Date(o.seasonEnds).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
        <p className="info-small">
          The ranked ladder the server keeps for signed-in players. See every rated match with its length and each player’s damage, healing and crowd control. Set a rating by hand, start
          one over, or take back a match and the rating it moved. Lengths and numbers come from each player’s own game. Matches reported before this page existed show the time to the first
          report instead.
        </p>
        {error && <p className="info-small" role="alert">{error}</p>}
        {o && (
          <>
            <div className="gm-tiles">
              <Tile label="Open matches" value={o.open} hint="Not settled yet: waiting on reports" />
              <Tile label="Won" value={n0((o.results.t0 ?? 0) + (o.results.t1 ?? 0))} />
              <Tile label="Draws" value={n0(o.results.draw ?? 0)} />
              <Tile label="Void" value={n0(o.results.void ?? 0)} />
              <Tile label="Disputed" value={n0(o.notes.disputed ?? 0)} hint={NOTE_WORDS.disputed} />
              <Tile label="Too short" value={n0(o.notes.short ?? 0)} hint={NOTE_WORDS.short} />
              <Tile label="Taken back" value={n0(o.notes.admin ?? 0)} />
            </div>
            <div className="gm-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Format</th>
                    <th>Players</th>
                    <th>Active 7d</th>
                    <th>Avg rating</th>
                    <th>Top</th>
                    <th>Matches</th>
                    <th>24 h</th>
                    <th>7 days</th>
                    <th>vs people</th>
                    <th title="Last 30 days, from players’ reports">Avg length</th>
                    <th>Avg damage</th>
                    <th>Avg healing</th>
                  </tr>
                </thead>
                <tbody>
                  {o.formats.map((f) => (
                    <tr key={f.format}>
                      <td>
                        <b>{FORMAT_NAME[f.format]}</b>
                      </td>
                      <td>{n0(f.players)}</td>
                      <td>{n0(f.active7d)}</td>
                      <td>{f.players ? n0(f.avgRating) : '—'}</td>
                      <td>{f.players ? n0(f.topRating) : '—'}</td>
                      <td>{n0(f.matches)}</td>
                      <td>{n0(f.matches24h)}</td>
                      <td>{n0(f.matches7d)}</td>
                      <td>{n0(f.vsPeople)}</td>
                      <td>{f.withStats ? clock(f.avgSecs) : '—'}</td>
                      <td>{f.withStats ? n0(f.avgDmg) : '—'}</td>
                      <td>{f.withStats ? n0(f.avgHeal) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="panel info-block" aria-labelledby="sm-classes">
        <div className="admin-row">
          <h2 id="sm-classes">Classes in rated play</h2>
          <FormatPick value={classFormat} onChange={setClassFormat} />
        </div>
        <p className="info-small">The last 30 days of rated matches with numbers, by the class each player fought as. Win rate counts matches that had a winner.</p>
        {classes.length === 0 ? (
          <p className="info-small">No rated matches with numbers in {FORMAT_NAME[classFormat]} yet.</p>
        ) : (
          <div className="gm-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Played</th>
                  <th>Won</th>
                  <th>Win rate</th>
                  <th>Avg damage</th>
                  <th>Avg healing</th>
                  <th>Avg length</th>
                </tr>
              </thead>
              <tbody>
                {classes.map((c) => (
                  <tr key={c.cls}>
                    <td>
                      <b>{classOf(c.cls)}</b>
                    </td>
                    <td>{n0(c.played)}</td>
                    <td>{n0(c.wins)}</td>
                    <td className={c.decided >= 10 && (c.wins / c.decided > 0.6 || c.wins / c.decided < 0.4) ? 'is-bad' : ''}>{pct(c.wins, c.decided)}</td>
                    <td>{n0(c.avgDmg)}</td>
                    <td>{n0(c.avgHeal)}</td>
                    <td>{clock(c.avgSecs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Ladder key={`l${stamp}`} send={send} />
      <Matches key={`m${stamp}`} send={send} player={params.get('mplayer') ?? ''} />
      <BoardManager key={`b${stamp}`} boards={['ring', ...RING_BOARDS.map((b) => `ring:${b.part}`)]} title="The Ring’s boards" />
    </div>
  );
}

function FormatPick({ value, onChange }: { value: number; onChange: (f: number) => void }) {
  return (
    <div className="seg" role="group" aria-label="Format">
      {[1, 2, 3].map((f) => (
        <button key={f} className={value === f ? 'is-on' : ''} aria-pressed={value === f} onClick={() => onChange(f)}>
          {FORMAT_NAME[f]}
        </button>
      ))}
    </div>
  );
}

type Send = (path: string, body: Record<string, unknown>, done: string) => Promise<boolean>;

function Ladder({ send }: { send: Send }) {
  const [format, setFormat] = useState(1);
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);
  const { data, error, reload } = useApi<{ rows: RingAdminStanding[]; total: number; page: number }>(`/api/admin/sigilfall/ring?view=ladder&format=${format}&q=${encodeURIComponent(term)}&offset=${offset}`);
  return (
    <section className="panel info-block" aria-labelledby="sm-ladder">
      <div className="admin-row">
        <h2 id="sm-ladder">Ladder</h2>
        <FormatPick
          value={format}
          onChange={(f) => {
            setFormat(f);
            setOffset(0);
            setEditing(null);
          }}
        />
      </div>
      <p className="info-small">Highest rating first, as each player sees it this season. The hidden rating is the one matchmaking uses. Edit a row to set any of it.</p>
      <form
        className="gm-search sm-search"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          setOffset(0);
          setTerm(q.trim());
        }}
      >
        <input className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nickname, email or player id" aria-label="Find a player on the ladder" maxLength={80} />
        <button className="btn btn-primary btn-sm">
          <Icon name="search" size={16} /> Find
        </button>
      </form>
      {error && <p className="info-small" role="alert">{error}</p>}
      {data && data.rows.length === 0 && <p className="info-small">{term ? 'No one on this ladder matches that.' : `No one has played rated ${FORMAT_NAME[format]} yet.`}</p>}
      {data && data.rows.length > 0 && (
        <div className="gm-table-wrap">
          <table className="data-table sm-ladder">
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>Rating</th>
                <th>Rank</th>
                <th>Hidden</th>
                <th>Best</th>
                <th>W–L</th>
                <th>Streak</th>
                <th>Last match</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r, i) => (
                <StandingRows
                  key={r.userId}
                  place={offset + i + 1}
                  s={r}
                  open={editing === r.userId}
                  onToggle={() => setEditing(editing === r.userId ? null : r.userId)}
                  send={async (body, done) => {
                    const ok = await send('/api/admin/sigilfall/ring', body, done);
                    if (ok) {
                      setEditing(null);
                      reload();
                    }
                    return ok;
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && <Pages offset={offset} page={data.page} total={data.total} onMove={setOffset} />}
    </section>
  );
}

function StandingRows({ place, s, open, onToggle, send, showPlayer = true }: { place?: number; s: RingAdminStanding; open: boolean; onToggle: () => void; send: (body: Record<string, unknown>, done: string) => Promise<boolean>; showPlayer?: boolean }) {
  const rk = rankOf(s.best);
  return (
    <>
      <tr className={s.banned ? 'sm-banned' : ''}>
        {place !== undefined && <td className="mono">{place}</td>}
        {showPlayer ? (
          <td>
            <Link href={playerHref(s.userId)}>
              <b>{s.nickname}</b>
            </Link>
            {s.banned && <span className="gm-chip is-warn">Banned</span>}
            <br />
            <span className="info-small">{s.email}</span>
          </td>
        ) : (
          <td>
            <b>{FORMAT_NAME[s.format]}</b>
          </td>
        )}
        <td>
          <b>{s.rating}</b>
          {s.stored && s.stored.season < s.season && (
            <span className="info-small" title={`Written as ${s.stored.rating} in season ${s.stored.season}; brought halfway back toward 1000 for this season.`}>
              {' '}
              (S{s.stored.season}: {s.stored.rating})
            </span>
          )}
        </td>
        <td style={{ color: rk.color }}>{rk.name}</td>
        <td>{s.mmr}</td>
        <td>{s.best}</td>
        <td>
          {s.wins}–{s.losses} <span className="info-small">{pct(s.wins, s.wins + s.losses)}</span>
        </td>
        <td>{signed(s.streak)}</td>
        <td><span className="info-small">{s.updatedAt ? when(s.updatedAt) : 'never'}</span></td>
        <td>
          <button className="btn btn-sm" aria-expanded={open} onClick={onToggle}>
            {open ? 'Close' : 'Edit'}
          </button>
        </td>
      </tr>
      {open && (
        <tr className="sm-edit-row">
          <td colSpan={place !== undefined ? 10 : 9}>
            <StandingEditor s={s} send={send} />
          </td>
        </tr>
      )}
    </>
  );
}

function StandingEditor({ s, send }: { s: RingAdminStanding; send: (body: Record<string, unknown>, done: string) => Promise<boolean> }) {
  const [v, setV] = useState({ rating: String(s.rating), mmr: String(s.mmr), best: String(s.best), wins: String(s.wins), losses: String(s.losses), streak: String(s.streak) });
  const [note, setNote] = useState('');
  const fields: { k: keyof typeof v; label: string }[] = [
    { k: 'rating', label: 'Rating' },
    { k: 'mmr', label: 'Hidden rating' },
    { k: 'best', label: 'Best reached' },
    { k: 'wins', label: 'Wins' },
    { k: 'losses', label: 'Losses' },
    { k: 'streak', label: 'Streak' },
  ];
  const changed = Object.fromEntries(fields.filter((f) => v[f.k].trim() !== String(s[f.k])).map((f) => [f.k, Number(v[f.k])]));
  return (
    <form
      className="sm-editor"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        if (!Object.keys(changed).length) return;
        void send({ action: 'standing', userId: s.userId, format: s.format, ...changed, note }, `${s.nickname}’s ${FORMAT_NAME[s.format]} standing is set. Their game shows it next time it asks.`);
      }}
    >
      <div className="sm-fields">
        {fields.map((f) => (
          <label key={f.k} className="ag-field">
            <span>{f.label}</span>
            <input className="field" inputMode="numeric" value={v[f.k]} onChange={(e) => setV({ ...v, [f.k]: e.target.value })} />
          </label>
        ))}
      </div>
      <label className="ag-field">
        <span>Why (goes in the change log)</span>
        <input className="field" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Ticket, reason, anything you’d want to remember" />
      </label>
      <p className="info-small">The best reached never sits below the rating, and the Ring’s boards follow what you set. A new season still brings both ratings halfway back toward 1000.</p>
      <div className="reset-row">
        <button className="btn btn-primary btn-sm" disabled={!Object.keys(changed).length}>
          Save
        </button>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => {
            if (window.confirm(`Start ${s.nickname}’s ${FORMAT_NAME[s.format]} standing over at 1000 with no matches, and take it off the boards?`))
              void send({ action: 'reset', userId: s.userId, format: s.format, note }, `${s.nickname}’s ${FORMAT_NAME[s.format]} standing starts over at 1000.`);
          }}
        >
          Start over at 1000
        </button>
      </div>
    </form>
  );
}

const RESULTS = [
  { id: '', label: 'Any result' },
  { id: 't0', label: 'First side won' },
  { id: 't1', label: 'Second side won' },
  { id: 'draw', label: 'Draw' },
  { id: 'void', label: 'Void' },
  { id: 'open', label: 'Still open' },
];
const NOTES = ['', 'disputed', 'short', 'repeat', 'friends', 'network', 'dupe', 'ceiling', 'admin'];

function Matches({ send, player: asked, userId }: { send: Send; player?: string; userId?: string }) {
  const [format, setFormat] = useState(0);
  const [kind, setKind] = useState('');
  const [result, setResult] = useState('');
  const [note, setNote] = useState('');
  const [who, setWho] = useState(asked ?? '');
  const [player, setPlayer] = useState(userId ?? asked ?? '');
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const qs = new URLSearchParams({ view: 'matches', format: String(format), kind, result, note, player, offset: String(offset) });
  const { data, error, reload } = useApi<{ rows: RingAdminMatch[]; total: number; page: number; player: { id: string; nickname: string } | null }>(`/api/admin/sigilfall/ring?${qs}`);
  const reset = (): void => setOffset(0);
  return (
    <section className="panel info-block" aria-labelledby={`sm-matches${userId ? '-p' : ''}`}>
      <div className="admin-row">
        <h2 id={`sm-matches${userId ? '-p' : ''}`}>Rated matches</h2>
        {data && <span className="mono info-small">{n0(data.total)} found</span>}
      </div>
      <p className="info-small">Newest first. Open one to see each player’s report, what it did to their rating, and their numbers. Take a match back to return the rating it moved.</p>
      <div className="sm-filters">
        <select className="field" aria-label="Format" value={format} onChange={(e) => (setFormat(Number(e.target.value)), reset())}>
          <option value={0}>Every format</option>
          {[1, 2, 3].map((f) => (
            <option key={f} value={f}>
              {FORMAT_NAME[f]}
            </option>
          ))}
        </select>
        <select className="field" aria-label="Against" value={kind} onChange={(e) => (setKind(e.target.value), reset())}>
          <option value="">Against anyone</option>
          <option value="people">Against people</option>
          <option value="bots">Against the computer</option>
        </select>
        <select className="field" aria-label="Result" value={result} onChange={(e) => (setResult(e.target.value), reset())}>
          {RESULTS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
        <select className="field" aria-label="Note" value={note} onChange={(e) => (setNote(e.target.value), reset())}>
          {NOTES.map((n) => (
            <option key={n} value={n}>
              {n ? `Note: ${n}` : 'Any note'}
            </option>
          ))}
        </select>
        {!userId && (
          <form
            className="gm-inline"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              setPlayer(who.trim());
              reset();
            }}
          >
            <input className="field" value={who} onChange={(e) => setWho(e.target.value)} placeholder="Player: nickname, email or id" aria-label="Matches of a player" maxLength={120} />
            <button className="btn btn-sm">Find</button>
          </form>
        )}
      </div>
      {!userId && player && data && (
        <p className="info-small">
          {data.player ? (
            <>
              Matches of <Link href={playerHref(data.player.id)}>{data.player.nickname}</Link>.{' '}
            </>
          ) : (
            'No player matches that. '
          )}
          <button className="btn-link" onClick={() => (setWho(''), setPlayer(''), reset())}>
            Show everyone’s
          </button>
        </p>
      )}
      {error && <p className="info-small" role="alert">{error}</p>}
      {data && data.rows.length === 0 && <p className="info-small">No rated matches match that.</p>}
      {data && data.rows.length > 0 && (
        <ul className="sm-matches">
          {data.rows.map((m) => (
            <MatchRow
              key={m.id}
              m={m}
              focus={userId}
              open={open === m.id}
              onToggle={() => setOpen(open === m.id ? null : m.id)}
              onVoid={async () => {
                const why = askWhy(`Take back match ${m.id}? ${m.settledAt === null ? 'It is still open: it closes as void.' : 'Each player gets back the rating it moved, and the win or loss it counted.'}`);
                if (why === null) return;
                if (await send('/api/admin/sigilfall/ring', { action: 'void', id: m.id, note: why }, 'Taken back. Ratings shown in the game follow next time they ask.')) reload();
              }}
            />
          ))}
        </ul>
      )}
      {data && <Pages offset={offset} page={data.page} total={data.total} onMove={setOffset} />}
    </section>
  );
}

const resultWord = (m: RingAdminMatch, team: 0 | 1): string => {
  if (m.result === null) return 'open';
  if (m.result === 'draw' || m.result === 'void') return m.result;
  return (m.result === 't0') === (team === 0) ? 'won' : 'lost';
};

function MatchRow({ m, focus, open, onToggle, onVoid }: { m: RingAdminMatch; focus?: string; open: boolean; onToggle: () => void; onVoid: () => void }) {
  const sides: (0 | 1)[] = m.kind === 'bots' ? [0] : [0, 1];
  const me = focus ? m.players.find((p) => p.userId === focus) : undefined;
  const dmg = m.players.reduce((a, p) => a + (p.stats?.dmg ?? 0), 0);
  const head = me ? `${resultWord(m, me.team)} ${signed(me.change)}` : m.result === null ? 'open' : m.result === 't0' ? (m.kind === 'bots' ? 'won' : 'side 1 won') : m.result === 't1' ? (m.kind === 'bots' ? 'lost' : 'side 2 won') : m.result;
  const names = (team: 0 | 1): string =>
    m.players
      .filter((p) => p.team === team)
      .map((p) => p.nickname)
      .join(', ') || (team === 1 && m.kind === 'people' ? 'the computer / guests' : '');
  return (
    <li className={`sm-match${m.note === 'admin' ? ' is-off' : ''}`}>
      <button className="sm-match-head" aria-expanded={open} onClick={onToggle}>
        <span className="mono sm-match-when">{when(m.createdAt)}</span>
        <span className="gm-chip">{FORMAT_NAME[m.format]}</span>
        <span className="gm-chip">{m.kind === 'bots' ? `vs computer ${m.rival}` : 'vs people'}</span>
        <span className="sm-match-who">
          {names(0)}
          {m.kind === 'people' ? <> vs {names(1)}</> : null}
        </span>
        <span className={`gm-chip${m.result === null ? '' : m.note === 'admin' || m.result === 'void' ? ' is-warn' : ' is-on'}`}>{head}</span>
        <span className="mono info-small" title={m.measured ? 'By the match’s own clock' : 'From its start to the first report'}>
          {clock(m.secs)}
          {m.secs !== null && !m.measured ? '*' : ''}
        </span>
        {dmg > 0 && <span className="mono info-small">{n0(dmg)} dmg</span>}
        {m.note && <span className="gm-chip is-warn">{m.note}</span>}
      </button>
      {open && (
        <div className="sm-match-body">
          {sides.map((team) => (
            <div key={team} className="gm-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{m.kind === 'bots' ? 'Player' : `Side ${team + 1}`}</th>
                    <th>Class</th>
                    <th>Report</th>
                    <th>Rating</th>
                    <th>Change</th>
                    <th>Damage</th>
                    <th>Healing</th>
                    <th>CC</th>
                    <th>Interrupts</th>
                    <th>Combos</th>
                    <th>Supers</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {m.players
                    .filter((p) => p.team === team)
                    .map((p) => (
                      <tr key={p.userId}>
                        <td>
                          <Link href={playerHref(p.userId)}>{p.nickname}</Link>
                          {p.party && <span className="info-small"> (party)</span>}
                        </td>
                        <td>{p.stats ? classOf(p.stats.cls) : '—'}</td>
                        <td>
                          {p.report ?? 'none'}
                          {p.reportedAt ? <span className="info-small"> {clock(Math.max(0, Math.round((p.reportedAt - m.createdAt) / 1000)))}</span> : null}
                        </td>
                        <td>
                          {p.rating} <span className="info-small">({p.mmr})</span>
                        </td>
                        <td className={p.change !== null && p.change < 0 ? 'is-bad' : ''}>{signed(p.change)}</td>
                        <td>{p.stats ? n0(p.stats.dmg) : '—'}</td>
                        <td>{p.stats ? n0(p.stats.heal) : '—'}</td>
                        <td>{p.stats ? n0(p.stats.cc) : '—'}</td>
                        <td>{p.stats ? p.stats.kicks : '—'}</td>
                        <td>{p.stats ? p.stats.combos : '—'}</td>
                        <td>{p.stats ? p.stats.supers : '—'}</td>
                        <td><span className="info-small" title={noteOf(p.note)}>
                          {p.note ?? ''}
                        </span></td>
                      </tr>
                    ))}
                  {m.kind === 'people' && !m.players.some((p) => p.team === team) && (
                    <tr>
                      <td colSpan={12} className="info-small">
                        Only the computer’s places or guests on this side (fought at {m.rival}).
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ))}
          <p className="info-small">
            Match <span className="mono">{m.id}</span> · began {when(m.createdAt)} · {m.settledAt ? `settled ${when(m.settledAt)}` : 'not settled yet'}
            {m.note ? ` · ${noteOf(m.note)}` : ''}
          </p>
          {m.note !== 'admin' && (
            <button className="btn btn-sm" onClick={onVoid}>
              Take this match back
            </button>
          )}
        </div>
      )}
    </li>
  );
}

/* ------------------------------------------------------------------ the boards */

function BoardManager({ boards, title, intro }: { boards: string[]; title: string; intro?: string }) {
  const [board, setBoard] = useState(boards[0]!);
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [offset, setOffset] = useState(0);
  const { data, error, reload } = useApi<{ board: string; max: number; rows: BoardAdminRow[]; total: number; page: number; held: BoardAdminRow[] }>(
    `/api/admin/sigilfall/boards?view=board&board=${encodeURIComponent(board)}&q=${encodeURIComponent(term)}&offset=${offset}`,
  );
  const { toast, send } = useSend(reload);
  const post = (body: Record<string, unknown>, done: string): Promise<boolean> => send('/api/admin/sigilfall/boards', { board, ...body }, done);
  const fixScore = (r: BoardAdminRow): void => {
    const asked = window.prompt(`Set ${r.nickname}’s score on ${boardName(board)}${board.startsWith('vigil') ? ' (in seconds)' : board === 'level' ? ' (level × 10000 + Paragon level)' : ''}:`, String(r.score));
    if (asked === null) return;
    const why = askWhy('Set this score?');
    if (why === null) return;
    void post({ action: 'set', userId: r.userId, score: Number(asked), note: why }, 'Score set.');
  };
  return (
    <section className="panel info-block" aria-labelledby={`sm-board-${boards[0]}`}>
      <Toast text={toast} />
      <div className="admin-row">
        <h2 id={`sm-board-${boards[0]}`}>{title}</h2>
        <select
          className="field sm-board-pick"
          aria-label="Board"
          value={board}
          onChange={(e) => {
            setBoard(e.target.value);
            setOffset(0);
          }}
        >
          {boards.map((b) => (
            <option key={b} value={b}>
              {boardName(b)}
            </option>
          ))}
        </select>
      </div>
      <p className="info-small">
        {intro ?? 'The game’s rankings as players see them, banned players included (players don’t see those).'} Take a row off when it shouldn’t be there. “Keep off” also stops that
        player’s device from sending it again, until you let them back on.
      </p>
      <form
        className="gm-search sm-search"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          setOffset(0);
          setTerm(q.trim());
        }}
      >
        <input className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nickname, email or player id" aria-label="Find a player on this board" maxLength={80} />
        <button className="btn btn-primary btn-sm">
          <Icon name="search" size={16} /> Find
        </button>
      </form>
      {error && <p className="info-small" role="alert">{error}</p>}
      {data && data.rows.length === 0 && <p className="info-small">{term ? 'No one on this board matches that.' : 'No one is on this board yet.'}</p>}
      {data && data.rows.length > 0 && (
        <div className="gm-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>Score</th>
                <th>Since</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.userId} className={r.banned ? 'sm-banned' : ''}>
                  <td className="mono">{r.rank}</td>
                  <td>
                    <Link href={playerHref(r.userId)}>
                      <b>{r.nickname}</b>
                    </Link>
                    {r.banned && <span className="gm-chip is-warn">Banned</span>}
                    <br />
                    <span className="info-small">{r.email}</span>
                  </td>
                  <td>
                    <b>{scoreOn(board, r.score)}</b>
                  </td>
                  <td><span className="info-small">{when(r.at)}</span></td>
                  <td>
                    <div className="sm-row-actions">
                      <button className="btn btn-sm" onClick={() => fixScore(r)}>
                        Set score
                      </button>
                      <button
                        className="btn btn-sm"
                        onClick={() => {
                          const why = askWhy(`Take ${r.nickname} off ${boardName(board)}? Their device may send it again; use Keep off to stop that.`);
                          if (why !== null) void post({ action: 'remove', userId: r.userId, note: why }, 'Taken off.');
                        }}
                      >
                        Take off
                      </button>
                      <button
                        className="btn btn-sm"
                        onClick={() => {
                          const why = askWhy(`Take ${r.nickname} off ${boardName(board)} and keep them off it?`);
                          if (why !== null) void post({ action: 'remove', userId: r.userId, hold: true, note: why }, 'Taken off, and kept off.');
                        }}
                      >
                        Keep off
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && <Pages offset={offset} page={data.page} total={data.total} onMove={setOffset} />}
      {data && data.held.length > 0 && (
        <>
          <h3 className="admin-h3">Kept off this board · {data.held.length}</h3>
          <ul className="gm-list">
            {data.held.map((h) => (
              <li key={h.userId} className="gm-row sm-held">
                <span className="gm-who">
                  <Link href={playerHref(h.userId)}>
                    <b>{h.nickname}</b>
                  </Link>
                  <span className="info-small">
                    by {h.by} · {when(h.at)}
                    {h.reason ? ` · ${h.reason}` : ''}
                  </span>
                </span>
                <button
                  className="btn btn-sm"
                  onClick={() => {
                    const why = askWhy(`Let ${h.nickname} back on ${boardName(board)}?`);
                    if (why !== null) void post({ action: 'unhold', userId: h.userId, note: why }, 'Let back on. Their best comes back when their game next sends it.');
                  }}
                >
                  Let back on
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function BoardSummaries({ boards }: { boards: BoardSummary[] }) {
  if (!boards.length) return <p className="info-small">No one is on these boards yet.</p>;
  return (
    <div className="gm-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Board</th>
            <th>Players</th>
            <th>Best</th>
            <th>Average</th>
          </tr>
        </thead>
        <tbody>
          {boards.map((b) => (
            <tr key={b.board}>
              <td>{boardName(b.board)}</td>
              <td>{n0(b.players)}</td>
              <td>{scoreOn(b.board, b.top)}</td>
              <td>{scoreOn(b.board, b.avg)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ the Campaign */

export function CampaignAdmin() {
  const { data: c, error } = useApi<CampaignAdminOverview>('/api/admin/sigilfall/boards?view=campaign');
  const [questFilter, setQuestFilter] = useState('');
  const [allQuests, setAllQuests] = useState(false);
  const quests = (c?.quests ?? [])
    .map((q) => ({ ...q, name: QUEST_DEFS[q.id]?.name ?? q.id, region: QUEST_DEFS[q.id]?.zone }))
    .filter((q) => !questFilter || q.name.toLowerCase().includes(questFilter.toLowerCase()) || q.id.includes(questFilter.toLowerCase()))
    .sort((a, b) => b.done + b.active - (a.done + a.active));
  const shownQuests = allQuests || questFilter ? quests : quests.slice(0, 25);
  return (
    <div className="gm sm">
      <section className="panel info-block" aria-labelledby="sm-campaign">
        <div className="admin-row">
          <h2 id="sm-campaign">
            <Icon name="crown" /> Campaign
          </h2>
          <span className="mono info-small">every signed-in player’s heroes</span>
        </div>
        <p className="info-small">
          The story across every hero saved on the server: how far heroes get, where they stand, which quests they finish and which bosses they beat. To help one player, open them under{' '}
          <Link href="/admin?tab=sections">Players</Link>: level, gold, gear, quests, lands, difficulty and Riftstone are all there, hero by hero. The boards below can be corrected here.
        </p>
        {error && <p className="info-small" role="alert">{error}</p>}
        {c && (
          <div className="gm-tiles">
            <Tile label="Players" value={n0(c.players)} />
            <Tile label="Played today" value={n0(c.playedToday)} />
            <Tile label="Heroes" value={n0(c.heroes)} hint={c.reviewHeroes ? `${c.reviewHeroes} jumped ahead with a review preset` : undefined} />
            <Tile label="Avg level" value={c.avgLevel} />
            <Tile label="Level 60" value={n0(c.maxed)} />
            <Tile label="Top Paragon" value={n0(c.topParagon)} />
            <Tile label="Hours played" value={n0(c.hoursPlayed)} />
            <Tile label="Avg per hero" value={`${n0(c.avgMinutes)} min`} />
            <Tile label="Foes beaten" value={n0(c.kills)} />
            <Tile label="Falls" value={n0(c.deaths)} hint={c.heroes ? `${(c.deaths / c.heroes).toFixed(1)} per hero` : undefined} />
            <Tile label="With a Riftstone" value={n0(c.stoneHeroes)} />
            <Tile label="Top Riftstone" value={n0(c.topStone)} hint={`Average ${c.avgStone}`} />
          </div>
        )}
      </section>

      {c && (
        <div className="info-cols sm-cols">
          <section className="panel info-block" aria-labelledby="sm-levels">
            <h2 id="sm-levels">Heroes by level</h2>
            <Bars rows={c.levels.map((l) => ({ label: l.from === l.to ? `${l.from}` : `${l.from}–${l.to}`, value: l.heroes }))} />
            <h3 className="admin-h3">Highest difficulty open</h3>
            <Bars rows={c.tiers.map((t) => ({ label: TIERS[t.tier] ?? String(t.tier), value: t.heroes }))} />
          </section>
          <section className="panel info-block" aria-labelledby="sm-lands">
            <h2 id="sm-lands">Where heroes are now</h2>
            <Bars rows={c.lands.slice(0, 20).map((l) => ({ label: landOf(l.land), value: l.heroes, sub: `lvl ${l.avgLevel}` }))} />
          </section>
        </div>
      )}

      {c && (
        <section className="panel info-block" aria-labelledby="sm-quests">
          <div className="admin-row">
            <h2 id="sm-quests">Quests</h2>
            <span className="mono info-small">{n0(c.quests.length)} quests seen</span>
          </div>
          <p className="info-small">How many heroes have finished each quest, and how many are on it now. A quest many start and few finish is where players get stuck.</p>
          <input className="field" value={questFilter} onChange={(e) => setQuestFilter(e.target.value)} placeholder="Find a quest" aria-label="Find a quest" maxLength={60} />
          <div className="gm-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Quest</th>
                  <th>Land</th>
                  <th>Finished</th>
                  <th>On it now</th>
                  <th>Finish rate</th>
                </tr>
              </thead>
              <tbody>
                {shownQuests.map((q) => (
                  <tr key={q.id}>
                    <td>
                      <b>{q.name}</b>
                    </td>
                    <td><span className="info-small">{q.region ? landOf(q.region) : ''}</span></td>
                    <td>{n0(q.done)}</td>
                    <td>{n0(q.active)}</td>
                    <td className={q.done + q.active >= 10 && q.done / (q.done + q.active) < 0.5 ? 'is-bad' : ''}>{pct(q.done, q.done + q.active)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!questFilter && quests.length > 25 && (
            <button className="btn btn-sm" onClick={() => setAllQuests((v) => !v)}>
              {allQuests ? 'Show the top 25' : `Show all ${quests.length}`}
            </button>
          )}
        </section>
      )}

      {c && (
        <div className="info-cols sm-cols">
          <section className="panel info-block" aria-labelledby="sm-bosses">
            <h2 id="sm-bosses">Bosses beaten</h2>
            {c.bosses.length === 0 ? <p className="info-small">None yet.</p> : <Bars rows={c.bosses.slice(0, 30).map((b) => ({ label: b.id.replace(/-/g, ' '), value: b.kills, sub: `${b.heroes} heroes` }))} />}
          </section>
          <section className="panel info-block" aria-labelledby="sm-trials">
            <h2 id="sm-trials">Rift Trials</h2>
            {c.trials.length === 0 ? (
              <p className="info-small">No one has raised a Trial stone yet.</p>
            ) : (
              <div className="gm-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Calling</th>
                      <th>Players</th>
                      <th>Highest</th>
                      <th>Average</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.trials.map((t) => (
                      <tr key={t.cls}>
                        <td>{classOf(t.cls)}</td>
                        <td>{n0(t.players)}</td>
                        <td>{t.top}</td>
                        <td>{t.avg}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <h3 className="admin-h3">Boards</h3>
            <BoardSummaries boards={c.boards} />
          </section>
        </div>
      )}

      <BoardManager boards={['level', 'stone', 'trial', ...CLASS_IDS.map((cls) => `trial:${cls}`)]} title="Campaign boards" />
    </div>
  );
}

/* ------------------------------------------------------------------ the Vigil */

export function VigilAdmin() {
  const { data: v, error } = useApi<VigilAdminOverview>('/api/admin/sigilfall/boards?view=vigil');
  const lands = [...new Set([...VIGIL_MAPS.map((m) => m.id), ...(v?.lands ?? []).map((l) => l.land)])];
  return (
    <div className="gm sm">
      <section className="panel info-block" aria-labelledby="sm-vigil">
        <div className="admin-row">
          <h2 id="sm-vigil">
            <Icon name="moon" /> The Vigil
          </h2>
          <span className="mono info-small">longest nights, land by land</span>
        </div>
        <p className="info-small">
          Each signed-in player’s longest night in each land, from the save their game keeps on the server, and the Vigil’s boards. A night that can’t be right can be corrected, taken
          off, or kept off.
        </p>
        {error && <p className="info-small" role="alert">{error}</p>}
        {v && (
          <>
            <div className="gm-tiles">
              <Tile label="Players" value={n0(v.players)} />
              <Tile label="Played this week" value={n0(v.active7d)} />
              <Tile label="Longest night" value={clock(Math.max(0, ...v.lands.map((l) => l.top)))} />
              <Tile label="Lands held" value={v.lands.length} />
            </div>
            <div className="gm-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Land</th>
                    <th>Players</th>
                    <th>Played 7d</th>
                    <th>Longest</th>
                    <th>Average best</th>
                    <th>Held 10 min</th>
                  </tr>
                </thead>
                <tbody>
                  {v.lands.map((l) => (
                    <tr key={l.land}>
                      <td>
                        <b>{vigilLandOf(l.land)}</b>
                      </td>
                      <td>{n0(l.players)}</td>
                      <td>{n0(l.active7d)}</td>
                      <td>{clock(l.top)}</td>
                      <td>{clock(l.avg)}</td>
                      <td>
                        {n0(l.tenMinutes)} <span className="info-small">{pct(l.tenMinutes, l.players)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3 className="admin-h3">Boards</h3>
            <BoardSummaries boards={v.boards} />
          </>
        )}
      </section>
      <BoardManager boards={['vigil', ...lands.map((l) => `vigil:${l}`)]} title="The Vigil’s boards" />
    </div>
  );
}

/* ------------------------------------------------------------------ on a player's page */

/** One player's Ring: each format's standing, set by hand, and their rated matches. */
export function PlayerRing({ userId }: { userId: string }) {
  const { data, error, reload } = useApi<RingAdminPlayer>(`/api/admin/sigilfall/ring?view=player&user=${encodeURIComponent(userId)}`);
  const [editing, setEditing] = useState<number | null>(null);
  const [stamp, setStamp] = useState(0);
  const refresh = useCallback(() => {
    reload();
    setStamp((s) => s + 1);
  }, [reload]);
  const { toast, send } = useSend(refresh);
  return (
    <>
      <section className="panel info-block" aria-labelledby="sm-pring">
        <Toast text={toast} />
        <div className="admin-row">
          <h2 id="sm-pring">
            <Icon name="sword" /> The Ring
          </h2>
          <Link className="btn btn-sm" href="/admin?tab=sections&view=ring">
            Whole ladder
          </Link>
        </div>
        <p className="info-small">Their ranked standing in each format, as the server keeps it. Edit to set any of it.</p>
        {error && <p className="info-small" role="alert">{error}</p>}
        {data && (
          <div className="gm-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Format</th>
                  <th>Rating</th>
                  <th>Rank</th>
                  <th>Hidden</th>
                  <th>Best</th>
                  <th>W–L</th>
                  <th>Streak</th>
                  <th>Last match</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.standings.map((s) => (
                  <StandingRows
                    key={s.format}
                    s={s}
                    showPlayer={false}
                    open={editing === s.format}
                    onToggle={() => setEditing(editing === s.format ? null : s.format)}
                    send={async (body, done) => {
                      const ok = await send('/api/admin/sigilfall/ring', body, done);
                      if (ok) setEditing(null);
                      return ok;
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <Matches key={stamp} send={send} userId={userId} />
    </>
  );
}

/** Every board a player is on, with the ones they are kept off. */
export function PlayerBoards({ userId, nickname }: { userId: string; nickname: string }) {
  const { data, error, reload } = useApi<{ boards: { board: string; score: number; at: number; rank: number; held: boolean }[] }>(`/api/admin/sigilfall/boards?view=player&user=${encodeURIComponent(userId)}`);
  const { toast, send } = useSend(reload);
  const post = (board: string, body: Record<string, unknown>, done: string): Promise<boolean> => send('/api/admin/sigilfall/boards', { userId, board, ...body }, done);
  return (
    <section className="panel info-block" aria-labelledby="sm-pboards">
      <Toast text={toast} />
      <h2 id="sm-pboards">
        <Icon name="trophy" /> Rankings
      </h2>
      <p className="info-small">Every Sigilfall board {nickname} is on: the Campaign’s, the Ring’s and each land of the Vigil.</p>
      {error && <p className="info-small" role="alert">{error}</p>}
      {data && data.boards.length === 0 && <p className="info-small">Not on any board.</p>}
      {data && data.boards.length > 0 && (
        <div className="gm-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Board</th>
                <th>Place</th>
                <th>Score</th>
                <th>Since</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.boards.map((b) => (
                <tr key={b.board}>
                  <td>{boardName(b.board)}</td>
                  <td className="mono">{b.held ? '—' : `#${b.rank}`}</td>
                  <td>{b.held ? <span className="gm-chip is-warn">Kept off</span> : <b>{scoreOn(b.board, b.score)}</b>}</td>
                  <td><span className="info-small">{b.at ? when(b.at) : ''}</span></td>
                  <td>
                    <div className="sm-row-actions">
                      {b.held ? (
                        <button
                          className="btn btn-sm"
                          onClick={() => {
                            const why = askWhy(`Let ${nickname} back on ${boardName(b.board)}?`);
                            if (why !== null) void post(b.board, { action: 'unhold', note: why }, 'Let back on.');
                          }}
                        >
                          Let back on
                        </button>
                      ) : (
                        <>
                          <button
                            className="btn btn-sm"
                            onClick={() => {
                              const asked = window.prompt(`Set ${nickname}’s score on ${boardName(b.board)}${b.board.startsWith('vigil') ? ' (in seconds)' : ''}:`, String(b.score));
                              if (asked === null) return;
                              const why = askWhy('Set this score?');
                              if (why !== null) void post(b.board, { action: 'set', score: Number(asked), note: why }, 'Score set.');
                            }}
                          >
                            Set score
                          </button>
                          <button
                            className="btn btn-sm"
                            onClick={() => {
                              const why = askWhy(`Take ${nickname} off ${boardName(b.board)}?`);
                              if (why !== null) void post(b.board, { action: 'remove', note: why }, 'Taken off.');
                            }}
                          >
                            Take off
                          </button>
                          <button
                            className="btn btn-sm"
                            onClick={() => {
                              const why = askWhy(`Take ${nickname} off ${boardName(b.board)} and keep them off it?`);
                              if (why !== null) void post(b.board, { action: 'remove', hold: true, note: why }, 'Taken off, and kept off.');
                            }}
                          >
                            Keep off
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
