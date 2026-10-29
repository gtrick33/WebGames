/**
 * Crater Crew's physics: units that walk, jump, fly and land; shells that arc, bounce and burst;
 * craters, damage and knockback. A fixed step and nothing but deterministic arithmetic (see math.ts),
 * so a turn replayed from the same inputs ends in exactly the same place on the room server and on
 * every phone. Events come out for sound and sparks; rendering lives in render/.
 */
import { dcos, dsin, tenthsToRad } from './math';
import { BODY_H, HALF_W, H, W, bodyFree, carve, grounded, isSolid, supported, type Mask } from './terrain';
import { WEAPONS, type WeaponId } from './weapons';

export const STEP = 1 / 60;
export const GRAVITY = 520;
const WALK_SPEED = 48;
const CLIMB = 5;
const JUMP_VY = 215;
const JUMP_VX = 105;
const WIND_ACCEL = 14;
const TERMINAL = 900;
/** Landing faster than this bounces, and faster than FALL_SAFE hurts. */
const BOUNCE_V = 300;
const FALL_SAFE = 520;
/** A shell can't hit the one who fired it for this many steps. */
const ARMING = 18;
/** The longest a shot may take before the turn settles anyway. */
export const MAX_SHOT_STEPS = 60 * 25;

export const IN_LEFT = 1;
export const IN_RIGHT = 2;
export const IN_JUMP = 4;

export interface Unit {
  id: number;
  crew: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  air: boolean;
  hp: number;
  /** Knocked out in an earlier turn: a gravestone that only falls. */
  dead: boolean;
  drowned: boolean;
  facing: 1 | -1;
  /** Sub-pixel walking and the jump cooldown. */
  wa: number;
  jc: number;
}

export type ProjKind = 'rocket' | 'grenade' | 'splitter' | 'bomblet' | 'dynamite' | 'meteor';

export interface Proj {
  kind: ProjKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Steps until it goes off (-1: on impact). */
  fuse: number;
  owner: number;
  age: number;
  rest: boolean;
}

export type SimEvent =
  | { t: 'boom'; x: number; y: number; r: number }
  | { t: 'hurt'; unit: number; dmg: number }
  | { t: 'splash'; x: number; y: number; big: boolean }
  | { t: 'bounce'; x: number; y: number }
  | { t: 'launch'; w: WeaponId; x: number; y: number }
  | { t: 'zap'; x0: number; y0: number; x1: number; y1: number }
  | { t: 'bonk'; x: number; y: number; hit: boolean }
  | { t: 'drown'; unit: number }
  | { t: 'land'; unit: number; hard: boolean }
  | { t: 'jump'; unit: number }
  | { t: 'split'; x: number; y: number };

export interface World {
  mask: Mask;
  units: Unit[];
  projs: Proj[];
  wind: number;
  gravity: number;
  liquidY: number;
  /** Craters made in this world so far (flat x, y, r). */
  craters: number[];
  /** Damage each unit took since the world was made (by unit id). */
  hurt: Record<number, number>;
  /** Events since the caller last emptied this. */
  events: SimEvent[];
  steps: number;
}

export function makeWorld(mask: Mask, units: Unit[], wind: number, gravityShare: number, liquidY: number): World {
  return { mask, units, projs: [], wind, gravity: GRAVITY * gravityShare, liquidY, craters: [], hurt: {}, events: [], steps: 0 };
}

const alive = (u: Unit): boolean => !u.dead && !u.drowned;

function hurt(w: World, u: Unit, dmg: number): void {
  if (!alive(u) || dmg <= 0) return;
  u.hp -= dmg;
  w.hurt[u.id] = (w.hurt[u.id] ?? 0) + dmg;
  w.events.push({ t: 'hurt', unit: u.id, dmg });
}

/** Lifts a unit out of the ground if it ended up inside it. */
function unstick(m: Mask, u: Unit): void {
  if (bodyFree(m, u.x, u.y)) return;
  for (let k = 1; k <= 12; k++)
    if (bodyFree(m, u.x, u.y - k)) {
      u.y -= k;
      return;
    }
}

function land(w: World, u: Unit, impact: number): void {
  u.air = false;
  u.vx = 0;
  u.vy = 0;
  u.y = Math.round(u.y);
  for (let k = 0; k < 4 && !grounded(w.mask, u.x, u.y) && bodyFree(w.mask, u.x, u.y + 1); k++) u.y++;
  unstick(w.mask, u);
  if (impact > FALL_SAFE) hurt(w, u, Math.min(30, Math.round((impact - FALL_SAFE) / 9)));
  w.events.push({ t: 'land', unit: u.id, hard: impact > FALL_SAFE });
}

function stepUnit(w: World, u: Unit): void {
  if (u.drowned) return;
  if (u.jc > 0) u.jc--;
  const m = w.mask;
  if (!u.air) {
    if (supported(m, u.x, u.y)) {
      unstick(m, u);
      return;
    }
    u.air = true;
    u.vx = 0;
    u.vy = 0;
  }
  u.vy = Math.min(TERMINAL, u.vy + w.gravity * STEP);
  const dx = u.vx * STEP;
  const dy = u.vy * STEP;
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
  for (let i = 0; i < n; i++) {
    const nx = u.x + dx / n;
    const ny = u.y + dy / n;
    if (bodyFree(m, nx, ny)) {
      u.x = nx;
      u.y = ny;
      continue;
    }
    if (dy > 0 && !bodyFree(m, u.x, ny)) {
      const impact = u.vy;
      if (impact > BOUNCE_V) {
        u.vy = -impact * 0.3;
        u.vx *= 0.6;
        w.events.push({ t: 'bounce', x: u.x, y: u.y });
        if (impact > FALL_SAFE) hurt(w, u, Math.min(30, Math.round((impact - FALL_SAFE) / 9)));
      } else land(w, u, 0);
      break;
    }
    if (dy < 0 && !bodyFree(m, u.x, ny)) u.vy = 0;
    if (!bodyFree(m, nx, u.y)) {
      // a low step on the way: hop onto it instead of bouncing off
      let up = 0;
      while (up < CLIMB && !bodyFree(m, nx, u.y - up - 1)) up++;
      if (up < CLIMB && bodyFree(m, nx, u.y - up - 1) && u.vy >= 0) {
        u.x = nx;
        u.y -= up + 1;
      } else u.vx = -u.vx * 0.35;
    }
    break;
  }
  if (u.y - BODY_H * 0.4 > w.liquidY) {
    u.drowned = true;
    u.air = false;
    if (!u.dead) {
      w.hurt[u.id] = (w.hurt[u.id] ?? 0) + Math.max(0, u.hp);
      u.hp = 0;
    }
    w.events.push({ t: 'drown', unit: u.id }, { t: 'splash', x: u.x, y: w.liquidY, big: true });
  }
}

/** Walks one pixel; false when a wall is in the way. */
function walkPixel(w: World, u: Unit, dir: 1 | -1): boolean {
  const m = w.mask;
  const nx = u.x + dir;
  for (let up = 0; up <= CLIMB; up++) {
    if (!bodyFree(m, nx, u.y - up)) continue;
    u.x = nx;
    u.y -= up;
    if (up === 0) {
      for (let d = 0; d < CLIMB + 1 && !grounded(m, u.x, u.y) && bodyFree(m, u.x, u.y + 1); d++) u.y++;
      if (!grounded(m, u.x, u.y)) {
        u.air = true;
        u.vx = dir * 30;
        u.vy = 0;
      }
    }
    return true;
  }
  return false;
}

/** One step of the turn while the active unit walks: its input, then the world. */
export function walkStep(w: World, id: number, bits: number): void {
  const u = w.units.find((x) => x.id === id);
  if (u && alive(u) && u.hp > 0 && !u.air) {
    const dir = (bits & IN_RIGHT ? 1 : 0) - (bits & IN_LEFT ? 1 : 0);
    if (dir) u.facing = dir as 1 | -1;
    if (bits & IN_JUMP && u.jc === 0) {
      u.air = true;
      u.vy = -JUMP_VY;
      u.vx = u.facing * JUMP_VX;
      u.jc = 30;
      u.wa = 0;
      w.events.push({ t: 'jump', unit: u.id });
    } else if (dir) {
      u.wa += WALK_SPEED * STEP;
      while (u.wa >= 1) {
        u.wa -= 1;
        if (!walkPixel(w, u, dir as 1 | -1)) {
          u.wa = 0;
          break;
        }
        if (u.air) break;
      }
    } else u.wa = 0;
  }
  stepWorld(w);
}

/** Lets the active unit finish a jump or fall before it fires (the same on the server and the phone). */
export function settleUnit(w: World, id: number): void {
  for (let guard = 0; guard < 600; guard++) {
    const u = w.units.find((x) => x.id === id);
    if (!u || !u.air || u.drowned) return;
    walkStep(w, id, 0);
  }
}

export interface Fire {
  w: WeaponId;
  /** Elevation in tenths of a degree (-850..850, up is positive). */
  aim: number;
  dir: 1 | -1;
  /** 0..100. */
  power: number;
  /** Meteor Shower's target (world x). */
  tx: number;
}

/** The unit vector of an aim. */
export function aimVector(aim: number, dir: 1 | -1): [number, number] {
  const a = tenthsToRad(aim);
  return [dir * dcos(a), -dsin(a)];
}

export function muzzle(u: Unit, aim: number, dir: 1 | -1): [number, number] {
  const [ux, uy] = aimVector(aim, dir);
  return [u.x + ux * 14, u.y - 11 + uy * 14];
}

const BOMBLETS: [number, number][] = [
  [-190, -330],
  [-95, -400],
  [0, -440],
  [95, -400],
  [190, -330],
];

export function fire(w: World, id: number, f: Fire): void {
  const u = w.units.find((x) => x.id === id);
  if (!u || !alive(u) || u.hp <= 0) return;
  const def = WEAPONS[f.w];
  u.facing = f.dir;
  const [ux, uy] = aimVector(f.aim, f.dir);
  const [ox, oy] = muzzle(u, f.aim, f.dir);
  w.events.push({ t: 'launch', w: f.w, x: ox, y: oy });
  if (def.aim === 'power') {
    const speed = (def.speed * Math.max(0, Math.min(100, f.power))) / 100;
    const kind = f.w as ProjKind;
    const inside = isSolid(w.mask, Math.round(ox), Math.round(oy));
    if (inside && def.fuse === 0) {
      explodeKind(w, kind, ox, oy, id);
      return;
    }
    const [sx, sy] = inside ? [u.x, u.y - 11] : [ox, oy];
    w.projs.push({ kind, x: sx, y: sy, vx: ux * speed, vy: uy * speed, fuse: def.fuse > 0 ? Math.round(def.fuse * 60) : -1, owner: id, age: 0, rest: false });
  } else if (def.aim === 'line') zap(w, u, ux, uy);
  else if (def.aim === 'swing') bonk(w, u, ux, uy);
  else if (def.aim === 'drop') w.projs.push({ kind: 'dynamite', x: u.x + f.dir * 3, y: u.y - 8, vx: f.dir * 40, vy: -90, fuse: Math.round(def.fuse * 60), owner: id, age: 0, rest: false });
  else if (def.aim === 'target') {
    const tx = Math.max(0, Math.min(W, f.tx));
    for (let i = 0; i < 5; i++) w.projs.push({ kind: 'meteor', x: tx + (i - 2) * 34, y: -40 - i * 75, vx: 0, vy: 240, fuse: -1, owner: id, age: ARMING, rest: false });
  }
}

function zap(w: World, u: Unit, ux: number, uy: number): void {
  const x0 = u.x + ux * 10;
  const y0 = u.y - 11 + uy * 10;
  let x = x0;
  let y = y0;
  let target: Unit | null = null;
  let wall = false;
  for (let i = 0; i < 600 && !target && !wall; i++) {
    x += ux * 2;
    y += uy * 2;
    if (x < -50 || x > W + 50 || y < -400 || y > H) break;
    if (isSolid(w.mask, Math.round(x), Math.round(y))) wall = true;
    else for (const v of w.units) if (v !== u && alive(v) && Math.abs(v.x - x) <= HALF_W + 1 && y <= v.y + 1 && y >= v.y - BODY_H) target = v;
  }
  w.events.push({ t: 'zap', x0, y0, x1: x, y1: y });
  const def = WEAPONS.zapper;
  if (target) {
    hurt(w, target, def.damage);
    target.air = true;
    target.vx += ux * 380;
    target.vy += uy * 380 - 140;
    w.events.push({ t: 'boom', x, y, r: 8 });
  } else if (wall) explode(w, x, y, def.radius, 10, 200);
}

function bonk(w: World, u: Unit, ux: number, uy: number): void {
  const hx = u.x + u.facing * 12;
  const hy = u.y - 10;
  let hit = false;
  for (const v of w.units) {
    if (v === u || !alive(v) || Math.abs(v.x - hx) > 15 || Math.abs(v.y - 10 - hy) > 18) continue;
    hit = true;
    hurt(w, v, WEAPONS.mallet.damage);
    v.air = true;
    v.vx += ux * 760;
    v.vy += Math.min(uy * 760, -220);
  }
  w.events.push({ t: 'bonk', x: hx, y: hy, hit });
}

/** A blast: a crater in the ground, damage and a shove for everyone near. */
export function explode(w: World, x: number, y: number, r: number, dmg: number, knock: number): void {
  const cx = Math.round(x);
  const cy = Math.round(y);
  carve(w.mask, cx, cy, r);
  w.craters.push(cx, cy, r);
  w.events.push({ t: 'boom', x: cx, y: cy, r });
  const reach = r + 12;
  for (const u of w.units) {
    if (!alive(u)) continue;
    const dx = u.x - x;
    const dy = u.y - BODY_H / 2 - y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d >= reach) continue;
    const f = 1 - d / reach;
    hurt(w, u, Math.max(1, Math.round(dmg * f)));
    const imp = knock * f;
    const nx = d > 0.5 ? dx / d : 0;
    const ny = d > 0.5 ? dy / d : -1;
    u.air = true;
    u.vx += nx * imp;
    u.vy += ny * imp - imp * 0.35;
  }
}

function explodeKind(w: World, kind: ProjKind, x: number, y: number, owner: number): void {
  if (kind === 'bomblet') return explode(w, x, y, 20, 16, 260);
  const def = WEAPONS[kind];
  explode(w, x, y, def.radius, def.damage, def.damage * 11);
  if (kind === 'splitter') {
    w.events.push({ t: 'split', x, y });
    for (const [vx, vy] of BOMBLETS) w.projs.push({ kind: 'bomblet', x, y: y - 4, vx, vy, fuse: -1, owner, age: 0, rest: false });
  }
}

const BOUNCY: Partial<Record<ProjKind, number>> = { grenade: 0.45, dynamite: 0.12 };
const WINDY: Partial<Record<ProjKind, true>> = { rocket: true, splitter: true, meteor: true };

/** The surface's outward direction around a solid point. */
function normalAt(m: Mask, x: number, y: number): [number, number] {
  let sx = 0;
  let sy = 0;
  for (let dy = -3; dy <= 3; dy++)
    for (let dx = -3; dx <= 3; dx++)
      if (isSolid(m, x + dx, y + dy)) {
        sx -= dx;
        sy -= dy;
      }
  const l = Math.sqrt(sx * sx + sy * sy);
  return l === 0 ? [0, -1] : [sx / l, sy / l];
}

export type Flight = { k: 'fly' } | { k: 'gone'; splash: boolean } | { k: 'burst'; x: number; y: number } | { k: 'bounce' };

/** Moves one shell one step (no blast yet: the caller decides). Shared by the world and the computer's aiming. */
export function flyProj(w: World, p: Proj): Flight {
  p.age++;
  if (p.fuse > 0 && --p.fuse === 0) return { k: 'burst', x: p.x, y: p.y };
  const m = w.mask;
  if (p.rest) {
    if (isSolid(m, Math.round(p.x), Math.round(p.y) + 3)) return { k: 'fly' };
    p.rest = false;
  }
  if (WINDY[p.kind]) p.vx += w.wind * WIND_ACCEL * STEP;
  p.vy = Math.min(TERMINAL * 1.4, p.vy + w.gravity * STEP);
  const dx = p.vx * STEP;
  const dy = p.vy * STEP;
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 2));
  const bounce = BOUNCY[p.kind];
  let bounced = false;
  for (let i = 0; i < n; i++) {
    const nx = p.x + dx / n;
    const ny = p.y + dy / n;
    if (nx < -400 || nx > W + 400 || ny > H + 40) return { k: 'gone', splash: false };
    if (ny > w.liquidY) return { k: 'gone', splash: true };
    if (bounce === undefined) {
      for (const u of w.units)
        if (alive(u) && (u.id !== p.owner || p.age > ARMING) && Math.abs(u.x - nx) <= HALF_W + 2 && ny <= u.y + 2 && ny >= u.y - BODY_H - 2) return { k: 'burst', x: nx, y: ny };
    }
    const ix = Math.round(nx);
    const iy = Math.round(ny);
    if (isSolid(m, ix, iy)) {
      if (bounce === undefined) return { k: 'burst', x: nx, y: ny };
      const [mx, my] = normalAt(m, ix, iy);
      const d = p.vx * mx + p.vy * my;
      if (d < 0) {
        p.vx -= 2 * d * mx;
        p.vy -= 2 * d * my;
      }
      p.vx *= bounce;
      p.vy *= bounce;
      if (p.vx * p.vx + p.vy * p.vy < 45 * 45) {
        p.vx = 0;
        p.vy = 0;
        p.rest = true;
      }
      bounced = true;
      break;
    }
    p.x = nx;
    p.y = ny;
  }
  return bounced ? { k: 'bounce' } : { k: 'fly' };
}

/** One step of everything: shells, then units. */
export function stepWorld(w: World): void {
  w.steps++;
  const flying = w.projs;
  // bomblets born this step land in w.projs and start moving next step
  w.projs = [];
  const keep: Proj[] = [];
  for (const p of flying) {
    const out = flyProj(w, p);
    if (out.k === 'burst') explodeKind(w, p.kind, out.x, out.y, p.owner);
    else if (out.k === 'gone') {
      if (out.splash) w.events.push({ t: 'splash', x: p.x, y: w.liquidY, big: false });
    } else {
      if (out.k === 'bounce' && !p.rest) w.events.push({ t: 'bounce', x: p.x, y: p.y });
      keep.push(p);
    }
  }
  w.projs = keep.concat(w.projs);
  for (const u of w.units) stepUnit(w, u);
}

/** Nothing flying, nobody falling. */
export function settled(w: World): boolean {
  if (w.projs.length) return false;
  for (const u of w.units) if (!u.drowned && (u.air || !supported(w.mask, u.x, u.y))) return false;
  return true;
}

/** Runs the world until it is still (or the time limit). */
export function runToRest(w: World, max = MAX_SHOT_STEPS): void {
  for (let i = 0; i < max && !settled(w); i++) stepWorld(w);
  w.projs = [];
}
