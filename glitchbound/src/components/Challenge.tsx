import { useEffect, useState } from 'react';
import { useT } from '../i18n';
import type { GameEntry } from '../catalog/types';
import { MAX_PLAYERS, type ChallengeView } from '../platform/challenge';
import type { ChallengeRun, ChallengeRunState } from '../platform/useChallengeRun';
import { Link, navigate } from '../router/router';
import { inviteToChallenge } from './ChallengeFriends';
import { Icon } from './Icon';
import './Challenge.css';

const SEAT_COLORS = ['#ff4fc8', '#2ad1f0', '#ffc928', '#b6e62c', '#ff6a1a', '#7b4dff'];
const MEDALS = ['🥇', '🥈', '🥉'];
const fmt = (n: number): string => n.toLocaleString('en-US');

const viewOf = (s: ChallengeRunState): ChallengeView | undefined => ('view' in s ? s.view : undefined);
const hoursLeft = (at: number): number => Math.max(1, Math.round((at - Date.now()) / 3600_000));

/** The players as a row of seats: initials, who has played this round, open seats to invite into. */
function Seats({ view, onInvite }: { view: ChallengeView; onInvite: () => void }) {
  const t = useT();
  // One open seat is enough of a hint (and keeps the row short on phones).
  const open = !view.closed && view.players.length < MAX_PLAYERS ? 1 : 0;
  return (
    <ul className="chd-seats" aria-label={t('{a}/{b} players', { a: view.players.length, b: MAX_PLAYERS })}>
      {view.players.map((p, i) => (
        <li key={p.name} className={`chd-seat${p.played ? ' is-played' : ''}${p.you ? ' is-you' : ''}`} title={`${p.name}${p.you ? ` (${t('you')})` : ''}: ${p.played ? t('played') : t('still to play')}`}>
          <span className="chd-avatar" style={{ background: SEAT_COLORS[i % SEAT_COLORS.length] }}>
            {p.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="chd-mark" aria-hidden="true">
            {p.played ? '✓' : '⏳'}
          </span>
        </li>
      ))}
      {Array.from({ length: open }, (_, i) => (
        <li key={`open${i}`} className="chd-seat is-open">
          <button className="chd-avatar" onClick={onInvite} aria-label={t('Invite friends')}>
            +
          </button>
        </li>
      ))}
    </ul>
  );
}

/** One line on where the challenge stands for you. */
function statusLine(state: ChallengeRunState, view: ChallengeView | undefined, t: ReturnType<typeof useT>): string {
  switch (state.status) {
    case 'loading':
      return t('Loading the challenge…');
    case 'gone':
      return t('This challenge has closed.');
    case 'error':
      return state.message;
    case 'closed':
      return t('This challenge has ended. Final results are in.');
    case 'ready':
      return t('Your turn: one attempt, your first finished score counts.');
    default:
      break;
  }
  if (!view) return '';
  const waiting = view.players.filter((p) => !p.played).map((p) => p.name);
  const r = view.rounds.find((x) => x.round === view.round);
  const i = r?.scores.findIndex((s) => s.you) ?? -1;
  const place = r && i >= 0 ? t('you’re #{n} of {total} so far', { n: i + 1, total: r.scores.length }) : '';
  const lead = state.status === 'sent' ? `${t('Score sent:')} ${fmt(state.score)}` : t('You played round {n}', { n: view.round });
  const wait = waiting.length ? t('Waiting for {names}', { names: waiting.slice(0, 3).join(', ') }) : view.players.length > 1 ? t('Everyone has played.') : '';
  return [lead, place, wait].filter(Boolean).join(' · ');
}

/**
 * The challenge, attached to the top of the game stage: whose it is, the round, live seats, what to
 * do next, and the actions (scores, invite, next round, end or leave). Updates live.
 */
export function ChallengeDock({ run, game, stageRound, onPlayRound, onScores, scoresOpen }: { run: ChallengeRun; game: GameEntry; stageRound: number | null; onPlayRound: () => void; onScores: () => void; scoresOpen: boolean }) {
  const t = useT();
  const { state, news } = run;
  const view = viewOf(state);
  const [menu, setMenu] = useState(false);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const [seen, setSeen] = useState(0);
  if (news && news.id !== seen) {
    setSeen(news.id);
    setToast(news);
  }
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(id);
  }, [toast]);
  if (state.status === 'none') return null;

  const host = view?.players[0]?.name;
  const title = !view ? t('Challenge') : view.host ? t('Your challenge') : host ? t('{name}’s challenge', { name: host }) : t('Challenge');
  const invite = (): void => {
    if (view) inviteToChallenge(game, view, t);
  };
  // A new round started (by you or a friend) while the stage still shows the last one.
  const newRound = state.status === 'ready' && stageRound !== null && stageRound !== state.view.round;
  const canRematch = (state.status === 'sent' || state.status === 'played') && !!view && !view.closed;
  const everyonePlayed = !!view && view.players.every((p) => p.played);
  const lobby = !!view && !view.closed && view.players.length <= 1 && view.rounds.length === 0;
  const end = async (): Promise<void> => {
    setMenu(false);
    const ask = view?.host ? t('End this challenge for everyone? The results stay readable.') : t('Leave this challenge? Your scores stay on the board.');
    if (!window.confirm(ask)) return;
    const r = await run.close();
    if (r === 'left' || r === 'deleted') navigate(`/games/${game.slug}`, { replace: true });
  };

  return (
    <div className={`chd is-${state.status}`} data-accent={game.accent} role="region" aria-label={t('Challenge')}>
      <div className="chd-main">
        <span className="chd-badge" aria-hidden="true">
          ⚔️
        </span>
        <div className="chd-text">
          <p className="chd-title">
            <b>{title}</b>
            {view && (
              <span className="chd-round mono">
                {t('round {n}', { n: view.round })}
                {view.mode === 'daily' && view.round === 1 ? ` · ${t('Daily')}` : ''}
              </span>
            )}
          </p>
          <p className="chd-status" aria-live="polite">
            {toast ? (
              <span key={toast.id} className="chd-toast">
                {toast.text}
              </span>
            ) : (
              <>
                {statusLine(state, view, t)}
                {lobby && view && view.closesAt > 0 && <span className="chd-ttl"> · {t('Closes in {n} h unless someone joins', { n: hoursLeft(view.closesAt) })}</span>}
              </>
            )}
          </p>
        </div>
        {view && <Seats view={view} onInvite={invite} />}
      </div>
      <div className="chd-actions">
        {newRound && (
          <button className="btn btn-sm btn-primary chd-go" onClick={onPlayRound}>
            <Icon name="play" size={16} /> {t('Play round {n}', { n: state.view.round })}
          </button>
        )}
        {canRematch && view && (
          <button className={`btn btn-sm${everyonePlayed ? ' btn-primary' : ''}`} disabled={run.busy} onClick={() => void run.rematch()} title={everyonePlayed ? undefined : t('Starts the next round now; anyone still to play misses this one.')}>
            <Icon name="restart" size={16} /> {t('Next round')}
          </button>
        )}
        {(state.status === 'gone' || state.status === 'closed') && (
          <Link href={`/games/${game.slug}`} className="btn btn-sm btn-primary">
            <Icon name="bolt" size={16} /> {t('New challenge')}
          </Link>
        )}
        {view && (
          <button className={`btn btn-sm${scoresOpen ? ' is-on' : ''}`} onClick={onScores} aria-expanded={scoresOpen}>
            <Icon name="trophy" size={16} /> {t('Scores')}
          </button>
        )}
        {view && !view.closed && (
          <button className="btn btn-sm" onClick={invite}>
            <Icon name="share" size={16} /> {t('Invite')}
          </button>
        )}
        <div className="chd-more">
          <button className="btn btn-sm btn-icon" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-label={t('More')}>
            <Icon name="menu" size={16} />
          </button>
          {menu && (
            <div className="chd-menu" role="menu">
              <Link href="/c" className="chd-menu-item" role="menuitem">
                <Icon name="user" size={16} /> {t('Your challenges')}
              </Link>
              {view && !view.closed && view.joined && (
                <button className="chd-menu-item is-danger" role="menuitem" disabled={run.busy} onClick={() => void end()}>
                  <Icon name="close" size={16} /> {view.host ? t('End challenge') : t('Leave challenge')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The scoreboard drawn on the stage (also in full screen): this round live, every earlier round,
 * crowns for round wins, and the next step. Opens by itself when your score is in.
 */
export function ChallengeScores({ run, game, onClose }: { run: ChallengeRun; game: GameEntry; onClose: () => void }) {
  const t = useT();
  const { state } = run;
  const view = viewOf(state);
  if (state.status === 'gone')
    return (
      <div className="chs" role="dialog" aria-label={t('Challenge')}>
        <div className="chs-card">
          <p className="chs-kicker mono">⚔️ {t('Challenge')}</p>
          <h2 className="chs-title">{t('This challenge has closed.')}</h2>
          <p className="chs-note">{t('Challenges nobody joins close after a day. Start a new one and send the link.')}</p>
          <div className="chs-actions">
            <Link href={`/games/${game.slug}`} className="btn btn-primary">
              <Icon name="bolt" /> {t('New challenge')}
            </Link>
            <button className="btn" onClick={onClose}>
              {t('Close')}
            </button>
          </div>
        </div>
      </div>
    );
  if (!view) return null;
  const current = view.rounds.find((r) => r.round === view.round);
  const earlier = view.rounds.filter((r) => r.round !== view.round);
  const crowns = view.players.some((p) => p.wins > 0);
  const standings = [...view.players].sort((a, b) => b.wins - a.wins || b.total - a.total);
  return (
    <div className="chs" role="dialog" aria-label={t('Scoreboard')}>
      <div className="chs-card">
        <button className="chs-x" onClick={onClose} aria-label={t('Close')}>
          <Icon name="close" size={18} />
        </button>
        <p className="chs-kicker mono">
          ⚔️ {game.title} · {t('round {n}', { n: view.round })}
        </p>
        <h2 className="chs-title">{view.closed ? t('Final results') : state.status === 'sent' ? t('Score sent:') + ' ' + fmt(state.score) : t('Scoreboard')}</h2>
        {view.closed && crowns ? (
          <ol className="chs-board">
            {standings.map((p, i) => (
              <li key={p.name} className={p.you ? 'is-you' : ''}>
                <span className="chs-rank">{MEDALS[i] ?? `${i + 1}.`}</span>
                <span className="chs-name">{p.name}</span>
                <span className="mono">{'👑'.repeat(Math.min(5, p.wins))}{p.wins > 5 ? `×${p.wins}` : ''}</span>
              </li>
            ))}
          </ol>
        ) : (
          <ol className="chs-board">
            {(current?.scores ?? []).map((s, i) => (
              <li key={s.name} className={s.you ? 'is-you' : ''}>
                <span className="chs-rank">{MEDALS[i] ?? `${i + 1}.`}</span>
                <span className="chs-name">{s.name}</span>
                <span className="mono chs-score">{fmt(s.score)}</span>
              </li>
            ))}
            {view.players
              .filter((p) => !p.played)
              .map((p) => (
                <li key={p.name} className={`is-waiting${p.you ? ' is-you' : ''}`}>
                  <span className="chs-rank">⏳</span>
                  <span className="chs-name">{p.name}</span>
                  <span className="mono chs-score">{p.you ? t('your turn') : t('playing soon')}</span>
                </li>
              ))}
          </ol>
        )}
        {earlier.length > 0 && (
          <details className="chs-history">
            <summary className="mono">{t('Earlier rounds')}</summary>
            {earlier.map((r) => (
              <p key={r.round} className="chs-past">
                <b className="mono">{t('round {n}', { n: r.round })}</b>{' '}
                {r.scores.map((s, i) => `${MEDALS[i] ?? `${i + 1}.`} ${s.name} ${fmt(s.score)}`).join(' · ')}
              </p>
            ))}
          </details>
        )}
        <div className="chs-actions">
          {!view.closed && (state.status === 'sent' || state.status === 'played') && (
            <button className="btn btn-primary" disabled={run.busy} onClick={() => void run.rematch()}>
              <Icon name="restart" /> {t('Next round')}
            </button>
          )}
          {!view.closed && (
            <button className="btn" onClick={() => inviteToChallenge(game, view, t)}>
              <Icon name="share" /> {t('Invite friends')}
            </button>
          )}
          {view.closed && (
            <Link href={`/games/${game.slug}`} className="btn btn-primary">
              <Icon name="bolt" /> {t('New challenge')}
            </Link>
          )}
        </div>
        {!view.closed && <p className="chs-note">{t('Updates live. Everyone plays the same round, one attempt each.')}</p>}
      </div>
    </div>
  );
}
