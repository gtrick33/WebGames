/**
 * The Prism Pals simulation: pure, fixed-step, deterministic (the same inputs give the same level on
 * every device). A step moves the critters this device controls (`local`), the crates it drives, the
 * plates, gates and levers, and returns what happened for the sound and the network. `authority` is the
 * device that owns the shared world (solo, or the host's game online): it toggles levers, takes gems
 * picked up by any critter and sees the level cleared. Critters driven by other devices are moved by
 * the caller (net.ts) and only read here.
 */
import type { ColorId } from './critters';
import { Cell, cellAt, platformAt, tintAt, type Level } from './level';

export const STEP = 1 / 60;
/** A critter's box, in tiles. */
export const CW = 0.72;
export const CH = 0.84;
export const GRAV = 46;
/** A jump peaks 2.4 tiles up (onto a ledge two tiles high); a spring throws 5.4 tiles. */
export const JUMP_V = Math.sqrt(2 * GRAV * 2.4);
export const SPRING_V = Math.sqrt(2 * GRAV * 5.4);
export const RUN = 6.2;
const ACC_GROUND = 70;
const ACC_AIR = 46;
const FRICTION = 64;
const MAX_FALL = 20;
/** Walking speed while pushing a crate, and wading through goo of your own color (× RUN). */
const PUSH = 3;
const WADE = 0.6;
/** Steps a jump still works after walking off a ledge, and a press is remembered before landing. */
const COYOTE = 5;
const BUFFER = 7;
/** Steps every critter must stand in the exit together. */
export const EXIT_HOLD = 18;
const EPS = 1e-6;

export const IN_LEFT = 1;
export const IN_RIGHT = 2;
export const IN_JUMP = 4;
export const IN_ACT = 8;

/** Support ids: none, another critter (100 + i), a platform (200 + i), a crate (300 + i), the ground (1). */
export interface Critter {
  color: ColorId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  face: 1 | -1;
  ground: boolean;
  on: number;
  coyote: number;
  buffer: number;
  held: number;
  dead: boolean;
  /** How far it moved in the last step (what a critter standing on it is carried by). */
  dx: number;
  dy: number;
  /** Steps spent pushing a crate lately (drawn). */
  push: number;
  /** Rising from its own jump (letting go of jump cuts it short; a spring's throw isn't cut). */
  hop: boolean;
}

export interface Crate {
  x: number;
  y: number;
  vy: number;
  dx: number;
  dy: number;
  gone: boolean;
  /** Moved by someone else's game this step (not simulated here). */
  ext: boolean;
}

export interface World {
  lv: Level;
  /** Steps since the level started (restarts don't reset it: the clock runs on). */
  t: number;
  /** Restarts so far. */
  tries: number;
  cr: Critter[];
  crates: Crate[];
  levers: boolean[];
  gems: boolean[];
  /** Color gates open now (a plate of their color is pressed), and the lever gates. */
  gates: boolean[];
  leverOn: boolean;
  hold: number;
  cleared: boolean;
  /** The solver's world: every gate open. */
  open?: boolean;
}

/** What happened in a step; a death also says where (the level may have started over by the time it is drawn). */
export type SimEvent = { k: 'jump' | 'land' | 'spring' | 'gem' | 'die' | 'lever' | 'gate' | 'push' | 'clear' | 'reset'; i: number; x?: number; y?: number };

export function spawnCritter(lv: Level, i: number): Critter {
  const s = lv.spawns[i]!;
  return { color: i as ColorId, x: s.x + 0.5 - CW / 2, y: s.y + 1 - CH, vx: 0, vy: 0, face: 1, ground: false, on: -1, coyote: 0, buffer: 0, held: 0, dead: false, dx: 0, dy: 0, push: 0, hop: false };
}

const freshCrates = (lv: Level): Crate[] => lv.crates.map((c) => ({ x: c.x, y: c.y, vy: 0, dx: 0, dy: 0, gone: false, ext: false }));

export function newWorld(lv: Level): World {
  return {
    lv,
    t: 0,
    tries: 0,
    cr: lv.spawns.map((_, i) => spawnCritter(lv, i)),
    crates: freshCrates(lv),
    levers: lv.levers.map(() => false),
    gems: lv.gems.map(() => false),
    gates: [false, false, false, false],
    leverOn: false,
    hold: 0,
    cleared: false,
  };
}

/** A death (or a restart): everything back to the start, one more try on the count, the clock running on. */
export function resetWorld(w: World): void {
  w.tries++;
  w.cr = w.lv.spawns.map((_, i) => spawnCritter(w.lv, i));
  w.crates = freshCrates(w.lv);
  w.levers = w.lv.levers.map(() => false);
  w.gems = w.lv.gems.map(() => false);
  w.hold = 0;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
const boxOf = (c: Critter): Box => ({ x: c.x, y: c.y, w: CW, h: CH });
const overlaps = (a: Box, x: number, y: number, w: number, h: number): boolean => a.x < x + w - EPS && a.x + a.w > x + EPS && a.y < y + h - EPS && a.y + a.h > y + EPS;

/** Whether a cell stops a body: a critter of `color`, or a crate (-1). `ghost`: where the body was, so a gate never shuts on it. */
function solid(w: World, x: number, y: number, color: ColorId | -1, ghost: Box): boolean {
  const k = cellAt(w.lv, x, y);
  if (k === Cell.Ground) return true;
  if (k === Cell.Block) return color !== -1 && tintAt(w.lv, x, y) === color;
  const shut = w.open ? false : k === Cell.Gate ? !w.gates[tintAt(w.lv, x, y)] : k === Cell.LeverGate ? !w.leverOn : k === Cell.LeverGateOpen ? w.leverOn : false;
  return shut && !overlaps(ghost, x, y, 1, 1);
}

/** Moves a body along x and stops it at the first solid cell; returns whether it was stopped. */
function moveX(w: World, b: { x: number; y: number }, bw: number, bh: number, dx: number, color: ColorId | -1, ghost: Box): boolean {
  if (dx === 0) return false;
  b.x += dx;
  const y0 = Math.floor(b.y + EPS);
  const y1 = Math.floor(b.y + bh - EPS);
  const cx = dx > 0 ? Math.floor(b.x + bw - EPS) : Math.floor(b.x + EPS);
  for (let y = y0; y <= y1; y++)
    if (solid(w, cx, y, color, ghost)) {
      b.x = dx > 0 ? cx - bw : cx + 1;
      return true;
    }
  return false;
}

function moveY(w: World, b: { x: number; y: number }, bw: number, bh: number, dy: number, color: ColorId | -1, ghost: Box): boolean {
  if (dy === 0) return false;
  b.y += dy;
  const x0 = Math.floor(b.x + EPS);
  const x1 = Math.floor(b.x + bw - EPS);
  const cy = dy > 0 ? Math.floor(b.y + bh - EPS) : Math.floor(b.y + EPS);
  for (let x = x0; x <= x1; x++)
    if (solid(w, x, cy, color, ghost)) {
      b.y = dy > 0 ? cy - bh : cy + 1;
      return true;
    }
  return false;
}

const approach = (v: number, to: number, by: number): number => (v < to ? Math.min(to, v + by) : Math.max(to, v - by));

/** Moves a crate sideways as far as it goes (pushed); returns how far it went. */
function shoveCrate(w: World, j: number, dx: number): number {
  const k = w.crates[j]!;
  const ghost = { x: k.x, y: k.y, w: 1, h: 1 };
  const x0 = k.x;
  moveX(w, k, 1, 1, dx, -1, ghost);
  for (let o = 0; o < w.crates.length; o++) {
    const q = w.crates[o]!;
    if (o === j || q.gone || !overlaps({ x: k.x, y: k.y, w: 1, h: 1 }, q.x, q.y, 1, 1)) continue;
    k.x = dx > 0 ? q.x - 1 : q.x + 1;
  }
  if (dx > 0 ? k.x < x0 : k.x > x0) k.x = x0;
  k.dx += k.x - x0;
  return k.x - x0;
}

/** Gravity on a crate: it drops into a hole once its middle is over one (sliding into line with it). */
function stepCrate(w: World, j: number): void {
  const k = w.crates[j]!;
  if (k.gone) return;
  const x0 = k.x;
  const y0 = k.y;
  const ghost = { x: k.x, y: k.y, w: 1, h: 1 };
  const col = Math.floor(k.x + 0.5);
  const below = Math.round(k.y) + 1;
  const onCrate = w.crates.some((q, o) => o !== j && !q.gone && Math.abs(q.y - (k.y + 1)) < 0.02 && q.x < k.x + 0.5 && q.x + 1 > k.x + 0.5);
  const rests = Math.abs(k.y - Math.round(k.y)) < 0.02 && (solid(w, col, below, -1, ghost) || onCrate);
  if (rests && k.vy >= 0) {
    k.vy = 0;
    k.y = Math.round(k.y);
  } else {
    k.x = approach(k.x, col, 0.12);
    k.vy = Math.min(MAX_FALL, k.vy + GRAV * STEP);
    if (moveY(w, k, 1, 1, k.vy * STEP, -1, ghost)) k.vy = 0;
    for (let o = 0; o < w.crates.length; o++) {
      const q = w.crates[o]!;
      if (o !== j && !q.gone && overlaps({ x: k.x, y: k.y, w: 1, h: 1 }, q.x, q.y, 1, 1) && y0 + 1 <= q.y + 0.02) {
        k.y = q.y - 1;
        k.vy = 0;
      }
    }
    if (k.y > w.lv.h + 1) k.gone = true;
  }
  k.dx = k.x - x0;
  k.dy = k.y - y0;
}

/** The plates pressed now: a critter of the plate's color standing on it. */
function pressed(w: World): boolean[] {
  const on = [false, false, false, false];
  const lv = w.lv;
  for (const c of w.cr) {
    if (c.dead || !c.ground) continue;
    const feet = c.y + CH;
    const row = Math.round(feet) - 1;
    for (let x = Math.floor(c.x + EPS); x <= Math.floor(c.x + CW - EPS); x++)
      if (cellAt(lv, x, row) === Cell.Plate && tintAt(lv, x, row) === c.color && Math.abs(feet - (row + 1)) < 0.1 && c.x + CW > x + 0.15 && c.x < x + 0.85) on[c.color] = true;
  }
  return on;
}

/** What kills a critter: spikes, goo of another color, or the drop below the map. */
export function hazard(w: World, c: Critter): boolean {
  const lv = w.lv;
  if (c.y > lv.h + 0.5) return true;
  const b = { x: c.x + 0.06, y: c.y + 0.06, w: CW - 0.12, h: CH - 0.1 };
  for (let y = Math.floor(b.y); y <= Math.floor(b.y + b.h); y++)
    for (let x = Math.floor(b.x); x <= Math.floor(b.x + b.w); x++) {
      const k = cellAt(lv, x, y);
      if (k === Cell.Spikes && overlaps(b, x + 0.12, y + 0.45, 0.76, 0.55)) return true;
      if (k === Cell.Goo && tintAt(lv, x, y) !== c.color) {
        const top = cellAt(lv, x, y - 1) === Cell.Goo ? 0 : 0.3;
        if (overlaps(b, x, y + top, 1, 1 - top)) return true;
      }
    }
  return false;
}

function inOwnGoo(w: World, c: Critter): boolean {
  const x = Math.floor(c.x + CW / 2);
  const y = Math.floor(c.y + CH - 0.2);
  return cellAt(w.lv, x, y) === Cell.Goo && tintAt(w.lv, x, y) === c.color;
}

function stepCritter(w: World, i: number, bits: number, plats: { x: number; y: number }[], prev: { x: number; y: number }[], auth: boolean, out: SimEvent[]): void {
  const c = w.cr[i]!;
  const lv = w.lv;
  // carried by what it stands on
  let cx = 0;
  let cy = 0;
  if (c.on >= 300) {
    const k = w.crates[c.on - 300];
    if (k && !k.gone) [cx, cy] = [k.dx, k.dy];
  } else if (c.on >= 200) {
    const p = c.on - 200;
    if (plats[p]) [cx, cy] = [plats[p]!.x - prev[p]!.x, plats[p]!.y - prev[p]!.y];
  } else if (c.on >= 100) {
    const o = w.cr[c.on - 100];
    if (o && !o.dead) [cx, cy] = [o.dx, o.dy];
  }
  const x0 = c.x;
  const y0 = c.y;
  const ghost = { x: c.x, y: c.y, w: CW, h: CH };
  const dir = (bits & IN_RIGHT ? 1 : 0) - (bits & IN_LEFT ? 1 : 0);
  const wade = inOwnGoo(w, c);
  const top = RUN * (wade ? WADE : 1) * (c.push > 0 ? PUSH / RUN : 1);
  c.vx = approach(c.vx, dir * top, (c.ground ? (dir ? ACC_GROUND : FRICTION) : dir ? ACC_AIR : ACC_AIR * 0.35) * STEP);
  if (dir) c.face = dir > 0 ? 1 : -1;
  const jump = (bits & IN_JUMP) !== 0;
  if (jump && !(c.held & IN_JUMP)) c.buffer = BUFFER;
  else if (c.buffer > 0) c.buffer--;
  if (c.ground) c.coyote = COYOTE;
  else if (c.coyote > 0) c.coyote--;
  if (c.buffer > 0 && c.coyote > 0) {
    c.vy = -JUMP_V * (wade ? 0.85 : 1);
    c.buffer = 0;
    c.coyote = 0;
    c.ground = false;
    c.on = -1;
    c.hop = true;
    out.push({ k: 'jump', i });
  }
  if (c.vy >= 0) c.hop = false;
  c.vy = Math.min(MAX_FALL, c.vy + (c.vy < 0 && c.hop && !jump ? GRAV * 2.4 : GRAV) * STEP);
  // a lever within reach
  if (bits & IN_ACT && !(c.held & IN_ACT)) {
    const mid = c.x + CW / 2;
    const j = lv.levers.findIndex((l) => mid > l.x - 0.15 && mid < l.x + 1.15 && c.y < l.y + 1 && c.y + CH > l.y);
    if (j >= 0) {
      if (auth) w.levers[j] = !w.levers[j];
      out.push({ k: 'lever', i: j });
    }
  }
  c.held = bits;

  // across: walls, then crates (pushed when walked into on the ground)
  const dx = cx + c.vx * STEP;
  if (moveX(w, c, CW, CH, dx, c.color, ghost)) c.vx = 0;
  let pushing = false;
  for (let j = 0; j < w.crates.length; j++) {
    const k = w.crates[j]!;
    if (k.gone || overlaps(ghost, k.x, k.y, 1, 1) || !overlaps(boxOf(c), k.x, k.y, 1, 1)) continue;
    const into = dx > 0 ? c.x + CW - k.x : c.x - (k.x + 1);
    if (c.ground && dir !== 0 && Math.sign(into) === dir && Math.abs(k.y + 1 - (c.y + CH)) < 0.3) {
      shoveCrate(w, j, into);
      pushing = true;
      k.ext = false;
      out.push({ k: 'push', i: j });
    }
    c.x = dx > 0 ? Math.min(c.x, k.x - CW) : Math.max(c.x, k.x + 1);
  }
  c.push = pushing ? 8 : Math.max(0, c.push - 1);

  // up and down: ground, crates, platforms, springs and the heads of the others
  const wasGround = c.ground;
  const vyIn = c.vy;
  const bottom0 = y0 + CH + cy;
  const dy = cy + c.vy * STEP;
  c.ground = false;
  c.on = -1;
  if (moveY(w, c, CW, CH, dy, c.color, ghost)) {
    if (dy > 0) {
      c.ground = true;
      c.on = 1;
    }
    c.vy = 0;
  }
  const land = (topY: number, on: number): void => {
    c.y = topY - CH;
    c.vy = 0;
    c.ground = true;
    c.on = on;
  };
  if (dy >= -EPS) {
    for (let j = 0; j < w.crates.length; j++) {
      const k = w.crates[j]!;
      if (!k.gone && !overlaps(ghost, k.x, k.y, 1, 1) && c.x + CW > k.x + EPS && c.x < k.x + 1 - EPS && bottom0 <= k.y + 0.05 && c.y + CH >= k.y) land(k.y, 300 + j);
    }
    for (let p = 0; p < plats.length; p++) {
      const pl = plats[p]!;
      const pw = lv.platforms[p]!.w;
      if (c.x + CW > pl.x + EPS && c.x < pl.x + pw - EPS && bottom0 <= pl.y + 0.06 && c.y + CH >= pl.y) land(pl.y, 200 + p);
    }
    for (let o = 0; o < w.cr.length; o++) {
      const q = w.cr[o]!;
      if (o === i || q.dead || q.on === 100 + i) continue;
      if (c.x + CW > q.x + 0.08 && c.x < q.x + CW - 0.08 && bottom0 <= q.y + 0.05 && c.y + CH >= q.y) land(q.y, 100 + o);
    }
    // a spring throws whoever lands on it or walks onto it
    for (const s of lv.springs)
      if (vyIn >= 0 && overlaps(boxOf(c), s.x + 0.15, s.y + 0.6, 0.7, 0.4)) {
        c.y = s.y + 0.6 - CH;
        c.vy = -SPRING_V;
        c.hop = false;
        c.ground = false;
        c.on = -1;
        c.coyote = 0;
        out.push({ k: 'spring', i });
      }
  } else
    for (let j = 0; j < w.crates.length; j++) {
      const k = w.crates[j]!;
      if (!k.gone && !overlaps(ghost, k.x, k.y, 1, 1) && overlaps(boxOf(c), k.x, k.y, 1, 1) && y0 >= k.y + 1 - 0.05) {
        c.y = k.y + 1;
        c.vy = 0;
      }
    }
  if (c.ground && !wasGround && vyIn > 7) out.push({ k: 'land', i });
  c.dx = c.x - x0;
  c.dy = c.y - y0;
}

/**
 * One step. `input`: the buttons held for each critter this device drives (`local`). Returns what happened.
 * Critters this device doesn't drive keep the place the caller gave them.
 */
export function stepWorld(w: World, input: readonly number[], local: readonly boolean[], auth: boolean): SimEvent[] {
  const out: SimEvent[] = [];
  if (w.cleared) return out;
  const lv = w.lv;
  const prev = lv.platforms.map((p) => platformAt(p, w.t, STEP));
  w.t++;
  const plats = lv.platforms.map((p) => platformAt(p, w.t, STEP));
  const on = pressed(w);
  for (let k = 0; k < 4; k++) {
    if (on[k] !== w.gates[k] && lv.gated[k]) out.push({ k: 'gate', i: k });
    w.gates[k] = on[k]!;
  }
  w.leverOn = w.levers.filter(Boolean).length % 2 === 1;
  for (let j = 0; j < w.crates.length; j++) {
    const k = w.crates[j]!;
    if (!k.ext) stepCrate(w, j);
  }
  for (let i = 0; i < w.cr.length; i++) if (local[i] && !w.cr[i]!.dead) stepCritter(w, i, input[i] ?? 0, plats, prev, auth, out);
  for (let i = 0; i < w.cr.length; i++) {
    const c = w.cr[i]!;
    if (c.dead || (!local[i] && !auth)) continue;
    if (local[i] && hazard(w, c)) {
      c.dead = true;
      out.push({ k: 'die', i, x: c.x + CW / 2, y: c.y + CH / 2 });
      continue;
    }
    for (let g = 0; g < lv.gems.length; g++) {
      const gem = lv.gems[g]!;
      if (!w.gems[g] && gem.color === c.color && overlaps(boxOf(c), gem.x + 0.2, gem.y + 0.2, 0.6, 0.6)) {
        w.gems[g] = true;
        out.push({ k: 'gem', i: g });
      }
    }
  }
  if (auth) {
    const home = w.cr.every((c) => !c.dead && c.ground && cellAt(lv, Math.floor(c.x + CW / 2), Math.floor(c.y + CH / 2)) === Cell.Exit);
    w.hold = home ? w.hold + 1 : 0;
    if (w.hold >= EXIT_HOLD) {
      w.cleared = true;
      out.push({ k: 'clear', i: 0 });
    }
  }
  return out;
}

/** Seconds on the level's clock. */
export const seconds = (w: World): number => w.t * STEP;
export const gemsTaken = (w: World): number => w.gems.filter(Boolean).length;
