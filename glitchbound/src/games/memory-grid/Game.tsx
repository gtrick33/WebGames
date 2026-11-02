/**
 * Memory Grid: the React layer. It owns timers (playback, feedback beats, the clock), sound and rendering;
 * all rules live in engine.ts / pattern.ts / scoring.ts / records.ts.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import type { GameModuleProps } from '../../platform/contract';
import { dayKey, msUntilMidnight } from '../../platform/dates';
import { shareOrCopy } from '../../platform/share';
import { ResultLine } from '../../components/ResultLine';
import { createSfx, type Sfx } from './audio';
import { accuracy, createRun, next, playbackDone, resumeRun, tap, tick, type RunState } from './engine';
import { dailySeed, levelFor, MODES, PERFECT_LADDER, perfectSeed, randomSeed, SPEED_PENALTY_SECONDS, type Mode } from './pattern';
import {
  dailyToResume,
  dailyUsedToday,
  freshRecords,
  liveStreak,
  loadRecords,
  playedDailyToday,
  progressSummary,
  pruneChallenges,
  recordRun,
  RECORDS_KEY,
  saveRecords,
  settleDaily,
  type DailyProgress,
  type RecordOutcome,
  type Records,
} from './records';
import { NextDaily } from '../../components/NextDaily';
import { MODE_NAMES, reportStats, resultLine, shareText, type RunSummary } from './scoring';
import './Game.css';
import { openChallengeScores } from '../../platform/challenge';
import { GameMenuButton } from '../../components/GameMenuButton';

const MODE_BLURB: Record<Mode, string> = {
  classic: 'One more step every round. One slip ends it.',
  speed: '60 seconds on your turns. Misses cost 5 s.',
  daily: 'Same patterns for everyone today.',
  perfect: '10 set patterns, new every week. Zero mistakes.',
};

/** Feedback beats, in ms. */
const LEAD_IN_MS = 520;
const CLEARED_MS = 620;
const MISSED_MS = 760;
const OVER_MS = 1100;

/** Letter keys for a 4x4 grid, one row of the keyboard per row of tiles. */
const KEY_ROWS_4 = ['1234', 'qwer', 'asdf', 'zxcv'];

/**
 * The one place a round's end is reported. `isDaily` is true only for the official (first) Daily Challenge
 * attempt of the day, never for practice replays or other modes; the arcade counts it as this game's own daily.
 */
function reportEnd(host: GameModuleProps['host'], score: number, stats: Record<string, number>, isDaily: boolean): void {
  host.report(isDaily ? { type: 'end', score, stats, daily: true } : { type: 'end', score, stats });
}

type Screen = 'menu' | 'play' | 'result' | 'records';
type Flash = { tile: number; kind: 'hit' | 'miss'; id: number } | null;
type Outcome = RecordOutcome & { summary: RunSummary };
/**
 * The card over the board: paused by the arcade or a hidden tab, or asking before a run is left ('slip':
 * leaving ends the daily, its pattern was shown).
 */
type Pause = 'pause' | 'leave' | 'slip' | null;
type Challenge = NonNullable<GameModuleProps['challenge']>;

/** What the current run counts as: the day it started, whether it is that day's Daily Challenge, and its challenge round. */
interface RunCtx {
  day: string;
  daily: boolean;
  challengeKey?: string;
}

export default function Game({ host, restartKey, challenge, pauseKey }: GameModuleProps) {
  return <MemoryGrid key={restartKey} host={host} challenge={challenge} pauseKey={pauseKey} />;
}

const isDayKey = (d: string | undefined): d is string => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d);

/**
 * A friends' challenge round. A "Today's daily" challenge plays the game's own daily for its day; a fresh one
 * is a Classic run on patterns from the challenge's seed.
 */
function challengeSetup(c: Challenge): { mode: Mode; seed: string; day?: string } {
  if (c.mode === 'daily' && isDayKey(c.day)) return { mode: 'daily', seed: dailySeed(c.day), day: c.day };
  return { mode: 'classic', seed: `challenge:${c.seed}` };
}

/** A run picked up from its saved progress, ended there (a slip, or a finished round shown again). */
function endedRun(mode: Mode, seed: string, p: DailyProgress, complete = false): RunState {
  return { ...resumeRun(mode, seed, p), phase: 'over', end: complete ? 'complete' : 'mistake' };
}

function focusVisible(el: Element): boolean {
  try {
    return el.matches(':focus-visible');
  } catch {
    return false;
  }
}

function MemoryGrid({ host, challenge, pauseKey }: Pick<GameModuleProps, 'host' | 'challenge' | 'pauseKey'>) {
  const [records, setRecords] = useState<Records>(loadRecords);
  const [screen, setScreen] = useState<Screen>(challenge ? 'play' : 'menu');
  const [run, setRun] = useState<RunState | null>(null);
  const [lit, setLit] = useState<number | null>(null);
  const [flash, setFlash] = useState<Flash>(null);
  const [cursor, setCursor] = useState(0);
  const [keyboardNav, setKeyboardNav] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [note, setNote] = useState('');
  const [shareNote, setShareNote] = useState('');
  const [boardMode, setBoardMode] = useState<Mode>('classic');
  const [paused, setPaused] = useState<Pause>(null);
  const [today, setToday] = useState(() => dayKey());

  const runRef = useRef<RunState | null>(null);
  const ctxRef = useRef<RunCtx>({ day: today, daily: false });
  /** The round whose playback has begun: its one look is used up. */
  const shownRef = useRef(0);
  const screenRef = useRef(screen);
  const pausedRef = useRef(paused);
  const inChallenge = useRef(!!challenge);
  const [challengeShown, setChallengeShown] = useState(!!challenge);
  const sfxRef = useRef<Sfx | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const recordsRef = useRef(records);
  const flashId = useRef(0);
  const booted = useRef(false);

  useEffect(() => {
    recordsRef.current = records;
  }, [records]);
  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);
  /** Back to the menu, which always shows the real day (a tab left open over midnight). */
  const toMenu = useCallback(() => {
    setToday(dayKey());
    setScreen('menu');
  }, []);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  // Sound: one lazily created AudioContext, closed on unmount.
  useEffect(() => {
    const sfx = createSfx(recordsRef.current.muted);
    sfxRef.current = sfx;
    return () => {
      sfx.dispose();
      sfxRef.current = null;
    };
  }, []);

  const commit = useCallback((n: RunState | null) => {
    runRef.current = n;
    setRun(n);
  }, []);

  const keepRecords = useCallback((r: Records) => {
    recordsRef.current = r;
    setRecords(r);
    saveRecords(r);
  }, []);

  /** Read-modify-write: another tab may have saved since this one loaded. */
  const update = useCallback((fn: (r: Records) => Records) => keepRecords(fn(freshRecords(recordsRef.current))), [keepRecords]);

  /** Saves where a Daily Challenge or a challenge round stands, so leaving or reloading picks it up (or ends it). */
  const keepProgress = useCallback(
    (s: RunState, round: number, shown?: number) => {
      const ctx = ctxRef.current;
      if (!ctx.daily && !ctx.challengeKey) return;
      const p: DailyProgress = { day: ctx.day, round, cleared: s.cleared, longest: s.longest, score: s.score, taps: s.taps, correctTaps: s.correctTaps, inputMs: Math.round(s.inputMs), ...(shown ? { shown } : {}) };
      update((r) => {
        const n = { ...r };
        if (ctx.daily && !playedDailyToday(r, ctx.day)) {
          n.dailyStarted = ctx.day;
          n.dailyRun = p;
        }
        if (ctx.challengeKey) n.challenges = pruneChallenges({ ...r.challenges, [ctx.challengeKey]: p }, ctx.day);
        return n;
      });
    },
    [update],
  );

  const finish = useCallback(
    (s: RunState, opts: { note?: string; record?: boolean } = {}) => {
      const ctx = ctxRef.current;
      const summary: RunSummary = {
        mode: s.mode,
        score: s.score,
        cleared: s.cleared,
        longest: s.longest,
        accuracy: s.taps > 0 ? accuracy(s) : 0,
        taps: s.taps,
        inputMs: s.inputMs,
        complete: s.end === 'complete',
      };
      const fresh = freshRecords(recordsRef.current);
      // A challenge on another day's daily patterns is not that day's daily: it stays out of the local records.
      const skip = opts.record === false || (s.mode === 'daily' && !ctx.daily);
      const out: RecordOutcome = skip ? { records: fresh, newBest: [], place: null, officialDaily: false } : recordRun(fresh, summary, ctx.day);
      let r = out.records;
      if (ctx.challengeKey) {
        const done = { day: ctx.day, round: s.round, cleared: s.cleared, longest: s.longest, score: s.score, taps: s.taps, correctTaps: s.correctTaps, inputMs: Math.round(s.inputMs), done: true, ...(summary.complete ? { complete: true } : {}) };
        r = { ...r, challenges: pruneChallenges({ ...r.challenges, [ctx.challengeKey]: done }, ctx.day) };
      }
      keepRecords(r);
      setOutcome({ ...out, records: r, summary });
      setNote(opts.note ?? '');
      setShareNote('');
      // A daily finished after midnight is recorded under its own day, but it is no longer the arcade's daily.
      const isDaily = out.officialDaily && ctx.day === dayKey();
      const stats = reportStats(summary);
      if (ctx.challengeKey && challenge) host.report({ type: 'end', score: s.score, stats, ...(isDaily ? { daily: true } : {}), challenge: { id: challenge.id, round: challenge.round } });
      else reportEnd(host, s.score, stats, isDaily);
      if (s.end === 'complete') sfxRef.current?.complete();
    },
    [host, challenge, keepRecords],
  );

  /** Ends a Daily Challenge that can't go on (see settleDaily), unless this tab is playing it right now. */
  const settle = useCallback(() => {
    const live = runRef.current;
    if (live && ctxRef.current.daily && live.phase !== 'over' && screenRef.current === 'play') return;
    const now = dayKey();
    const st = settleDaily(freshRecords(recordsRef.current), now);
    if (!st) return;
    keepRecords(st.records);
    if (st.summary && st.day === now) reportEnd(host, st.summary.score, reportStats(st.summary), true);
  }, [host, keepRecords]);

  /** Shows a run that already ended as the result screen. */
  const showEnded = useCallback(
    (s: RunState, o: Outcome, n: string) => {
      commit(s);
      setOutcome(o);
      setNote(n);
      setScreen('result');
    },
    [commit],
  );

  const begin = useCallback(
    (first: RunState) => {
      shownRef.current = 0;
      sfxRef.current?.unlock();
      commit(first);
      keepProgress(first, first.round);
      setCursor(0);
      setFlash(null);
      setLit(null);
      setOutcome(null);
      setNote('');
      setPaused(null);
      setBoardMode(first.mode);
      setScreen('play');
      host.report({ type: 'start' });
    },
    [commit, host, keepProgress],
  );

  /**
   * A challenge round is one attempt: a finished round shows its result again, a round left after a pattern
   * was shown ends at once with its score so far, and one left between patterns picks up again.
   */
  const beginChallenge = useCallback(
    (c: Challenge) => {
      const now = dayKey();
      const key = `${c.id}:${c.round}`;
      const { mode, seed, day } = challengeSetup(c);
      const realDaily = mode === 'daily' && day === now;
      ctxRef.current = { day: day ?? now, daily: realDaily, challengeKey: key };
      const r = freshRecords(recordsRef.current);
      const entry = r.challenges?.[key];
      if (entry?.done) {
        const s = endedRun(mode, seed, entry, entry.complete);
        showEnded(s, { records: r, newBest: [], place: null, officialDaily: false, summary: progressSummary(entry, mode, entry.complete) }, 'You already played this round.');
        return;
      }
      if (realDaily && r.daily?.day === now) {
        // One attempt for both: today's daily result is this round's score.
        const d = r.daily;
        const p: DailyProgress = { day: now, round: d.cleared + 1, cleared: d.cleared, longest: d.longest ?? 0, score: d.score, taps: d.accuracy > 0 ? 100 : 0, correctTaps: d.accuracy, inputMs: 0 };
        commit(endedRun(mode, seed, p));
        finish(endedRun(mode, seed, p), { note: 'Your daily result counts here.', record: false });
        setScreen('result');
        return;
      }
      if (realDaily) {
        const resume = dailyToResume(r, now);
        begin(resume ? resumeRun(mode, seed, resume) : createRun(mode, seed));
        return;
      }
      if (entry && entry.shown === entry.round) {
        const s = endedRun(mode, seed, entry);
        commit(s);
        finish(s, { note: 'This round was already started.' });
        setScreen('result');
        return;
      }
      begin(entry ? resumeRun(mode, seed, entry) : createRun(mode, seed));
    },
    [begin, commit, finish, showEnded],
  );

  // On mount: settle a daily that can't go on, then a challenge round starts straight away.
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    settle();
    if (challenge) beginChallenge(challenge);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Midnight: the day moves on by itself, and a daily left unfinished yesterday is settled under its own day.
  const dayRef = useRef(today);
  useEffect(() => {
    if (dayRef.current !== today) {
      dayRef.current = today;
      settle();
    }
    const t = window.setTimeout(() => setToday(dayKey()), msUntilMidnight() + 50);
    return () => clearTimeout(t);
  }, [today, settle]);

  const start = useCallback(
    (mode: Mode) => {
      // The Daily Challenge is one try a day: starting it uses the try up, but a run left between patterns
      // (back to the menu, a reload) picks up again at the pattern it had reached.
      const now = dayKey();
      setToday(now);
      let first: RunState;
      if (mode === 'daily') {
        settle();
        const r = freshRecords(recordsRef.current);
        if (playedDailyToday(r, now)) {
          keepRecords(r);
          return;
        }
        const resume = dailyToResume(r, now);
        first = resume ? resumeRun('daily', dailySeed(now), resume) : createRun('daily', dailySeed(now));
      } else first = createRun(mode, mode === 'perfect' ? perfectSeed(now) : randomSeed());
      ctxRef.current = { day: now, daily: mode === 'daily' };
      inChallenge.current = false;
      setChallengeShown(false);
      begin(first);
    },
    [begin, keepRecords, settle],
  );

  const onTap = useCallback(
    (tile: number) => {
      const s = runRef.current;
      if (!s || pausedRef.current) return;
      const n = tap(s, tile, performance.now());
      if (n === s) return;
      commit(n);
      const ok = n.lastTap?.ok ?? false;
      setFlash({ tile, kind: ok ? 'hit' : 'miss', id: ++flashId.current });
      if (ok) {
        sfxRef.current?.tile(tile);
        if (n.phase === 'cleared') sfxRef.current?.cleared();
      } else sfxRef.current?.wrong();
      if (n.phase === 'cleared') keepProgress(n, n.round + 1);
      if (n.phase === 'over') finish(n);
    },
    [commit, finish, keepProgress],
  );

  const toggleMute = useCallback(() => {
    let muted = false;
    update((r) => {
      muted = !recordsRef.current.muted;
      return { ...r, muted };
    });
    sfxRef.current?.setMuted(muted);
    if (!muted) sfxRef.current?.unlock();
  }, [update]);

  const phase = run?.phase;
  const round = run?.round;

  /** Pauses a run in progress: the arcade's pauseKey, a hidden tab. */
  const pauseNow = useCallback(() => {
    const s = runRef.current;
    if (screenRef.current === 'play' && s && s.phase !== 'over') setPaused((p) => p ?? 'pause');
  }, []);

  const pauseSeen = useRef(pauseKey);
  useEffect(() => {
    if (pauseKey === pauseSeen.current) return;
    pauseSeen.current = pauseKey;
    pauseNow();
  }, [pauseKey, pauseNow]);

  // A hidden tab would miss the playback (or run the clock): pause, and play the pattern again on Continue.
  useEffect(() => {
    const onVis = (): void => {
      if (document.visibilityState === 'hidden') pauseNow();
      else setToday(dayKey());
    };
    const onFocus = (): void => setToday(dayKey());
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onFocus);
    };
  }, [pauseNow]);

  // Another tab saved: show its records; a daily it finished can't go on here.
  useEffect(() => {
    const onStorage = (e: StorageEvent): void => {
      if (e.key !== RECORDS_KEY && e.key !== null) return;
      const r = loadRecords();
      recordsRef.current = r;
      setRecords(r);
      sfxRef.current?.setMuted(r.muted);
      const s = runRef.current;
      const ctx = ctxRef.current;
      if (screenRef.current === 'play' && s && ctx.daily && s.phase !== 'over' && playedDailyToday(r, ctx.day)) {
        commit(null);
        setPaused(null);
        toMenu();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [commit, toMenu]);

  // Playback: light each step in turn, then hand over to the player. Input is ignored meanwhile (engine).
  // Pausing cancels it; it plays again from the start on Continue.
  useEffect(() => {
    const s = runRef.current;
    if (!s || phase !== 'showing' || paused) return;
    const timers: number[] = [];
    const { litMs, gapMs } = s.level;
    let t = LEAD_IN_MS;
    s.sequence.forEach((tile, k) => {
      timers.push(
        window.setTimeout(() => {
          // The pattern is now seen: a daily or challenge round left from here ends as a slip.
          if (k === 0 && shownRef.current !== s.round) {
            shownRef.current = s.round;
            keepProgress(s, s.round, s.round);
          }
          setLit(tile);
          sfxRef.current?.tile(tile);
        }, t),
      );
      t += litMs;
      timers.push(window.setTimeout(() => setLit(null), t));
      t += gapMs;
    });
    timers.push(
      window.setTimeout(() => {
        const cur = runRef.current;
        if (cur) commit(playbackDone(cur));
      }, t),
    );
    return () => {
      timers.forEach(clearTimeout);
      setLit(null);
    };
  }, [phase, round, paused, commit, keepProgress]);

  // Feedback beats between patterns, and the pause before the result screen.
  useEffect(() => {
    if (paused || (phase !== 'cleared' && phase !== 'missed' && phase !== 'over')) return;
    const delay = phase === 'cleared' ? CLEARED_MS : phase === 'missed' ? MISSED_MS : OVER_MS;
    const t = window.setTimeout(() => {
      const cur = runRef.current;
      if (!cur) return;
      if (cur.phase === 'over') setScreen('result');
      else commit(next(cur));
    }, delay);
    return () => clearTimeout(t);
  }, [phase, round, paused, commit]);

  // The player's-turn clock (Speed Run countdown, Perfect Recall time). It stops while paused. The running
  // time lives in runRef; React re-renders only when the shown seconds (or the phase) change.
  useEffect(() => {
    if (phase !== 'input' || paused) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number): void => {
      const dt = Math.min(250, now - last);
      last = now;
      const cur = runRef.current;
      if (cur) {
        const n = tick(cur, dt);
        if (n !== cur) {
          if (n.phase !== cur.phase || (n.mode === 'speed' && Math.ceil(n.timeLeftMs / 1000) !== Math.ceil(cur.timeLeftMs / 1000))) commit(n);
          else runRef.current = n;
          if (n.phase === 'over') {
            sfxRef.current?.wrong();
            finish(n);
            return;
          }
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase, round, paused, commit, finish]);

  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), 240);
    return () => clearTimeout(t);
  }, [flash]);

  /** Whether leaving now uses up the daily: its current pattern has been shown. */
  const dailyShown = (s: RunState): boolean => ctxRef.current.daily && shownRef.current === s.round && (s.phase === 'showing' || s.phase === 'input');

  const leave = useCallback(() => {
    const s = runRef.current;
    setPaused(null);
    if (s && s.phase !== 'over' && ctxRef.current.daily && shownRef.current === s.round && (s.phase === 'showing' || s.phase === 'input')) {
      // One slip ends the daily, and so does leaving after a pattern was shown: its points so far count.
      finish({ ...s, phase: 'over', end: 'mistake' });
    }
    commit(null);
    toMenu();
  }, [commit, finish, toMenu]);

  const onBack = (): void => {
    const s = runRef.current;
    if (screen === 'play' && s && s.phase !== 'over' && (ctxRef.current.daily ? dailyShown(s) : s.score > 0)) setPaused(ctxRef.current.daily ? 'slip' : 'leave');
    else leave();
  };

  // Keyboard: arrows move the cursor, Enter / Space taps, 1-9 tap a 3x3 grid like a number pad, 1234 / QWER /
  // ASDF / ZXCV a 4x4 grid, M mutes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const root = rootRef.current;
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (target) {
        // Keys for a field or a dialog are not for the grid (the pause card handles its own buttons).
        if (target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="dialog"], [aria-modal="true"]')) return;
        // Nor are keys for the page around the game. Clicking the game's background focuses the page's
        // <main>, which holds the game: that must not switch the keyboard off.
        if (root && target !== document.body && !root.contains(target) && !target.contains(root)) return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const act = e.key === 'Enter' || e.key === ' ';
      // A keyboard-focused button keeps Enter / Space (the tiles are played below).
      if (act && target?.closest('button, a') && !target.closest('.mg-tile') && focusVisible(target)) return;
      if (e.key === 'm' || e.key === 'M') {
        if (!e.repeat) toggleMute();
        return;
      }
      if (pausedRef.current) {
        if (e.key === 'Escape' || (act && pausedRef.current === 'pause')) {
          e.preventDefault();
          setPaused(null);
        }
        return;
      }
      const s = runRef.current;
      if (screen === 'result') {
        if (s && !inChallenge.current && !e.repeat && (e.key === 'r' || e.key === 'R' || (e.key === 'Enter' && !(target instanceof HTMLButtonElement)))) {
          e.preventDefault();
          // Like the button: the daily is one try a day, so its result offers Classic.
          start(s.mode === 'daily' ? 'classic' : s.mode);
        }
        return;
      }
      if (screen !== 'play' || !s) return;
      const n = s.level.size;
      const move = (dx: number, dy: number): void => {
        e.preventDefault();
        setKeyboardNav(true);
        setCursor((c) => {
          const x = Math.min(n - 1, Math.max(0, (c % n) + dx));
          const y = Math.min(n - 1, Math.max(0, Math.floor(c / n) + dy));
          return y * n + x;
        });
      };
      const k = e.key.toLowerCase();
      if (e.key === 'ArrowLeft') move(-1, 0);
      else if (e.key === 'ArrowRight') move(1, 0);
      else if (e.key === 'ArrowUp') move(0, -1);
      else if (e.key === 'ArrowDown') move(0, 1);
      else if (act) {
        e.preventDefault();
        setKeyboardNav(true);
        if (!e.repeat) onTap(Math.min(cursor, n * n - 1));
      } else if (n === 3 && /^[1-9]$/.test(e.key) && !e.repeat) {
        // Number-pad layout: 7 8 9 on top, 1 2 3 at the bottom.
        const d = Number(e.key) - 1;
        setKeyboardNav(true);
        onTap((2 - Math.floor(d / 3)) * 3 + (d % 3));
      } else if (n === 4 && k.length === 1 && !e.repeat) {
        const row = KEY_ROWS_4.findIndex((r) => r.includes(k));
        if (row < 0) return;
        e.preventDefault();
        setKeyboardNav(true);
        onTap(row * 4 + KEY_ROWS_4[row]!.indexOf(k));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen, cursor, onTap, start, toggleMute]);

  const share = async (): Promise<void> => {
    if (!outcome) return;
    const text = shareText({ ...outcome.summary, day: ctxRef.current.day, streak: liveStreak(records, today), ladder: PERFECT_LADDER.length });
    const res = await shareOrCopy({ title: 'Memory Grid', text, url: `${window.location.origin}/games/memory-grid` });
    setShareNote(res === 'copied' ? 'Copied to clipboard' : res === 'shared' ? 'Shared!' : res === 'failed' ? 'Could not copy' : '');
  };

  const muted = records.muted;
  const streak = liveStreak(records, today);
  // A challenge round is one attempt: no Back while it runs (the arcade's own menu stays).
  const showBack = screen === 'records' || (screen === 'play' && !challengeShown);

  return (
    <div className="mg" ref={rootRef} data-screen={screen} data-kbd={keyboardNav || undefined} onPointerDown={() => setKeyboardNav(false)}>
      <div className="mg-top">
        {showBack ? (
          <button className="mg-icon" onClick={onBack} aria-label="Back to menu">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ) : (
          <span className="mg-wordmark" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
        )}
        <span className="mg-top-title">{screen === 'play' && run ? (challengeShown ? '⚔️ Challenge round' : MODE_NAMES[run.mode]) : screen === 'records' ? 'Local records' : 'Memory Grid'}</span>
        <GameMenuButton className="mg-icon" />
        <button className="mg-icon" onClick={toggleMute} aria-label={muted ? 'Unmute sound' : 'Mute sound'} aria-pressed={muted}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
            {muted ? (
              <path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            ) : (
              <path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>

      {screen === 'menu' && (
        <Menu
          records={records}
          today={today}
          streak={streak}
          onStart={start}
          onRecords={() => setScreen('records')}
        />
      )}

      {screen === 'records' && <RecordsView records={records} mode={boardMode} onMode={setBoardMode} />}

      {screen === 'play' && run && (
        <Play run={run} lit={lit} flash={flash} cursor={cursor} keyboardNav={keyboardNav} best={records.best[run.mode]?.score ?? 0} onTap={onTap} onCursor={setCursor} />
      )}

      {screen === 'play' && run && paused && (
        <PauseCard
          kind={paused === 'pause' ? 'pause' : 'leave'}
          text={
            paused !== 'pause'
              ? paused === 'slip'
                ? `The daily ends here with ${run.score} pts: leaving after a pattern was shown counts as a slip.`
                : `${run.score} pts won’t count.`
              : run.phase === 'showing'
                ? 'The pattern plays again from the start.'
                : run.phase === 'input'
                  ? 'Your turn waits for you. The clock is stopped.'
                  : 'Ready when you are.'
          }
          onResume={() => setPaused(null)}
          onLeave={leave}
        />
      )}

      {screen === 'result' && run && outcome && (
        <Result
          run={run}
          challengeId={challengeShown ? challenge?.id : undefined}
          outcome={outcome}
          note={note}
          streak={streak}
          shareNote={shareNote}
          onRetry={() => start(run.mode === 'daily' ? 'classic' : run.mode)}
          onMenu={toMenu}
          onShare={() => void share()}
        />
      )}
    </div>
  );
}

function PauseCard({ kind, text, onResume, onLeave }: { kind: 'pause' | 'leave'; text: string; onResume: () => void; onLeave: () => void }) {
  return (
    <div className="mg-pause" role="dialog" aria-modal="true" aria-labelledby="mg-pause-title" aria-describedby="mg-pause-text">
      <div className="mg-pause-card">
        <h2 id="mg-pause-title" className="mg-pause-title">
          {kind === 'leave' ? 'Leave this run?' : 'Paused'}
        </h2>
        <p id="mg-pause-text" className="mg-pause-text">
          {text}
        </p>
        <div className="mg-pause-actions">
          <button className="mg-btn mg-btn-go" onClick={onResume} autoFocus>
            {kind === 'leave' ? 'Keep playing' : 'Continue'}
          </button>
          {kind === 'leave' && (
            <button className="mg-btn mg-btn-ghost" onClick={onLeave}>
              Leave
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ menu */

function Menu({ records, today, streak, onStart, onRecords }: { records: Records; today: string; streak: number; onStart: (m: Mode) => void; onRecords: () => void }) {
  const doneToday = playedDailyToday(records, today);
  const resume = dailyToResume(records, today);
  const usedToday = dailyUsedToday(records, today) && !resume;
  return (
    <div className="mg-menu">
      <div className="mg-hero">
        <h2 className="mg-title">
          Memory <span>Grid</span>
        </h2>
        <p className="mg-sub">Watch. Remember. Repeat.</p>
      </div>
      <div className="mg-modes">
        {MODES.map((m) => {
          const best = records.best[m];
          const isDaily = m === 'daily';
          return (
            <button key={m} className={`mg-mode mg-mode-${m}${isDaily && usedToday ? ' is-done' : ''}`} onClick={() => onStart(m)} disabled={isDaily && usedToday}>
              <span className="mg-mode-name">{MODE_NAMES[m]}</span>
              <span className="mg-mode-blurb">{MODE_BLURB[m]}</span>
              <span className="mg-mode-best">
                {isDaily && resume ? (
                  `Unfinished · resume at round ${resume.round} · ${resume.score} pts`
                ) : isDaily && usedToday ? (
                  <>
                    {doneToday && records.daily ? `Today: ${records.daily.score} pts · ` : 'Played today · '}
                    <NextDaily />
                  </>
                ) : isDaily
                    ? streak > 0
                      ? `🔥 ${streak}-day streak · play today`
                      : 'New pattern every day'
                    : best
                      ? m === 'perfect' && best.fastest
                        ? `Best ${best.score} · ${best.fastest}s`
                        : `Best ${best.score} · longest ${best.longest}`
                      : 'No record yet'}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mg-menu-foot">
        <span className="mg-chip">🔥 Streak {streak} · best {records.streak.best}</span>
        <button className="mg-link" onClick={onRecords}>
          Local records
        </button>
      </div>
    </div>
  );
}

function RecordsView({ records, mode, onMode }: { records: Records; mode: Mode; onMode: (m: Mode) => void }) {
  const rows = records.board[mode] ?? [];
  const best = records.best[mode];
  return (
    <div className="mg-records">
      <div className="mg-tabs" role="tablist" aria-label="Mode">
        {MODES.map((m) => (
          <button key={m} role="tab" aria-selected={m === mode} className="mg-tab" onClick={() => onMode(m)}>
            {MODE_NAMES[m].replace(' Challenge', '')}
          </button>
        ))}
      </div>
      <ol className="mg-board-list">
        {rows.length === 0 && <li className="mg-empty">No runs yet. Your top 5 land here.</li>}
        {rows.map((r, i) => (
          <li key={`${r.day}-${i}`}>
            <span className="mg-rank">{i + 1}</span>
            <span className="mg-row-score">{r.score}</span>
            <span className="mg-row-meta">longest {r.longest}</span>
            <span className="mg-row-day">{r.day.slice(5).replace('-', '/')}</span>
          </li>
        ))}
      </ol>
      {best && (
        <p className="mg-records-foot">
          {best.plays} {best.plays === 1 ? 'run' : 'runs'}
          {best.accuracy > 0 ? ` · best accuracy ${best.accuracy}%` : ''}
          {best.fastest ? ` · fastest ${best.fastest}s` : ''}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ play */

const TILE_COLORS = ['#ff5a6c', '#ff8a1f', '#ffc928', '#9fdc2c', '#12c6b3', '#2fb5ff', '#4a64ff', '#8b5cff', '#ff4fb8'];

function Play({
  run,
  lit,
  flash,
  cursor,
  keyboardNav,
  best,
  onTap,
  onCursor,
}: {
  run: RunState;
  lit: number | null;
  flash: Flash;
  cursor: number;
  keyboardNav: boolean;
  best: number;
  onTap: (t: number) => void;
  onCursor: (t: number) => void;
}) {
  const { size } = run.level;
  const total = size * size;
  const expected = run.phase === 'over' && run.end === 'mistake' ? run.sequence[run.step] : run.phase === 'missed' ? run.sequence[run.step] : undefined;
  const status =
    run.phase === 'showing'
      ? 'Watch closely…'
      : run.phase === 'input'
        ? 'Your turn'
        : run.phase === 'cleared'
          ? 'Nice!'
          : run.phase === 'missed'
            ? `Missed! −${SPEED_PENALTY_SECONDS}s`
            : run.end === 'complete'
              ? 'Perfect recall!'
              : run.end === 'timeout'
                ? 'Time!'
                : 'Not quite…';
  const upcoming = run.phase === 'cleared' ? levelFor(run.mode, run.round + 1, run.cleared) : null;
  // Keyboard play moves real focus, so screen readers announce the tile.
  const tileRefs = useRef<Array<HTMLButtonElement | null>>([]);
  useEffect(() => {
    if (keyboardNav) tileRefs.current[cursor]?.focus({ preventScroll: true });
  }, [keyboardNav, cursor, size]);
  const keys = size === 3 ? 'Keys: number pad 1–9, or arrows + Enter' : size === 4 ? 'Keys: 1234 / QWER / ASDF / ZXCV, or arrows + Enter' : 'Keys: arrows + Enter';

  return (
    <div className={`mg-play mg-phase-${run.phase}`}>
      <div className="mg-hud" aria-live="off">
        {run.mode === 'speed' ? (
          <Stat label="Time" value={`${Math.ceil(run.timeLeftMs / 1000)}s`} hot={run.timeLeftMs < 10_000} />
        ) : run.mode === 'perfect' ? (
          <Stat label="Pattern" value={`${run.round}/${PERFECT_LADDER.length}`} />
        ) : (
          <Stat label="Round" value={run.round} />
        )}
        <Stat label="Score" value={run.score} />
        {run.mode === 'speed' ? <Stat label="Patterns" value={run.cleared} /> : <Stat label="Best" value={Math.max(best, run.score)} />}
      </div>

      <div className="mg-boardwrap">
        <div className="mg-board" style={{ '--n': size } as CSSProperties} role="group" aria-label={`${size} by ${size} memory grid`}>
          {Array.from({ length: total }, (_, i) => {
            const row = Math.floor(i / size);
            const cls = [
              'mg-tile',
              lit === i && 'is-lit',
              flash?.tile === i && `is-${flash.kind}`,
              expected === i && 'is-expected',
              run.phase === 'over' && run.lastTap?.tile === i && !run.lastTap.ok && 'is-wrong',
              cursor === i && 'is-cursor',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <button
                key={`${size}-${i}`}
                ref={(el) => {
                  tileRefs.current[i] = el;
                }}
                className={cls}
                style={{ '--c': TILE_COLORS[(row * size + (i % size)) % TILE_COLORS.length], '--d': `${(row + (i % size)) * 22}ms` } as CSSProperties}
                tabIndex={cursor === i ? 0 : -1}
                aria-label={`Row ${row + 1}, column ${(i % size) + 1}`}
                aria-disabled={run.phase !== 'input'}
                onPointerDown={(e) => {
                  if (e.button > 0) return;
                  e.preventDefault();
                  onCursor(i);
                  onTap(i);
                }}
                onContextMenu={(e) => e.preventDefault()}
              />
            );
          })}
        </div>
      </div>

      <div className="mg-status">
        <p className="mg-status-text" role="status">
          {status}
          {upcoming && upcoming.size !== run.level.size ? ` Grid grows to ${upcoming.size}×${upcoming.size}!` : ''}
        </p>
        <div className="mg-dots" aria-label={`${run.step} of ${run.sequence.length} steps`}>
          {run.sequence.map((_, i) => (
            <i key={i} className={i < run.step ? 'on' : run.phase === 'input' && i === run.step ? 'now' : ''} />
          ))}
        </div>
        {keyboardNav && <p className="mg-keys">{keys}</p>}
      </div>
    </div>
  );
}

function Stat({ label, value, hot }: { label: string; value: string | number; hot?: boolean }) {
  return (
    <div className={`mg-stat${hot ? ' is-hot' : ''}`}>
      <span className="mg-stat-label">{label}</span>
      <span className="mg-stat-value">{value}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ result */

function Result({
  run,
  challengeId,
  outcome,
  note,
  streak,
  shareNote,
  onRetry,
  onMenu,
  onShare,
}: {
  run: RunState;
  /** Set for a friends' challenge round: one attempt, then the scoreboard. */
  challengeId?: string;
  outcome: Outcome;
  /** Why the result shows without a round being played (a challenge round already started or played). */
  note: string;
  streak: number;
  shareNote: string;
  onRetry: () => void;
  onMenu: () => void;
  onShare: () => void;
}) {
  const s = outcome.summary;
  const headline = s.complete ? 'Flawless!' : run.end === 'timeout' ? 'Time’s up!' : outcome.newBest.includes('score') ? 'New best!' : 'So close!';
  const best = outcome.records.best[s.mode];
  return (
    <div className="mg-result">
      <p className="mg-result-mode">{challengeId ? '⚔️ Challenge round' : MODE_NAMES[s.mode]}</p>
      <h2 className="mg-result-head">{headline}</h2>
      {note && <p className="mg-result-note">{note}</p>}
      <p className="mg-result-score">
        <span>{s.score}</span> pts
      </p>
      <div className="mg-result-badges">
        {outcome.newBest.includes('score') && <span className="mg-badge">★ Best score</span>}
        {outcome.newBest.includes('longest') && <span className="mg-badge">★ Longest sequence</span>}
        {outcome.newBest.includes('fastest') && <span className="mg-badge">★ Fastest</span>}
        {outcome.place && outcome.place > 1 && <span className="mg-badge mg-badge-soft">#{outcome.place} in your top 5</span>}
        {s.mode === 'daily' && (outcome.officialDaily ? <span className="mg-badge mg-badge-soft">🔥 {streak}-day streak</span> : <span className="mg-badge mg-badge-soft">Practice run</span>)}
      </div>
      <ResultLine line={resultLine(s, PERFECT_LADDER.length)} label={`${s.cleared} ${s.cleared === 1 ? 'pattern' : 'patterns'} ${s.mode === 'speed' ? 'cleared' : 'in a row'}`} />
      <dl className="mg-result-stats">
        <div>
          <dt>{s.mode === 'perfect' ? 'Cleared' : 'Patterns'}</dt>
          <dd>{s.mode === 'perfect' ? `${s.cleared}/${PERFECT_LADDER.length}` : s.cleared}</dd>
        </div>
        <div>
          <dt>Longest</dt>
          <dd>{s.longest}</dd>
        </div>
        <div>
          <dt>Accuracy</dt>
          <dd>{s.taps > 0 ? `${s.accuracy}%` : '–'}</dd>
        </div>
        <div>
          <dt>{s.mode === 'perfect' && s.complete ? 'Time' : 'Best'}</dt>
          <dd>{s.mode === 'perfect' && s.complete ? `${Math.max(1, Math.round(s.inputMs / 1000))}s` : (best?.score ?? s.score)}</dd>
        </div>
      </dl>
      <div className="mg-result-actions">
        {challengeId ? (
          <a className="mg-btn mg-btn-go" href={`/c/${challengeId}`} onClick={openChallengeScores} autoFocus>
            See the scoreboard
          </a>
        ) : (
          <button className="mg-btn mg-btn-go" onClick={onRetry} autoFocus>
            {s.mode === 'daily' ? 'Play Classic' : 'Retry'} <kbd>Enter</kbd>
          </button>
        )}
        <button className="mg-btn" onClick={onShare}>
          Share
        </button>
        <button className="mg-btn mg-btn-ghost" onClick={onMenu}>
          Modes
        </button>
      </div>
      <p className="mg-share-note" role="status">
        {shareNote}
      </p>
    </div>
  );
}
