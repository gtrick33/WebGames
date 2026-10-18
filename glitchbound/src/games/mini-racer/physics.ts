import type { SurfaceProps } from './track';

/** Arcade car handling. Pure functions over plain objects so it can run in tests at any rate. */

export interface CarSpec {
  /** Top speed on asphalt, units/s. */
  maxSpeed: number;
  accel: number;
  brake: number;
  reverseMax: number;
  /** Peak yaw rate, rad/s. */
  turnRate: number;
  /** Lateral grip (how fast sideways slip decays, 1/s). */
  grip: number;
  /** Lateral grip while the drift button is held. */
  driftGrip: number;
}

export const CAR: CarSpec = {
  maxSpeed: 440,
  accel: 460,
  brake: 820,
  reverseMax: 140,
  turnRate: 3.3,
  grip: 9,
  driftGrip: 1.6,
};

export interface CarState {
  x: number;
  y: number;
  /** Heading in radians (0 = +x). */
  a: number;
  vx: number;
  vy: number;
  /** Yaw rate. */
  av: number;
  /** Seconds of boost left. */
  boost: number;
}

export interface Input {
  /** -1 (left) .. 1 (right). */
  steer: number;
  throttle: number;
  brake: number;
  drift: boolean;
}

export const NO_INPUT: Input = { steer: 0, throttle: 0, brake: 0, drift: false };

export const CAR_RADIUS = 16;
/** Speed multiplier while boosting. */
export const BOOST_SPEED = 1.32;

export function newCar(x: number, y: number, a: number): CarState {
  return { x, y, a, vx: 0, vy: 0, av: 0, boost: 0 };
}

/** Forward and sideways speed in the car's frame (sideways positive = sliding to the car's right). */
export function localVelocity(car: CarState): { fwd: number; side: number } {
  const c = Math.cos(car.a);
  const s = Math.sin(car.a);
  return { fwd: car.vx * c + car.vy * s, side: -car.vx * s + car.vy * c };
}

export function speedOf(car: CarState): number {
  return Math.hypot(car.vx, car.vy);
}

/** Advances the car by dt seconds. Steering turns the body; grip then pulls the velocity in line, and what's left is drift. */
export function stepCar(car: CarState, input: Input, surf: SurfaceProps, dt: number, spec: CarSpec = CAR): void {
  const fwd0 = localVelocity(car).fwd;
  const top = spec.maxSpeed * surf.speed * (car.boost > 0 ? BOOST_SPEED : 1);
  const drifting = input.drift && Math.abs(fwd0) > 90;

  // Yaw: needs some speed to turn, reverses when backing up, a touch sharper while drifting.
  const grip01 = Math.min(1, Math.abs(fwd0) / 130);
  const highSpeedDamp = 1 - 0.28 * Math.min(1, Math.abs(fwd0) / spec.maxSpeed);
  const targetAv = input.steer * spec.turnRate * grip01 * highSpeedDamp * Math.sign(fwd0 || 1) * (drifting ? 1.3 : 1);
  car.av += (targetAv - car.av) * Math.min(1, (drifting ? 9 : 16) * dt);
  car.a += car.av * dt;

  // Re-express the (unchanged) world velocity in the turned frame: the difference is slip.
  const c = Math.cos(car.a);
  const s = Math.sin(car.a);
  let fwd = car.vx * c + car.vy * s;
  let side = -car.vx * s + car.vy * c;

  if (input.throttle > 0 && fwd < top) {
    const taper = 1 - Math.max(0, fwd / top) ** 2 * 0.85;
    fwd += spec.accel * surf.accel * input.throttle * taper * dt * (car.boost > 0 ? 1.6 : 1);
  }
  if (fwd > top) fwd -= (fwd - top) * Math.min(1, 2.6 * dt);
  if (input.brake > 0) {
    if (fwd > 8) fwd = Math.max(0, fwd - spec.brake * input.brake * dt);
    else fwd = Math.max(-spec.reverseMax, fwd - spec.accel * 0.6 * input.brake * dt);
  }
  // Rolling resistance (stronger when coasting) and surface drag.
  const roll = (input.throttle > 0 ? 0.12 : 0.55) + surf.drag;
  fwd -= fwd * roll * dt;
  if (drifting) fwd -= Math.sign(fwd) * 30 * dt;

  // Sliding converts a little sideways speed back into forward speed: drifts keep their momentum.
  const grip = (drifting ? spec.driftGrip : spec.grip) * surf.grip;
  const keep = Math.exp(-grip * dt);
  const lost = Math.abs(side) * (1 - keep);
  side *= keep;
  if (fwd > 0 && fwd < top) fwd = Math.min(top, fwd + lost * 0.35);

  car.vx = fwd * c - side * s;
  car.vy = fwd * s + side * c;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  car.boost = Math.max(0, car.boost - dt);
}

/**
 * Pushes the car out of a circle and bounces it. Returns the impact speed (0 if no contact).
 */
export function collideCircle(car: CarState, cx: number, cy: number, r: number, restitution = 0.35): number {
  const dx = car.x - cx;
  const dy = car.y - cy;
  const min = r + CAR_RADIUS;
  const d2 = dx * dx + dy * dy;
  if (d2 >= min * min) return 0;
  const d = Math.sqrt(d2) || 0.001;
  const nx = dx / d;
  const ny = dy / d;
  car.x = cx + nx * min;
  car.y = cy + ny * min;
  return bounce(car, nx, ny, restitution);
}

/** Keeps the car inside a rectangle (the edge of the world). Returns impact speed. */
export function collideBounds(car: CarState, b: { minX: number; minY: number; maxX: number; maxY: number }): number {
  let hit = 0;
  if (car.x < b.minX + CAR_RADIUS) {
    car.x = b.minX + CAR_RADIUS;
    hit = Math.max(hit, bounce(car, 1, 0, 0.3));
  } else if (car.x > b.maxX - CAR_RADIUS) {
    car.x = b.maxX - CAR_RADIUS;
    hit = Math.max(hit, bounce(car, -1, 0, 0.3));
  }
  if (car.y < b.minY + CAR_RADIUS) {
    car.y = b.minY + CAR_RADIUS;
    hit = Math.max(hit, bounce(car, 0, 1, 0.3));
  } else if (car.y > b.maxY - CAR_RADIUS) {
    car.y = b.maxY - CAR_RADIUS;
    hit = Math.max(hit, bounce(car, 0, -1, 0.3));
  }
  return hit;
}

function bounce(car: CarState, nx: number, ny: number, e: number): number {
  const vn = car.vx * nx + car.vy * ny;
  if (vn >= 0) return 0;
  car.vx -= (1 + e) * vn * nx;
  car.vy -= (1 + e) * vn * ny;
  // Scrub some tangential speed too, and kick the nose a little for feel.
  car.vx *= 0.82;
  car.vy *= 0.82;
  car.av *= 0.4;
  return -vn;
}
