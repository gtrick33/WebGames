import { angleDiff, clamp, dist, TAU } from '../core/math';
import { hasStatus, hurtPlayer, tickStatuses } from './combat';
import { hurtPet } from './pets';
import { castRay, circleHitsWall, flowStep, lineOfSight, moveCircle, pushOut } from './map';
import { updateBoss } from './boss';
import type { StatusId } from '../data/types';
import type { Enemy, Pet } from './types';
import type { World } from './world';

/**
 * Enemy behaviour. Every attack has a wind-up the player can read (the renderer draws it from the
 * state): melee arcs, slam circles, aim lines, charge lanes, and circles on the ground for casters.
 * Attack directions lock when the wind-up starts, so stepping aside always works.
 */

/** How strongly enemies push away from each other. */
const SEPARATION = 60;

export function updateEnemy(w: World, e: Enemy, dt: number): void {
  if (e.dead) {
    e.deathT += dt;
    return;
  }
  tickStatuses(w, e, dt);
  if (e.dead) return;
  e.flash = Math.max(0, e.flash - dt);
  // knockback and impulses fade quickly
  const fr = Math.exp(-9 * dt);
  e.vx *= fr;
  e.vy *= fr;
  if (e.state === 'spawn') {
    e.t -= dt;
    if (e.t <= 0) {
      e.state = 'chase';
      e.aggro = true;
    }
    return;
  }
  if (e.dummy) {
    updateDummy(w, e, dt);
    return;
  }
  if (e.boss) {
    updateBoss(w, e, dt);
    return;
  }
  // trolls and the like knit back together when left alone
  e.hurtT += dt;
  if (e.def.regen && e.hurtT > 4 && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * e.def.regen * dt);
  e.blinkT -= dt;
  e.raiseT -= dt;
  const p = victimOf(w, e);
  const stunned = hasStatus(e, 'stun') || hasStatus(e, 'freeze');
  const rooted = hasStatus(e, 'root');
  const chill = e.statuses.find((s) => s.id === 'chill');
  const slow = chill ? clamp(1 - chill.power, 0.25, 1) : 1;
  const speed = e.def.speed * e.speedMul * slow;
  const d = dist(e.x, e.y, p.x, p.y);
  e.atkCd -= dt * e.atkMul;
  let mx = 0;
  let my = 0;

  if (stunned) {
    // a stun interrupts wind-ups and rushes
    if (e.state === 'windup' || e.state === 'act') {
      e.state = 'recover';
      e.t = 0.2;
    }
    applyMove(w, e, 0, 0, dt);
    return;
  }
  e.victimT -= dt;
  if (hasStatus(e, 'fear')) {
    // terrified: runs from the hero and attacks nothing
    const a = Math.atan2(e.y - w.player.y, e.x - w.player.x) + Math.sin(w.time * 3 + e.id) * 0.5;
    if (e.state === 'windup' || e.state === 'act') e.state = 'chase';
    e.aggro = true;
    applyMove(w, e, Math.cos(a) * speed * 0.85, Math.sin(a) * speed * 0.85, dt);
    return;
  }

  switch (e.state) {
    case 'idle': {
      e.t -= dt;
      if (e.t <= 0) {
        e.t = 1.5 + w.rand() * 2.5;
        e.face = w.rand() * TAU;
      }
      if (e.t > 1.2 && dist(e.x, e.y, e.homeX, e.homeY) < 40) {
        mx = Math.cos(e.face) * 0.35;
        my = Math.sin(e.face) * 0.35;
      } else {
        const a = Math.atan2(e.homeY - e.y, e.homeX - e.x);
        if (dist(e.x, e.y, e.homeX, e.homeY) > 20) {
          mx = Math.cos(a) * 0.4;
          my = Math.sin(a) * 0.4;
        }
      }
      if (!p.dead && d < e.def.aggro && lineOfSight(w.map, e.x, e.y, p.x, p.y)) w.alertPack(e);
      if (e.aggro) {
        e.state = 'chase';
        e.atkCd = Math.max(e.atkCd, 0.4 + w.rand() * 0.6);
      }
      break;
    }
    case 'return': {
      const a = Math.atan2(e.homeY - e.y, e.homeX - e.x);
      mx = Math.cos(a);
      my = Math.sin(a);
      e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.3 * dt);
      if (dist(e.x, e.y, e.homeX, e.homeY) < 12) {
        e.state = 'idle';
        e.aggro = false;
        e.statuses = [];
      }
      if (!p.dead && d < e.def.aggro * 0.7 && lineOfSight(w.map, e.x, e.y, p.x, p.y)) {
        e.aggro = true;
        e.state = 'chase';
      }
      break;
    }
    case 'chase': {
      if (p.dead) {
        e.state = 'return';
        break;
      }
      // leash: packs in the open give up when you run far away; room enemies never do
      if (e.room < 0 && d > e.def.aggro * 2.6) {
        e.lostT += dt;
        if (e.lostT > 3) {
          e.state = 'return';
          e.lostT = 0;
          break;
        }
      } else e.lostT = 0;
      const los = lineOfSight(w.map, e.x, e.y, p.x, p.y);
      const toward = steer(w, e, los);
      const ai = e.def.ai;
      // shades slip away when the hero gets close
      if (e.def.blink && e.blinkT <= 0 && d < 52 && !p.dead) {
        blinkAway(w, e, p);
        break;
      }
      // necromancers raise their dead before anything else (and rest a while after each call, so a
      // quick hero doesn't keep them chanting forever)
      if (e.def.summons && e.atkCd <= 0 && e.raiseT <= 0 && w.enemies.filter((o) => o.master === e.id && !o.dead).length < e.def.summons.max) {
        startRaise(w, e);
        break;
      }
      // healers mend a hurt friend before anything else
      if (e.def.heals && e.atkCd <= 0) {
        const ally = hurtAlly(w, e);
        if (ally) {
          startMend(w, e, ally);
          break;
        }
      }
      if (ai === 'ranged' || ai === 'caster' || ai === 'diver') {
        const keep = e.def.keep ?? 90;
        if (los && d <= e.def.reach && e.atkCd <= 0) {
          startWindup(w, e);
          break;
        }
        if (!los || d > keep + 18) {
          mx = toward.x;
          my = toward.y;
        } else if (d < keep - 18) {
          const a = Math.atan2(e.y - p.y, e.x - p.x);
          mx = Math.cos(a);
          my = Math.sin(a);
        } else {
          // strafe around the player
          e.strafe -= dt;
          if (e.strafe < -2.5) e.strafe = 2 + w.rand() * 1.5;
          const side = e.strafe > 0 ? 1 : -1;
          const a = Math.atan2(p.y - e.y, p.x - e.x) + (Math.PI / 2) * side;
          mx = Math.cos(a) * 0.6;
          my = Math.sin(a) * 0.6;
        }
      } else if (ai === 'charger') {
        if (los && d <= e.def.reach && d > 26 && e.atkCd <= 0) {
          startWindup(w, e);
          break;
        }
        if (d < 26) {
          const a = Math.atan2(e.y - p.y, e.x - p.x) + 0.6;
          mx = Math.cos(a);
          my = Math.sin(a);
        } else {
          mx = toward.x;
          my = toward.y;
        }
      } else {
        if (d <= e.def.reach + p.r + e.r && e.atkCd <= 0) {
          startWindup(w, e);
          break;
        }
        if (d > e.def.reach * 0.7 + e.r + p.r) {
          mx = toward.x;
          my = toward.y;
          // pack hunters swing out to the side and close in from there
          if (e.def.flank && los && d > 34) {
            const a = Math.atan2(my, mx) + (e.id % 2 ? 1 : -1) * 0.8 * clamp((d - 34) / 90, 0, 1);
            mx = Math.cos(a);
            my = Math.sin(a);
          }
        }
      }
      if (ai === 'hopper') {
        // slimes move in hops
        e.hopT -= dt;
        if (e.hopT <= 0 && (mx || my)) {
          e.hopT = 0.75 + w.rand() * 0.3;
          e.vx += mx * 95;
          e.vy += my * 95;
        }
        mx = 0;
        my = 0;
      }
      break;
    }
    case 'windup': {
      e.t -= dt * e.atkMul;
      // ranged enemies keep tracking a little until the last part of the wind-up
      if ((e.def.ai === 'ranged' || e.def.ai === 'caster') && !e.mend && e.t > e.def.windup * 0.45 && !p.dead) {
        e.aimA = aimAt(w, e, p);
      }
      if (e.t <= 0) act(w, e);
      break;
    }
    case 'act': {
      // rushes (chargers) and leaps (hoppers)
      const sp = e.def.ai === 'hopper' ? 170 : (e.def.rush?.speed ?? 200);
      const step = sp * dt * slow;
      const res = moveCircle(w.map, e.x, e.y, e.r, Math.cos(e.aimA) * step, Math.sin(e.aimA) * step);
      e.x = res.x;
      e.y = res.y;
      e.rushLeft -= step;
      if (!e.rushHit && !p.dead && dist(e.x, e.y, p.x, p.y) < e.r + p.r + 2) {
        e.rushHit = true;
        hurtVictim(w, p, e.dmg * (e.def.ai === 'hopper' ? 1 : 1.25), { fromX: e.x, fromY: e.y, knock: 130, source: e });
      }
      if (e.def.ai === 'charger' && (w.rand() < 0.5)) w.addFx({ kind: 'smoke', x: e.x, y: e.y + e.r * 0.6, life: 0.3, size: 3, color: '#b9a58a' });
      if (res.bx || res.by) {
        // ran into a wall: dazed, a free moment to hit back
        if (e.def.ai === 'charger') {
          e.statuses.push({ id: 'stun', t: 1, power: 1, tick: 0 });
          w.text(e.x, e.y - e.r - 8, 'DAZED', '#ffe066', false);
          w.shake(1.2);
        }
        e.rushLeft = 0;
      }
      if (e.rushLeft <= 0) {
        e.state = 'recover';
        e.t = e.def.recover;
      }
      return;
    }
    case 'recover':
      e.t -= dt * e.atkMul;
      if (e.t <= 0) {
        e.state = 'chase';
        e.atkCd = e.def.attackCd * (0.85 + w.rand() * 0.3);
      }
      break;
    default:
      break;
  }

  if (rooted) {
    mx = 0;
    my = 0;
  }
  applyMove(w, e, mx * speed, my * speed, dt);
  // molten elites leave fire behind them
  if (e.elite.includes('molten') && (Math.abs(mx) + Math.abs(my) > 0.1 || Math.abs(e.vx) + Math.abs(e.vy) > 20)) {
    e.trailT -= dt;
    if (e.trailT <= 0) {
      e.trailT = 0.45;
      w.spawnField({ x: e.x, y: e.y, r: 10, dur: 2.5, tick: 0.5, dmg: e.dmg * 0.35, type: 'fire', status: { status: 'burn', dur: 2, power: e.dmg * 0.25 }, look: 'fire', hostile: true, depth: 0, spec: null, onHit: false });
    }
  }
}

function applyMove(w: World, e: Enemy, vx: number, vy: number, dt: number): void {
  // a circle that overlaps a wall can't move at all: step it out first
  if (circleHitsWall(w.map, e.x, e.y, e.r)) {
    const free = pushOut(w.map, e.x, e.y, e.r, e.room);
    if (free) {
      e.x = free.x;
      e.y = free.y;
    }
  }
  let res = moveCircle(w.map, e.x, e.y, e.r, (vx + e.vx) * dt, (vy + e.vy) * dt);
  // caught on a corner (a body wider than half a tile following a path between pillars): slide off
  // it, turning a little either way, whichever way gets closer to the player
  const want = Math.hypot(vx, vy) * dt;
  if (want > 0.05 && Math.hypot(res.x - e.x, res.y - e.y) < want * 0.3) {
    const p = w.player;
    let best = Infinity;
    for (const a of [0.6, -0.6, 1.2, -1.2]) {
      const c = Math.cos(a);
      const s = Math.sin(a);
      const t = moveCircle(w.map, e.x, e.y, e.r, (vx * c - vy * s) * dt, (vx * s + vy * c) * dt);
      if (Math.hypot(t.x - e.x, t.y - e.y) < want * 0.5) continue;
      const d = Math.hypot(t.x - p.x, t.y - p.y);
      if (d < best) {
        best = d;
        res = t;
      }
    }
  }
  if (vx || vy) {
    e.walkT += dt;
    if (Math.abs(vx) > 1) e.face = vx < 0 ? Math.PI : 0;
  }
  e.x = res.x;
  e.y = res.y;
}

/** Who an enemy is after: the hero, or a companion. */
interface Victim {
  x: number;
  y: number;
  r: number;
  dead: boolean;
  pet: Pet | null;
}

/**
 * The enemy's target. Bosses always fight the hero. Others look again every second: a taunting
 * companion near them draws them (it counts as much closer), otherwise the nearest of the hero and
 * the companions; with the hero down, a companion still standing.
 */
function victimOf(w: World, e: Enemy): Victim {
  const p = w.player;
  const hero: Victim = { x: p.x, y: p.y, r: p.r, dead: p.dead, pet: null };
  if (e.boss || !w.pets.length) return hero;
  if (e.victimT <= 0) {
    e.victimT = 1;
    let best = p.dead ? Infinity : dist(e.x, e.y, p.x, p.y);
    e.victim = 0;
    for (const pet of w.pets) {
      if (pet.dead) continue;
      const d = dist(e.x, e.y, pet.x, pet.y);
      if (d > e.def.aggro) continue;
      const score = d * (pet.def.taunt ? 0.45 : 1.3);
      if (score < best) {
        best = score;
        e.victim = pet.id;
      }
    }
  }
  const pet = e.victim ? w.pets.find((x) => x.id === e.victim && !x.dead) : undefined;
  if (!pet) {
    e.victim = 0;
    return hero;
  }
  return { x: pet.x, y: pet.y, r: pet.r, dead: false, pet };
}

/** An enemy's blow lands on whoever it was after. */
function hurtVictim(w: World, v: Victim, dmg: number, o: Parameters<typeof hurtPlayer>[2]): void {
  if (v.pet) hurtPet(w, v.pet, dmg);
  else hurtPlayer(w, dmg, o);
}

/**
 * Toward the target: straight when the way is clear for the enemy's whole body, along the flow field
 * otherwise (so a big enemy doesn't walk into a pillar the player is behind).
 */
function steer(w: World, e: Enemy, los: boolean): { x: number; y: number } {
  const p = victimOf(w, e);
  if (los && clearPath(w, e.x, e.y, p.x, p.y, e.r * 0.9)) {
    const a = Math.atan2(p.y - e.y, p.x - e.x);
    return { x: Math.cos(a), y: Math.sin(a) };
  }
  return flowStep(w.map, w.flow, e.x, e.y) ?? { x: 0, y: 0 };
}

/** Whether a circle of radius r can slide straight from one point to another. */
function clearPath(w: World, x0: number, y0: number, x1: number, y1: number, r: number): boolean {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const n = Math.ceil(Math.hypot(dx, dy) / 5);
  for (let i = 1; i < n; i++) if (circleHitsWall(w.map, x0 + (dx * i) / n, y0 + (dy * i) / n, r)) return false;
  return true;
}

/**
 * Where a shot should go: at the target, or ahead of the hero by `lead` of the way they'd move while
 * it flies (aim is fixed a moment before the shot, so changing direction then makes it miss).
 */
function aimAt(w: World, e: Enemy, v: Victim): number {
  const lead = e.def.shot?.lead ?? 0;
  if (!lead || v.pet) return Math.atan2(v.y - e.y, v.x - e.x);
  const p = w.player;
  const t = dist(e.x, e.y, p.x, p.y) / (e.def.shot?.speed ?? 150);
  return Math.atan2(p.y + p.vy * t * lead - e.y, p.x + p.vx * t * lead - e.x);
}

/** The most hurt friend a healer can reach, if any is below 70% health. */
function hurtAlly(w: World, e: Enemy): Enemy | null {
  let best: Enemy | null = null;
  let low = 0.7;
  for (const o of w.enemies) {
    if (o === e || o.dead || o.dummy || o.boss || o.state === 'spawn') continue;
    const share = o.hp / o.maxHp;
    if (share >= low || dist(e.x, e.y, o.x, o.y) > 150 || !lineOfSight(w.map, e.x, e.y, o.x, o.y)) continue;
    low = share;
    best = o;
  }
  return best;
}

/** A blink: gone in a puff, back a little way off, away from the hero. */
function blinkAway(w: World, e: Enemy, v: Victim): void {
  const away = Math.atan2(e.y - v.y, e.x - v.x) + (w.rand() - 0.5) * 1.4;
  const to = castRay(w.map, e.x, e.y, e.r, away, e.def.blink ?? 70);
  w.addFx({ kind: 'smoke', x: e.x, y: e.y, life: 0.4, size: 8, color: '#c9a8ff' });
  e.x = to.x;
  e.y = to.y;
  e.vx = 0;
  e.vy = 0;
  e.blinkT = 4;
  w.addFx({ kind: 'burst', x: e.x, y: e.y, life: 0.3, size: 10, color: '#c9a8ff' });
  w.sfx('blink', 0.35);
}

/** A summoner's call: a dark circle while it chants, then its minions climb out of the ground. */
function startRaise(w: World, e: Enemy): void {
  e.state = 'windup';
  e.t = e.def.windup * 1.4;
  e.raising = true;
  e.mend = 0;
  w.addFx({ kind: 'ring', x: e.x, y: e.y + 2, life: e.def.windup * 1.4, size: 22, color: '#9a5aff' });
  w.sfx('summon', 0.4);
}

function raise(w: World, e: Enemy): void {
  e.raising = false;
  const s = e.def.summons!;
  e.raiseT = s.cd ?? 7;
  const alive = w.enemies.filter((o) => o.master === e.id && !o.dead).length;
  const n = Math.min(s.count, s.max - alive);
  for (let i = 0; i < n; i++) {
    const a = (TAU * i) / n + w.rand();
    const to = castRay(w.map, e.x, e.y, 6, a, 22);
    const m = w.addEnemy(s.enemy, to.x, to.y, Math.max(1, e.level - 1), { room: e.room, pack: -1, spawn: true });
    m.master = e.id;
    m.aggro = true;
  }
}

function startMend(w: World, e: Enemy, ally: Enemy): void {
  e.state = 'windup';
  e.t = e.def.windup;
  e.mend = ally.id;
  e.aimA = Math.atan2(ally.y - e.y, ally.x - e.x);
  e.face = Math.cos(e.aimA) < 0 ? Math.PI : 0;
  w.sfx('enemyWindup', 0.35);
}

/** The heal lands (if its target still lives). */
function mend(w: World, e: Enemy): void {
  const ally = w.enemyById(e.mend);
  e.mend = 0;
  if (!ally || ally.dead) return;
  const add = ally.maxHp * (e.def.heals ?? 0);
  ally.hp = Math.min(ally.maxHp, ally.hp + add);
  w.addFx({ kind: 'zap', x: e.x, y: e.y - 4, x2: ally.x, y2: ally.y - 4, life: 0.3, size: 1.4, color: '#7bff9a' });
  w.addFx({ kind: 'glow', x: ally.x, y: ally.y - 4, life: 0.5, size: 12, color: '#7bff9a' });
  w.text(ally.x, ally.y - ally.r - 10, `+${Math.round(add)}`, '#7bff9a', false);
  w.sfx('soul', 0.4);
}

function startWindup(w: World, e: Enemy): void {
  const p = victimOf(w, e);
  e.mend = 0;
  e.raising = false;
  e.state = 'windup';
  e.t = e.def.windup;
  e.aimA = Math.atan2(p.y - e.y, p.x - e.x);
  e.aimX = p.x;
  e.aimY = p.y;
  e.face = Math.cos(e.aimA) < 0 ? Math.PI : 0;
  if (e.def.ai === 'caster' && (!e.def.shot || w.rand() < 0.55)) {
    // a circle on the ground where the player stands now
    const r = e.def.slam?.radius ?? 20;
    w.addTelegraph({ shape: 'circle', x: p.x, y: p.y, r, r2: 0, angle: 0, len: 0, dur: e.def.windup / e.atkMul, dmg: e.dmg * 1.2, knock: 40, tone: e.def.id === 'rift-acolyte' ? 'rift' : 'enemy', owner: e.id, linger: 0 });
    e.aimX = -1;
  } else if (e.def.ai === 'caster') e.aimX = -2;
  if (e.def.ai === 'charger') {
    const len = Math.min(e.def.rush?.dist ?? 120, 220);
    e.rushLeft = len;
  }
  if (e.def.ai === 'exploder') {
    // the swell: a circle that follows it and bursts when the wind-up ends
    const r = e.def.burst?.radius ?? 26;
    w.addTelegraph({ shape: 'circle', x: e.x, y: e.y, r, r2: 0, angle: 0, len: 0, dur: e.def.windup / e.atkMul, dmg: e.dmg * 2.2, knock: 140, tone: 'enemy', owner: e.id, linger: 0 });
  }
  if (e.def.ai === 'diver') {
    // a swoop along a line marked on the ground
    const len = Math.min(e.def.rush?.dist ?? 140, 240);
    e.rushLeft = len;
    w.addTelegraph({ shape: 'line', x: e.x, y: e.y, r: 0, r2: e.r * 2 + 4, angle: e.aimA, len: len + e.r, dur: e.def.windup / e.atkMul, dmg: 0, knock: 0, tone: 'enemy', owner: -1, linger: 0 });
  }
  w.sfx(e.def.ai === 'charger' ? 'snort' : 'enemyWindup', 0.4);
}

function act(w: World, e: Enemy): void {
  const p = victimOf(w, e);
  if (e.raising) {
    raise(w, e);
    e.state = 'recover';
    e.t = e.def.recover;
    return;
  }
  if (e.def.ai === 'exploder') {
    // it bursts (the circle drawn at the wind-up does the damage) and is gone, with nothing to loot:
    // kill it before it gets there
    const b = e.def.burst;
    if (b && b.pool > 0) w.spawnField({ x: e.x, y: e.y, r: b.radius * 0.8, dur: b.pool, tick: 0.5, dmg: e.dmg * 0.3, type: 'poison', status: { status: 'poison', dur: 2, power: e.dmg * 0.3 }, look: 'poison', hostile: true, depth: 0, spec: null, onHit: false });
    w.fxBurst(e.x, e.y, b?.color ?? '#9ac04a', 16, b?.radius ?? 26);
    w.sfx('explode', 0.6);
    e.hp = 0;
    e.dead = true;
    e.deathT = 0;
    w.enemyGone(e);
    return;
  }
  if (e.mend) {
    mend(w, e);
    e.state = 'recover';
    e.t = e.def.recover;
    return;
  }
  switch (e.def.ai) {
    case 'melee': {
      w.addFx({ kind: 'slash', x: e.x, y: e.y, a: e.aimA, a2: 1.8, life: 0.15, size: e.def.reach + 6, color: '#ff8a8a', r2: 0 });
      if (!p.dead && dist(e.x, e.y, p.x, p.y) <= e.def.reach + p.r + e.r + 4 && Math.abs(angleDiff(e.aimA, Math.atan2(p.y - e.y, p.x - e.x))) < 1.1) hurtVictim(w, p, e.dmg, { fromX: e.x, fromY: e.y, knock: 80, source: e });
      w.sfx('enemySwing', 0.5);
      e.state = 'recover';
      e.t = e.def.recover;
      break;
    }
    case 'hopper':
      e.state = 'act';
      e.rushLeft = 38;
      e.rushHit = false;
      w.sfx('squish', 0.5);
      break;
    case 'armored': {
      const r = e.def.slam?.radius ?? 30;
      w.addFx({ kind: 'ring', x: e.x, y: e.y, life: 0.35, size: r, color: '#ffb07a' });
      w.fxBurst(e.x, e.y + 4, '#a89070', 10, r);
      w.shake(2);
      w.sfx('slam', 0.6);
      if (!p.dead && dist(e.x, e.y, p.x, p.y) <= r + p.r * 0.5) hurtVictim(w, p, e.dmg * 1.2, { fromX: e.x, fromY: e.y, knock: 120, source: e });
      // a slam also catches companions standing in it
      for (const pet of w.pets) if (!pet.dead && pet !== p.pet && dist(e.x, e.y, pet.x, pet.y) <= r + pet.r * 0.5) hurtPet(w, pet, e.dmg * 1.2);
      e.state = 'recover';
      e.t = e.def.recover;
      break;
    }
    case 'ranged':
      shoot(w, e);
      e.state = 'recover';
      e.t = e.def.recover;
      break;
    case 'caster':
      if (e.aimX === -2) shoot(w, e);
      e.state = 'recover';
      e.t = e.def.recover;
      break;
    case 'charger':
    case 'diver':
      e.state = 'act';
      e.rushHit = false;
      w.sfx('rush', 0.6);
      break;
  }
}

function shoot(w: World, e: Enemy): void {
  const s = e.def.shot;
  if (!s) return;
  const look = s.look ?? (s.homing ? 'orb' : e.def.id === 'skeleton-archer' ? 'enemyArrow' : 'stone');
  const fire = (a: number, mul: number): void => {
    w.spawnProjectile({ x: e.x + Math.cos(a) * e.r, y: e.y - 3 + Math.sin(a) * e.r, vx: Math.cos(a) * s.speed, vy: Math.sin(a) * s.speed, r: s.radius, life: 260, dmg: e.dmg * mul, type: 'physical', spec: null, depth: 0, pierce: 0, bounce: 0, hit: [], look, color: s.color, hostile: true, homing: s.homing ?? 0, child: false, knock: 0, ...(s.status ? { status: shotStatus(e, s.status) } : {}) });
  };
  for (let i = 0; i < s.count; i++) fire(s.count === 1 ? e.aimA : e.aimA - s.spread / 2 + (s.spread * i) / (s.count - 1), 1);
  // elites throw a wider spread
  if (e.elite.length && s.count === 1) for (const off of [-0.32, 0.32]) fire(e.aimA + off, 0.8);
  w.sfx(look === 'enemyArrow' ? 'enemyBow' : look === 'spear' ? 'spear' : 'sling', 0.45);
}

/** Training dummies: the shooter fires a slow bolt you can dodge through. */
function updateDummy(w: World, e: Enemy, dt: number): void {
  e.hp = e.maxHp;
  if (e.dummy !== 2) return;
  const p = w.player;
  e.atkCd -= dt;
  if (e.atkCd > 0 || p.dead) return;
  if (dist(e.x, e.y, p.x, p.y) > 150 || !lineOfSight(w.map, e.x, e.y, p.x, p.y)) return;
  e.atkCd = 2.2;
  const a = Math.atan2(p.y - e.y, p.x - e.x);
  e.face = Math.cos(a) < 0 ? Math.PI : 0;
  w.spawnProjectile({ x: e.x, y: e.y - 6, vx: Math.cos(a) * 62, vy: Math.sin(a) * 62, r: 4, life: 170, dmg: 3, type: 'arcane', spec: null, depth: 0, pierce: 0, bounce: 0, hit: [], look: 'orb', color: '#ffcf5a', hostile: true, homing: 0, child: false, knock: 0 });
  w.sfx('sling', 0.3);
}

/** Pushes enemies apart and out of the hero. */
export function separate(w: World, dt: number, list: Enemy[] = w.enemies): void {
  const p = w.player;
  for (let i = 0; i < list.length; i++) {
    const a = list[i]!;
    if (a.dead || a.dummy) continue;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j]!;
      if (b.dead || b.dummy) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const min = a.r + b.r;
      const d2 = dx * dx + dy * dy;
      if (d2 >= min * min || d2 === 0) continue;
      const d = Math.sqrt(d2);
      const push = ((min - d) / min) * SEPARATION * dt;
      const ma = a.boss ? 0 : 1 / a.def.mass;
      const mb = b.boss ? 0 : 1 / b.def.mass;
      const sum = ma + mb || 1;
      const ra = moveCircle(w.map, a.x, a.y, a.r, (-dx / d) * push * (ma / sum) * 2, (-dy / d) * push * (ma / sum) * 2);
      a.x = ra.x;
      a.y = ra.y;
      const rb = moveCircle(w.map, b.x, b.y, b.r, (dx / d) * push * (mb / sum) * 2, (dy / d) * push * (mb / sum) * 2);
      b.x = rb.x;
      b.y = rb.y;
    }
    // enemies never stand inside the hero (the hero isn't pushed: movement stays in the player's hands)
    if (!p.dead && a.state !== 'act') {
      const dx = a.x - p.x;
      const dy = a.y - p.y;
      const min = a.r + p.r;
      const d2 = dx * dx + dy * dy;
      if (d2 < min * min && d2 > 0 && !a.boss) {
        const d = Math.sqrt(d2);
        const r = moveCircle(w.map, a.x, a.y, a.r, (dx / d) * (min - d), (dy / d) * (min - d));
        a.x = r.x;
        a.y = r.y;
      }
    }
  }
}

/** A shot's status: burning, poison and bleeding grow with the enemy's level like its damage (a slow stays a slow). */
function shotStatus(e: Enemy, st: { status: StatusId; dur: number; power: number }): { status: StatusId; dur: number; power: number } {
  const dot = st.status === 'burn' || st.status === 'poison' || st.status === 'bleed';
  return dot ? { ...st, power: st.power * (e.dmg / Math.max(1, e.def.dmg)) } : st;
}
