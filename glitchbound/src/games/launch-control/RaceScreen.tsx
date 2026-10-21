import { useEffect, useRef, useState, type RefObject } from 'react';
import { GameMenuButton } from '../../components/GameMenuButton';
import { FAILURE_TEXT } from './parts';
import { LANES, LIGHTS_OFF, type CarLook, type CarState, type LightsState, type Stage3D } from './scene3d';
import { DriverFace } from './ui';
import { MAX_STEP, replay } from './room';
import { DISTANCE, DT, LIGHTS, lightsOf, Race, shiftRpm, type CarSpec, type Driver, type RaceResult, type ShiftWindow } from './sim';
import type { Sfx } from './sound';
import { fmtEt } from './util';

export interface RacePlan {
  specs: CarSpec[];
  drivers: Driver[];
  looks: CarLook[];
  names: string[];
  env: string;
  seed: number;
  /** A line under the rival's name in the intro (a difficulty, "Gauntlet round 4", "ghost"). */
  tagline?: string;
  /** A live race against a friend (both drivers live; car 1 is driven by the friend's taps from the room). */
  live?: LiveLink;
}

/**
 * The link to a live room during a race. The race clock starts at `startPerf` on every phone; taps
 * travel as the sim step they were applied at, so each phone replays the other's run exactly.
 */
export interface LiveLink {
  /** When the race clock starts, in the room's time (ms since 1970). */
  startAt: number;
  /** The room's clock minus this phone's (from the room's messages). */
  skew: number;
  /** One of your taps, as the step it was applied at. */
  send: (step: number) => void;
  /** Your car is done (finished or out of time): your whole list of taps. */
  finish: (taps: number[]) => void;
}

/** The tach sweeps 270 degrees, from bottom-left to bottom-right. */
const SWEEP = 270;
const NEUTRAL = 'rgba(255,255,255,0.14)';
const YELLOW = '#ffd12e';
const GREEN = '#3dff7a';
const RED = '#ff3b4e';
/** The tach's ring: this gear's window in green with yellow either side and red above (no window: red at the top). */
function tachRing(w: ShiftWindow | null): string {
  const a = (f: number): string => `${(SWEEP * f).toFixed(1)}deg`;
  if (!w) return `conic-gradient(from 225deg, ${NEUTRAL} 0deg ${a(0.985)}, ${RED} ${a(0.985)} ${a(1)}, transparent ${a(1)} 360deg)`;
  return `conic-gradient(from 225deg, ${NEUTRAL} 0deg ${a(w.okLo)}, ${YELLOW} ${a(w.okLo)} ${a(w.lo)}, ${GREEN} ${a(w.lo)} ${a(w.hi)}, ${YELLOW} ${a(w.hi)} ${a(w.okHi)}, ${RED} ${a(w.okHi)} ${a(1)}, transparent ${a(1)} 360deg)`;
}

/** The pre-race show before the clock runs: the intro orbit with the match-up, then burnouts. */
const INTRO_S = 3.2;
const BURNOUT_S = 1.8;
type Phase = 'intro' | 'burnout' | 'race' | 'done';
type StripState = 'launch' | 'go' | 'shift' | 'top' | 'done';

/**
 * The race: the shared 3D stage (an intro orbit, burnouts, then the chase camera), a HUD updated
 * through refs every frame (no React renders per frame), and one input: tap anywhere, the big
 * button or Space. Tap at lights out to launch, then each time the needle is in this gear's green.
 */
export function RaceScreen({ plan, remoteTaps, stageRef, paused, setPaused, onFinish, sfx, nudge: nudgeAtStart, onStart }: { plan: RacePlan; /** Live: the friend's taps so far (sim steps). */ remoteTaps?: readonly number[]; stageRef: RefObject<Stage3D | null>; paused: boolean; setPaused: (p: boolean) => void; onFinish: (r: RaceResult) => void; sfx: () => Sfx; nudge: boolean; onStart: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(paused);
  const onFinishRef = useRef(onFinish);
  const setPausedRef = useRef(setPaused);
  const onStartRef = useRef(onStart);
  const remoteRef = useRef<readonly number[]>(remoteTaps ?? []);
  const [phase, setPhase] = useState<Phase>('intro');
  const [pop, setPop] = useState<{ text: string; tone: string; key: number } | null>(null);
  const [banner, setBanner] = useState<{ text: string; sub?: string; tone: string; key: number } | null>(null);
  const [nudge, setNudge] = useState(nudgeAtStart);
  const face = useRef<HTMLDivElement>(null);
  const needle = useRef<HTMLDivElement>(null);
  const speedEl = useRef<HTMLSpanElement>(null);
  const gearEl = useRef<HTMLSpanElement>(null);
  const timeEl = useRef<HTMLSpanElement>(null);
  const posEl = useRef<HTMLSpanElement>(null);
  const gapEl = useRef<HTMLSpanElement>(null);
  const dots = useRef<(HTMLSpanElement | null)[]>([]);
  const shiftBtn = useRef<HTMLButtonElement>(null);
  const lightsEl = useRef<HTMLDivElement>(null);
  const skipRef = useRef<() => void>(() => undefined);
  useEffect(() => {
    pausedRef.current = paused;
    onFinishRef.current = onFinish;
    setPausedRef.current = setPaused;
    onStartRef.current = onStart;
    remoteRef.current = remoteTaps ?? [];
  });
  useEffect(() => {
    if (!nudge) return;
    const id = window.setTimeout(() => setNudge(false), 3500);
    return () => window.clearTimeout(id);
  }, [nudge]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const stage = stageRef.current;
    stage?.setEnv(plan.env);
    for (let i = 0; i < LANES; i++) stage?.setCar(i, plan.looks[i] ?? null);
    let race = new Race(plan.specs, plan.drivers, plan.seed);
    let me = race.racers[0]!;
    let rival = race.racers[1];
    // where each car was before the last sim step: frames draw the cars between the two (the sim
    // steps at 120 Hz, frames come when they come; without this the cars judder)
    const prevX = race.racers.map((r) => r.x);
    const stepRace = (): ReturnType<Race['step']> => {
      race.racers.forEach((r, i) => (prevX[i] = r.x));
      return race.step();
    };
    const live = plan.live && { ...plan.live, startPerf: performance.now() + (plan.live.startAt - (Date.now() + plan.live.skew)) };
    // live: the steps run so far, your taps, and how many of the friend's taps are in
    let stepsDone = 0;
    const myTaps: number[] = [];
    let remoteIn = 0;
    let sentFinish = false;
    let liveSettled = false;
    /** A friend's tap from the past arrived (the network is slower than a frame): replay the race with it. */
    const resim = (): void => {
      const remote = remoteRef.current;
      race = replay(new Race(plan.specs, plan.drivers, plan.seed), [myTaps, remote], stepsDone);
      me = race.racers[0]!;
      rival = race.racers[1];
      race.racers.forEach((r, i) => (prevX[i] = r.x));
      remoteIn = remote.filter((k) => k < stepsDone).length;
    };
    // the show before the race clock: intro, then burnouts (taps skip ahead)
    let show: Phase = 'intro';
    let showT = 0;
    /** Render time: never jumps back (smoke and pops are timed with it). */
    let rt = 0;
    let clock = 0;
    let acc = 0;
    let last = 0;
    let raf = 0;
    let finishedAt = -1;
    let audioAt = 0;
    let key = 0;
    let started = false;
    let greenAt = -1;
    let shownGear = -2;
    let shownState = '';
    let excite = 0.15;
    let finishCheer = 0;
    let marshalsUp = false;
    // a slow phone drops the pixel ratio a step at a time
    let dpr = Math.min(1.75, window.devicePixelRatio || 1);
    let frameAvg = 16;
    let adaptAt = 0;
    stage?.setPixelRatio(dpr);
    const s = sfx();
    s.voice(plan.looks[0]?.def);
    const popup = (text: string, tone: string): void => setPop({ text, tone, key: ++key });
    const say = (text: string, tone: string, sub?: string): void => setBanner({ text, sub, tone, key: ++key });
    const toPhase = (p: Phase): void => {
      show = p;
      showT = 0;
      setPhase(p);
      if (p === 'burnout') {
        s.burnout();
        say('BURNOUT', 'orange');
      }
      if (p === 'race') say('STAGED', 'cyan', 'Five red lights: launch the moment they go out');
    };
    skipRef.current = () => {
      if (show === 'intro') toPhase('burnout');
      else if (show === 'burnout') toPhase('race');
    };
    s.cheer(0.25);

    const onEvents = (evs: ReturnType<Race['step']>): void => {
      for (const e of evs) {
        switch (e.type) {
          case 'light':
            s.amber();
            // the five lights are on the gantry and in the HUD; the staging banner makes way
            if (e.n === 1) setBanner(null);
            break;
          case 'out':
            s.green();
            // the staging loop cuts dead: from here it is all engine and crowd
            s.music('off');
            greenAt = clock;
            if (!me.jumped) say('GO!', 'lime');
            stage?.marshals(true);
            marshalsUp = true;
            break;
          case 'jump':
            if (e.i === 0) {
              s.red();
              say('JUMP START', 'coral', 'Too early: you go late');
            }
            break;
          case 'launch':
            if (e.i === 0) {
              if (!started) {
                started = true;
                onStartRef.current();
              }
              stage?.kick(e.quality === 'perfect' ? 1.3 : 0.8);
              s.cheer(e.quality === 'perfect' ? 0.9 : 0.6);
              if (e.quality === 'perfect') {
                s.perfect();
                popup('PERFECT LAUNCH!', 'lime');
              } else if (e.quality === 'good') popup('GOOD LAUNCH', 'cyan');
              else if (e.quality === 'slow') popup('SLOW START', 'orange');
              setBanner((b) => (b && b.text === 'GO!' ? null : b));
            }
            break;
          case 'spin':
            if (e.i === 0) {
              s.squeal();
              popup('WHEELSPIN', 'orange');
            }
            break;
          case 'zone':
            if (e.i === 0) s.cue();
            break;
          case 'tooEarly':
            if (e.i === 0) {
              s.nope();
              popup('TOO EARLY', 'orange');
            }
            break;
          case 'shift':
            stage?.pop(e.i);
            if (e.i === 0) {
              s.shift();
              s.pop();
              if (e.quality === 'perfect') {
                s.perfect();
                stage?.kick(0.55);
                popup('PERFECT!', 'lime');
              } else if (e.quality === 'ok') popup('GOOD', 'cyan');
              else if (e.quality === 'early') popup('EARLY', 'orange');
              else popup('LATE', 'coral');
            }
            break;
          case 'limiter':
            if (e.i === 0) s.limiter();
            break;
          case 'fail':
            if (e.i === 0) {
              s.fail();
              say('BREAKDOWN', 'coral', FAILURE_TEXT[e.part]);
            }
            break;
          case 'finish':
            if (e.i === 0 && live) {
              s.finish(true);
              stage?.kick(0.5);
              say('FINISH', 'cyan', `${fmtEt(me.et)} s · ${Math.round(me.trap * 3.6)} km/h`);
            } else if (e.i === 0) {
              const beat = rival && rival.phase === 'done' && !rival.dnf && rival.reaction + rival.et < me.reaction + me.et;
              const won = !beat;
              s.finish(won);
              s.cheer(won ? 1 : 0.5);
              stage?.kick(0.5);
              finishCheer = won ? 1 : 0.5;
              if (won) stage?.confetti(0);
              say(won ? 'YOU WIN!' : 'BEATEN', won ? 'lime' : 'yellow', `${fmtEt(me.et)} s · ${Math.round(me.trap * 3.6)} km/h`);
            }
            break;
        }
      }
    };

    const frame = (now: number): void => {
      raf = requestAnimationFrame(frame);
      // about 60 frames a second: a 120 Hz screen would draw every frame twice for nothing
      if (last && now - last < 14) return;
      if (!last) last = now;
      const realDt = now - last;
      let dt = realDt / 1000;
      last = now;
      if (!live && (pausedRef.current || document.hidden)) {
        s.quiet();
        return;
      }
      // stalls (a background tab, a hidden window) say nothing about the device: skip them
      if (realDt < 120) frameAvg = frameAvg * 0.95 + realDt * 0.05;
      if (now - adaptAt > 1500 && frameAvg > 24 && dpr > 0.8) {
        adaptAt = now;
        dpr = Math.max(0.75, dpr - 0.25);
        stage?.setPixelRatio(dpr);
      }
      dt = Math.min(dt, 0.1);
      showT += dt;
      rt += dt;
      let lights: LightsState = LIGHTS_OFF;
      if (live && (show === 'intro' || show === 'burnout')) {
        // live: the show runs on the room's clock, the same on both phones
        const toGo = (live.startPerf - now) / 1000;
        if (toGo <= 0) toPhase('race');
        else if (toGo <= BURNOUT_S && show === 'intro') toPhase('burnout');
        showT = show === 'intro' ? Math.max(0, INTRO_S - (toGo - BURNOUT_S)) : BURNOUT_S - toGo;
      }
      if (show === 'intro') {
        if (showT >= INTRO_S) toPhase('burnout');
      } else if (show === 'burnout') {
        if (showT >= BURNOUT_S) toPhase('race');
      }
      if (live && (show === 'race' || show === 'done')) {
        const remote = remoteRef.current;
        if (remote.length > remoteIn && remote[remoteIn]! < stepsDone) resim();
        const target = Math.min(MAX_STEP, Math.floor((now - live.startPerf) / 1000 / DT));
        // a long catch-up (the phone slept) skips the banners it would have shown
        if (target - stepsDone > 24 && !race.done) setBanner(null);
        while (stepsDone < target) {
          while (remoteIn < remote.length && remote[remoteIn]! <= stepsDone) {
            race.tap(1);
            remoteIn++;
          }
          const evs = stepRace();
          stepsDone++;
          // catching up after the phone slept: only the last moments make noise
          if (target - stepsDone < 24) onEvents(evs);
        }
        clock = stepsDone * DT;
        if (me.phase === 'done' && !sentFinish) {
          sentFinish = true;
          live.finish([...myTaps]);
        }
        if (race.done) {
          if (finishedAt < 0) {
            finishedAt = clock;
            const res = race.result();
            const deadHeat = res.margin < 0.0005 && res.racers.every((r) => r.crossed !== null);
            const won = res.winner === 0 && !deadHeat;
            liveSettled = true;
            s.cheer(won ? 1 : 0.5);
            finishCheer = won ? 1 : 0.5;
            if (won) stage?.confetti(0);
            say(won ? 'YOU WIN!' : deadHeat ? 'DEAD HEAT' : res.winner === null ? 'NO WINNER' : 'BEATEN', won ? 'lime' : 'yellow', res.margin > 0 && !deadHeat ? `by ${res.margin.toFixed(3)} s` : undefined);
          } else if ((now - live.startPerf) / 1000 - finishedAt > 2.6 && liveSettled) {
            liveSettled = false;
            onFinishRef.current(race.result());
          }
        }
        lights = lightsOf(race);
        if (marshalsUp && greenAt >= 0 && clock - greenAt > 2.5) {
          stage?.marshals(false);
          marshalsUp = false;
        }
      } else if (show === 'race' || show === 'done') {
        acc += dt;
        let steps = 0;
        while (acc >= DT && steps < 24) {
          acc -= DT;
          steps++;
          clock += DT;
          if (race.done) {
            if (finishedAt < 0) finishedAt = clock;
            else if (clock - finishedAt > 2.6) {
              cancelAnimationFrame(raf);
              raf = 0;
              s.quiet();
              onFinishRef.current(race.result());
              return;
            }
            continue;
          }
          onEvents(stepRace());
        }
        lights = lightsOf(race);
        if (marshalsUp && greenAt >= 0 && clock - greenAt > 2.5) {
          stage?.marshals(false);
          marshalsUp = false;
        }
      }
      // the crowd: building through the show, roaring at lights out, again at the finish
      const goal = show === 'intro' ? 0.2 : show === 'burnout' ? 0.45 : greenAt < 0 ? 0.5 : Math.max(0.3, 1 - (clock - greenAt) * 0.3, me.x > DISTANCE - 80 ? 0.8 : 0, finishCheer);
      excite += (goal - excite) * Math.min(1, dt * 3);
      finishCheer = Math.max(0, finishCheer - dt * 0.15);
      if (clock - audioAt > 0.05 || show !== 'race') {
        audioAt = clock;
        const revs = show === 'burnout' ? 0.75 + Math.sin(showT * 9) * 0.12 : show === 'intro' ? 0.25 : me.dead ? 0 : me.rpm / me.spec.redline;
        s.engine(revs, me.phase === 'running' || show === 'burnout' ? 1 : 0.3);
      }
      // HUD: the tach shows this gear's window; it moves to a new spot after each shift
      const frac = Math.min(1.02, shiftRpm(me) / me.spec.redline);
      const canShift = me.phase === 'running' && me.gear < me.spec.gears && !me.stuck && !me.dead;
      const win = canShift ? race.windowOf(0) : null;
      const hot = !!win && frac >= win.lo && frac <= win.hi;
      const gearKey = me.phase === 'staging' || me.phase === 'done' ? -1 : me.gear;
      if (gearKey !== shownGear) {
        shownGear = gearKey;
        if (face.current) face.current.style.background = tachRing(gearKey > 0 ? race.windowOf(0) : null);
      }
      const st: StripState = show !== 'race' && show !== 'done' ? 'launch' : me.phase === 'staging' ? (race.out && !me.jumped ? 'go' : 'launch') : me.phase === 'done' ? 'done' : me.gear >= me.spec.gears || me.stuck ? 'top' : 'shift';
      if (st !== shownState) {
        shownState = st;
        root.dataset.state = st;
        if (shiftBtn.current) shiftBtn.current.textContent = st === 'launch' || st === 'go' ? 'LAUNCH' : 'SHIFT';
      }
      root.dataset.hot = hot ? '1' : '';
      if (lightsEl.current) {
        lightsEl.current.dataset.on = String(race.out ? 0 : race.lightsOn);
        lightsEl.current.dataset.show = (show === 'race' || show === 'done') && (!race.out || clock - greenAt < 0.7) ? '1' : '';
      }
      if (needle.current) needle.current.style.transform = `rotate(${-135 + Math.min(1.02, (show === 'burnout' ? 0.72 + Math.sin(showT * 9) * 0.1 : me.rpm / me.spec.redline)) * SWEEP}deg)`;
      if (speedEl.current) speedEl.current.textContent = String(Math.round(me.v * 3.6));
      if (gearEl.current) gearEl.current.textContent = me.spec.gears === 1 ? 'D' : me.phase === 'staging' ? 'N' : String(me.gear);
      if (timeEl.current) timeEl.current.textContent = me.phase === 'staging' ? '0.000' : me.phase === 'done' && !me.dnf ? fmtEt(me.et) : fmtEt(Math.max(0, clock - me.launchAt));
      race.racers.forEach((r, i) => {
        const d = dots.current[i];
        if (d) d.style.left = `${Math.min(100, (r.x / DISTANCE) * 100)}%`;
      });
      const ahead = rival ? (me.phase === 'done' && rival.phase === 'done' ? me.reaction + me.et <= rival.reaction + rival.et : me.x >= rival.x) : true;
      if (posEl.current) posEl.current.textContent = ahead ? 'P1' : 'P2';
      if (gapEl.current && rival) {
        const g = me.x - rival.x;
        gapEl.current.textContent = me.phase === 'staging' ? 'staged' : `${g >= 0 ? '+' : '−'}${Math.abs(g).toFixed(1)} m`;
        gapEl.current.dataset.ahead = g >= 0 ? '1' : '';
      }
      if (shiftBtn.current) shiftBtn.current.classList.toggle('is-idle', !canShift && st !== 'go');
      // how far into the next sim step this frame is
      const alpha = show !== 'race' && show !== 'done' ? 1 : Math.min(1, Math.max(0, live ? (now - live.startPerf) / 1000 / DT - stepsDone : acc / DT));
      const state = (r: typeof me, i: number): CarState => ({ x: prevX[i]! + (r.x - prevX[i]!) * alpha, v: r.v, rpm: r.rpm, redline: r.spec.redline, spinning: r.spinLeft > 0 || show === 'burnout', dead: r.dead });
      stage?.renderRace(race.racers.map(state), lights, rt, dt, undefined, { excite, intro: show === 'intro' ? showT / INTRO_S : null });
    };
    raf = requestAnimationFrame(frame);

    const tap = (): void => {
      if (live) {
        if (show !== 'race' && show !== 'done') return;
        if (me.phase === 'done') return;
        myTaps.push(stepsDone);
        live.send(stepsDone);
        race.tap(0);
        return;
      }
      if (pausedRef.current) return;
      if (show === 'intro' || show === 'burnout') {
        skipRef.current();
        return;
      }
      race.tap(0);
    };
    const keyDown = (e: KeyboardEvent): void => {
      if (e.code === 'Escape' || e.code === 'KeyP') {
        // a live race can't be paused: the friend's phone keeps racing
        if (live) return;
        e.preventDefault();
        setPausedRef.current(!pausedRef.current);
        return;
      }
      if ((e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'Enter' || e.code === 'KeyW') && !e.repeat) {
        e.preventDefault();
        tap();
      }
    };
    const pdown = (e: PointerEvent): void => {
      // buttons on the race screen are not taps on the strip (the menu one pauses the race itself)
      if ((e.target as HTMLElement).closest('.lc-pause, .lc-overlay, .game-menu-btn')) return;
      e.preventDefault();
      tap();
    };
    window.addEventListener('keydown', keyDown);
    root.addEventListener('pointerdown', pdown);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('keydown', keyDown);
      root.removeEventListener('pointerdown', pdown);
      s.quiet();
      stage?.marshals(false);
      stage?.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    };
    // One race per mount: the plan is fixed for its lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const meName = plan.names[0] ?? 'You';
  const rivalName = plan.names[1] ?? 'Rival';
  const meCar = plan.specs[0]!.def.name;
  const rivalCar = plan.specs[1]?.def.name ?? '';
  const meLook = plan.looks[0]!;
  const rivalLook = plan.looks[1];
  return (
    <div ref={rootRef} className="lc-race" data-phase={phase} data-state="launch" aria-label="Drag race. Five red lights come on; tap or press Space the moment they go out to launch, then each time the needle is in the green zone to shift.">
      <div className="lc-hud" aria-hidden="true">
        <div className="lc-hud-top">
          <div className="lc-plate is-you">
            <span ref={posEl} className="lc-plate-pos mono">
              P1
            </span>
            <DriverFace helmet={meLook.helmet} suit={meLook.suit} size={38} badge />
            <span className="lc-plate-text">
              <b>{meName}</b>
              <small>{meCar}</small>
            </span>
          </div>
          <div className="lc-clock">
            <span ref={timeEl} className="mono">
              0.000
            </span>
            <div className="lc-progress">
              {plan.names.map((n, i) => (
                <span
                  key={n + i}
                  ref={(el) => {
                    dots.current[i] = el;
                  }}
                  className={`lc-dot${i === 0 ? ' is-you' : ''}`}
                />
              ))}
              <i className="lc-progress-flag" />
            </div>
          </div>
          {plan.specs.length > 1 && (
            <div className="lc-plate is-rival">
              {rivalLook && <DriverFace helmet={rivalLook.helmet} suit={rivalLook.suit} size={38} badge />}
              <span className="lc-plate-text">
                <b>{rivalName}</b>
                <small>{rivalCar}</small>
              </span>
              <span ref={gapEl} className="lc-plate-gap mono">
                staged
              </span>
            </div>
          )}
        </div>
        {phase === 'intro' && (
          <div className="lc-vs" key="vs">
            <div className="lc-vs-side is-you">
              <DriverFace helmet={meLook.helmet} suit={meLook.suit} size={72} badge className="lc-vs-face" />
              <small className="mono">YOU</small>
              <b>{meName}</b>
              <span>{meCar}</span>
            </div>
            <div className="lc-vs-mark">VS</div>
            <div className="lc-vs-side is-rival">
              {rivalLook && <DriverFace helmet={rivalLook.helmet} suit={rivalLook.suit} size={72} badge className="lc-vs-face" />}
              <small className="mono">{plan.tagline ?? 'RIVAL'}</small>
              <b>{rivalName}</b>
              <span>{rivalCar}</span>
            </div>
            {!plan.live && <p className="lc-vs-skip mono">Tap to skip</p>}
          </div>
        )}
        <div ref={lightsEl} className="lc-f1" data-on="0">
          {Array.from({ length: LIGHTS }, (_, k) => (
            <span key={k} className="lc-f1-pod">
              <i />
              <i />
            </span>
          ))}
        </div>
        {pop && (
          <div key={pop.key} className="lc-pop" data-tone={pop.tone}>
            {pop.text}
          </div>
        )}
        {banner && phase !== 'intro' && (
          <div key={banner.key} className="lc-banner" data-tone={banner.tone}>
            <b>{banner.text}</b>
            {banner.sub && <span>{banner.sub}</span>}
          </div>
        )}
        <div className="lc-hud-bottom">
          <div className="lc-tach">
            <div ref={face} className="lc-tach-ring" style={{ background: tachRing(null) }} />
            <div className="lc-tach-face">
              <div ref={needle} className="lc-needle" />
              <span ref={gearEl} className="lc-gear mono">
                N
              </span>
              <span ref={speedEl} className="lc-speed mono">
                0
              </span>
              <small className="mono">km/h</small>
            </div>
          </div>
        </div>
      </div>
      {!plan.live && (
        <button className="lc-pause" onClick={() => setPaused(true)} aria-label="Pause">
          <span />
          <span />
        </button>
      )}
      <GameMenuButton className="lc-icon lc-race-menu" />
      <button ref={shiftBtn} className="lc-shift is-idle" aria-label="Launch and shift" tabIndex={-1}>
        LAUNCH
      </button>
      {nudge && (
        <div className="lc-nudge" role="status">
          <span className="lc-nudge-phone" aria-hidden="true" />
          Turn your phone sideways for the full view
        </div>
      )}
    </div>
  );
}
