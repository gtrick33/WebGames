import { useCallback, useEffect, useState } from 'react';
import { GAMES } from '../catalog/games';
import { api, ApiError } from '../platform/account';
import type { AdminReports, CloudUsage } from '../platform/apiTypes';
import { fmt } from '../platform/daily';

const when = (ms: number): string => new Date(ms).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const gameName = (slug: string): string => GAMES.find((g) => g.slug === slug)?.title ?? (slug ? slug : 'Arcade');
const WISH: Record<string, string> = {
  more_games: 'More games',
  more_dailies: 'More dailies',
  harder: 'Harder',
  easier: 'Easier',
  multiplayer: 'Play vs friends',
  better_mobile: 'Better on phones',
  nothing: 'Nothing',
};

function bytes(n: number | null): string {
  if (n === null) return '–';
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/** A usage bar against a limit: green under 50%, amber under 80%, red above. */
function Meter({ label, value, limit, format = fmt }: { label: string; value: number | null; limit: number; format?: (n: number) => string }) {
  const pct = value === null ? 0 : Math.min(100, (value / limit) * 100);
  const tone = pct >= 80 ? 'bad' : pct >= 50 ? 'warn' : 'ok';
  return (
    <div className="meter">
      <div className="meter-head">
        <span>{label}</span>
        <span className="mono">
          {value === null ? '–' : format(value)} / {format(limit)} <b className={`meter-pct is-${tone}`}>{value === null ? '' : `${pct < 1 && pct > 0 ? '<1' : Math.round(pct)}%`}</b>
        </span>
      </div>
      <div className="meter-track" role="meter" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={value ?? 0} aria-label={label}>
        <i className={`is-${tone}`} style={{ width: `${Math.max(pct, value ? 1 : 0)}%` }} />
      </div>
    </div>
  );
}

export function CloudPanel() {
  const [data, setData] = useState<CloudUsage | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api<CloudUsage>('/api/admin/cloudflare')
      .then(setData)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : 'Could not load Cloudflare usage.'));
  }, []);
  if (error) return <section className="panel info-block"><h2>Cloudflare</h2><p>{error}</p></section>;
  if (!data) return <section className="panel info-block"><h2>Cloudflare</h2><p className="info-small">Loading usage…</p></section>;
  const today = data.analytics.days[data.analytics.days.length - 1];
  const peak = data.analytics.days.reduce((m, d) => Math.max(m, d.requests ?? 0), 0);
  const totalBytes = data.databases.reduce((n, d) => n + (d.sizeBytes ?? 0), 0);
  return (
    <section className="panel info-block cloud" aria-labelledby="cloud-title">
      <h2 id="cloud-title">Cloudflare usage · free plan</h2>
      <div className="cloud-meters">
        {data.analytics.status === 'ok' && today && (
          <>
            <Meter label="Function requests today" value={today.requests} limit={data.limits.requestsPerDay} />
            <Meter label="D1 rows read today" value={today.rowsRead} limit={data.limits.d1RowsReadPerDay} />
            <Meter label="D1 rows written today" value={today.rowsWritten} limit={data.limits.d1RowsWrittenPerDay} />
          </>
        )}
        <Meter label="D1 storage (all databases)" value={totalBytes} limit={data.limits.d1StorageBytesTotal} format={(n) => bytes(n)} />
        {data.databases.map((d) => (
          <Meter key={d.name} label={`${d.name} size`} value={d.sizeBytes} limit={data.limits.d1StorageBytesPerDb} format={(n) => bytes(n)} />
        ))}
      </div>

      {data.analytics.status === 'not_configured' && (
        <p className="info-small cloud-note">
          Daily requests and row reads need a read-only API token. In the Cloudflare dashboard create a token with <b>Account Analytics: Read</b>, then run{' '}
          <code>wrangler pages secret put CF_API_TOKEN --project-name glitchbound</code> and the same for <code>CF_ACCOUNT_ID</code>.
        </p>
      )}
      {data.analytics.error && <p className="info-small cloud-note">Some analytics could not load: {data.analytics.error}</p>}

      {data.analytics.status === 'ok' && (
        <div className="hall-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Day (UTC)</th>
                <th>Requests</th>
                <th>Errors</th>
                <th>D1 queries</th>
                <th>Rows read</th>
                <th>Rows written</th>
              </tr>
            </thead>
            <tbody>
              {[...data.analytics.days].reverse().map((d) => (
                <tr key={d.day}>
                  <td className="mono">{d.day.slice(5)}</td>
                  <td className={d.requests === peak && peak > 0 ? 'is-peak' : ''}>{d.requests === null ? '–' : fmt(d.requests)}</td>
                  <td className={d.errors ? 'is-bad' : ''}>{d.errors === null ? '–' : fmt(d.errors)}</td>
                  <td>{fmt(d.queries)}</td>
                  <td>{fmt(d.rowsRead)}</td>
                  <td>{fmt(d.rowsWritten)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <details className="cloud-tables">
        <summary>Rows per table</summary>
        <div className="info-cols">
          {data.databases.map((d) => (
            <table key={d.name} className="data-table">
              <thead>
                <tr>
                  <th>{d.name}</th>
                  <th>Rows</th>
                </tr>
              </thead>
              <tbody>
                {d.tables.map((t) => (
                  <tr key={t.name}>
                    <td className="mono">{t.name}</td>
                    <td>{fmt(t.rows)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </div>
      </details>
      <p className="info-small">Free-plan limits: 100,000 function requests a day, 5M D1 rows read and 100k written a day, 500 MB per database, 5 GB in total. Daily limits reset at 00:00 UTC.</p>
    </section>
  );
}

export function FeedbackPanel({ data }: { data: AdminReports['feedback'] }) {
  const max = Math.max(1, ...data.distribution);
  return (
    <section className="panel info-block" aria-labelledby="fb-admin-title">
      <h2 id="fb-admin-title">Player feedback · 30 days</h2>
      {data.total30d === 0 ? (
        <p>No ratings yet. The card appears in the lobby after a player finishes 3 rounds.</p>
      ) : (
        <>
          <p className="fb-avg">
            <b className="mono">{data.average.toFixed(2)}</b> ★ average from {fmt(data.total30d)} ratings
          </p>
          <div className="fb-dist">
            {[5, 4, 3, 2, 1].map((s) => (
              <div key={s} className="fb-dist-row">
                <span className="mono">{s}★</span>
                <span className="fb-dist-bar">
                  <i style={{ width: `${(data.distribution[s - 1]! / max) * 100}%` }} />
                </span>
                <span className="mono">{data.distribution[s - 1]}</span>
              </div>
            ))}
          </div>
          {data.byGame.length > 0 && <p className="info-small">{data.byGame.map((g) => `${gameName(g.game)} ${g.average.toFixed(1)}★ (${g.n})`).join(' · ')}</p>}
          {data.wishes.length > 0 && <p className="info-small">Players want: {data.wishes.map((w) => `${WISH[w.wish] ?? w.wish} ${w.n}`).join(' · ')}</p>}
          <ul className="err-list">
            {data.latest.map((f) => (
              <li key={f.ts}>
                <span className="mono err-kind">{'★'.repeat(f.stars)}</span>
                <span className="err-msg">{f.message}</span>
                <span className="mono info-small">
                  {when(f.ts)} · {gameName(f.game)} · {f.nickname ?? 'guest'} · {f.browser}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export function BugsPanel({ data, onChange }: { data: AdminReports['bugs']; onChange: () => void }) {
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [busy, setBusy] = useState(0);
  const set = useCallback(
    async (id: number, status: string, current: string) => {
      const note = window.prompt(status === 'fixed' ? 'Note for the reporter (optional):' : 'Reason (optional):', current) ?? null;
      if (note === null) return;
      setBusy(id);
      try {
        await api('/api/admin/bugs', { body: { id, status, note } });
        onChange();
      } finally {
        setBusy(0);
      }
    },
    [onChange],
  );
  const list = data.list.filter((b) => filter === 'all' || b.status === 'open');
  return (
    <section className="panel info-block" aria-labelledby="bugs-admin-title">
      <div className="admin-row">
        <h2 id="bugs-admin-title">
          Bug reports · {data.open} open · {data.fixed} fixed
        </h2>
        <span className="mono info-small">{data.github ? 'Mirrored to GitHub issues (label: bug)' : 'GitHub mirroring off (set the GITHUB_TOKEN secret)'}</span>
        <div className="seg" role="group" aria-label="Filter">
          <button className={filter === 'open' ? 'is-on' : ''} onClick={() => setFilter('open')}>
            Open
          </button>
          <button className={filter === 'all' ? 'is-on' : ''} onClick={() => setFilter('all')}>
            All
          </button>
        </div>
      </div>
      {list.length === 0 ? (
        <p>{filter === 'open' ? 'No open bugs. Ship it.' : 'No reports yet.'}</p>
      ) : (
        <ul className="bug-admin">
          {list.map((b) => (
            <li key={b.id} className={`bug-admin-item sev-${b.severity}`}>
              <details>
                <summary>
                  <span className="mono err-kind">
                    #{b.id} {b.severity} · {b.category}
                  </span>
                  <b>{b.title}</b>
                  <span className="mono info-small">
                    {gameName(b.game)} · {when(b.ts)} · {b.nickname ?? 'guest'} · {b.status}
                  </span>
                </summary>
                <p className="bug-desc">{b.description}</p>
                <p className="mono info-small">
                  {b.device}
                  {b.page ? ` · from ${b.page}` : ''}
                  {b.contact ? ` · ${b.contact}` : ''}
                </p>
                {b.note && <p className="info-small">Note: {b.note}</p>}
                {b.issueUrl && (
                  <p className="info-small">
                    <a href={b.issueUrl} target="_blank" rel="noreferrer">
                      Open the GitHub issue
                    </a>
                  </p>
                )}
                <div className="reset-row">
                  {b.status !== 'fixed' && (
                    <button className="btn btn-sm btn-primary" disabled={busy === b.id} onClick={() => void set(b.id, 'fixed', b.note)}>
                      Mark fixed
                    </button>
                  )}
                  {b.status !== 'wontfix' && (
                    <button className="btn btn-sm" disabled={busy === b.id} onClick={() => void set(b.id, 'wontfix', b.note)}>
                      Close
                    </button>
                  )}
                  {b.status !== 'open' && (
                    <button className="btn btn-sm btn-ghost" disabled={busy === b.id} onClick={() => void set(b.id, 'open', b.note)}>
                      Reopen
                    </button>
                  )}
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Feedback + bugs, loaded together. */
export function ReportsPanels() {
  const [data, setData] = useState<AdminReports | null>(null);
  const load = useCallback(() => {
    api<AdminReports>('/api/admin/reports')
      .then(setData)
      .catch(() => setData(null));
  }, []);
  useEffect(load, [load]);
  if (!data) return null;
  return (
    <>
      <BugsPanel data={data.bugs} onChange={load} />
      <FeedbackPanel data={data.feedback} />
    </>
  );
}
