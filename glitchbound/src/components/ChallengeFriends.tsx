import { useState } from 'react';
import { tGame, useT } from '../i18n';
import type { GameEntry } from '../catalog/types';
import { ApiError } from '../platform/account';
import { MAX_PLAYERS, type ChallengeMode, type ChallengeView } from '../platform/challenge';
import { createChallenge } from '../platform/challenges';
import { dayKey } from '../platform/dates';
import { embedHost } from '../platform/embed';
import { usePlayerName } from '../platform/playerName';
import { shareOrCopy } from '../platform/share';
import { Link, navigate } from '../router/router';
import { Icon } from './Icon';
import './ChallengeFriends.css';

const fmt = (n: number): string => n.toLocaleString('en-US');

/** Opens the share sheet with the challenge link (the picture card says who challenged whom). */
export function inviteToChallenge(game: GameEntry, view: Pick<ChallengeView, 'id' | 'round' | 'players' | 'rounds'>, tr: ReturnType<typeof useT>): void {
  // Inside the Discord Activity everyone in the call lands in this challenge: invite to the call.
  const app = embedHost()?.invite;
  if (app) return app();
  const mine = view.rounds.find((r) => r.round === view.round)?.scores.find((s) => s.you);
  void shareOrCopy({
    title: tr('{game} challenge', { game: game.title }),
    text: `⚔️ ${mine ? tr('I scored {score} in {game}. Beat me!', { score: fmt(mine.score), game: game.title }) : tr('I challenged you in {game}!', { game: game.title })}\n${tGame(game.challenge?.label ?? '')}`,
    url: `${location.origin}/c/${view.id}`,
  });
}

/**
 * Starts a challenge on this game, opens it here on the game page and opens the invite sheet.
 * Resolves with an error to show, or '' when it worked.
 */
export async function startChallenge(game: GameEntry, mode: ChallengeMode, name: string, tr: ReturnType<typeof useT>): Promise<string> {
  try {
    const v = await createChallenge(game.slug, mode, name, dayKey());
    navigate(`/games/${game.slug}?challenge=${v.id}`, { scroll: false });
    inviteToChallenge(game, v, tr);
    return '';
  } catch (e) {
    return e instanceof ApiError ? (e.message !== e.code ? e.message : tr('Could not start a challenge.')) : tr('Network error. Try again.');
  }
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
    setMsg(await startChallenge(game, mode, player.name, t));
    setBusy(false);
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
