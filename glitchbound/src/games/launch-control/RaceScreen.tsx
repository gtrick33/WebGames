import { useEffect, useRef, useState, type RefObject } from 'react';
import { GameMenuButton } from '../../components/GameMenuButton';
import { TRAIT_INFO } from './cars';
import { FAILURE_TEXT } from './parts';
import { LANES, LIGHTS_OFF, type CarLook, type CarState, type LightsState, type Stage3D } from './scene3d';
import { DriverFace } from './ui';
import { MAX_STEP, replay } from './room';
import { canNitro, canShift, DISTANCE, DT, LIGHTS, lightsOf, NITRO_HOLD_S, NITRO_S, Race, RUN_DT, runOut, shiftRpm, type CarSpec, type Driver, type Racer, type RaceResult, type ShiftWindow } from './sim';
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

/** The quickest cars pop a parachute past the line. */
const hasChute = (r: Racer): boolean => r.spec.def.tier >= 6 || r.trap > 69;
/** Past the line a car runs out to a stop in the shutdown area (runOut), instead of freezing on the stripe. */
function coastOf(r: Racer, t: number): { x: number; v: number; chute: number } {
  if (r.phase !== 'done' || r.dnf) return { x: r.x, v: r.dead ? 0 : r.v, chute: 0 };
  const since = Math.max(0, t - (r.launchAt + r.et));
  const chute = hasChute(r);
  const run = runOut(r.trap, chute);
  const f = Math.min(run.x.length - 1, since / RUN_DT);
  const i = Math.floor(f);
  const j = Math.min(run.x.length - 1, i + 1);
  const k = f - i;
  return { x: DISTANCE + run.x[i]! + (run.x[j]! - run.x[i]!) * k, v: run.v[i]! + (run.v[j]! - run.v[i]!) * k, chute: chute ? Math.min(1, Math.max(0, (since - 0.25) / 0.35)) : 0 };
}
/** The fade to the result screen (the result fades in from the same dark: .lc-race::after, .lc-fadein). */
const LEAVE_MS = 380;

/** A big-torque car lifts its nose off the line: up over a third of a second, down by 1.1 s. */
const wheelie = (since: number): number => (since <= 0 ? 0 : since < 0.35 ? Math.sin((since / 0.35) * (Math.PI / 2)) : Math.max(0, 1 - (since - 0.35) / 0.75));

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
  const nosEl = useRef<HTMLDivElement>(null);
  const nosFill = useRef<HTMLElement>(null);
  const linesEl = useRef<HTMLDivElement>(null);
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
    // the button held down (the nitrous fires after NITRO_HOLD_S), and the photo-finish slow motion
    let holdAt = -1;
    let timeScale = 1;
    let slowSaid = false;
    let shownNos = '';
    const hasNos = me.spec.trait === 'nitro' && !live;
    const ev = me.spec.gears === 1;
    // a slow phone drops the pixel ratio a step at a time
    let dpr = Math.min(1.75, window.devicePixelRatio || 1);
    let frameAvg = 16;
    // The finish: your car runs out to a stop while the camera cranes round in front of it, then the
    // screen dips to dark and the result comes up (a tap a moment after the finish goes straight there).
    const crossAt = (): number => (me.phase === 'done' && !me.dnf ? me.launchAt + me.et : -1);
    const myRun = (): ReturnType<typeof runOut> => runOut(me.trap, hasChute(me));
    // the dip to dark runs on the frame clock (rt), and the result comes once it is dark
    let leaveAt = -1;
    const leave = (): void => {
      if (leaveAt >= 0) return;
      leaveAt = rt;
      root.classList.add('is-leaving');
    };
    /** Seconds `t` (race time) into the finish: whether the run-out has played (your car has stopped). */
    const outroDone = (t: number): boolean => {
      const c = crossAt();
      if (c < 0) return t - finishedAt > 2.6;
      return t - finishedAt > 1 && t - c > Math.min(7, myRun().stopT + 0.6);
    };
    /** A tap this long after the finish skips the rest of it (not the taps still landing as you cross). */
    const canSkip = (t: number): boolean => finishedAt >= 0 && t - finishedAt > 0.8 && (crossAt() < 0 || t - crossAt() > 1.2);
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
              if (me.spec.trait === 'pursuit') s.siren();
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
            if (race.racers[e.i]!.spec.gears > 1) stage?.pop(e.i);
            if (e.i === 0 && ev) {
              // an electric's overdrive: a surge, no clutch
              s.surge(e.quality === 'perfect' ? 1 : e.quality === 'ok' ? 0.5 : 0.15);
              if (e.quality === 'perfect') {
                s.perfect();
                stage?.kick(0.7);
                popup('OVERDRIVE!', 'lime');
              } else if (e.quality === 'ok') popup('SURGE', 'cyan');
              else if (e.quality === 'early') popup('EARLY', 'orange');
              else popup('MISSED', 'coral');
            } else if (e.i === 0) {
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
          case 'nitro':
            stage?.kick(e.i === 0 ? 1.4 : 0.4);
            if (e.i === 0) {
              s.nitro();
              popup('NITROUS!', 'cyan');
            }
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
      if (leaveAt >= 0 && rt - leaveAt >= LEAVE_MS / 1000) {
        cancelAnimationFrame(raf);
        raf = 0;
        s.quiet();
        onFinishRef.current(race.result());
        return;
      }
      // the nitrous: the button held down long enough, once the car can take it
      if (hasNos && holdAt >= 0 && rt - holdAt >= NITRO_HOLD_S && canNitro(me)) {
        race.nitro(0);
        holdAt = -1;
      }
      // a photo finish: both cars cross within 0.15 s of each other and time slows right down for it
      // (not live: the friend's phone runs on the same clock)
      const eta = (r: Racer): number => (r.phase === 'done' ? r.launchAt + r.et : race.t + (DISTANCE - r.x) / Math.max(1, r.v));
      const photo = !live && !!rival && race.out && !race.done && me.phase !== 'staging' && rival.phase !== 'staging' && !me.dnf && !rival.dnf && [me, rival].some((r) => r.phase !== 'done' && r.x > DISTANCE - 28) && Math.abs(eta(me) - eta(rival)) < 0.15;
      timeScale += ((photo ? 0.3 : 1) - timeScale) * Math.min(1, dt * (photo ? 10 : 4));
      if (photo && !slowSaid) {
        slowSaid = true;
        say('PHOTO FINISH', 'yellow');
      }
      const simDt = dt * timeScale;
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
          } else if (liveSettled && outroDone((now - live.startPerf) / 1000)) {
            liveSettled = false;
            leave();
          }
        }
        lights = lightsOf(race);
        if (marshalsUp && greenAt >= 0 && clock - greenAt > 2.5) {
          stage?.marshals(false);
          marshalsUp = false;
        }
      } else if (show === 'race' || show === 'done') {
        acc += simDt;
        let steps = 0;
        while (acc >= DT && steps < 24) {
          acc -= DT;
          steps++;
          clock += DT;
          if (race.done) {
            if (finishedAt < 0) finishedAt = clock;
            else if (outroDone(clock)) leave();
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
        // past the line the revs fall with the car
        const revs = show === 'burnout' ? 0.75 + Math.sin(showT * 9) * 0.12 : show === 'intro' ? 0.25 : me.dead ? 0 : crossAt() >= 0 ? 0.15 + 0.6 * (coastOf(me, clock).v / Math.max(1, me.trap)) : me.rpm / me.spec.redline;
        s.engine(revs, me.phase === 'running' || show === 'burnout' ? 1 : 0.3);
      }
      // HUD: the tach shows this gear's window; it moves to a new spot after each shift (an electric's
      // needle is its overdrive charge)
      const frac = Math.min(1.02, shiftRpm(me) / me.spec.redline);
      const shiftable = canShift(me);
      const win = shiftable ? race.windowOf(0) : null;
      const hot = !!win && frac >= win.lo && frac <= win.hi;
      const gearKey = me.phase === 'staging' || me.phase === 'done' ? -1 : ev ? me.stage : me.gear;
      if (gearKey !== shownGear) {
        shownGear = gearKey;
        if (face.current) face.current.style.background = tachRing(gearKey > 0 ? race.windowOf(0) : null);
      }
      const st: StripState = show !== 'race' && show !== 'done' ? 'launch' : me.phase === 'staging' ? (race.out && !me.jumped ? 'go' : 'launch') : me.phase === 'done' ? 'done' : me.phase === 'shifting' || shiftable ? 'shift' : 'top';
      if (st !== shownState) {
        shownState = st;
        root.dataset.state = st;
        if (shiftBtn.current) shiftBtn.current.textContent = st === 'launch' || st === 'go' ? 'LAUNCH' : ev ? 'BOOST' : 'SHIFT';
      }
      // the nitrous gauge: waiting for second gear, ready (hold), filling while held, burning, spent
      if (hasNos && nosEl.current) {
        const holding = holdAt >= 0 && canNitro(me);
        const ns = me.nitroLeft > 0 ? 'burn' : me.nitroUsed ? 'used' : holding ? 'hold' : canNitro(me) ? 'ready' : 'wait';
        if (ns !== shownNos) {
          shownNos = ns;
          nosEl.current.dataset.state = ns;
        }
        if (nosFill.current) nosFill.current.style.transform = `scaleX(${ns === 'burn' ? me.nitroLeft / NITRO_S : ns === 'hold' ? Math.min(1, (rt - holdAt) / NITRO_HOLD_S) : ns === 'used' ? 0 : 1})`;
      }
      // speed lines past 120 km/h, thicker on the nitrous
      if (linesEl.current) {
        const k = Math.max(0, Math.min(1, (me.v - 33) / 45)) * (me.phase === 'done' ? Math.max(0, 1 - (clock - me.launchAt - me.et)) : 1);
        linesEl.current.style.opacity = (k * 0.5 + (me.nitroLeft > 0 ? 0.35 : 0)).toFixed(3);
        if (k > 0) linesEl.current.style.transform = `rotate(${((rt * 97) % 7).toFixed(2)}deg)`;
      }
      root.dataset.hot = hot ? '1' : '';
      if (lightsEl.current) {
        lightsEl.current.dataset.on = String(race.out ? 0 : race.lightsOn);
        lightsEl.current.dataset.show = (show === 'race' || show === 'done') && (!race.out || clock - greenAt < 0.7) ? '1' : '';
      }
      const coastV = crossAt() >= 0 ? coastOf(me, clock).v : -1;
      if (needle.current) needle.current.style.transform = `rotate(${-135 + Math.min(1.02, show === 'burnout' ? 0.72 + Math.sin(showT * 9) * 0.1 : coastV >= 0 ? 0.15 + 0.6 * (coastV / Math.max(1, me.trap)) : ev && shiftable ? me.charge : me.rpm / me.spec.redline) * SWEEP}deg)`;
      if (speedEl.current) speedEl.current.textContent = String(Math.round((coastV >= 0 ? coastV : me.v) * 3.6));
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
      if (shiftBtn.current) shiftBtn.current.classList.toggle('is-idle', !shiftable && st !== 'go' && !(hasNos && canNitro(me)));
      // how far into the next sim step this frame is
      const alpha = show !== 'race' && show !== 'done' ? 1 : Math.min(1, Math.max(0, live ? (now - live.startPerf) / 1000 / DT - stepsDone : acc / DT));
      const tNow = clock + alpha * DT;
      const state = (r: typeof me, i: number): CarState => {
        const c = coastOf(r, tNow);
        const racing = r.phase !== 'staging' && r.phase !== 'done';
        return {
          x: r.phase === 'done' ? c.x : prevX[i]! + (r.x - prevX[i]!) * alpha,
          v: c.v,
          rpm: r.rpm,
          redline: r.spec.redline,
          spinning: r.spinLeft > 0 || show === 'burnout',
          dead: r.dead,
          lift: r.spec.trait === 'torque' && r.phase !== 'staging' && r.launchQ !== 'jump' ? wheelie(tNow - r.launchAt) : 0,
          nitro: r.nitroLeft > 0,
          siren: r.spec.trait === 'pursuit' && (racing || r.phase === 'done'),
          chute: c.chute,
        };
      };
      // once a tap can skip the rest of the finish, say so
      const skip = race.done && leaveAt < 0 && canSkip(live ? (now - live.startPerf) / 1000 : clock) ? '1' : '';
      if (root.dataset.skip !== skip) root.dataset.skip = skip;
      const crossed = crossAt();
      const outro = crossed >= 0 ? { p: (tNow - crossed) / Math.max(2.2, myRun().stopT * 0.7), stopX: DISTANCE + myRun().stopX } : null;
      stage?.renderRace(race.racers.map(state), lights, rt, simDt, undefined, { excite, intro: show === 'intro' ? showT / INTRO_S : null, outro });
    };
    raf = requestAnimationFrame(frame);

    const tap = (): void => {
      if (race.done && canSkip(live ? (performance.now() - live.startPerf) / 1000 : clock)) {
        leave();
        return;
      }
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
        holdAt = rt;
      }
    };
    const keyUp = (e: KeyboardEvent): void => {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'Enter' || e.code === 'KeyW') holdAt = -1;
    };
    const release = (): void => {
      holdAt = -1;
    };
    const pdown = (e: PointerEvent): void => {
      // buttons on the race screen are not taps on the strip (the menu one pauses the race itself)
      if ((e.target as HTMLElement).closest('.lc-pause, .lc-overlay, .game-menu-btn')) return;
      e.preventDefault();
      tap();
      holdAt = rt;
    };
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    window.addEventListener('blur', release);
    root.addEventListener('pointerdown', pdown);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      window.removeEventListener('blur', release);
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
      <div ref={linesEl} className="lc-speedlines" aria-hidden="true" />
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
              <em className="lc-vs-trait">
                {TRAIT_INFO[plan.specs[0]!.trait].icon} {TRAIT_INFO[plan.specs[0]!.trait].name}
              </em>
            </div>
            <div className="lc-vs-mark">VS</div>
            <div className="lc-vs-side is-rival">
              {rivalLook && <DriverFace helmet={rivalLook.helmet} suit={rivalLook.suit} size={72} badge className="lc-vs-face" />}
              <small className="mono">{plan.tagline ?? 'RIVAL'}</small>
              <b>{rivalName}</b>
              <span>{rivalCar}</span>
              {plan.specs[1] && (
                <em className="lc-vs-trait">
                  {TRAIT_INFO[plan.specs[1].trait].icon} {TRAIT_INFO[plan.specs[1].trait].name}
                </em>
              )}
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
          {plan.specs[0]!.trait === 'nitro' && !plan.live && (
            <div ref={nosEl} className="lc-nos" data-state="wait">
              <b className="mono">NOS</b>
              <span className="lc-nos-bar">
                <i ref={nosFill} />
              </span>
              <small className="lc-nos-hint">hold</small>
            </div>
          )}
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
      <p className="lc-continue mono" aria-hidden="true">
        Tap to continue
      </p>
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
