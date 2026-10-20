/**
 * The race: a quarter mile for two cars, stepped at a fixed rate. Pure and deterministic: the same
 * cars, drivers and seed always give the same race (the daily, friends' ghosts and the tests rely
 * on it). A driver is either live (the player's pedal and taps) or a policy (an AI with a skill
 * level) or a script (recorded taps: a ghost).
 */
import type { CarDef } from './cars';
import { effectsOf, PARTS, failChance, type Condition, type Levels, type PartId } from './parts';
import { clamp, rng } from './util';

export const DT = 1 / 120;
/** A quarter mile, metres. */
export const DISTANCE = 402.336;
/** Nobody takes longer than this: the race ends. */
export const MAX_TIME = 30;
/** The tree: ambers at these seconds after staging starts, green a little later (seeded). */
export const AMBERS = [1.0, 1.5, 2.0];
export const GREEN_MIN = 2.5;
export const GREEN_JITTER = 0.4;
/** Holding the pedal this long after green launches anyway. */
export const LAUNCH_TIMEOUT = 2;
export const IDLE_RPM = 900;
const G = 9.81;
const AIR = 1.2;
const WHEEL_R = 0.33;
const MU = 1.4;
/** Game physics: everything pulls harder than a real car, so a stock starter runs ~14 s and a dragster ~6 s. */
const BOOST = 1.5;
const DRIVE_SHARE = { rwd: 0.7, awd: 1.0, fwd: 0.5 } as const;
/** Weight transfer at the launch: the nose lifts, so rear-drivers gain grip and front-drivers lose it. */
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
  dragArea: number;
  shiftTime: number;
  driveEff: number;
  reliability: number;
  /** Parts whose condition is low enough to fail (owned cars); empty for loaners and opponents. */
  risky: { part: PartId; chance: number }[];
  /** Kept for the renderer and the UI. */
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
  // Final drive: top gear at the redline is just past the drag-limited top speed.
  const vTop = Math.cbrt((power * 0.85) / (0.5 * AIR * dragArea)) * 1.12;
  const redline = def.redline + e.redlineAdd;
  const finalDrive = def.gears === 1 ? (redline / 60) * 2 * Math.PI * WHEEL_R / vTop : (redline / 60) * 2 * Math.PI * WHEEL_R / (gN * vTop);
  const risky = canFail ? PARTS.filter((p) => p !== 'looks').map((p) => ({ part: p, chance: failChance(cond[p], def.reliability) })).filter((r) => r.chance > 0) : [];
  return {
    id: def.id,
    name: def.name,
    mass: def.mass,
    drive: def.drive,
    gears: def.gears,
    redline,
    peakTorque: def.torque * e.torqueMul,
    ratios,
    finalDrive,
    grip: def.grip * e.gripMul,
    launchGrip: e.launchGrip,
    spinKeep: e.spinKeep,
    dragArea,
    shiftTime: e.shiftTime,
    driveEff: 0.84 + 0.01 * levels.transmission,
    reliability: def.reliability,
    risky,
    def,
    levels: { ...levels },
  };
}

/** Engine torque at an rpm: a hump peaking around 60 % of the redline (electric: flat, then falling). */
export function torqueAt(spec: CarSpec, rpm: number): number {
  const t = clamp(rpm / spec.redline, 0, 1.05);
  if (spec.gears === 1) return spec.peakTorque * (t < 0.3 ? 1 : 0.3 / t);
  // A bell around 65 % of the redline: half the torque at idle, two thirds at the redline.
  const d = (t - 0.65) / 0.35;
  return spec.peakTorque * (0.45 + 0.55 * Math.exp(-d * d));
}

export const wheelRpm = (spec: CarSpec, v: number, gear: number): number => ((v / (2 * Math.PI * WHEEL_R)) * 60 * spec.ratios[gear - 1]! * spec.finalDrive);
export const speedAt = (spec: CarSpec, rpm: number, gear: number): number => (rpm / 60 / (spec.ratios[gear - 1]! * spec.finalDrive)) * 2 * Math.PI * WHEEL_R;

/** Force at the tyres from engine torque in a gear, N. */
export const engineForce = (spec: CarSpec, rpm: number, gear: number): number => (BOOST * torqueAt(spec, rpm) * spec.ratios[gear - 1]! * spec.finalDrive * spec.driveEff) / WHEEL_R;
/** Most force the driven tyres can put down, N (more at the launch with weight transfer). */
export const tractionLimit = (spec: CarSpec, launching: boolean): number => MU * spec.grip * spec.mass * G * DRIVE_SHARE[spec.drive] * (launching ? spec.launchGrip * LAUNCH_SHARE[spec.drive] : 1.25);

/** The launch rpm where the car just stops spinning its tyres: the sweet spot. */
export function idealLaunchRpm(spec: CarSpec): number {
  const limit = tractionLimit(spec, true);
  let best = IDLE_RPM;
  for (let r = IDLE_RPM; r <= spec.redline * 0.95; r += 50) {
    if (engineForce(spec, r, 1) <= limit * 0.98) best = r;
    else break;
  }
  return Math.round(best / 50) * 50;
}

/** The launch window shown on the tacho: a hair under the sweet spot to a little over. */
export function launchWindow(spec: CarSpec): [number, number] {
  const ideal = idealLaunchRpm(spec);
  return [Math.max(IDLE_RPM, ideal - spec.redline * 0.08), Math.min(spec.redline, ideal + spec.redline * 0.05)];
}

/** Shift zone (fraction of redline): a perfect shift happens here. */
export const PERFECT_FROM = 0.92;
export const OK_FROM = 0.8;

export type Phase = 'staging' | 'running' | 'shifting' | 'done';
export type Fault = 'red' | 'dnf' | null;

export interface Racer {
  spec: CarSpec;
  phase: Phase;
  x: number;
  v: number;
  rpm: number;
  gear: number;
  pedal: boolean;
  launched: boolean;
  launchAt: number;
  launchRpm: number;
  reaction: number;
  /** Clutch slip left at the launch, seconds. */
  slip: number;
  /** Launch quality below the sweet spot (1 = at or above it): a bogged launch pulls less for the first second. */
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
  fault: Fault;
  failure: PartId | null;
  failAt: number;
  et: number;
  trap: number;
  /** Shift taps, seconds after the launch (the replay). */
  taps: number[];
  /** The engine is dead (failure): no drive. */
  dead: boolean;
  stuck: boolean;
}

type Lane = 0 | 1;
export type Event = { type: 'amber'; n: number } | { type: 'green' } | { type: 'launch'; i: Lane } | { type: 'spin'; i: Lane } | { type: 'shift'; i: Lane; quality: 'perfect' | 'ok' | 'early' | 'late' } | { type: 'limiter'; i: Lane } | { type: 'finish'; i: Lane } | { type: 'red'; i: Lane } | { type: 'fail'; i: Lane; part: PartId };

/** How a car is driven. */
export type Driver =
  | { kind: 'live' }
  | { kind: 'policy'; skill: number; seed: number }
  | { kind: 'script'; script: Script };

/** A recorded run: enough to race the same car the same way again (a ghost). */
export interface Script {
  launchRpm: number;
  reaction: number;
  shifts: number[];
}

interface PolicyPlan {
  launchRpm: number;
  reaction: number;
  /** Fraction of the redline the driver shifts at. */
  shiftAt: number;
  /** Seconds the driver dawdles once there (a late shifter bounces the limiter). */
  lateness: number;
  /** When the driver first wanted to shift in this gear, or -1. */
  wantedAt: number;
}

export interface RacerResult {
  et: number | null;
  reaction: number;
  trap: number;
  perfect: number;
  shifts: number;
  early: number;
  late: number;
  spinTime: number;
  limiterTime: number;
  fault: Fault;
  failure: PartId | null;
  /** Reaction + ET: when the car crossed the line. */
  crossed: number | null;
  script: Script;
}

export interface RaceResult {
  racers: [RacerResult, RacerResult];
  /** 0 or 1, or null when nobody finished. */
  winner: 0 | 1 | null;
  /** Seconds between the two crossings (positive = the winner's margin). */
  margin: number;
}

function newRacer(spec: CarSpec): Racer {
  return { spec, phase: 'staging', x: 0, v: 0, rpm: IDLE_RPM, gear: 1, pedal: false, launched: false, launchAt: 0, launchRpm: 0, reaction: 0, slip: 0, bog: 1, spinLeft: 0, shiftLeft: 0, limiterSince: -1, limiterTime: 0, spinTime: 0, perfect: 0, shifts: 0, early: 0, late: 0, fault: null, failure: null, failAt: -1, et: 0, trap: 0, taps: [], dead: false, stuck: false };
}

export class Race {
  readonly racers: [Racer, Racer];
  readonly drivers: [Driver, Driver];
  readonly greenAt: number;
  t = 0;
  ambersLit = 0;
  green = false;
  done = false;
  private plans: [PolicyPlan | null, PolicyPlan | null];
  private rand: () => number;

  constructor(specs: [CarSpec, CarSpec], drivers: [Driver, Driver], seed: number) {
    this.rand = rng(seed);
    this.racers = [newRacer(specs[0]), newRacer(specs[1])];
    this.drivers = drivers;
    this.greenAt = GREEN_MIN + this.rand() * GREEN_JITTER;
    this.plans = [this.plan(0), this.plan(1)];
    // Worn parts may fail somewhere in the run (the first one rolled wins).
    for (const r of this.racers) {
      for (const k of r.spec.risky) {
        if (this.rand() < k.chance) {
          r.failure = k.part;
          r.failAt = k.part === 'suspension' ? 0 : 0.5 + this.rand() * 7;
          break;
        }
      }
    }
  }

  private plan(i: 0 | 1): PolicyPlan | null {
    const d = this.drivers[i];
    if (d.kind !== 'policy') return null;
    const r = rng(d.seed);
    const spec = this.racers[i].spec;
    const skill = clamp(d.skill, 0, 1);
    const err = (1 - skill) * (r() * 2 - 1);
    const ideal = idealLaunchRpm(spec);
    const err2 = (1 - skill) * (r() * 2 - 1);
    return {
      launchRpm: clamp(ideal + err * spec.redline * 0.3, IDLE_RPM, spec.redline),
      reaction: 0.1 + (1 - skill) * 0.4 + r() * (0.05 + (1 - skill) * 0.15),
      shiftAt: clamp(0.96 + err2 * 0.2, 0.76, 1.0),
      lateness: err2 > 0.2 ? (err2 - 0.2) * 0.5 : 0,
      wantedAt: -1,
    };
  }

  /** The player's pedal (live drivers only). Holding builds revs; letting go after green launches. */
  pedal(i: 0 | 1, down: boolean): void {
    const r = this.racers[i];
    if (this.drivers[i].kind !== 'live') return;
    if (r.phase === 'staging' && r.pedal && !down) this.tryLaunch(i);
    r.pedal = down;
  }

  /** A shift tap (live drivers only). */
  tap(i: 0 | 1): void {
    if (this.drivers[i].kind !== 'live') return;
    this.shift(i);
  }

  private tryLaunch(i: 0 | 1): void {
    const r = this.racers[i];
    if (r.launched) return;
    r.launched = true;
    r.launchAt = this.t;
    r.launchRpm = r.rpm;
    r.reaction = this.t - this.greenAt;
    if (!this.green) {
      r.fault = 'red';
      r.phase = 'done';
      this.events.push({ type: 'red', i });
      return;
    }
    r.phase = 'running';
    r.slip = r.spec.gears === 1 ? 0 : 0.5;
    r.bog = Math.pow(clamp(r.rpm / Math.max(IDLE_RPM + 1, idealLaunchRpm(r.spec)), 0.3, 1), 1.6);
    // Too many revs for the tyres: they spin until the chassis settles.
    const spin = engineForce(r.spec, r.rpm, 1) > tractionLimit(r.spec, true);
    if (spin || r.failure === 'suspension') {
      r.spinLeft = (r.failure === 'suspension' ? 1.4 : 0.35) + 0.6 * clamp((engineForce(r.spec, r.rpm, 1) / tractionLimit(r.spec, true) - 1) * 2, 0, 1) * (1 - (r.spec.spinKeep - 0.72) * 2);
      this.events.push({ type: 'spin', i });
      if (r.failure === 'suspension') {
        r.failure = 'suspension';
        this.events.push({ type: 'fail', i, part: 'suspension' });
        r.failAt = -1;
      }
    }
    this.events.push({ type: 'launch', i });
  }

  private shift(i: 0 | 1): void {
    const r = this.racers[i];
    if (r.phase !== 'running' || r.gear >= r.spec.gears || r.stuck || r.dead) return;
    // While the clutch slips in, the engine revs are not the car's: judge the shift by the wheels.
    const frac = (r.slip > 0 ? Math.min(r.rpm, wheelRpm(r.spec, r.v, r.gear)) : r.rpm) / r.spec.redline;
    r.slip = 0;
    const bounced = r.limiterSince >= 0 && this.t - r.limiterSince > 0.04;
    let quality: 'perfect' | 'ok' | 'early' | 'late';
    if (bounced) {
      quality = 'late';
      r.late++;
    } else if (frac >= PERFECT_FROM) {
      quality = 'perfect';
      r.perfect++;
    } else if (frac >= OK_FROM) quality = 'ok';
    else {
      quality = 'early';
      r.early++;
    }
    r.shifts++;
    r.taps.push(Math.round((this.t - r.launchAt) * 1000) / 1000);
    r.phase = 'shifting';
    r.shiftLeft = r.spec.shiftTime * (quality === 'perfect' ? 0.8 : 1);
    r.gear++;
    r.limiterSince = -1;
    this.events.push({ type: 'shift', i, quality });
  }

  private events: Event[] = [];

  /** Advances one DT. Returns what happened for the sounds and the HUD. */
  step(): Event[] {
    this.events = [];
    if (this.done) return this.events;
    this.t += DT;
    while (this.ambersLit < AMBERS.length && this.t >= AMBERS[this.ambersLit]!) {
      this.ambersLit++;
      this.events.push({ type: 'amber', n: this.ambersLit });
    }
    if (!this.green && this.t >= this.greenAt) {
      this.green = true;
      this.events.push({ type: 'green' });
    }
    for (const i of [0, 1] as const) this.stepRacer(i);
    const all = this.racers.every((r) => r.phase === 'done');
    if (all || this.t >= MAX_TIME) {
      for (const r of this.racers)
        if (r.phase !== 'done') {
          r.phase = 'done';
          r.fault = 'dnf';
        }
      this.done = true;
    }
    return this.events;
  }

  private stepRacer(i: 0 | 1): void {
    const r = this.racers[i];
    const d = this.drivers[i];
    const plan = this.plans[i];
    const spec = r.spec;
    if (r.phase === 'done') return;

    // --- staging: build revs, then launch
    if (r.phase === 'staging') {
      let target: number | null = null;
      if (d.kind === 'policy' && plan) target = plan.launchRpm;
      else if (d.kind === 'script') target = d.script.launchRpm;
      if (target !== null) {
        r.rpm = r.rpm < target ? Math.min(target, r.rpm + 4500 * DT) : Math.max(target, r.rpm - 5000 * DT);
        r.pedal = r.rpm < target + 1;
        const react = d.kind === 'policy' && plan ? plan.reaction : d.kind === 'script' ? d.script.reaction : 0;
        if (this.t >= this.greenAt + react) this.tryLaunch(i);
      } else {
        r.rpm = r.pedal ? Math.min(spec.redline, r.rpm + 4500 * DT) : Math.max(IDLE_RPM, r.rpm - 5000 * DT);
        if (this.green && this.t >= this.greenAt + LAUNCH_TIMEOUT) this.tryLaunch(i);
      }
      return;
    }

    const since = this.t - r.launchAt;
    // --- scheduled failure
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
    // --- scripted and policy shifts
    if (r.phase === 'running' && r.gear < spec.gears && !r.stuck) {
      if (d.kind === 'script') {
        const next = d.script.shifts[r.shifts];
        if (next !== undefined && since >= next) this.shift(i);
      } else if (d.kind === 'policy' && plan && (r.slip > 0 ? wheelRpm(spec, r.v, r.gear) : r.rpm) >= spec.redline * plan.shiftAt) {
        if (plan.wantedAt < 0) plan.wantedAt = this.t;
        if (this.t - plan.wantedAt >= plan.lateness) {
          plan.wantedAt = -1;
          this.shift(i);
        }
      }
    }

    // --- forces
    const wheel = wheelRpm(spec, r.v, r.gear);
    let force = 0;
    if (r.phase === 'shifting') {
      r.shiftLeft -= DT;
      r.rpm = Math.max(IDLE_RPM, r.rpm - 2500 * DT);
      if (r.shiftLeft <= 0) {
        r.phase = 'running';
        r.rpm = Math.max(IDLE_RPM, wheel);
        // Power-shifting a strong car can light the tyres again.
        if (engineForce(spec, r.rpm, r.gear) > tractionLimit(spec, false) * 1.1 && r.spinLeft <= 0) {
          r.spinLeft = 0.25;
          this.events.push({ type: 'spin', i });
        }
      }
    } else if (!r.dead) {
      const launching = since < 1.2;
      const limit = tractionLimit(spec, launching) * (r.failure === 'tyres' && r.failAt < 0 ? 0.35 : 1);
      if (r.slip > 0) {
        // The clutch slips: the engine holds its launch revs (sagging a little) until the wheels catch up.
        r.slip -= DT;
        const held = Math.max(IDLE_RPM, r.launchRpm - 1200 * (0.5 - r.slip));
        r.rpm = Math.max(wheel, held);
        if (wheel >= held) r.slip = 0;
      } else r.rpm = Math.max(IDLE_RPM, wheel);
      let eng = engineForce(spec, r.rpm, r.gear);
      // Bogged: launching under the sweet spot leaves the car floundering for the first second.
      if (since < 1 && r.gear === 1 && spec.gears > 1) eng *= r.bog + (1 - r.bog) * since;
      if (r.spinLeft > 0) {
        r.spinLeft -= DT;
        r.spinTime += DT;
        force = limit * spec.spinKeep;
        r.rpm = Math.min(spec.redline, r.rpm + 7000 * DT);
      } else {
        force = Math.min(eng, limit);
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
    const drag = 0.5 * AIR * spec.dragArea * (r.failure === 'aero' && r.failAt < 0 ? 2.5 : 1) * r.v * r.v;
    const roll = 0.012 * spec.mass * G;
    const a = (force - drag - roll) / spec.mass;
    r.v = Math.max(0, r.v + a * DT);
    const x0 = r.x;
    r.x += r.v * DT;
    if (r.x >= DISTANCE) {
      // Interpolate the crossing inside the step.
      const f = (DISTANCE - x0) / (r.x - x0);
      r.et = since - DT + f * DT;
      r.trap = r.v;
      r.phase = 'done';
      this.events.push({ type: 'finish', i });
    }
  }

  result(): RaceResult {
    const rs = this.racers.map((r): RacerResult => {
      const finished = r.phase === 'done' && !r.fault;
      return {
        et: finished ? r.et : null,
        reaction: r.reaction,
        trap: r.trap * 3.6,
        perfect: r.perfect,
        shifts: r.shifts,
        early: r.early,
        late: r.late,
        spinTime: r.spinTime,
        limiterTime: r.limiterTime,
        fault: r.fault,
        failure: r.failure,
        crossed: finished ? r.reaction + r.et : null,
        script: { launchRpm: Math.round(r.launchRpm), reaction: Math.round(r.reaction * 1000) / 1000, shifts: r.taps },
      };
    }) as [RacerResult, RacerResult];
    const a = rs[0].crossed;
    const b = rs[1].crossed;
    let winner: 0 | 1 | null = null;
    if (a !== null && (b === null || a <= b)) winner = 0;
    else if (b !== null) winner = 1;
    const margin = a !== null && b !== null ? Math.abs(a - b) : 0;
    return { racers: rs, winner, margin };
  }
}

/** Runs a whole race at once (forecasts, AI scripts, tests). */
export function simulate(specs: [CarSpec, CarSpec], drivers: [Driver, Driver], seed: number): RaceResult {
  const race = new Race(specs, drivers, seed);
  while (!race.done) race.step();
  return race.result();
}

/** The leaderboard number: higher is better, 0 for a red light or a breakdown. */
export function scoreOf(r: RacerResult): number {
  if (r.et === null) return 0;
  return Math.max(0, 20000 - Math.round(r.et * 1000) - 2 * Math.round(Math.max(0, r.reaction) * 1000) + 150 * r.perfect);
}

/** A solo run with a policy driver at a skill: what the car "should" do. Returns the ET (reaction excluded). */
export function forecastEt(spec: CarSpec, skill: number, seed = 1): number {
  const safe = { ...spec, risky: [] };
  const r = simulate([safe, safe], [{ kind: 'policy', skill, seed }, { kind: 'policy', skill, seed }], seed);
  return r.racers[0].et ?? MAX_TIME;
}

// ---- replay encoding (friends' challenges)
const VERSION = 'lc1';
export function encodeScript(s: Script): string {
  return [VERSION, s.launchRpm, Math.round(s.reaction * 1000), ...s.shifts.map((t) => Math.round(t * 1000))].join(',');
}
export function decodeScript(raw: string | null | undefined): Script | null {
  if (!raw) return null;
  const p = raw.split(',');
  if (p[0] !== VERSION || p.length < 3 || p.length > 40) return null;
  const nums = p.slice(1).map(Number);
  if (nums.some((n) => !Number.isFinite(n))) return null;
  const [launchRpm, reaction, ...shifts] = nums as [number, number, ...number[]];
  if (launchRpm < 0 || launchRpm > 30000 || reaction < -5000 || reaction > 10000) return null;
  const sh = shifts.map((n) => n / 1000);
  for (let i = 1; i < sh.length; i++) if (sh[i]! < sh[i - 1]!) return null;
  return { launchRpm, reaction: reaction / 1000, shifts: sh };
}
