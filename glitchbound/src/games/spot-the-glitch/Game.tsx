import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { GameHost, GameModuleProps } from '../../platform/contract';
import { dayKey, formatCountdown, hashString, msUntilMidnight, parseDayKey } from '../../platform/dates';
import { shareOrCopy } from '../../platform/share';
import { DIFFS, makePuzzle, type Puzzle } from './diffs';
import { drawScene } from './draw';
import {
  applyHint,
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
  resultOf,
  RUSH_BONUS_S,
  RUSH_START_S,
  rushDifficulty,
  seconds,
  shareText,
  startPicture,
  tap,
  timePenalty,
  totalScore,
  type PictureResult,
  type PictureState,
} from './logic';
import { H, THEME_NAMES, W, type Scene } from './scene';
import { createSfx, type Sfx } from './sound';
import { isComplete, loadSg, recordPicture, recordRush, saveSg, sgStats, type SgSave } from './store';
import './Game.css';
import { openChallengeScores } from '../../platform/challenge';

type Mode = 'daily' | 'rush' | 'relax';
type Screen = 'menu' | 'play';
const fmt = (n: number): string => Math.round(n).toLocaleString('en-US');
const LEVELS = ['Easy', 'Medium', 'Hard'];
const randomSeed = (): number => Math.floor(Math.random() * 2 ** 32);

export default function Game({ host, restartKey, pauseKey, challenge }: GameModuleProps) {
  return <SpotTheGlitch key={restartKey} host={host} pauseKey={pauseKey} challenge={challenge} />;
}

interface Run {
  mode: Mode;
  index: number;
  results: PictureResult[];
  over: boolean;
  /** Glitch Rush: clock ms left, total differences found. */
  clock: number;
  rushFound: number;
  /** A friends' challenge: three daily-style pictures from the challenge's seed (mode stays 'daily'). */
  challenge?: { id: string; round: number; seed: number };
}

function puzzleFor(run: Run, today: string, relaxLevel: number): Puzzle {
  if (run.challenge) return makePuzzle(hashString(`spot-the-glitch:challenge:${run.challenge.seed}:${run.index}`), Math.min(2, run.index));
  if (run.mode === 'daily') return dailyPuzzle(today, run.index);
  if (run.mode === 'rush') return makePuzzle(randomSeed(), rushDifficulty(run.index));
  return makePuzzle(randomSeed(), relaxLevel);
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
  const [today] = useState(() => dayKey());
  const [save, setSave] = useState<SgSave>(loadSg);
  const [firstRun] = useState<Run | null>(() =>
    challenge ? { mode: 'daily', index: 0, results: [], over: false, clock: RUSH_START_S * 1000, rushFound: 0, challenge: { id: challenge.id, round: challenge.round, seed: challenge.seed } } : null,
  );
  const [screen, setScreen] = useState<Screen>(challenge ? 'play' : 'menu');
  const [run, setRun] = useState<Run | null>(firstRun);
  const [pic, setPic] = useState<PictureState | null>(() => (firstRun ? startPicture(puzzleFor(firstRun, today, 0), 0) : null));
  useEffect(() => {
    if (challenge) host.report({ type: 'start' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const saveRef = useRef(save);
  const commit = useCallback(
    (next: SgSave) => {
      saveRef.current = next;
      setSave(next);
      saveSg(next, today);
    },
    [today],
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

  // Pause when the arcade asks (left full screen / scrolled away) or the tab is hidden.
  const [pauseSeen, setPauseSeen] = useState(pauseKey);
  if (pauseSeen !== pauseKey) {
    setPauseSeen(pauseKey);
    if (pic && !isDone(pic)) setPaused(true);
  }
  useEffect(() => {
    const onVis = (): void => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const active = screen === 'play' && !!pic && !isDone(pic) && !paused && !hidden;
  const [clockMs, now] = useClock(active);

  const begin = (r: Run): void => {
    setRun(r);
    setPaused(false);
    setPic(r.over ? null : startPicture(puzzleFor(r, today, saveRef.current.relax.difficulty), now()));
    setScreen('play');
  };

  const start = (mode: Mode): void => {
    const base: Run = { mode, index: 0, results: [], over: false, clock: RUSH_START_S * 1000, rushFound: 0 };
    if (mode === 'daily') {
      const done = save.daily[today] ?? [];
      begin({ ...base, index: done.length, results: done, over: isComplete(done) });
      if (!isComplete(done)) host.report({ type: 'start' });
      return;
    }
    if (mode === 'rush') host.report({ type: 'start' });
    begin(base);
  };

  // Glitch Rush: the run's clock drains while a picture is being played.
  const rushLeft = run?.mode === 'rush' && pic ? Math.max(0, run.clock - (clockMs - pic.startedAt)) : null;

  const endRush = useCallback(
    (r: Run, state: PictureState) => {
      const partial = resultOf(state);
      const results = [...r.results, partial];
      const score = results.reduce((n, x) => n + x.found * 100, 0) + r.results.length * 250;
      host.report({ type: 'end', score, stats: { found: r.rushFound, pictures: r.results.length } });
      commit(recordRush(saveRef.current, r.rushFound, score));
      setRun({ ...r, results, over: true });
      setPic(null);
      sfx().over();
    },
    [commit, host, sfx],
  );

  useEffect(() => {
    if (run && pic && run.mode === 'rush' && !run.over && !isDone(pic) && rushLeft !== null && rushLeft <= 0) endRush(run, pic);
  }, [rushLeft, run, pic, endRush]);

  const onPictureDone = (state: PictureState): void => {
    if (!run) return;
    const res = resultOf(state);
    if (run.mode === 'daily') {
      if (!run.challenge) commit(recordPicture(saveRef.current, res, today));
      const results = [...run.results, res];
      const over = results.length >= DAILY_PICTURES;
      if (over) {
        const end = endStats(results);
        host.report(run.challenge ? { type: 'end', ...end, challenge: { id: run.challenge.id, round: run.challenge.round } } : { type: 'end', ...end, daily: true });
      }
      setRun({ ...run, results, over });
    } else if (run.mode === 'relax') {
      commit(recordPicture(saveRef.current, res, null, true));
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
    setPic(startPicture(puzzleFor(r, today, saveRef.current.relax.difficulty), now()));
  };

  return (
    <div className="sg">
      {screen === 'menu' && (
        <Menu
          today={today}
          save={save}
          onStart={start}
          onLevel={(d) => commit({ ...saveRef.current, relax: { ...saveRef.current.relax, difficulty: d } })}
          onMute={() => commit({ ...saveRef.current, muted: !saveRef.current.muted })}
        />
      )}
      {screen === 'play' && run && pic && (
        <Play
          run={run}
          pic={pic}
          today={today}
          clockMs={clockMs}
          rushLeft={rushLeft}
          paused={paused}
          now={now}
          onTap={onTap}
          onHint={() => {
            const s = applyHint(pic);
            if (s !== pic) sfx().hint();
            setPic(s);
          }}
          onGiveUp={() => {
            const s = giveUp(pic, now());
            setPic(s);
            if (run.mode === 'rush') endRush(run, s);
            else onPictureDone(s);
          }}
          onResume={() => setPaused(false)}
          onNext={next}
          onMenu={() => setScreen('menu')}
        />
      )}
      {screen === 'play' && run && !pic && <Summary run={run} today={today} save={save} onMenu={() => setScreen('menu')} onAgain={() => start(run.mode)} />}
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

function Countdown() {
  const [ms, setMs] = useState(() => msUntilMidnight());
  useEffect(() => {
    const t = window.setInterval(() => setMs(msUntilMidnight()), 1000);
    return () => window.clearInterval(t);
  }, []);
  return <span className="sg-mono">{formatCountdown(ms)}</span>;
}

function Menu({ today, save, onStart, onLevel, onMute }: { today: string; save: SgSave; onStart: (m: Mode) => void; onLevel: (d: number) => void; onMute: () => void }) {
  const todays = save.daily[today];
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
              Next daily in <Countdown />
            </p>
          </>
        ) : (
          <>
            <p className="sg-card-text">Three fresh pictures for everyone today, from easy to sneaky.</p>
            <button className="sg-btn sg-btn-go" onClick={() => onStart('daily')}>
              {todays?.length ? `Resume (${todays.length}/${DAILY_PICTURES})` : 'Play today’s pictures'}
            </button>
          </>
        )}
      </section>
      <div className="sg-mode-grid">
        <section className="sg-card">
          <span className="sg-kicker">Glitch Rush</span>
          <p className="sg-card-text">
            {RUSH_START_S} seconds on the clock, +{RUSH_BONUS_S} s for every glitch. Pictures get sneakier.
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
  const down = useRef<{ x: number; y: number; id: number } | null>(null);
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
    down.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const onUp = (e: ReactPointerEvent): void => {
    const d = down.current;
    down.current = null;
    // A drag or scroll is not a tap.
    if (!d || d.id !== e.pointerId || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 12) return;
    const rect = wrap.current!.getBoundingClientRect();
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
            // Off-centre so the hint narrows the search without pointing exactly at the glitch.
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
  today: string;
  clockMs: number;
  rushLeft: number | null;
  paused: boolean;
  now: () => number;
  onTap: (x: number, y: number, slop: number) => void;
  onHint: () => void;
  onGiveUp: () => void;
  onResume: () => void;
  onNext: () => void;
  onMenu: () => void;
}) {
  const { run, pic } = props;
  const [confirm, setConfirm] = useState(false);
  const done = isDone(pic);
  const secs = Math.floor(seconds(pic, props.clockMs));
  const locked = props.clockMs < pic.lockedUntil;
  const label = run.challenge ? `⚔️ Challenge · ${run.index + 1}/${DAILY_PICTURES}` : run.mode === 'daily' ? `Daily #${dailyNumber(props.today)} · ${run.index + 1}/${DAILY_PICTURES}` : run.mode === 'rush' ? `Rush · picture ${run.index + 1}` : `Relax · ${LEVELS[pic.puzzle.difficulty]}`;
  return (
    <div className="sg-play">
      <div className="sg-top">
        <button className="sg-icon-btn" onClick={props.onMenu} aria-label="Back to menu">
          ←
        </button>
        <span className="sg-kicker">{label}</span>
        <span className={`sg-clock sg-mono${props.rushLeft !== null && props.rushLeft < 10_000 ? ' is-low' : ''}`} aria-label="Time">
          {props.rushLeft !== null ? `${Math.ceil(props.rushLeft / 1000)}s` : `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`}
        </span>
      </div>
      <div className="sg-found" aria-live="polite" aria-label={`${pic.found.length} of ${DIFFS} glitches found`}>
        {Array.from({ length: DIFFS }, (_, i) => (
          <i key={i} className={i < pic.found.length ? 'is-on' : ''} />
        ))}
        <span className="sg-theme">{THEME_NAMES[pic.puzzle.left.theme]}</span>
      </div>
      <div className="sg-pair">
        <Picture scene={pic.puzzle.left} label="Picture A" pic={pic} reveal={pic.gaveUp} onTap={props.onTap} />
        <Picture scene={pic.puzzle.right} label="Picture B" pic={pic} reveal={pic.gaveUp} onTap={props.onTap} />
        {locked && <div className="sg-lock">Whoa, slow down! Look before you tap.</div>}
        {props.paused && (
          <button className="sg-paused" onClick={props.onResume}>
            Paused · tap to continue
          </button>
        )}
      </div>
      {!done ? (
        <div className="sg-actions">
          <button className="sg-btn" onClick={props.onHint} disabled={pic.hinted !== null}>
            💡 Hint{run.mode === 'relax' ? '' : ` (−${HINT_COST})`}
          </button>
          {confirm ? (
            <>
              <button className="sg-btn sg-btn-warn" onClick={props.onGiveUp}>
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
      {!done && <p className="sg-muted sg-small sg-help">Tap a difference in either picture. Wrong taps cost {MISS_COST}; three quick misses lock taps for {LOCK_MS / 1000}s.</p>}
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

function Summary({ run, today, save, onMenu, onAgain }: { run: Run; today: string; save: SgSave; onMenu: () => void; onAgain: () => void }) {
  const streak = sgStats(save, today).streak;
  if (run.mode === 'rush') {
    return (
      <div className="sg-menu">
        <span className="sg-kicker">Time’s up</span>
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
      <p className="sg-big sg-mono">{fmt(totalScore(run.results))}</p>
      <p className="sg-muted">/ {fmt(DAILY_PICTURES * MAX_PICTURE)}{streak > 0 && !run.challenge ? ` · 🔥 ${streak}` : ''}</p>
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
