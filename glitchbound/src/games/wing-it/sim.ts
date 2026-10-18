/**
 * Wing It simulation: a one-tap flyer. Pure and deterministic (fixed time step, seeded course), so
 * the daily course is identical for everyone and every rule is unit tested. Rendering lives in
 * render.ts.
 *
 * World units: the view is W x H (portrait). y grows downward.
 */

export const W = 400;
export const H = 640;
export const GROUND = 586;
export const BIRD_X = 120;
export const BIRD_R = 15;
/** Collision radius: a little smaller than the drawn bird, so near misses feel fair. */
export const HIT_R = 12;
export const PILLAR_W = 70;
export const SPACING = 230;
export const STEP = 1 / 120;

const GRAVITY = 1850;
const FLAP_V = -570;
const MAX_FALL = 920;

export interface Pillar {
  /** Left edge. */
  x: number;
  /** Gap centre and half-height. */
  gapY: number;
  gapH: number;
  /** Vertical sway (0 = still) and its phase. */
  sway: number;
  phase: number;
  passed: boolean;
  /** A golden feather in this gap, until collected. */
  feather: boolean;
}

export interface Sim {
  seed: number;
  rand: number;
  t: number;
  y: number;
  vy: number;
  started: boolean;
  dead: boolean;
  score: number;
  feathers: number;
  pillars: Pillar[];
  /** Distance travelled (for parallax and course generation). */
  dist: number;
  /** Next pillar index to spawn (course position). */
  spawned: number;
  /** Wing animation timer. */
  flapT: number;
}

/** Deterministic PRNG step (mulberry32): returns [value 0..1, next state]. */
function next(state: number): [number, number] {
  const a = (state + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, a];
}

/** Gap height and sway grow harder with the pillar number. */
export const gapFor = (n: number): number => Math.max(132, 178 - n * 0.8);
export const speedFor = (score: number): number => Math.min(215, 150 + score * 1.3);

export function newSim(seed: number): Sim {
  const s: Sim = { seed, rand: seed >>> 0, t: 0, y: H * 0.42, vy: 0, started: false, dead: false, score: 0, feathers: 0, pillars: [], dist: 0, spawned: 0, flapT: 0 };
  // The first pillar starts a comfortable distance away.
  for (let i = 0; i < 4; i++) spawn(s, W + 140 + i * SPACING);
  return s;
}

function spawn(s: Sim, x: number): void {
  const n = s.spawned++;
  const [r1, a] = next(s.rand);
  const [r2, b] = next(a);
  const [r3, c] = next(b);
  const [r4, d] = next(c);
  s.rand = d;
  const gapH = gapFor(n);
  const prev = s.pillars[s.pillars.length - 1]?.gapY ?? H * 0.45;
  // Keep each gap reachable from the last one: limit the vertical jump.
  const lo = Math.max(120, prev - 120);
  const hi = Math.min(GROUND - 110, prev + 120);
  const gapY = lo + r1 * (hi - lo);
  // Moving gaps from pillar 15: a gentle drift a quick player can follow.
  const sway = n >= 15 && r2 < 0.3 ? 14 + r3 * 12 : 0;
  s.pillars.push({ x, gapY, gapH, sway, phase: r3 * Math.PI * 2, passed: false, feather: n >= 2 && r4 < 0.35 });
}

/** Where a pillar's gap is right now (sway moves it up and down). */
export const gapCentre = (p: Pillar, t: number): number => p.gapY + (p.sway ? Math.sin(t * 1.6 + p.phase) * p.sway : 0);

export function flap(s: Sim): void {
  if (s.dead) return;
  s.started = true;
  s.vy = FLAP_V;
  s.flapT = 0.18;
}

/** Circle vs rectangle overlap. */
function hits(cx: number, cy: number, r: number, x: number, y: number, w: number, h: number): boolean {
  const nx = Math.max(x, Math.min(cx, x + w));
  const ny = Math.max(y, Math.min(cy, y + h));
  return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r;
}

export type SimEvent = 'score' | 'feather' | 'crash';

/** Advances one fixed step. Before the first flap the bird hovers in place. */
export function step(s: Sim): SimEvent[] {
  const ev: SimEvent[] = [];
  if (s.dead) {
    // Fall to the ground after a crash.
    if (s.y < GROUND - BIRD_R) {
      s.vy = Math.min(MAX_FALL, s.vy + GRAVITY * STEP);
      s.y = Math.min(GROUND - BIRD_R, s.y + s.vy * STEP);
    }
    return ev;
  }
  s.t += STEP;
  s.flapT = Math.max(0, s.flapT - STEP);
  if (!s.started) {
    s.y = H * 0.42 + Math.sin(s.t * 4) * 8;
    return ev;
  }
  const v = speedFor(s.score);
  s.dist += v * STEP;
  s.vy = Math.min(MAX_FALL, s.vy + GRAVITY * STEP);
  s.y += s.vy * STEP;
  if (s.y < BIRD_R) {
    s.y = BIRD_R;
    s.vy = Math.max(0, s.vy);
  }
  for (const p of s.pillars) {
    p.x -= v * STEP;
    const cy = gapCentre(p, s.t);
    const top = cy - p.gapH / 2;
    const bottom = cy + p.gapH / 2;
    if (!p.passed && p.x + PILLAR_W < BIRD_X - HIT_R) {
      p.passed = true;
      s.score++;
      ev.push('score');
    }
    if (p.feather && Math.hypot(p.x + PILLAR_W / 2 - BIRD_X, cy - s.y) < BIRD_R + 12) {
      p.feather = false;
      s.feathers++;
      ev.push('feather');
    }
    if (hits(BIRD_X, s.y, HIT_R, p.x, -50, PILLAR_W, top + 50) || hits(BIRD_X, s.y, HIT_R, p.x, bottom, PILLAR_W, GROUND - bottom)) {
      s.dead = true;
    }
  }
  if (s.y + HIT_R >= GROUND) {
    s.y = GROUND - BIRD_R;
    s.dead = true;
  }
  if (s.dead) {
    ev.push('crash');
    s.vy = Math.min(s.vy, 0) + 120;
  }
  // Recycle pillars that left the screen and keep the course going.
  if (s.pillars[0] && s.pillars[0].x < -PILLAR_W - 20) s.pillars.shift();
  const last = s.pillars[s.pillars.length - 1]!;
  if (last.x < W + 60) spawn(s, last.x + SPACING);
  return ev;
}

export type Medal = 'bronze' | 'silver' | 'gold' | 'platinum' | null;
export const MEDALS: [Exclude<Medal, null>, number][] = [
  ['platinum', 100],
  ['gold', 50],
  ['silver', 25],
  ['bronze', 10],
];
export const medalFor = (score: number): Medal => MEDALS.find(([, n]) => score >= n)?.[0] ?? null;

/** Biome by score: the world changes every 15 points. */
export const BIOMES = ['meadow', 'sunset', 'night', 'space'] as const;
export type Biome = (typeof BIOMES)[number];
export const biomeFor = (score: number): Biome => BIOMES[Math.floor(score / 15) % BIOMES.length]!;

/** Run score for the arcade: pillars, plus 3 per golden feather. */
export const runPoints = (s: Pick<Sim, 'score' | 'feathers'>): number => s.score + s.feathers * 3;
