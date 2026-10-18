import { useState } from 'react';
import { tGame, useT } from '../i18n';
import type { GameEntry } from '../catalog/types';
import { ApiError } from '../platform/account';
import { MAX_PLAYERS, type ChallengeMode, type ChallengeView } from '../platform/challenge';
import { createChallenge } from '../platform/challenges';
import { dayKey } from '../platform/dates';
import { usePlayerName } from '../platform/playerName';
import { shareOrCopy } from '../platform/share';
import { Link, navigate } from '../router/router';
import { Icon } from './Icon';
import './ChallengeFriends.css';

const fmt = (n: number): string => n.toLocaleString('en-US');

/** Opens the share sheet with the challenge link (the picture card says who challenged whom). */
export function inviteToChallenge(game: GameEntry, view: Pick<ChallengeView, 'id' | 'round' | 'players' | 'rounds'>, tr: ReturnType<typeof useT>): void {
  const mine = view.rounds.find((r) => r.round === view.round)?.scores.find((s) => s.you);
  void shareOrCopy({
    title: tr('{game} challenge', { game: game.title }),
    text: `⚔️ ${mine ? tr('I scored {score} in {game}. Beat me!', { score: fmt(mine.score), game: game.title }) : tr('I challenged you in {game}!', { game: game.title })}\n${tGame(game.challenge?.label ?? '')}`,
    url: `${location.origin}/c/${view.id}`,
  });
}

/** Game page panel: start a challenge for up to 6 friends, right here in the game. */
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
      navigate(`/games/${game.slug}?challenge=${v.id}`, { scroll: false });
      inviteToChallenge(game, v, t);
    } catch (e) {
      setMsg(e instanceof ApiError ? (e.message !== e.code ? e.message : t('Could not start a challenge.')) : t('Network error. Try again.'));
    } finally {
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
