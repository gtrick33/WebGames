import { angleDiff, dist, dist2, TAU } from '../core/math';
import { CLASSES } from '../data/classes';
import { PETS } from '../data/pets';
import { effStats, hitEnemy } from './combat';
import { castRay, circleHitsWall, lineOfSight, moveCircle, pushOut } from './map';
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

/** Calls `count` pets of a kind. A pet that stays (dur 0) is called once: calling again heals it. */
export function summonPet(w: World, id: string, count: number, dur: number): void {
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
    w.pets.push({ id: w.nextId++, def, x: to.x, y: to.y, vx: 0, vy: 0, r: def.radius, hp: maxHp, maxHp, dmg, atkCd: 0.4, life: dur > 0 ? dur : Infinity, target: null, face: 0, walkT: 0, flash: 0, actT: 0, dead: false, deathT: 0 });
    w.addFx({ kind: 'burst', x: to.x, y: to.y, life: 0.35, size: 10, color: def.dmgType === 'fire' ? '#ff9a4d' : def.dmgType === 'shadow' ? '#b58aff' : def.dmgType === 'nature' ? '#9cf07a' : '#ffffff' });
  }
  w.sfx('summon', 0.6);
}

/** A pet takes a hit; returns whether it fell. */
export function hurtPet(w: World, pet: Pet, dmg: number): boolean {
  if (pet.dead) return false;
  pet.hp -= dmg;
  pet.flash = 0.12;
  w.text(pet.x, pet.y - 12, `-${Math.round(dmg)}`, '#ffb0b0', false);
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
  const cur = pet.target !== null ? w.enemies.find((e) => e.id === pet.target && !e.dead) : undefined;
  if (cur && dist(cur.x, cur.y, p.x, p.y) < 190) return cur;
  let best: Enemy | null = null;
  let bd = Infinity;
  for (const e of w.enemies) {
    if (e.dead || e.dummy || e.state === 'spawn') continue;
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

export function updatePets(w: World, dt: number): void {
  const p = w.player;
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
        w.addFx({ kind: 'smoke', x: pet.x, y: pet.y, life: 0.5, size: 6, color: '#c9c3e6' });
        continue;
      }
    }
    if (p.dead) continue;
    // too far behind: it catches up in a puff
    if (dist(pet.x, pet.y, p.x, p.y) > 260) {
      const to = castRay(w.map, p.x, p.y, pet.r, w.rand() * TAU, 16);
      pet.x = to.x;
      pet.y = to.y;
      pet.target = null;
    }
    const e = pickTarget(w, pet);
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
        mx = Math.cos(a);
        my = Math.sin(a);
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
      const hx = p.x - Math.cos(p.aim) * 16;
      const hy = p.y - Math.sin(p.aim) * 12;
      const d = dist(hx, hy, pet.x, pet.y);
      if (d > 10) {
        const a = Math.atan2(hy - pet.y, hx - pet.x);
        const k = Math.min(1, d / 30);
        mx = Math.cos(a) * k;
        my = Math.sin(a) * k;
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
  w.pets = w.pets.filter((pet) => !pet.dead || pet.deathT < 0.5);
}
