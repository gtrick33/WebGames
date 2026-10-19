/**
 * Memory Grid: the React layer. It owns timers (playback, feedback beats, the clock), sound and rendering;
 * all rules live in engine.ts / pattern.ts / scoring.ts / records.ts.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import type { GameModuleProps } from '../../platform/contract';
import { dayKey } from '../../platform/dates';
import { shareOrCopy } from '../../platform/share';
import { ResultLine } from '../../components/ResultLine';
import { createSfx, type Sfx } from './audio';
import { accuracy, createRun, next, playbackDone, resumeRun, tap, tick, type RunState } from './engine';
import { dailySeed, levelFor, MODES, PERFECT_LADDER, perfectSeed, randomSeed, SPEED_PENALTY_SECONDS, type Mode } from './pattern';
import { dailyToResume, dailyUsedToday, liveStreak, loadRecords, playedDailyToday, recordRun, saveRecords, type RecordOutcome, type Records } from './records';
import { NextDaily } from '../../components/NextDaily';
import { MODE_NAMES, reportStats, resultLine, shareText, type RunSummary } from './scoring';
import './Game.css';
import { openChallengeScores } from '../../platform/challenge';

const MODE_BLURB: Record<Mode, string> = {
  classic: 'One more step every round. One slip ends it.',
  speed: '60 seconds on your turns. Misses cost 5 s.',
  daily: 'Same patterns for everyone today.',
  perfect: '10 set patterns, new every week. Zero mistakes.',
};

/** Feedback beats, in ms. */
const LEAD_IN_MS = 520;
const CLEARED_MS = 620;
const MISSED_MS = 760;
const OVER_MS = 1100;

/**
 * The one place a round's end is reported. `isDaily` is true only for the official (first) Daily Challenge
 * attempt of the day, never for practice replays or other modes; the arcade counts it as this game's own daily.
 */
function reportEnd(host: GameModuleProps['host'], score: number, stats: Record<string, number>, isDaily: boolean): void {
  host.report(isDaily ? { type: 'end', score, stats, daily: true } : { type: 'end', score, stats });
}

type Screen = 'menu' | 'play' | 'result' | 'records';
type Flash = { tile: number; kind: 'hit' | 'miss'; id: number } | null;

export default function Game({ host, restartKey, challenge }: GameModuleProps) {
  return <MemoryGrid key={restartKey} host={host} challenge={challenge} />;
}

/** A friends' challenge is a Classic run on patterns from the challenge's seed. */
const challengeRun = (c: NonNullable<GameModuleProps['challenge']>): RunState => createRun('classic', `challenge:${c.seed}`);

function MemoryGrid({ host, challenge }: Pick<GameModuleProps, 'host' | 'challenge'>) {
  const [records, setRecords] = useState<Records>(loadRecords);
  const [screen, setScreen] = useState<Screen>(challenge ? 'play' : 'menu');
  const [firstRun] = useState(() => (challenge ? challengeRun(challenge) : null));
  const [run, setRun] = useState<RunState | null>(firstRun);
  const [lit, setLit] = useState<number | null>(null);
  const [flash, setFlash] = useState<Flash>(null);
  const [cursor, setCursor] = useState(0);
  const [keyboardNav, setKeyboardNav] = useState(false);
  const [outcome, setOutcome] = useState<(RecordOutcome & { summary: RunSummary }) | null>(null);
  const [shareNote, setShareNote] = useState('');
  const [boardMode, setBoardMode] = useState<Mode>('classic');
  const [replay, setReplay] = useState(0);
  const [today] = useState(() => dayKey());

  const runRef = useRef<RunState | null>(firstRun);
  const inChallenge = useRef(!!challenge);
  const [challengeShown, setChallengeShown] = useState(!!challenge);
  const sfxRef = useRef<Sfx | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const recordsRef = useRef(records);
  const flashId = useRef(0);

  useEffect(() => {
    recordsRef.current = records;
  }, [records]);

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

  const finish = useCallback(
    (s: RunState) => {
      const summary: RunSummary = {
        mode: s.mode,
        score: s.score,
        cleared: s.cleared,
        longest: s.longest,
        accuracy: accuracy(s),
        taps: s.taps,
        inputMs: s.inputMs,
        complete: s.end === 'complete',
      };
      const out = recordRun(recordsRef.current, summary, today);
      recordsRef.current = out.records;
      setRecords(out.records);
      saveRecords(out.records);
      setOutcome({ ...out, summary });
      setShareNote('');
      if (inChallenge.current && challenge) host.report({ type: 'end', score: s.score, stats: reportStats(summary), challenge: { id: challenge.id, round: challenge.round } });
      else reportEnd(host, s.score, reportStats(summary), out.officialDaily);
      if (s.end === 'complete') sfxRef.current?.complete();
    },
    [host, today, challenge],
  );

  const keepRecords = useCallback((r: Records) => {
    recordsRef.current = r;
    setRecords(r);
    saveRecords(r);
  }, []);

  // A challenge round starts straight away.
  useEffect(() => {
    if (challenge) host.report({ type: 'start' });
    // A Daily Challenge started (and left) before unfinished runs were saved can't be resumed: it ends
    // here, once, with nothing scored, so the arcade streak still counts the day.
    const r = recordsRef.current;
    if (r.dailyStarted === today && !playedDailyToday(r, today) && !r.dailyRun) {
      const summary: RunSummary = { mode: 'daily', score: 0, cleared: 0, longest: 0, accuracy: 0, taps: 0, inputMs: 0, complete: false };
      keepRecords(recordRun(r, summary, today).records);
      reportEnd(host, 0, reportStats(summary), true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Saves where today's Daily Challenge stands (after each cleared pattern), so it can be resumed. */
  const keepDaily = useCallback(
    (s: RunState, round: number) => {
      const { cleared, longest, score, taps, correctTaps, inputMs } = s;
      keepRecords({ ...recordsRef.current, dailyStarted: today, dailyRun: { day: today, round, cleared, longest, score, taps, correctTaps, inputMs } });
    },
    [keepRecords, today],
  );

  const start = useCallback(
    (mode: Mode) => {
      // The Daily Challenge is one try a day: starting it uses the try up, but a run left halfway
      // (back to the menu, a reload) picks up again at the pattern it had reached.
      let first: RunState | null = null;
      if (mode === 'daily') {
        if (playedDailyToday(recordsRef.current, today)) return;
        const resume = dailyToResume(recordsRef.current, today);
        first = resume ? resumeRun('daily', dailySeed(today), resume) : createRun('daily', dailySeed(today));
        keepDaily(first, first.round);
      }
      inChallenge.current = false;
      setChallengeShown(false);
      sfxRef.current?.unlock();
      const seed = mode === 'daily' ? dailySeed(today) : mode === 'perfect' ? perfectSeed(today) : randomSeed();
      commit(first ?? createRun(mode, seed));
      setCursor(0);
      setFlash(null);
      setLit(null);
      setOutcome(null);
      setBoardMode(mode);
      setScreen('play');
      host.report({ type: 'start' });
    },
    [commit, host, today, keepDaily],
  );

  const onTap = useCallback(
    (tile: number) => {
      const s = runRef.current;
      if (!s) return;
      const n = tap(s, tile, performance.now());
      if (n === s) return;
      commit(n);
      const ok = n.lastTap?.ok ?? false;
      setFlash({ tile, kind: ok ? 'hit' : 'miss', id: ++flashId.current });
      if (ok) {
        sfxRef.current?.tile(tile);
        if (n.phase === 'cleared') sfxRef.current?.cleared();
      } else sfxRef.current?.wrong();
      if (n.phase === 'cleared' && n.mode === 'daily') keepDaily(n, n.round + 1);
      if (n.phase === 'over') finish(n);
    },
    [commit, finish, keepDaily],
  );

  const toggleMute = useCallback(() => {
    const r = { ...recordsRef.current, muted: !recordsRef.current.muted };
    recordsRef.current = r;
    setRecords(r);
    saveRecords(r);
    sfxRef.current?.setMuted(r.muted);
    if (!r.muted) sfxRef.current?.unlock();
  }, []);

  const phase = run?.phase;
  const round = run?.round;

  // Playback: light each step in turn, then hand over to the player. Input is ignored meanwhile (engine).
  useEffect(() => {
    const s = runRef.current;
    if (!s || phase !== 'showing') return;
    const timers: number[] = [];
    const { litMs, gapMs } = s.level;
    let t = LEAD_IN_MS;
    s.sequence.forEach((tile) => {
      timers.push(
        window.setTimeout(() => {
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
  }, [phase, round, replay, commit]);

  // A hidden tab would miss the playback: replay it when the player comes back.
  useEffect(() => {
    const onVis = (): void => {
      if (document.visibilityState === 'visible' && runRef.current?.phase === 'showing') setReplay((r) => r + 1);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Feedback beats between patterns, and the pause before the result screen.
  useEffect(() => {
    if (phase !== 'cleared' && phase !== 'missed' && phase !== 'over') return;
    const delay = phase === 'cleared' ? CLEARED_MS : phase === 'missed' ? MISSED_MS : OVER_MS;
    const t = window.setTimeout(() => {
      const cur = runRef.current;
      if (!cur) return;
      if (cur.phase === 'over') setScreen('result');
      else commit(next(cur));
    }, delay);
    return () => clearTimeout(t);
  }, [phase, round, commit]);

  // The player's-turn clock (Speed Run countdown, Perfect Recall time). rAF stops in hidden tabs, so it pauses.
  useEffect(() => {
    if (phase !== 'input') return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number): void => {
      const dt = Math.min(250, now - last);
      last = now;
      const cur = runRef.current;
      if (cur) {
        const n = tick(cur, dt);
        if (n !== cur) {
          commit(n);
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
  }, [phase, round, commit, finish]);

  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), 240);
    return () => clearTimeout(t);
  }, [flash]);

  // Keyboard: arrows move the cursor, Enter / Space taps, 1-9 tap a 3x3 grid like a number pad, M mutes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      // Keys for a field or button around the game are not for the grid. Clicking the game's background
      // focuses the page's <main>, which must not switch the keyboard off.
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (target && !rootRef.current?.contains(target) && target.closest('input, textarea, select, button, a, [contenteditable="true"]')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'm' || e.key === 'M') {
        toggleMute();
        return;
      }
      const s = runRef.current;
      if (screen === 'result') {
        if (s && !inChallenge.current && (e.key === 'r' || e.key === 'R' || (e.key === 'Enter' && !(target instanceof HTMLButtonElement)))) {
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
      if (e.key === 'ArrowLeft') move(-1, 0);
      else if (e.key === 'ArrowRight') move(1, 0);
      else if (e.key === 'ArrowUp') move(0, -1);
      else if (e.key === 'ArrowDown') move(0, 1);
      else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setKeyboardNav(true);
        if (!e.repeat) onTap(Math.min(cursor, n * n - 1));
      } else if (n === 3 && /^[1-9]$/.test(e.key) && !e.repeat) {
        // Number-pad layout: 7 8 9 on top, 1 2 3 at the bottom.
        const k = Number(e.key) - 1;
        onTap((2 - Math.floor(k / 3)) * 3 + (k % 3));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen, cursor, onTap, start, toggleMute]);

  const share = async (): Promise<void> => {
    if (!outcome) return;
    const text = shareText({ ...outcome.summary, day: today, streak: liveStreak(records, today), ladder: PERFECT_LADDER.length });
    const res = await shareOrCopy({ title: 'Memory Grid', text, url: `${window.location.origin}/games/memory-grid` });
    setShareNote(res === 'copied' ? 'Copied to clipboard' : res === 'shared' ? 'Shared!' : res === 'failed' ? 'Could not copy' : '');
  };

  const muted = records.muted;
  const streak = liveStreak(records, today);

  return (
    <div className="mg" ref={rootRef} data-screen={screen} data-kbd={keyboardNav || undefined} onPointerDown={() => setKeyboardNav(false)}>
      <div className="mg-top">
        {screen === 'play' || screen === 'records' ? (
          <button className="mg-icon" onClick={() => {
              commit(null);
              setScreen('menu');
            }} aria-label="Back to menu">
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
        <span className="mg-top-title">{screen === 'play' && run ? MODE_NAMES[run.mode] : screen === 'records' ? 'Local records' : 'Memory Grid'}</span>
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

      {screen === 'play' && run && <Play run={run} lit={lit} flash={flash} cursor={cursor} best={records.best[run.mode]?.score ?? 0} onTap={onTap} onCursor={setCursor} />}

      {screen === 'result' && run && outcome && (
        <Result
          run={run}
          challengeId={challengeShown ? challenge?.id : undefined}
          outcome={outcome}
          streak={streak}
          shareNote={shareNote}
          onRetry={() => start(run.mode === 'daily' ? 'classic' : run.mode)}
          onMenu={() => setScreen('menu')}
          onShare={() => void share()}
        />
      )}
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
          {best.plays} {best.plays === 1 ? 'run' : 'runs'} · best accuracy {best.accuracy}%{best.fastest ? ` · fastest ${best.fastest}s` : ''}
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
  best,
  onTap,
  onCursor,
}: {
  run: RunState;
  lit: number | null;
  flash: Flash;
  cursor: number;
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
        <div className="mg-board" style={{ '--n': size } as CSSProperties} role="grid" aria-label={`${size} by ${size} memory grid`}>
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
  streak,
  shareNote,
  onRetry,
  onMenu,
  onShare,
}: {
  run: RunState;
  /** Set for a friends' challenge round: one attempt, then the scoreboard. */
  challengeId?: string;
  outcome: RecordOutcome & { summary: RunSummary };
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
      <ResultLine line={resultLine(s, PERFECT_LADDER.length)} label={`${s.cleared} ${s.cleared === 1 ? 'pattern' : 'patterns'} in a row`} />
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
          <dd>{s.accuracy}%</dd>
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
