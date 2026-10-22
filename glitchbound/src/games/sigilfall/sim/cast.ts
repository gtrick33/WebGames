import { angleDiff, dist, dist2, inCone, TAU } from '../core/math';
import type { SkillSpec, SlotKey } from '../data/types';
import { applyEffects, applyStatus, enemiesIn, hitEnemy, hurtPlayer, playerStunned, runProcs } from './combat';
import { blocksAt, castRay, lineOfSight, moveCircle } from './map';
import type { Enemy, Projectile } from './types';
import type { World } from './world';

/**
 * The hero's skills: aiming (manual or smart targeting), cooldowns and charges, wind-ups, and what
 * each kind of skill does. Every number comes from the resolved SkillSpec, so items and talents
 * change behaviour here without any skill-specific code knowing about them.
 */

export interface CastRequest {
  slot: SlotKey;
  /** Aim angle; null = smart targeting (tap). */
  angle: number | null;
  /** Ground skills: how far, 0..1 of the range (null = at the target or a default distance). */
  dist: number | null;
  /** Aim assist: 0 off, 1 light, 2 strong (touch drags only). */
  assist: number;
}

/** The nearest enemy the hero can see within range, preferring ones in front. */
export function autoTarget(w: World, range: number, prefer: number): Enemy | null {
  const p = w.player;
  let best: Enemy | null = null;
  let bestScore = Infinity;
  for (const e of w.enemies) {
    if (e.dead || e.state === 'spawn' || e.dummy === 2) continue;
    const d = dist(p.x, p.y, e.x, e.y);
    if (d > range + e.r + 6) continue;
    if (!lineOfSight(w.map, p.x, p.y, e.x, e.y)) continue;
    // in front counts as closer; bosses are never skipped for a closer pebble
    const off = Math.abs(angleDiff(prefer, Math.atan2(e.y - p.y, e.x - p.x)));
    const score = d * (1 + off * 0.25) * (e.dummy ? 1.5 : 1);
    if (score < bestScore) {
      bestScore = score;
      best = e;
    }
  }
  return best;
}

/** Nudges a manual aim toward an enemy close to the aimed line (never more than a few degrees). */
function assistAim(w: World, angle: number, range: number, level: number): number {
  if (level <= 0) return angle;
  const max = level === 1 ? 0.1 : 0.21;
  const p = w.player;
  let best = angle;
  let bestOff = max;
  for (const e of w.enemies) {
    if (e.dead || e.state === 'spawn' || e.dummy === 2) continue;
    if (dist(p.x, p.y, e.x, e.y) > range + e.r) continue;
    const a = Math.atan2(e.y - p.y, e.x - p.x);
    const off = Math.abs(angleDiff(angle, a));
    if (off < bestOff && lineOfSight(w.map, p.x, p.y, e.x, e.y)) {
      bestOff = off;
      best = a;
    }
  }
  return best;
}

interface Aim {
  angle: number;
  tx: number;
  ty: number;
  target: Enemy | null;
}

function resolveAim(w: World, spec: SkillSpec, req: CastRequest): Aim | null {
  const p = w.player;
  const reach = spec.cast === 'melee' ? spec.area + 30 : spec.cast === 'dash' ? spec.range + 20 : spec.range;
  if (req.angle !== null) {
    const angle = spec.aim === 'self' ? req.angle : assistAim(w, req.angle, reach, req.assist);
    const d = spec.aim === 'ground' ? (req.dist ?? 0.7) * spec.range : spec.range;
    return { angle, tx: p.x + Math.cos(angle) * d, ty: p.y + Math.sin(angle) * d, target: null };
  }
  // a tap: the basic attack finds the nearest enemy (if the setting is on) and spells that need a target
  // (chains, marks) always do; every other spell goes where the hero faces, shown by the facing marker
  const targeted = spec.cast === 'chain' || spec.cast === 'mark';
  const target = targeted || (req.slot === 'basic' && w.settings.autoTarget) ? autoTarget(w, reach, p.aim) : null;
  if (target) {
    const angle = Math.atan2(target.y - p.y, target.x - p.x);
    const d = Math.min(spec.range, dist(p.x, p.y, target.x, target.y));
    return { angle, tx: p.x + Math.cos(angle) * d, ty: p.y + Math.sin(angle) * d, target };
  }
  if (spec.cast === 'chain' || spec.cast === 'mark') return null;
  const angle = p.aim;
  const d = spec.range * 0.6;
  return { angle, tx: p.x + Math.cos(angle) * d, ty: p.y + Math.sin(angle) * d, target: null };
}

/** Tries to use a skill slot. Returns false when it can't (cooldown, no target, busy). */
export function tryCast(w: World, req: CastRequest): boolean {
  const p = w.player;
  if (p.dead || playerStunned(w)) return false;
  const id = w.build.bar[req.slot];
  if (!id) return false;
  const spec = w.build.skills[id]?.spec;
  if (!spec) return false;
  const cd = p.cds[req.slot];
  if (req.slot === 'ult') {
    if (p.ult < 100) return false;
  } else if (cd.charges <= 0) return false;
  // busy: a wind-up finishes first; a dodge may cut a channel short; dashes can't be stacked
  if (p.windup) return false;
  if (p.dash && !p.dash.dodge) return false;
  if (p.dash?.dodge && req.slot === 'dodge') return false;
  if (p.channel && req.slot !== 'dodge') return false;
  // mana: a share of the maximum (classes without mana pay nothing)
  const cost = req.slot !== 'ult' && spec.cost > 0 && p.maxMana > 0 ? (spec.cost * p.maxMana) / 100 : 0;
  if (cost > p.mana + 1e-6) {
    if (w.time - w.noManaAt > 1) {
      w.noManaAt = w.time;
      w.text(p.x, p.y - 20, 'Not enough mana', '#7fc4ff', false);
      w.sfx('nomana', 0.5);
    }
    return false;
  }
  const aim = req.slot === 'dodge' ? dodgeAim(w, req) : resolveAim(w, spec, req);
  if (!aim) {
    w.text(p.x, p.y - 20, 'No target', '#c9c3e6', false);
    return false;
  }
  // pay
  p.mana -= cost;
  if (req.slot === 'ult') {
    p.ult = 0;
    runProcs(w, 'ult', { x: p.x, y: p.y, base: 0, type: spec.dmgType, depth: 1, hitDmg: 0 });
  } else {
    if (cd.charges >= cd.max) cd.t = cd.cd;
    cd.charges -= 1;
  }
  if (req.slot === 'dodge') p.channel = null;
  p.aim = aim.angle;
  if (spec.windup > 0 && spec.cast !== 'ground') {
    p.windup = { slot: req.slot, spec, t: spec.windup, total: spec.windup, angle: aim.angle, tx: aim.tx, ty: aim.ty };
    p.actKind = 'heavy';
    p.actT = spec.windup + 0.2;
    p.actAngle = aim.angle;
    w.sfx('windup');
    return true;
  }
  execute(w, req.slot, spec, aim.angle, aim.tx, aim.ty, aim.target);
  return true;
}

function dodgeAim(w: World, req: CastRequest): Aim {
  const p = w.player;
  // dodge goes where you are moving; standing still, where you aim
  const moving = Math.hypot(w.input.mx, w.input.my) > 0.2;
  const angle = moving ? Math.atan2(w.input.my, w.input.mx) : (req.angle ?? p.aim);
  return { angle, tx: p.x, ty: p.y, target: null };
}

/** Finishes a wind-up. */
export function updateWindup(w: World, dt: number): void {
  const p = w.player;
  if (!p.windup) return;
  p.windup.t -= dt;
  if (p.windup.t <= 0) {
    const wu = p.windup;
    p.windup = null;
    execute(w, wu.slot, wu.spec, wu.angle, wu.tx, wu.ty, null);
  }
}

/** The skill happens. */
export function execute(w: World, slot: SlotKey, spec: SkillSpec, angle: number, tx: number, ty: number, target: Enemy | null): void {
  const p = w.player;
  p.aim = angle;
  const ctx = { x: p.x, y: p.y, angle, spec, base: spec.damage, type: spec.dmgType, depth: 0, hitDmg: 0, when: 'cast' as const };
  applyEffects(w, spec.onCast, ctx);
  switch (spec.cast) {
    case 'projectile':
      fireProjectiles(w, spec, angle);
      if (spec.extra.echo) for (let i = 1; i <= spec.extra.echo; i++) w.after(0.28 * i, () => !w.player.dead && fireProjectiles(w, spec, w.player.aim));
      p.actKind = spec.tags.includes('melee') ? 'heavy' : slot === 'basic' ? 'shoot' : 'cast';
      p.actT = 0.22;
      p.actAngle = angle;
      w.sfx(spec.look === 'quake' ? 'quake' : spec.dmgType === 'fire' ? 'fireball' : spec.look === 'lightning' ? 'zap' : w.hero.cls === 'ranger' ? 'bow' : 'bolt');
      if (spec.look === 'quake') w.shake(3);
      break;
    case 'melee':
      melee(w, spec, angle);
      break;
    case 'nova': {
      p.actKind = 'cast';
      p.actT = 0.25;
      w.addFx({ kind: 'ring', x: p.x, y: p.y, life: 0.4, size: spec.area, color: spec.dmgType === 'frost' ? '#9be7ff' : '#ffffff' });
      for (let i = 0; i < 14; i++) {
        const a = (TAU * i) / 14;
        w.addFx({ kind: 'shard', x: p.x + Math.cos(a) * 6, y: p.y + Math.sin(a) * 6, vx: Math.cos(a) * spec.area * 2.2, vy: Math.sin(a) * spec.area * 2.2, life: 0.35, size: 2, color: '#d8f6ff' });
      }
      w.sfx('nova');
      hitAll(w, spec, enemiesIn(w, p.x, p.y, spec.area), p.x, p.y);
      w.breakWalls(p.x, p.y, spec.area);
      break;
    }
    case 'chain':
      chain(w, spec, angle, target);
      break;
    case 'blink': {
      const to = castRay(w.map, p.x, p.y, p.r, angle, spec.range);
      w.addFx({ kind: 'burst', x: p.x, y: p.y, life: 0.3, size: 10, color: '#c58cff' });
      p.x = to.x;
      p.y = to.y;
      p.vx = 0;
      p.vy = 0;
      p.iframe = Math.max(p.iframe, 0.25);
      w.addFx({ kind: 'burst', x: p.x, y: p.y, life: 0.3, size: 10, color: '#c58cff' });
      w.sfx('blink');
      // the cast effects (Tome of Blinking) already went off where you stood: ctx is the starting point
      applyEffects(w, spec.onImpact, { ...ctx, x: p.x, y: p.y, when: 'impact' });
      break;
    }
    case 'dash': {
      const t = Math.max(0.08, spec.duration);
      const speed = spec.range / t;
      const dodge = slot === 'dodge';
      p.dash = { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, t, spec, hit: new Set(), dodge };
      if (dodge) {
        p.iframe = Math.max(p.iframe, t + 0.08);
        p.lastDodge = w.time;
        w.sfx('dodge');
        runProcs(w, 'dodge', { x: p.x, y: p.y, base: 0, type: 'physical', depth: 1, hitDmg: 0 });
      } else {
        w.sfx('dash');
        p.actKind = 'heavy';
        p.actT = t + 0.1;
        p.actAngle = angle;
      }
      break;
    }
    case 'ground':
      ground(w, spec, angle, tx, ty);
      break;
    case 'trap':
      placeTrap(w, spec, tx, ty);
      break;
    case 'channel':
      p.channel = { spec, t: spec.duration, tickT: 0 };
      p.actKind = 'spin';
      p.actT = spec.duration;
      w.sfx('whirl');
      break;
    case 'mark':
      if (target) {
        w.addFx({ kind: 'zap', x: p.x, y: p.y, x2: target.x, y2: target.y, life: 0.2, size: 1, color: '#ffe066' });
        const d = hitEnemy(w, target, spec.damage, spec.dmgType, { spec, depth: 0, fromX: p.x, fromY: p.y });
        applyEffects(w, spec.onHit, { ...ctx, x: target.x, y: target.y, target, hitDmg: d, when: 'hit' });
        w.sfx('mark');
      }
      p.actKind = 'shoot';
      p.actT = 0.2;
      break;
  }
}

/* ------------------------------------------------------------ the kinds */

function fireProjectiles(w: World, spec: SkillSpec, angle: number): void {
  const p = w.player;
  const n = spec.count;
  for (let i = 0; i < n; i++) {
    const a = n === 1 ? angle : angle - spec.spread / 2 + (spec.spread * i) / (n - 1);
    const ox = p.x + Math.cos(a) * 6;
    const oy = p.y - 3 + Math.sin(a) * 6;
    w.spawnProjectile({
      x: ox,
      y: oy,
      vx: Math.cos(a) * spec.speed,
      vy: Math.sin(a) * spec.speed,
      r: spec.radius,
      life: spec.range,
      dmg: spec.damage,
      type: spec.dmgType,
      spec,
      depth: 0,
      pierce: spec.pierce,
      bounce: spec.bounce,
      hit: [],
      look: spec.look ?? spec.id,
      color: '#fff',
      child: false,
      knock: spec.knock,
      wide: spec.look === 'quake',
    });
  }
}

/** Hits a list of enemies with a skill and its on-hit effects. */
function hitAll(w: World, spec: SkillSpec, list: Enemy[], fx: number, fy: number, mul = 1): void {
  const p = w.player;
  for (const e of list) {
    const d = hitEnemy(w, e, spec.damage * mul, spec.dmgType, { spec, depth: 0, fromX: fx, fromY: fy });
    applyEffects(w, spec.onHit, { x: e.x, y: e.y, angle: Math.atan2(e.y - p.y, e.x - p.x), spec, base: spec.damage * mul, type: spec.dmgType, depth: 0, target: e, hitDmg: d, when: 'hit' });
  }
}

function melee(w: World, spec: SkillSpec, angle: number): void {
  const p = w.player;
  let mul = 1;
  let arc = spec.arc;
  let reach = spec.area;
  let big = false;
  if (spec.extra.combo) {
    p.combo = p.comboT > 0 ? p.combo + 1 : 1;
    p.comboT = 1;
    if (p.combo >= spec.extra.combo) {
      p.combo = 0;
      big = true;
      mul += spec.extra.comboMul ?? 0;
      arc *= 1 + (spec.extra.comboArc ?? 0.3);
      reach += 4;
    }
  }
  const heavy = spec.windup > 0;
  p.actKind = heavy ? 'heavy' : 'swing';
  p.actT = heavy ? 0.28 : 0.2;
  p.actAngle = angle;
  p.actBig = big;
  const list = w.enemies.filter((e) => !e.dead && e.state !== 'spawn' && inCone(e.x, e.y, p.x, p.y, angle, arc / 2 + 0.15, reach + e.r + p.r));
  w.addFx({ kind: 'slash', x: p.x, y: p.y, a: angle, a2: arc, life: heavy ? 0.24 : 0.16, size: reach + 4, color: heavy ? '#ffe6b0' : big ? '#fff2c8' : '#ffffff', r2: big || heavy ? 1 : 0 });
  w.sfx(heavy ? 'heavy' : big ? 'swingBig' : 'swing');
  hitAll(w, spec, list, p.x, p.y, mul);
  if (list.length && (heavy || big)) w.hitstop(heavy ? 0.06 : 0.035);
  if (heavy) w.shake(list.length ? 2.5 : 1);
  // the strike lands in front: impact effects happen there
  const ix = p.x + Math.cos(angle) * reach * 0.8;
  const iy = p.y + Math.sin(angle) * reach * 0.8;
  if (spec.onImpact.length) applyEffects(w, spec.onImpact, { x: ix, y: iy, angle, spec, base: spec.damage * mul, type: spec.dmgType, depth: 0, hitDmg: 0, when: 'impact' });
  w.breakWalls(ix, iy, 10);
}

function chain(w: World, spec: SkillSpec, angle: number, first: Enemy | null): void {
  const p = w.player;
  let target = first;
  if (!target) {
    // aimed: the enemy nearest the aimed line within range
    let best = Infinity;
    for (const e of w.enemies) {
      if (e.dead || e.state === 'spawn') continue;
      const d = dist(p.x, p.y, e.x, e.y);
      if (d > spec.range + e.r) continue;
      const off = Math.abs(angleDiff(angle, Math.atan2(e.y - p.y, e.x - p.x)));
      if (off > 0.6 || !lineOfSight(w.map, p.x, p.y, e.x, e.y)) continue;
      const s = d * (1 + off * 2);
      if (s < best) {
        best = s;
        target = e;
      }
    }
  }
  p.actKind = 'cast';
  p.actT = 0.22;
  p.actAngle = angle;
  w.sfx('zap');
  if (!target) {
    w.addFx({ kind: 'zap', x: p.x, y: p.y, x2: p.x + Math.cos(angle) * spec.range * 0.7, y2: p.y + Math.sin(angle) * spec.range * 0.7, life: 0.15, size: 1, color: '#bfe9ff' });
    return;
  }
  const jumps = spec.extra.jumps ?? 0;
  const range = spec.extra.chainRange ?? 60;
  const falloff = spec.extra.falloff ?? 0.85;
  const hit = new Set<number>();
  let from = { x: p.x, y: p.y - 4 };
  let cur: Enemy | null = target;
  let mul = 1;
  for (let j = 0; j <= jumps && cur; j++) {
    hit.add(cur.id);
    w.addFx({ kind: 'zap', x: from.x, y: from.y, x2: cur.x, y2: cur.y, life: 0.22, size: 1.4, color: '#d8f2ff' });
    const d = hitEnemy(w, cur, spec.damage * mul, spec.dmgType, { spec, depth: 0, fromX: from.x, fromY: from.y });
    applyEffects(w, spec.onHit, { x: cur.x, y: cur.y, angle, spec, base: spec.damage * mul, type: spec.dmgType, depth: 0, target: cur, hitDmg: d, when: 'hit' });
    from = cur;
    mul *= falloff;
    let next: Enemy | null = null;
    let bd = range * range;
    for (const e of w.enemies) {
      if (e.dead || e.state === 'spawn' || hit.has(e.id)) continue;
      const dd = dist2(e.x, e.y, from.x, from.y);
      if (dd < bd) {
        bd = dd;
        next = e;
      }
    }
    cur = next;
  }
}

function ground(w: World, spec: SkillSpec, angle: number, tx: number, ty: number): void {
  const p = w.player;
  // the point must be reachable by sight; otherwise it lands where sight ends
  if (!lineOfSight(w.map, p.x, p.y, tx, ty)) {
    const r = castRay(w.map, p.x, p.y, 2, angle, Math.hypot(tx - p.x, ty - p.y));
    tx = r.x;
    ty = r.y;
  }
  p.actKind = 'cast';
  p.actT = 0.3;
  p.actAngle = angle;
  if (spec.duration > 0 && spec.tick > 0) {
    // a field: arrow rain
    w.spawnField({ x: tx, y: ty, r: spec.area, dur: spec.duration, tick: spec.tick, dmg: spec.damage, type: spec.dmgType, look: 'arrows', hostile: false, depth: 0, spec, onHit: true });
    w.sfx('volley');
    return;
  }
  const strikes = spec.extra.strikes ?? 0;
  if (strikes > 0) {
    // Tempest: bolts strike around the point
    w.addFx({ kind: 'glow', x: tx, y: ty, life: 1.6, size: spec.area, color: '#5ad1ff' });
    for (let i = 0; i < strikes; i++) {
      w.after(0.25 + i * 0.18, () => {
        const a = w.rand() * TAU;
        const r = Math.sqrt(w.rand()) * spec.area * 0.85;
        const x = tx + Math.cos(a) * r;
        const y = ty + Math.sin(a) * r;
        w.addFx({ kind: 'beam', x, y, life: 0.25, size: 3, color: '#d8f2ff' });
        w.fxBurst(x, y, '#bfe9ff', 6, 18);
        w.sfx('thunder');
        w.shake(1.2);
        hitAll(w, spec, enemiesIn(w, x, y, 20), x, y, 0.45);
      });
    }
    return;
  }
  // a meteor (and its extra meteors)
  const impacts: { x: number; y: number; delay: number; mul: number }[] = [{ x: tx, y: ty, delay: spec.windup, mul: 1 }];
  for (let i = 0; i < (spec.extra.meteors ?? 0); i++) {
    const a = angle + Math.PI / 2 + (i * TAU) / Math.max(2, spec.extra.meteors ?? 0);
    impacts.push({ x: tx + Math.cos(a) * spec.area * 0.9, y: ty + Math.sin(a) * spec.area * 0.9, delay: spec.windup + 0.25 * (i + 1), mul: 0.6 });
  }
  for (const im of impacts) {
    if (blocksAt(w.map, im.x, im.y)) continue;
    w.addTelegraph({ shape: 'circle', x: im.x, y: im.y, r: spec.area * (im.mul < 1 ? 0.8 : 1), r2: 0, angle: 0, len: 0, dur: im.delay, dmg: 0, knock: 0, tone: 'player', owner: -1, linger: 0 });
    w.addFx({ kind: 'ember', x: im.x - 60, y: im.y - 140, vx: 60 / im.delay, vy: 140 / im.delay, life: im.delay, size: 6, color: '#ff7a3d', sprite: 'meteor' });
    w.after(im.delay, () => {
      const r = spec.area * (im.mul < 1 ? 0.8 : 1);
      w.fxBurst(im.x, im.y, '#ff9a4d', 22, r);
      w.addFx({ kind: 'ring', x: im.x, y: im.y, life: 0.4, size: r, color: '#ffcf6a' });
      w.sfx('meteor');
      w.shake(4);
      w.hitstop(0.05);
      hitAll(w, spec, enemiesIn(w, im.x, im.y, r), im.x, im.y, im.mul);
      applyEffects(w, spec.onImpact, { x: im.x, y: im.y, angle, spec, base: spec.damage * im.mul, type: spec.dmgType, depth: 0, hitDmg: 0, when: 'impact' });
      w.breakWalls(im.x, im.y, r);
    });
  }
  w.sfx('meteorCall');
}

function placeTrap(w: World, spec: SkillSpec, tx: number, ty: number): void {
  const p = w.player;
  const r = castRay(w.map, p.x, p.y, 4, Math.atan2(ty - p.y, tx - p.x), Math.hypot(tx - p.x, ty - p.y));
  const max = spec.extra.maxTraps ?? 2;
  const mine = w.traps.filter((t) => !t.dead);
  while (mine.length >= max) {
    const old = mine.shift()!;
    old.dead = true;
    w.addFx({ kind: 'smoke', x: old.x, y: old.y, life: 0.4, size: 4, color: '#7a8a6a' });
  }
  w.traps.push({ id: w.nextId++, x: r.x, y: r.y, arm: spec.extra.arm ?? 0.45, life: spec.duration, spec, dead: false });
  w.addFx({ kind: 'spark', x: r.x, y: r.y, life: 0.3, size: 2, color: '#b0e05a' });
  p.actKind = 'cast';
  p.actT = 0.2;
  w.sfx('trapSet');
}

/** Traps arm, then spring on the first enemy that comes near. */
export function updateTraps(w: World, dt: number): void {
  for (const t of w.traps) {
    if (t.dead) continue;
    t.life -= dt;
    if (t.life <= 0) {
      t.dead = true;
      continue;
    }
    if (t.arm > 0) {
      t.arm -= dt;
      continue;
    }
    const trigger = w.enemies.some((e) => !e.dead && e.state !== 'spawn' && !e.dummy && dist2(e.x, e.y, t.x, t.y) < (12 + e.r) * (12 + e.r));
    if (!trigger) continue;
    t.dead = true;
    const s = t.spec;
    w.fxBurst(t.x, t.y, '#8be36b', 16, s.area);
    w.sfx('trapSpring');
    hitAll(w, s, enemiesIn(w, t.x, t.y, s.area), t.x, t.y);
    applyEffects(w, s.onImpact, { x: t.x, y: t.y, angle: 0, spec: s, base: s.damage, type: s.dmgType, depth: 0, hitDmg: 0, when: 'impact' });
  }
  w.traps = w.traps.filter((t) => !t.dead);
}

/** Whirlwind: hits all around every tick; may pull enemies in. */
export function updateChannel(w: World, dt: number): void {
  const p = w.player;
  const ch = p.channel;
  if (!ch) return;
  ch.t -= dt;
  ch.tickT -= dt;
  const pull = ch.spec.extra.pull ?? 0;
  if (pull > 0) {
    for (const e of enemiesIn(w, p.x, p.y, ch.spec.area * 1.8)) {
      if (e.boss || e.dummy) continue;
      const a = Math.atan2(p.y - e.y, p.x - e.x);
      e.vx += Math.cos(a) * pull * dt * 4;
      e.vy += Math.sin(a) * pull * dt * 4;
    }
  }
  if (ch.tickT <= 0) {
    ch.tickT += ch.spec.tick;
    w.addFx({ kind: 'slash', x: p.x, y: p.y, a: w.time * 14, a2: Math.PI * 1.4, life: 0.14, size: ch.spec.area, color: '#ffffff', r2: 0 });
    hitAll(w, ch.spec, enemiesIn(w, p.x, p.y, ch.spec.area), p.x, p.y);
    w.breakWalls(p.x, p.y, ch.spec.area);
  }
  if (ch.t <= 0) {
    p.channel = null;
    p.actKind = null;
  }
}

/** Dashes: move fast, stop at walls, hit what they touch (bash, charge). */
export function updateDash(w: World, dt: number): void {
  const p = w.player;
  const d = p.dash;
  if (!d) return;
  d.t -= dt;
  const res = moveCircle(w.map, p.x, p.y, p.r, d.vx * dt, d.vy * dt);
  p.x = res.x;
  p.y = res.y;
  if (d.dodge) {
    if (w.rand() < 0.6) w.addFx({ kind: 'ghost', x: p.x, y: p.y, life: 0.2, size: 1, color: '#ffffff', sprite: 'hero' });
  } else if (d.spec && d.spec.damage > 0) {
    for (const e of w.enemies) {
      if (e.dead || e.state === 'spawn' || d.hit.has(e.id)) continue;
      if (dist2(e.x, e.y, p.x, p.y) > (p.r + e.r + d.spec.radius) ** 2) continue;
      d.hit.add(e.id);
      const dmg = hitEnemy(w, e, d.spec.damage, d.spec.dmgType, { spec: d.spec, depth: 0, fromX: p.x, fromY: p.y });
      applyEffects(w, d.spec.onHit, { x: e.x, y: e.y, angle: Math.atan2(d.vy, d.vx), spec: d.spec, base: d.spec.damage, type: d.spec.dmgType, depth: 0, target: e, hitDmg: dmg, when: 'hit' });
      w.hitstop(0.04);
      w.shake(2);
    }
  }
  if (d.t <= 0 || res.bx || res.by) {
    if (!d.dodge && d.spec) {
      applyEffects(w, d.spec.onImpact, { x: p.x, y: p.y, angle: Math.atan2(d.vy, d.vx), spec: d.spec, base: d.spec.damage, type: d.spec.dmgType, depth: 0, hitDmg: 0, when: 'impact' });
      w.breakWalls(p.x + Math.cos(Math.atan2(d.vy, d.vx)) * 10, p.y + Math.sin(Math.atan2(d.vy, d.vx)) * 10, 8);
    }
    const keep = d.dodge ? 0.35 : 0.1;
    p.vx = d.vx * keep * 0.3;
    p.vy = d.vy * keep * 0.3;
    p.dash = null;
  }
}

/* ------------------------------------------------------------ projectiles */

export function updateProjectiles(w: World, dt: number): void {
  const p = w.player;
  for (const pr of w.projectiles) {
    if (pr.dead) continue;
    pr.age += dt;
    if (pr.homing > 0 && pr.hostile && !p.dead) {
      const want = Math.atan2(p.y - pr.y, p.x - pr.x);
      const cur = Math.atan2(pr.vy, pr.vx);
      const sp = Math.hypot(pr.vx, pr.vy);
      const a = cur + Math.max(-pr.homing * dt, Math.min(pr.homing * dt, angleDiff(cur, want)));
      pr.vx = Math.cos(a) * sp;
      pr.vy = Math.sin(a) * sp;
    }
    const step = Math.hypot(pr.vx, pr.vy) * dt;
    const sub = Math.max(1, Math.ceil(step / 4));
    for (let s = 0; s < sub && !pr.dead; s++) {
      pr.x += (pr.vx * dt) / sub;
      pr.y += (pr.vy * dt) / sub;
      pr.life -= step / sub;
      if (blocksAt(w.map, pr.x, pr.y) && !(pr.wide && pr.age < 0.05)) {
        if (!pr.hostile) {
          w.breakWalls(pr.x, pr.y, 6);
          impact(w, pr, null);
        } else w.addFx({ kind: 'spark', x: pr.x, y: pr.y, life: 0.2, size: 2, color: pr.color });
        pr.dead = true;
        break;
      }
      if (pr.hostile) {
        if (!p.dead && dist2(pr.x, pr.y, p.x, p.y) < (pr.r + p.r) ** 2) {
          if (p.iframe > 0) {
            if (!pr.hit.includes(-1)) {
              pr.hit.push(-1);
              w.dodgedSomething();
            }
          } else {
            hurtPlayer(w, pr.dmg, { fromX: pr.x - pr.vx * 0.05, fromY: pr.y - pr.vy * 0.05, knock: 40 });
            w.addFx({ kind: 'burst', x: pr.x, y: pr.y, life: 0.2, size: 6, color: pr.color });
            pr.dead = true;
          }
        }
        continue;
      }
      // friendly: enemies
      for (const e of w.enemies) {
        if (pr.dead) break;
        if (e.dead || e.state === 'spawn' || pr.hit.includes(e.id)) continue;
        if (dist2(pr.x, pr.y, e.x, e.y) > (pr.r + e.r) ** 2) continue;
        pr.hit.push(e.id);
        const d = hitEnemy(w, e, pr.dmg, pr.type, { spec: pr.depth === 0 ? pr.spec : null, depth: pr.depth, fromX: pr.x - pr.vx * 0.05, fromY: pr.y - pr.vy * 0.05, knock: pr.knock });
        const angle = Math.atan2(pr.vy, pr.vx);
        if (pr.spec) applyEffects(w, pr.spec.onHit, { x: e.x, y: e.y, angle, spec: pr.spec, base: pr.dmg, type: pr.type, depth: pr.depth, target: e, hitDmg: d, proj: pr, when: 'hit' });
        if (pr.pierce > 0) {
          pr.pierce -= 1;
          continue;
        }
        if (pr.bounce > 0) {
          const next = bounceTarget(w, pr, e);
          if (next) {
            pr.bounce -= 1;
            const a = Math.atan2(next.y - pr.y, next.x - pr.x);
            const sp = Math.hypot(pr.vx, pr.vy);
            pr.vx = Math.cos(a) * sp;
            pr.vy = Math.sin(a) * sp;
            pr.life = Math.max(pr.life, 90);
            w.addFx({ kind: 'spark', x: pr.x, y: pr.y, life: 0.2, size: 2, color: '#ffffff' });
            continue;
          }
        }
        impact(w, pr, e);
        pr.dead = true;
      }
    }
    if (!pr.dead && pr.life <= 0) {
      pr.dead = true;
      // quakes and big spells finish with their impact
      if (!pr.hostile && pr.spec && pr.depth === 0 && pr.spec.cast === 'projectile' && pr.spec.look === 'quake') impact(w, pr, null);
    }
    if (!pr.dead && pr.spec?.trail && !pr.hostile) {
      pr.trailT -= dt;
      if (pr.trailT <= 0) {
        pr.trailT = 0.09;
        const g = pr.spec.trail;
        w.spawnField({ x: pr.x, y: pr.y, r: g.radius, dur: g.dur, tick: g.tick, dmg: pr.dmg * g.mul, type: g.dmgType, status: g.status, look: g.look, hostile: false, depth: 1, spec: null, onHit: false });
      }
    }
  }
  w.projectiles = w.projectiles.filter((pr) => !pr.dead);
}

function bounceTarget(w: World, pr: Projectile, from: Enemy): Enemy | null {
  let best: Enemy | null = null;
  let bd = 90 * 90;
  for (const e of w.enemies) {
    if (e.dead || e.state === 'spawn' || e === from || pr.hit.includes(e.id)) continue;
    const d = dist2(e.x, e.y, from.x, from.y);
    if (d < bd && lineOfSight(w.map, from.x, from.y, e.x, e.y)) {
      bd = d;
      best = e;
    }
  }
  return best;
}

/** A friendly projectile stops: its impact effects happen there. */
function impact(w: World, pr: Projectile, e: Enemy | null): void {
  const angle = Math.atan2(pr.vy, pr.vx);
  // walls: step back so bursts aren't inside the stone
  const x = e ? e.x : pr.x - Math.cos(angle) * 3;
  const y = e ? e.y : pr.y - Math.sin(angle) * 3;
  w.addFx({ kind: 'burst', x, y, life: 0.2, size: pr.r + 3, color: pr.type === 'fire' ? '#ffb04d' : pr.type === 'frost' ? '#bdf1ff' : pr.type === 'lightning' ? '#cdeeff' : pr.type === 'poison' ? '#9be36b' : pr.type === 'arcane' ? '#d2a8ff' : '#ffffff' });
  if (pr.spec && pr.spec.onImpact.length) applyEffects(w, pr.spec.onImpact, { x, y, angle, spec: pr.spec, base: pr.dmg, type: pr.type, depth: pr.depth, target: e ?? undefined, hitDmg: 0, proj: pr, when: 'impact' });
}

/** Fields: friendly ones hurt enemies, hostile ones hurt the hero. */
export function updateFields(w: World, dt: number): void {
  const p = w.player;
  for (const f of w.fields) {
    f.t -= dt;
    f.tickT -= dt;
    if (f.tickT <= 0) {
      f.tickT += f.tick;
      if (f.hostile) {
        if (!p.dead && dist2(p.x, p.y, f.x, f.y) < (f.r + p.r * 0.5) ** 2) hurtPlayer(w, f.dmg, { status: f.status });
      } else {
        for (const e of enemiesIn(w, f.x, f.y, f.r)) {
          const d = hitEnemy(w, e, f.dmg, f.type, { spec: f.depth === 0 ? f.spec : null, depth: f.depth, isDot: f.look !== 'arrows', fromX: f.x, fromY: f.y, knock: 0, charge: f.look === 'arrows' ? 0.8 : 0.3 });
          if (f.status) applyStatus(w, e, f.status, d);
          if (f.onHit && f.spec) applyEffects(w, f.spec.onHit, { x: e.x, y: e.y, angle: 0, spec: f.spec, base: f.dmg, type: f.type, depth: f.depth, target: e, hitDmg: d, when: 'hit' });
        }
        if (f.look === 'arrows') {
          for (let i = 0; i < 3; i++) {
            const a = w.rand() * TAU;
            const r = Math.sqrt(w.rand()) * f.r;
            w.addFx({ kind: 'beam', x: f.x + Math.cos(a) * r, y: f.y + Math.sin(a) * r, life: 0.18, size: 1, color: '#f5e6c8', sprite: 'arrow' });
          }
          w.sfx('arrowRain', 0.5);
        }
      }
    }
  }
  w.fields = w.fields.filter((f) => f.t > 0);
}
