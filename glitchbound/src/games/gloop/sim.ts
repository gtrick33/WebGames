/**
 * Gloop simulation: round jelly blobs dropped into a jar. Two blobs of the same size that touch merge
 * into the next size up. The round ends when the jar stays filled past the line. Pure and stepped at
 * a fixed STEP; the seed decides which blobs come next, so a daily or challenge deals everyone the
 * same blobs (where they land is up to the player).
 */

export const W = 360;
export const H = 600;
/** Blobs resting above this line for too long end the round. */
export const LINE = 120;
export const DROP_Y = 62;
export const STEP = 1 / 120;
const GRAVITY = 1500;
const OVER_AFTER = 1.6;
const DROP_COOLDOWN = 0.45;

/** Radius and merge points per size; the biggest two merging pop for a bonus. */
export const RADII = [15, 20, 26, 33, 40, 48, 57, 67, 78, 90, 104];
export const POINTS = [1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 66];
export const TOP_BONUS = 100;
export const TIERS = RADII.length;
/** Only the five smallest sizes are ever dealt. */
const DEAL_WEIGHTS = [30, 27, 20, 14, 9];

/** mulberry32: a tiny deterministic RNG, so a seed gives everyone the same round. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The size of blob number `n` in the round with this seed. */
export function tierAt(seed: number, n: number): number {
  const r = rng((seed ^ Math.imul(n + 1, 0x27d4eb2d)) >>> 0);
  r();
  let pick = r() * 100;
  let t = 0;
  while (pick >= DEAL_WEIGHTS[t]!) pick -= DEAL_WEIGHTS[t++]!;
  return t;
}

export interface Blob {
  id: number;
  tier: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  /** Seconds since it was dropped or made. */
  age: number;
  /** Seconds it has spent above the line. */
  high: number;
  /** A squash for the merge pop, decaying to 0. */
  pop: number;
}

export interface Sim {
  seed: number;
  blobs: Blob[];
  /** How many blobs have been dropped; the next one is tierAt(seed, dealt). */
  dealt: number;
  aim: number;
  cooldown: number;
  score: number;
  merges: number;
  /** Biggest size made so far (index into RADII). */
  biggest: number;
  t: number;
  over: boolean;
  /** Highest danger (0-1) of any blob above the line, for the warning glow. */
  danger: number;
  nextId: number;
  started: boolean;
}

export type SimEvent = { type: 'drop' } | { type: 'merge'; tier: number; x: number; y: number } | { type: 'top'; x: number; y: number } | { type: 'over' };

export function newSim(seed: number): Sim {
  return { seed, blobs: [], dealt: 0, aim: W / 2, cooldown: 0, score: 0, merges: 0, biggest: 0, t: 0, over: false, danger: 0, nextId: 1, started: false };
}

export const nextTier = (s: Sim, ahead = 0): number => tierAt(s.seed, s.dealt + ahead);

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const int = (v: unknown, min = 0, max = 2 ** 32): v is number => num(v) && Number.isInteger(v) && v >= min && v <= max;

/**
 * A saved jar (today's daily, saved as it goes) checked and copied back into a Sim, or null when it
 * is not a valid one. The physics is deterministic, so a restored jar plays on exactly as it would have.
 */
export function simFrom(v: unknown): Sim | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (!int(o.seed) || !int(o.dealt) || !int(o.nextId) || !int(o.score) || !int(o.merges) || !int(o.biggest, 0, TIERS - 1)) return null;
  if (![o.aim, o.cooldown, o.t, o.danger].every(num) || o.over !== false || typeof o.started !== 'boolean' || !Array.isArray(o.blobs) || o.blobs.length > 400) return null;
  const blobs: Blob[] = [];
  for (const b of o.blobs as Record<string, unknown>[]) {
    if (!b || !int(b.id) || !int(b.tier, 0, TIERS - 1) || ![b.x, b.y, b.vx, b.vy, b.age, b.high, b.pop].every(num) || b.r !== RADII[b.tier]) return null;
    blobs.push({ id: b.id, tier: b.tier, x: b.x as number, y: b.y as number, vx: b.vx as number, vy: b.vy as number, r: b.r as number, age: b.age as number, high: b.high as number, pop: b.pop as number });
  }
  return { seed: o.seed, blobs, dealt: o.dealt, aim: o.aim as number, cooldown: o.cooldown as number, score: o.score, merges: o.merges, biggest: o.biggest, t: o.t as number, over: false, danger: o.danger as number, nextId: o.nextId, started: o.started };
}
export const canDrop = (s: Sim): boolean => !s.over && s.cooldown <= 0;

/** Moves the dropper, keeping the blob inside the jar. */
export function setAim(s: Sim, x: number): void {
  const r = RADII[nextTier(s)]!;
  s.aim = Math.max(r + 2, Math.min(W - r - 2, x));
}

export function drop(s: Sim): boolean {
  if (!canDrop(s)) return false;
  const tier = nextTier(s);
  const r = RADII[tier]!;
  setAim(s, s.aim);
  s.blobs.push({ id: s.nextId++, tier, x: s.aim, y: DROP_Y, vx: 0, vy: 120, r, age: 0, high: 0, pop: 0 });
  s.dealt++;
  s.cooldown = DROP_COOLDOWN;
  s.started = true;
  return true;
}

/** Advances the world by one STEP. Returns what happened, for sounds and effects. */
export function step(s: Sim): SimEvent[] {
  const events: SimEvent[] = [];
  if (s.over) return events;
  s.t += STEP;
  s.cooldown = Math.max(0, s.cooldown - STEP);
  const blobs = s.blobs;
  for (const b of blobs) {
    b.age += STEP;
    b.pop = Math.max(0, b.pop - STEP * 4);
    b.vy += GRAVITY * STEP;
    b.vx *= 0.998;
    b.x += b.vx * STEP;
    b.y += b.vy * STEP;
  }
  // Merges first: the first touching same-size pair found for each blob.
  const gone = new Set<number>();
  const born: Blob[] = [];
  for (let i = 0; i < blobs.length; i++) {
    const a = blobs[i]!;
    if (gone.has(a.id)) continue;
    for (let j = i + 1; j < blobs.length; j++) {
      const b = blobs[j]!;
      if (gone.has(b.id) || a.tier !== b.tier) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const reach = a.r + b.r + 0.5;
      if (dx * dx + dy * dy > reach * reach) continue;
      gone.add(a.id);
      gone.add(b.id);
      const x = (a.x + b.x) / 2;
      const y = (a.y + b.y) / 2;
      s.merges++;
      if (a.tier === TIERS - 1) {
        s.score += TOP_BONUS;
        events.push({ type: 'top', x, y });
      } else {
        const tier = a.tier + 1;
        s.score += POINTS[tier]!;
        s.biggest = Math.max(s.biggest, tier);
        born.push({ id: s.nextId++, tier, x, y, vx: (a.vx + b.vx) / 2, vy: Math.min(a.vy, b.vy) * 0.5 - 60, r: RADII[tier]!, age: 0.5, high: 0, pop: 1 });
        events.push({ type: 'merge', tier, x, y });
      }
      break;
    }
  }
  if (gone.size) s.blobs = blobs.filter((b) => !gone.has(b.id)).concat(born);
  // Push overlapping blobs apart (a few passes keep stacks steady), then the jar walls.
  const list = s.blobs;
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 0; i < list.length; i++) {
      const a = list[i]!;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const min = a.r + b.r;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min || d2 === 0) continue;
        const d = Math.sqrt(d2);
        const nx = dx / d;
        const ny = dy / d;
        const overlap = min - d;
        const ma = a.r * a.r;
        const mb = b.r * b.r;
        const ka = mb / (ma + mb);
        const kb = ma / (ma + mb);
        a.x -= nx * overlap * ka;
        a.y -= ny * overlap * ka;
        b.x += nx * overlap * kb;
        b.y += ny * overlap * kb;
        // Kill most of the approaching speed along the contact (soft, jelly-like bounce).
        const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rel < 0) {
          const imp = -rel * 1.15;
          a.vx -= nx * imp * ka;
          a.vy -= ny * imp * ka;
          b.vx += nx * imp * kb;
          b.vy += ny * imp * kb;
          // Rolling friction along the contact.
          const tx = -ny;
          const ty = nx;
          const slide = (b.vx - a.vx) * tx + (b.vy - a.vy) * ty;
          a.vx += tx * slide * 0.04 * ka;
          a.vy += ty * slide * 0.04 * ka;
          b.vx -= tx * slide * 0.04 * kb;
          b.vy -= ty * slide * 0.04 * kb;
        }
      }
    }
    for (const b of list) {
      if (b.x < b.r) {
        b.x = b.r;
        if (b.vx < 0) b.vx *= -0.2;
      } else if (b.x > W - b.r) {
        b.x = W - b.r;
        if (b.vx > 0) b.vx *= -0.2;
      }
      if (b.y > H - b.r) {
        b.y = H - b.r;
        if (b.vy > 0) b.vy *= -0.15;
        b.vx *= 0.985;
      }
    }
  }
  // Too full: a settled blob poking above the line for a while ends the round.
  let danger = 0;
  for (const b of list) {
    const above = b.y - b.r < LINE && b.age > 1;
    b.high = above ? b.high + STEP : 0;
    danger = Math.max(danger, b.high / OVER_AFTER);
    if (b.high >= OVER_AFTER) {
      s.over = true;
      events.push({ type: 'over' });
      break;
    }
  }
  s.danger = Math.min(1, danger);
  return events;
}

/** Share line: one circle per size, filled up to the biggest blob made. */
export const SIZE_EMOJI = ['⚪', '🟡', '🟠', '🔴', '🩷', '🟣', '🔵', '🩵', '🟢', '🟤', '🌈'];
export function resultLine(biggest: number): string {
  return SIZE_EMOJI.map((e, i) => (i <= biggest ? e : '▫️')).join('');
}
