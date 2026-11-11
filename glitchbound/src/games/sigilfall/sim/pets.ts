import { angleDiff, dist, dist2, TAU } from '../core/math';
import { CLASSES } from '../data/classes';
import { PETS } from '../data/pets';
import { bossHidden } from './boss';
import { effStats, hitEnemy } from './combat';
import { castRay, circleHitsWall, flowField, flowStep, lineOfSight, moveCircle, pushOut, TILE } from './map';
import { aimAlong, clearLine, findRoute } from './nav';
import type { Enemy, Pet } from './types';
import type { World } from './world';

/**
 * Companions: the warlock's demons, the ranger's wolf, the druid's treants. A pet goes for the enemy
 * nearest the hero (the hero's own target first), attacks on its cooldown, and comes back to heel when
 * the fight is over or it strays too far. Pets with `taunt` draw enemies near them. A pet's numbers
 * are shares of the hero's, raised by the `pet` stat; its hits use the hero's damage bonuses but never
 * trigger the hero's procs.
 */

/** Pets at most at once (temporary ones fade early when more are called). */
const MAX_PETS = 6;

const petStat = (w: World): number => 1 + (effStats(w).pet ?? 0) / 100;

/**
 * Calls `count` pets of a kind. A pet that stays (dur 0) is called once: calling again heals it. `skill` is
 * the skill whose cast calls them: they leave when it leaves the bar.
 */
export function summonPet(w: World, id: string, count: number, dur: number, skill?: string): void {
  const def = PETS[id];
  if (!def) return;
  const p = w.player;
  const k = petStat(w);
  const maxHp = Math.max(10, Math.round(p.maxHp * def.hp * k));
  const dmg = CLASSES[w.hero.cls].refDamage * def.dmg * k;
  let made = 0;
  if (dur === 0) {
    const have = w.pets.filter((x) => !x.dead && x.def.id === id && x.life === Infinity);
    for (const pet of have) {
      pet.skill = skill;
      pet.hp = pet.maxHp = maxHp;
      pet.dmg = dmg;
      w.addFx({ kind: 'glow', x: pet.x, y: pet.y - 4, life: 0.5, size: 10, color: '#8bff6a' });
    }
    made = have.length;
  }
  for (let i = made; i < count; i++) {
    const a = (TAU * i) / Math.max(1, count) + w.rand();
    const to = castRay(w.map, p.x, p.y, def.radius, a, 14);
    if (w.pets.filter((x) => !x.dead).length >= MAX_PETS) {
      // the oldest temporary pet makes room
      const old = w.pets.find((x) => !x.dead && x.life !== Infinity);
      if (!old) break;
      old.dead = true;
    }
    w.pets.push({ id: w.nextId++, def, x: to.x, y: to.y, vx: 0, vy: 0, r: def.radius, hp: maxHp, maxHp, dmg, atkCd: 0.4, life: dur > 0 ? dur : Infinity, target: null, face: 0, walkT: 0, flash: 0, actT: 0, dead: false, deathT: 0, skill });
    w.addFx({ kind: 'burst', x: to.x, y: to.y, life: 0.35, size: 10, color: def.dmgType === 'fire' ? '#ff9a4d' : def.dmgType === 'shadow' ? '#b58aff' : def.dmgType === 'nature' ? '#9cf07a' : '#ffffff' });
  }
  w.sfx('summon', 0.6);
}

/** Seconds one of the story's people takes to fade out as they go (a summon goes in a puff instead). */
export const STORY_FADE = 1.2;
/** Seconds one of the story's people takes to come in where they are set down (render: a fade). */
export const STORY_ARRIVE = 0.6;

/**
 * Puts a story pet (a companion, a door to hold, a villager to lead out) at a place; it stays until the
 * story takes it away. Its health is a share of the hero's like any companion's.
 */
export function placePet(w: World, id: string, x: number, y: number): Pet | null {
  const def = PETS[id];
  if (!def) return null;
  const k = petStat(w);
  const maxHp = Math.max(10, Math.round(w.player.maxHp * def.hp * k));
  const pet: Pet = { id: w.nextId++, def, x, y, vx: 0, vy: 0, r: def.radius, hp: maxHp, maxHp, dmg: CLASSES[w.hero.cls].refDamage * def.dmg * k, atkCd: 0.6, life: Infinity, target: null, face: 0, walkT: 0, flash: 0, actT: 0, dead: false, deathT: 0, story: true, born: w.time };
  w.pets.push(pet);
  return pet;
}

/** A pet takes a hit; returns whether it fell. */
export function hurtPet(w: World, pet: Pet, dmg: number): boolean {
  if (pet.dead || pet.def.unhurt) return false;
  if (pet.downT) return false;
  pet.hp -= dmg;
  pet.flash = 0.12;
  w.text(pet.x, pet.y - 12, `-${Math.round(dmg)}`, '#ffb0b0', false);
  // a companion goes down, not out
  if (pet.hp <= 0 && pet.def.rally) {
    pet.hp = 0;
    pet.downT = 6;
    pet.vx = 0;
    pet.vy = 0;
    w.fxBurst(pet.x, pet.y, '#c9c3e6', 6, 8);
    return false;
  }
  if (pet.hp <= 0) {
    pet.dead = true;
    pet.deathT = 0;
    w.fxBurst(pet.x, pet.y, '#c9c3e6', 10, 10);
    return true;
  }
  return false;
}

/** The pets keep up with the hero's health (a level or new gear scales them). */
export function refreshPets(w: World): void {
  const k = petStat(w);
  for (const pet of w.pets) {
    if (pet.dead) continue;
    const share = pet.hp / pet.maxHp;
    pet.maxHp = Math.max(10, Math.round(w.player.maxHp * pet.def.hp * k));
    pet.hp = pet.maxHp * share;
    pet.dmg = CLASSES[w.hero.cls].refDamage * pet.def.dmg * k;
  }
}

function pickTarget(w: World, pet: Pet): Enemy | null {
  const p = w.player;
  // (a boss gone from sight, in a coffin or torn into shards, can't be fought: the pet turns to what can)
  const cur = pet.target !== null ? w.enemies.find((e) => e.id === pet.target && !e.dead && !bossHidden(e)) : undefined;
  if (cur && dist(cur.x, cur.y, p.x, p.y) < 190) return cur;
  let best: Enemy | null = null;
  let bd = Infinity;
  for (const e of w.enemies) {
    if (e.dead || e.dummy || e.held || e.state === 'spawn' || bossHidden(e)) continue;
    // only what is already fighting, or close to the hero
    const dh = dist(e.x, e.y, p.x, p.y);
    if (dh > 150 || (!e.aggro && dh > 90)) continue;
    const d = dist2(e.x, e.y, pet.x, pet.y) * (e.aggro ? 1 : 1.5);
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  return best;
}

/** How far apart two people stand, on top of their bodies: the models are wider than the rules' circles. */
const ELBOW_ROOM = 18;
/** How hard they ease apart, in world pixels a second at full overlap. */
const EASE_APART = 130;
/** They part a little sideways too, so three in a line against a wall slide past rather than pin each other. */
const SLIDE = 0.45;

/**
 * Nobody stands in anybody else: companions ease apart from each other and out of the hero. (Wards stand where
 * they were put, and the hero's movement stays in the player's hands.)
 */
function keepApart(w: World, dt: number): void {
  const list = w.pets.filter((pet) => !pet.dead && pet.def.role !== 'ward');
  const p = w.player;
  const nudge = (pet: Pet, dx: number, dy: number): void => {
    const res = moveCircle(w.map, pet.x, pet.y, pet.r, dx, dy);
    pet.x = res.x;
    pet.y = res.y;
  };
  for (let i = 0; i < list.length; i++) {
    const a = list[i]!;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j]!;
      // (nobody is shoved off the last steps of their own walk)
      if ((a.goal && dist(a.x, a.y, a.goal.x, a.goal.y) < 10) || (b.goal && dist(b.x, b.y, b.goal.x, b.goal.y) < 10)) continue;
      const min = a.r + b.r + ELBOW_ROOM;
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let d = Math.hypot(dx, dy);
      if (d >= min) continue;
      // (two on the very same spot: part them along a line of their own)
      if (d < 0.01) {
        const t = (a.id * 2.4 + b.id) % TAU;
        dx = Math.cos(t);
        dy = Math.sin(t);
        d = 1;
      }
      const push = ((min - Math.min(d, min)) / min) * EASE_APART * dt;
      const ux = ((dx - dy * SLIDE) / d) * push;
      const uy = ((dy + dx * SLIDE) / d) * push;
      nudge(a, -ux, -uy);
      nudge(b, ux, uy);
    }
    // (someone on their way somewhere walks round the hero by the rules: the courier must reach the gate)
    if (p.dead || a.downT || a.goal) continue;
    const min = a.r + p.r + ELBOW_ROOM;
    const dx = a.x - p.x;
    const dy = a.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d < min && d > 0.01) {
      const push = ((min - d) / min) * EASE_APART * dt;
      nudge(a, ((dx - dy * SLIDE) / d) * push, ((dy + dx * SLIDE) / d) * push);
    }
  }
}

/** How much wider than their body people plan for: what keeps them off what they pass. */
const ROOMY = 3;

/**
 * The way to go toward a spot from where a pet is: straight if a body can walk it, or along a route round whatever's in
 * the way, thought over every so often as the spot moves.
 */
function headFor(w: World, pet: Pet, tx: number, ty: number): { x: number; y: number } | null {
  if (clearLine(w.map, pet.x, pet.y, tx, ty, pet.r + 1)) {
    const d = dist(tx, ty, pet.x, pet.y) || 1;
    pet.route = undefined;
    return { x: (tx - pet.x) / d, y: (ty - pet.y) / d };
  }
  if (!pet.route || w.time - (pet.routeAt ?? -9) > 0.7) {
    pet.route = findRoute(w.map, pet.x, pet.y, tx, ty, { r: pet.r + ROOMY, budget: 1800 }) ?? findRoute(w.map, pet.x, pet.y, tx, ty, { r: pet.r, budget: 1800 }) ?? undefined;
    pet.routeAt = w.time;
  }
  return pet.route ? aimAlong(pet.route, pet.x, pet.y) : null;
}

/** A pet with somewhere to be walks there along a route round what stands, thought out once and again if it's cut off. */
function walkTo(w: World, pet: Pet, goal: { x: number; y: number }, dt: number, pace = 0.7): void {
  const d = dist(goal.x, goal.y, pet.x, pet.y);
  let step: { x: number; y: number } | null = null;
  if (!pet.paused && d > 3) {
    if (!pet.route && w.time - (pet.routeAt ?? -9) > 0.5) {
      pet.routeAt = w.time;
      pet.route = findRoute(w.map, pet.x, pet.y, goal.x, goal.y, { r: pet.r + ROOMY, budget: 20000, roads: true }) ?? findRoute(w.map, pet.x, pet.y, goal.x, goal.y, { r: pet.r, budget: 20000 }) ?? undefined;
    }
    step = pet.route ? aimAlong(pet.route, pet.x, pet.y) : null;
    // (the route's end, or no route at all: the flow of the land, as far as that will take them)
    if (!step) {
      pet.route = undefined;
      pet.flow ??= flowField(w.map, Math.floor(goal.x / TILE), Math.floor(goal.y / TILE), 400);
      step = d < 2 * TILE ? { x: (goal.x - pet.x) / d, y: (goal.y - pet.y) / d } : flowStep(w.map, pet.flow, pet.x, pet.y);
    }
  }
  const speed = pet.def.speed * pace;
  pet.vx += ((step?.x ?? 0) * speed - pet.vx) * Math.min(1, dt * 8);
  pet.vy += ((step?.y ?? 0) * speed - pet.vy) * Math.min(1, dt * 8);
  if (step) pet.face = step.x < 0 ? Math.PI : 0;
  const res = moveCircle(w.map, pet.x, pet.y, pet.r, pet.vx * dt, pet.vy * dt);
  pet.x = res.x;
  pet.y = res.y;
  if (Math.hypot(pet.vx, pet.vy) > 8) pet.walkT += dt;
}

export function updatePets(w: World, dt: number): void {
  const p = w.player;
  let company = 0;
  for (const pet of w.pets) if (!pet.dead && !pet.goal && pet.def.role !== 'ward') company++;
  for (const pet of w.pets) {
    if (pet.dead) {
      pet.deathT += dt;
      continue;
    }
    pet.flash = Math.max(0, pet.flash - dt);
    pet.actT = Math.max(0, pet.actT - dt);
    pet.atkCd -= dt;
    if (pet.life !== Infinity) {
      pet.life -= dt;
      if (pet.life <= 0) {
        pet.dead = true;
        // a summon goes in a puff; one of the story's people has already faded out (render: STORY_FADE)
        if (pet.story) pet.deathT = STORY_FADE;
        else w.addFx({ kind: 'smoke', x: pet.x, y: pet.y, life: 0.5, size: 6, color: '#c9c3e6' });
        continue;
      }
    }
    if (p.dead) continue;
    // a companion who was knocked down gets back up
    if (pet.downT) {
      pet.downT = Math.max(0, pet.downT - dt);
      if (pet.downT === 0) {
        pet.hp = pet.maxHp * 0.5;
        w.text(pet.x, pet.y - 14, 'Up!', '#9cff9c', false);
      }
      continue;
    }
    // an ally coming into the fight runs to the hero, and follows once beside them
    if (pet.goal && pet.joinT !== undefined) {
      pet.joinT -= dt;
      if (pet.joinT <= 0 || dist(pet.x, pet.y, p.x, p.y) < 2.5 * TILE) {
        pet.goal = undefined;
        pet.flow = undefined;
        pet.route = undefined;
        pet.joinT = undefined;
      } else {
        // (the hero has moved on: after them)
        if (dist(pet.goal.x, pet.goal.y, p.x, p.y) > 3 * TILE) {
          pet.goal = { x: p.x, y: p.y };
          pet.flow = undefined;
          pet.route = undefined;
        pet.route = undefined;
        }
        walkTo(w, pet, pet.goal, dt, 1);
        continue;
      }
    }
    // someone walking on their own (into the camp, or a wagon on the road): whatever the hero does
    if (pet.goal) {
      walkTo(w, pet, pet.goal, dt);
      // (going in at a door: gone through it once there)
      if (pet.inside && dist(pet.x, pet.y, pet.goal.x, pet.goal.y) < 6) pet.life = Math.min(pet.life, 0.5);
      continue;
    }
    // a ward (a door, a gate) stands where it was put and only takes the blows
    if (pet.def.role === 'ward') continue;
    // too far behind: it catches up (coming in beside the hero, a fade rather than a pop)
    if (dist(pet.x, pet.y, p.x, p.y) > 260) {
      const to = castRay(w.map, p.x, p.y, pet.r, w.rand() * TAU, 16);
      pet.x = to.x;
      pet.y = to.y;
      pet.target = null;
      if (pet.story) pet.born = w.time;
    }
    // people being led to safety follow and never fight
    const e = pet.def.role === 'follower' ? null : pickTarget(w, pet);
    pet.target = e?.id ?? null;
    let mx = 0;
    let my = 0;
    const speed = pet.def.speed;
    if (e) {
      const d = dist(e.x, e.y, pet.x, pet.y);
      const a = Math.atan2(e.y - pet.y, e.x - pet.x);
      pet.face = Math.cos(a) < 0 ? Math.PI : 0;
      const reach = pet.def.ranged ? pet.def.reach : pet.def.reach + e.r + pet.r;
      const see = !pet.def.ranged || lineOfSight(w.map, pet.x, pet.y, e.x, e.y);
      if (d > reach * (pet.def.ranged ? 0.9 : 1) || !see) {
        const way = headFor(w, pet, e.x, e.y);
        mx = way?.x ?? 0;
        my = way?.y ?? 0;
      } else if (pet.atkCd <= 0) {
        pet.atkCd = pet.def.attackCd;
        pet.actT = 0.2;
        if (pet.def.ranged) {
          w.spawnProjectile({ x: pet.x, y: pet.y - 4, vx: Math.cos(a) * 200, vy: Math.sin(a) * 200, r: 2.5, life: pet.def.reach + 30, dmg: pet.dmg, type: pet.def.dmgType, spec: null, depth: 1, pierce: 0, bounce: 0, hit: [], look: pet.def.shot ?? 'ember', color: '#ff9a4d', child: true, knock: 10 });
        } else {
          w.addFx({ kind: 'slash', x: pet.x, y: pet.y, a, a2: 1.4, life: 0.14, size: pet.def.reach + 6, color: '#ffffff', r2: 0 });
          hitEnemy(w, e, pet.dmg, pet.def.dmgType, { depth: 1, fromX: pet.x, fromY: pet.y, knock: 30, charge: 0.5 });
        }
      }
    } else {
      // at heel: a few steps behind the hero
      const hx = p.x - Math.cos(p.aim) * 26;
      const hy = p.y - Math.sin(p.aim) * 20;
      const d = dist(hx, hy, pet.x, pet.y);
      // (a bigger company follows looser: each stops where there is room, rather than all on the one spot)
      const loose = 10 + company * 7;
      if (d > loose) {
        const a = Math.atan2(hy - pet.y, hx - pet.x);
        const k = Math.min(1, (d - loose + 6) / 30);
        const way = headFor(w, pet, hx, hy);
        mx = (way?.x ?? 0) * k;
        my = (way?.y ?? 0) * k;
        if (Math.abs(angleDiff(a, 0)) < Math.PI / 2) pet.face = 0;
        else pet.face = Math.PI;
      }
    }
    pet.vx += (mx * speed - pet.vx) * Math.min(1, dt * 10);
    pet.vy += (my * speed - pet.vy) * Math.min(1, dt * 10);
    if (circleHitsWall(w.map, pet.x, pet.y, pet.r)) {
      const to = pushOut(w.map, pet.x, pet.y, pet.r);
      if (to) {
        pet.x = to.x;
        pet.y = to.y;
      }
    }
    const res = moveCircle(w.map, pet.x, pet.y, pet.r, pet.vx * dt, pet.vy * dt);
    pet.x = res.x;
    pet.y = res.y;
    if (Math.hypot(pet.vx, pet.vy) > 8) pet.walkT += dt;
  }
  keepApart(w, dt);
  w.pets = w.pets.filter((pet) => !pet.dead || pet.deathT < (pet.story ? STORY_FADE : 0.5));
}
