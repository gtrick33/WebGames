import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { GAMES } from '../catalog/games';
import { Icon } from '../components/Icon';
import { openSignIn } from '../components/SignIn';
import { api, ApiError, useAccount } from '../platform/account';
import type { AdminStats } from '../platform/apiTypes';
import { fmt } from '../platform/daily';
import { usePageMeta } from '../platform/meta';
import './InfoPages.css';
import './AdminPage.css';

const when = (ms: number): string => new Date(ms).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="stat-tile">
      <span className="mono">{label}</span>
      <b>{value}</b>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  );
}

/** Single-series bars (one measure, one axis), with exact values on hover and in the table below. */
function DailyBars({ data, metric, label }: { data: AdminStats['daily']; metric: 'visitors' | 'starts' | 'rounds' | 'returning' | 'dailyPlayers'; label: string }) {
  const max = Math.max(1, ...data.map((d) => d[metric]));
  return (
    <figure className="bars">
      <figcaption className="mono">{label} · last 14 days</figcaption>
      <div className="bars-plot" role="img" aria-label={`${label} per day: ${data.map((d) => `${d.day.slice(5)} ${d[metric]}`).join(', ')}`}>
        {data.map((d) => (
          <div key={d.day} className="bar-col" data-tip={`${d.day}: ${fmt(d[metric])}`}>
            <span className="bar" style={{ height: `${(d[metric] / max) * 100}%` }} />
            <span className="bar-x mono">{d.day.slice(8)}</span>
          </div>
        ))}
      </div>
    </figure>
  );
}

function Announce({ stats, onSent }: { stats: AdminStats; onSent: () => void }) {
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [game, setGame] = useState(GAMES[0]?.slug ?? '');
  const g = GAMES.find((x) => x.slug === game);
  const [subject, setSubject] = useState(g ? `New on GlitchBound: ${g.title}` : '');
  const [message, setMessage] = useState('');

  const send = async (action: 'test' | 'send' | 'confirmations', e?: FormEvent): Promise<void> => {
    e?.preventDefault();
    if (action === 'send' && !window.confirm(`Send "${subject}" to ${stats.subscribers.confirmed} confirmed subscribers?`)) return;
    setBusy(true);
    setMsg('');
    try {
      const r = await api<{ sent: number; to?: string }>('/api/admin/announce', { body: { action, game, subject, message } });
      setMsg(action === 'test' ? `Test sent to ${r.to}.` : action === 'confirmations' ? `Sent ${r.sent} confirmation emails.` : `Sent to ${r.sent} subscribers.`);
      onSent();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : 'Sending failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="panel info-block announce" onSubmit={(e) => void send('send', e)}>
      <h2>
        <Icon name="mail" /> Announce a game
      </h2>
      {!stats.emailEnabled && (
        <p className="admin-warn">
          Email sending is off: add the Resend API key (docs/LAUNCH-GUIDE.md, section 3). Signups are still being collected.
        </p>
      )}
      <label>
        <span className="mono">Game</span>
        <select
          className="field"
          value={game}
          onChange={(e) => {
            setGame(e.target.value);
            const ng = GAMES.find((x) => x.slug === e.target.value);
            if (ng) setSubject(`New on GlitchBound: ${ng.title}`);
          }}
        >
          {GAMES.map((x) => (
            <option key={x.slug} value={x.slug}>
              {x.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="mono">Subject</span>
        <input className="field" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} required />
      </label>
      <label>
        <span className="mono">Message</span>
        <textarea className="field" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} required placeholder="A few lines about the new game." />
      </label>
      <div className="reset-row">
        <button type="button" className="btn" disabled={busy || !stats.emailEnabled || !message} onClick={() => void send('test')}>
          Send test to me
        </button>
        <button className="btn btn-primary" disabled={busy || !stats.emailEnabled || !message || stats.subscribers.confirmed === 0}>
          Send to {fmt(stats.subscribers.confirmed)} subscribers
        </button>
        {stats.subscribers.pending > 0 && (
          <button type="button" className="btn btn-ghost" disabled={busy || !stats.emailEnabled} onClick={() => void send('confirmations')}>
            Email {stats.subscribers.pending} pending confirmations
          </button>
        )}
      </div>
      {msg && (
        <p className="info-small" role="status">
          {msg}
        </p>
      )}
    </form>
  );
}

export function AdminPage() {
  usePageMeta({ title: 'Admin', path: '/admin' });
  const { me, status } = useAccount();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api<AdminStats>('/api/admin/stats')
      .then((s) => {
        setStats(s);
        setError('');
      })
      .catch((e: unknown) => setError(e instanceof ApiError && e.status === 403 ? 'forbidden' : 'failed'));
  }, []);

  useEffect(() => {
    if (me?.isAdmin) load();
  }, [me?.isAdmin, load]);

  if (status === 'loading') return <div className="wrap info-page"><p className="info-lead">Loading…</p></div>;
  if (!me) {
    return (
      <div className="wrap info-page">
        <h1 className="info-title">Admin</h1>
        <p className="info-lead">Sign in with the admin Google account.</p>
        <div>
          <button className="btn btn-magenta" onClick={() => openSignIn()}>
            Sign in
          </button>
        </div>
      </div>
    );
  }
  if (!me.isAdmin || error === 'forbidden') {
    return (
      <div className="wrap info-page">
        <h1 className="info-title">Admin</h1>
        <p className="info-lead">This page is only for GlitchBound admins.</p>
      </div>
    );
  }
  if (!stats) return <div className="wrap info-page"><p className="info-lead">{error ? 'Could not load stats.' : 'Loading stats…'}</p></div>;

  const week = stats.daily.slice(-7);
  const sum = (k: 'visitors' | 'returning' | 'dailyPlayers'): number => week.reduce((n, d) => n + d[k], 0);
  const pct = (n: number, of: number): string | undefined => (of ? `${Math.round((n / of) * 100)}% of visitors` : undefined);
  const totals = stats.games.reduce((a, g) => ({ views: a.views + g.views, starts: a.starts + g.starts, ends: a.ends + g.ends }), { views: 0, starts: 0, ends: 0 });
  return (
    <div className="wrap info-page admin">
      <div className="admin-head">
        <div>
          <p className="eyebrow">
            <Icon name="chart" size={16} /> Admin · updated {when(stats.generatedAt)}
          </p>
          <h1 className="info-title">Dashboard</h1>
        </div>
        <div className="reset-row">
          <button className="btn btn-sm" onClick={load}>
            <Icon name="restart" size={16} /> Refresh
          </button>
          <a className="btn btn-sm" href="/api/admin/subscribers">
            <Icon name="mail" size={16} /> Export subscribers (CSV)
          </a>
        </div>
      </div>

      <div className="stat-tiles">
        <Tile label="Members" value={fmt(stats.users.total)} sub={`+${stats.users.new7d} this week · ${stats.users.active7d} active`} />
        <Tile label="Game views (30d)" value={fmt(totals.views)} />
        <Tile label="Rounds started (30d)" value={fmt(totals.starts)} sub={totals.views ? `${Math.round((totals.starts / totals.views) * 100)}% of views` : undefined} />
        <Tile label="Email list" value={fmt(stats.subscribers.confirmed)} sub={`${stats.subscribers.pending} pending · ${stats.subscribers.unsubscribed} left`} />
        <Tile label="Returning visitors (7d)" value={fmt(sum('returning'))} sub={pct(sum('returning'), sum('visitors'))} />
        <Tile label="Finished a daily (7d)" value={fmt(sum('dailyPlayers'))} sub={pct(sum('dailyPlayers'), sum('visitors'))} />
        <Tile label="Errors (7d)" value={fmt(stats.errors.kinds.reduce((n, k) => n + k.n, 0))} />
      </div>

      <div className="info-cols">
        <div className="panel info-block">
          <DailyBars data={stats.daily} metric="visitors" label="Unique visitors" />
        </div>
        <div className="panel info-block">
          <DailyBars data={stats.daily} metric="starts" label="Rounds started" />
        </div>
        <div className="panel info-block">
          <DailyBars data={stats.daily} metric="returning" label="Returning visitors" />
        </div>
        <div className="panel info-block">
          <DailyBars data={stats.daily} metric="dailyPlayers" label="Visitors who finished a daily" />
        </div>
      </div>

      <section className="panel info-block" aria-labelledby="games-title">
        <h2 id="games-title">Games · last 30 days</h2>
        <div className="hall-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Game</th>
                <th>Views</th>
                <th>Starts</th>
                <th>Finished</th>
                <th>Players</th>
                <th>Member rounds</th>
                <th>Avg score</th>
                <th>Top score</th>
                <th>Load errors</th>
              </tr>
            </thead>
            <tbody>
              {stats.games.map((g) => (
                <tr key={g.slug}>
                  <td>
                    <b>{g.title}</b>
                  </td>
                  <td>{fmt(g.views)}</td>
                  <td>{fmt(g.starts)}</td>
                  <td>{fmt(g.ends)}</td>
                  <td title="Distinct visitor-days that started a round">{fmt(g.visitors)}</td>
                  <td>{fmt(g.signedInRounds)}</td>
                  <td>{g.avgScore === null ? '–' : fmt(g.avgScore)}</td>
                  <td>{g.bestScore === null ? '–' : fmt(g.bestScore)}</td>
                  <td className={g.loadErrors ? 'is-bad' : ''}>{fmt(g.loadErrors)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="info-cols">
        <section className="panel info-block" aria-labelledby="errors-title">
          <h2 id="errors-title">Bugs &amp; crashes</h2>
          {stats.errors.latest.length === 0 ? (
            <p>No errors reported. Nice.</p>
          ) : (
            <>
              <p className="info-small">{stats.errors.kinds.map((k) => `${k.kind}: ${k.n}`).join(' · ') || 'None in the last 7 days.'}</p>
              <ul className="err-list">
                {stats.errors.latest.map((e, i) => (
                  <li key={i}>
                    <span className="mono err-kind">{e.kind}</span>
                    <span className="err-msg">{e.message}</span>
                    <span className="mono info-small">
                      {when(e.ts)} · {e.game || e.path} · {e.browser}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="panel info-block" aria-labelledby="search-title">
          <h2 id="search-title">Top searches (30d)</h2>
          {stats.searches.length === 0 ? (
            <p>No searches yet.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Query</th>
                  <th>Times</th>
                  <th>No results</th>
                </tr>
              </thead>
              <tbody>
                {stats.searches.map((s) => (
                  <tr key={s.q}>
                    <td>{s.q}</td>
                    <td>{s.n}</td>
                    <td className={s.zeroResults ? 'is-bad' : ''}>{s.zeroResults}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="info-small">Searches with no results hint at games people want.</p>
        </section>
      </div>

      <div className="info-cols">
        <Announce stats={stats} onSent={load} />
        <section className="panel info-block" aria-labelledby="members-title">
          <h2 id="members-title">Newest members</h2>
          {stats.users.recent.length === 0 ? (
            <p>No members yet.</p>
          ) : (
            <table className="data-table">
              <tbody>
                {stats.users.recent.map((u) => (
                  <tr key={u.email}>
                    <td>
                      <b>{u.nickname}</b>
                    </td>
                    <td className="info-small">{u.email}</td>
                    <td className="info-small">{when(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <h3 className="admin-h3">Past announcements</h3>
          {stats.announcements.length === 0 ? (
            <p className="info-small">None yet.</p>
          ) : (
            <ul className="err-list">
              {stats.announcements.map((a) => (
                <li key={a.sentAt}>
                  <span className="err-msg">{a.subject}</span>
                  <span className="mono info-small">
                    {when(a.sentAt)} · {a.recipients} recipients
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <p className="info-small">
        Privacy: visitor counts use a daily-rotating anonymous key (no cookies, no stored IPs). &ldquo;Returning&rdquo; comes from the visitor&rsquo;s own browser (it only reports new/returning and days since the last visit). Only members' rounds are tied to an account.
      </p>
    </div>
  );
}
