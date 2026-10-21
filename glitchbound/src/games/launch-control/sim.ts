/**
 * The race: a quarter mile for up to five cars, stepped at a fixed rate. Pure and deterministic:
 * the same cars, drivers and seed always give the same race (the daily, friends' ghosts and the
 * tests rely on it). Every car launches itself at green (launch control); drivers only shift.
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
/** Nobody takes longer than this: the race ends. */
export const MAX_TIME = 30;
/** The tree: ambers at these seconds after staging starts, green a little later (seeded). */
export const AMBERS = [1.0, 1.5, 2.0];
export const GREEN_MIN = 2.5;
export const GREEN_JITTER = 0.4;
/** The player's launch control reacts this fast, every time. */
export const PLAYER_REACTION = 0.15;
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

/** The launch rpm where the car just stops spinning its tyres: launch control aims here. */
export function idealLaunchRpm(spec: CarSpec): number {
  const limit = tractionLimit(spec, true);
  let best = IDLE_RPM;
  for (let r = IDLE_RPM; r <= spec.redline * 0.95; r += 50) {
    if (engineForce(spec, r, 1) <= limit * 0.98) best = r;
    else break;
  }
  return Math.round(best / 50) * 50;
}

/** Shift zone (fraction of redline): a perfect shift happens here, a good one from OK_FROM. */
export const PERFECT_FROM = 0.88;
export const OK_FROM = 0.72;
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
}

export type ShiftQuality = 'perfect' | 'ok' | 'early' | 'late';
export type Event = { type: 'amber'; n: number } | { type: 'green' } | { type: 'launch'; i: number } | { type: 'spin'; i: number } | { type: 'shift'; i: number; quality: ShiftQuality } | { type: 'tooEarly'; i: number } | { type: 'zone'; i: number } | { type: 'limiter'; i: number } | { type: 'finish'; i: number } | { type: 'fail'; i: number; part: PartId };

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
  shiftAt: number;
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
  return { spec, phase: 'staging', x: 0, v: 0, rpm: IDLE_RPM, gear: 1, launchAt: 0, launchRpm: 0, reaction: 0, slip: 0, bog: 1, spinLeft: 0, shiftLeft: 0, limiterSince: -1, limiterTime: 0, spinTime: 0, perfect: 0, shifts: 0, early: 0, late: 0, dnf: false, failure: null, failAt: -1, et: 0, trap: 0, taps: [], dead: false, stuck: false, t100: -1, inZone: false };
}

export class Race {
  readonly racers: Racer[];
  readonly drivers: Driver[];
  readonly greenAt: number;
  t = 0;
  ambersLit = 0;
  green = false;
  done = false;
  private plans: (PolicyPlan | null)[];
  private rand: () => number;
  private events: Event[] = [];

  constructor(specs: CarSpec[], drivers: Driver[], seed: number) {
    if (specs.length < 1 || specs.length > MAX_RACERS || specs.length !== drivers.length) throw new Error('bad race');
    this.rand = rng(seed);
    this.racers = specs.map(newRacer);
    this.drivers = drivers;
    this.greenAt = GREEN_MIN + this.rand() * GREEN_JITTER;
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
      // Staging: every car sits at its launch rpm before the lights.
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
    return {
      launchRpm: clamp(ideal + err * spec.redline * 0.3, IDLE_RPM, spec.redline),
      reaction: 0.1 + (1 - skill) * 0.4 + r() * (0.05 + (1 - skill) * 0.15),
      shiftAt: clamp(0.96 + err2 * 0.2, 0.76, 1.0),
      lateness: err2 > 0.2 ? (err2 - 0.2) * 0.5 : 0,
      wantedAt: -1,
    };
  }

  /** A shift tap (live drivers only). A stray tap far below the zone is ignored. */
  tap(i: number): void {
    if (this.drivers[i]?.kind !== 'live') return;
    const r = this.racers[i]!;
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
    r.reaction = this.t - this.greenAt;
    r.phase = 'running';
    r.slip = r.spec.gears === 1 ? 0 : 3;
    r.bog = Math.pow(clamp(r.rpm / Math.max(IDLE_RPM + 1, idealLaunchRpm(r.spec)), 0.3, 1), 1.6);
    const spin = engineForce(r.spec, r.rpm, 1) > tractionLimit(r.spec, true);
    if (spin || r.failure === 'suspension') {
      r.spinLeft = (r.failure === 'suspension' ? 1.4 : 0.35) + 0.6 * clamp((engineForce(r.spec, r.rpm, 1) / tractionLimit(r.spec, true) - 1) * 2, 0, 1) * (1 - (r.spec.spinKeep - 0.72) * 2);
      this.events.push({ type: 'spin', i });
      if (r.failure === 'suspension') {
        this.events.push({ type: 'fail', i, part: 'suspension' });
        r.failAt = -1;
      }
    }
    this.events.push({ type: 'launch', i });
  }

  private shift(i: number): void {
    const r = this.racers[i]!;
    if (r.phase !== 'running' || r.gear >= r.spec.gears || r.stuck || r.dead) return;
    const frac = shiftRpm(r) / r.spec.redline;
    r.slip = 0;
    r.inZone = false;
    const bounced = r.limiterSince >= 0 && this.t - r.limiterSince > LATE_AFTER;
    let quality: ShiftQuality;
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
    while (this.ambersLit < AMBERS.length && this.t >= AMBERS[this.ambersLit]!) {
      this.ambersLit++;
      this.events.push({ type: 'amber', n: this.ambersLit });
    }
    if (!this.green && this.t >= this.greenAt) {
      this.green = true;
      this.events.push({ type: 'green' });
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
      const react = d.kind === 'policy' && plan ? plan.reaction : d.kind === 'script' ? d.script.reaction : PLAYER_REACTION;
      if (this.green && this.t >= this.greenAt + react) this.launch(i);
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
      } else if (d.kind === 'policy' && plan && shiftRpm(r) >= spec.redline * plan.shiftAt) {
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
    if (d.kind === 'live' && r.phase === 'running' && r.gear < spec.gears && !r.inZone && shiftRpm(r) >= spec.redline * PERFECT_FROM) {
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

/** Runs a whole race at once (forecasts, tests). */
export function simulate(specs: CarSpec[], drivers: Driver[], seed: number): RaceResult {
  const race = new Race(specs, drivers, seed);
  while (!race.done) race.step();
  return race.result();
}

/** The leaderboard number: higher is better, 0 for a breakdown. */
export function scoreOf(r: RacerResult): number {
  if (r.et === null) return 0;
  return Math.max(0, 20000 - Math.round(r.et * 1000) + 150 * r.perfect);
}

/** A solo run with a policy driver at a skill: what the car "should" do. */
export function forecastRun(spec: CarSpec, skill: number, seed = 1): { et: number; trap: number; t100: number } {
  const safe = { ...spec, risky: [] };
  const r = simulate([safe], [{ kind: 'policy', skill, seed }], seed).racers[0]!;
  return { et: r.et ?? MAX_TIME, trap: r.trap, t100: r.t100 };
}
export const forecastEt = (spec: CarSpec, skill: number, seed = 1): number => forecastRun(spec, skill, seed).et;

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
