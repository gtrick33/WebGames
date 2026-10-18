import { useCallback, useEffect, useState } from 'react';
import { getGame } from '../catalog/catalog';
import type { GameEntry } from '../catalog/types';
import { Icon } from '../components/Icon';
import { ApiError } from '../platform/account';
import { MAX_PLAYERS, type ChallengeListItem, type ChallengeMode, type ChallengeView } from '../platform/challenge';
import { createChallenge, getChallenge, joinChallenge, myChallenges, rematch } from '../platform/challenges';
import { dayKey } from '../platform/dates';
import { useLiveCatalog } from '../platform/liveCatalog';
import { usePageMeta } from '../platform/meta';
import { setGuestName, usePlayerName } from '../platform/playerName';
import { shareOrCopy } from '../platform/share';
import { Link, navigate } from '../router/router';
import './InfoPages.css';
import './ChallengePage.css';

const SEAT_COLORS = ['#ff4fc8', '#2ad1f0', '#ffc928', '#b6e62c', '#ff6a1a', '#7b4dff'];
const MEDALS = ['🥇', '🥈', '🥉'];
const fmt = (n: number): string => n.toLocaleString('en-US');
const ago = (ms: number): string => {
  const m = Math.round((Date.now() - ms) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};

/** Refreshes the challenge every 20 s while the page is visible (others may have played). */
function useChallenge(id: string): { view: ChallengeView | null; error: string; setView: (v: ChallengeView) => void; reload: () => void } {
  const [view, setView] = useState<ChallengeView | null>(null);
  const [error, setError] = useState('');
  const reload = useCallback(() => {
    getChallenge(id).then(
      (v) => {
        setView(v);
        setError('');
      },
      (e: unknown) => setError(e instanceof ApiError && e.status === 404 ? 'gone' : 'failed'),
    );
  }, [id]);
  useEffect(() => {
    reload();
    const t = window.setInterval(() => {
      if (!document.hidden) reload();
    }, 20_000);
    return () => window.clearInterval(t);
  }, [reload]);
  return { view, error, setView, reload };
}

export function ChallengePage({ id }: { id: string }) {
  const { view, error, setView, reload } = useChallenge(id);
  const live = useLiveCatalog();
  const game = view ? getGame(view.game, live.all) : undefined;
  usePageMeta({ title: game ? `${game.title} challenge` : 'Challenge', path: `/c/${id}` });
  const player = usePlayerName();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  if (error === 'gone')
    return (
      <div className="wrap info-page">
        <h1 className="info-title">This challenge is over</h1>
        <p className="info-lead">Challenges close after 60 quiet days. Start a new one!</p>
        <Link href="/c" className="btn btn-primary">
          Your challenges
        </Link>
      </div>
    );
  if (!view || !game) return <div className="wrap info-page"><p className="info-lead">{error ? 'Could not load the challenge. Check your connection.' : 'Loading the challenge…'}</p></div>;

  const act = async (fn: () => Promise<ChallengeView>): Promise<void> => {
    setBusy(true);
    setMsg('');
    try {
      setView(await fn());
    } catch (e) {
      setMsg(e instanceof ApiError ? (e.message !== e.code ? e.message : 'Something went wrong.') : 'Network error. Try again.');
    } finally {
      setBusy(false);
    }
  };
  const myName = (name || player.name).trim();
  const host = view.players[0]?.name ?? 'Someone';
  const current = view.rounds.find((r) => r.round === view.round);
  const you = view.players.find((p) => p.you);
  const invite = (): void => {
    const best = current?.scores.find((s) => s.you);
    void shareOrCopy({
      title: `${game.title} challenge`,
      text: `⚔️ ${best ? `I scored ${fmt(best.score)} in ${game.title}. Beat me!` : `I challenged you in ${game.title}!`}\n${game.challenge?.label ?? ''}\nRound ${view.round} · ${view.players.length}/${MAX_PLAYERS} players`,
      url: `${location.origin}/c/${view.id}`,
    });
  };
  const play = (): void => navigate(`/games/${game.slug}?challenge=${view.id}`);

  return (
    <div className="wrap info-page chal" data-accent={game.accent}>
      <section className="chal-hero" style={{ backgroundImage: `url(${game.art.wide})` }}>
        <div className="chal-hero-inner">
          <img className="chal-tile" src={game.art.tile} alt="" width={96} height={96} style={{ background: game.art.bg }} />
          <div>
            <p className="eyebrow chal-eyebrow">⚔️ Challenge · {game.title}</p>
            <h1 className="chal-title">{you && view.players[0]?.you ? 'Your challenge' : `${host}'s challenge`}</h1>
            <p className="chal-sub">{game.challenge?.label}</p>
            <div className="chal-chips">
              <span className="chal-chip">{view.mode === 'daily' ? `Daily · ${view.day}` : 'Fresh round'}</span>
              <span className="chal-chip">Round {view.round}</span>
              <span className="chal-chip">
                {view.players.length}/{MAX_PLAYERS} players
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className="chal-actions">
        {!view.joined ? (
          view.full ? (
            <p className="info-lead">This challenge already has {MAX_PLAYERS} players.</p>
          ) : (
            <form
              className="chal-join"
              onSubmit={(e) => {
                e.preventDefault();
                if (!player.member && myName) setGuestName(myName);
                void act(() => joinChallenge(view.id, myName));
              }}
            >
              <label className="chal-name">
                <span className="mono">Play as</span>
                <input className="field" value={name || player.name} onChange={(e) => setName(e.target.value)} maxLength={20} disabled={player.member} required />
              </label>
              <button className="btn btn-primary btn-lg" disabled={busy || !myName}>
                <Icon name="play" /> Join the challenge
              </button>
            </form>
          )
        ) : view.yourTurn ? (
          <button className="btn btn-primary btn-lg chal-play" onClick={play}>
            <Icon name="play" /> Play round {view.round}
          </button>
        ) : (
          <button className="btn btn-lg" disabled={busy} onClick={() => void act(() => rematch(view.id, view.round))}>
            <Icon name="restart" /> Rematch: round {view.round + 1}
          </button>
        )}
        <button className="btn btn-lg chal-invite" onClick={invite}>
          <Icon name="share" /> Invite friends
        </button>
      </div>
      {msg && (
        <p className="chal-msg" role="alert">
          {msg}
        </p>
      )}

      <section className="panel info-block" aria-labelledby="chal-seats">
        <div className="chal-head">
          <h2 id="chal-seats">Players</h2>
          <button className="btn btn-sm btn-ghost" onClick={reload} aria-label="Refresh the scores">
            <Icon name="restart" size={16} />
          </button>
        </div>
        <ul className="chal-seats">
          {Array.from({ length: MAX_PLAYERS }, (_, i) => {
            const p = view.players[i];
            if (!p)
              return (
                <li key={i} className="chal-seat is-open">
                  <button className="chal-open" onClick={invite}>
                    <span className="chal-avatar">+</span>
                    <span>Open seat</span>
                    <span className="mono">Invite</span>
                  </button>
                </li>
              );
            const s = current?.scores.find((x) => x.name === p.name);
            const rank = s ? current!.scores.indexOf(s) : -1;
            return (
              <li key={i} className={`chal-seat${p.you ? ' is-you' : ''}`}>
                <span className="chal-avatar" style={{ background: SEAT_COLORS[i] }}>
                  {p.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="chal-seat-name">
                  {p.name}
                  {p.you && <span className="chal-you">you</span>}
                </span>
                <span className="chal-seat-score mono">{s ? `${MEDALS[rank] ?? ''} ${fmt(s.score)}` : '⏳ to play'}</span>
                {view.rounds.length > 1 && <span className="chal-wins">{'👑'.repeat(Math.min(5, p.wins))}{p.wins > 5 ? `×${p.wins}` : ''}</span>}
              </li>
            );
          })}
        </ul>
      </section>

      {view.rounds.length > 0 && (
        <section className="panel info-block" aria-labelledby="chal-rounds">
          <h2 id="chal-rounds">Rounds</h2>
          <ol className="chal-rounds">
            {view.rounds.map((r) => (
              <li key={r.round}>
                <p className="mono chal-round-head">
                  Round {r.round}
                  {r.round === view.round ? ' · now' : ''}
                </p>
                <ol className="chal-board">
                  {r.scores.map((s, i) => (
                    <li key={s.name} className={s.you ? 'is-you' : ''}>
                      <span className="chal-rank">{MEDALS[i] ?? `${i + 1}.`}</span>
                      <span className="chal-board-name">{s.name}</span>
                      <span className="mono">{fmt(s.score)}</span>
                      <span className="mono info-small">{ago(s.at)}</span>
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ol>
        </section>
      )}
      <p className="info-small">
        Everyone plays the same {view.mode === 'daily' ? 'daily' : 'round'}, one attempt each; your first finished score counts. Up to {MAX_PLAYERS} players. <Link href="/c">Your challenges</Link>
      </p>
    </div>
  );
}

/* ----------------------------------------------------------- your list */

export function ChallengesPage() {
  usePageMeta({ title: 'Your challenges', path: '/c' });
  const live = useLiveCatalog();
  const [list, setList] = useState<ChallengeListItem[] | null>(null);
  const [picking, setPicking] = useState<GameEntry | null>(null);
  const player = usePlayerName();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    myChallenges().then(
      (r) => setList(r.challenges),
      () => setList([]),
    );
  }, []);
  const games = live.games.filter((g) => g.challenge && !live.settings(g.slug).maintenance);
  const start = async (game: GameEntry, mode: ChallengeMode): Promise<void> => {
    setBusy(true);
    try {
      const v = await createChallenge(game.slug, mode, player.name, dayKey());
      navigate(`/c/${v.id}`);
    } catch (e) {
      setMsg(e instanceof ApiError ? (e.message !== e.code ? e.message : 'Could not start the challenge.') : 'Network error. Try again.');
      setBusy(false);
    }
  };
  return (
    <div className="wrap info-page chal">
      <p className="eyebrow">⚔️ Up to {MAX_PLAYERS} players · same round for everyone</p>
      <h1 className="info-title">Challenges</h1>
      <section className="panel info-block" aria-labelledby="chal-mine">
        <h2 id="chal-mine">Your challenges</h2>
        {list === null ? (
          <p className="info-small">Loading…</p>
        ) : list.length === 0 ? (
          <p className="info-small">None yet. Start one below and send the link to your friends.</p>
        ) : (
          <ul className="chal-list">
            {list.map((c) => {
              const g = getGame(c.game, live.all);
              return (
                <li key={c.id}>
                  <Link href={`/c/${c.id}`} className="chal-row" data-accent={g?.accent}>
                    {g && <img src={g.art.tile} alt="" width={48} height={48} style={{ background: g.art.bg }} />}
                    <span className="chal-row-main">
                      <b>{g?.title ?? c.game}</b>
                      <span className="info-small">
                        Round {c.round} · {c.players}/{MAX_PLAYERS} players{c.leader ? ` · ${c.leader} leads` : ''}
                      </span>
                    </span>
                    {c.yourTurn ? <span className="chal-badge is-turn">Your turn</span> : <span className="chal-badge">{c.waitingFor.length ? `Waiting for ${c.waitingFor.slice(0, 2).join(', ')}` : 'All played'}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="panel info-block" aria-labelledby="chal-new">
        <h2 id="chal-new">Start a challenge</h2>
        <p className="info-small">Pick a game. You play first (or not), then send the link: friends join with one tap, no sign-up.</p>
        <ul className="chal-games">
          {games.map((g) => (
            <li key={g.slug}>
              <button className={`chal-game${picking?.slug === g.slug ? ' is-on' : ''}`} onClick={() => setPicking(picking?.slug === g.slug ? null : g)} data-accent={g.accent}>
                <img src={g.art.tile} alt="" width={64} height={64} style={{ background: g.art.bg }} />
                <span>{g.title}</span>
              </button>
            </li>
          ))}
        </ul>
        {picking && (
          <div className="chal-modes">
            <p>
              <b>{picking.title}</b>: {picking.challenge?.label}
            </p>
            <div className="reset-row">
              {picking.ownDaily && (
                <button className="btn btn-primary" disabled={busy} onClick={() => void start(picking, 'daily')}>
                  <Icon name="calendar" /> Today’s daily
                </button>
              )}
              <button className={`btn${picking.ownDaily ? '' : ' btn-primary'}`} disabled={busy} onClick={() => void start(picking, 'fresh')}>
                <Icon name="bolt" /> Fresh round
              </button>
            </div>
          </div>
        )}
        {msg && <p className="chal-msg">{msg}</p>}
      </section>
    </div>
  );
}
