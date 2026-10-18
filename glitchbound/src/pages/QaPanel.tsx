import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { GAMES } from '../catalog/games';
import { Icon } from '../components/Icon';
import { account, api, ApiError } from '../platform/account';
import type { Me, QaPlayer, QaPlayerRow, StaffRole } from '../platform/apiTypes';
import { fmt } from '../platform/daily';
import { dayKey } from '../platform/dates';
import { useLiveCatalog } from '../platform/liveCatalog';
import { clearDeviceAll, clearDeviceGame, debugInfo, deviceKeysFor, logQa } from '../platform/qa';
import { Link } from '../router/router';
import './QaPanel.css';

/**
 * Admin › QA: the tools QA testers (and admins) use. Look up a player and give them coins for a
 * game, ban or unban them, or email them from hello@glitchboundstudio.com; and test games without
 * getting in the way (hidden games, resetting your own progress, clearing this device). For QA
 * testers every request is written to the audit trail (functions/api/_middleware.ts).
 */

const when = (ms: number): string => new Date(ms).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const WALLET_GAMES = GAMES.filter((g) => g.wallet);
const titleOf = (slug: string): string => GAMES.find((g) => g.slug === slug)?.title ?? slug;
const errorText = (e: unknown, fallback: string): string => (e instanceof ApiError ? (e.message && e.message !== e.code ? e.message : fallback) : 'Network error. Try again.');
const ROLE_LABEL: Record<StaffRole, string> = { admin: 'Admin', qa: 'QA' };

type Flash = (msg: string) => void;

export function QaPanel({ me }: { me: Me }) {
  const [toast, setToast] = useState('');
  const [player, setPlayer] = useState<QaPlayer | null>(null);
  const [loading, setLoading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(''), 3000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const openPlayer = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const r = await api<{ player: QaPlayer }>(`/api/qa/players/${encodeURIComponent(id)}`);
      setPlayer(r.player);
      window.requestAnimationFrame(() => cardRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
    } catch (e) {
      setToast(errorText(e, 'Could not open that player.'));
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="ag qa">
      <p className="ag-toast" role="status" aria-live="polite">
        {toast}
      </p>
      {me.role === 'qa' ? (
        <p className="qa-recorded" role="note">
          <Icon name="bug" size={18} /> Everything you do in the QA panel, and every request your account makes, is recorded in the QA audit trail for legal reasons.
        </p>
      ) : (
        <p className="info-small">You’re an admin: what you do here is not written to the QA audit trail.</p>
      )}
      <PlayerSearch onOpen={(id) => void openPlayer(id)} busy={loading} meId={me.id} />
      <div ref={cardRef} className="qa-card-anchor">
        {player && <PlayerCard key={player.id} player={player} me={me} onChange={setPlayer} onReload={() => void openPlayer(player.id)} flash={setToast} onClose={() => setPlayer(null)} />}
      </div>
      <TestingTools me={me} flash={setToast} onOpenSelf={() => void openPlayer(me.id)} />
    </div>
  );
}

/* ------------------------------------------------------------------ players */

function PlayerSearch({ onOpen, busy, meId }: { onOpen: (id: string) => void; busy: boolean; meId: string }) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<QaPlayerRow[] | null>(null);
  const [searched, setSearched] = useState('');
  const [error, setError] = useState('');

  const find = useCallback(
    (term: string) =>
      api<{ players: QaPlayerRow[] }>(`/api/qa/players?q=${encodeURIComponent(term)}`).then(
        (r) => {
          setRows(r.players);
          setSearched(term);
          setError('');
        },
        (e: unknown) => setError(errorText(e, 'Search failed.')),
      ),
    [],
  );

  useEffect(() => {
    void find('');
  }, [find]);

  return (
    <section className="panel info-block" aria-labelledby="qa-players">
      <div className="admin-row">
        <h2 id="qa-players">
          <Icon name="user" /> Players
        </h2>
        <button className="btn btn-sm" onClick={() => onOpen(meId)} disabled={busy}>
          Open my account
        </button>
      </div>
      <form
        className="qa-search"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void find(q.trim());
        }}
      >
        <input className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Email, nickname or player id" aria-label="Find a player" maxLength={80} />
        <button className="btn btn-primary btn-sm">
          <Icon name="search" size={16} /> Find
        </button>
      </form>
      {error && <p className="admin-warn">{error}</p>}
      {rows && (
        <>
          <p className="info-small">{searched ? `${rows.length} match${rows.length === 1 ? '' : 'es'} for “${searched}”` : 'Most recently seen players'}</p>
          {rows.length === 0 ? (
            <p>No players found.</p>
          ) : (
            <div className="hall-wrap">
              <table className="data-table qa-table">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Email</th>
                    <th>Level</th>
                    <th>Last seen</th>
                    <th aria-label="Open" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id} className={p.banned ? 'is-banned' : ''}>
                      <td>
                        <b>{p.nickname}</b> {p.role && <span className="qa-pill">{ROLE_LABEL[p.role]}</span>}
                        {p.banned && <span className="qa-pill is-bad">Banned</span>}
                      </td>
                      <td className="qa-dim">{p.email}</td>
                      <td>{p.level}</td>
                      <td className="qa-dim">{when(p.lastSeen)}</td>
                      <td>
                        <button className="btn btn-sm" onClick={() => onOpen(p.id)} disabled={busy}>
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="qa-fact">
      <span className="mono">{label}</span>
      <b>{children}</b>
    </div>
  );
}

function PlayerCard({ player, me, onChange, onReload, flash, onClose }: { player: QaPlayer; me: Me; onChange: (p: QaPlayer) => void; onReload: () => void; flash: Flash; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const self = player.id === me.id;
  const run = async (path: string, body: Record<string, unknown>, done: string): Promise<boolean> => {
    setBusy(true);
    try {
      const r = await api<{ player: QaPlayer }>(path, { body: { userId: player.id, ...body } });
      onChange(r.player);
      flash(done);
      return true;
    } catch (e) {
      flash(errorText(e, 'That did not work.'));
      onReload();
      return false;
    } finally {
      setBusy(false);
    }
  };
  const banBlocked = self ? 'You can’t ban your own account.' : player.role === 'admin' ? 'Admins can’t be banned.' : player.role === 'qa' && me.role !== 'admin' ? 'QA accounts can only be banned by an admin.' : '';

  return (
    <section className={`panel info-block qa-player${player.ban ? ' is-banned' : ''}`} aria-labelledby="qa-player-name" aria-busy={busy}>
      <div className="admin-row">
        <h2 id="qa-player-name">
          {player.nickname} {player.role && <span className="qa-pill">{ROLE_LABEL[player.role]}</span>}
          {player.ban && <span className="qa-pill is-bad">Banned</span>}
        </h2>
        <button className="btn btn-sm btn-ghost" onClick={onClose}>
          <Icon name="close" size={16} /> Close
        </button>
      </div>
      <div className="qa-facts">
        <Fact label="Email">{player.email}</Fact>
        <Fact label="Player id">
          <span className="mono qa-id">{player.id}</span>
        </Fact>
        <Fact label="Joined">{when(player.createdAt)}</Fact>
        <Fact label="Last seen">{when(player.lastSeen)}</Fact>
        <Fact label="Level">
          {player.level} · {fmt(player.xp)} XP
        </Fact>
        <Fact label="Rounds">{fmt(player.rounds)}</Fact>
      </div>

      <div className="qa-tools">
        <CoinsTool player={player} busy={busy} onGive={(game, amount, note) => run('/api/qa/coins', { game, amount, note }, `${fmt(amount)} ${titleOf(game)} coins are on their way`)} />
        <BanTool player={player} busy={busy} blocked={banBlocked} onBan={(banned, reason) => run('/api/qa/ban', { banned, reason }, banned ? `${player.nickname} is banned` : `${player.nickname} can play again`)} />
        <EmailTool player={player} busy={busy} onSend={(subject, message) => run('/api/qa/email', { subject, message }, `Email sent to ${player.email}`)} />
      </div>

      <div className="info-cols qa-history">
        <div>
          <h3 className="admin-h3">Coin gifts</h3>
          {player.grants.length === 0 ? (
            <p className="info-small">None yet.</p>
          ) : (
            <table className="data-table">
              <tbody>
                {player.grants.map((g) => (
                  <tr key={g.id}>
                    <td>
                      <b>+{fmt(g.amount)}</b> {titleOf(g.game)}
                      {g.note && <div className="info-small">“{g.note}”</div>}
                    </td>
                    <td className="qa-dim">
                      {g.by}
                      <br />
                      {when(g.at)}
                    </td>
                    <td>{g.claimedAt ? <span className="qa-pill is-good">Collected</span> : <span className="qa-pill">Waiting</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div>
          <h3 className="admin-h3">Emails from GlitchBound</h3>
          {player.emails.length === 0 ? (
            <p className="info-small">None yet.</p>
          ) : (
            <ul className="err-list">
              {player.emails.map((m) => (
                <li key={m.at}>
                  <span className="err-msg">
                    {m.ok ? '' : '⚠️ Not sent: '}
                    <b>{m.subject}</b>
                  </span>
                  <details>
                    <summary className="info-small">Message</summary>
                    <p className="qa-mail-body">{m.body}</p>
                  </details>
                  <span className="mono info-small">
                    {when(m.at)} · {m.by}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="admin-h3">Personal bests</h3>
          {player.bests.length === 0 ? (
            <p className="info-small">No rounds while signed in.</p>
          ) : (
            <table className="data-table">
              <tbody>
                {player.bests.map((b) => (
                  <tr key={b.game}>
                    <td>{titleOf(b.game)}</td>
                    <td>
                      <b>{fmt(b.score)}</b>
                    </td>
                    <td className="qa-dim">{when(b.at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div>
          <h3 className="admin-h3">Latest rounds</h3>
          {player.runs.length === 0 ? (
            <p className="info-small">None.</p>
          ) : (
            <table className="data-table">
              <tbody>
                {player.runs.map((r, i) => (
                  <tr key={i}>
                    <td>{titleOf(r.game)}</td>
                    <td>{r.score === null ? '–' : fmt(r.score)}</td>
                    <td className={r.status === 'rejected' ? 'is-bad' : 'qa-dim'}>{r.status === 'ok' ? 'finished' : r.status}</td>
                    <td className="qa-dim">{when(r.at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}

function CoinsTool({ player, busy, onGive }: { player: QaPlayer; busy: boolean; onGive: (game: string, amount: number, note: string) => Promise<boolean> }) {
  const [game, setGame] = useState(WALLET_GAMES[0]?.slug ?? '');
  const [amount, setAmount] = useState('500');
  const [note, setNote] = useState('');
  const n = Math.floor(Number(amount));
  return (
    <form
      className="qa-tool"
      onSubmit={(e) => {
        e.preventDefault();
        if (!window.confirm(`Give ${player.nickname} ${fmt(n)} coins in ${titleOf(game)}?`)) return;
        void onGive(game, n, note.trim()).then((ok) => ok && setNote(''));
      }}
    >
      <h3>🪙 Give coins</h3>
      <label className="ag-field">
        <span>Game</span>
        <select className="field" value={game} onChange={(e) => setGame(e.target.value)}>
          {WALLET_GAMES.map((g) => (
            <option key={g.slug} value={g.slug}>
              {g.title}
            </option>
          ))}
        </select>
      </label>
      <label className="ag-field">
        <span>Coins</span>
        <input className="field" type="number" min={1} max={100000} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} required />
      </label>
      <label className="ag-field">
        <span>Note (optional, for the record)</span>
        <input className="field" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Refund for the lost car" />
      </label>
      <button className="btn btn-primary btn-sm" disabled={busy || !(n >= 1 && n <= 100000)}>
        Give {n >= 1 ? fmt(n) : ''} coins
      </button>
      <p className="info-small">They land in the player’s wallet the next time they open {titleOf(game)} signed in. Only games with coins are listed.</p>
    </form>
  );
}

function BanTool({ player, busy, blocked, onBan }: { player: QaPlayer; busy: boolean; blocked: string; onBan: (banned: boolean, reason: string) => Promise<boolean> }) {
  const [reason, setReason] = useState('');
  if (player.ban) {
    return (
      <form
        className="qa-tool"
        onSubmit={(e) => {
          e.preventDefault();
          if (!window.confirm(`Lift the ban on ${player.nickname}?`)) return;
          void onBan(false, reason.trim());
        }}
      >
        <h3>🔓 Banned</h3>
        <p className="qa-ban-note">
          “{player.ban.reason}”
          <span className="info-small">
            {player.ban.by} · {when(player.ban.at)}
          </span>
        </p>
        <label className="ag-field">
          <span>Why lift it? (optional, for the record)</span>
          <input className="field" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
        </label>
        <button className="btn btn-sm btn-lime" disabled={busy}>
          Lift the ban
        </button>
      </form>
    );
  }
  return (
    <form
      className="qa-tool"
      onSubmit={(e) => {
        e.preventDefault();
        if (!window.confirm(`Ban ${player.nickname}? They are signed out everywhere, can’t sign in and leave the leaderboards.`)) return;
        void onBan(true, reason.trim()).then((ok) => ok && setReason(''));
      }}
    >
      <h3>⛔ Ban</h3>
      <label className="ag-field">
        <span>Reason (kept on the record)</span>
        <textarea className="field qa-textarea" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="Impossible scores in Wing It (3 rounds under 5 s)" disabled={!!blocked} required />
      </label>
      <button className="btn btn-sm qa-danger" disabled={busy || !!blocked || !reason.trim()}>
        Ban player
      </button>
      <p className="info-small">{blocked || 'Signed out everywhere, can’t sign in again, and left off every leaderboard until the ban is lifted.'}</p>
    </form>
  );
}

function EmailTool({ player, busy, onSend }: { player: QaPlayer; busy: boolean; onSend: (subject: string, message: string) => Promise<boolean> }) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  return (
    <form
      className="qa-tool qa-tool-wide"
      onSubmit={(e) => {
        e.preventDefault();
        if (!window.confirm(`Send “${subject.trim()}” to ${player.email} from hello@glitchboundstudio.com?`)) return;
        void onSend(subject.trim(), message.trim()).then((ok) => {
          if (ok) {
            setSubject('');
            setMessage('');
          }
        });
      }}
    >
      <h3>✉️ Email {player.nickname}</h3>
      <p className="info-small">
        From <b>hello@glitchboundstudio.com</b> to <b>{player.email}</b>. It starts with “Hi {player.nickname},”; leave an empty line between paragraphs.
      </p>
      <label className="ag-field">
        <span>Subject</span>
        <input className="field" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} required />
      </label>
      <label className="ag-field">
        <span>Message</span>
        <textarea className="field qa-textarea" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={5000} required />
      </label>
      <button className="btn btn-primary btn-sm" disabled={busy || !subject.trim() || !message.trim()}>
        <Icon name="mail" size={16} /> Send email
      </button>
    </form>
  );
}

/* ------------------------------------------------------------------ testing tools */

function TestingTools({ me, flash, onOpenSelf }: { me: Me; flash: Flash; onOpenSelf: () => void }) {
  const live = useLiveCatalog();
  const games = live.all;
  const closed = games.filter((g) => live.settings(g.slug).hidden || live.settings(g.slug).maintenance);
  const [open, setOpen] = useState(games[0]?.slug ?? '');
  const [scope, setScope] = useState<'game' | 'today' | 'all'>('game');
  const [resetGame, setResetGame] = useState(games[0]?.slug ?? '');
  const [deviceGame, setDeviceGame] = useState(games[0]?.slug ?? '');
  const [busy, setBusy] = useState(false);
  const deviceKeys = deviceKeysFor(deviceGame);

  const resetAccount = async (): Promise<void> => {
    const what = scope === 'game' ? `your bests and rounds in ${titleOf(resetGame)}` : scope === 'today' ? 'today’s daily, quests and rounds' : 'ALL your bests, rounds, dailies, quests and XP';
    if (!window.confirm(`Reset ${what} on your own account (${me.email})? This can’t be undone.`)) return;
    setBusy(true);
    try {
      const r = await api<{ user: Me }>('/api/qa/reset', { body: { scope, game: resetGame, day: dayKey() } });
      account.setMe(r.user);
      flash('Your account progress was reset');
    } catch (e) {
      flash(errorText(e, 'Reset failed.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel info-block" aria-labelledby="qa-testing">
      <h2 id="qa-testing">
        <Icon name="gamepad" /> Testing tools
      </h2>
      <p className="info-small">
        {me.role === 'qa'
          ? 'Your scores never appear on public leaderboards or in the Hall of Fame (you still see your own rank), and your visits and rounds are left out of the site stats.'
          : 'Admin scores do appear on the public leaderboards.'}
      </p>

      <div className="qa-tools">
        <div className="qa-tool">
          <h3>🙈 Hidden and paused games</h3>
          {closed.length === 0 ? (
            <p className="info-small">Every game is live for players right now. Open any game below.</p>
          ) : (
            <ul className="qa-links">
              {closed.map((g) => (
                <li key={g.slug}>
                  <Link href={`/games/${g.slug}`} onClick={() => logQa('open_closed_game', { game: g.slug })}>
                    {g.title}
                  </Link>{' '}
                  <span className="qa-pill">{live.settings(g.slug).hidden ? 'hidden' : 'paused'}</span>
                </li>
              ))}
            </ul>
          )}
          {closed.length > 0 && <p className="info-small">You can play these; players can’t.</p>}
          <div className="qa-inline">
            <select className="field" value={open} onChange={(e) => setOpen(e.target.value)} aria-label="Game to open">
              {games.map((g) => (
                <option key={g.slug} value={g.slug}>
                  {g.title}
                </option>
              ))}
            </select>
            <Link className="btn btn-sm" href={`/games/${open}`}>
              Open
            </Link>
          </div>
        </div>

        <div className="qa-tool">
          <h3>♻️ Reset my account progress</h3>
          <div className="seg" role="radiogroup" aria-label="What to reset">
            {(
              [
                ['game', 'One game'],
                ['today', 'Today'],
                ['all', 'Everything'],
              ] as const
            ).map(([id, label]) => (
              <button key={id} role="radio" aria-checked={scope === id} className={scope === id ? 'is-on' : ''} onClick={() => setScope(id)}>
                {label}
              </button>
            ))}
          </div>
          {scope === 'game' && (
            <select className="field" value={resetGame} onChange={(e) => setResetGame(e.target.value)} aria-label="Game to reset">
              {games.map((g) => (
                <option key={g.slug} value={g.slug}>
                  {g.title}
                </option>
              ))}
            </select>
          )}
          <p className="info-small">
            {scope === 'game' ? 'Your best and every round in that game, so first-time records and quests can be tested again.' : scope === 'today' ? 'Today’s Daily Challenge, today’s quests (claims included) and today’s rounds.' : 'Every best, round, daily, quest claim and all your XP (level 1 again).'} Only your own account.
          </p>
          <button className="btn btn-sm" disabled={busy} onClick={() => void resetAccount()}>
            Reset
          </button>
        </div>

        <div className="qa-tool">
          <h3>🧹 Reset this device</h3>
          <select className="field" value={deviceGame} onChange={(e) => setDeviceGame(e.target.value)} aria-label="Game to clear on this device">
            {games.map((g) => (
              <option key={g.slug} value={g.slug}>
                {g.title}
              </option>
            ))}
          </select>
          <p className="info-small">
            {deviceKeys.length ? `Saved here: ${deviceKeys.join(', ')}` : 'Nothing of this game is saved in this browser yet'}, plus its rounds in the arcade save.
          </p>
          <div className="reset-row">
            <button
              className="btn btn-sm"
              onClick={() => {
                const keys = clearDeviceGame(deviceGame);
                logQa('clear_device_game', { game: deviceGame, keys });
                flash(`${titleOf(deviceGame)} starts fresh on this device`);
              }}
            >
              Clear this game
            </button>
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => {
                if (!window.confirm('Clear every game save, setting and cache in this browser? You stay signed in.')) return;
                const keys = clearDeviceAll();
                logQa('clear_device_all', { keys });
                flash('This browser is like new (you are still signed in)');
              }}
            >
              Clear everything
            </button>
          </div>
        </div>

        <div className="qa-tool">
          <h3>🪙 Coins to test a shop</h3>
          <p className="info-small">Open your own account and give yourself coins for {WALLET_GAMES.map((g) => g.title).join(' or ')}. Like every gift, it is on the record.</p>
          <button className="btn btn-sm" onClick={onOpenSelf}>
            Open my account
          </button>
        </div>

        <div className="qa-tool">
          <h3>🐞 Bug reports</h3>
          <p className="info-small">Copy this device’s details (page, build, browser, screen, account) to paste into a report.</p>
          <div className="reset-row">
            <button
              className="btn btn-sm"
              onClick={() => {
                const text = debugInfo(account.state.me);
                void navigator.clipboard?.writeText(text).then(
                  () => flash('Debug info copied'),
                  () => window.prompt('Copy the debug info:', text),
                );
                logQa('copy_debug_info');
              }}
            >
              Copy debug info
            </button>
            <Link className="btn btn-sm" href="/me/bugs">
              <Icon name="bug" size={16} /> Report a bug
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
