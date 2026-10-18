import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { GameHost, GameModuleProps } from '../../platform/contract';
import { dayKey, formatCountdown, msUntilMidnight, parseDayKey } from '../../platform/dates';
import { shareOrCopy } from '../../platform/share';
import {
  aim,
  confirm,
  DAILY_LEVELS,
  dailyNumber,
  dailyScene,
  endlessScene,
  endStats,
  giveUp,
  hint,
  HINT_COST,
  LIVES,
  MAX_HINTS,
  MAX_LEVEL,
  resultOf,
  secondsOf,
  shareText,
  squareFor,
  startLevel,
  totalScore,
  TRIES,
  WRONG_COST,
  type LevelResult,
  type LevelState,
} from './logic';
import { paintScene } from './paint';
import { photoCredit } from './photo';
import { buildComposite, loadPhoto, paintComposite } from './photoPaint';
import { ENV_NAMES, H, hintBox, rng, W, type Scene } from './scene';
import { createSfx, type Sfx } from './sound';
import { isComplete, loadWb, recordEndless, recordLevel, saveWb, wbStats, type WbSave } from './store';
import './Game.css';
import { openChallengeScores } from '../../platform/challenge';

type Mode = 'daily' | 'endless';
const fmt = (n: number): string => Math.round(n).toLocaleString('en-US');
const ZOOMS = [1, 1.6, 2.4, 3.2];

export default function Game({ host, restartKey, pauseKey, challenge }: GameModuleProps) {
  return <WheresTheBall key={restartKey} host={host} pauseKey={pauseKey} challenge={challenge} />;
}

interface Run {
  mode: Mode;
  index: number;
  results: LevelResult[];
  lives: number;
  over: boolean;
  seed: number;
  /** A friends' challenge: the first daily-length levels of a seeded run (mode stays 'daily'). */
  challenge?: { id: string; round: number };
}

/** A game clock that only runs while a level is on screen and not paused. */
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

function sceneFor(run: Run, today: string): Scene {
  const pick = (i: number): Scene => (run.mode === 'daily' && !run.challenge ? dailyScene(today, i) : endlessScene(run.seed, i));
  const scene = pick(run.index);
  // Fetch the next level's photo in the background so it opens instantly.
  const next = run.mode !== 'daily' || run.index + 1 < DAILY_LEVELS ? pick(run.index + 1) : null;
  if (next?.photo) void loadPhoto(next.photo.id).catch(() => undefined);
  return scene;
}

type Picture = { state: 'none' } | { state: 'loading' } | { state: 'error'; retry: () => void } | { state: 'ready'; composite: HTMLCanvasElement };

/** The prepared photo (with its ball) for a photo level; drawn levels need none. */
function usePicture(scene: Scene | null): Picture {
  const photo = scene?.photo ? scene : null;
  const [attempt, setAttempt] = useState(0);
  const [built, setBuilt] = useState<{ scene: Scene; composite: HTMLCanvasElement } | { scene: Scene; failed: true } | null>(null);
  useEffect(() => {
    if (!photo) return;
    let live = true;
    loadPhoto(photo.photo!.id)
      .then((img) => live && setBuilt({ scene: photo, composite: buildComposite(img, photo) }))
      .catch(() => live && setBuilt({ scene: photo, failed: true }));
    return () => {
      live = false;
    };
  }, [photo, attempt]);
  if (!photo) return { state: 'none' };
  if (!built || built.scene !== photo) return { state: 'loading' };
  if ('failed' in built) return { state: 'error', retry: () => { setBuilt(null); setAttempt((a) => a + 1); } };
  return { state: 'ready', composite: built.composite };
}

const placeName = (s: Scene): string => (s.photo ? s.photo.title : ENV_NAMES[s.env]);

function WheresTheBall({ host, pauseKey, challenge }: { host: GameHost; pauseKey?: number; challenge?: GameModuleProps['challenge'] }) {
  const [today] = useState(() => dayKey());
  const [save, setSave] = useState<WbSave>(loadWb);
  const [firstRun] = useState<Run | null>(() =>
    challenge ? { mode: 'daily', index: 0, results: [], lives: LIVES, over: false, seed: challenge.seed, challenge: { id: challenge.id, round: challenge.round } } : null,
  );
  const [run, setRun] = useState<Run | null>(firstRun);
  const [level, setLevel] = useState<LevelState | null>(() => (firstRun ? startLevel(sceneFor(firstRun, today), 0) : null));
  useEffect(() => {
    if (challenge) host.report({ type: 'start' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const saveRef = useRef(save);
  const commit = useCallback(
    (next: WbSave) => {
      saveRef.current = next;
      setSave(next);
      saveWb(next, today);
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
  const [pauseSeen, setPauseSeen] = useState(pauseKey);
  if (pauseSeen !== pauseKey) {
    setPauseSeen(pauseKey);
    if (level?.outcome === 'play') setPaused(true);
  }
  useEffect(() => {
    const onVis = (): void => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);
  const picture = usePicture(level?.scene ?? null);
  const pictureReady = picture.state === 'none' || picture.state === 'ready';
  // The clock never runs while a photo is still loading.
  const [clockMs, now] = useClock(!!level && level.outcome === 'play' && !paused && !hidden && pictureReady);

  const start = (mode: Mode): void => {
    let r: Run = { mode, index: 0, results: [], lives: LIVES, over: false, seed: Math.floor(Math.random() * 2 ** 32) };
    if (mode === 'daily') {
      const done = save.daily[today] ?? [];
      r = { ...r, index: done.length, results: done, over: isComplete(done) };
      if (!r.over) host.report({ type: 'start' });
    } else host.report({ type: 'start' });
    setRun(r);
    setPaused(false);
    setLevel(r.over ? null : startLevel(sceneFor(r, today), now()));
  };

  const finish = (s: LevelState): void => {
    if (!run) return;
    const res = resultOf(s);
    let sv = recordLevel(saveRef.current, res, run.mode === 'daily' && !run.challenge ? today : null);
    const results = [...run.results, res];
    let next: Run = { ...run, results };
    if (run.mode === 'daily' && results.length >= DAILY_LEVELS) {
      next.over = true;
      host.report(run.challenge ? { type: 'end', ...endStats(results), challenge: run.challenge } : { type: 'end', ...endStats(results), daily: true });
    }
    if (run.mode === 'endless') {
      next = { ...next, lives: run.lives - (res.found ? 0 : 1) };
      if (next.lives <= 0) {
        next.over = true;
        host.report({ type: 'end', ...endStats(results, { levels: results.filter((r) => r.found).length }) });
        sv = recordEndless(sv, results);
      }
    }
    if (res.found) sfx().found();
    else sfx().missed();
    commit(sv);
    setRun(next);
  };

  const update = (s: LevelState, before: LevelState): void => {
    setLevel(s);
    if (before.outcome === 'play' && s.outcome !== 'play') finish(s);
  };

  const nextLevel = (): void => {
    if (!run) return;
    if (run.over) {
      setLevel(null);
      return;
    }
    const r = { ...run, index: run.index + 1 };
    setRun(r);
    setLevel(startLevel(sceneFor(r, today), now()));
  };

  return (
    <div className="wb">
      {!run && <Menu today={today} save={save} onStart={start} onMute={() => commit({ ...saveRef.current, muted: !saveRef.current.muted })} />}
      {run && level && (
        <Play
          run={run}
          level={level}
          today={today}
          clockMs={clockMs}
          paused={paused}
          picture={picture}
          onResume={() => setPaused(false)}
          onAim={(x, y) => {
            setLevel(aim(level, x, y));
            sfx().aim();
          }}
          onConfirm={(slop) => {
            const s = confirm(level, slop, now());
            if (s.outcome === 'play' && s.wrong.length > level.wrong.length) sfx().wrong(s.wrong[s.wrong.length - 1]!.heat);
            update(s, level);
          }}
          onHint={() => {
            setLevel(hint(level));
            sfx().hint();
          }}
          onGiveUp={() => update(giveUp(level, now()), level)}
          onNext={nextLevel}
          onMenu={() => {
            setRun(null);
            setLevel(null);
          }}
        />
      )}
      {run && !level && (
        <Summary
          run={run}
          today={today}
          save={save}
          onMenu={() => setRun(null)}
          onAgain={() => start(run.mode)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ menu */

function BallIcon({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <radialGradient id="wb-g" cx="0.35" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#f1ff7a" />
          <stop offset="0.7" stopColor="#d4ee32" />
          <stop offset="1" stopColor="#a7c21c" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="28" fill="url(#wb-g)" stroke="#14102a" strokeWidth="3" />
      <path d="M10 18 C24 26 24 40 10 48 M54 18 C40 26 40 40 54 48" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

function Countdown() {
  const [ms, setMs] = useState(() => msUntilMidnight());
  useEffect(() => {
    const t = window.setInterval(() => setMs(msUntilMidnight()), 1000);
    return () => window.clearInterval(t);
  }, []);
  return <span className="wb-mono">{formatCountdown(ms)}</span>;
}

function Menu({ today, save, onStart, onMute }: { today: string; save: WbSave; onStart: (m: Mode) => void; onMute: () => void }) {
  const todays = save.daily[today];
  const stats = wbStats(save, today);
  const done = isComplete(todays);
  const date = parseDayKey(today).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return (
    <div className="wb-menu">
      <div className="wb-menu-top">
        <button className="wb-icon-btn" onClick={onMute} aria-label={save.muted ? 'Turn sound on' : 'Turn sound off'} aria-pressed={!save.muted}>
          {save.muted ? '🔇' : '🔊'}
        </button>
        {stats.streak > 0 && <span className="wb-chip">🔥 {stats.streak}-day streak</span>}
      </div>
      <h1 className="wb-wordmark">
        <span>Where’s the</span>
        <span className="wb-wordmark-ball">
          Ball<BallIcon size={52} />
        </span>
      </h1>
      <p className="wb-tagline">One tennis ball is hiding in every shot. Zoom in, aim, and lock it in.</p>
      <section className="wb-card wb-card-daily">
        <div className="wb-card-head">
          <span className="wb-kicker">Daily #{dailyNumber(today)}</span>
          <span className="wb-muted">{date}</span>
        </div>
        {done ? (
          <>
            <p className="wb-squares" aria-label="Today's results">
              {todays!.map(squareFor).join(' ')}
            </p>
            <p className="wb-daily-score">
              <b className="wb-mono">{fmt(totalScore(todays!))}</b> / {fmt(DAILY_LEVELS * MAX_LEVEL)}
            </p>
            <ShareButton today={today} results={todays!} streak={stats.streak} />
            <p className="wb-muted wb-small">
              Next daily in <Countdown />
            </p>
          </>
        ) : (
          <>
            <p className="wb-card-text">Five shots for everyone today, each harder: smaller balls, busier scenes, sneakier hiding spots.</p>
            <button className="wb-btn wb-btn-go" onClick={() => onStart('daily')}>
              {todays?.length ? `Resume (${todays.length}/${DAILY_LEVELS})` : 'Find today’s balls'}
            </button>
          </>
        )}
      </section>
      <section className="wb-card">
        <div className="wb-card-head">
          <span className="wb-kicker">Endless</span>
          {save.endless.bestLevels > 0 && <span className="wb-muted">Best: {save.endless.bestLevels} found</span>}
        </div>
        <p className="wb-card-text">New shots forever, each one tougher. Miss three and the run is over.</p>
        <button className="wb-btn" onClick={() => onStart('endless')}>
          Start Endless
        </button>
      </section>
      <p className="wb-muted wb-small">
        {stats.played ? `${stats.played} dailies · ${stats.perfect} perfect · ` : ''}
        {save.fastest ? `fastest find ${save.fastest}s · ` : ''}saved on this device
      </p>
    </div>
  );
}

function ShareButton({ today, results, streak }: { today: string; results: readonly LevelResult[]; streak: number }) {
  const [msg, setMsg] = useState('');
  useEffect(() => {
    if (!msg) return;
    const t = window.setTimeout(() => setMsg(''), 2200);
    return () => window.clearTimeout(t);
  }, [msg]);
  return (
    <button
      className="wb-btn wb-btn-go"
      onClick={() =>
        void shareOrCopy({ title: "Where's the Ball?", text: shareText(today, results, streak, `${window.location.origin}/games/wheres-the-ball`) }).then((o) =>
          setMsg(o === 'copied' ? 'Copied!' : o === 'failed' ? 'Could not copy' : ''),
        )
      }
    >
      {msg || 'Share result'}
    </button>
  );
}

/* ------------------------------------------------------------------ play */

function Play(props: {
  run: Run;
  level: LevelState;
  today: string;
  clockMs: number;
  paused: boolean;
  picture: Picture;
  onResume: () => void;
  onAim: (x: number, y: number) => void;
  onConfirm: (slop: number) => void;
  onHint: () => void;
  onGiveUp: () => void;
  onNext: () => void;
  onMenu: () => void;
}) {
  const { run, level } = props;
  const [zoom, setZoom] = useState(0);
  const [sure, setSure] = useState(false);
  const view = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const down = useRef<{ x: number; y: number; id: number; type: string } | null>(null);
  const lastType = useRef('mouse');
  const scene = level.scene;

  useLayoutEffect(() => {
    const el = wrap.current;
    const c = canvas.current;
    if (!el || !c) return;
    const composite = props.picture.state === 'ready' ? props.picture.composite : null;
    if (scene.photo && !composite) return;
    const paint = (): void => (composite ? paintComposite(c, composite, el.clientWidth) : paintScene(c, scene, el.clientWidth));
    paint();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(paint) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [scene, zoom, props.picture]);

  // Zooming keeps the aim (or the middle) in view.
  const setZoomKeep = (z: number): void => {
    const v = view.current;
    const focus = level.aim ?? null;
    const fx = focus ? focus.x / W : (v ? (v.scrollLeft + v.clientWidth / 2) / v.scrollWidth : 0.5);
    const fy = focus ? focus.y / H : (v ? (v.scrollTop + v.clientHeight / 2) / v.scrollHeight : 0.5);
    setZoom(z);
    requestAnimationFrame(() => {
      if (!v) return;
      v.scrollLeft = fx * v.scrollWidth - v.clientWidth / 2;
      v.scrollTop = fy * v.scrollHeight - v.clientHeight / 2;
    });
  };

  const onDown = (e: ReactPointerEvent): void => {
    down.current = { x: e.clientX, y: e.clientY, id: e.pointerId, type: e.pointerType };
  };
  const onUp = (e: ReactPointerEvent): void => {
    const d = down.current;
    down.current = null;
    if (!d || d.id !== e.pointerId || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 10 || level.outcome !== 'play' || props.paused) return;
    if (props.picture.state === 'loading' || props.picture.state === 'error') return;
    const rect = wrap.current!.getBoundingClientRect();
    lastType.current = d.type;
    props.onAim(((e.clientX - rect.left) / rect.width) * W, ((e.clientY - rect.top) / rect.height) * H);
  };

  const pxPerUnit = (): number => (wrap.current ? wrap.current.getBoundingClientRect().width / W : 1);
  const doConfirm = (): void => props.onConfirm((lastType.current === 'touch' ? 14 : 6) / pxPerUnit());

  // Enter confirms, + / - zoom, Escape clears nothing (taps never count until confirmed).
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => undefined);
  const onKeyNow = (e: KeyboardEvent): void => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Enter') {
      const el = e.target as HTMLElement | null;
      if (el?.tagName === 'BUTTON') return;
      e.preventDefault();
      if (level.outcome === 'play') doConfirm();
      else props.onNext();
    } else if (e.key === '+' || e.key === '=') setZoomKeep(Math.min(ZOOMS.length - 1, zoom + 1));
    else if (e.key === '-') setZoomKeep(Math.max(0, zoom - 1));
  };
  useLayoutEffect(() => {
    keyRef.current = onKeyNow;
  });
  useEffect(() => {
    const f = (e: KeyboardEvent): void => keyRef.current(e);
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, []);

  const secs = secondsOf(level, props.clockMs);
  const hints = Array.from({ length: level.hints }, (_, i) => hintBox(scene, i + 1, rng(scene.seed + i)));
  const done = level.outcome !== 'play';
  const label = run.challenge ? `⚔️ Challenge · ${run.index + 1}/${DAILY_LEVELS}` : run.mode === 'daily' ? `Daily #${dailyNumber(props.today)} · ${run.index + 1}/${DAILY_LEVELS}` : `Endless · level ${run.index + 1}`;
  const res = done ? resultOf(level) : null;

  return (
    <div className="wb-play">
      <div className="wb-top">
        <button className="wb-icon-btn" onClick={props.onMenu} aria-label="Back to menu">
          ←
        </button>
        <span className="wb-kicker">
          {label} · {placeName(scene)}
        </span>
        <span className="wb-tries" aria-label={`${TRIES - level.wrong.length} tries left`}>
          {Array.from({ length: TRIES }, (_, i) => (
            <i key={i} className={i < TRIES - level.wrong.length ? 'is-on' : ''} />
          ))}
        </span>
        {run.mode === 'endless' && <span className="wb-lives" aria-label={`${run.lives} lives`}>{'❤'.repeat(Math.max(0, run.lives))}</span>}
        <span className="wb-clock wb-mono">{Math.floor(secs)}s</span>
      </div>

      <div className="wb-view" ref={view}>
        <div className="wb-wrap" ref={wrap} style={{ width: `${ZOOMS[zoom]! * 100}%` }} onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => (down.current = null)}>
          <canvas ref={canvas} role="img" aria-label={`${placeName(scene)}: find the tennis ball`} />
          {props.picture.state === 'loading' && <div className="wb-developing">Developing the photo…</div>}
          {props.picture.state === 'error' && (
            <div className="wb-developing">
              <p>The photo didn’t load. Check your connection.</p>
              <button className="wb-btn" onClick={props.picture.retry}>
                Try again
              </button>
            </div>
          )}
          <svg viewBox={`0 0 ${W} ${H}`} className="wb-overlay" aria-hidden="true">
            {hints.map((b, i) => (
              <rect key={i} className="wb-hint" x={b.x} y={b.y} width={b.w} height={b.h} rx={18} />
            ))}
            {level.wrong.map((g, i) => (
              <g key={i} transform={`translate(${g.x} ${g.y})`} className={`wb-wrong wb-${g.heat}`}>
                <path d="M-9 -9 L9 9 M9 -9 L-9 9" />
                <text y={-16}>{g.heat}</text>
              </g>
            ))}
            {level.aim && !done && (
              <g transform={`translate(${level.aim.x} ${level.aim.y})`} className="wb-aim">
                <circle r={22} />
                <path d="M-32 0 H-12 M12 0 H32 M0 -32 V-12 M0 12 V32" />
              </g>
            )}
            {done && <circle className={level.outcome === 'found' ? 'wb-found' : 'wb-reveal'} cx={scene.ball.x} cy={scene.ball.y} r={scene.ball.r * 2.2} />}
          </svg>
          {props.paused && (
            <button className="wb-paused" onClick={props.onResume}>
              Paused · tap to continue
            </button>
          )}
        </div>
      </div>

      {!done ? (
        <div className="wb-controls">
          <div className="wb-zoom" role="group" aria-label="Zoom">
            <button onClick={() => setZoomKeep(Math.max(0, zoom - 1))} disabled={zoom === 0} aria-label="Zoom out">
              −
            </button>
            <span className="wb-mono">{ZOOMS[zoom]}×</span>
            <button onClick={() => setZoomKeep(Math.min(ZOOMS.length - 1, zoom + 1))} disabled={zoom === ZOOMS.length - 1} aria-label="Zoom in">
              +
            </button>
          </div>
          <button className="wb-btn" onClick={props.onHint} disabled={level.hints >= MAX_HINTS}>
            💡 Hint (−{HINT_COST})
          </button>
          <button className="wb-btn wb-btn-go wb-btn-lock" onClick={doConfirm} disabled={!level.aim}>
            {level.aim ? 'Lock it in' : 'Tap where the ball is'}
          </button>
          {sure ? (
            <button className="wb-btn wb-btn-ghost" onClick={props.onGiveUp}>
              Yes, show me
            </button>
          ) : (
            <button className="wb-btn wb-btn-ghost" onClick={() => setSure(true)}>
              Give up
            </button>
          )}
        </div>
      ) : (
        <div className="wb-done" role="status">
          <h2>{level.outcome === 'found' ? (res!.seconds <= 10 && !res!.wrong && !res!.hints ? 'Ace! 🎾' : 'Found it!') : 'There it was!'}</h2>
          <p className="wb-muted">
            {level.outcome === 'found'
              ? `${res!.seconds}s · ${res!.wrong} wrong guess${res!.wrong === 1 ? '' : 'es'} (−${res!.wrong * WRONG_COST})${res!.hints ? ` · ${res!.hints} hint (−${res!.hints * HINT_COST})` : ''}`
              : run.mode === 'endless'
                ? `One life lost. ${run.lives} left.`
                : 'No points for this one.'}
          </p>
          <p className="wb-done-score">
            <b className="wb-mono">+{fmt(res!.score)}</b>
          </p>
          {scene.photo && <PhotoCredit id={scene.photo.id} />}
          <button className="wb-btn wb-btn-go wb-btn-big" onClick={props.onNext} autoFocus>
            {run.over ? 'See results' : 'Next shot →'}
          </button>
        </div>
      )}
      {!done && !level.aim && level.wrong.length === 0 && run.index === 0 && (
        <p className="wb-coach">Tap where you think the ball is, then lock it in. Tiny? Zoom with +.</p>
      )}
      {!done && level.wrong.length > 0 && (
        <p className="wb-note">
          {level.wrong[level.wrong.length - 1]!.heat === 'hot' ? '🔥 Hot! It’s close.' : level.wrong[level.wrong.length - 1]!.heat === 'warm' ? '🌤 Warm. Somewhere around there.' : '🧊 Cold. Look elsewhere.'}{' '}
          {TRIES - level.wrong.length} {TRIES - level.wrong.length === 1 ? 'try' : 'tries'} left.
        </p>
      )}
    </div>
  );
}

function Summary({ run, today, save, onMenu, onAgain }: { run: Run; today: string; save: WbSave; onMenu: () => void; onAgain: () => void }) {
  const streak = wbStats(save, today).streak;
  const found = run.results.filter((r) => r.found).length;
  return (
    <div className="wb-menu">
      <span className="wb-kicker">{run.challenge ? '⚔️ Challenge round complete' : run.mode === 'daily' ? `Daily #${dailyNumber(today)} complete` : 'Endless run over'}</span>
      <BallIcon />
      <p className="wb-big wb-mono">{fmt(totalScore(run.results))}</p>
      <p className="wb-muted">
        {found} found{run.mode === 'daily' ? ` of ${DAILY_LEVELS}` : ` · best ${save.endless.bestLevels}`}
        {run.mode === 'daily' && !run.challenge && streak > 0 ? ` · 🔥 ${streak}` : ''}
      </p>
      <p className="wb-squares">{run.results.map(squareFor).join(' ')}</p>
      <div className="wb-row">
        {run.challenge ? (
          <a className="wb-btn wb-btn-go" href={`/c/${run.challenge.id}`} onClick={openChallengeScores}>
            See the scoreboard
          </a>
        ) : run.mode === 'daily' ? (
          <ShareButton today={today} results={run.results} streak={streak} />
        ) : (
          <button className="wb-btn wb-btn-go" onClick={onAgain}>
            Play again
          </button>
        )}
        <button className="wb-btn wb-btn-ghost" onClick={onMenu}>
          Menu
        </button>
      </div>
    </div>
  );
}

function PhotoCredit({ id }: { id: string }) {
  const c = photoCredit(id);
  if (!c) return null;
  return (
    <p className="wb-credit">
      <a href={c.source} target="_blank" rel="noreferrer">
        {c.text}
      </a>
    </p>
  );
}
