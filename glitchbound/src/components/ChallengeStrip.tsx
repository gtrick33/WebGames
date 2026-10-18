import { useState } from 'react';
import { tGame, useT } from '../i18n';
import type { GameEntry } from '../catalog/types';
import { ApiError } from '../platform/account';
import { MAX_PLAYERS, type ChallengeMode } from '../platform/challenge';
import { createChallenge } from '../platform/challenges';
import { dayKey } from '../platform/dates';
import { usePlayerName } from '../platform/playerName';
import type { ChallengeRunState } from '../platform/useChallengeRun';
import { Link, navigate } from '../router/router';
import { Icon } from './Icon';
import './ChallengeStrip.css';

/** Above the stage while playing a challenge round: whose challenge, which round, and the result. */
export function ChallengeStrip({ state, game }: { state: ChallengeRunState; game: GameEntry }) {
  const t = useT();
  if (state.status === 'none') return null;
  const view = 'view' in state ? state.view : null;
  const host = view?.players[0]?.name;
  const board = view ? `/c/${view.id}` : '/c';
  return (
    <div className={`cstrip is-${state.status}`} data-accent={game.accent} role="status">
      <span className="cstrip-icon" aria-hidden="true">
        ⚔️
      </span>
      <span className="cstrip-text">
        {state.status === 'loading' && t('Loading the challenge…')}
        {state.status === 'error' && state.message}
        {state.status === 'ready' && (
          <>
            <b>{host ? t('{name}’s challenge', { name: host }) : t('Challenge')}</b> · {t('round {n}', { n: state.view.round })} · {t('{a}/{b} players', { a: state.view.players.length, b: MAX_PLAYERS })}.{' '}
            {t('Press play: one attempt, your first finished score counts.')}
          </>
        )}
        {state.status === 'played' && (
          <>
            {t('You already played round {n}. See how the others are doing.', { n: state.view.round })}
          </>
        )}
        {state.status === 'sent' && (
          <>
            {t('Score sent:')} <b>{state.score.toLocaleString('en-US')}</b>
            {(() => {
              const r = state.view.rounds.find((x) => x.round === state.view.round);
              const i = r?.scores.findIndex((s) => s.you) ?? -1;
              return r && i >= 0 ? ` · ${t('you’re #{n} of {total} so far', { n: i + 1, total: r.scores.length })}` : '';
            })()}
          </>
        )}
      </span>
      {state.status !== 'loading' && (
        <Link href={board} className="btn btn-sm cstrip-btn">
          {state.status === 'sent' ? t('See the scoreboard') : t('Scoreboard')} <Icon name="arrowRight" size={16} />
        </Link>
      )}
    </div>
  );
}

/** Game page panel: start a challenge for up to 6 friends. */
export function ChallengeFriends({ game }: { game: GameEntry }) {
  const t = useT();
  const player = usePlayerName();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const start = async (mode: ChallengeMode): Promise<void> => {
    setBusy(true);
    setMsg('');
    try {
      const v = await createChallenge(game.slug, mode, player.name, dayKey());
      navigate(`/c/${v.id}`);
    } catch (e) {
      setMsg(e instanceof ApiError ? (e.message !== e.code ? e.message : t('Could not start a challenge.')) : t('Network error. Try again.'));
      setBusy(false);
    }
  };
  return (
    <div className="panel cfriends" data-accent={game.accent}>
      <p className="cfriends-kicker mono">⚔️ {t('Challenge friends')}</p>
      <p className="cfriends-label">
        {t('Up to {n} players, same round for everyone.', { n: MAX_PLAYERS })} {tGame(game.challenge?.label ?? '')}
      </p>
      <div className="cfriends-row">
        {game.ownDaily && (
          <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => void start('daily')}>
            <Icon name="calendar" size={16} /> {t('Today’s daily')}
          </button>
        )}
        <button className={`btn btn-sm${game.ownDaily ? '' : ' btn-primary'}`} disabled={busy} onClick={() => void start('fresh')}>
          <Icon name="bolt" size={16} /> {t('Fresh round')}
        </button>
        <Link href="/c" className="btn btn-sm btn-ghost">
          {t('Yours')}
        </Link>
      </div>
      {msg && <p className="info-small">{msg}</p>}
    </div>
  );
}
