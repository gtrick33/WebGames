/**
 * The race: a quarter mile for up to five cars, stepped at a fixed rate. Pure and deterministic:
 * the same cars, drivers and seed always give the same race (the daily, friends' ghosts and the
 * tests rely on it). The player's one button launches at lights out and then shifts: each gear has its
 * own shift window (green, with yellow either side, red above), at a seeded random spot and size,
 * the same for every car in the race.
 * A driver is live (the player's taps), a policy (an AI with a skill level) or a script (recorded
 * taps: a ghost).
 */
import type { CarDef } from './cars';
import { effectsOf, PARTS, failChance, type Condition, type Levels, type PartId } from './parts';
import { clamp, rng } from './util';

export const DT = 1 / 120;
/** A quarter mile, metres. */
export const DISTANCE = 402.336;
export const MAX_RACERS = 5;
/** Nobody takes longer than this (the lights included): the race ends. */
export const MAX_TIME = 36;
/**
 * The start, as in Formula 1: both cars are staged at t = 0, five red lights come on one a second,
 * and with all five lit they go out after a random wait (seeded, 0 to 3 s): lights out and away.
 */
export const LIGHTS = 5;
/** The first red light comes on this long after the cars are staged; the others follow one a second. */
export const FIRST_LIGHT = 1.0;
export const LIGHT_GAP = 1.0;
/** With all five lit, the lights go out after a random wait from none to this long (the start: no rhythm to guess). */
export const OUT_HOLD_MAX = 3;
/** A live driver who never taps launches this long after lights out anyway. */
export const AUTO_LAUNCH = 1.0;
/** Tapping while the red lights are on is a jump start: the car goes this long after lights out, bogged. */
export const JUMP_PENALTY = 0.6;
/** Reaction times (s) for a perfect and a good launch (no rhythm to anticipate, so a little kinder than a drag tree). */
export const LAUNCH_PERFECT = 0.3;
export const LAUNCH_GOOD = 0.5;
export const IDLE_RPM = 900;
const G = 9.81;
const AIR = 1.2;
const WHEEL_R = 0.33;
const MU = 1.4;
/** Game physics: everything pulls harder than a real car, so a stock starter runs ~14 s and a dragster ~6 s. */
const BOOST = 1.5;
const DRIVE_SHARE = { rwd: 0.7, awd: 1.0, fwd: 0.5 } as const;
/** Weight transfer at the launch: the nose lifts, so rear-drivers gain grip. */
const LAUNCH_SHARE = { rwd: 1.3, awd: 1.05, fwd: 1.0 } as const;

/** A car resolved with its parts: what the simulation drives. */
export interface CarSpec {
  id: string;
  name: string;
  mass: number;
  drive: CarDef['drive'];
  gears: number;
  redline: number;
  peakTorque: number;
  ratios: number[];
  finalDrive: number;
  grip: number;
  launchGrip: number;
  spinKeep: number;
  downforce: number;
  dragArea: number;
  shiftTime: number;
  driveEff: number;
  reliability: number;
  /** Parts whose condition is low enough to fail (owned cars); empty for loaners and bots. */
  risky: { part: PartId; chance: number }[];
  def: CarDef;
  levels: Levels;
}

export function specOf(def: CarDef, levels: Levels, cond: Condition, canFail = true): CarSpec {
  const e = effectsOf(levels, cond);
  const gN = 0.78;
  const g1 = def.gears === 1 ? 3.2 : def.gears <= 3 ? 2.9 : 3.5;
  const ratios: number[] = [];
  for (let i = 0; i < def.gears; i++) ratios.push(def.gears === 1 ? 1 : g1 * Math.pow(gN / g1, i / (def.gears - 1)));
  const power = def.hp * 745.7 * e.torqueMul;
  const dragArea = def.drag * e.dragMul;
  const vTop = Math.cbrt((power * 0.85) / (0.5 * AIR * dragArea)) * 1.12;
  const redline = def.redline + e.redlineAdd;
  const finalDrive = def.gears === 1 ? ((redline / 60) * 2 * Math.PI * WHEEL_R) / vTop : ((redline / 60) * 2 * Math.PI * WHEEL_R) / (gN * vTop);
  const reliability = clamp(def.reliability + e.reliabilityAdd, 0.2, 1);
  const risky = canFail ? PARTS.filter((p) => p !== 'looks').map((p) => ({ part: p, chance: failChance(cond[p], reliability) })).filter((r) => r.chance > 0) : [];
  return {
    id: def.id,
    name: def.name,
    mass: def.mass + e.massAdd,
    drive: def.drive,
    gears: def.gears,
    redline,
    peakTorque: def.torque * e.torqueMul,
    ratios,
    finalDrive,
    grip: def.grip * e.gripMul,
    launchGrip: e.launchGrip,
    spinKeep: e.spinKeep,
    downforce: e.downforce,
    dragArea,
    shiftTime: e.shiftTime,
    driveEff: e.driveEff,
    reliability,
    risky,
    def,
    levels: { ...levels },
  };
}

/** Engine torque at an rpm: a bell around 65 % of the redline (electric: flat, then falling). */
export function torqueAt(spec: CarSpec, rpm: number): number {
  const t = clamp(rpm / spec.redline, 0, 1.05);
  if (spec.gears === 1) return spec.peakTorque * (t < 0.3 ? 1 : 0.3 / t);
  const d = (t - 0.65) / 0.35;
  return spec.peakTorque * (0.45 + 0.55 * Math.exp(-d * d));
}

export const wheelRpm = (spec: CarSpec, v: number, gear: number): number => (v / (2 * Math.PI * WHEEL_R)) * 60 * spec.ratios[gear - 1]! * spec.finalDrive;
export const engineForce = (spec: CarSpec, rpm: number, gear: number): number => (BOOST * torqueAt(spec, rpm) * spec.ratios[gear - 1]! * spec.finalDrive * spec.driveEff) / WHEEL_R;
export const tractionLimit = (spec: CarSpec, launching: boolean, v = 0): number => MU * spec.grip * spec.mass * G * DRIVE_SHARE[spec.drive] * (launching ? spec.launchGrip * LAUNCH_SHARE[spec.drive] : 1.25 * (1 + spec.downforce * (v / 27.8)));

/**
 * The launch rpm launch control holds: the strongest pull the tyres can take without spinning
 * (just under the grip limit, or the torque peak when the tyres can take everything).
 */
export function idealLaunchRpm(spec: CarSpec): number {
  const limit = tractionLimit(spec, true);
  let best = IDLE_RPM;
  let bestF = -1;
  for (let r = IDLE_RPM; r <= spec.redline * 0.95; r += 50) {
    const f = engineForce(spec, r, 1);
    if (f > limit * 0.98) break;
    if (f >= bestF) {
      bestF = f;
      best = r;
    }
  }
  return Math.round(best / 50) * 50;
}

/** One gear's shift window, as shares of the redline: perfect in [lo, hi], good in [okLo, okHi]. */
export interface ShiftWindow {
  lo: number;
  hi: number;
  okLo: number;
  okHi: number;
}

/**
 * How long the needle takes to sweep the green and each yellow band, seconds: drawn per gear and
 * race within these ranges, so some greens are generous and some are a flick.
 */
export const GREEN_SECONDS = { min: 0.2, max: 0.32 } as const;
export const YELLOW_SECONDS = { min: 0.12, max: 0.26 } as const;

/** How fast the needle climbs in a gear near the top of the revs (share of the redline per second). */
export function needleRate(spec: CarSpec, gear: number): number {
  const rpm = spec.redline * 0.85;
  const k = spec.ratios[gear - 1]! * spec.finalDrive;
  const v = (rpm / (60 * k)) * 2 * Math.PI * WHEEL_R;
  const force = Math.min(engineForce(spec, rpm, gear), tractionLimit(spec, false, v));
  const a = (force - 0.5 * AIR * spec.dragArea * v * v - 0.012 * spec.mass * G) / spec.mass;
  return Math.max(0.02, ((a / (2 * Math.PI * WHEEL_R)) * 60 * k) / spec.redline);
}

/**
 * A car's shift windows, one per gear change. Everything about them comes from the race seed (the
 * same for everyone in a race) and changes every gear: where the green sits (70 to 92 % of the
 * redline), how wide it is and how wide each yellow band is. Widths are drawn as time on the needle
 * and turned into revs for each car, so the green is equally hard in any car.
 */
export function shiftWindows(seed: number, spec: CarSpec): ShiftWindow[] {
  const r = rng((seed ^ 0x2c1b3c6d) >>> 0);
  const between = (lo: number, hi: number): number => lo + r() * (hi - lo);
  const out: ShiftWindow[] = [];
  for (let g = 1; g < spec.gears; g++) {
    // drawn whatever the car (so an upgrade can't move a window, and every car sees the same draws)
    const c = between(0.7, 0.92);
    const green = between(GREEN_SECONDS.min, GREEN_SECONDS.max);
    const below = between(YELLOW_SECONDS.min, YELLOW_SECONDS.max);
    const above = between(YELLOW_SECONDS.min, YELLOW_SECONDS.max);
    const rate = needleRate(spec, g);
    // the centre stays put (the same for every car); the green narrows rather than reach the redline
    const hw = Math.min(clamp((rate * green) / 2, 0.02, 0.08), 0.97 - c);
    const hi = c + hw;
    const lo = c - hw;
    out.push({ lo, hi, okLo: lo - clamp(rate * below, 0.03, 0.1), okHi: Math.min(0.992, hi + clamp(rate * above, 0.03, 0.1)) });
  }
  return out;
}

/** Taps below this share of the redline are taken as accidental and ignored. */
export const IGNORE_BELOW = 0.5;
/** Seconds on the limiter before a shift counts as late. */
export const LATE_AFTER = 0.14;

export type Phase = 'staging' | 'running' | 'shifting' | 'done';

export interface Racer {
  spec: CarSpec;
  phase: Phase;
  x: number;
  v: number;
  rpm: number;
  gear: number;
  launchAt: number;
  launchRpm: number;
  reaction: number;
  slip: number;
  bog: number;
  spinLeft: number;
  shiftLeft: number;
  limiterSince: number;
  limiterTime: number;
  spinTime: number;
  perfect: number;
  shifts: number;
  early: number;
  late: number;
  dnf: boolean;
  failure: PartId | null;
  failAt: number;
  et: number;
  trap: number;
  /** Shift taps, seconds after the launch (the replay). */
  taps: number[];
  dead: boolean;
  stuck: boolean;
  /** Seconds after the launch when 100 km/h was reached, or -1. */
  t100: number;
  /** The needle is in the perfect zone in this gear (for the cue sound). */
  inZone: boolean;
  /** A short push after a perfect shift or launch (multiplier, seconds left). */
  boostMul: number;
  boostLeft: number;
  /** Tapped while the red lights were on (live drivers). */
  jumped: boolean;
  launchQ: LaunchQuality | null;
}

export type LaunchQuality = 'perfect' | 'good' | 'slow' | 'jump';

export type ShiftQuality = 'perfect' | 'ok' | 'early' | 'late';
export type Event = { type: 'light'; n: number } | { type: 'out' } | { type: 'launch'; i: number; quality: LaunchQuality } | { type: 'jump'; i: number } | { type: 'spin'; i: number } | { type: 'shift'; i: number; quality: ShiftQuality } | { type: 'tooEarly'; i: number } | { type: 'zone'; i: number } | { type: 'limiter'; i: number } | { type: 'finish'; i: number } | { type: 'fail'; i: number; part: PartId };

/**
 * The rpm the shift is judged on and the needle shows: while the clutch slips at the launch the
 * engine sits at its launch revs, but what matters is what the gear is doing (the wheels).
 */
export const shiftRpm = (r: Racer): number => (r.slip > 0 ? Math.min(r.rpm, Math.max(IDLE_RPM, wheelRpm(r.spec, r.v, r.gear))) : r.rpm);

export type Driver = { kind: 'live' } | { kind: 'policy'; skill: number; seed: number } | { kind: 'script'; script: Script };

/** A recorded run: enough to race the same car the same way again (a ghost). */
export interface Script {
  launchRpm: number;
  reaction: number;
  shifts: number[];
}

interface PolicyPlan {
  launchRpm: number;
  reaction: number;
  /** Where it shifts out of each gear (share of the redline). */
  shiftAt: number[];
  lateness: number;
  wantedAt: number;
}

export interface RacerResult {
  et: number | null;
  reaction: number;
  trap: number;
  t100: number;
  perfect: number;
  shifts: number;
  early: number;
  late: number;
  launch: LaunchQuality | null;
  spinTime: number;
  limiterTime: number;
  dnf: boolean;
  failure: PartId | null;
  /** Reaction + ET: when the car crossed the line. */
  crossed: number | null;
  script: Script;
}

export interface RaceResult {
  racers: RacerResult[];
  /** Racer indices from first to last (finishers by crossing time, then the rest). */
  order: number[];
  winner: number | null;
  /** Seconds between first and second place. */
  margin: number;
}

function newRacer(spec: CarSpec): Racer {
  return { spec, phase: 'staging', x: 0, v: 0, rpm: IDLE_RPM, gear: 1, launchAt: 0, launchRpm: 0, reaction: 0, slip: 0, bog: 1, spinLeft: 0, shiftLeft: 0, limiterSince: -1, limiterTime: 0, spinTime: 0, perfect: 0, shifts: 0, early: 0, late: 0, dnf: false, failure: null, failAt: -1, et: 0, trap: 0, taps: [], dead: false, stuck: false, t100: -1, inZone: false, boostMul: 1, boostLeft: 0, jumped: false, launchQ: null };
}

export class Race {
  readonly racers: Racer[];
  readonly drivers: Driver[];
  /** Lights out: the go signal. */
  readonly outAt: number;
  /** When each of the five red lights comes on. */
  readonly lightAt: readonly number[];
  /** Each racer's shift windows (see shiftWindows). */
  readonly windows: ShiftWindow[][];
  t = 0;
  lightsOn = 0;
  out = false;
  done = false;
  private plans: (PolicyPlan | null)[];
  private rand: () => number;
  private events: Event[] = [];

  constructor(specs: CarSpec[], drivers: Driver[], seed: number) {
    if (specs.length < 1 || specs.length > MAX_RACERS || specs.length !== drivers.length) throw new Error('bad race');
    this.rand = rng(seed);
    this.racers = specs.map(newRacer);
    this.drivers = drivers;
    this.lightAt = Array.from({ length: LIGHTS }, (_, k) => FIRST_LIGHT + k * LIGHT_GAP);
    this.outAt = this.lightAt[LIGHTS - 1]! + this.rand() * OUT_HOLD_MAX;
    this.windows = this.racers.map((r) => shiftWindows(seed, r.spec));
    this.plans = this.racers.map((_, i) => this.plan(i));
    for (const r of this.racers) {
      // Worn parts may fail somewhere in the run (the first one rolled wins).
      for (const k of r.spec.risky) {
        if (this.rand() < k.chance) {
          r.failure = k.part;
          r.failAt = k.part === 'suspension' ? 0 : 0.5 + this.rand() * 7;
          break;
        }
      }
      // Staging: every car sits at its launch rpm before the lights (launch control holds it).
      const d = this.drivers[this.racers.indexOf(r)]!;
      r.rpm = d.kind === 'script' ? d.script.launchRpm : d.kind === 'policy' ? this.plans[this.racers.indexOf(r)]!.launchRpm : idealLaunchRpm(r.spec);
    }
  }

  private plan(i: number): PolicyPlan | null {
    const d = this.drivers[i]!;
    if (d.kind !== 'policy') return null;
    const r = rng(d.seed);
    const spec = this.racers[i]!.spec;
    const skill = clamp(d.skill, 0, 1);
    const err = (1 - skill) * (r() * 2 - 1);
    const err2 = (1 - skill) * (r() * 2 - 1);
    const ideal = idealLaunchRpm(spec);
    // aims at each window's middle, off by up to a skill-sized error
    const shiftAt = this.windows[i]!.map((w) => clamp((w.lo + w.hi) / 2 + (1 - skill) * 0.17 * (r() * 2 - 1) + err2 * 0.02, 0.6, 0.995));
    return {
      launchRpm: clamp(ideal + err * spec.redline * 0.3, IDLE_RPM, spec.redline),
      reaction: 0.17 + (1 - skill) * 0.4 + r() * (0.05 + (1 - skill) * 0.15),
      shiftAt,
      lateness: err2 > 0.4 ? (err2 - 0.4) * 0.4 : 0,
      wantedAt: -1,
    };
  }

  /** The current gear's window for a racer (null in top gear). */
  windowOf(i: number): ShiftWindow | null {
    const r = this.racers[i]!;
    return r.gear < r.spec.gears ? (this.windows[i]![r.gear - 1] ?? null) : null;
  }

  /**
   * The player's button (live drivers only): at lights out it launches, while the lights are on it is a jump
   * start, while running it shifts. A stray tap far below the window is ignored.
   */
  tap(i: number): void {
    if (this.drivers[i]?.kind !== 'live') return;
    const r = this.racers[i]!;
    if (r.phase === 'staging') {
      if (this.out) {
        if (!r.jumped) this.launch(i);
      } else if (this.lightsOn > 0 && !r.jumped) {
        r.jumped = true;
        this.events.push({ type: 'jump', i });
      }
      return;
    }
    if (r.phase !== 'running' || r.gear >= r.spec.gears || r.stuck || r.dead) return;
    if (shiftRpm(r) < r.spec.redline * IGNORE_BELOW) {
      this.events.push({ type: 'tooEarly', i });
      return;
    }
    this.shift(i);
  }

  private launch(i: number): void {
    const r = this.racers[i]!;
    r.launchAt = this.t;
    r.launchRpm = r.rpm;
    r.reaction = this.t - this.outAt;
    r.phase = 'running';
    r.slip = r.spec.gears === 1 ? 0 : 3;
    r.bog = Math.pow(clamp(r.rpm / Math.max(IDLE_RPM + 1, idealLaunchRpm(r.spec)), 0.3, 1), 1.6);
    r.launchQ = r.jumped ? 'jump' : r.reaction <= LAUNCH_PERFECT ? 'perfect' : r.reaction <= LAUNCH_GOOD ? 'good' : 'slow';
    if (r.launchQ === 'perfect') {
      r.boostMul = 1.08;
      r.boostLeft = 1.0;
    } else if (r.launchQ === 'jump') r.bog *= 0.75;
    const spin = engineForce(r.spec, r.rpm, 1) > tractionLimit(r.spec, true);
    if (spin || r.failure === 'suspension') {
      r.spinLeft = (r.failure === 'suspension' ? 1.4 : 0.35) + 0.6 * clamp((engineForce(r.spec, r.rpm, 1) / tractionLimit(r.spec, true) - 1) * 2, 0, 1) * (1 - (r.spec.spinKeep - 0.72) * 2);
      this.events.push({ type: 'spin', i });
      if (r.failure === 'suspension') {
        this.events.push({ type: 'fail', i, part: 'suspension' });
        r.failAt = -1;
      }
    }
    this.events.push({ type: 'launch', i, quality: r.launchQ });
  }

  private shift(i: number): void {
    const r = this.racers[i]!;
    if (r.phase !== 'running' || r.gear >= r.spec.gears || r.stuck || r.dead) return;
    const frac = shiftRpm(r) / r.spec.redline;
    const w = this.windowOf(i)!;
    r.slip = 0;
    r.inZone = false;
    const bounced = r.limiterSince >= 0 && this.t - r.limiterSince > LATE_AFTER;
    let quality: ShiftQuality;
    if (bounced || frac > w.okHi) {
      quality = 'late';
      r.late++;
    } else if (frac >= w.lo && frac <= w.hi) {
      quality = 'perfect';
      r.perfect++;
    } else if (frac >= w.okLo) quality = 'ok';
    else {
      quality = 'early';
      r.early++;
    }
    r.shifts++;
    r.taps.push(Math.round((this.t - r.launchAt) * 1000) / 1000);
    r.phase = 'shifting';
    r.shiftLeft = r.spec.shiftTime * (quality === 'perfect' ? 0.6 : quality === 'ok' ? 1 : quality === 'early' ? 1.15 : 1.45);
    // a perfect shift kicks; an early one bogs in the next gear
    r.boostMul = quality === 'perfect' ? 1.18 : quality === 'early' ? 0.88 : 1;
    r.boostLeft = quality === 'perfect' ? 0.8 : quality === 'early' ? 0.5 : 0;
    r.gear++;
    r.limiterSince = -1;
    this.events.push({ type: 'shift', i, quality });
  }

  /** Advances one DT. Returns what happened for the sounds and the HUD (including taps made since the last step). */
  step(): Event[] {
    const fromTaps = this.events;
    this.events = [...fromTaps];
    if (this.done) {
      const out = this.events;
      this.events = [];
      return out;
    }
    this.t += DT;
    while (this.lightsOn < this.lightAt.length && this.t >= this.lightAt[this.lightsOn]!) {
      this.lightsOn++;
      this.events.push({ type: 'light', n: this.lightsOn });
    }
    if (!this.out && this.t >= this.outAt) {
      this.out = true;
      this.events.push({ type: 'out' });
    }
    for (let i = 0; i < this.racers.length; i++) this.stepRacer(i);
    if (this.racers.every((r) => r.phase === 'done') || this.t >= MAX_TIME) {
      for (const r of this.racers)
        if (r.phase !== 'done') {
          r.phase = 'done';
          r.dnf = true;
        }
      this.done = true;
    }
    const out = this.events;
    this.events = [];
    return out;
  }

  private stepRacer(i: number): void {
    const r = this.racers[i]!;
    const d = this.drivers[i]!;
    const plan = this.plans[i]!;
    const spec = r.spec;
    if (r.phase === 'done') return;

    if (r.phase === 'staging') {
      // live drivers launch with their tap (tap()); a jump start or no tap launches late
      const react = d.kind === 'policy' && plan ? plan.reaction : d.kind === 'script' ? d.script.reaction : r.jumped ? JUMP_PENALTY : AUTO_LAUNCH;
      if (this.out && this.t >= this.outAt + react - 1e-9) this.launch(i);
      return;
    }

    const since = this.t - r.launchAt;
    if (r.failure && r.failAt >= 0 && since >= r.failAt) {
      r.failAt = -1;
      this.events.push({ type: 'fail', i, part: r.failure });
      if (r.failure === 'engine') r.dead = true;
      if (r.failure === 'transmission') r.stuck = true;
      if (r.failure === 'tyres') {
        r.spinLeft = 1.2;
        this.events.push({ type: 'spin', i });
      }
    }
    if (r.phase === 'running' && r.gear < spec.gears && !r.stuck) {
      if (d.kind === 'script') {
        const next = d.script.shifts[r.shifts];
        if (next !== undefined && since >= next) this.shift(i);
      } else if (d.kind === 'policy' && plan && shiftRpm(r) >= spec.redline * (plan.shiftAt[r.gear - 1] ?? 0.95)) {
        if (plan.wantedAt < 0) plan.wantedAt = this.t;
        if (this.t - plan.wantedAt >= plan.lateness) {
          plan.wantedAt = -1;
          this.shift(i);
        }
      }
    }

    const wheel = wheelRpm(spec, r.v, r.gear);
    let force = 0;
    if (r.phase === 'shifting') {
      r.shiftLeft -= DT;
      r.rpm = Math.max(IDLE_RPM, r.rpm - 2500 * DT);
      if (r.shiftLeft <= 0) {
        r.phase = 'running';
        r.rpm = Math.max(IDLE_RPM, wheel);
        if (engineForce(spec, r.rpm, r.gear) > tractionLimit(spec, false, r.v) * 1.1 && r.spinLeft <= 0) {
          r.spinLeft = 0.25;
          this.events.push({ type: 'spin', i });
        }
      }
    } else if (!r.dead) {
      const launching = since < 1.2;
      const limit = tractionLimit(spec, launching, r.v) * (r.failure === 'tyres' && r.failAt < 0 ? 0.35 : 1);
      if (r.slip > 0) {
        // The clutch slips: the engine holds near its launch revs (sagging a little) until the
        // wheels catch up, then locks; no sudden drop of the needle.
        r.slip -= DT;
        const held = Math.max(IDLE_RPM, r.launchRpm - 350 * since);
        r.rpm = Math.max(wheel, held);
        if (wheel >= held - 30 || r.slip <= 0) {
          r.slip = 0;
          r.rpm = Math.max(IDLE_RPM, wheel);
        }
      } else r.rpm = Math.max(IDLE_RPM, wheel);
      let eng = engineForce(spec, r.rpm, r.gear);
      if (since < 1 && r.gear === 1 && spec.gears > 1) eng *= r.bog + (1 - r.bog) * since;
      if (r.boostLeft > 0) {
        r.boostLeft -= DT;
        eng *= r.boostMul;
      }
      if (r.spinLeft > 0) {
        r.spinLeft -= DT;
        r.spinTime += DT;
        force = limit * spec.spinKeep;
        r.rpm = Math.min(spec.redline, r.rpm + 7000 * DT);
      } else {
        force = Math.min(eng, limit * (r.boostLeft > 0 && r.boostMul > 1 ? r.boostMul : 1));
        if (r.rpm >= spec.redline - 1) {
          if (r.limiterSince < 0) {
            r.limiterSince = this.t;
            if (r.gear < spec.gears || spec.gears === 1) this.events.push({ type: 'limiter', i });
          }
          r.limiterTime += DT;
          r.rpm = spec.redline;
          force *= r.gear < spec.gears ? 0.3 : 0.9;
        }
      }
    }
    const win = r.gear < spec.gears ? this.windows[i]![r.gear - 1] : undefined;
    if (d.kind === 'live' && win && r.phase === 'running' && !r.inZone && shiftRpm(r) >= spec.redline * win.lo) {
      r.inZone = true;
      this.events.push({ type: 'zone', i });
    }
    const drag = 0.5 * AIR * spec.dragArea * (r.failure === 'aero' && r.failAt < 0 ? 2.5 : 1) * r.v * r.v;
    const roll = 0.012 * spec.mass * G;
    const a = (force - drag - roll) / spec.mass;
    r.v = Math.max(0, r.v + a * DT);
    if (r.t100 < 0 && r.v >= 27.78) r.t100 = since;
    const x0 = r.x;
    r.x += r.v * DT;
    if (r.x >= DISTANCE) {
      const f = (DISTANCE - x0) / (r.x - x0);
      r.et = since - DT + f * DT;
      r.trap = r.v;
      r.phase = 'done';
      this.events.push({ type: 'finish', i });
    }
  }

  result(): RaceResult {
    const rs = this.racers.map((r): RacerResult => {
      const finished = r.phase === 'done' && !r.dnf;
      return {
        et: finished ? r.et : null,
        reaction: r.reaction,
        trap: r.trap * 3.6,
        t100: r.t100,
        perfect: r.perfect,
        shifts: r.shifts,
        early: r.early,
        late: r.late,
        launch: r.launchQ,
        spinTime: r.spinTime,
        limiterTime: r.limiterTime,
        dnf: !finished,
        failure: r.failure,
        crossed: finished ? r.reaction + r.et : null,
        script: { launchRpm: Math.round(r.launchRpm), reaction: Math.round(r.reaction * 1000) / 1000, shifts: r.taps },
      };
    });
    const order = rs
      .map((_, i) => i)
      .sort((a, b) => {
        const ca = rs[a]!.crossed;
        const cb = rs[b]!.crossed;
        if (ca === null && cb === null) return rs[b]!.et === null && rs[a]!.et === null ? a - b : 0;
        if (ca === null) return 1;
        if (cb === null) return -1;
        return ca - cb;
      });
    const first = order[0]!;
    const winner = rs[first]!.crossed === null ? null : first;
    const second = order[1];
    const margin = winner !== null && second !== undefined && rs[second]!.crossed !== null ? rs[second]!.crossed! - rs[first]!.crossed! : 0;
    return { racers: rs, order, winner, margin };
  }
}

/** What the start lights show: how many of the five red lights are on, lights out, and who jumped. */
export interface LightsState {
  on: number;
  out: boolean;
  jumped: [boolean, boolean];
}
export const LIGHTS_OFF: LightsState = { on: 0, out: false, jumped: [false, false] };

export function lightsOf(race: Race): LightsState {
  const jumped = (i: number): boolean => !!race.racers[i]?.jumped;
  return { on: race.lightsOn, out: race.out, jumped: [jumped(0), jumped(1)] };
}

/** Runs a whole race at once (forecasts, tests). */
export function simulate(specs: CarSpec[], drivers: Driver[], seed: number): RaceResult {
  const race = new Race(specs, drivers, seed);
  while (!race.done) race.step();
  return race.result();
}

/** The leaderboard number: higher is better, 0 for a breakdown. The start counts: reaction + ET. */
export function scoreOf(r: RacerResult): number {
  if (r.et === null) return 0;
  return Math.max(0, 20000 - Math.round((r.et + Math.max(0, r.reaction)) * 1000) + 150 * r.perfect + (r.launch === 'perfect' ? 150 : 0));
}

/** A solo run with a policy driver at a skill: what the car "should" do. */
export function forecastRun(spec: CarSpec, skill: number, seed = 1): { et: number; trap: number; t100: number } {
  const safe = { ...spec, risky: [] };
  const r = simulate([safe], [{ kind: 'policy', skill, seed }], seed).racers[0]!;
  return { et: r.et ?? MAX_TIME, trap: r.trap, t100: r.t100 };
}
export const forecastEt = (spec: CarSpec, skill: number, seed = 1): number => forecastRun(spec, skill, seed).et;

// ---- replay encoding (friends' challenges)
const VERSION = 'lc2';
export function encodeScript(s: Script): string {
  return [VERSION, s.launchRpm, Math.round(s.reaction * 1000), ...s.shifts.map((t) => Math.round(t * 1000))].join(',');
}
export function decodeScript(raw: string | null | undefined): Script | null {
  if (!raw) return null;
  const p = raw.split(',');
  if ((p[0] !== VERSION && p[0] !== 'lc1') || p.length < 3 || p.length > 40) return null;
  const nums = p.slice(1).map(Number);
  if (nums.some((n) => !Number.isFinite(n))) return null;
  const [launchRpm, reaction, ...shifts] = nums as [number, number, ...number[]];
  if (launchRpm < 0 || launchRpm > 30000 || reaction < -5000 || reaction > 10000) return null;
  const sh = shifts.map((n) => n / 1000);
  for (let i = 1; i < sh.length; i++) if (sh[i]! < sh[i - 1]!) return null;
  return { launchRpm, reaction: reaction / 1000, shifts: sh };
}
