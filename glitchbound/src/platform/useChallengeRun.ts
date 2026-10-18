import { useEffect, useRef, useState } from 'react';
import type { GameEntry } from '../catalog/types';
import { ApiError } from './account';
import type { ChallengeSpec, ChallengeView } from './challenge';
import { challengeReplays, getChallenge, joinChallenge, submitChallengeScore } from './challenges';
import type { EndEvent } from './contract';

export type ChallengeRunState =
  | { status: 'none' }
  | { status: 'loading' }
  | { status: 'error'; message: string; spec?: ChallengeSpec }
  | { status: 'played'; view: ChallengeView }
  | { status: 'ready'; view: ChallengeView; spec: ChallengeSpec }
  | { status: 'sent'; view: ChallengeView; score: number; spec: ChallengeSpec };

/**
 * The game page side of a challenge link (/games/<slug>?challenge=<id>): loads the challenge, takes
 * a seat if needed, hands the round to the game, and sends the score when the round ends.
 */
export function useChallengeRun(id: string | null, game: GameEntry, name: string): { state: ChallengeRunState; finish: (e: EndEvent) => void } {
  const [state, setState] = useState<ChallengeRunState>({ status: id ? 'loading' : 'none' });
  const ref = useRef(state);
  useEffect(() => {
    ref.current = state;
  });

  useEffect(() => {
    if (!id || !game.challenge) return;
    let live = true;
    getChallenge(id)
      .then((v) => {
        if (v.game !== game.slug) throw new Error('This challenge is for another game.');
        if (v.joined) return v;
        if (v.full) throw new Error('This challenge already has 6 players.');
        return joinChallenge(id, name || 'Player');
      })
      .then(async (v) => {
        if (!live) return;
        if (!v.yourTurn) return setState({ status: 'played', view: v });
        const replays = game.slug === 'mini-racer' ? (await challengeReplays(id).catch(() => ({ replays: [] }))).replays : undefined;
        if (live) setState({ status: 'ready', view: v, spec: { id, round: v.round, seed: v.seed, mode: v.mode, day: v.day, replays } });
      })
      .catch((e: unknown) => live && setState({ status: 'error', message: e instanceof ApiError ? (e.message ?? 'Could not load the challenge.') : e instanceof Error ? e.message : 'Could not load the challenge.' }));
    return () => {
      live = false;
    };
    // The player's name only matters when first taking a seat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, game.slug]);

  const finish = (e: EndEvent): void => {
    const s = ref.current;
    if (s.status !== 'ready' || !e.challenge || e.challenge.id !== s.spec.id) return;
    submitChallengeScore(s.spec.id, s.spec.round, e.score, e.stats, e.challenge.replay).then(
      (view) => setState({ status: 'sent', view, score: e.score, spec: s.spec }),
      (err: unknown) => setState({ status: 'error', spec: s.spec, message: err instanceof ApiError ? (err.message ?? 'Your score was not saved.') : 'Your score was not saved (network).' }),
    );
  };
  return { state, finish };
}

/** The round handed to the game: kept after the score is sent so the game stays in challenge mode. */
export function challengeSpecOf(state: ChallengeRunState): ChallengeSpec | undefined {
  return 'spec' in state ? state.spec : undefined;
}
