import { leftOf, nearest, pointAt } from './geometry';
import { GhostRecorder, ghostPose, type Ghost, type Pose } from './ghost';
import { advanceLaps, bestLap, newLapState, type LapEvent, type LapState } from './laps';
import { CARS, LOOSE, specFor, type CarDef } from './cars';
import { CAR, CAR_RADIUS, collideBounds, collideCarPair, collideCircle, collideSegment, localVelocity, newCar, onLoose, speedOf, stepCar, type CarSpec, type CarState } from './physics';
import { SECTORS, SectorTimer, type SplitEvent, type Splits } from './sectors';
import { cellAt, groundAt, SURFACES, TRACK_TYPES, WALL_HALF, type Ground, type Track, type TrackTypeRules } from './track';

/**
 * One race: the player's car (and, in a race, AI rivals) on a track, with timing, sectors, drift
 * scoring and the ghost. Pure (no DOM); the view polls it.
 */

/** Every round is a short 3-lap race: alone against the clock (and your ghost), or against AI cars. */
export const RACE_LAPS = 3;
/** Seconds crawling, or off the road, before a car is put back on track. */
export const RESCUE_STUCK = 1.5;
export const RESCUE_OFFROAD = 3;
export const COUNTDOWN = 2.1;
export const DT = 1 / 120;

export type RaceMode = 'trial' | 'race';

export interface DriverStyle {
  /** Top speed / acceleration multiplier vs the car's own spec. */
  pace: number;
  /** How far towards the inside of a bend the driver aims (0 = centre line). */
  inside: number;
  /** Steering wobble amplitude (sloppier lines). */
  wobble: number;
  /** How quickly the driver turns the wheel (1/s). */
  steerRate: number;
  /** 0..1: how well the driver lifts off before a bend it can't take flat (the AI's "braking"). */
  lift: number;
  /** Extra grip (1 = the car's own). */
  grip: number;
  /** Mild catch-up strength (0 = none): only at low AI levels. */
  band: number;
}

/** The player's autopilot line (tests, gold times): auto gas like the player, no lifting. */
export const AUTOPILOT: DriverStyle = { pace: 1, inside: 0.3, wobble: 0, steerRate: 60, lift: 0, grip: 1, band: 0 };

/** Presets shown as quick taps next to the AI level slider. */
export const AI_PRESETS = [
  { level: 20, name: 'Rookie' },
  { level: 50, name: 'Racer' },
  { level: 80, name: 'Pro' },
  { level: 100, name: 'Legend' },
];
export const DEFAULT_AI_LEVEL = 50;

/** Piecewise-linear lookup over (level, value) knots. */
function knots(level: number, pts: [number, number][]): number {
  const l = Math.max(0, Math.min(100, level));
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i]!;
    const [x0, y0] = pts[i - 1]!;
    if (l <= x1) return y0 + ((y1 - y0) * (l - x0)) / (x1 - x0);
  }
  return pts[pts.length - 1]![1];
}

/**
 * The AI driver for a level from 0 to 100 (like the F1 games' AI slider). Every quality rises smoothly:
 * 0 is slow and wobbly, ~50 is a decent player, 90+ is very fast, and 100 drives a near-perfect line
 * with early lifts, crisp steering and a little extra pace and grip, so very few players can match it.
 */
export function aiStyle(level: number): DriverStyle {
  return {
    pace: knots(level, [
      [0, 0.84],
      [50, 0.96],
      [90, 1.01],
      [100, 1.045],
    ]),
    inside: knots(level, [
      [0, 0.06],
      [50, 0.22],
      [90, 0.3],
      [100, 0.32],
    ]),
    wobble: knots(level, [
      [0, 0.34],
      [50, 0.08],
      [90, 0.01],
      [100, 0],
    ]),
    steerRate: knots(level, [
      [0, 5],
      [50, 15],
      [90, 36],
      [100, 60],
    ]),
    lift: knots(level, [
      [0, 0],
      [40, 0.2],
      [90, 0.85],
      [100, 1],
    ]),
    grip: knots(level, [
      [0, 1],
      [90, 1],
      [100, 1.04],
    ]),
    // Only weak AI gets a little help when far behind; no slowing down when ahead.
    band: knots(level, [
      [0, 0.04],
      [40, 0],
      [100, 0],
    ]),
  };
}

/** Mild catch-up distance: weak AI more than this far behind the player gets `band` more pace. */
const BAND_DIST = 700;

export const RIVAL_NAMES = ['Rosa Rally', 'Turbo Tam', 'Mo Mudflap', 'Kiki Kerb', 'Dash Delgado', 'Pip Junior'];

export type SimEvent =
  | LapEvent
  | { type: 'go' }
  | { type: 'bump'; impact: number }
  | { type: 'driftBank'; points: number; boost: boolean }
  | { type: 'driftLost'; points: number }
  | { type: 'boostPad' }
  | { type: 'finish' }
  | { type: 'bestLap'; time: number }
  | { type: 'rescue' }
  | { type: 'split'; split: SplitEvent }
  | { type: 'position'; position: number };

export interface DriftState {
  /** Points in the current unbroken drift chain. */
  chain: number;
  chainTime: number;
  /** Seconds since the car stopped sliding. */
  idle: number;
  /** Banked points this round. */
  total: number;
  /** Currently sliding sideways enough to score. */
  active: boolean;
}

/** One car in the race: the player (index 0) or an AI rival. */
export class Racer {
  readonly name: string;
  readonly look: Pick<CarDef, 'shape' | 'body' | 'accent'>;
  readonly spec: CarSpec;
  /** AI driving style; null for the player. */
  readonly style: DriverStyle | null;
  private readonly specs: { base: CarSpec; fast: CarSpec; slow: CarSpec };
  car: CarState;
  prev: Pose;
  lap: LapState = newLapState();
  ground: Ground;
  /** Race time when the car finished its last lap, or null. */
  finishTime: number | null = null;
  steer = 0;
  throttle = 1;
  brake = 0;
  wrongWay = 0;
  lastS = 0;
  stuckTime = 0;
  offTime = 0;
  onBoostPad = false;
  /** Pace adjustment from the mild catch-up (1 = boosted, 0 = normal). */
  band = 0;
  readonly phase: number;

  constructor(track: Track, x: number, y: number, a: number, spec: CarSpec, look: Racer['look'], name: string, style: DriverStyle | null, phase = 0) {
    this.name = name;
    this.look = look;
    this.style = style;
    const pace = style?.pace ?? 1;
    const grip = style?.grip ?? 1;
    const scaled = (m: number): CarSpec => ({
      ...spec,
      maxSpeed: spec.maxSpeed * pace * m,
      accel: spec.accel * Math.sqrt(pace) * m,
      grip: spec.grip * grip,
      driftGrip: spec.driftGrip * grip,
    });
    const band = style?.band ?? 0;
    this.specs = { base: scaled(1), fast: scaled(1 + band), slow: scaled(1) };
    this.spec = this.specs.base;
    this.car = newCar(x, y, a);
    this.prev = { x, y, a };
    this.ground = groundAt(track, this.car);
    this.lastS = this.ground.s;
    this.phase = phase;
  }

  /** Spec for this step (includes the AI's mild catch-up). */
  get stepSpec(): CarSpec {
    return this.band > 0 ? this.specs.fast : this.band < 0 ? this.specs.slow : this.specs.base;
  }

  /** Distance driven in the race (for positions): laps x length + distance past the line. */
  progress(L: number): number {
    return this.lap.started ? this.lap.laps.length * L + this.ground.s : this.ground.s - L;
  }
}

export interface Standing {
  name: string;
  player: boolean;
  /** Finish time in seconds, or null if still racing when the player finished. */
  time: number | null;
  look: Racer['look'];
}

export interface Result {
  mode: RaceMode;
  laps: LapState['laps'];
  /** Total race time (all laps valid), seconds. */
  raceTime: number | null;
  best: number | null;
  drift: number;
  cleanLaps: number;
  score: number;
  /** Finishing position (1-based) in a race against AI; null in Time Trial. */
  position: number | null;
  /** AI level raced (0-100); null in Time Trial. */
  aiLevel: number | null;
  /** Score bonus for finishing ahead of AI rivals (included in `score`). */
  levelBonus: number;
  standings: Standing[];
  /** Cumulative splits of each valid lap, and of the best lap. */
  splits: Splits[];
  bestSplits: Splits | null;
  /** Every split shown during the race (lap, sector, sector time, delta vs the reference then). */
  splitLog: SplitLogEntry[];
}

export interface SplitLogEntry {
  lap: number;
  sector: number;
  sectorTime: number;
  delta: number | null;
}

export interface RaceOptions {
  mode?: RaceMode;
  /** AI level 0-100 (races only). */
  aiLevel?: number;
  /** Number of AI rivals in a race (default 3). */
  rivals?: number;
  /** The player's car id (rivals get other cars). */
  playerCar?: string;
  /** Reference splits for sector deltas in Time Trial (best-ever lap on this track). */
  bestSplits?: Splits | null;
}

export class RaceSim {
  readonly track: Track;
  readonly mode: RaceMode;
  readonly aiLevel: number;
  readonly racers: Racer[];
  /** Race clock in seconds; negative during the countdown. */
  time = -COUNTDOWN;
  drift: DriftState = { chain: 0, chainTime: 0, idle: 0, total: 0, active: false };
  finished = false;
  /** Ghost to race against (best lap on this track; Time Trial only). */
  ghost: Ghost | null;
  /** The best valid lap of this round, with its recording. */
  newGhost: Ghost | null = null;
  readonly sectors: SectorTimer;
  /** Reference splits for Time Trial (best-ever lap; updated when you beat it). */
  private bestSplitsRef: Splits | null;
  /** Current position of the player (1-based) and the running order. */
  position = 1;
  order: Racer[] = [];
  private recorder = new GhostRecorder();
  private standings: Standing[] = [];
  readonly splitLog: SplitLogEntry[] = [];

  constructor(track: Track, ghost: Ghost | null = null, spec: CarSpec = CAR, opts: RaceOptions = {}) {
    this.track = track;
    this.mode = opts.mode ?? 'trial';
    this.aiLevel = Math.max(0, Math.min(100, Math.round(opts.aiLevel ?? DEFAULT_AI_LEVEL)));
    this.ghost = this.mode === 'trial' ? ghost : null;
    this.bestSplitsRef = opts.bestSplits ?? null;
    this.sectors = new SectorTimer(track.checkpoints.length);
    const playerLook = CARS.find((c) => c.id === opts.playerCar) ?? CARS[0]!;
    if (this.mode === 'trial') {
      const { x, y, a } = track.start;
      this.racers = [new Racer(track, x, y, a, spec, playerLook, 'You', null)];
    } else {
      // A 2-wide grid behind the line; the player starts at the back.
      const rivals = opts.rivals ?? 3;
      const style = aiStyle(this.aiLevel);
      const looks = CARS.filter((c) => c.id !== playerLook.id && c.unlock.type !== 'golds');
      const slots = Array.from({ length: rivals + 1 }, (_, i) => gridSlot(track, i));
      const me = slots[rivals]!;
      this.racers = [new Racer(track, me.x, me.y, me.a, spec, playerLook, 'You', null)];
      for (let i = 0; i < rivals; i++) {
        const car = looks[(i * 3 + 1) % looks.length]!;
        // Rivals all drive the starter's balanced handling; their pace comes from the difficulty.
        this.racers.push(new Racer(track, slots[i]!.x, slots[i]!.y, slots[i]!.a, specFor(CARS[0]!), car, RIVAL_NAMES[i % RIVAL_NAMES.length]!, style, i * 1.7));
      }
    }
    this.updateOrder();
  }

  /** What drifting does on this track (its type). */
  get rules(): TrackTypeRules {
    return TRACK_TYPES[this.track.def.type];
  }

  // --- Player shortcuts (the HUD, the engine and most tests talk about the player's car). ---
  get player(): Racer {
    return this.racers[0]!;
  }
  get car(): CarState {
    return this.player.car;
  }
  get prev(): Pose {
    return this.player.prev;
  }
  get lap(): LapState {
    return this.player.lap;
  }
  get ground(): Ground {
    return this.player.ground;
  }
  get spec(): CarSpec {
    return this.player.spec;
  }
  get wrongWay(): number {
    return this.player.wrongWay;
  }
  get rivals(): Racer[] {
    return this.racers.slice(1);
  }

  get racing(): boolean {
    return this.time >= 0 && !this.finished;
  }

  /** Seconds into the player's current lap (for the HUD and the ghost). */
  get lapTime(): number {
    return this.lap.started ? this.time - this.lap.lapStart : Math.max(0, this.time);
  }

  /** The splits the current lap is compared with: best-ever in Time Trial, previous lap in a race. */
  get reference(): Splits | null {
    return this.mode === 'trial' ? this.bestSplitsRef : this.sectors.previous;
  }

  ghostPose(): Pose | null {
    if (!this.ghost || !this.lap.started) return null;
    return ghostPose(this.ghost, this.lapTime);
  }

  /** Advances one fixed step (DT) with the player's steering (-1..1); gas is automatic. */
  step(steer: number): SimEvent[] {
    const events: SimEvent[] = [];
    const t0 = this.time;
    if (this.finished) {
      // Everyone coasts to a stop behind the line.
      for (const r of this.racers) {
        r.prev = { x: r.car.x, y: r.car.y, a: r.car.a };
        stepCar(r.car, { steer: 0, throttle: 0, brake: 0.4 }, SURFACES[r.ground.surface], DT, r.spec, this.rules);
        this.collideWorld(r);
        r.ground = groundAt(this.track, r.car, r.ground.i);
      }
      return events;
    }
    this.time += DT;
    if (t0 < 0 && this.time >= 0) {
      events.push({ type: 'go' });
      this.recorder.begin(0);
      this.sectors.begin();
    }
    const counting = this.time < 0;
    const L = this.track.path.length;
    const playerProgress = this.player.progress(L);

    for (const r of this.racers) {
      r.prev = { x: r.car.x, y: r.car.y, a: r.car.a };
      if (counting) continue;
      if (r.style) {
        const d = r.progress(L) - playerProgress;
        r.band = d < -BAND_DIST ? 1 : 0;
        const ctl = drive(this.track, r, r.style, this.racers, this.time);
        r.steer += (ctl.steer - r.steer) * Math.min(1, r.style.steerRate * DT);
        r.throttle = ctl.throttle;
        r.brake = ctl.brake;
      } else r.steer = steer;
      stepCar(r.car, { steer: r.steer, throttle: r.style ? r.throttle : 1, brake: r.style ? r.brake : 0 }, this.surfaceFor(r), DT, r.stepSpec, this.rules);
      const impact = this.collideWorld(r);
      if (r === this.player && impact > 70) this.onPlayerBump(impact, events);
    }
    if (!counting && this.racers.length > 1) {
      const impact = this.collideCars();
      if (impact > 70) this.onPlayerBump(impact, events);
    }

    for (const r of this.racers) {
      r.ground = groundAt(this.track, r.car, r.ground.i);
      if (r.ground.surface === 'boost') {
        if (!r.onBoostPad && r === this.player) events.push({ type: 'boostPad' });
        r.onBoostPad = true;
        r.car.boost = Math.max(r.car.boost, 1.1);
      } else r.onBoostPad = false;
      if (counting) continue;
      this.trackDirection(r);
      const lapEvents = advanceLaps(r.lap, this.track.checkpoints, r.prev, r.car, t0, this.time);
      if (r === this.player) {
        for (const e of lapEvents) {
          events.push(e);
          if (e.type === 'checkpoint') {
            const split = this.sectors.checkpoint(e.index, e.time, this.reference);
            if (split) this.logSplit(split, events);
          } else if (e.type === 'missed') this.sectors.miss();
          else if (e.type === 'lap') {
            const split = this.sectors.lap(e.lap.time, e.lap.valid, this.reference);
            if (split) this.logSplit(split, events);
            this.onLap(e.lap.time, e.lap.valid, events);
          }
        }
      }
      if (r.finishTime === null && r.lap.laps.length >= RACE_LAPS) r.finishTime = this.time;
      if (needsRescue(r, this.time)) {
        rescue(this.track, r);
        if (r === this.player) {
          this.endChain();
          events.push({ type: 'rescue' });
        }
      }
    }

    if (!counting) {
      this.scoreDrift(events);
      this.recorder.sample(this.time, this.lap.lapStart, this.car);
      const before = this.position;
      this.updateOrder();
      if (this.mode === 'race' && this.position !== before) events.push({ type: 'position', position: this.position });
      if (this.player.finishTime !== null) {
        this.finished = true;
        this.bankDrift(events);
        this.standings = this.order.map((r) => ({ name: r.name, player: r === this.player, time: r.finishTime, look: r.look }));
        events.push({ type: 'finish' });
      }
    }
    return events;
  }

  private logSplit(split: SplitEvent, events: SimEvent[]): void {
    events.push({ type: 'split', split });
    // The last sector's split arrives with the lap itself, which is already counted.
    const lap = this.lap.laps.length + (split.sector === SECTORS - 1 ? 0 : 1);
    this.splitLog.push({ lap, sector: split.sector, sectorTime: split.sectorTime, delta: split.delta });
  }

  private onPlayerBump(impact: number, events: SimEvent[]): void {
    events.push({ type: 'bump', impact });
    this.lap.bumped = true;
    if (this.drift.chain > 0) {
      events.push({ type: 'driftLost', points: Math.round(this.drift.chain) });
      this.endChain();
    }
  }

  private endChain(): void {
    this.drift.chain = 0;
    this.drift.chainTime = 0;
  }

  /** Tyre walls, obstacles, scenery and the world edge. Returns the hardest impact. */
  private collideWorld(r: Racer): number {
    const car = r.car;
    let impact = collideBounds(car, this.track.bounds);
    const cell = cellAt(this.track, car.x, car.y);
    for (const i of cell.segs) {
      const s = this.track.segs[i]!;
      impact = Math.max(impact, collideSegment(car, s.ax, s.ay, s.bx, s.by, WALL_HALF));
    }
    for (const i of cell.solids) {
      const o = this.track.solids[i]!;
      impact = Math.max(impact, collideCircle(car, o.x, o.y, o.r));
    }
    return impact;
  }

  /** Car-to-car contact (front and rear of each body, equal masses, a soft bounce). Returns the player's hardest impact. */
  private collideCars(): number {
    let playerImpact = 0;
    const rs = this.racers;
    // A few sweeps so a pile-up of three or four cars settles (bounces only apply while cars close in).
    for (let sweep = 0; sweep < 3; sweep++) {
      for (let i = 0; i < rs.length; i++) {
        for (let j = i + 1; j < rs.length; j++) {
          const impact = collideCarPair(rs[i]!.car, rs[j]!.car);
          if (i === 0) playerImpact = Math.max(playerImpact, impact);
        }
      }
    }
    return playerImpact;
  }

  /** The surface under a car, adjusted for its tyres. */
  private surfaceFor(r: Racer) {
    const s = r.ground.surface;
    return LOOSE.has(s) ? onLoose(SURFACES[s], r.spec.loose) : SURFACES[s];
  }

  private updateOrder(): void {
    const L = this.track.path.length;
    this.order = [...this.racers].sort((a, b) => {
      if (a.finishTime !== null || b.finishTime !== null) {
        if (a.finishTime === null) return 1;
        if (b.finishTime === null) return -1;
        return a.finishTime - b.finishTime;
      }
      return b.progress(L) - a.progress(L);
    });
    this.position = this.order.indexOf(this.player) + 1;
  }

  private onLap(time: number, valid: boolean, events: SimEvent[]): void {
    const ghost = this.recorder.finish(time);
    this.recorder.begin(this.lap.lapStart);
    if (!valid) return;
    if (!this.newGhost || time < this.newGhost.time) {
      this.newGhost = ghost;
      if (!this.ghost || time < this.ghost.time) {
        events.push({ type: 'bestLap', time });
        if (this.mode === 'trial') {
          // Race the new best from the next lap on, and compare sectors with it.
          this.ghost = ghost;
          this.bestSplitsRef = this.sectors.previous;
        }
      }
    }
  }

  private scoreDrift(events: SimEvent[]): void {
    const { fwd, side } = localVelocity(this.car);
    const d = this.drift;
    const sliding = Math.abs(side) > 55 && fwd > 120 && this.ground.onRoad;
    d.active = sliding;
    if (sliding) {
      d.idle = 0;
      d.chainTime += DT;
      // Faster and more sideways = more points; long chains multiply.
      const mult = 1 + Math.min(3, Math.floor(d.chainTime / 1.5));
      d.chain += ((Math.abs(side) * fwd) / 2400) * mult * DT * 10;
    } else if (d.chain > 0) {
      d.idle += DT;
      if (d.idle > 0.45) this.bankDrift(events);
    }
  }

  private bankDrift(events: SimEvent[]): void {
    const d = this.drift;
    if (d.chain <= 0) return;
    const points = Math.round(d.chain);
    d.total += points;
    // A good slide pays out a mini-turbo, but only where the track type rewards drifting (rally).
    const turbo = this.rules.turbo;
    const boost = turbo > 0 && d.chainTime > 0.7 && !this.finished;
    if (boost) this.car.boost = Math.max(this.car.boost, Math.min(1.6, (0.35 + d.chainTime * 0.3) * turbo));
    events.push({ type: 'driftBank', points, boost });
    d.chain = 0;
    d.chainTime = 0;
    d.idle = 0;
  }

  private trackDirection(r: Racer): void {
    const s = r.ground.s;
    const L = this.track.path.length;
    let ds = s - r.lastS;
    if (ds > L / 2) ds -= L;
    if (ds < -L / 2) ds += L;
    r.lastS = s;
    const { t } = pointAt(this.track.path, s);
    const v = speedOf(r.car);
    const along = (r.car.vx * t.x + r.car.vy * t.y) / (v || 1);
    if (v > 60 && along < -0.5 && r.ground.d < this.track.half + 60) r.wrongWay += DT;
    else if (ds > 0 || v < 20) r.wrongWay = Math.max(0, r.wrongWay - DT * 3);
  }

  /**
   * Race points bonus for beating AI rivals: (level / 100) x 100 points per rival finishing behind you,
   * so at most 300 on top of ~3000. Only for a counted race (all laps valid).
   */
  levelBonus(counted: boolean): number {
    if (this.mode !== 'race' || !counted) return 0;
    const beaten = this.racers.length - this.position;
    return Math.round(this.aiLevel * beaten);
  }

  result(): Result {
    const laps = this.lap.laps;
    const best = bestLap(laps);
    const allValid = laps.length >= RACE_LAPS && laps.every((l) => l.valid);
    const raceTime = allValid ? laps.reduce((s, l) => s + l.time, 0) : null;
    const cleanLaps = laps.filter((l) => l.clean).length;
    const splits = this.sectors.laps;
    let bestSplits: Splits | null = null;
    for (const sp of splits) if (!bestSplits || sp[sp.length - 1]! < bestSplits[bestSplits.length - 1]!) bestSplits = sp;
    return {
      mode: this.mode,
      laps,
      raceTime,
      best,
      drift: this.drift.total,
      cleanLaps,
      score: scoreFor(this.track.def.par, laps) + this.levelBonus(raceTime !== null),
      position: this.mode === 'race' ? this.position : null,
      aiLevel: this.mode === 'race' ? this.aiLevel : null,
      levelBonus: this.levelBonus(raceTime !== null),
      standings: this.standings.length ? this.standings : this.order.map((r) => ({ name: r.name, player: r === this.player, time: r.finishTime, look: r.look })),
      splits,
      bestSplits,
      splitLog: this.splitLog,
    };
  }
}

/** Grid slot i (0 = pole): a staggered two-column grid behind the line, rows 70 units apart. */
export function gridSlot(track: Track, i: number): { x: number; y: number; a: number } {
  const L = track.path.length;
  const row = Math.floor(i / 2);
  const { p, t } = pointAt(track.path, L - 46 - row * 70 - (i % 2) * 25);
  const n = leftOf(t);
  const side = (i % 2 === 0 ? 1 : -1) * track.half * 0.42;
  return { x: p.x + n.x * side, y: p.y + n.y * side, a: Math.atan2(t.y, t.x) };
}

/**
 * Gas is automatic, so a car that is pinned (crawling for a while) or lost off the road needs a way
 * back: it is put back on the road, facing the right way, like a marshal's tow.
 */
function needsRescue(r: Racer, time: number): boolean {
  const v = speedOf(r.car);
  r.stuckTime = v < 70 && time > 1 ? r.stuckTime + DT : 0;
  r.offTime = !r.ground.onRoad ? r.offTime + DT : 0;
  return r.stuckTime > RESCUE_STUCK || r.offTime > RESCUE_OFFROAD;
}

function rescue(t: Track, r: Racer): void {
  // Back onto whichever road is closer (the shortcut too), so no checkpoint is skipped.
  let path = t.path;
  let s = r.ground.s;
  if (t.shortcut) {
    const sc = nearest(t.shortcut.path, r.car);
    if (sc.d < r.ground.d) {
      path = t.shortcut.path;
      s = sc.s;
    }
  }
  const { p, t: tan } = pointAt(path, s);
  const car = r.car;
  car.x = p.x;
  car.y = p.y;
  car.a = Math.atan2(tan.y, tan.x);
  car.vx = tan.x * 120;
  car.vy = tan.y * 120;
  car.av = 0;
  car.slide = 0;
  r.prev = { x: car.x, y: car.y, a: car.a };
  r.ground = groundAt(t, car);
  r.lastS = r.ground.s;
  r.stuckTime = 0;
  r.offTime = 0;
  r.wrongWay = 0;
  r.steer = 0;
  r.lap.bumped = true;
}

/**
 * The ranking value sent to the arcade leaderboard (higher is better, comparable across tracks):
 * for each valid lap, 1000 x gold time / lap time. A 3-lap race at gold pace scores about 3000;
 * a lap that missed a checkpoint scores 0.
 */
export function scoreFor(parMs: number, laps: { time: number; valid: boolean }[]): number {
  let s = 0;
  for (const l of laps) if (l.valid && l.time > 0) s += Math.round(parMs / l.time);
  return s;
}

/**
 * A driver that follows the racing line ahead, dodging obstacles and other cars. AI rivals use it
 * with their difficulty's style; the player's autopilot (tests, gold times) uses AUTOPILOT.
 */
export function drive(track: Track, r: Racer, style: DriverStyle, others: Racer[] = [], time = 0, lookahead = 150): { steer: number; throttle: number; brake: number } {
  const car = r.car;
  const g = r.ground;
  const ahead = Math.min(320, lookahead + speedOf(car) * 0.25);
  const { p, t } = pointAt(track.path, g.s + ahead);
  // Aim towards the inside of the bend (better drivers use more of it).
  const next = pointAt(track.path, g.s + ahead + 80).t;
  const bend = t.x * next.y - t.y * next.x;
  const n = leftOf(t);
  const inside = bend > 0 ? -1 : 1;
  let tx = p.x + n.x * inside * track.half * style.inside;
  let ty = p.y + n.y * inside * track.half * style.inside;
  // Steer around obstacles and cars near the line to the target.
  const dodge = (ox: number, oy: number, rad: number): void => {
    const dx = tx - car.x;
    const dy = ty - car.y;
    const len = Math.hypot(dx, dy) || 1;
    const along = ((ox - car.x) * dx + (oy - car.y) * dy) / len;
    if (along < 0 || along > len + 60) return;
    const side = ((ox - car.x) * -dy + (oy - car.y) * dx) / len;
    const need = rad + 34;
    if (Math.abs(side) > need) return;
    const push = (need - Math.abs(side) + 10) * (side >= 0 ? -1 : 1);
    tx += (-dy / len) * push;
    ty += (dx / len) * push;
  };
  for (const o of track.obstacles) dodge(o.x, o.y, o.r);
  for (const o of others) if (o !== r) dodge(o.car.x, o.car.y, CAR_RADIUS);
  // Keep the aim point on the road even after dodging.
  const lat = (tx - p.x) * n.x + (ty - p.y) * n.y;
  const maxLat = track.half - 24;
  if (Math.abs(lat) > maxLat) {
    const fix = Math.sign(lat) * maxLat - lat;
    tx += n.x * fix;
    ty += n.y * fix;
  }
  let want = Math.atan2(ty - car.y, tx - car.x) - car.a;
  while (want > Math.PI) want -= Math.PI * 2;
  while (want < -Math.PI) want += Math.PI * 2;
  const wobble = style.wobble * Math.sin(time * 1.7 + r.phase) * Math.sin(time * 0.6 + r.phase * 2);
  let steer = Math.max(-1, Math.min(1, want * 2.4 + wobble));
  let throttle = 1;
  let brake = 0;
  const fwd = localVelocity(car).fwd;
  const fast = fwd > r.spec.maxSpeed * 0.42;
  // Where sliding is punished (circuits, ovals), AI drivers keep the car tidy: steer short of the
  // slide threshold and lift off for the rest, instead of drifting.
  const tidy = TRACK_TYPES[track.def.type].slideSteer - 0.01;
  if (r.style && TRACK_TYPES[track.def.type].noDrift && fast && Math.abs(steer) > tidy) {
    // Only a tight bend needs a lift; a skilled driver lifts just enough, a weak one too much.
    // Instead of sliding, brake into a bend that's too tight to take flat: skilled drivers brake
    // precisely, weak ones lift late and run wide.
    const over = Math.abs(steer) - tidy;
    steer = Math.sign(steer) * tidy;
    if (over > 0.12) {
      throttle = 0;
      brake = Math.min(1, (over - 0.12) * (0.6 + 2.4 * style.lift));
    }
  }
  // Skilled drivers also ease off a little before a very sharp bend (their "braking").
  if (r.style && style.lift > 0 && fast) {
    const far = pointAt(track.path, g.s + ahead + 160).t;
    const sharp = Math.abs(Math.atan2(t.x * far.y - t.y * far.x, t.x * far.x + t.y * far.y));
    if (sharp > 1.1 && fwd > r.spec.maxSpeed * 0.9) throttle = Math.min(throttle, 1 - style.lift * 0.4);
  }
  return { steer, throttle, brake };
}

/** The player's autopilot: used by tests (it must complete valid laps on every track) and for daily gold times. */
export function autopilot(sim: RaceSim, lookahead = 150): number {
  return drive(sim.track, sim.player, AUTOPILOT, sim.racers, sim.time, lookahead).steer;
}
