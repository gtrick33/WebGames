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
  /** Lateral grip at full slide (steering hard at speed lets the tail out). */
  driftGrip: number;
  /** Skill on loose ground (dirt, gravel, sand, grass...): above 1 loses less speed and grip there. */
  loose: number;
}

export const CAR: CarSpec = {
  maxSpeed: 440,
  accel: 460,
  brake: 820,
  reverseMax: 140,
  turnRate: 3.3,
  grip: 9,
  driftGrip: 1.6,
  loose: 1,
};

/** A loose surface as felt by a car with the given loose-ground skill. */
export function onLoose(surf: SurfaceProps, loose: number): SurfaceProps {
  if (loose === 1) return surf;
  return {
    speed: Math.min(1, 1 - (1 - surf.speed) / loose),
    accel: Math.min(1, 1 - (1 - surf.accel) / loose),
    grip: Math.min(1, surf.grip * loose),
    drag: surf.drag / loose,
  };
}

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
  /** 0..1: how far the tail is out. Builds while steering hard at speed, fades when you straighten up. */
  slide: number;
}

export interface Input {
  /** -1 (left) .. 1 (right). */
  steer: number;
  /** Automatic during a race (1); 0 while coasting after the finish. */
  throttle: number;
  brake: number;
}

/** How the car slides on a kind of track (see TRACK_TYPES). */
export interface Handling {
  /** Speed lost per second at full slide (units/s²). */
  scrub: number;
  /** Steering beyond this lets the tail out... */
  slideSteer: number;
  /** ...above this fraction of top speed. */
  slideSpeed: number;
  /** How fast the slide builds (1/s). */
  slideRate: number;
  /** Turn-in sharpness (yaw rate multiplier). */
  turnIn: number;
}

/** Grippy handling: hard steering at speed is needed before the tail steps out. */
export const GRIP_HANDLING: Handling = { scrub: 60, slideSteer: 0.55, slideSpeed: 0.42, slideRate: 2.6, turnIn: 1 };

export const NO_INPUT: Input = { steer: 0, throttle: 0, brake: 0 };

export const CAR_RADIUS = 16;
/** Speed multiplier while boosting. */
export const BOOST_SPEED = 1.32;

export function newCar(x: number, y: number, a: number): CarState {
  return { x, y, a, vx: 0, vy: 0, av: 0, boost: 0, slide: 0 };
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

/**
 * Advances the car by dt seconds. Steering turns the body; grip then pulls the velocity in line,
 * and what's left is drift. There is no drift button: holding a hard turn at speed lets the tail
 * step out (`slide`), which rotates the car faster and scrubs speed. How readily it slides, how sharp the
 * turn-in is and what a slide costs come from the track type (`Handling`).
 */
export function stepCar(car: CarState, input: Input, surf: SurfaceProps, dt: number, spec: CarSpec = CAR, h: Handling = GRIP_HANDLING): void {
  const fwd0 = localVelocity(car).fwd;
  const top = spec.maxSpeed * surf.speed * (car.boost > 0 ? BOOST_SPEED : 1);

  const wantSlide = Math.abs(input.steer) > h.slideSteer && fwd0 > spec.maxSpeed * h.slideSpeed;
  car.slide = Math.max(0, Math.min(1, car.slide + (wantSlide ? h.slideRate : -3.5) * dt));
  const sl = car.slide;

  // Yaw: needs some speed to turn, reverses when backing up, sharper while sliding.
  // Turning needs some speed, but a toy car can always pivot a little, so it can never get pinned
  // nose-first against a wall with automatic gas.
  const grip01 = Math.max(0.45, Math.min(1, Math.abs(fwd0) / 130));
  const highSpeedDamp = 1 - 0.3 * Math.min(1, Math.abs(fwd0) / spec.maxSpeed);
  const targetAv = input.steer * spec.turnRate * h.turnIn * grip01 * highSpeedDamp * Math.sign(fwd0 || 1) * (1 + 0.4 * sl);
  car.av += (targetAv - car.av) * Math.min(1, (16 - 6 * sl) * dt);
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
  // Rolling resistance (stronger when coasting), surface drag, and a little scrub while sliding.
  const roll = (input.throttle > 0 ? 0.12 : 0.55) + surf.drag;
  fwd -= fwd * roll * dt;
  // How much a slide costs depends on the track type (see TRACK_TYPES): cheap on rally, dear on circuits.
  fwd -= Math.sign(fwd) * h.scrub * sl * dt;

  // Sliding converts a little sideways speed back into forward speed: drifts keep their momentum.
  const grip = (spec.grip + (spec.driftGrip - spec.grip) * sl * 0.9) * surf.grip;
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

/**
 * Keeps the car off a tire-wall segment. The car slides along the wall: the push-out removes the
 * speed into it, a real impact scrubs some speed, and resting contact costs a little each step.
 * Returns the impact speed.
 */
export function collideSegment(car: CarState, ax: number, ay: number, bx: number, by: number, half: number): number {
  const ex = bx - ax;
  const ey = by - ay;
  const l2 = ex * ex + ey * ey || 1;
  let u = ((car.x - ax) * ex + (car.y - ay) * ey) / l2;
  u = u < 0 ? 0 : u > 1 ? 1 : u;
  const qx = ax + ex * u;
  const qy = ay + ey * u;
  const dx = car.x - qx;
  const dy = car.y - qy;
  const min = CAR_RADIUS + half;
  const d2 = dx * dx + dy * dy;
  if (d2 >= min * min) return 0;
  const d = Math.sqrt(d2) || 0.001;
  const nx = dx / d;
  const ny = dy / d;
  car.x = qx + nx * min;
  car.y = qy + ny * min;
  const vn = car.vx * nx + car.vy * ny;
  if (vn >= 0) return 0;
  car.vx -= 1.2 * vn * nx;
  car.vy -= 1.2 * vn * ny;
  if (-vn > 60) {
    car.vx *= 0.86;
    car.vy *= 0.86;
    car.av *= 0.5;
  } else {
    car.vx *= 0.993;
    car.vy *= 0.993;
  }
  return -vn;
}

/**
 * Car shape for car-to-car contact: two circles along the body (front and rear), sized to the drawn
 * car (about 50 long, 26 wide), so cars meet nose-to-tail and side-to-side where they look like they do.
 */
export const BODY_OFFSET = 12;
export const BODY_RADIUS = 13;
/** Rotational inertia of a car body (unit mass): resists spin from off-center hits. */
const BODY_INERTIA = 225;

function bodyCircles(car: CarState): [number, number, number, number] {
  const c = Math.cos(car.a) * BODY_OFFSET;
  const s = Math.sin(car.a) * BODY_OFFSET;
  return [car.x + c, car.y + s, car.x - c, car.y - s];
}

/**
 * Resolves contact between two cars of equal mass: separates every overlapping pair of body circles
 * and bounces their velocities (with a little spin from off-center hits). Returns the impact speed.
 */
export function collideCarPair(a: CarState, b: CarState, restitution = 0.3): number {
  const min = BODY_RADIUS * 2;
  // Quick reject: the bodies are too far apart to touch.
  const reach = (BODY_OFFSET + BODY_RADIUS) * 2;
  if ((b.x - a.x) ** 2 + (b.y - a.y) ** 2 >= reach * reach) return 0;
  let impact = 0;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        // Fresh positions every time: an earlier pair may already have moved the cars.
        const ca = bodyCircles(a);
        const cb = bodyCircles(b);
        const ax = ca[i * 2]!;
        const ay = ca[i * 2 + 1]!;
        const bx = cb[j * 2]!;
        const by = cb[j * 2 + 1]!;
        const dx = bx - ax;
        const dy = by - ay;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min) continue;
        const d = Math.sqrt(d2) || 0.001;
        const nx = d2 > 1e-6 ? dx / d : Math.cos(a.a + Math.PI / 2);
        const ny = d2 > 1e-6 ? dy / d : Math.sin(a.a + Math.PI / 2);
        const push = (min - d) / 2;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        if (pass > 0) continue;
        const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (vn >= 0) continue;
        const j2 = (-(1 + restitution) * vn) / 2;
        a.vx -= j2 * nx;
        a.vy -= j2 * ny;
        b.vx += j2 * nx;
        b.vy += j2 * ny;
        // Contact point is between the two circles; an off-center hit turns the cars a little.
        const px = (ax + bx) / 2;
        const py = (ay + by) / 2;
        const spinA = ((px - a.x) * -ny * j2 - (py - a.y) * -nx * j2) / BODY_INERTIA;
        const spinB = ((px - b.x) * ny * j2 - (py - b.y) * nx * j2) / BODY_INERTIA;
        a.av = Math.max(-4, Math.min(4, a.av + spinA));
        b.av = Math.max(-4, Math.min(4, b.av + spinB));
        impact = Math.max(impact, -vn);
      }
    }
  }
  return impact;
}

function bounce(car: CarState, nx: number, ny: number, e: number): number {
  const vn = car.vx * nx + car.vy * ny;
  if (vn >= 0) return 0;
  car.vx -= (1 + e) * vn * nx;
  car.vy -= (1 + e) * vn * ny;
  // A real impact scrubs speed and spin. Resting contact (pushing into a wall at a crawl) must not:
  // the car has to be able to turn away from it.
  if (-vn > 40) {
    car.vx *= 0.82;
    car.vy *= 0.82;
    car.av *= 0.4;
  }
  return -vn;
}
