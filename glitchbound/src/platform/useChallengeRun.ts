import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GameEntry } from '../catalog/types';
import { t } from '../i18n';
import { ApiError } from './account';
import { REPLAY_MAX, type ChallengeSpec, type ChallengeView } from './challenge';
import { challengeReplays, closeChallenge, getChallenge, joinChallenge, pollChallenge, rematch as askRematch, submitChallengeScore } from './challenges';
import type { EndEvent } from './contract';

export type ChallengeRunState =
  | { status: 'none' }
  | { status: 'loading'; view?: ChallengeView }
  | { status: 'error'; message: string; spec?: ChallengeSpec; view?: ChallengeView }
  /** Deleted: ended before anyone else joined, or nobody joined within a day. */
  | { status: 'gone' }
  /** Ended (by the host, everyone leaving, or a week of quiet): the final results. */
  | { status: 'closed'; view: ChallengeView }
  | { status: 'played'; view: ChallengeView }
  | { status: 'ready'; view: ChallengeView; spec: ChallengeSpec }
  | { status: 'sent'; view: ChallengeView; score: number; spec: ChallengeSpec };

/** Something that just happened in the challenge, for a short toast ("Mira joined"). */
export interface ChallengeNews {
  id: number;
  text: string;
}

export interface ChallengeRun {
  state: ChallengeRunState;
  /** The latest live update worth a toast. */
  news: ChallengeNews | null;
  busy: boolean;
  /** Sends the round's score (called with the game's end event). */
  finish: (e: EndEvent) => void;
  /** Starts the next round for everyone. */
  rematch: () => Promise<void>;
  /** Ends the challenge (host) or leaves it (anyone else). */
  close: () => Promise<'ended' | 'left' | 'deleted' | 'failed'>;
}

/** Live updates: every few seconds while the page is visible, slower after two quiet minutes. */
const POLL_MS = 3000;
const SLOW_POLL_MS = 10_000;
const SLOW_AFTER_MS = 120_000;

const fmt = (n: number): string => n.toLocaleString('en-US');

/** What changed between two views of a challenge, as toast text (newest first wins). */
export function newsBetween(prev: ChallengeView, next: ChallengeView): string | null {
  if (next.closed && !prev.closed) return t('The challenge has ended.');
  if (next.round > prev.round) return t('Round {n} is on!', { n: next.round });
  const joined = next.players.filter((p) => !p.you && !prev.players.some((q) => q.name === p.name));
  if (joined.length) return t('{name} joined', { name: joined.map((p) => p.name).join(', ') });
  const before = prev.rounds.find((r) => r.round === prev.round)?.scores ?? [];
  const finished = (next.rounds.find((r) => r.round === next.round)?.scores ?? []).filter((s) => !s.you && !before.some((b) => b.name === s.name));
  if (finished.length) return finished.map((s) => t('{name} scored {score}', { name: s.name, score: fmt(s.score) })).join(' · ');
  const left = prev.players.filter((p) => !p.you && !next.players.some((q) => q.name === p.name));
  if (left.length) return t('{name} left', { name: left.map((p) => p.name).join(', ') });
  return null;
}

const errorText = (e: unknown, fallback: string): string => (e instanceof ApiError ? (e.message !== e.code ? e.message : fallback) : e instanceof Error ? e.message : fallback);

/**
 * The game page side of a challenge (/games/<slug>?challenge=<id>): loads it, takes a seat if needed,
 * keeps it live (joins, scores and rematches show up within seconds), hands the round to the game,
 * and sends the score when the round ends.
 */
export function useChallengeRun(id: string | null, game: GameEntry, name: string): ChallengeRun {
  const [view, setViewState] = useState<ChallengeView | null>(null);
  const viewRef = useRef<ChallengeView | null>(null);
  const [problem, setProblem] = useState('');
  const [sent, setSent] = useState<{ round: number; score: number } | null>(null);
  const [sendError, setSendError] = useState('');
  const [replays, setReplays] = useState<{ round: number; list: { name: string; replay: string }[] } | null>(null);
  const [news, setNews] = useState<ChallengeNews | null>(null);
  const [busy, setBusy] = useState(false);

  /** Takes a fresh view, announcing what changed. */
  const take = useCallback((next: ChallengeView, announce = true) => {
    const prev = viewRef.current;
    viewRef.current = next;
    setViewState(next);
    const text = announce && prev ? newsBetween(prev, next) : null;
    if (text) setNews((n) => ({ id: (n?.id ?? 0) + 1, text }));
  }, []);

  // First load: open the challenge and take a seat.
  useEffect(() => {
    if (!id || !game.challenge) return;
    let live = true;
    viewRef.current = null;
    getChallenge(id)
      .then((v) => {
        if (v.game !== game.slug) throw new Error(t('This challenge is for another game.'));
        if (v.joined || v.closed) return v;
        if (v.full) throw new Error(t('This challenge already has {n} players.', { n: v.players.length }));
        return joinChallenge(id, name || 'Player');
      })
      .then(
        (v) => live && take(v, false),
        (e: unknown) => {
          if (!live) return;
          setProblem(e instanceof ApiError && e.status === 404 ? 'gone' : errorText(e, t('Could not load the challenge.')));
        },
      );
    return () => {
      live = false;
    };
    // The player's name only matters when first taking a seat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, game.slug]);

  // Live updates while the challenge is open.
  const updatedAt = view?.updatedAt ?? 0;
  const closed = view?.closed ?? true;
  useEffect(() => {
    if (!id || !updatedAt || closed) return;
    let stop = false;
    let timer = 0;
    const quietSince = Date.now();
    const tick = async (): Promise<void> => {
      if (stop) return;
      if (!document.hidden) {
        const current = viewRef.current;
        // Past its closing time, ask for the whole view: it comes back closed.
        const since = current && current.closesAt && Date.now() > current.closesAt ? 0 : updatedAt;
        try {
          const v = await pollChallenge(id, since);
          if (stop) return;
          if (v) return take(v);
        } catch (e) {
          if (stop) return;
          if (e instanceof ApiError && e.status === 404) return setProblem('gone');
        }
      }
      timer = window.setTimeout(() => void tick(), Date.now() - quietSince > SLOW_AFTER_MS ? SLOW_POLL_MS : POLL_MS);
    };
    timer = window.setTimeout(() => void tick(), POLL_MS);
    const onVisible = (): void => {
      if (document.hidden) return;
      window.clearTimeout(timer);
      void tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stop = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [id, updatedAt, closed, take]);

  // Mini Racer races the others' ghosts: fetch them when it is your turn.
  const needsReplays = game.slug === 'mini-racer' && !!view?.yourTurn && replays?.round !== view.round;
  const round = view?.round ?? 0;
  useEffect(() => {
    if (!id || !needsReplays) return;
    let live = true;
    challengeReplays(id).then(
      (r) => live && setReplays({ round, list: r.replays }),
      () => live && setReplays({ round, list: [] }),
    );
    return () => {
      live = false;
    };
  }, [id, needsReplays, round]);

  const seed = view?.seed;
  const mode = view?.mode;
  const day = view?.day;
  const spec = useMemo<ChallengeSpec | undefined>(
    () => (id && seed !== undefined && mode && day !== undefined ? { id, round, seed, mode, day, replays: replays?.round === round ? replays.list : undefined } : undefined),
    [id, round, seed, mode, day, replays],
  );

  const state = useMemo<ChallengeRunState>(() => {
    if (!id || !game.challenge) return { status: 'none' };
    if (problem === 'gone') return { status: 'gone' };
    if (problem) return { status: 'error', message: problem };
    if (!view || !spec) return { status: 'loading' };
    if (view.closed) return { status: 'closed', view };
    if (!view.joined) return { status: 'error', message: t('You left this challenge.'), view };
    if (sendError && sent?.round === view.round) return { status: 'error', message: sendError, spec, view };
    if (view.yourTurn) return needsReplays ? { status: 'loading', view } : { status: 'ready', view, spec };
    if (sent?.round === view.round) return { status: 'sent', view, score: sent.score, spec };
    return { status: 'played', view };
  }, [id, game.challenge, problem, view, spec, sent, sendError, needsReplays]);

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  const finish = useCallback(
    (e: EndEvent): void => {
      const s = stateRef.current;
      if (s.status !== 'ready' || !e.challenge || e.challenge.id !== s.spec.id || e.challenge.round !== s.spec.round) return;
      // A replay over the server's limit would sink the whole score, so it stays behind.
      const replay = e.challenge.replay && e.challenge.replay.length <= REPLAY_MAX ? e.challenge.replay : undefined;
      setSent({ round: s.spec.round, score: e.score });
      setSendError('');
      submitChallengeScore(s.spec.id, s.spec.round, e.score, e.stats, replay).then(
        (v) => take(v, false),
        (err: unknown) => setSendError(err instanceof ApiError ? (err.message !== err.code ? err.message : t('Your score was not saved.')) : t('Your score was not saved (network).')),
      );
    },
    [take],
  );

  const rematch = useCallback(async (): Promise<void> => {
    const v = viewRef.current;
    if (!id || !v) return;
    setBusy(true);
    try {
      take(await askRematch(id, v.round), false);
    } catch (e) {
      setNews((n) => ({ id: (n?.id ?? 0) + 1, text: errorText(e, t('Something went wrong.')) }));
    } finally {
      setBusy(false);
    }
  }, [id, take]);

  const close = useCallback(async (): Promise<'ended' | 'left' | 'deleted' | 'failed'> => {
    const v = viewRef.current;
    if (!id || !v) return 'failed';
    setBusy(true);
    try {
      const r = await closeChallenge(id);
      if ('gone' in r) {
        setProblem('gone');
        return 'deleted';
      }
      take(r, false);
      return v.host ? 'ended' : 'left';
    } catch (e) {
      setNews((n) => ({ id: (n?.id ?? 0) + 1, text: errorText(e, t('Something went wrong.')) }));
      return 'failed';
    } finally {
      setBusy(false);
    }
  }, [id, take]);

  return { state, news, busy, finish, rematch, close };
}

/** The round handed to the game: kept after the score is sent so the game stays in challenge mode. */
export function challengeSpecOf(state: ChallengeRunState): ChallengeSpec | undefined {
  return 'spec' in state ? state.spec : undefined;
}
