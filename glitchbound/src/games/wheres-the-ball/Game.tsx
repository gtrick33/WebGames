import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { GameHost, GameModuleProps } from '../../platform/contract';
import type { ChallengeSpec } from '../../platform/challenge';
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
  progressOf,
  resultOf,
  resumeLevel,
  secondsOf,
  shareText,
  squareFor,
  startLevel,
  totalScore,
  TRIES,
  WRONG_COST,
  type LevelProgress,
  type LevelResult,
  type LevelState,
} from './logic';
import { paintScene } from './paint';
import { photoCredit, photoTitle } from './photo';
import { buildComposite, loadPhoto, paintComposite } from './photoPaint';
import { ENV_NAMES, H, hintBox, rng, W, type Scene } from './scene';
import { createSfx, type Sfx } from './sound';
import { closeRound, emptyWbSave, isComplete, loadWb, readWb, recordEndless, recordLevel, recordRound, saveWb, STORE_KEY, wbStats, type WbSave } from './store';
import './Game.css';
import { openChallengeScores } from '../../platform/challenge';
import { GameMenuButton } from '../../components/GameMenuButton';

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
  /** The day the run belongs to: a daily started before midnight finishes as that day's. */
  day: string;
  /** Its shots are `day`'s daily and are saved as that day's daily (one attempt, resumable). */
  daily: boolean;
  /** A friends' challenge: five shots (mode stays 'daily'), `day`'s daily ones for a daily challenge. */
  challenge?: { id: string; round: number; key: string; dailyScenes: boolean };
}

type Progress = LevelProgress & { index: number };

/** A game clock that only runs while a level is on screen and not paused. Reading it never re-renders. */
function useClock(running: boolean): () => number {
  const ref = useRef({ base: 0, since: 0, on: false });
  useEffect(() => {
    if (!running) return;
    const clock = ref.current;
    clock.since = performance.now();
    clock.on = true;
    return () => {
      clock.base += performance.now() - clock.since;
      clock.on = false;
    };
  }, [running]);
  return useCallback(() => {
    const c = ref.current;
    return c.on ? c.base + performance.now() - c.since : c.base;
  }, []);
}

const sceneAt = (run: Run, i: number): Scene => (run.daily || run.challenge?.dailyScenes ? dailyScene(run.day, i) : endlessScene(run.seed, i));

function sceneFor(run: Run): Scene {
  const scene = sceneAt(run, run.index);
  // Fetch the next level's photo in the background so it opens instantly.
  const next = run.mode !== 'daily' || run.index + 1 < DAILY_LEVELS ? sceneAt(run, run.index + 1) : null;
  if (next?.photo) void loadPhoto(next.photo.id).catch(() => undefined);
  return scene;
}

const levelFor = (run: Run, now: number, p: Progress | null): LevelState => (p ? resumeLevel(sceneFor(run), now, p) : startLevel(sceneFor(run), now));

/**
 * Where a friends' challenge round stands on this device. One attempt: a finished round shows its
 * result; a started one picks up where it was. A daily challenge plays that day's daily: a finished
 * daily is the round's score, and a daily of today (or one already started) is played as the daily too.
 */
function challengeRun(c: ChallengeSpec, save: WbSave, today: string): { run: Run; progress: Progress | null; note: string; counts: boolean } {
  const key = `${c.id}:${c.round}`;
  const dailyScenes = c.mode === 'daily' && /^\d{4}-\d{2}-\d{2}$/.test(c.day ?? '');
  const day = dailyScenes ? c.day : today;
  const base: Run = { mode: 'daily', index: 0, results: [], lives: LIVES, over: false, seed: c.seed, day, daily: false, challenge: { id: c.id, round: c.round, key, dailyScenes } };
  const over = (results: LevelResult[], note: string, counts = false) => ({ run: { ...base, results, index: results.length, over: true }, progress: null, note, counts });
  const rec = save.challenges[key];
  if (rec?.done) return over(rec.results, 'You already played this round.');
  const daily = save.daily[day] ?? [];
  if (dailyScenes && isComplete(daily)) return over(daily, 'Your daily result counts here.', true);
  if (dailyScenes && (day === today || daily.length > 0 || save.progress?.day === day)) {
    const p = save.progress;
    return { run: { ...base, daily: true, results: daily, index: daily.length }, progress: p && p.day === day && p.index === daily.length ? p : null, note: '', counts: false };
  }
  const results = rec?.results ?? [];
  return { run: { ...base, results, index: results.length }, progress: rec?.progress?.index === results.length ? rec.progress : null, note: '', counts: false };
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
  // The same object until something changes, so the picture isn't repainted on every render.
  return useMemo((): Picture => {
    if (!photo) return { state: 'none' };
    if (!built || built.scene !== photo) return { state: 'loading' };
    if ('failed' in built)
      return {
        state: 'error',
        retry: () => {
          setBuilt(null);
          setAttempt((a) => a + 1);
        },
      };
    return { state: 'ready', composite: built.composite };
  }, [photo, built]);
}

const placeName = (s: Scene): string => (s.photo ? photoTitle(s.photo.id, s.photo.title) : ENV_NAMES[s.env]);

function WheresTheBall({ host, pauseKey, challenge }: { host: GameHost; pauseKey?: number; challenge?: GameModuleProps['challenge'] }) {
  const [boot] = useState(() => {
    const day = dayKey();
    const save = loadWb();
    return { day, save, set: challenge ? challengeRun(challenge, save, day) : null };
  });
  const [today, setToday] = useState(boot.day);
  const [save, setSave] = useState<WbSave>(boot.save);
  const [run, setRun] = useState<Run | null>(boot.set?.run ?? null);
  const [note, setNote] = useState(boot.set?.note ?? '');
  const [level, setLevel] = useState<LevelState | null>(() => (boot.set && !boot.set.run.over ? levelFor(boot.set.run, 0, boot.set.progress) : null));
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const saveRef = useRef(save);
  const runRef = useRef(run);
  const levelRef = useRef(level);
  useLayoutEffect(() => {
    runRef.current = run;
    levelRef.current = level;
  });

  /** Read-modify-write: another tab may have saved since this one loaded. `show` re-renders with it. */
  const update = useCallback((fn: (s: WbSave) => WbSave, show = true): WbSave => {
    const next = fn(readWb() ?? saveRef.current);
    saveWb(next, dayKey());
    saveRef.current = next;
    if (show) setSave(next);
    return next;
  }, []);

  /** A daily result that already counts as this challenge round's score: reported once, then the round is over. */
  const settle = useCallback(
    (set: ReturnType<typeof challengeRun>) => {
      if (!set.counts || !set.run.challenge) return;
      const { id, round, key } = set.run.challenge;
      host.report({ type: 'end', ...endStats(set.run.results), challenge: { id, round } });
      update((s) => closeRound(s, key, set.run.day, set.run.results));
    },
    [host, update],
  );

  useEffect(() => {
    const set = boot.set;
    // A round already played reports nothing; one that was started (or counts a daily) reports its start as before.
    if (!set || (set.run.over && !set.counts)) return;
    host.report({ type: 'start' });
    settle(set);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  // The day moves on at midnight: re-read it when the page comes back, gets focus, and on the menu.
  useEffect(() => {
    const onVis = (): void => {
      setHidden(document.hidden);
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
  useEffect(() => {
    if (run) return;
    const t = window.setInterval(() => setToday(dayKey()), 30_000);
    return () => window.clearInterval(t);
  }, [run]);

  const picture = usePicture(level?.scene ?? null);
  const pictureReady = picture.state === 'none' || picture.state === 'ready';
  // The clock never runs while a photo is still loading.
  const running = !!level && level.outcome === 'play' && !paused && !hidden && pictureReady;
  const now = useClock(running);

  // A daily or challenge shot is one try: the unfinished one is saved as it goes (about once a second and
  // on every guess), so leaving or reloading resumes it instead of starting it over with fresh tries.
  const keepProgress = useCallback(() => {
    const r = runRef.current;
    const l = levelRef.current;
    if (!r || !l || l.outcome !== 'play' || r.mode !== 'daily') return;
    const p: Progress = { index: r.index, ...progressOf(l, now()) };
    if (r.daily) update((s) => ((s.daily[r.day]?.length ?? 0) === r.index ? { ...s, progress: { day: r.day, ...p } } : s), false);
    else if (r.challenge) {
      const { key } = r.challenge;
      update((s) => {
        const rec = s.challenges[key] ?? { day: r.day, results: r.results, progress: null, done: false };
        return rec.done || rec.results.length !== r.index ? s : { ...s, challenges: { ...s.challenges, [key]: { ...rec, progress: p } } };
      }, false);
    }
  }, [now, update]);
  useEffect(() => keepProgress(), [level, keepProgress]);
  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(keepProgress, 1000);
    return () => {
      window.clearInterval(t);
      keepProgress();
    };
  }, [running, keepProgress]);

  // Another tab saved: show its save, and leave a shot it already played here.
  useEffect(() => {
    const onStorage = (e: StorageEvent): void => {
      if (e.key !== null && e.key !== STORE_KEY) return;
      const fresh = readWb() ?? emptyWbSave();
      saveRef.current = fresh;
      setSave(fresh);
      const r = runRef.current;
      if (!r || r.over) return;
      const ahead = r.daily ? (fresh.daily[r.day]?.length ?? 0) > r.results.length : !!r.challenge && ((rec) => !!rec && (rec.done || rec.results.length > r.results.length))(fresh.challenges[r.challenge.key]);
      if (!ahead) return;
      if (challenge && r.challenge) {
        const set = challengeRun(challenge, fresh, dayKey());
        setRun(set.run);
        setNote(set.note);
        setLevel(set.run.over ? null : levelFor(set.run, now(), set.progress));
        settle(set);
      } else {
        setRun(null);
        setLevel(null);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [challenge, now, settle]);

  const start = (mode: Mode): void => {
    const day = dayKey();
    setToday(day);
    const fresh = readWb() ?? saveRef.current;
    saveRef.current = fresh;
    setSave(fresh);
    let r: Run = { mode, index: 0, results: [], lives: LIVES, over: false, seed: Math.floor(Math.random() * 2 ** 32), day, daily: mode === 'daily' };
    if (mode === 'daily') {
      const done = fresh.daily[day] ?? [];
      r = { ...r, index: done.length, results: done, over: isComplete(done) };
      if (!r.over) host.report({ type: 'start' });
    } else host.report({ type: 'start' });
    setRun(r);
    setNote('');
    setPaused(false);
    // Today's daily shot left halfway carries on where it was (wrong guesses, hints, time).
    const p = fresh.progress;
    setLevel(r.over ? null : levelFor(r, now(), r.daily && p?.day === day && p.index === r.index ? p : null));
  };

  const finish = (s: LevelState): void => {
    if (!run) return;
    const res = resultOf(s);
    const results = [...run.results, res];
    let next: Run = { ...run, results };
    const ch = run.challenge;
    const roundOver = run.mode === 'daily' && results.length >= DAILY_LEVELS;
    if (run.mode === 'endless') next = { ...next, lives: run.lives - (res.found ? 0 : 1), over: run.lives - (res.found ? 0 : 1) <= 0 };
    update((base) => {
      let sv = recordLevel(base, res, run.daily ? run.day : null, run.daily ? run.index : undefined);
      if (ch && !run.daily) sv = recordRound(sv, ch.key, run.day, res, run.index);
      if (ch && roundOver) sv = closeRound(sv, ch.key, run.day, results);
      if (run.mode === 'endless' && next.over) sv = recordEndless(sv, results);
      return sv;
    });
    if (roundOver) {
      next.over = true;
      host.report(ch ? { type: 'end', ...endStats(results), challenge: { id: ch.id, round: ch.round } } : { type: 'end', ...endStats(results), daily: true });
    }
    if (run.mode === 'endless' && next.over) host.report({ type: 'end', ...endStats(results, { levels: results.filter((r) => r.found).length }) });
    if (res.found) sfx().found();
    else sfx().missed();
    setRun(next);
  };

  const apply = (s: LevelState, before: LevelState): void => {
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
    setLevel(startLevel(sceneFor(r), now()));
  };

  const toMenu = (): void => {
    const fresh = readWb() ?? saveRef.current; // the menu shows "Resume" for a daily shot left halfway
    saveRef.current = fresh;
    setSave(fresh);
    setToday(dayKey());
    setNote('');
    setRun(null);
    setLevel(null);
  };

  return (
    <div className="wb">
      {!run && <Menu today={today} save={save} onStart={start} onMute={() => update((s) => ({ ...s, muted: !s.muted }))} />}
      {run && level && (
        <Play
          key={`${run.index}:${level.scene.seed}`}
          run={run}
          level={level}
          now={now}
          paused={paused}
          picture={picture}
          onResume={() => setPaused(false)}
          onAim={(x, y, quiet) => {
            setLevel(aim(level, x, y));
            if (!quiet) sfx().aim();
          }}
          onConfirm={(slop) => {
            const s = confirm(level, slop, now());
            if (s.outcome === 'play' && s.wrong.length > level.wrong.length) sfx().wrong(s.wrong[s.wrong.length - 1]!.heat);
            apply(s, level);
          }}
          onHint={() => {
            setLevel(hint(level));
            sfx().hint();
          }}
          onGiveUp={() => apply(giveUp(level, now()), level)}
          onNext={nextLevel}
          onMenu={toMenu}
        />
      )}
      {run && !level && <Summary run={run} save={save} note={note} onMenu={toMenu} onAgain={() => start(run.mode)} />}
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
  const started = !!todays?.length || save.progress?.day === today;
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
        <GameMenuButton className="wb-icon-btn" />
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
              {started ? `Resume (${todays?.length ?? 0}/${DAILY_LEVELS})` : 'Find today’s balls'}
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
        {stats.played ? `${stats.played} ${stats.played === 1 ? 'daily' : 'dailies'} · ${stats.perfect} perfect · ` : ''}
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

const ARROWS: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

/** A keyboard-focused control keeps Enter (a click-focused one doesn't: Enter is the game's then). */
function focusVisible(el: Element): boolean {
  try {
    return el.matches(':focus-visible');
  } catch {
    return true;
  }
}

/** The shot's clock: it re-renders itself (only when the second changes), not the whole play screen. */
function Clock({ level, now }: { level: LevelState; now: () => number }) {
  const [secs, setSecs] = useState(() => Math.floor(secondsOf(level, now())));
  useEffect(() => {
    if (level.outcome !== 'play') return;
    const t = window.setInterval(() => setSecs(Math.floor(secondsOf(level, now()))), 200);
    return () => window.clearInterval(t);
  }, [level, now]);
  return <span className="wb-clock wb-mono">{level.outcome === 'play' ? secs : Math.floor(secondsOf(level, 0))}s</span>;
}

const HEAT_TEXT = { hot: '🔥 Hot! It’s close.', warm: '🌤 Warm. Somewhere around there.', cold: '🧊 Cold. Look elsewhere.' } as const;

/** One shot. Keyed per shot, so each starts clean: 1×, scrolled to the top left, give-up not armed. */
function Play(props: {
  run: Run;
  level: LevelState;
  now: () => number;
  paused: boolean;
  picture: Picture;
  onResume: () => void;
  onAim: (x: number, y: number, quiet?: boolean) => void;
  onConfirm: (slop: number) => void;
  onHint: () => void;
  onGiveUp: () => void;
  onNext: () => void;
  onMenu: () => void;
}) {
  const { run, level } = props;
  const [zoom, setZoom] = useState(0);
  const [sure, setSure] = useState(false);
  const [flash, setFlash] = useState(run.index > 0);
  const root = useRef<HTMLDivElement>(null);
  const view = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const nextBtn = useRef<HTMLButtonElement>(null);
  const down = useRef<{ x: number; y: number; id: number; type: string } | null>(null);
  const lastType = useRef('mouse');
  const scene = level.scene;
  const composite = props.picture.state === 'ready' ? props.picture.composite : null;
  const ready = props.picture.state === 'none' || props.picture.state === 'ready';
  const done = level.outcome !== 'play';

  // One observer per picture: it paints on the first layout and whenever the size (or zoom) changes.
  useLayoutEffect(() => {
    const el = wrap.current;
    const c = canvas.current;
    if (!el || !c) return;
    if (scene.photo && !composite) return;
    const paint = (): void => (composite ? paintComposite(c, composite, el.clientWidth) : paintScene(c, scene, el.clientWidth));
    if (typeof ResizeObserver === 'undefined') {
      paint();
      return;
    }
    const ro = new ResizeObserver(paint);
    ro.observe(el);
    return () => ro.disconnect();
  }, [scene, composite]);

  // "Yes, show me" disarms itself after 3 s, so a later tap next to Lock it in can't forfeit the shot.
  useEffect(() => {
    if (!sure) return;
    const t = window.setTimeout(() => setSure(false), 3000);
    return () => window.clearTimeout(t);
  }, [sure]);
  // "Shot n of 5" shows briefly as a new photo appears.
  useEffect(() => {
    if (!flash || !ready) return;
    const t = window.setTimeout(() => setFlash(false), 1400);
    return () => window.clearTimeout(t);
  }, [flash, ready]);
  // The result's button takes the focus without scrolling the stage.
  useEffect(() => {
    if (done) nextBtn.current?.focus({ preventScroll: true });
  }, [done]);

  // Zooming keeps the aim (or the middle) in view.
  const setZoomKeep = (z: number): void => {
    const v = view.current;
    const focus = level.aim ?? null;
    const fx = focus ? focus.x / W : v ? (v.scrollLeft + v.clientWidth / 2) / v.scrollWidth : 0.5;
    const fy = focus ? focus.y / H : v ? (v.scrollTop + v.clientHeight / 2) / v.scrollHeight : 0.5;
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
    if (!ready) return;
    const rect = wrap.current!.getBoundingClientRect();
    lastType.current = d.type;
    props.onAim(((e.clientX - rect.left) / rect.width) * W, ((e.clientY - rect.top) / rect.height) * H);
  };

  const pxPerUnit = (): number => (wrap.current ? wrap.current.getBoundingClientRect().width / W : 1);
  const doConfirm = (): void => props.onConfirm((lastType.current === 'touch' ? 14 : 6) / pxPerUnit());

  /** Arrow keys aim: the first press puts the reticle in the middle of the view, then it moves (Shift: faster). */
  const moveAim = ([dx, dy]: [number, number], fast: boolean, quiet: boolean): void => {
    const v = view.current;
    const w = wrap.current;
    let at = level.aim;
    if (!at) at = v && w && w.clientWidth ? { x: ((v.scrollLeft + v.clientWidth / 2) / w.clientWidth) * W, y: ((v.scrollTop + v.clientHeight / 2) / w.clientHeight) * H } : { x: W / 2, y: H / 2 };
    else {
      const step = (fast ? 48 : 12) / ZOOMS[zoom]!;
      at = { x: Math.min(W, Math.max(0, at.x + dx * step)), y: Math.min(H, Math.max(0, at.y + dy * step)) };
    }
    lastType.current = 'keyboard';
    props.onAim(at.x, at.y, quiet);
    // Keep the reticle in view.
    if (!v || !w) return;
    const px = (at.x / W) * w.clientWidth;
    const py = (at.y / H) * w.clientHeight;
    const m = 40;
    if (px < v.scrollLeft + m) v.scrollLeft = px - m;
    else if (px > v.scrollLeft + v.clientWidth - m) v.scrollLeft = px - v.clientWidth + m;
    if (py < v.scrollTop + m) v.scrollTop = py - m;
    else if (py > v.scrollTop + v.clientHeight - m) v.scrollTop = py - v.clientHeight + m;
  };

  // Arrows aim, Enter locks in (or goes on), + / - zoom. Keys for a field, a dialog or the page around
  // the game are left alone, and nothing reacts while paused.
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => undefined);
  const onKeyNow = (e: KeyboardEvent): void => {
    const target = e.target instanceof HTMLElement ? e.target : null;
    if (target) {
      if (target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="dialog"], [aria-modal="true"]')) return;
      const game = root.current?.closest('.wb') ?? root.current;
      if (game && target !== document.body && !game.contains(target) && !target.contains(game)) return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey || props.paused) return;
    const playing = level.outcome === 'play' && ready;
    const dir = ARROWS[e.key];
    if (dir) {
      if (!playing) return;
      e.preventDefault();
      moveAim(dir, e.shiftKey, e.repeat);
      return;
    }
    if (e.repeat) return;
    if (e.key === 'Enter') {
      if (target?.closest('button, a') && focusVisible(target)) return;
      e.preventDefault();
      if (level.outcome !== 'play') props.onNext();
      else if (level.aim) doConfirm();
    } else if ((e.key === '+' || e.key === '=') && playing) {
      e.preventDefault();
      setZoomKeep(Math.min(ZOOMS.length - 1, zoom + 1));
    } else if (e.key === '-' && playing) {
      e.preventDefault();
      setZoomKeep(Math.max(0, zoom - 1));
    }
  };
  useLayoutEffect(() => {
    keyRef.current = onKeyNow;
  });
  useEffect(() => {
    const f = (e: KeyboardEvent): void => keyRef.current(e);
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, []);

  const hints = Array.from({ length: level.hints }, (_, i) => hintBox(scene, i + 1, rng(scene.seed + i)));
  const label = run.challenge ? `⚔️ Challenge · ${run.index + 1}/${DAILY_LEVELS}` : run.mode === 'daily' ? `Daily #${dailyNumber(run.day)} · ${run.index + 1}/${DAILY_LEVELS}` : `Endless · level ${run.index + 1}`;
  const res = done ? resultOf(level) : null;
  const last = level.wrong[level.wrong.length - 1];
  const left = TRIES - level.wrong.length;
  const heat = last ? `${HEAT_TEXT[last.heat]} ${left} ${left === 1 ? 'try' : 'tries'} left.` : '';

  return (
    <div className="wb-play" ref={root}>
      <div className="wb-top">
        {/* A challenge round is one attempt: no way out of it here (the arcade menu still works). */}
        {!run.challenge && (
          <button className="wb-icon-btn" onClick={props.onMenu} aria-label="Back to menu">
            ←
          </button>
        )}
        <span className="wb-kicker">
          {label} · {placeName(scene)}
        </span>
        <span className="wb-tries" aria-label={`${left} tries left`}>
          {Array.from({ length: TRIES }, (_, i) => (
            <i key={i} className={i < left ? 'is-on' : ''} />
          ))}
        </span>
        {run.mode === 'endless' && <span className="wb-lives" aria-label={`${run.lives} lives`}>{'❤'.repeat(Math.max(0, run.lives))}</span>}
        <Clock level={level} now={props.now} />
        <GameMenuButton className="wb-icon-btn" />
      </div>

      <div className="wb-body">
        <div className="wb-stagebox">
          <div className="wb-view" ref={view}>
            <div className="wb-wrap" ref={wrap} style={{ width: `${ZOOMS[zoom]! * 100}%` }} onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => (down.current = null)}>
              <canvas ref={canvas} role="img" aria-label={`${placeName(scene)}: find the tennis ball. Arrow keys aim, Enter locks it in, plus and minus zoom.`} />
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
            </div>
          </div>
          {flash && ready && !done && (
            <p className="wb-newshot" aria-hidden="true">
              {run.mode === 'daily' ? `Shot ${run.index + 1} of ${DAILY_LEVELS}` : `Level ${run.index + 1}`}
            </p>
          )}
          {/* Paused hides the photo too: the clock is stopped, so searching on would be free time. */}
          {props.paused && (
            <button className="wb-paused" onClick={props.onResume}>
              Paused · tap to continue
            </button>
          )}
        </div>

        <div className="wb-side">
          {!done ? (
            <>
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
              {/* The tip stays up while aiming: if it vanished on the first tap, the photo would grow and push the Lock button away. */}
              {level.wrong.length === 0 && run.index === 0 && <p className="wb-coach">Tap where you think the ball is, then lock it in. Tiny? Zoom with +.</p>}
              {last && (
                <p className="wb-note" aria-hidden="true">
                  {heat}
                </p>
              )}
            </>
          ) : (
            // Beside the photo on wide stages and under it on tall ones: the reveal ring is never covered.
            <div className="wb-done" role="status">
              <div className="wb-done-head">
                <h2>{level.outcome === 'found' ? (res!.seconds <= 10 && !res!.wrong && !res!.hints ? 'Ace! 🎾' : 'Found it!') : 'There it was!'}</h2>
                <b className="wb-mono wb-done-score">+{fmt(res!.score)}</b>
              </div>
              <p className="wb-muted">
                {level.outcome === 'found'
                  ? `${res!.seconds}s · ${res!.wrong} wrong guess${res!.wrong === 1 ? '' : 'es'} (−${res!.wrong * WRONG_COST})${res!.hints ? ` · ${res!.hints} hint (−${res!.hints * HINT_COST})` : ''}`
                  : run.mode === 'endless'
                    ? `One life lost. ${run.lives} left.`
                    : 'No points for this one.'}
              </p>
              {scene.photo && <PhotoCredit id={scene.photo.id} />}
              <button ref={nextBtn} className="wb-btn wb-btn-go wb-btn-big" onClick={props.onNext}>
                {run.over ? 'See results' : 'Next shot →'}
              </button>
            </div>
          )}
        </div>
      </div>
      {/* Hot, warm or cold for screen readers (the visible note says the same). */}
      <p className="wb-sr" aria-live="polite">
        {heat}
      </p>
    </div>
  );
}

function Summary({ run, save, note, onMenu, onAgain }: { run: Run; save: WbSave; note: string; onMenu: () => void; onAgain: () => void }) {
  const streak = wbStats(save, run.day).streak;
  const found = run.results.filter((r) => r.found).length;
  return (
    <div className="wb-menu">
      <span className="wb-kicker">{run.challenge ? '⚔️ Challenge round complete' : run.mode === 'daily' ? `Daily #${dailyNumber(run.day)} complete` : 'Endless run over'}</span>
      <BallIcon />
      {note && <p className="wb-muted">{note}</p>}
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
          <ShareButton today={run.day} results={run.results} streak={streak} />
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
