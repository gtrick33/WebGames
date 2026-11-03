import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { GameHost, GameModuleProps } from '../../platform/contract';
import { dayKey, formatCountdown, hashString, msUntilMidnight, parseDayKey } from '../../platform/dates';
import { shareOrCopy } from '../../platform/share';
import { ResultLine } from '../../components/ResultLine';
import { DIFFS, makePuzzle, type Puzzle } from './diffs';
import { drawScene } from './draw';
import {
  applyHint,
  challengeGen,
  DAILY_PICTURES,
  dailyNumber,
  dailyPuzzle,
  endStats,
  giveUp,
  HINT_COST,
  isDone,
  LOCK_MS,
  MAX_PICTURE,
  MISS_COST,
  pictureScore,
  progressOf,
  resultOf,
  resumePicture,
  RUSH_BONUS_S,
  RUSH_HINT_S,
  RUSH_START_S,
  rushDifficulty,
  rushEnd,
  seconds,
  resultGrid,
  shareText,
  startPicture,
  tap,
  timePenalty,
  totalScore,
  type PictureProgress,
  type PictureResult,
  type PictureState,
} from './logic';
import { H, THEME_NAMES, W, type Scene } from './scene';
import { createSfx, type Sfx } from './sound';
import { isComplete, loadSg, recordChallenge, recordPicture, recordRush, sgStats, STORE_KEY, updateSg, type SgSave } from './store';
import './Game.css';
import { openChallengeScores } from '../../platform/challenge';
import { GameMenuButton } from '../../components/GameMenuButton';

type Mode = 'daily' | 'rush' | 'relax';
type Screen = 'menu' | 'play';
const fmt = (n: number): string => Math.round(n).toLocaleString('en-US');
const LEVELS = ['Easy', 'Medium', 'Hard'];
const randomSeed = (): number => Math.floor(Math.random() * 2 ** 32);
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export default function Game({ host, restartKey, pauseKey, challenge }: GameModuleProps) {
  return <SpotTheGlitch key={restartKey} host={host} pauseKey={pauseKey} challenge={challenge} />;
}

interface Run {
  mode: Mode;
  /** The day a daily belongs to: a daily started before midnight finishes as that day's. */
  day: string;
  index: number;
  results: PictureResult[];
  over: boolean;
  /** Glitch Rush: clock ms left, total differences found, and whether the player ended the run. */
  clock: number;
  rushFound: number;
  endedByPlayer?: boolean;
  /**
   * A friends' challenge: three daily-style pictures (mode stays 'daily'), from the challenge's seed,
   * or for a "today's daily" challenge the real daily of its day (one attempt for both).
   */
  challenge?: { id: string; round: number; seed: number; daily: boolean; day: string };
  /** A daily challenge whose daily was already played: its result counts here. */
  fromDaily?: boolean;
}

const challengeKey = (c: { id: string; round: number }): string => `${c.id}:${c.round}`;
/** The own daily, or a challenge that plays it: results and progress live in the daily save. */
const playsDaily = (r: Run): boolean => r.mode === 'daily' && (!r.challenge || r.challenge.daily);

function puzzleFor(run: Run, relaxLevel: number): Puzzle {
  if (run.challenge && !run.challenge.daily)
    return makePuzzle(hashString(`spot-the-glitch:challenge:${run.challenge.seed}:${run.index}`), Math.min(2, run.index), undefined, challengeGen(run.challenge.day));
  if (run.mode === 'daily') return dailyPuzzle(run.day, run.index);
  if (run.mode === 'rush') return makePuzzle(randomSeed(), rushDifficulty(run.index));
  return makePuzzle(randomSeed(), relaxLevel);
}

/** The finished pictures a daily-style run starts from (the day's daily, or the challenge round's). */
function doneFor(s: SgSave, r: Run): PictureResult[] {
  if (r.challenge && !r.challenge.daily) return s.challenges[challengeKey(r.challenge)]?.results ?? [];
  return s.daily[r.day] ?? [];
}

/** The unfinished picture to pick up again, if this run's current one was left halfway. */
function progressFor(s: SgSave, r: Run): PictureProgress | null {
  if (r.mode !== 'daily') return null;
  if (r.challenge && !r.challenge.daily) {
    const e = s.challenges[challengeKey(r.challenge)];
    return e && e.results.length === r.index ? e.progress : null;
  }
  const p = s.progress;
  return p && p.day === r.day && p.index === r.index ? p : null;
}

/** A challenge round as this device left it: finished (its result), halfway (resumes) or new. */
function challengeRun(s: SgSave, c: NonNullable<GameModuleProps['challenge']>): Run {
  const daily = c.mode === 'daily' && DAY.test(c.day);
  const base: Run = {
    mode: 'daily',
    day: daily ? c.day : dayKey(),
    index: 0,
    results: [],
    over: false,
    clock: RUSH_START_S * 1000,
    rushFound: 0,
    challenge: { id: c.id, round: c.round, seed: c.seed, daily, day: c.day },
  };
  const done = doneFor(s, base);
  return { ...base, index: done.length, results: done, over: isComplete(done), fromDaily: daily && isComplete(done) };
}

/** A game clock that only runs while the picture is on screen and the game is not paused. */
function useClock(running: boolean): [number, () => number] {
  const [ms, setMs] = useState(0);
  const ref = useRef({ base: 0, since: 0 });
  useEffect(() => {
    if (!running) return;
    const clock = ref.current;
    clock.since = performance.now();
    const t = window.setInterval(() => setMs(clock.base + performance.now() - clock.since), 100);
    return () => {
      clock.base += performance.now() - clock.since;
      window.clearInterval(t);
    };
  }, [running]);
  const now = useCallback(() => (running ? ref.current.base + performance.now() - ref.current.since : ref.current.base), [running]);
  return [ms, now];
}

function SpotTheGlitch({ host, pauseKey, challenge }: { host: GameHost; pauseKey?: number; challenge?: GameModuleProps['challenge'] }) {
  // Not frozen at mount: re-read when the menu shows, the tab comes back and a round starts.
  const [today, setToday] = useState(() => dayKey());
  const [save, setSave] = useState<SgSave>(loadSg);
  const [firstRun] = useState<Run | null>(() => (challenge ? challengeRun(save, challenge) : null));
  const [screen, setScreen] = useState<Screen>(challenge ? 'play' : 'menu');
  const [run, setRun] = useState<Run | null>(firstRun);
  const [pic, setPic] = useState<PictureState | null>(() => {
    if (!firstRun || firstRun.over) return null;
    const puzzle = puzzleFor(firstRun, 0);
    const p = progressFor(save, firstRun);
    return p ? resumePicture(puzzle, 0, p) : startPicture(puzzle, 0);
  });
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const saveRef = useRef(save);
  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  }, [run]);
  /** Every write re-reads the stored save first, so a second tab's results are never overwritten. */
  const commit = useCallback(
    (change: (s: SgSave) => SgSave) => {
      const next = updateSg(change, dayKey());
      saveRef.current = next;
      setSave(next);
    },
    [],
  );
  const sfxRef = useRef<Sfx | null>(null);
  const sfx = useCallback((): Sfx => (sfxRef.current ??= createSfx(() => saveRef.current.muted)), []);
  useEffect(
    () => () => {
      sfxRef.current?.dispose();
      sfxRef.current = null;
    },
    [],
  );

  /** Reports a challenge round's end, exactly once per round (a reload shows the result instead). */
  const endChallenge = useCallback(
    (r: Run, results: PictureResult[]) => {
      if (!r.challenge) return;
      const key = challengeKey(r.challenge);
      if (loadSg().challenges[key]?.reported) return;
      host.report({ type: 'end', ...endStats(results), challenge: { id: r.challenge.id, round: r.challenge.round } });
      saveRef.current = updateSg((s) => recordChallenge(s, key, dayKey(), { results, progress: null, reported: true }), dayKey());
    },
    [host],
  );
  useEffect(() => {
    if (!challenge) return;
    host.report({ type: 'start' });
    if (firstRun?.over) endChallenge(firstRun, firstRun.results);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pause when the arcade asks (left full screen / scrolled away) or the tab is hidden.
  const [pauseSeen, setPauseSeen] = useState(pauseKey);
  if (pauseSeen !== pauseKey) {
    setPauseSeen(pauseKey);
    if (pic && !isDone(pic)) setPaused(true);
  }
  const playing = screen === 'play' && !!pic && !isDone(pic);
  const playingRef = useRef(playing);
  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);
  useEffect(() => {
    const onVis = (): void => {
      setHidden(document.hidden);
      if (document.hidden && playingRef.current) setPaused(true);
      if (!document.hidden) setToday(dayKey());
    };
    const onFocus = (): void => setToday(dayKey());
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  // Another tab wrote the save: take its version, and leave a play screen it made stale (that daily
  // picture, or this challenge round, was already finished there).
  useEffect(() => {
    const onStorage = (e: StorageEvent): void => {
      if (e.key !== null && e.key !== STORE_KEY) return;
      const s = loadSg();
      saveRef.current = s;
      setSave(s);
      const r = runRef.current;
      if (!r || r.over || r.mode !== 'daily') return;
      const done = doneFor(s, r);
      if (done.length <= r.index) return;
      if (r.challenge) {
        setRun({ ...r, results: done, index: done.length, over: isComplete(done) });
        setPic(null);
      } else setScreen('menu');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const active = playing && !paused && !hidden;
  const [clockMs, now] = useClock(active);

  const begin = (r: Run): void => {
    setRun(r);
    setPaused(false);
    const puzzle = r.over ? null : puzzleFor(r, saveRef.current.relax.difficulty);
    // A daily picture left halfway carries on where it was (time, finds, misses, hints).
    const resume = progressFor(saveRef.current, r);
    setPic(puzzle && (resume ? resumePicture(puzzle, now(), resume) : startPicture(puzzle, now())));
    setScreen('play');
  };

  const start = (mode: Mode): void => {
    const day = dayKey();
    setToday(day);
    const s = loadSg();
    saveRef.current = s;
    setSave(s);
    const base: Run = { mode, day, index: 0, results: [], over: false, clock: RUSH_START_S * 1000, rushFound: 0 };
    if (mode === 'daily') {
      const done = s.daily[day] ?? [];
      begin({ ...base, index: done.length, results: done, over: isComplete(done) });
      if (!isComplete(done)) host.report({ type: 'start' });
      return;
    }
    if (mode === 'rush') host.report({ type: 'start' });
    begin(base);
  };

  // A daily or challenge picture is one try: its unfinished state is saved as it goes (about once a
  // second and on every tap), so leaving or reloading resumes it instead of starting it over.
  const tick = Math.floor(clockMs / 1000);
  useEffect(() => {
    if (!run || run.mode !== 'daily' || run.over || !pic || isDone(pic)) return;
    const progress = progressOf(pic, now());
    const s = updateSg((cur) => {
      if (doneFor(cur, run).length > run.index) return cur; // finished in another tab
      if (run.challenge && !run.challenge.daily) return recordChallenge(cur, challengeKey(run.challenge), dayKey(), { results: run.results, progress });
      return { ...cur, progress: { day: run.day, index: run.index, ...progress } };
    }, dayKey());
    saveRef.current = s;
  }, [run, pic, tick, now]);

  // Glitch Rush: the run's clock drains while a picture is being played.
  const rushLeft = run?.mode === 'rush' && pic ? Math.max(0, run.clock - (clockMs - pic.startedAt)) : null;

  const endRush = useCallback(
    (r: Run, state: PictureState, byPlayer: boolean) => {
      const results = [...r.results, resultOf(state)];
      const end = rushEnd(results, r.results.length, r.rushFound);
      host.report({ type: 'end', ...end });
      commit((s) => recordRush(s, r.rushFound, end.score));
      setRun({ ...r, results, over: true, endedByPlayer: byPlayer });
      setPic(null);
      sfx().over();
    },
    [commit, host, sfx],
  );

  useEffect(() => {
    if (!run || !pic || run.mode !== 'rush' || run.over || isDone(pic) || rushLeft === null || rushLeft > 0) return;
    const t = window.setTimeout(() => endRush(run, pic, false), 0);
    return () => window.clearTimeout(t);
  }, [rushLeft, run, pic, endRush]);

  const onPictureDone = (state: PictureState): void => {
    if (!run) return;
    const res = resultOf(state);
    if (run.mode === 'daily') {
      const results = [...run.results, res];
      const over = results.length >= DAILY_PICTURES;
      if (playsDaily(run)) commit((s) => recordPicture(s, res, run.day, false, run.index));
      if (run.challenge && !run.challenge.daily && !over) commit((s) => recordChallenge(s, challengeKey(run.challenge!), dayKey(), { results, progress: null }));
      if (over) {
        if (run.challenge) endChallenge(run, results);
        else host.report({ type: 'end', ...endStats(results, { daily: totalScore(results) }), daily: true });
      }
      setRun({ ...run, results, over });
    } else if (run.mode === 'relax') {
      commit((s) => recordPicture(s, res, null, true));
      setRun({ ...run, results: [...run.results, res] });
    } else {
      // Rush: bank the time that is left and carry it to the next picture.
      const spent = state.finishedAt! - state.startedAt;
      setRun((r) => (r ? { ...r, results: [...r.results, res], clock: Math.max(0, r.clock - spent) } : r));
    }
  };

  const onTap = (x: number, y: number, slop: number): void => {
    if (!pic || !run || !active) return;
    const t = now();
    const { state, outcome } = tap(pic, x, y, slop, t);
    if (outcome === 'found') {
      sfx().found(state.found.length);
      navigator.vibrate?.(20);
      if (run.mode === 'rush') setRun((r) => (r ? { ...r, clock: r.clock + RUSH_BONUS_S * 1000, rushFound: r.rushFound + 1 } : r));
    } else if (outcome === 'miss') {
      sfx().miss();
      if (state.lockedUntil > t) sfx().lock();
    }
    setPic(state);
    if (outcome === 'found' && isDone(state)) {
      sfx().clear();
      onPictureDone(state);
    }
  };

  const next = (): void => {
    if (!run) return;
    if (run.over) {
      setPic(null);
      return;
    }
    const r = { ...run, index: run.index + 1 };
    setRun(r);
    setPic(startPicture(puzzleFor(r, saveRef.current.relax.difficulty), now()));
  };

  const toMenu = (): void => {
    setToday(dayKey());
    setSave(saveRef.current); // the menu shows "Resume" for a daily picture left halfway
    setScreen('menu');
  };
  const onMute = (): void => commit((s) => ({ ...s, muted: !s.muted }));

  return (
    <div className="sg">
      {screen === 'menu' && (
        <Menu
          today={today}
          save={save}
          onStart={start}
          onLevel={(d) => commit((s) => ({ ...s, relax: { ...s.relax, difficulty: d } }))}
          onMute={onMute}
          onNewDay={() => setToday(dayKey())}
        />
      )}
      {screen === 'play' && run && pic && (
        <Play
          key={run.index} // a new picture starts without the last one's "Give up?" question
          run={run}
          pic={pic}
          clockMs={clockMs}
          rushLeft={rushLeft}
          paused={paused}
          muted={save.muted}
          now={now}
          onTap={onTap}
          onHint={() => {
            if (!active) return;
            const s = applyHint(pic);
            if (s === pic) return;
            sfx().hint();
            setPic(s);
            if (run.mode === 'rush') setRun((r) => (r ? { ...r, clock: Math.max(0, r.clock - RUSH_HINT_S * 1000) } : r));
          }}
          onGiveUp={() => {
            if (!active) return;
            const s = giveUp(pic, now());
            setPic(s);
            if (run.mode === 'rush') endRush(run, s, true);
            else onPictureDone(s);
          }}
          onPause={() => setPaused(true)}
          onResume={() => setPaused(false)}
          onMute={onMute}
          onNext={next}
          onMenu={toMenu}
        />
      )}
      {screen === 'play' && run && !pic && <Summary run={run} save={save} onMenu={toMenu} onAgain={() => start(run.mode)} />}
    </div>
  );
}

/* ------------------------------------------------------------------ menu */

function Wordmark() {
  return (
    <h1 className="sg-wordmark" aria-label="Spot the Glitch">
      <span aria-hidden="true" className="sg-wordmark-small">
        Spot the
      </span>
      <span aria-hidden="true" className="sg-glitch" data-text="GLITCH">
        GLITCH
      </span>
    </h1>
  );
}

function Countdown({ onNewDay }: { onNewDay: () => void }) {
  const [ms, setMs] = useState(() => msUntilMidnight());
  const day = useRef(dayKey());
  useEffect(() => {
    const t = window.setInterval(() => {
      setMs(msUntilMidnight());
      // Midnight passed with the menu open: show the new day's daily.
      if (dayKey() !== day.current) {
        day.current = dayKey();
        onNewDay();
      }
    }, 1000);
    return () => window.clearInterval(t);
  }, [onNewDay]);
  return <span className="sg-mono">{formatCountdown(ms)}</span>;
}

function Menu({
  today,
  save,
  onStart,
  onLevel,
  onMute,
  onNewDay,
}: {
  today: string;
  save: SgSave;
  onStart: (m: Mode) => void;
  onLevel: (d: number) => void;
  onMute: () => void;
  onNewDay: () => void;
}) {
  const todays = save.daily[today];
  const started = !!todays?.length || save.progress?.day === today;
  const stats = sgStats(save, today);
  const done = isComplete(todays);
  const date = parseDayKey(today).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return (
    <div className="sg-menu">
      <div className="sg-menu-top">
        <button className="sg-icon-btn" onClick={onMute} aria-label={save.muted ? 'Turn sound on' : 'Turn sound off'} aria-pressed={!save.muted}>
          {save.muted ? '🔇' : '🔊'}
        </button>
        {stats.streak > 0 && <span className="sg-chip">🔥 {stats.streak}-day streak</span>}
        <GameMenuButton className="sg-icon-btn" />
      </div>
      <Wordmark />
      <p className="sg-tagline">Two pictures. Five glitches. Find them all, fast.</p>
      <section className="sg-card sg-card-daily">
        <div className="sg-card-head">
          <span className="sg-kicker">Daily #{dailyNumber(today)}</span>
          <span className="sg-muted">{date}</span>
        </div>
        {done ? (
          <>
            <p className="sg-daily-score">
              <b className="sg-mono">{fmt(totalScore(todays!))}</b> / {fmt(DAILY_PICTURES * MAX_PICTURE)}
            </p>
            <div className="sg-row">
              <ShareButton today={today} results={todays!} streak={stats.streak} />
            </div>
            <p className="sg-muted sg-small">
              Next daily in <Countdown onNewDay={onNewDay} />
            </p>
          </>
        ) : (
          <>
            <p className="sg-card-text">Three fresh pictures for everyone today, from easy to sneaky.</p>
            <button className="sg-btn sg-btn-go" onClick={() => onStart('daily')}>
              {started ? `Resume (${todays?.length ?? 0}/${DAILY_PICTURES})` : 'Play today’s pictures'}
            </button>
          </>
        )}
      </section>
      <div className="sg-mode-grid">
        <section className="sg-card">
          <span className="sg-kicker">Glitch Rush</span>
          <p className="sg-card-text">
            {RUSH_START_S} seconds on the clock, +{RUSH_BONUS_S}s for every glitch. Pictures get sneakier.
          </p>
          {save.rush.bestFound > 0 && <p className="sg-muted sg-small">Best: {save.rush.bestFound} glitches</p>}
          <button className="sg-btn" onClick={() => onStart('rush')}>
            Start Rush
          </button>
        </section>
        <section className="sg-card">
          <span className="sg-kicker">Relax</span>
          <p className="sg-card-text">Endless new pictures. No clock pressure, hints are free.</p>
          <div className="sg-seg" role="radiogroup" aria-label="Difficulty">
            {LEVELS.map((l, i) => (
              <button key={l} role="radio" aria-checked={save.relax.difficulty === i} onClick={() => onLevel(i)}>
                {l}
              </button>
            ))}
          </div>
          <button className="sg-btn" onClick={() => onStart('relax')}>
            Relax
          </button>
        </section>
      </div>
      <p className="sg-muted sg-small">
        {stats.played ? `${stats.played} dailies · best ${fmt(stats.best)} · ` : ''}
        {save.fastest ? `fastest clean picture ${save.fastest}s · ` : ''}
        saved on this device
      </p>
    </div>
  );
}

function ShareButton({ today, results, streak }: { today: string; results: readonly PictureResult[]; streak: number }) {
  const [msg, setMsg] = useState('');
  useEffect(() => {
    if (!msg) return;
    const t = window.setTimeout(() => setMsg(''), 2200);
    return () => window.clearTimeout(t);
  }, [msg]);
  return (
    <button
      className="sg-btn sg-btn-go"
      onClick={() =>
        void shareOrCopy({ title: 'Spot the Glitch', text: shareText(today, results, streak, `${window.location.origin}/games/spot-the-glitch`) }).then((o) =>
          setMsg(o === 'copied' ? 'Copied!' : o === 'failed' ? 'Could not copy' : ''),
        )
      }
    >
      {msg || 'Share result'}
    </button>
  );
}

/* ------------------------------------------------------------------ play */

function Picture({ scene, label, pic, reveal, onTap }: { scene: Scene; label: string; pic: PictureState; reveal: boolean; onTap: (x: number, y: number, slop: number) => void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const down = useRef<{ x: number; y: number; id: number; top: number; left: number } | null>(null);
  useLayoutEffect(() => {
    const el = wrap.current;
    const c = canvas.current;
    if (!el || !c) return;
    const paint = (): void => drawScene(c, scene, el.clientWidth);
    paint();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(paint) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [scene]);

  const onDown = (e: ReactPointerEvent): void => {
    const rect = wrap.current!.getBoundingClientRect();
    down.current = { x: e.clientX, y: e.clientY, id: e.pointerId, top: rect.top, left: rect.left };
  };
  const onUp = (e: ReactPointerEvent): void => {
    const d = down.current;
    down.current = null;
    if (!d || d.id !== e.pointerId) return;
    const rect = wrap.current!.getBoundingClientRect();
    // A scroll is not a tap (the picture moved, or the browser cancelled the pointer); a finger that
    // drifts a little while tapping still is.
    if (Math.hypot(rect.top - d.top, rect.left - d.left) > 4 || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 24) return;
    const k = W / rect.width;
    const slop = (e.pointerType === 'touch' ? 12 : 4) * k;
    onTap((e.clientX - rect.left) * k, (e.clientY - rect.top) * k, slop);
  };

  const now = pic.misses[pic.misses.length - 1]?.at ?? 0;
  return (
    <div className="sg-pic" ref={wrap} onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => (down.current = null)} role="img" aria-label={label}>
      <canvas ref={canvas} />
      <svg viewBox={`0 0 ${W} ${H}`} className="sg-overlay" aria-hidden="true">
        {pic.puzzle.diffs.map((d, i) =>
          pic.found.includes(i)
            ? d.spots.map((s, j) => <circle key={`${i}-${j}`} className="sg-ring" cx={s.x} cy={s.y} r={s.r + 2} />)
            : reveal
              ? d.spots.map((s, j) => <circle key={`${i}-${j}`} className="sg-ring is-missed" cx={s.x} cy={s.y} r={s.r + 2} />)
              : null,
        )}
        {pic.hinted !== null &&
          (() => {
            const s = pic.puzzle.diffs[pic.hinted]!.spots[0]!;
            // Off-center so the hint narrows the search without pointing exactly at the glitch.
            const a = pic.hinted * 2.4;
            return <circle className="sg-hint" cx={s.x + Math.cos(a) * s.r * 0.7} cy={s.y + Math.sin(a) * s.r * 0.7} r={s.r + 34} />;
          })()}
        {pic.misses.slice(-3).map((m) => (
          <g key={m.at} className={`sg-miss${m.at === now ? ' is-new' : ''}`} transform={`translate(${m.x} ${m.y})`}>
            <path d="M-7 -7 L7 7 M7 -7 L-7 7" />
          </g>
        ))}
      </svg>
    </div>
  );
}

function Play(props: {
  run: Run;
  pic: PictureState;
  clockMs: number;
  rushLeft: number | null;
  paused: boolean;
  muted: boolean;
  now: () => number;
  onTap: (x: number, y: number, slop: number) => void;
  onHint: () => void;
  onGiveUp: () => void;
  onPause: () => void;
  onResume: () => void;
  onMute: () => void;
  onNext: () => void;
  onMenu: () => void;
}) {
  const { run, pic } = props;
  const [confirm, setConfirm] = useState(false);
  const done = isDone(pic);
  const secs = Math.floor(seconds(pic, props.clockMs));
  const locked = props.clockMs < pic.lockedUntil;
  const label = run.challenge ? `⚔️ Challenge · ${run.index + 1}/${DAILY_PICTURES}` : run.mode === 'daily' ? `Daily #${dailyNumber(run.day)} · ${run.index + 1}/${DAILY_PICTURES}` : run.mode === 'rush' ? `Rush · picture ${run.index + 1}` : `Relax · ${LEVELS[pic.puzzle.difficulty]}`;
  return (
    <div className="sg-play">
      <div className="sg-top">
        {/* A challenge round is one attempt: no way out of it halfway (the arcade's menu still pauses). */}
        {!run.challenge && (
          <button className="sg-icon-btn" onClick={props.onMenu} aria-label="Back to menu">
            ←
          </button>
        )}
        <span className="sg-kicker">{label}</span>
        <span className={`sg-clock sg-mono${props.rushLeft !== null && props.rushLeft < 10_000 ? ' is-low' : ''}`} aria-label="Time">
          {props.rushLeft !== null ? `${Math.ceil(props.rushLeft / 1000)}s` : `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`}
        </span>
        {!done && (
          <button className="sg-icon-btn" onClick={props.onPause} aria-label="Pause" disabled={props.paused}>
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
              <rect x="3" y="2" width="3.5" height="12" rx="1" fill="currentColor" />
              <rect x="9.5" y="2" width="3.5" height="12" rx="1" fill="currentColor" />
            </svg>
          </button>
        )}
        <GameMenuButton className="sg-icon-btn" />
      </div>
      <div className="sg-found">
        <span className="sg-found-dots" aria-live="polite" aria-label={`${pic.found.length} of ${DIFFS} glitches found`}>
          {Array.from({ length: DIFFS }, (_, i) => (
            <i key={i} className={i < pic.found.length ? 'is-on' : ''} />
          ))}
        </span>
        <span className="sg-theme">{THEME_NAMES[pic.puzzle.left.theme]}</span>
        <button className="sg-icon-btn sg-icon-sm" onClick={props.onMute} aria-label={props.muted ? 'Turn sound on' : 'Turn sound off'} aria-pressed={!props.muted}>
          {props.muted ? '🔇' : '🔊'}
        </button>
      </div>
      <div className="sg-pair">
        <Picture scene={pic.puzzle.left} label="Picture A" pic={pic} reveal={pic.gaveUp} onTap={props.onTap} />
        <Picture scene={pic.puzzle.right} label="Picture B" pic={pic} reveal={pic.gaveUp} onTap={props.onTap} />
        {locked && <div className="sg-lock">Whoa, slow down! Look before you tap.</div>}
        {/* Opaque: the clock is stopped, so the pictures must not be studied meanwhile. */}
        {props.paused && (
          <button className="sg-paused" onClick={props.onResume} autoFocus>
            <span className="sg-paused-card">
              <b>Paused</b>
              <span>Tap to continue</span>
            </span>
          </button>
        )}
      </div>
      {!done ? (
        <div className="sg-actions">
          <button className="sg-btn" onClick={props.onHint} disabled={pic.hinted !== null || props.paused}>
            {/* The daily (and a challenge) scores hints and misses; in Rush a hint costs clock time. */}
            💡 Hint{run.mode === 'daily' ? ` (−${HINT_COST})` : run.mode === 'rush' ? ` (−${RUSH_HINT_S}s)` : ''}
          </button>
          {confirm ? (
            <>
              <button className="sg-btn sg-btn-warn" onClick={props.onGiveUp} disabled={props.paused}>
                Yes, reveal
              </button>
              <button className="sg-btn sg-btn-ghost" onClick={() => setConfirm(false)}>
                Keep looking
              </button>
            </>
          ) : (
            <button className="sg-btn sg-btn-ghost" onClick={() => setConfirm(true)}>
              {run.mode === 'rush' ? 'End run' : 'Give up'}
            </button>
          )}
        </div>
      ) : (
        <PictureDone run={run} pic={pic} onNext={props.onNext} />
      )}
      {!done && (
        <p className="sg-muted sg-small sg-help">
          Tap a difference in either picture. {run.mode === 'daily' ? `Wrong taps cost ${MISS_COST}; three` : 'Three'} quick misses lock taps for {LOCK_MS / 1000}s.
        </p>
      )}
    </div>
  );
}

function PictureDone({ run, pic, onNext }: { run: Run; pic: PictureState; onNext: () => void }) {
  const r = resultOf(pic);
  const now = pic.finishedAt ?? 0;
  const last = run.mode === 'daily' && run.results.length >= DAILY_PICTURES;
  return (
    <div className="sg-done" role="status">
      <h2>{pic.gaveUp ? `${r.found} of ${DIFFS} found` : r.misses === 0 && r.hints === 0 ? 'Flawless!' : 'All five found!'}</h2>
      {run.mode !== 'relax' && run.mode !== 'rush' && (
        <ul className="sg-breakdown sg-mono">
          {!pic.gaveUp && (
            <>
              <li>
                Time {r.seconds}s <span>−{timePenalty(r.seconds)}</span>
              </li>
              <li>
                Misses {r.misses} <span>−{r.misses * MISS_COST}</span>
              </li>
              <li>
                Hints {r.hints} <span>−{r.hints * HINT_COST}</span>
              </li>
            </>
          )}
          <li className="sg-total">
            Score <b>{fmt(pictureScore(pic, now))}</b>
          </li>
        </ul>
      )}
      {run.mode === 'rush' && <p className="sg-muted">+{RUSH_BONUS_S}s per glitch · {run.rushFound} found so far</p>}
      {run.mode === 'relax' && <p className="sg-muted">{r.seconds}s · {r.misses} misses</p>}
      <button className="sg-btn sg-btn-go sg-btn-big" onClick={onNext} autoFocus>
        {last ? 'See results' : 'Next picture →'}
      </button>
    </div>
  );
}

function Summary({ run, save, onMenu, onAgain }: { run: Run; save: SgSave; onMenu: () => void; onAgain: () => void }) {
  const today = run.day;
  const streak = sgStats(save, today).streak;
  if (run.mode === 'rush') {
    return (
      <div className="sg-menu">
        <span className="sg-kicker">{run.endedByPlayer ? 'Run ended' : 'Time’s up'}</span>
        <p className="sg-big sg-mono">{run.rushFound}</p>
        <p>glitches found · {run.results.filter((r) => r.found === DIFFS).length} pictures cleared</p>
        <p className="sg-muted">Best: {save.rush.bestFound}</p>
        <div className="sg-row">
          <button className="sg-btn sg-btn-go" onClick={onAgain}>
            Play again
          </button>
          <button className="sg-btn sg-btn-ghost" onClick={onMenu}>
            Menu
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="sg-menu">
      <span className="sg-kicker">{run.challenge ? '⚔️ Challenge round complete' : `Daily #${dailyNumber(today)} complete`}</span>
      {run.fromDaily && <p className="sg-muted sg-small">You already played this daily: your daily result counts here.</p>}
      <p className="sg-big sg-mono">{fmt(totalScore(run.results))}</p>
      <p className="sg-muted">/ {fmt(DAILY_PICTURES * MAX_PICTURE)}{streak > 0 && !run.challenge ? ` · 🔥 ${streak}` : ''}</p>
      <ResultLine line={resultGrid(run.results)} label={`${run.results.reduce((n, r) => n + r.found, 0)} of ${run.results.length * DIFFS} glitches found`} />
      <ul className="sg-summary">
        {run.results.map((r, i) => (
          <li key={i}>
            <span>Picture {i + 1}</span>
            <span className="sg-dots">{'●'.repeat(r.found)}{'○'.repeat(DIFFS - r.found)}</span>
            <span className="sg-mono">{r.seconds}s</span>
            <b className="sg-mono">{fmt(r.score)}</b>
          </li>
        ))}
      </ul>
      <div className="sg-row">
        {run.challenge ? (
          <a className="sg-btn sg-btn-go" href={`/c/${run.challenge.id}`} onClick={openChallengeScores}>
            See the scoreboard
          </a>
        ) : (
          <ShareButton today={today} results={run.results} streak={streak} />
        )}
        <button className="sg-btn sg-btn-ghost" onClick={onMenu}>
          Menu
        </button>
      </div>
    </div>
  );
}
