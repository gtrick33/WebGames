import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Icon } from '../components/Icon';
import { api, ApiError } from '../platform/account';
import type { AuditRow, StaffRow } from '../platform/apiTypes';
import './QaPanel.css';

/**
 * Admin › QA team (admins only): invite QA testers by email, block, unblock or remove them, and read
 * the QA audit trail (every request and action of every tester, kept for legal purposes).
 */

const when = (ms: number): string => new Date(ms).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
const errorText = (e: unknown, fallback: string): string => (e instanceof ApiError ? (e.message && e.message !== e.code ? e.message : fallback) : 'Network error. Try again.');

const STATUS: Record<StaffRow['status'], { label: string; tone: string }> = {
  invited: { label: 'Invited', tone: '' },
  expired: { label: 'Invite expired', tone: 'is-bad' },
  active: { label: 'Active', tone: 'is-good' },
  blocked: { label: 'Blocked', tone: 'is-bad' },
};

export function QaTeam() {
  const [staff, setStaff] = useState<StaffRow[] | null>(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    api<{ staff: StaffRow[] }>('/api/admin/staff')
      .then((r) => setStaff(r.staff))
      .catch((e: unknown) => setMsg(errorText(e, 'Could not load the QA team.')));
  }, []);
  useEffect(load, [load]);

  const act = async (action: 'invite' | 'block' | 'unblock' | 'remove', address: string, done: string): Promise<boolean> => {
    setBusy(true);
    setMsg('');
    try {
      const r = await api<{ staff: StaffRow[]; sent?: boolean; devLink?: string }>('/api/admin/staff', { body: { action, email: address } });
      setStaff(r.staff);
      setMsg(action === 'invite' && r.sent === false ? `Invitation saved, but email sending is off, so no email went out.${r.devLink ? ` Local test link: ${r.devLink}` : ''}` : done);
      return true;
    } catch (e) {
      setMsg(errorText(e, 'That did not work.'));
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ag qa">
      <section className="panel info-block" aria-labelledby="qt-team">
        <div className="admin-row">
          <h2 id="qt-team">
            <Icon name="user" /> QA team
          </h2>
          <span className="mono info-small">{staff ? `${staff.filter((s) => s.status === 'active').length} active` : ''}</span>
        </div>
        <p className="info-small">
          QA testers see only the QA tab of this panel: player lookup, coins, bans, emails to players and the testing tools. Everything they do is recorded below. Invitations are one-time links, valid for 7 days, and only work
          for an account signed in with the invited address.
        </p>
        <form
          className="qa-search"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            const address = email.trim();
            void act('invite', address, `Invitation sent to ${address}`).then((ok) => ok && setEmail(''));
          }}
        >
          <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tester@example.com" aria-label="Email to invite" required />
          <button className="btn btn-primary btn-sm" disabled={busy}>
            <Icon name="mail" size={16} /> Invite to QA
          </button>
        </form>
        {msg && (
          <p className="info-small" role="status">
            {msg}
          </p>
        )}
        {!staff ? (
          <p className="info-small">Loading…</p>
        ) : staff.length === 0 ? (
          <p>No QA testers yet. Invite one above.</p>
        ) : (
          <div className="hall-wrap">
            <table className="data-table qa-table">
              <thead>
                <tr>
                  <th>Tester</th>
                  <th>Status</th>
                  <th>Invited</th>
                  <th>Last activity</th>
                  <th>Actions (30d)</th>
                  <th aria-label="Manage" />
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.email}>
                    <td>
                      <b>{s.email}</b>
                      {s.nickname && <div className="info-small">{s.nickname}</div>}
                    </td>
                    <td>
                      <span className={`qa-pill ${STATUS[s.status].tone}`}>{STATUS[s.status].label}</span>
                    </td>
                    <td className="qa-dim">
                      {when(s.invitedAt)}
                      <br />
                      by {s.invitedBy}
                    </td>
                    <td className="qa-dim">{s.lastActivity ? when(s.lastActivity) : '–'}</td>
                    <td>{s.actions30d}</td>
                    <td>
                      <div className="qa-row-actions">
                        {(s.status === 'invited' || s.status === 'expired') && (
                          <button className="btn btn-sm" disabled={busy} onClick={() => void act('invite', s.email, `New invitation sent to ${s.email}`)}>
                            Resend invite
                          </button>
                        )}
                        {s.status === 'blocked' ? (
                          <button className="btn btn-sm btn-lime" disabled={busy} onClick={() => void act('unblock', s.email, `${s.email} is unblocked`)}>
                            Unblock
                          </button>
                        ) : (
                          <button
                            className="btn btn-sm"
                            disabled={busy}
                            onClick={() => {
                              if (window.confirm(`Block ${s.email}? Their QA access stops right away.`)) void act('block', s.email, `${s.email} is blocked`);
                            }}
                          >
                            Block
                          </button>
                        )}
                        <button
                          className="btn btn-sm btn-ghost qa-danger-text"
                          disabled={busy}
                          onClick={() => {
                            if (window.confirm(`Remove ${s.email} from the QA team? Their audit trail is kept.`)) void act('remove', s.email, `${s.email} was removed`);
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <AuditLog staff={staff ?? []} />
    </div>
  );
}

const KINDS = [
  ['action', 'QA actions'],
  ['request', 'Requests'],
  ['auth', 'Sign-ins'],
  ['', 'Everything'],
] as const;

function AuditLog({ staff }: { staff: StaffRow[] }) {
  const [actor, setActor] = useState('');
  const [kind, setKind] = useState<(typeof KINDS)[number][0]>('action');
  const [target, setTarget] = useState('');
  const [applied, setApplied] = useState('');
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [more, setMore] = useState(false);
  // Testers with rows on record: removed ones can still be picked.
  const [actors, setActors] = useState<string[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const params = new URLSearchParams();
  if (actor) params.set('actor', actor);
  if (kind) params.set('kind', kind);
  if (applied) params.set('target', applied);
  const query = params.toString();

  const fetchPage = useCallback(
    (before?: number) =>
      api<{ rows: AuditRow[]; more: boolean; actors?: string[] }>(`/api/admin/qa-audit?${query}${before ? `&before=${before}` : ''}`).then(
        (r) => {
          setRows((prev) => (before && prev ? [...prev, ...r.rows] : r.rows));
          setMore(r.more);
          setActors(r.actors ?? []);
          setError('');
        },
        (e: unknown) => setError(errorText(e, 'Could not load the audit trail.')),
      ),
    [query],
  );
  useEffect(() => {
    void fetchPage();
  }, [fetchPage]);

  return (
    <section className="panel info-block" aria-labelledby="qt-audit">
      <div className="admin-row">
        <h2 id="qt-audit">
          <Icon name="chart" /> QA audit trail
        </h2>
        <a className="btn btn-sm" href={`/api/admin/qa-audit?${query}${query ? '&' : ''}format=csv`}>
          Export CSV
        </a>
      </div>
      <p className="info-small">Every request a QA tester makes, every QA tool they use and their sign-ins, with time, IP address and browser. Rows can’t be edited or deleted. Admins are not recorded.</p>
      <div className="qa-filters">
        <select className="field" value={actor} onChange={(e) => setActor(e.target.value)} aria-label="Tester">
          <option value="">Every tester</option>
          {[...new Set([...staff.map((s) => s.email), ...actors])].map((email) => (
            <option key={email} value={email}>
              {email}
              {staff.some((s) => s.email === email) ? '' : ' (removed)'}
            </option>
          ))}
        </select>
        <div className="seg" role="radiogroup" aria-label="Kind">
          {KINDS.map(([id, label]) => (
            <button key={id || 'all'} role="radio" aria-checked={kind === id} className={kind === id ? 'is-on' : ''} onClick={() => setKind(id)}>
              {label}
            </button>
          ))}
        </div>
        <form
          className="qa-inline"
          onSubmit={(e) => {
            e.preventDefault();
            setApplied(target.trim());
          }}
        >
          <input className="field" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Player id or email" aria-label="Player" />
          <button className="btn btn-sm">Filter</button>
        </form>
      </div>
      {error && <p className="admin-warn">{error}</p>}
      {!rows ? (
        <p className="info-small">Loading…</p>
      ) : rows.length === 0 ? (
        <p>Nothing recorded{query ? ' for this filter' : ' yet'}.</p>
      ) : (
        <div className="hall-wrap">
          <table className="data-table qa-table qa-audit">
            <thead>
              <tr>
                <th>When</th>
                <th>Tester</th>
                <th>What</th>
                <th>Player</th>
                <th>Result</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <AuditLine key={r.id} row={r} open={openId === r.id} onToggle={() => setOpenId(openId === r.id ? null : r.id)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {more && rows && (
        <button className="btn btn-sm" onClick={() => void fetchPage(rows[rows.length - 1]!.id)}>
          Load older
        </button>
      )}
    </section>
  );
}

function AuditLine({ row, open, onToggle }: { row: AuditRow; open: boolean; onToggle: () => void }) {
  let detail = row.detail;
  try {
    detail = JSON.stringify(JSON.parse(row.detail), null, 2);
  } catch {
    /* keep the raw text */
  }
  const bad = row.status !== null && row.status >= 400;
  return (
    <>
      <tr className={`qa-audit-row${open ? ' is-open' : ''}`} onClick={onToggle}>
        <td className="qa-dim mono">{when(row.ts)}</td>
        <td className="qa-dim">{row.actor}</td>
        <td>
          <span className={`qa-pill qa-kind-${row.kind}`}>{row.kind}</span> <b className="mono">{row.action}</b>
        </td>
        <td className="qa-dim">{row.targetEmail ?? row.targetId ?? '–'}</td>
        <td className={bad ? 'is-bad' : 'qa-dim'}>{row.status ?? 'ok'}</td>
        <td className="qa-dim mono">{row.ip || '–'}</td>
      </tr>
      {open && (
        <tr className="qa-audit-detail">
          <td colSpan={6}>
            <pre>{detail}</pre>
            <p className="info-small">
              #{row.id} · {row.userAgent || 'unknown browser'}
              {row.targetId && ` · player ${row.targetId}`}
            </p>
          </td>
        </tr>
      )}
    </>
  );
}
