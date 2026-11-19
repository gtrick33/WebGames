import { angleDiff, dist, dist2, inCone, TAU } from '../core/math';
import { CLASSES } from '../data/classes';
import type { GroundSpec, SkillSpec, SlotKey, BuffDef } from '../data/types';
import { bossHidden } from './boss';
import { applyEffects, applyStatus, enemiesIn, gainPoints, gainResource, healPlayer, hitEnemy, hurtPlayer, playerStunned, runProcs, empowerFull, empowerOf, spendEmpower } from './combat';
import { hurtPet } from './pets';
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
    if (e.dead || e.state === 'spawn' || e.dummy === 2 || bossHidden(e)) continue;
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
    if (e.dead || e.state === 'spawn' || e.dummy === 2 || bossHidden(e)) continue;
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

/**
 * Does a tapped skill turn at the nearest enemy (with "Skills aim at the nearest enemy when tapped" on)?
 * Shots, swings, channels and ground spells do; blinks and dashes keep the stick's direction unless the kit
 * marks them as gap-closers (autoAim: 'target'); spells cast on the hero (novas, buffs, summons, forms) never aim.
 */
export function tapAutoAims(spec: SkillSpec): boolean {
  if (spec.aim === 'self') return false;
  if (spec.autoAim) return spec.autoAim === 'target';
  return spec.cast !== 'blink' && spec.cast !== 'dash' && spec.cast !== 'nova' && spec.cast !== 'buff' && spec.cast !== 'summon' && spec.cast !== 'form';
}

/** How far a skill looks for its target (a swing's reach, a dash's run, a spell's range). */
export function aimReach(spec: SkillSpec): number {
  return spec.cast === 'melee' ? spec.area + 30 : spec.cast === 'dash' ? spec.range + 20 : spec.range;
}

/**
 * How far a tapped spell looks for someone to aim at: half as far again as it reaches (the owner: "auto aim for
 * spells should increase its range by about 50%"), so that a spell turns to a foe coming in, not only one already
 * on top of the hero. The spell itself goes no further than it did; a swing, a dash and the basic attack look as
 * far as they reach, and a spell that must have a target (a chain, a mark, a drain) takes only one it can touch.
 */
export const AUTO_AIM_REACH = 1.5;
export function seekReach(spec: SkillSpec): number {
  const reach = aimReach(spec);
  const touches = spec.cast === 'melee' || spec.cast === 'dash' || spec.cast === 'chain' || spec.cast === 'mark' || spec.cast === 'drain';
  return touches ? reach : reach * AUTO_AIM_REACH;
}

export interface Aim {
  angle: number;
  tx: number;
  ty: number;
  target: Enemy | null;
}

/** Where a cast goes: its angle, its point and its target (exported for tests). */
export function resolveAim(w: World, spec: SkillSpec, req: CastRequest): Aim | null {
  const p = w.player;
  const reach = aimReach(spec);
  const targeted = spec.cast === 'chain' || spec.cast === 'mark' || spec.cast === 'drain';
  // a spell that needs a target (a chain, a mark, a drain), aimed by the mouse or a drag, takes the enemy nearest
  // the aimed line; with none in reach it is not cast at all (no mana or cooldown spent on nothing)
  if (req.angle !== null && targeted) {
    const target = autoTarget(w, reach, req.angle);
    if (!target) return null;
    const angle = Math.atan2(target.y - p.y, target.x - p.x);
    const d = Math.min(spec.range, dist(p.x, p.y, target.x, target.y));
    return { angle, tx: p.x + Math.cos(angle) * d, ty: p.y + Math.sin(angle) * d, target };
  }
  if (req.angle !== null) {
    const angle = spec.aim === 'self' ? req.angle : assistAim(w, req.angle, reach, req.assist);
    const d = spec.aim === 'ground' ? (req.dist ?? 0.7) * spec.range : spec.range;
    return { angle, tx: p.x + Math.cos(angle) * d, ty: p.y + Math.sin(angle) * d, target: null };
  }
  // a tap: the basic attack finds the nearest enemy (if the setting is on), and so do skills and the ultimate
  // (with their own setting; see tapAutoAims), using the same picker; spells that need a target (chains, marks,
  // drains) always do; the rest go where the hero faces, shown by the facing marker. A ground spell lands on
  // the target (up to its range).
  const auto = req.slot === 'basic' ? w.settings.autoTarget : w.settings.autoAimSkills !== false && tapAutoAims(spec);
  const target = targeted || auto ? autoTarget(w, req.slot === 'basic' ? reach : seekReach(spec), p.aim) : null;
  if (target) {
    const angle = Math.atan2(target.y - p.y, target.x - p.x);
    const d = Math.min(spec.range, dist(p.x, p.y, target.x, target.y));
    return { angle, tx: p.x + Math.cos(angle) * d, ty: p.y + Math.sin(angle) * d, target };
  }
  if (spec.cast === 'mark' || spec.cast === 'drain') return null;
  if (spec.cast === 'chain') return null;
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
  const plain = w.build.skills[id]?.spec;
  if (!plain) return false;
  // a combo waiting on this skill makes this cast more than it is (data/types.ts Empower)
  const emp = empowerOf(w, id);
  const spec = emp ? empowered(plain, emp) : plain;
  const cd = p.cds[req.slot];
  if (req.slot === 'ult') {
    if (p.ult < 100) return false;
  } else if (cd.charges <= 0) return false;
  // a cast on its way: the basic attack waits for it, the same skill again does nothing (another skill
  // or a dodge stops it below, once that one is sure to go)
  if (p.casting && (req.slot === 'basic' || req.slot === p.casting.slot)) return false;
  // busy: a wind-up finishes first; a dodge may cut a channel short; dashes can't be stacked
  if (p.windup) return false;
  if (p.dash && !p.dash.dodge) return false;
  if (p.dash?.dodge && req.slot === 'dodge') return false;
  if (p.channel && req.slot !== 'dodge') return false;
  // the resource: mana costs a share of the maximum, the others their points
  const cost = skillCost(w, spec, req.slot);
  if (cost > p.mana + 1e-6) {
    if (w.time - w.noManaAt > 1) {
      w.noManaAt = w.time;
      const res = w.build.resource!;
      w.text(p.x, p.y - 20, `Not enough ${res.name.toLowerCase()}`, res.color, false);
      w.sfx('nomana', 0.5);
    }
    return false;
  }
  const aim = req.slot === 'dodge' ? dodgeAim(w, req) : resolveAim(w, spec, req);
  if (!aim) {
    w.text(p.x, p.y - 20, 'No target', '#c9c3e6', false);
    return false;
  }
  if (p.casting) stopCasting(w);
  p.aim = aim.angle;
  if (emp) spendEmpower(w, id);
  // a spell with a cast time: the cast starts, and nothing is paid until it goes off (updateCasting)
  const time = castTimeOf(spec);
  if (time > 0) {
    p.casting = { slot: req.slot, spec, t: 0, total: time, angle: aim.angle, tx: aim.tx, ty: aim.ty, target: aim.target?.id ?? -1 };
    p.actAngle = aim.angle;
    w.sfx('windup', 0.7);
    return true;
  }
  pay(w, spec, req.slot, cost);
  if (req.slot === 'dodge') p.channel = null;
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

/** A skill as a combo makes it: stronger a stack at a time, free, and with no cast time once the combo is whole. */
function empowered(spec: SkillSpec, e: { def: BuffDef; n: number }): SkillSpec {
  const m = e.def.empower!;
  const stacks = e.def.max ? e.n : 1;
  const whole = empowerFull(e);
  return { ...spec, damage: spec.damage * (1 + ((m.pct ?? 0) * stacks) / 100), cost: m.free ? 0 : spec.cost, ...(m.instant && whole ? { castTime: 0 } : {}) };
}

/** What a skill costs right now, in the resource's own units (0 for the ultimate and for shapes' skills). */
export function skillCost(w: World, spec: SkillSpec, slot: SlotKey): number {
  const p = w.player;
  if (slot === 'ult' || spec.cost <= 0 || p.maxMana <= 0) return 0;
  // (a combo that makes it free: the bar shows it as affordable too)
  if (empowerOf(w, spec.id)?.def.empower?.free) return 0;
  const kind = w.build.resource?.kind;
  if (kind === 'mana') return (spec.cost * p.maxMana) / 100;
  // Zeal comes in whole points
  return kind === 'holy' ? Math.max(0, Math.round(spec.cost)) : spec.cost;
}

function dodgeAim(w: World, req: CastRequest): Aim {
  const p = w.player;
  // dodge goes where you are moving; standing still, where you aim
  const moving = Math.hypot(w.input.mx, w.input.my) > 0.2;
  const angle = moving ? Math.atan2(w.input.my, w.input.mx) : (req.angle ?? p.aim);
  return { angle, tx: p.x, ty: p.y, target: null };
}

/** Spends a skill's cost and starts its cooldown (or empties the ultimate). */
function pay(w: World, spec: SkillSpec, slot: SlotKey, cost: number): void {
  const p = w.player;
  p.mana -= cost;
  if (slot === 'ult') {
    p.ult = 0;
    runProcs(w, 'ult', { x: p.x, y: p.y, base: 0, type: spec.dmgType, depth: 1, hitDmg: 0 });
  } else {
    const cd = p.cds[slot];
    if (cd.charges >= cd.max) cd.t = cd.cd;
    cd.charges -= 1;
  }
}

/**
 * How long a skill takes to cast (0: it goes at once). Haste doesn't shorten it: gear brings haste near 100% by
 * the late levels, and a cast bar of half a second is no cast bar.
 */
export function castTimeOf(spec: SkillSpec): number {
  return Math.max(0, spec.castTime ?? 0);
}

/** What stops a cast besides moving and other skills: being stunned, frozen or terrified. */
const BREAKS_CAST = new Set<string>(['stun', 'freeze', 'fear']);

/** Stops a cast with nothing spent (no cost, no cooldown, the ultimate still charged). */
export function stopCasting(w: World): void {
  if (!w.player.casting) return;
  w.player.casting = null;
  w.castEnd = { at: w.time, fired: false };
}

/**
 * Casting doesn't stop the hero, as in the Ring (arena/sim.ts CAST_SLOW): they walk on while it gathers, slowed to this,
 * or at full pace with a skill that is `extra.swift` (a talent's doing). It stopped a cast before (the owner, 2026-11-19:
 * "make the spells and specs very similar to the ring's - combos, ults, casting while moving ... i want dynamic, fast
 * paced combat").
 */
export const CAST_SLOW = 0.55;

/** How fast the hero walks while this cast gathers (1 when nothing is being cast). */
export const castPace = (c: { spec: SkillSpec } | null): number => (!c ? 1 : c.spec.extra.swift ? 1 : CAST_SLOW);

/**
 * A cast on its way: it turns with the enemy it was aimed at, and goes off when full. `stop` (indoors, a scene), a stun
 * or death stops it; walking and being hurt do not.
 */
export function updateCasting(w: World, dt: number, stop: boolean): void {
  const p = w.player;
  const c = p.casting;
  if (!c) return;
  if (p.dead || stop || p.statuses.some((s) => BREAKS_CAST.has(s.id))) {
    stopCasting(w);
    return;
  }
  let target = c.target >= 0 ? (w.enemyById(c.target) ?? null) : null;
  if (target?.dead) target = null;
  if (target) {
    c.angle = Math.atan2(target.y - p.y, target.x - p.x);
    const d = Math.min(c.spec.range, dist(p.x, p.y, target.x, target.y));
    c.tx = p.x + Math.cos(c.angle) * d;
    c.ty = p.y + Math.sin(c.angle) * d;
  }
  p.aim = c.angle;
  p.actAngle = c.angle;
  c.t += dt;
  if (c.t < c.total) return;
  p.casting = null;
  const end = { at: w.time, fired: false };
  w.castEnd = end;
  const spec = c.spec;
  // what it costs is checked again (nothing was paid at the start)
  if (c.slot === 'ult' ? p.ult < 100 : p.cds[c.slot].charges <= 0) return;
  const cost = skillCost(w, spec, c.slot);
  if (cost > p.mana + 1e-6) {
    const res = w.build.resource!;
    w.text(p.x, p.y - 20, `Not enough ${res.name.toLowerCase()}`, res.color, false);
    w.sfx('nomana', 0.5);
    return;
  }
  // a spell that needs a target whose target fell takes the nearest other in reach, or isn't cast at all
  if (!target && c.target >= 0 && (spec.cast === 'mark' || spec.cast === 'chain' || spec.cast === 'drain')) {
    target = autoTarget(w, aimReach(spec), c.angle);
    if (!target) {
      w.text(p.x, p.y - 20, 'No target', '#c9c3e6', false);
      return;
    }
    c.angle = Math.atan2(target.y - p.y, target.x - p.x);
  }
  pay(w, spec, c.slot, cost);
  execute(w, c.slot, spec, c.angle, c.tx, c.ty, target);
  end.fired = true;
  // the release: the gathered spell thrown (a channel or a dash keeps its own move)
  if (!p.channel && !p.dash) {
    p.actKind = 'cast';
    p.actT = Math.max(p.actT, 0.35);
    p.actAngle = c.angle;
  }
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

/** Seconds a cast that builds points has to land (a slow bolt, a trap) before what it would build is lost. */
export const BUILD_LANDS = 2.5;

/**
 * A skill that spends the specialization's points (SkillSpec.spend) takes all of them: each makes it `per` stronger,
 * said over the hero. With none it goes off as it is.
 */
function spendPoints(w: World, spec: SkillSpec): SkillSpec {
  const p = w.player;
  if (!spec.spend || p.points <= 0) return spec;
  const n = p.points;
  p.points = 0;
  p.pointsAt = w.time;
  const def = w.build.points;
  if (def) w.text(p.x, p.y - 34, `${n} ${(n === 1 ? def.one : def.name).toUpperCase()}`, def.color, n >= def.max);
  return { ...spec, damage: spec.damage * (1 + spec.spend.per * n) };
}

/** A mage's every-fourth bolt: how much harder, through how many more, how much bigger. */
const LANCE = { damage: 1.6, pierce: 4, size: 1.7 };

/** The skill happens. */
export function execute(w: World, slot: SlotKey, plain: SkillSpec, angle: number, tx: number, ty: number, target: Enemy | null): void {
  const p = w.player;
  p.aim = angle;
  const spec = spendPoints(w, plain);
  // a skill that builds points builds them as it lands (sim/combat.ts hitEnemy); one that strikes nothing, as it is cast
  if (spec.build) {
    if (spec.damage > 0) p.pendingBuild = { skill: spec.id, n: spec.build, until: w.time + BUILD_LANDS };
    else gainPoints(w, spec.build);
  }
  // which skill this is, for whoever draws the body making it (render3d/moves.ts); the move the last one left is
  // over, and a skill with no move of its own (a dodge, a change of shape) leaves none
  p.actN++;
  p.actSkill = spec.id;
  p.actKind = null;
  p.actT = 0;
  p.actBig = false;
  const ctx = { x: p.x, y: p.y, angle, spec, base: spec.damage, type: spec.dmgType, depth: 0, hitDmg: 0, when: 'cast' as const };
  applyEffects(w, spec.onCast, ctx);
  // a spell's glow at the caster's feet (the ultimate charges a bigger one)
  if (slot === 'ult') w.vfx(`charge:${spec.dmgType}`, p.x, p.y + 6, 0, 1);
  else if (slot !== 'basic' && slot !== 'dodge' && spec.cast !== 'melee') w.vfx(`cast:${spec.dmgType}`, p.x, p.y + 6, 0, 0.7);
  // the resource some skills give (a melee swing only when it connects: see melee)
  if (spec.gen > 0 && spec.cast !== 'melee') gainResource(w, spec.gen);
  switch (spec.cast) {
    case 'projectile': {
      // every so many casts in a row, a lance: bigger, harder, and through everything (the mage's Arcane Bolt)
      let fan = false;
      if (spec.extra.lanceEvery && slot === 'basic') {
        p.combo = p.comboT > 0 ? p.combo + 1 : 1;
        p.comboT = 1.2;
        if (p.combo >= spec.extra.lanceEvery) {
          p.combo = 0;
          fan = true;
        }
      }
      fireProjectiles(w, fan ? { ...spec, damage: spec.damage * (LANCE.damage + (spec.extra.lanceMul ?? 0)), pierce: spec.pierce + LANCE.pierce, radius: spec.radius * LANCE.size, speed: spec.speed * 1.2 } : spec, angle);
      if (spec.extra.echo) for (let i = 1; i <= spec.extra.echo; i++) w.after(0.28 * i, () => !w.player.dead && fireProjectiles(w, spec, w.player.aim));
      p.actKind = spec.tags.includes('melee') ? 'heavy' : slot === 'basic' ? 'shoot' : 'cast';
      p.actT = 0.22;
      p.actAngle = angle;
      w.sfx(spec.look === 'quake' ? 'quake' : (CAST_SOUND[spec.dmgType] ?? (spec.look === 'lightning' ? 'zap' : w.hero.cls === 'ranger' ? 'bow' : 'bolt')));
      if (spec.look === 'quake') w.shake(3);
      p.actBig = fan;
      break;
    }
    case 'melee':
      melee(w, spec, angle);
      break;
    case 'nova': {
      p.actKind = 'cast';
      p.actT = 0.25;
      const [ring, shard] = NOVA_TINT[spec.look ?? ''] ?? NOVA_TINT[spec.dmgType] ?? NOVA_TINT.frost!;
      w.addFx({ kind: 'ring', x: p.x, y: p.y, life: 0.4, size: spec.area, color: ring });
      // (a halo, an eclipse, a stamp that cracks the ground...: NOVAS; the rest a burst of their element)
      const nova = ownLook(NOVAS, spec);
      if (nova) w.vfx(nova.vfx, p.x, p.y, spec.area, nova.life, angle);
      else w.vfx(`blast:${spec.dmgType}`, p.x, p.y, spec.area);
      for (let i = 0; i < 14; i++) {
        const a = (TAU * i) / 14;
        w.addFx({ kind: 'shard', x: p.x + Math.cos(a) * 6, y: p.y + Math.sin(a) * 6, vx: Math.cos(a) * spec.area * 2.2, vy: Math.sin(a) * spec.area * 2.2, life: 0.35, size: 2, color: shard });
      }
      w.sfx(spec.dmgType === 'holy' || spec.dmgType === 'shadow' ? spec.dmgType : 'nova');
      hitAll(w, spec, enemiesIn(w, p.x, p.y, spec.area), p.x, p.y);
      w.breakWalls(p.x, p.y, spec.area);
      break;
    }
    case 'chain':
      chain(w, spec, angle, target);
      break;
    case 'blink': {
      // a gate that pulls the hero back to where they stood a few seconds later (Gate Step)
      if (spec.extra.recall) {
        const home = { x: p.x, y: p.y };
        w.addFx({ kind: 'rift', x: home.x, y: home.y, life: spec.extra.recall, size: 8, color: '#a87aff' });
        w.after(spec.extra.recall, () => {
          const q = w.player;
          if (q.dead) return;
          w.addFx({ kind: 'burst', x: q.x, y: q.y, life: 0.3, size: 10, color: '#a87aff' });
          q.x = home.x;
          q.y = home.y;
          q.iframe = Math.max(q.iframe, 0.25);
          w.addFx({ kind: 'burst', x: q.x, y: q.y, life: 0.3, size: 12, color: '#a87aff' });
          w.sfx('blink');
        });
      }
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
        // (a blink is over in an instant: it is safe a little longer than it lasts; a guard holds while it stands)
        p.iframe = Math.max(p.iframe, t + 0.08, spec.extra.safe ?? 0);
        if (spec.extra.guard) {
          p.guard = t + 0.08;
          p.guardPow = spec.extra.guard;
        }
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
    case 'buff':
    case 'summon':
      // the cast effects (shields, buffs, companions) are the whole skill
      p.actKind = 'cast';
      p.actT = 0.25;
      p.actAngle = angle;
      w.addFx({ kind: 'ring', x: p.x, y: p.y, life: 0.35, size: 14, color: buffColor(spec) });
      w.vfx(`${spec.tags.includes('heal') ? 'heal' : spec.tags.includes('defense') ? 'shield' : 'buff'}:${spec.dmgType}`, p.x, p.y + 6, 0, 1);
      if (spec.cast === 'buff') w.sfx('buff');
      break;
    case 'form': {
      const form = w.build.form?.skill === spec.id ? null : (CLASSES[w.hero.cls].forms?.find((f) => f.skill === spec.id)?.id ?? null);
      w.setForm(form);
      break;
    }
    case 'drain': {
      const e = target ?? autoTarget(w, spec.range, angle);
      if (!e) break;
      p.channel = { spec, t: spec.duration, tickT: 0, target: e.id };
      p.actKind = 'cast';
      p.actT = spec.duration;
      p.actAngle = Math.atan2(e.y - p.y, e.x - p.x);
      w.sfx('drain');
      break;
    }
    case 'mark':
      // aimed by hand: the enemy nearest the aimed line
      target ??= autoTarget(w, spec.range, angle);
      if (target) {
        // (a priest's Smite comes down on them from above; anyone else's mark is a line drawn to them, in its element's
        // color, and the great ones land their own way: MARKS)
        if (spec.look === 'smite') {
          w.addFx({ kind: 'zap', x: target.x, y: target.y - 70, x2: target.x, y2: target.y, life: 0.22, size: 2.2, color: spec.dmgType === 'shadow' ? '#b07aff' : '#fff2b0' });
          w.addFx({ kind: 'glow', x: target.x, y: target.y - 3, life: 0.3, size: 13, color: spec.dmgType === 'shadow' ? '#b07aff' : '#ffe9a0' });
        } else w.addFx({ kind: 'zap', x: p.x, y: p.y, x2: target.x, y2: target.y, life: 0.2, size: 1, color: MARK_LINE[spec.dmgType] ?? '#ffe066' });
        const mark = ownLook(MARKS, spec);
        if (mark) w.vfx(mark.vfx, target.x, target.y, Math.max(12, target.r + 6), mark.life);
        else if (spec.dmgType !== 'physical' && spec.onHit.some((e) => e.kind === 'status')) w.vfx(`debuff:${spec.dmgType}`, target.x, target.y);
        const d = hitEnemy(w, target, spec.damage, spec.dmgType, { spec, depth: 0, fromX: p.x, fromY: p.y });
        applyEffects(w, spec.onHit, { ...ctx, x: target.x, y: target.y, target, hitDmg: d, when: 'hit' });
        w.sfx(spec.look === 'smite' ? 'bolt' : 'mark');
      }
      p.actKind = w.hero.cls === 'ranger' ? 'shoot' : 'cast';
      p.actT = 0.2;
      p.actAngle = target ? Math.atan2(target.y - p.y, target.x - p.x) : angle;
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
    const d = hitEnemy(w, e, spec.damage * mul, spec.dmgType, { spec, depth: 0, fromX: fx, fromY: fy, blade: spec.dmgType === 'physical' });
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
  // the blade's arc, white-hot, and behind it a wider trail in the hero's own color (a combo's last blow and a heavy one
  // leave a bright ring of it too). A blow with a look of its own (BLOWS) swings in its own colors, and what it leaves
  // where it lands is its own: the ground cracked, a wound torn, light crossed, dusk bursting out
  const tint = CLASSES[w.hero.cls].colors;
  const own = ownLook(BLOWS, spec);
  const trail = own?.trail ?? tint.accent;
  w.addFx({ kind: 'slash', x: p.x, y: p.y, a: angle, a2: arc * 1.12, life: heavy ? 0.3 : 0.22, size: reach + 10, color: trail, r2: 1 });
  w.addFx({ kind: 'slash', x: p.x, y: p.y, a: angle, a2: arc, life: heavy ? 0.24 : 0.16, size: reach + 4, color: own?.edge ?? (heavy ? '#ffe6b0' : big ? '#fff2c8' : '#ffffff'), r2: big || heavy ? 1 : 0 });
  if (own?.claws) {
    // three rows of claws: two more rakes just inside and outside the first
    w.addFx({ kind: 'slash', x: p.x, y: p.y, a: angle + 0.08, a2: arc * 0.92, life: 0.2, size: reach - 3, color: own.edge ?? trail, r2: 0 });
    w.addFx({ kind: 'slash', x: p.x, y: p.y, a: angle - 0.08, a2: arc * 0.92, life: 0.2, size: reach + 11, color: own.edge ?? trail, r2: 0 });
  }
  if (big || heavy) w.addFx({ kind: 'ring', x: p.x + Math.cos(angle) * reach * 0.6, y: p.y + Math.sin(angle) * reach * 0.6, life: 0.3, size: reach * 0.9, color: trail });
  // the strike lands in front: impact effects happen there
  const ix = p.x + Math.cos(angle) * reach * 0.8;
  const iy = p.y + Math.sin(angle) * reach * 0.8;
  if (own?.hit) w.vfx(own.hit, ix, iy, reach * (heavy ? 0.85 : 0.7), heavy ? 0.7 : 0.5, angle);
  w.sfx(heavy ? 'heavy' : big ? 'swingBig' : 'swing');
  hitAll(w, spec, list, p.x, p.y, mul);
  if (list.length && spec.gen > 0) gainResource(w, spec.gen);
  if (list.length && (heavy || big)) w.hitstop(heavy ? 0.06 : 0.035);
  if (heavy) w.shake(list.length ? 2.5 : 1);
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
  // (lightning cracks; a druid's lash of thorns and the like are their own color and make a bolt's sound, and a lash of
  // living thorns is drawn as one, not as lightning)
  const tint = spec.dmgType === 'nature' ? '#a8e86a' : spec.dmgType === 'shadow' ? '#b07aff' : spec.dmgType === 'holy' ? '#fff2b0' : spec.dmgType === 'fire' ? '#ffb070' : '#d8f2ff';
  const sprite = spec.dmgType === 'nature' ? 'thorn' : undefined;
  w.sfx(spec.dmgType === 'lightning' ? 'zap' : 'bolt');
  if (!target) {
    w.addFx({ kind: 'zap', x: p.x, y: p.y, x2: p.x + Math.cos(angle) * spec.range * 0.7, y2: p.y + Math.sin(angle) * spec.range * 0.7, life: 0.15, size: 1, color: tint, sprite });
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
    w.addFx({ kind: 'zap', x: from.x, y: from.y, x2: cur.x, y2: cur.y, life: 0.22, size: 1.4, color: tint, sprite });
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
    // a field: arrow rain, blizzard, consecration, rain of fire
    const look = fieldLook(spec);
    w.spawnField({ x: tx, y: ty, r: spec.area, dur: spec.duration, tick: spec.tick, dmg: spec.damage, type: spec.dmgType, look, hostile: false, depth: 0, spec, onHit: true, ...(spec.extra.pull ? { pull: spec.extra.pull } : {}), ...(spec.extra.heal ? { heal: spec.extra.heal } : {}) });
    w.sfx(look === 'arrows' ? 'volley' : 'fieldCast');
    return;
  }
  const strikes = spec.extra.strikes ?? 0;
  if (strikes > 0) {
    // Tempest: bolts strike around the point, out of a storm cloud gathered over it
    w.addFx({ kind: 'glow', x: tx, y: ty, life: 1.6, size: spec.area, color: '#5ad1ff' });
    w.vfx('stormcloud:lightning', tx, ty, spec.area, 0.75 + strikes * 0.18);
    for (let i = 0; i < strikes; i++) {
      w.after(0.25 + i * 0.18, () => {
        const a = w.rand() * TAU;
        const r = Math.sqrt(w.rand()) * spec.area * 0.85;
        const x = tx + Math.cos(a) * r;
        const y = ty + Math.sin(a) * r;
        w.addFx({ kind: 'beam', x, y, life: 0.25, size: 3, color: '#d8f2ff' });
        w.vfx('thunder:lightning', x, y, 18, 0.5);
        w.fxBurst(x, y, '#bfe9ff', 6, 18);
        w.sfx('thunder');
        w.shake(1.2);
        hitAll(w, spec, enemiesIn(w, x, y, 20), x, y, 0.45);
      });
    }
    return;
  }
  // a meteor (and its extra meteors); or whatever else comes down on a spot, each its own way (GROUND_LOOKS): the
  // rules are the same for every one, a circle on the ground and the blow when it fills
  const look = groundLook(spec);
  const impacts: { x: number; y: number; delay: number; mul: number }[] = [{ x: tx, y: ty, delay: spec.windup, mul: 1 }];
  for (let i = 0; i < (spec.extra.meteors ?? 0); i++) {
    const a = angle + Math.PI / 2 + (i * TAU) / Math.max(2, spec.extra.meteors ?? 0);
    impacts.push({ x: tx + Math.cos(a) * spec.area * 0.9, y: ty + Math.sin(a) * spec.area * 0.9, delay: spec.windup + 0.25 * (i + 1), mul: 0.6 });
  }
  for (const im of impacts) {
    if (blocksAt(w.map, im.x, im.y)) continue;
    w.addTelegraph({ shape: 'circle', x: im.x, y: im.y, r: spec.area * (im.mul < 1 ? 0.8 : 1), r2: 0, angle: 0, len: 0, dur: im.delay, dmg: 0, knock: 0, tone: 'player', owner: -1, linger: 0 });
    w.vfx(`${look.fall}:${look.tone}`, im.x, im.y, spec.area * (im.mul < 1 ? 0.8 : 1), Math.max(0.05, im.delay));
    w.after(im.delay, () => {
      const r = spec.area * (im.mul < 1 ? 0.8 : 1);
      w.fxBurst(im.x, im.y, look.spark, 22, r);
      w.vfx(`${look.land}:${look.tone}`, im.x, im.y, r, look.life);
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

const FIELD_LOOKS = new Set<string>(['fire', 'poison', 'frost', 'arrows', 'lightning', 'rift', 'shadow', 'holy', 'nature']);

/**
 * What comes down on a spot (render/effects.ts draws each by name): `fall` plays through the wind-up, `land` for `life`
 * seconds from the blow, in the colors named by `tone`; `spark` is the color of what flies off it. `type`: the damage
 * type it was made for (a talent that turns the skill to another element takes it back to that element's plain look).
 */
interface GroundLook {
  fall: string;
  land: string;
  tone: string;
  spark: string;
  life: number;
  type?: SkillSpec['dmgType'];
}
const GROUND_LOOKS: Record<string, GroundLook> = {
  // a column of fire standing up out of the ground, the ground cracking and glowing under it first
  flamestrike: { fall: 'pyre', land: 'pillar', tone: 'fire', spark: '#ff9a4d', life: 1.15, type: 'fire' },
  // a burning rock out of the sky, and a crater
  meteor: { fall: 'meteorfall', land: 'crater', tone: 'fire', spark: '#ff9a4d', life: 1.3, type: 'fire' },
  // Absolute Zero's comet of ice
  comet: { fall: 'cometfall', land: 'rimecrater', tone: 'frost', spark: '#bfeaff', life: 1.1 },
  // the Brimstone Golem crashing down on a burning sigil
  'summon-infernal': { fall: 'golemfall', land: 'golemland', tone: 'brimstone', spark: '#ff7a3a', life: 1.3, type: 'fire' },
};

/** What a ground skill without a field looks like coming down: its own look, or one from its damage type. */
function groundLook(spec: SkillSpec): GroundLook {
  const own = ownLook(GROUND_LOOKS, spec);
  if (own) return own;
  if (spec.dmgType === 'fire') return GROUND_LOOKS.meteor!;
  return { fall: 'pyre', land: 'skyfall', tone: spec.dmgType, spark: '#ffffff', life: 0.8 };
}

/**
 * A skill's own look from a table keyed by its id or by its look. One made for a damage type holds only while the skill
 * is still of that type: a talent that turns it to another element (Dark Halo, Absolute Zero...) gives it that
 * element's look, or takes it back to the plain look of the element.
 */
function ownLook<T extends { type?: SkillSpec['dmgType'] }>(table: Record<string, T>, spec: SkillSpec): T | undefined {
  const fits = (o: T | undefined): o is T => !!o && (!o.type || o.type === spec.dmgType);
  const byId = table[spec.id];
  if (fits(byId)) return byId;
  const byLook = spec.look ? table[spec.look] : undefined;
  return fits(byLook) ? byLook : undefined;
}

/**
 * A blow's own look: the colors of its trail and of its blade's edge, three rows of claws, and what it leaves where it
 * lands (a spell effect, render/effects.ts). The rest swing in the hero's own colors.
 */
interface BlowLook {
  trail: string;
  edge?: string;
  claws?: boolean;
  hit?: string;
  type?: SkillSpec['dmgType'];
}
const BLOWS: Record<string, BlowLook> = {
  // the warrior: red-hot steel that cracks the ground; a wound torn open
  'heavy-strike': { trail: '#e0502e', edge: '#fff0d8', hit: 'crush:steel', type: 'physical' },
  'last-word': { trail: '#e0502e', edge: '#fff0d8', hit: 'crush:steel', type: 'physical' },
  'mortal-strike': { trail: '#c8202a', edge: '#ffd8c8', hit: 'rend:blood', type: 'physical' },
  bloodthirst: { trail: '#c8202a', hit: 'rend:blood', type: 'physical' },
  // the paladin: blades of light crossed, a shield of it driven in
  'templars-verdict': { trail: '#ffb630', edge: '#fff6d0', hit: 'verdict:dawn', type: 'holy' },
  sentence: { trail: '#ffb630', edge: '#fff6d0', hit: 'verdict:dawn', type: 'holy' },
  'shield-of-the-righteous': { trail: '#ffb630', edge: '#fff6d0', hit: 'bastion:dawn', type: 'holy' },
  // the gloam knight: dusk bursting out of the wound; the ground sundered
  'umbral-rend': { trail: '#7a4ad8', edge: '#d8c0ff', hit: 'umbral:gloam', type: 'shadow' },
  'sundering-dark': { trail: '#7a4ad8', edge: '#d8c0ff', hit: 'sunder:gloam', type: 'shadow' },
  // the druid's shapes: a lynx's jaws and claws, a bear's paw
  'ferocious-bite': { trail: '#ff8a2a', edge: '#ffe0a0', hit: 'bite:cat', type: 'physical' },
  rip: { trail: '#c8202a', edge: '#ffd0b0', claws: true, hit: 'rend:blood', type: 'physical' },
  rake: { trail: '#ff8a2a', edge: '#ffe0a0', claws: true, type: 'physical' },
  claw: { trail: '#ff8a2a', edge: '#ffe0a0', claws: true, type: 'physical' },
  maul: { trail: '#a8743a', edge: '#f0d8a8', hit: 'crush:bear', type: 'physical' },
};

/**
 * A nova's own look (render/effects.ts spells by name, and how long each plays); the rest burst in their damage type's
 * colors.
 */
const NOVAS: Record<string, { vfx: string; life: number; type?: SkillSpec['dmgType'] }> = {
  halo: { vfx: 'halo:holy', life: 0.85, type: 'holy' },
  // the gloam knight's ultimate: an eclipse, and the dark coming up out of the ground under it
  duskfall: { vfx: 'nightfall:gloam', life: 1.1, type: 'shadow' },
  darkhalo: { vfx: 'eclipse:gloam', life: 0.95 },
  thunder: { vfx: 'thunderstomp:lightning', life: 0.6 },
  quake: { vfx: 'stomp:earth', life: 0.6 },
  'avenging-wrath': { vfx: 'dawn:dawn', life: 1.1, type: 'holy' },
  'divine-storm': { vfx: 'sweep:dawn', life: 0.45, type: 'holy' },
  'frost-nova': { vfx: 'shatter:frost', life: 0.6, type: 'frost' },
  'dread-toll': { vfx: 'toll:gloam', life: 0.9, type: 'shadow' },
  thrash: { vfx: 'sweep:bear', life: 0.4, type: 'physical' },
};

/** A mark's own look where it lands (the rest: a line of their damage type's color drawn to them). */
const MARKS: Record<string, { vfx: string; life: number; type?: SkillSpec['dmgType'] }> = {
  smite: { vfx: 'smite:holy', life: 0.4, type: 'holy' },
  'mind-blast': { vfx: 'psyblast:psy', life: 0.5, type: 'shadow' },
  moonfire: { vfx: 'moonbeam:moon', life: 0.6, type: 'arcane' },
  harvest: { vfx: 'reap:gloam', life: 0.45, type: 'shadow' },
};

/** A projectile's own burst where it stops (render/effects.ts spells by name); `through`: on each foe it goes through too. */
const BURSTS: Record<string, { vfx: string; size: number; type?: SkillSpec['dmgType']; through?: boolean }> = {
  fireball: { vfx: 'fireburst:fire', size: 20, type: 'fire' },
  chaosbolt: { vfx: 'ruin:ruin', size: 24, type: 'fire', through: true },
  holyfire: { vfx: 'hymn:holy', size: 16, type: 'holy' },
  starsurge: { vfx: 'starburst:lunar', size: 20, type: 'arcane' },
  starfire: { vfx: 'solar:solar', size: 20, type: 'arcane' },
};

/** The color of the line drawn to a marked enemy, by damage type. */
const MARK_LINE: Partial<Record<SkillSpec['dmgType'], string>> = { holy: '#fff2b0', shadow: '#b07aff', arcane: '#d2a8ff', nature: '#a8e86a', fire: '#ffb070', frost: '#bdf1ff', poison: '#9be36b', lightning: '#d8f2ff' };

/** A nova's ring and shards, by its look or damage type. */
const NOVA_TINT: Record<string, [string, string]> = {
  frost: ['#9be7ff', '#d8f6ff'],
  fire: ['#ffb070', '#ffe07a'],
  lightning: ['#bfe9ff', '#ffffff'],
  arcane: ['#d2a8ff', '#f0e0ff'],
  poison: ['#8be36b', '#d8ffc8'],
  physical: ['#ffffff', '#e8e0d0'],
  holy: ['#fff2a0', '#ffe066'],
  shadow: ['#b58aff', '#7a4ad0'],
  nature: ['#9cf07a', '#d8ffc8'],
  halo: ['#fff6c8', '#ffd84d'],
  darkhalo: ['#c9a8ff', '#6a3ab0'],
};

/** The sound of a cast bolt, by damage type (others: zap, bow or bolt). */
const CAST_SOUND: Partial<Record<SkillSpec['dmgType'], string>> = { fire: 'fireball', holy: 'holy', shadow: 'shadow', nature: 'nature' };

/** What a skill's field looks like: its own look, or one from its damage type. */
function fieldLook(spec: SkillSpec): GroundSpec['look'] {
  if (spec.look && FIELD_LOOKS.has(spec.look)) return spec.look as GroundSpec['look'];
  switch (spec.dmgType) {
    case 'physical':
      return 'arrows';
    case 'arcane':
      return 'rift';
    default:
      return spec.dmgType as GroundSpec['look'];
  }
}

/** The color of a self-cast's flash (shields blue, shouts red, holy gold, demons green). */
function buffColor(spec: SkillSpec): string {
  for (const e of spec.onCast) if (e.kind === 'buff') return e.buff.color;
  if (spec.onCast.some((e) => e.kind === 'shield')) return '#7fd8ff';
  if (spec.onCast.some((e) => e.kind === 'summon')) return '#8bff6a';
  if (spec.onCast.some((e) => e.kind === 'heal')) return '#6dff8f';
  return '#ffffff';
}

/** A drain: the bound enemy takes a hit every tick and the caster heals a share of it. */
function updateDrain(w: World, dt: number): void {
  const p = w.player;
  const ch = p.channel!;
  const e = w.enemies.find((x) => x.id === ch.target);
  // it breaks when the enemy dies, gets away or out of sight
  if (!e || e.dead || dist(e.x, e.y, p.x, p.y) > ch.spec.range + e.r + 20 || !lineOfSight(w.map, p.x, p.y, e.x, e.y)) {
    p.channel = null;
    p.actKind = null;
    return;
  }
  p.aim = Math.atan2(e.y - p.y, e.x - p.x);
  p.actAngle = p.aim;
  ch.t -= dt;
  ch.tickT -= dt;
  if (ch.tickT <= 0) {
    ch.tickT += ch.spec.tick;
    const d = hitEnemy(w, e, ch.spec.damage, ch.spec.dmgType, { spec: ch.spec, depth: 0, fromX: p.x, fromY: p.y });
    applyEffects(w, ch.spec.onHit, { x: e.x, y: e.y, angle: p.aim, spec: ch.spec, base: ch.spec.damage, type: ch.spec.dmgType, depth: 0, target: e, hitDmg: d, when: 'hit' });
    const share = (ch.spec.extra.drainHeal ?? 0) / 100;
    if (share > 0 && d > 0) healPlayer(w, ((d * share) / p.maxHp) * 100, false);
    w.addFx({ kind: 'zap', x: e.x, y: e.y - 3, x2: p.x, y2: p.y - 6, life: ch.spec.tick, size: 1.6, color: ch.spec.dmgType === 'holy' ? '#ffe9a0' : '#b58aff' });
  }
  if (ch.t <= 0) {
    p.channel = null;
    p.actKind = null;
  }
}

/** Whirlwind: hits all around every tick; may pull enemies in. Drains hit their one enemy. */
export function updateChannel(w: World, dt: number): void {
  const p = w.player;
  const ch = p.channel;
  if (!ch) return;
  if (ch.target !== undefined) {
    updateDrain(w, dt);
    return;
  }
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
  if (d.dodge && w.rand() < 0.6) w.addFx({ kind: 'ghost', x: p.x, y: p.y, life: 0.2, size: 1, color: '#ffffff', sprite: 'hero' });
  // a dash with damage hits what it runs through (a pounce or a bear's charge too, though they are dodges)
  if (d.spec && d.spec.damage > 0) {
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
    if (d.spec && (!d.dodge || d.spec.damage > 0)) {
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
    // Ball Lightning: zaps the nearest enemy as it rolls
    if (!pr.hostile && pr.spec?.extra.zap && pr.depth === 0) {
      pr.zapT = (pr.zapT ?? 0) - dt;
      if (pr.zapT <= 0) {
        pr.zapT = pr.spec.extra.zap;
        const range = pr.spec.extra.zapRange ?? 50;
        let best: Enemy | null = null;
        let bd = range * range;
        for (const e of w.enemies) {
          if (e.dead || e.state === 'spawn') continue;
          const d2 = dist2(e.x, e.y, pr.x, pr.y);
          if (d2 < bd) {
            bd = d2;
            best = e;
          }
        }
        if (best) {
          w.addFx({ kind: 'zap', x: pr.x, y: pr.y, x2: best.x, y2: best.y, life: 0.15, size: 1, color: '#d8f2ff' });
          hitEnemy(w, best, pr.dmg * (pr.spec.extra.zapMul ?? 0.4), pr.type, { depth: 1, fromX: pr.x, fromY: pr.y, knock: 5 });
        }
      }
    }
    const step = Math.hypot(pr.vx, pr.vy) * dt;
    const sub = Math.max(1, Math.ceil(step / 4));
    for (let s = 0; s < sub && !pr.dead; s++) {
      pr.x += (pr.vx * dt) / sub;
      pr.y += (pr.vy * dt) / sub;
      pr.life -= step / sub;
      if (blocksAt(w.map, pr.x, pr.y) && !(pr.wide && pr.age < 0.05)) {
        // a boss's shot with bounces left glances off the wall (sim/patterns/spells.ts bouncers)
        if (pr.hostile && pr.bounce > 0) {
          pr.x -= (pr.vx * dt) / sub;
          pr.y -= (pr.vy * dt) / sub;
          if (blocksAt(w.map, pr.x + (pr.vx * dt) / sub, pr.y)) pr.vx = -pr.vx;
          else pr.vy = -pr.vy;
          pr.bounce -= 1;
          w.addFx({ kind: 'spark', x: pr.x, y: pr.y, life: 0.2, size: 2, color: pr.color });
          continue;
        }
        if (!pr.hostile) {
          w.breakWalls(pr.x, pr.y, 6);
          impact(w, pr, null);
        } else w.addFx({ kind: 'spark', x: pr.x, y: pr.y, life: 0.2, size: 2, color: pr.color });
        pr.dead = true;
        break;
      }
      if (pr.hostile) {
        // companions stand in the way of shots
        const pet = w.pets.find((x) => !x.dead && dist2(pr.x, pr.y, x.x, x.y) < (pr.r + x.r) ** 2);
        if (pet) {
          hurtPet(w, pet, pr.dmg);
          w.addFx({ kind: 'burst', x: pr.x, y: pr.y, life: 0.2, size: 6, color: pr.color });
          pr.dead = true;
          continue;
        }
        // the host's shots strike the party's other heroes (their games take the hit)
        const g = w.coop?.role === 'host' ? w.coop.ghosts.find((x) => !x.dead && dist2(pr.x, pr.y, x.x, x.y) < (pr.r + x.r) ** 2) : undefined;
        if (g) {
          if (!g.untouchable) {
            w.ghostHit(g, pr.dmg, { fromX: pr.x - pr.vx * 0.05, fromY: pr.y - pr.vy * 0.05, knock: 40, ...(pr.status ? { status: pr.status } : {}) });
            pr.dead = true;
          }
          continue;
        }
        // a co-op guest's copy of the host's shot only flies
        if (pr.remote) continue;
        if (!p.dead && dist2(pr.x, pr.y, p.x, p.y) < (pr.r + p.r) ** 2) {
          if (p.iframe > 0) {
            if (!pr.hit.includes(-1)) {
              pr.hit.push(-1);
              w.dodgedSomething();
            }
          } else {
            hurtPlayer(w, pr.dmg, { fromX: pr.x - pr.vx * 0.05, fromY: pr.y - pr.vy * 0.05, knock: 40, ...(pr.status ? { status: pr.status } : {}) });
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
          // (a bolt that tears through them bursts on each one it goes through: Ruin Bolt)
          const burst = pr.spec && pr.depth === 0 ? ownLook(BURSTS, pr.spec) : undefined;
          if (burst?.through) w.vfx(burst.vfx, e.x, e.y, burst.size + pr.r * 1.5, 0.75, angle);
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
  w.vfx(`impact:${pr.type}`, x, y);
  w.addFx({ kind: 'burst', x, y, life: 0.2, size: pr.r + 3, color: pr.type === 'fire' ? '#ffb04d' : pr.type === 'frost' ? '#bdf1ff' : pr.type === 'lightning' ? '#cdeeff' : pr.type === 'poison' ? '#9be36b' : pr.type === 'arcane' ? '#d2a8ff' : '#ffffff' });
  // a big spell's own burst (a fireball going off, a star breaking...: BURSTS)
  const burst = pr.spec && pr.depth === 0 ? ownLook(BURSTS, pr.spec) : undefined;
  if (burst) w.vfx(burst.vfx, x, y, burst.size + pr.r * 1.5, 0.75, angle);
  if (pr.spec && pr.spec.onImpact.length) applyEffects(w, pr.spec.onImpact, { x, y, angle, spec: pr.spec, base: pr.dmg, type: pr.type, depth: pr.depth, target: e ?? undefined, hitDmg: 0, proj: pr, when: 'impact' });
}

/** How fast a well drags, in pixels a second for each point of its pull (Gravity Well's 55: 150 a second, twice a foe's walk). */
export const WELL_PACE = 2.75;

/** Fields: friendly ones hurt enemies, hostile ones hurt the hero. */
export function updateFields(w: World, dt: number): void {
  const p = w.player;
  for (const f of w.fields) {
    f.t -= dt;
    f.tickT -= dt;
    // A well that drags: whoever is in it is carried to its middle and held there for as long as it lasts, every
    // frame and faster than they can walk out. It used to give a small shove each tick, which a foe's own walking
    // more than undid: about twenty pixels a second inward against forty to seventy out, so nothing was seen to
    // move (the owner: "gravity well just dmgs enemies and doesnt pull them back to the center for 3 seconds as the
    // description says"). An elite is dragged at half the pace; a boss not at all.
    if (f.pull && !f.hostile && f.t > 0) {
      for (const e of enemiesIn(w, f.x, f.y, f.r + 8)) {
        if (e.boss || e.dead || e.dummy) continue;
        const d = Math.hypot(f.x - e.x, f.y - e.y);
        if (d < 2) continue;
        const step = Math.min(d, f.pull * WELL_PACE * (e.elite.length ? 0.5 : 1) * dt);
        const m = moveCircle(w.map, e.x, e.y, e.r, ((f.x - e.x) / d) * step, ((f.y - e.y) / d) * step);
        e.x = m.x;
        e.y = m.y;
      }
    }
    if (f.tickT <= 0) {
      f.tickT += f.tick;
      if (f.hostile) {
        if (w.coop?.role === 'host') for (const g of w.coop.ghosts) if (!g.dead && dist2(g.x, g.y, f.x, f.y) < (f.r + g.r * 0.5) ** 2) w.ghostHit(g, f.dmg, f.status ? { status: f.status } : {});
        if (!f.remote && !p.dead && dist2(p.x, p.y, f.x, f.y) < (f.r + p.r * 0.5) ** 2) hurtPlayer(w, f.dmg, { status: f.status });
      } else {
        // (a grove that mends; a well's drag is every frame, below)
        if (f.heal && !p.dead && dist2(p.x, p.y, f.x, f.y) < f.r * f.r) healPlayer(w, f.heal, false);
        // a field that only mends (a bloom) hurts nobody
        for (const e of f.dmg > 0 ? enemiesIn(w, f.x, f.y, f.r) : []) {
          const d = hitEnemy(w, e, f.dmg, f.type, { spec: f.depth === 0 ? f.spec : null, depth: f.depth, isDot: f.look !== 'arrows', fromX: f.x, fromY: f.y, knock: 0, charge: f.look === 'arrows' ? 0.6 : 0.25 });
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
