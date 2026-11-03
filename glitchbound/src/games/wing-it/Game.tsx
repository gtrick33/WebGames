import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChallengeSpec } from '../../platform/challenge';
import type { GameHost, GameModuleProps } from '../../platform/contract';
import { dayKey, daysBetween, hashString } from '../../platform/dates';
import { shareOrCopy } from '../../platform/share';
import { ResultLine } from '../../components/ResultLine';
import { NextDaily } from '../../components/NextDaily';
import { drawBird, drawFrame, newView, POP_LIFE, type Pop } from './render';
import { biomeFor, BIRD_R, flap, flightLine, GROUND, MEDAL_ICON, medalFor, newSim, runPoints, step, STEP, type Medal, type Sim } from './sim';
import { createSfx, type Sfx } from './sound';
import './Game.css';
import { openChallengeScores } from '../../platform/challenge';
import { GameMenuButton } from '../../components/GameMenuButton';

const KEY = 'glitchbound.wing-it';
const EPOCH = '2026-10-19';
type Mode = 'daily' | 'endless' | 'challenge';

interface Save {
  best: number;
  bestPillars: number;
  feathers: number;
  runs: number;
  /**
   * Today's flights: `tries` taken (counted at take-off), the best one's points, gaps and feathers (they
   * draw the share line). `open` while a flight is in the air; `left` when the last one ended because
   * the player left mid-flight.
   */
  daily: Record<string, { best: number; tries: number; pillars?: number; feathers?: number; open?: boolean; left?: boolean }>;
  /** Friends' challenge rounds by `${id}:${round}`: one flight each, `open` while it is in the air. */
  challenges: Record<string, ChallengeRec>;
  medals: Record<string, number>;
  muted: boolean;
}
interface ChallengeRec {
  points: number;
  pillars: number;
  feathers: number;
  open?: boolean;
}
/** Challenge rounds kept in the save (the oldest go first). */
const KEEP_CHALLENGES = 40;

const emptySave = (): Save => ({ best: 0, bestPillars: 0, feathers: 0, runs: 0, daily: {}, challenges: {}, medals: {}, muted: false });

function loadSave(): Save {
  try {
    const o = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Save>;
    const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(1e6, Math.floor(v)) : 0);
    const s = emptySave();
    s.best = n(o.best);
    s.bestPillars = n(o.bestPillars);
    s.feathers = n(o.feathers);
    s.runs = n(o.runs);
    s.muted = o.muted === true;
    if (o.daily && typeof o.daily === 'object') {
      for (const [d, v] of Object.entries(o.daily).slice(-60)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !v || typeof v !== 'object') continue;
        const e = v as { best?: number; tries?: number; pillars?: number; feathers?: number; open?: unknown; left?: unknown };
        s.daily[d] = {
          best: n(e.best),
          tries: Math.min(DAILY_FLIGHTS, n(e.tries)),
          ...(e.pillars !== undefined ? { pillars: n(e.pillars), feathers: n(e.feathers) } : {}),
          ...(e.open === true ? { open: true } : {}),
          ...(e.left === true ? { left: true } : {}),
        };
      }
    }
    if (o.challenges && typeof o.challenges === 'object') {
      for (const [k, v] of Object.entries(o.challenges).slice(-KEEP_CHALLENGES)) {
        if (!v || typeof v !== 'object') continue;
        const e = v as Partial<ChallengeRec>;
        s.challenges[k] = { points: n(e.points), pillars: n(e.pillars), feathers: n(e.feathers), ...(e.open === true ? { open: true } : {}) };
      }
    }
    if (o.medals && typeof o.medals === 'object') for (const [m, v] of Object.entries(o.medals)) s.medals[m] = n(v);
    return s;
  } catch {
    return emptySave();
  }
}

/** The save as stored now (another tab may have changed it), or null when there is none or storage is blocked. */
function readStored(): Save | null {
  try {
    return localStorage.getItem(KEY) === null ? null : loadSave();
  } catch {
    return null;
  }
}

const writeSave = (s: Save): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* blocked storage */
  }
};

const withChallenge = (all: Save['challenges'], key: string, rec: ChallengeRec): Save['challenges'] => {
  const next = { ...all };
  delete next[key];
  next[key] = rec;
  return Object.fromEntries(Object.entries(next).slice(-KEEP_CHALLENGES));
};

const dailyNumber = (day: string): number => Math.max(1, daysBetween(EPOCH, day) + 1);
/** The daily course for a day (a "today's daily" challenge flies the same one). */
const courseSeed = (day: string): number => hashString(`wing-it:${day}`);

/** The share line of today's best flight (older saves only kept its points). */
const dailyLine = (d: Save['daily'][string]): string => flightLine(d.pillars ?? d.best, d.feathers ?? 0);
/** The bar on its own row and the medal and feathers below it, so the bar never wraps on the card. */
const cardLine = (line: string): string => line.replace(' ', '\n');
const gapsText = (n: number): string => `${n} gap${n === 1 ? '' : 's'}`;

type DailyRec = Save['daily'][string];
/** Today's course gives three flights and the best one counts: a reflex game shouldn't end the day on a first misjudged flap. */
const DAILY_FLIGHTS = 3;
const flightsLeft = (d: DailyRec | undefined): number => Math.max(0, DAILY_FLIGHTS - (d?.tries ?? 0));
const flightsText = (n: number): string => `${n} flight${n === 1 ? '' : 's'} left`;
/** After a crash the result's buttons (and Space) wait this long, so a player still tapping doesn't fly again by accident. */
const RESULT_GUARD_MS = 700;

/** Today's record when a flight ends (the try was counted at take-off): the best flight is kept. */
function dailyAfter(d: DailyRec | undefined, points: number, pillars: number, feathers: number, left = false): DailyRec {
  const tries = Math.max(1, d?.tries ?? 1);
  const best = d && d.best >= points && (d.best > 0 || points === 0) ? { best: d.best, pillars: d.pillars ?? 0, feathers: d.feathers ?? 0 } : { best: points, pillars, feathers };
  return { ...best, tries, ...(left ? { left: true } : {}) };
}

/** What the flight in play counts for: the daily of `day` (a "today's daily" challenge too) and/or a challenge round. */
interface Flight {
  mode: Mode;
  day: string | null;
  ch: string | null;
}
type Result = { points: number; pillars: number; feathers: number; medal: Medal; newBest: boolean; note?: string };

/**
 * How a friends' challenge round opens. "Today's daily" flies that day's own course (and counts as one of
 * its flights); a fresh round flies the challenge's seed. A round already flown shows its result; one
 * started before a reload can't be picked up mid-air, so it ends with what it had (nothing).
 */
function openChallenge(save: Save, c: ChallengeSpec): { sim: Sim; flight: Flight; done?: Result & { report: boolean } } {
  const day = c.mode === 'daily' && /^\d{4}-\d{2}-\d{2}$/.test(c.day) ? c.day : null;
  const flight = { mode: 'challenge' as const, day, ch: `${c.id}:${c.round}` };
  const s = newSim(day ? courseSeed(day) : c.seed);
  const ended = (r: ChallengeRec, report: boolean, note?: string) => {
    s.dead = true;
    return { sim: s, flight, done: { points: r.points, pillars: r.pillars, feathers: r.feathers, medal: medalFor(r.pillars), newBest: false, report, ...(note ? { note } : {}) } };
  };
  const rec = save.challenges[flight.ch];
  if (rec && !rec.open) return ended(rec, false);
  if (rec) return ended(rec, true, 'This round was already started. It has one flight, so it ended there.');
  const d = day ? save.daily[day] : undefined;
  if (d && flightsLeft(d) === 0) return ended({ points: d.best, pillars: d.pillars ?? 0, feathers: d.feathers ?? 0 }, true, 'You already flew this daily course: your best that day counts here.');
  return { sim: s, flight };
}

/** True when a key press is meant for something else on the page (a field, a dialog, the site around the game). */
function notForGame(e: KeyboardEvent, root: Element | null): boolean {
  if (e.ctrlKey || e.altKey || e.metaKey) return true;
  const el = e.target instanceof Element ? e.target : null;
  if (!el || el === document.body || el === document.documentElement) return false;
  if (el.closest('[role=dialog],[aria-modal=true]') || !root?.contains(el)) return true;
  if ((el instanceof HTMLElement && el.isContentEditable) || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return true;
  // A button reached with the keyboard keeps Enter and Space.
  try {
    return (e.key === 'Enter' || e.key === ' ') && el.matches('button:focus-visible, a:focus-visible');
  } catch {
    return false;
  }
}

export default function Game({ host, restartKey, pauseKey, challenge }: GameModuleProps) {
  return <WingIt key={restartKey} host={host} pauseKey={pauseKey} challenge={challenge} />;
}

function WingIt({ host, pauseKey, challenge }: { host: GameHost; pauseKey?: number; challenge?: ChallengeSpec }) {
  // The day is read again when the menu shows, when the tab comes back and when a flight starts.
  const [today, setToday] = useState(() => dayKey());
  const [save, setSave] = useState<Save>(loadSave);
  const saveRef = useRef(save);
  /** Every write re-reads the stored save first, so another open tab's flights are never overwritten. */
  const update = useCallback((fn: (cur: Save) => Save) => {
    const cur = readStored() ?? saveRef.current;
    const next = fn(cur);
    saveRef.current = next;
    setSave(next);
    writeSave(next);
  }, []);
  const [opening] = useState(() => (challenge ? openChallenge(save, challenge) : null));
  const [screen, setScreen] = useState<'menu' | 'play'>(challenge ? 'play' : 'menu');
  const [mode, setMode] = useState<Mode>(challenge ? 'challenge' : 'daily');
  const flightRef = useRef<Flight>(opening?.flight ?? { mode: 'daily', day: null, ch: null });
  const [flightDay, setFlightDay] = useState<string | null>(opening?.flight.day ?? null);
  /** Bumped by every new flight: it restarts the drawing loop when that has stopped on a still frame. */
  const [flightNo, setFlightNo] = useState(0);
  const [hud, setHud] = useState({ score: 0, feathers: 0, dead: !!opening?.done, started: false, biome: 'meadow' });
  const hudRef = useRef(hud);
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<Result | null>(opening?.done ?? null);
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  // A friends' challenge starts straight away: one flight on the challenge's course.
  const sim = useRef<Sim | null>(opening?.sim ?? null);
  const sfxRef = useRef<Sfx | null>(null);
  const sfx = useCallback((): Sfx => (sfxRef.current ??= createSfx(() => saveRef.current.muted)), []);
  const deadAt = useRef(0);
  const pops = useRef<Pop[]>([]);
  useEffect(
    () => () => {
      sfxRef.current?.dispose();
      sfxRef.current = null;
    },
    [],
  );

  const toMenu = (): void => {
    setToday(dayKey());
    setScreen('menu');
  };

  const begin = (m: Exclude<Mode, 'challenge'>): void => {
    const day = dayKey();
    setToday(day);
    // The daily course is three flights a day (see tap: taking off uses one up).
    if (m === 'daily' && flightsLeft((readStored() ?? saveRef.current).daily[day]) === 0) return;
    flightRef.current = { mode: m, day: m === 'daily' ? day : null, ch: null };
    setFlightDay(m === 'daily' ? day : null);
    setMode(m);
    sim.current = newSim(m === 'daily' ? courseSeed(day) : (Math.random() * 2 ** 32) >>> 0);
    pops.current = [];
    setResult(null);
    setPaused(false);
    const fresh = { score: 0, feathers: 0, dead: false, started: false, biome: 'meadow' };
    hudRef.current = fresh;
    setHud(fresh);
    setFlightNo((n) => n + 1);
    setScreen('play');
  };

  const reportEnd = useCallback(
    (f: Flight, points: number, pillars: number, feathers: number) => {
      const end = { type: 'end' as const, score: points, stats: { pillars, feathers } };
      host.report(f.mode === 'daily' ? { ...end, daily: true } : f.mode === 'challenge' && challenge ? { ...end, challenge: { id: challenge.id, round: challenge.round } } : end);
    },
    [host, challenge],
  );

  /**
   * A flight ends: crashed, or `left` mid-air (the arcade's Restart or Exit, or leaving the page). A left
   * flight can't be resumed: it still ends, once, with the points it had and uses up its try (so the day
   * counts for the arcade streak), but it doesn't count toward the bests.
   */
  const endFlight = useCallback(
    (s: Sim, left: boolean): Result => {
      const f = flightRef.current;
      const points = runPoints(s);
      const medal = left ? null : medalFor(s.score);
      let newBest = false;
      update((cur) => {
        let next = cur;
        if (!left) {
          newBest = points > cur.best;
          next = {
            ...next,
            best: Math.max(cur.best, points),
            bestPillars: Math.max(cur.bestPillars, s.score),
            feathers: cur.feathers + s.feathers,
            runs: cur.runs + 1,
            medals: medal ? { ...cur.medals, [medal]: (cur.medals[medal] ?? 0) + 1 } : cur.medals,
          };
        }
        if (f.day) next = { ...next, daily: { ...next.daily, [f.day]: dailyAfter(next.daily[f.day], points, s.score, s.feathers, left) } };
        if (f.ch) next = { ...next, challenges: withChallenge(next.challenges, f.ch, { points, pillars: s.score, feathers: s.feathers }) };
        return next;
      });
      reportEnd(f, points, s.score, s.feathers);
      return { points, pillars: s.score, feathers: s.feathers, medal: medalFor(s.score), newBest };
    },
    [update, reportEnd],
  );
  const finish = useCallback((s: Sim) => setResult(endFlight(s, false)), [endFlight]);
  const endRef = useRef(endFlight);
  useEffect(() => {
    endRef.current = endFlight;
  });
  useEffect(() => {
    // Flights left mid-air before a reload: settle them now, once, with nothing (they can't be resumed).
    const cur = readStored() ?? saveRef.current;
    const open = Object.entries(cur.daily).filter(([, d]) => d.open);
    if (open.length) {
      update((c) => {
        const daily = { ...c.daily };
        for (const [d] of open) if (daily[d]?.open) daily[d] = dailyAfter(daily[d], 0, 0, 0, true);
        return { ...c, daily };
      });
      open.forEach(() => host.report({ type: 'end', score: 0, stats: { pillars: 0, feathers: 0 }, daily: true }));
    }
    // A challenge round that opens already over reports its end once (a finished one never again).
    const done = opening?.done;
    const ch = opening?.flight.ch;
    const rec = ch ? cur.challenges[ch] : undefined;
    if (done?.report && ch && !(rec && !rec.open)) {
      update((c) => ({ ...c, challenges: withChallenge(c.challenges, ch, { points: done.points, pillars: done.pillars, feathers: done.feathers }) }));
      reportEnd(opening.flight, done.points, done.pillars, done.feathers);
    }
    // On the way out: settle the flight in the air.
    return () => {
      const s = sim.current;
      if (s?.started && !s.dead && flightRef.current.mode !== 'endless') endRef.current(s, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A new day when the tab comes back; and another tab's flights show here too.
  useEffect(() => {
    const onBack = (): void => {
      if (!document.hidden) setToday(dayKey());
    };
    const onStorage = (e: StorageEvent): void => {
      if (e.key !== KEY && e.key !== null) return;
      const s = loadSave();
      saveRef.current = s;
      setSave(s);
      // A play screen that hasn't taken off yet goes stale when the other tab used the day's flights or
      // flew this challenge round.
      const f = flightRef.current;
      const cur = sim.current;
      if (screen !== 'play' || !cur || cur.started || cur.dead) return;
      if (f.mode === 'daily' && f.day && flightsLeft(s.daily[f.day]) === 0) toMenu();
      const rec = f.ch ? s.challenges[f.ch] : undefined;
      if (rec && !rec.open) {
        cur.dead = true;
        setResult({ points: rec.points, pillars: rec.pillars, feathers: rec.feathers, medal: medalFor(rec.pillars), newBest: false, note: 'This round was flown in another tab.' });
      }
    };
    document.addEventListener('visibilitychange', onBack);
    window.addEventListener('focus', onBack);
    window.addEventListener('storage', onStorage);
    return () => {
      document.removeEventListener('visibilitychange', onBack);
      window.removeEventListener('focus', onBack);
      window.removeEventListener('storage', onStorage);
    };
  }, [screen]);

  // Game loop: fixed steps, drawn every frame between the last two steps. It stops on a still frame
  // (paused, or the bird has landed after a crash) and starts again with the next flight or on resume.
  useEffect(() => {
    if (screen !== 'play') return;
    const c0 = canvas.current;
    if (!c0) return;
    const view = newView();
    let raf = 0;
    let running = false;
    // Size from a ResizeObserver: reading clientWidth in the loop would force a layout every frame.
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      view.cw = entry.contentRect.width;
      view.ch = entry.contentRect.height;
      const s = sim.current;
      if (!running && s && canvas.current) drawFrame(canvas.current, view, s, performance.now() / 1000, 1);
    });
    ro.observe(c0);
    let last = performance.now();
    let acc = 0;
    const frame = (now: number): void => {
      const s = sim.current;
      const c = canvas.current;
      if (!s || !c) return;
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      if (!paused && !document.hidden) {
        acc += dt;
        let steps = 0;
        while (acc >= STEP && steps++ < 24) {
          acc -= STEP;
          const wasDead = s.dead;
          for (const e of step(s)) {
            if (e === 'score') sfx().point();
            else if (e === 'feather') {
              sfx().feather();
              pops.current.push({ dist: s.dist, y: s.y, at: now / 1000 });
            }
            else if (e === 'crash') sfx().crash();
          }
          if (!wasDead && s.dead) {
            deadAt.current = now;
            navigator.vibrate?.(60);
            finish(s);
          }
        }
      }
      if (acc > STEP) acc %= STEP;
      if (pops.current.length) pops.current = pops.current.filter((p) => now / 1000 - p.at < POP_LIFE);
      drawFrame(c, view, s, now / 1000, paused ? 1 : acc / STEP, pops.current);
      // React only hears about the HUD when it changes (a score), never once per frame.
      const h = hudRef.current;
      if (h.score !== s.score || h.feathers !== s.feathers || h.dead !== s.dead || h.started !== s.started) {
        const next = { score: s.score, feathers: s.feathers, dead: s.dead, started: s.started, biome: biomeFor(s.score) };
        hudRef.current = next;
        setHud(next);
      }
      running = !paused && !(s.dead && s.y >= GROUND - BIRD_R);
      if (running) raf = requestAnimationFrame(frame);
    };
    running = true;
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [screen, paused, finish, sfx, flightNo]);

  // The arcade asks for a pause (left full screen / scrolled away).
  const [pauseSeen, setPauseSeen] = useState(pauseKey);
  if (pauseSeen !== pauseKey) {
    setPauseSeen(pauseKey);
    if (screen === 'play' && hud.started && !hud.dead) setPaused(true);
  }
  // Leaving the tab or the app mid-flight pauses it, so the bird doesn't drop the moment it comes back.
  useEffect(() => {
    if (screen !== 'play') return;
    const onHide = (): void => {
      if (document.hidden && sim.current?.started && !sim.current.dead) setPaused(true);
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [screen]);

  const tap = useCallback(() => {
    const s = sim.current;
    if (!s) return;
    if (paused) {
      setPaused(false);
      return;
    }
    if (s.dead) return;
    if (!s.started) {
      // Taking off on the daily course uses up one of the day's flights, even if it is abandoned. Backing
      // out to the menu before the first flap doesn't. Another tab may have used them up meanwhile.
      const f = flightRef.current;
      const cur = readStored() ?? saveRef.current;
      if (f.mode === 'daily' && f.day && flightsLeft(cur.daily[f.day]) === 0) {
        saveRef.current = cur;
        setSave(cur);
        setToday(dayKey());
        setScreen('menu');
        return;
      }
      if (f.ch && cur.challenges[f.ch]) return;
      host.report({ type: 'start' });
      update((c) => {
        let next = c;
        if (f.day) {
          const d = c.daily[f.day];
          // A challenge flight on the daily course settles through its round record, not as an open daily.
          const rec: DailyRec = { best: d?.best ?? 0, tries: (d?.tries ?? 0) + 1, pillars: d?.pillars ?? 0, feathers: d?.feathers ?? 0, ...(f.mode === 'daily' ? { open: true } : {}) };
          next = { ...next, daily: { ...next.daily, [f.day]: rec } };
        }
        if (f.ch) next = { ...next, challenges: withChallenge(next.challenges, f.ch, { points: 0, pillars: 0, feathers: 0, open: true }) };
        return next;
      });
    }
    flap(s);
    sfx().flap();
  }, [paused, host, sfx, update]);

  const settled = (): boolean => performance.now() - deadAt.current > RESULT_GUARD_MS;

  useEffect(() => {
    if (screen !== 'play') return;
    const onKey = (e: KeyboardEvent): void => {
      if (notForGame(e, root.current)) return;
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        if (e.repeat) return;
        if (sim.current?.dead) {
          // A challenge is one flight; outside one, Space flies again (endless once today's flights are used).
          const m = flightRef.current.mode;
          if (settled() && m !== 'challenge') begin(m === 'daily' && flightsLeft(saveRef.current.daily[dayKey()]) === 0 ? 'endless' : m);
        } else tap();
      } else if (e.key === 'p' || e.key === 'Escape') {
        if (e.repeat) return;
        if (sim.current?.started && !sim.current.dead) {
          e.preventDefault();
          setPaused((p) => !p);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen, tap]);

  if (screen === 'menu') return <Menu save={save} today={today} onPlay={begin} onMute={() => update((c) => ({ ...c, muted: !c.muted }))} />;

  const day = flightDay ?? today;
  const daily = save.daily[day];
  const left = flightsLeft(daily);
  const again: Mode = mode === 'daily' && left === 0 ? 'endless' : mode;
  const flying = hud.started && !hud.dead;
  return (
    <div className="wi" ref={root}>
      <canvas ref={canvas} className="wi-canvas" onPointerDown={(e) => (e.button === 0 || e.pointerType !== 'mouse') && tap()} aria-label="Wing It. Tap or press Space to flap." />
      {/* The big number is the points the result and the scoreboard rank; medals and worlds go by gaps. */}
      <div className="wi-hud" aria-live="polite">
        <span className="wi-score" aria-label={`${hud.score + hud.feathers * 3} points`}>
          {hud.score + hud.feathers * 3}
        </span>
        {hud.started && (
          <span className="wi-feathers">
            {gapsText(hud.score)}
            {hud.feathers > 0 && ` · 🪶 ${hud.feathers}`}
          </span>
        )}
      </div>
      {/* In a challenge the round is one flight: no way back to the game's own menu before it is flown. */}
      {(flying || mode !== 'challenge') && (
        <button className="wi-pause" onClick={() => (sim.current?.started && !sim.current.dead ? setPaused((p) => !p) : toMenu())} aria-label={flying ? (paused ? 'Resume' : 'Pause') : 'Menu'}>
          {flying ? (paused ? '▶' : 'II') : '☰'}
        </button>
      )}
      <GameMenuButton className="wi-pause wi-pause-menu" />
      {!hud.started && !hud.dead && (
        <div className="wi-hint" aria-hidden="true">
          <b>{mode === 'challenge' ? `⚔️ Challenge · round ${challenge?.round ?? 1} · one flight` : mode === 'daily' ? `Daily course #${dailyNumber(day)}` : 'Endless'}</b>
          <span>Tap or press Space to flap</span>
        </div>
      )}
      {paused && (
        <button className="wi-overlay" onClick={() => setPaused(false)}>
          Paused · tap to continue
        </button>
      )}
      {hud.dead && result && (
        <div className="wi-over">
          <h2>{result.medal ? `${MEDAL_ICON[result.medal]} ${result.medal[0]!.toUpperCase()}${result.medal.slice(1)}!` : 'Bonk!'}</h2>
          <p className="wi-big">{result.points}</p>
          <p className="wi-muted">
            {gapsText(result.pillars)} · {result.feathers} feather{result.feathers === 1 ? '' : 's'} (+{result.feathers * 3}) {result.newBest ? '· New best!' : `· best ${save.best}`}
          </p>
          <ResultLine line={cardLine(flightLine(result.pillars, result.feathers))} label={`${gapsText(result.pillars)}${result.medal ? `, ${result.medal} medal` : ''}`} />
          {result.note && <p className="wi-muted">{result.note}</p>}
          {mode === 'daily' && daily && (
            <p className="wi-muted">
              {left > 0 ? (
                `Best today ${daily.best} · ${flightsText(left)}`
              ) : (
                <>
                  Best today {daily.best}. That was your last flight. <NextDaily />
                </>
              )}
            </p>
          )}
          <div className="wi-row">
            {mode === 'challenge' && challenge ? (
              <a className="wi-btn wi-btn-go" href={`/c/${challenge.id}`} onClick={openChallengeScores} autoFocus>
                See the scoreboard
              </a>
            ) : (
              <button className="wi-btn wi-btn-go" onClick={() => settled() && begin(again === 'challenge' ? 'endless' : again)} autoFocus>
                {mode === 'daily' && again === 'endless' ? 'Fly endless' : 'Fly again'}
              </button>
            )}
            {mode === 'daily' && daily && left === 0 && <ShareButton text={`Wing It #${dailyNumber(day)} 🐤\n${dailyLine(daily)}\nScore: ${daily.best}\n${window.location.origin}/games/wing-it`} />}
            <button className="wi-btn" onClick={() => settled() && toMenu()}>
              Menu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ShareButton({ text }: { text: string }) {
  const [msg, setMsg] = useState('');
  return (
    <button className="wi-btn" onClick={() => void shareOrCopy({ title: 'Wing It', text }).then((o) => setMsg(o === 'copied' ? 'Copied!' : ''))}>
      {msg || 'Share'}
    </button>
  );
}

function Mascot() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let raf = 0;
    const draw = (now: number): void => {
      const c = ref.current;
      const ctx = c?.getContext('2d');
      if (!c || !ctx) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (c.width !== 140 * dpr) {
        c.width = 140 * dpr;
        c.height = 110 * dpr;
      }
      ctx.setTransform(dpr * 2, 0, 0, dpr * 2, 0, 0);
      ctx.clearRect(0, 0, 70, 55);
      const t = now / 1000;
      drawBird(ctx, 33, 28 + Math.sin(t * 3) * 4, Math.sin(t * 3) * -120, Math.sin(t * 6) > 0.6 ? 0.1 : 0, t, false);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="wi-mascot" width={140} height={110} aria-hidden="true" />;
}

function Menu({ save, today, onPlay, onMute }: { save: Save; today: string; onPlay: (m: Exclude<Mode, 'challenge'>) => void; onMute: () => void }) {
  const daily = save.daily[today];
  const left = flightsLeft(daily);
  const share = daily && daily.best > 0 && (
    <ShareButton text={`Wing It #${dailyNumber(today)} 🐤\n${dailyLine(daily)}\nScore: ${daily.best}\n${window.location.origin}/games/wing-it`} />
  );
  return (
    <div className="wi wi-menu">
      <div className="wi-menu-top">
        <button className="wi-icon" onClick={onMute} aria-label={save.muted ? 'Turn sound on' : 'Turn sound off'}>
          {save.muted ? '🔇' : '🔊'}
        </button>
        <GameMenuButton className="wi-icon" style={{ marginLeft: 8 }} />
      </div>
      <Mascot />
      <h1 className="wi-title">
        Wing <span>It</span>
      </h1>
      <p className="wi-tag">One tap to flap. Thread the gaps. Grab the golden feathers.</p>
      <section className="wi-card">
        <div className="wi-card-head">
          <b>Daily course #{dailyNumber(today)}</b>
          <span>
            {!daily
              ? 'Same course for everyone · best of 3 flights'
              : `${daily.left ? 'Last flight left unfinished · ' : ''}Today: ${daily.best}${left > 0 ? ` · ${flightsText(left)}` : ` · ${dailyLine(daily)}`}`}
          </span>
        </div>
        {left === 0 ? (
          <div className="wi-done">
            {share}
            <NextDaily className="wi-muted" />
          </div>
        ) : (
          <button className="wi-btn wi-btn-go wi-btn-big" onClick={() => onPlay('daily')}>
            {daily ? `Fly again (${flightsText(left)})` : 'Fly today’s course'}
          </button>
        )}
      </section>
      <section className="wi-card">
        <div className="wi-card-head">
          <b>Endless</b>
          <span>A new random sky every flight</span>
        </div>
        <button className="wi-btn wi-btn-big" onClick={() => onPlay('endless')}>
          Fly endless
        </button>
      </section>
      <p className="wi-muted">
        Best {save.best} · {save.runs} flights · 🪶 {save.feathers} · {(['platinum', 'gold', 'silver', 'bronze'] as const).map((m) => `${MEDAL_ICON[m]}${save.medals[m] ?? 0}`).join(' ')}
      </p>
      <p className="wi-muted wi-small">Medals at 10, 25, 50 and 100 gaps. The world changes every 15.</p>
    </div>
  );
}
