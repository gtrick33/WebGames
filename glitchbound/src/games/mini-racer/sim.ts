import { leftOf, pointAt } from './geometry';
import { GhostRecorder, ghostPose, type Ghost, type Pose } from './ghost';
import { advanceLaps, bestLap, newLapState, type LapEvent, type LapState } from './laps';
import { LOOSE } from './cars';
import { CAR, collideBounds, collideCircle, localVelocity, newCar, onLoose, speedOf, stepCar, type CarSpec, type CarState } from './physics';
import { groundAt, SURFACES, type Ground, type Track } from './track';

/** One race: car + track + timing + drift scoring + ghost. Pure (no DOM); the view polls it. */

/** Every round is a short 3-lap race against the clock (and your ghost). */
export const RACE_LAPS = 3;
export const COUNTDOWN = 2.1;
export const DT = 1 / 120;

export type SimEvent =
  | LapEvent
  | { type: 'go' }
  | { type: 'bump'; impact: number }
  | { type: 'driftBank'; points: number; boost: boolean }
  | { type: 'driftLost'; points: number }
  | { type: 'boostPad' }
  | { type: 'finish' }
  | { type: 'bestLap'; time: number };

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

export interface Result {
  laps: LapState['laps'];
  /** Total race time (all laps valid), seconds. */
  raceTime: number | null;
  best: number | null;
  drift: number;
  cleanLaps: number;
  score: number;
}

export class RaceSim {
  readonly track: Track;
  readonly spec: CarSpec;
  car: CarState;
  prev: Pose;
  /** Race clock in seconds; negative during the countdown. */
  time = -COUNTDOWN;
  lap: LapState = newLapState();
  drift: DriftState = { chain: 0, chainTime: 0, idle: 0, total: 0, active: false };
  ground: Ground;
  finished = false;
  /** Ghost to race against (best lap on this track). */
  ghost: Ghost | null;
  /** The best valid lap of this round, with its recording. */
  newGhost: Ghost | null = null;
  private recorder = new GhostRecorder();
  private onBoostPad = false;
  /** Seconds the car has been heading the wrong way. */
  wrongWay = 0;
  private lastS = 0;

  constructor(track: Track, ghost: Ghost | null = null, spec: CarSpec = CAR) {
    this.track = track;
    this.spec = spec;
    this.ghost = ghost;
    const { x, y, a } = track.start;
    this.car = newCar(x, y, a);
    this.prev = { x, y, a };
    this.ground = groundAt(track, this.car);
    this.lastS = this.ground.s;
  }

  get racing(): boolean {
    return this.time >= 0 && !this.finished;
  }

  /** Seconds into the current lap (for the HUD and the ghost). */
  get lapTime(): number {
    return this.lap.started ? this.time - this.lap.lapStart : Math.max(0, this.time);
  }

  ghostPose(): Pose | null {
    if (!this.ghost || !this.lap.started) return null;
    return ghostPose(this.ghost, this.lapTime);
  }

  /** Advances one fixed step (DT) with the player's steering (-1..1); gas is automatic. */
  step(steer: number): SimEvent[] {
    const events: SimEvent[] = [];
    const car = this.car;
    this.prev = { x: car.x, y: car.y, a: car.a };
    if (this.finished) {
      stepCar(car, { steer: 0, throttle: 0, brake: 0.4 }, SURFACES[this.ground.surface], DT, this.spec);
      this.ground = groundAt(this.track, car);
      return events;
    }
    const t0 = this.time;
    this.time += DT;
    if (t0 < 0 && this.time >= 0) {
      events.push({ type: 'go' });
      this.recorder.begin(0);
    }
    const counting = this.time < 0;
    const p0 = { x: car.x, y: car.y };
    // The grid holds the car during the countdown, but let it rev (throttle ignored).
    if (!counting) stepCar(car, { steer, throttle: 1, brake: 0 }, this.surface(), DT, this.spec);

    // Obstacles and the world edge.
    let impact = collideBounds(car, this.track.bounds);
    for (const o of this.track.obstacles) impact = Math.max(impact, collideCircle(car, o.x, o.y, o.r));
    if (impact > 70) {
      events.push({ type: 'bump', impact });
      this.lap.bumped = true;
      if (this.drift.chain > 0) {
        events.push({ type: 'driftLost', points: Math.round(this.drift.chain) });
        this.drift.chain = 0;
        this.drift.chainTime = 0;
      }
    }

    this.ground = groundAt(this.track, car);
    if (this.ground.surface === 'boost') {
      if (!this.onBoostPad) events.push({ type: 'boostPad' });
      this.onBoostPad = true;
      car.boost = Math.max(car.boost, 1.1);
    } else this.onBoostPad = false;

    if (!counting) {
      this.scoreDrift(events);
      this.trackDirection();
      const lapEvents = advanceLaps(this.lap, this.track.checkpoints, p0, car, t0, this.time);
      for (const e of lapEvents) {
        events.push(e);
        if (e.type === 'lap') this.onLap(e.lap.time, e.lap.valid, events);
      }
      this.recorder.sample(this.time, this.lap.lapStart, car);
      if (this.isOver()) {
        this.finished = true;
        this.bankDrift(events);
        events.push({ type: 'finish' });
      }
    }
    return events;
  }

  /** The surface under the car, adjusted for this car's tyres. */
  private surface() {
    const s = this.ground.surface;
    return LOOSE.has(s) ? onLoose(SURFACES[s], this.spec.loose) : SURFACES[s];
  }

  private onLap(time: number, valid: boolean, events: SimEvent[]): void {
    const ghost = this.recorder.finish(time);
    this.recorder.begin(this.lap.lapStart);
    if (!valid) return;
    if (!this.newGhost || time < this.newGhost.time) {
      this.newGhost = ghost;
      if (!this.ghost || time < this.ghost.time) {
        events.push({ type: 'bestLap', time });
        // Race the new best from the next lap on.
        this.ghost = ghost;
      }
    }
  }

  private isOver(): boolean {
    return this.lap.laps.length >= RACE_LAPS;
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
    // A good slide pays out a mini-turbo.
    const boost = d.chainTime > 0.7 && !this.finished;
    if (boost) this.car.boost = Math.max(this.car.boost, Math.min(1.4, 0.35 + d.chainTime * 0.3));
    events.push({ type: 'driftBank', points, boost });
    d.chain = 0;
    d.chainTime = 0;
    d.idle = 0;
  }

  private trackDirection(): void {
    const s = this.ground.s;
    const L = this.track.path.length;
    let ds = s - this.lastS;
    if (ds > L / 2) ds -= L;
    if (ds < -L / 2) ds += L;
    this.lastS = s;
    const { t } = pointAt(this.track.path, s);
    const v = speedOf(this.car);
    const along = (this.car.vx * t.x + this.car.vy * t.y) / (v || 1);
    if (v > 60 && along < -0.5 && this.ground.d < this.track.half + 60) this.wrongWay += DT;
    else if (ds > 0 || v < 20) this.wrongWay = Math.max(0, this.wrongWay - DT * 3);
  }

  result(): Result {
    const laps = this.lap.laps;
    const best = bestLap(laps);
    const allValid = laps.length >= RACE_LAPS && laps.every((l) => l.valid);
    const raceTime = allValid ? laps.reduce((s, l) => s + l.time, 0) : null;
    const cleanLaps = laps.filter((l) => l.clean).length;
    return { laps, raceTime, best, drift: this.drift.total, cleanLaps, score: scoreFor(this.track.def.par, laps) };
  }
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
 * A simple driver that follows the racing line ahead. Used by tests (it must complete valid laps on
 * every track) and to compute fair gold times for generated daily tracks.
 */
export function autopilot(sim: RaceSim, lookahead = 150): number {
  const { car, track } = sim;
  const g = sim.ground;
  const ahead = Math.min(320, lookahead + speedOf(car) * 0.25);
  const { p, t } = pointAt(track.path, g.s + ahead);
  // Aim a little to the inside of the bend.
  const next = pointAt(track.path, g.s + ahead + 80).t;
  const bend = t.x * next.y - t.y * next.x;
  const n = leftOf(t);
  const inside = bend > 0 ? -1 : 1;
  let tx = p.x + n.x * inside * track.half * 0.3;
  let ty = p.y + n.y * inside * track.half * 0.3;
  // Steer around obstacles near the line to the target.
  for (const o of track.obstacles) {
    const dx = tx - car.x;
    const dy = ty - car.y;
    const len = Math.hypot(dx, dy) || 1;
    const along = ((o.x - car.x) * dx + (o.y - car.y) * dy) / len;
    if (along < 0 || along > len + 60) continue;
    const side = ((o.x - car.x) * -dy + (o.y - car.y) * dx) / len;
    const need = o.r + 34;
    if (Math.abs(side) > need) continue;
    // Shift the target away from the obstacle, towards the road centre if possible.
    const push = (need - Math.abs(side) + 10) * (side >= 0 ? -1 : 1);
    tx += (-dy / len) * push;
    ty += (dx / len) * push;
  }
  let want = Math.atan2(ty - car.y, tx - car.x) - car.a;
  while (want > Math.PI) want -= Math.PI * 2;
  while (want < -Math.PI) want += Math.PI * 2;
  return Math.max(-1, Math.min(1, want * 2.4));
}
