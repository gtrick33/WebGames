import { TAU, clamp, dist2 } from '../core/math';
import { CLASSES, levelPower } from '../data/classes';
import type { BuffDef, DmgType, Effect, ProcDef, SkillSpec, StatKey, Stats, StatusId } from '../data/types';
import { typeBonus } from '../progress/build';
import { bossHidden } from './boss';
import { summonPet } from './pets';
import type { Enemy, Projectile } from './types';
import type { World } from './world';

/**
 * Damage, healing, statuses, effects and procs. The rules that keep builds safe live here:
 * - only direct hits (depth 0) trigger on-hit and crit procs; kill procs may come from anything,
 *   but every proc has its own internal cooldown and secondary damage can't chain past depth 2;
 * - healing from hits is limited to 10% of max health per second;
 * - bosses can't be stunned, frozen or rooted (they are slowed instead).
 */

/** Damage over time and its type (a curse carries its own). */
const STATUS_DMG: Partial<Record<StatusId, DmgType>> = { burn: 'fire', poison: 'poison', bleed: 'physical', curse: 'shadow' };
const isDot = (id: StatusId): boolean => id in STATUS_DMG;

/** The hero's stats right now, with the conditional ones and buffs that apply. */
export function effStats(w: World): Stats {
  const b = w.build;
  const p = w.player;
  const lowHp = p.hp < p.maxHp * 0.5;
  const afterDodge = w.time - p.lastDodge < 3;
  const buffed = p.buffs.some((x) => x.def.stats);
  if (!lowHp && !afterDodge && !buffed) return b.stats;
  const s = { ...b.stats };
  if (lowHp) for (const [k, v] of Object.entries(b.lowHp)) s[k as StatKey] += v ?? 0;
  if (afterDodge) for (const [k, v] of Object.entries(b.afterDodge)) s[k as StatKey] += v ?? 0;
  for (const x of p.buffs) for (const [k, v] of Object.entries(x.def.stats ?? {})) s[k as StatKey] += v ?? 0;
  return s;
}

/** Gains (or spends, n < 0) the class's resource; mana counts in % of the maximum for effects. */
export function gainResource(w: World, n: number, mana: 'points' | 'pct' = 'points'): void {
  const p = w.player;
  if (p.maxMana <= 0 || !n) return;
  const add = w.build.resource?.kind === 'mana' && mana === 'pct' ? (p.maxMana * n) / 100 : n;
  p.mana = Math.max(0, Math.min(p.maxMana, p.mana + add));
}

export const hasStatus = (e: { statuses: { id: StatusId }[] }, id: StatusId): boolean => e.statuses.some((s) => s.id === id);
const statusPower = (e: Enemy, id: StatusId): number => e.statuses.reduce((m, s) => (s.id === id ? Math.max(m, s.power) : m), 0);

export interface HitOpts {
  spec?: SkillSpec | null;
  depth: number;
  isDot?: boolean;
  knock?: number;
  fromX?: number;
  fromY?: number;
  /** Shown hit counts for ultimate charge at this share (DoTs charge less). */
  charge?: number;
}

/** A hit from the hero on an enemy: returns the damage dealt (0 if it was absorbed or ignored). */
export function hitEnemy(w: World, e: Enemy, base: number, type: DmgType, o: HitOpts): number {
  if (e.dead || e.state === 'spawn' || base <= 0) return 0;
  if (e.boss && (e.boss.shift > 0 || e.boss.dying > 0 || bossHidden(e))) {
    w.text(e.x, e.y - e.r - 8, 'IMMUNE', '#c9c3e6', false);
    return 0;
  }
  const stats = effStats(w);
  let mult = levelPower(w.hero.level) * typeBonus(stats, type);
  const spec = o.spec;
  let bonus = 0;
  if (spec) {
    for (const b of spec.bonusVs) {
      if (b.status === 'lowHp' ? e.hp < e.maxHp * 0.3 : hasStatus(e, b.status)) bonus += b.pct;
    }
    if (spec.afterDodge && w.time - w.player.lastDodge <= spec.afterDodge.window) bonus += spec.afterDodge.pct;
  }
  mult *= 1 + bonus / 100;
  mult *= 1 + (statusPower(e, 'shock') + statusPower(e, 'mark') + statusPower(e, 'armorBreak')) / 100;
  let crit = false;
  if (!o.isDot && w.rand() * 100 < stats.crit) {
    crit = true;
    mult *= 1 + stats.critDmg / 100;
  }
  // armor turns physical blows aside (bleeding goes through it)
  if (type === 'physical' && e.def.armor && !hasStatus(e, 'armorBreak') && !o.isDot) mult *= 1 - e.def.armor;
  mult *= 1 - (e.def.resist?.[type] ?? 0);
  let dmg = Math.max(1, Math.round(base * mult));
  const shown = dmg;
  if (e.shield > 0) {
    const took = Math.min(e.shield, dmg);
    e.shield -= took;
    dmg -= took;
    if (e.shield <= 0) {
      w.fxBurst(e.x, e.y, '#7fd8ff', 10);
      w.sfx('shieldBreak');
    }
  }
  if (!e.dummy) e.hp -= dmg;
  e.flash = 0.12;
  e.hurtT = 0;
  // some attacks give mana back (the Mage's bolt): only the direct hit, never splits or chains
  const manaBack = o.depth === 0 ? (spec?.extra.manaOnHit ?? 0) : 0;
  if (manaBack > 0 && w.player.maxMana > 0) w.player.mana = Math.min(w.player.maxMana, w.player.mana + (w.player.maxMana * manaBack) / 100);
  e.aggro = true;
  // knockback, softened by mass; bosses and rooted enemies stand firm
  const knock = (o.knock ?? spec?.knock ?? 0) * (crit ? 1.3 : 1);
  if (knock > 0 && !e.boss && !hasStatus(e, 'root') && o.fromX !== undefined && o.fromY !== undefined) {
    const a = Math.atan2(e.y - o.fromY, e.x - o.fromX);
    const k = knock / Math.max(0.6, e.def.mass);
    e.vx += Math.cos(a) * k;
    e.vy += Math.sin(a) * k;
  }
  if (w.settings.numbers || crit) w.text(e.x + (w.rand() - 0.5) * 6, e.y - e.r - 6, String(shown), crit ? '#ffe14d' : o.isDot ? DOT_COLOR[type] : '#ffffff', crit);
  if (!o.isDot) w.sfx(crit ? 'crit' : 'hit');
  // ultimate charge: hits worth a typical attack fill about 1/30th
  const ref = CLASSES[w.hero.cls].refDamage * levelPower(w.hero.level);
  const rate = (o.charge ?? (o.depth === 0 ? 1 : 0.5)) * (1 + stats.ultCharge / 100);
  if (!e.dummy) w.player.ult = Math.min(100, w.player.ult + (shown / (ref * 30)) * 100 * rate);
  w.player.calm = 0;
  if (e.dummy) w.dummyHit(spec ?? null);
  if (o.depth === 0 && !o.isDot) {
    runProcs(w, 'hit', { x: e.x, y: e.y, target: e, base, type, depth: o.depth, hitDmg: shown, skill: spec?.id });
    if (crit) runProcs(w, 'crit', { x: e.x, y: e.y, target: e, base, type, depth: o.depth, hitDmg: shown, skill: spec?.id });
  }
  if (e.hp <= 0 && !e.dummy) killEnemy(w, e, type, o.depth, spec ?? null);
  return shown;
}

export const DOT_COLOR: Record<DmgType, string> = { physical: '#ffffff', fire: '#ff9a4d', frost: '#9be7ff', lightning: '#9ad8ff', poison: '#8be36b', arcane: '#d2a8ff', shadow: '#b58aff', holy: '#ffe9a0', nature: '#9cf07a' };

/** Applies a status from the hero (hitDmg sizes damage over time). */
export function applyStatus(w: World, e: Enemy, s: { status: StatusId; dur: number; power: number; chance?: number; dmgType?: DmgType }, hitDmg: number): void {
  if (e.dead || e.dummy === 2) return;
  if (s.chance !== undefined && s.chance < 1 && w.rand() > s.chance) return;
  let id = s.status;
  let dur = s.dur;
  let power = s.power;
  // bosses shrug off hard control, elites halve it
  if (id === 'stun' || id === 'freeze' || id === 'root' || id === 'fear') {
    if (e.boss) {
      id = 'chill';
      power = 0.3;
      dur *= 0.5;
    } else if (e.elite.length) dur *= 0.5;
  }
  if (isDot(id)) power = Math.max(1, s.power * Math.max(hitDmg, 1));
  if (id === 'poison') {
    const stacks = e.statuses.filter((x) => x.id === 'poison');
    if (stacks.length >= 3) {
      const weakest = stacks.reduce((a, b) => (a.power < b.power ? a : b));
      weakest.power = Math.max(weakest.power, power);
      weakest.t = Math.max(weakest.t, dur);
    } else e.statuses.push({ id, t: dur, power, tick: 0.5, fromPlayer: true });
    return;
  }
  // curses of different kinds (shadow, arcane, holy) are separate; the same kind refreshes
  const dtype = id === 'curse' ? (s.dmgType ?? 'shadow') : undefined;
  const cur = e.statuses.find((x) => x.id === id && x.dtype === dtype);
  if (cur) {
    cur.t = Math.max(cur.t, dur);
    cur.power = Math.max(cur.power, power);
  } else e.statuses.push({ id, t: dur, power, tick: 0.5, fromPlayer: true, ...(dtype ? { dtype } : {}) });
  if (id === 'freeze') w.sfx('freeze');
  if (id === 'fear') {
    e.state = e.state === 'windup' || e.state === 'act' ? 'recover' : e.state;
    w.text(e.x, e.y - e.r - 10, 'FEARED', '#c9a8ff', false);
  }
}

/** Counts statuses down and deals damage over time. */
export function tickStatuses(w: World, e: Enemy, dt: number): void {
  for (const s of e.statuses) {
    s.t -= dt;
    const type = s.dtype ?? STATUS_DMG[s.id];
    if (type) {
      s.tick -= dt;
      if (s.tick <= 0) {
        s.tick += 0.5;
        // the per-second power was sized from a finished hit; take it back to a base for the multipliers
        const per = (s.power * 0.5) / Math.max(0.01, levelPower(w.hero.level) * typeBonus(effStats(w), type));
        hitEnemy(w, e, per, type, { depth: 1, isDot: true, charge: 0.4 });
        if (e.dead) return;
      }
    }
  }
  e.statuses = e.statuses.filter((s) => s.t > 0);
}

/** Enemies within a circle (alive, not spawning). */
export function enemiesIn(w: World, x: number, y: number, r: number): Enemy[] {
  return w.enemies.filter((e) => !e.dead && e.state !== 'spawn' && dist2(e.x, e.y, x, y) <= (r + e.r) * (r + e.r));
}

/** Damages every enemy in a circle. */
export function damageArea(w: World, x: number, y: number, r: number, base: number, type: DmgType, depth: number, spec: SkillSpec | null, statuses: { status: StatusId; dur: number; power: number }[] = []): Enemy[] {
  const hit = enemiesIn(w, x, y, r);
  for (const e of hit) {
    const d = hitEnemy(w, e, base, type, { spec: depth === 0 ? spec : null, depth, fromX: x, fromY: y, knock: depth === 0 ? spec?.knock : 20 });
    for (const s of statuses) applyStatus(w, e, s, d);
  }
  w.breakWalls(x, y, r);
  return hit;
}

export interface EffectCtx {
  x: number;
  y: number;
  angle: number;
  spec: SkillSpec | null;
  /** Base damage effects scale from. */
  base: number;
  type: DmgType;
  depth: number;
  target?: Enemy;
  /** Damage of the triggering hit (sizes damage over time). */
  hitDmg: number;
  proj?: Projectile;
  /** 'hit' effects may split forward; 'impact' effects split all around. */
  when: 'hit' | 'impact' | 'kill' | 'cast' | 'proc';
}

/** Makes a list of effects happen. */
export function applyEffects(w: World, list: Effect[], c: EffectCtx): void {
  for (const e of list) applyEffect(w, e, c);
}

export function applyEffect(w: World, e: Effect, c: EffectCtx): void {
  if (c.depth > 2) return;
  switch (e.kind) {
    case 'status':
      if (c.target) applyStatus(w, c.target, e, c.hitDmg);
      break;
    case 'explode': {
      w.fxBurst(c.x, c.y, e.dmgType === 'poison' ? '#8be36b' : e.dmgType === 'lightning' ? '#9ad8ff' : '#ffb04d', 14, e.radius);
      w.addFx({ kind: 'ring', x: c.x, y: c.y, life: 0.3, size: e.radius, color: e.dmgType === 'poison' ? '#8be36b' : '#ffcf6a' });
      w.sfx('explode');
      w.shake(1.5);
      damageArea(w, c.x, c.y, e.radius, c.base * e.mul, e.dmgType ?? c.type, c.depth + 1, null, e.status ? [e.status] : []);
      break;
    }
    case 'split': {
      const p = c.proj;
      if (p && (p.child || p.splitDone)) break;
      if (p) p.splitDone = true;
      const n = e.count;
      const speed = p ? Math.hypot(p.vx, p.vy) * 0.85 : 180;
      for (let i = 0; i < n; i++) {
        const a = c.when === 'hit' ? c.angle + (n === 1 ? 0 : -0.45 + (0.9 * i) / (n - 1)) : c.angle + Math.PI / n + (TAU * i) / n;
        w.spawnProjectile({
          x: c.x,
          y: c.y,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed,
          r: 2.5,
          life: 80,
          dmg: c.base * e.mul,
          type: c.type,
          spec: c.spec ? childSpec(c.spec) : null,
          depth: c.depth + 1,
          pierce: 0,
          bounce: 0,
          hit: c.target ? [c.target.id] : [],
          look: c.spec?.look === 'lightning' ? 'spark' : c.type === 'fire' ? 'ember' : c.type === 'poison' ? 'needle' : 'shard',
          color: '#ffd38a',
          child: true,
          knock: 15,
        });
      }
      break;
    }
    case 'chain': {
      const hit = new Set<number>(c.target ? [c.target.id] : []);
      let from: { x: number; y: number } = c.target ?? { x: c.x, y: c.y };
      for (let j = 0; j < e.jumps; j++) {
        let best: Enemy | null = null;
        let bd = e.range * e.range;
        for (const en of w.enemies) {
          if (en.dead || en.state === 'spawn' || hit.has(en.id)) continue;
          const d = dist2(en.x, en.y, from.x, from.y);
          if (d < bd) {
            bd = d;
            best = en;
          }
        }
        if (!best) break;
        hit.add(best.id);
        w.addFx({ kind: 'zap', x: from.x, y: from.y, x2: best.x, y2: best.y, life: 0.18, size: 1, color: '#bfe9ff' });
        hitEnemy(w, best, c.base * e.mul, e.dmgType ?? c.type, { depth: c.depth + 1, fromX: from.x, fromY: from.y, knock: 10 });
        from = best;
      }
      if (hit.size > (c.target ? 1 : 0)) w.sfx('zap');
      break;
    }
    case 'heal':
      // heals from hits, kills and procs share the per-second limit; a heal you cast is whole
      healPlayer(w, e.pct, c.when === 'hit' || c.when === 'kill' || c.when === 'proc');
      break;
    case 'shield': {
      const p = w.player;
      p.shield = Math.max(p.shield, (p.maxHp * e.pct) / 100);
      p.shieldT = Math.max(p.shieldT, e.dur);
      w.sfx('shield');
      break;
    }
    case 'nova': {
      w.addFx({ kind: 'ring', x: c.x, y: c.y, life: 0.35, size: e.radius, color: e.dmgType === 'frost' ? '#9be7ff' : e.dmgType === 'lightning' ? '#bfe9ff' : '#ffffff' });
      if (e.dmgType === 'lightning') for (let i = 0; i < 5; i++) w.addFx({ kind: 'zap', x: c.x, y: c.y, x2: c.x + Math.cos((TAU * i) / 5) * e.radius, y2: c.y + Math.sin((TAU * i) / 5) * e.radius, life: 0.2, size: 1, color: '#bfe9ff' });
      damageArea(w, c.x, c.y, e.radius, c.base * e.mul, e.dmgType ?? c.type, c.depth + 1, null, e.status ? [e.status] : []);
      break;
    }
    case 'shockwave':
      w.spawnProjectile({
        x: c.x,
        y: c.y,
        vx: Math.cos(c.angle) * 210,
        vy: Math.sin(c.angle) * 210,
        r: e.width / 2,
        life: e.length,
        dmg: c.base * e.mul,
        type: 'physical',
        spec: null,
        depth: c.depth + 1,
        pierce: 99,
        bounce: 0,
        hit: [],
        look: 'quake',
        color: '#d9b77a',
        child: true,
        knock: 60,
        wide: true,
      });
      w.shake(2);
      break;
    case 'ground':
      w.spawnField({ x: c.x, y: c.y, r: e.ground.radius, dur: e.ground.dur, tick: e.ground.tick, dmg: c.base * e.ground.mul, type: e.ground.dmgType, status: e.ground.status, look: e.ground.look, hostile: false, depth: c.depth + 1, spec: null, onHit: false });
      break;
    case 'pull':
      for (const en of enemiesIn(w, c.x, c.y, e.radius)) {
        if (en.boss) continue;
        const a = Math.atan2(c.y - en.y, c.x - en.x);
        en.vx += Math.cos(a) * e.force;
        en.vy += Math.sin(a) * e.force;
      }
      break;
    case 'resetCd':
      w.resetCooldown(e.skill);
      break;
    case 'cdr':
      w.reduceCooldowns(e.s);
      break;
    case 'charge':
      w.player.ult = Math.min(100, w.player.ult + e.pct);
      break;
    case 'buff':
      addBuff(w, e.buff);
      break;
    case 'resource':
      gainResource(w, e.n, 'pct');
      break;
    case 'fear':
      w.addFx({ kind: 'ring', x: c.x, y: c.y, life: 0.4, size: e.radius, color: '#a87aff' });
      for (const en of enemiesIn(w, c.x, c.y, e.radius)) applyStatus(w, en, { status: 'fear', dur: e.dur, power: 1 }, 0);
      break;
    case 'summon':
      summonPet(w, e.pet, e.count, e.dur);
      break;
    case 'sacrifice': {
      const p = w.player;
      const lose = Math.min(p.hp - 1, (p.maxHp * e.pct) / 100);
      if (lose > 0) {
        p.hp -= lose;
        w.text(p.x, p.y - 18, `-${Math.round(lose)}`, '#c9a8ff', false);
      }
      break;
    }
    case 'riftBurst': {
      const x = c.x;
      const y = c.y;
      const base = CLASSES[w.hero.cls].refDamage * e.mul;
      w.addFx({ kind: 'rift', x, y, life: e.delay, size: e.radius * 0.6, color: '#ff3fd2' });
      w.after(e.delay, () => {
        w.addFx({ kind: 'ring', x, y, life: 0.3, size: e.radius, color: '#ff6ae0' });
        w.fxBurst(x, y, '#ff3fd2', 12, e.radius);
        w.sfx('rift');
        damageArea(w, x, y, e.radius, base, 'arcane', c.depth + 1, null);
      });
      break;
    }
  }
}

/** A child projectile keeps its parent's statuses but never splits, explodes or chains again. */
function childSpec(s: SkillSpec): SkillSpec {
  return { ...s, onHit: s.onHit.filter((e) => e.kind === 'status'), onImpact: [], onKill: [], trail: undefined, pierce: 0, bounce: 0 };
}

/** Triggers the hero's procs for an event. */
export function runProcs(w: World, on: ProcDef['on'], c: Omit<EffectCtx, 'angle' | 'spec' | 'when'> & { angle?: number; killType?: DmgType; statuses?: StatusId[]; skill?: string }): void {
  for (const p of w.build.procs) {
    if (p.on !== on) continue;
    if (p.skill && p.skill !== c.skill) continue;
    if (p.dmgType && (c.killType ?? c.type) !== p.dmgType) continue;
    if (p.status && !(c.statuses ?? c.target?.statuses.map((s) => s.id) ?? []).includes(p.status)) continue;
    if ((w.procCd[p.id] ?? 0) > w.time) continue;
    if (p.chance < 1 && w.rand() > p.chance) continue;
    w.procCd[p.id] = w.time + p.icd;
    const refBase = CLASSES[w.hero.cls].refDamage;
    const base = on === 'hit' || on === 'crit' ? c.base : refBase;
    applyEffect(w, p.effect, { ...c, angle: c.angle ?? w.player.aim, spec: null, base, depth: Math.max(1, c.depth), when: 'proc' });
  }
}

/** An enemy dies: experience, gold, loot, quests, on-kill effects and procs. */
export function killEnemy(w: World, e: Enemy, type: DmgType, depth: number, spec: SkillSpec | null): void {
  if (e.dead) return;
  const statuses = e.statuses.map((s) => s.id);
  e.dead = true;
  e.state = 'dead';
  e.deathT = 0;
  e.hp = 0;
  w.onKill(e);
  if (spec && depth === 0) applyEffects(w, spec.onKill, { x: e.x, y: e.y, angle: Math.atan2(e.y - w.player.y, e.x - w.player.x), spec, base: spec.damage, type, depth, target: e, hitDmg: 0, when: 'kill' });
  runProcs(w, 'kill', { x: e.x, y: e.y, target: e, base: 0, type, depth, hitDmg: 0, killType: type, statuses, skill: spec?.id });
}

/** A buff on the hero: the same buff refreshes (the longer time, the stronger numbers). */
export function addBuff(w: World, def: BuffDef): void {
  const p = w.player;
  const cur = p.buffs.find((b) => b.def.id === def.id);
  if (cur) {
    cur.t = Math.max(cur.t, def.dur);
    cur.def = def;
  } else p.buffs.push({ def, t: def.dur });
  w.addFx({ kind: 'glow', x: p.x, y: p.y - 6, life: 0.5, size: 14, color: def.color });
  w.sfx('buff', 0.6);
}

/** Heals the hero by a share of max health (more with the healing stat). Healing from hits draws from a per-second budget. */
export function healPlayer(w: World, pct: number, fromHit: boolean, quiet = false): number {
  const p = w.player;
  if (p.dead) return 0;
  let amount = ((p.maxHp * pct) / 100) * (1 + (effStats(w).healing ?? 0) / 100);
  if (fromHit) {
    amount = Math.min(amount, p.healBudget);
    p.healBudget -= amount;
  }
  const before = p.hp;
  p.hp = Math.min(p.maxHp, p.hp + amount);
  const healed = p.hp - before;
  if (healed >= 1 && !quiet) w.text(p.x, p.y - 16, `+${Math.round(healed)}`, '#6dff8f', false);
  return healed;
}

/**
 * The hero takes a hit. Dodging (and other invulnerable moments) avoids it entirely; armor cuts it,
 * a shield soaks it first. Returns whether it landed.
 */
export function hurtPlayer(w: World, dmg: number, o: { fromX?: number; fromY?: number; knock?: number; status?: { status: StatusId; dur: number; power: number }; source?: Enemy } = {}): boolean {
  const p = w.player;
  if (p.dead || dmg <= 0) return false;
  if (p.iframe > 0) {
    w.dodgedSomething();
    return false;
  }
  const stats = effStats(w);
  const reduction = Math.min(0.6, stats.armor / (stats.armor + 60));
  let d = dmg * (1 - reduction);
  if (o.source && hasStatus(o.source, 'weaken')) d *= 1 - statusPower(o.source, 'weaken') / 100;
  // walls and wards: buffs that cut damage taken (at most 75% together)
  const dr = Math.min(75, p.buffs.reduce((a, b) => a + (b.def.dr ?? 0), 0));
  if (dr > 0) d *= 1 - dr / 100;
  d = Math.max(1, Math.round(d));
  if (p.shield > 0) {
    const took = Math.min(p.shield, d);
    p.shield -= took;
    d -= took;
  }
  p.hp -= d;
  p.flash = 0.18;
  p.lastHurt = w.time;
  p.calm = 0;
  w.text(p.x, p.y - 18, `-${Math.round(dmg * (1 - reduction) * (1 - dr / 100))}`, '#ff5a5a', false);
  // rage: being hit makes you angry (10% of your health in one blow is 6 Rage)
  if (w.build.resource?.kind === 'rage') gainResource(w, (d / p.maxHp) * 60 + 1);
  w.sfx('hurt');
  w.shake(2.2);
  if (o.knock && o.fromX !== undefined && o.fromY !== undefined) {
    const a = Math.atan2(p.y - o.fromY, p.x - o.fromX);
    p.vx += Math.cos(a) * o.knock;
    p.vy += Math.sin(a) * o.knock;
  }
  if (o.status) {
    const cur = p.statuses.find((s) => s.id === o.status!.status);
    const power = o.status.status === 'burn' || o.status.status === 'poison' ? o.status.power : o.status.power;
    if (cur) {
      cur.t = Math.max(cur.t, o.status.dur);
      cur.power = Math.max(cur.power, power);
    } else p.statuses.push({ id: o.status.status, t: o.status.dur, power, tick: 0.5 });
  }
  if (o.source?.elite.includes('vampiric')) {
    o.source.hp = Math.min(o.source.maxHp, o.source.hp + o.source.maxHp * 0.08);
    w.text(o.source.x, o.source.y - o.source.r - 6, '+', '#ff5a7a', false);
  }
  runProcs(w, 'hurt', { x: p.x, y: p.y, base: 0, type: 'physical', depth: 1, hitDmg: d });
  if (p.hp <= 0) w.playerDies();
  return true;
}

/** Player statuses: burning and poisoned hurt, chilled slows (stun is brief). */
export function tickPlayerStatuses(w: World, dt: number): void {
  const p = w.player;
  for (const s of p.statuses) {
    s.t -= dt;
    if (s.id === 'burn' || s.id === 'poison') {
      s.tick -= dt;
      if (s.tick <= 0) {
        s.tick += 0.5;
        if (p.iframe <= 0 && !p.dead) {
          const d = Math.max(1, Math.round(s.power * 0.5));
          p.hp -= d;
          p.flash = 0.08;
          w.text(p.x, p.y - 18, `-${d}`, s.id === 'burn' ? '#ff9a4d' : '#8be36b', false);
          if (p.hp <= 0) w.playerDies();
        }
      }
    }
  }
  p.statuses = p.statuses.filter((s) => s.t > 0);
}

export const playerSlow = (w: World): number => {
  const c = w.player.statuses.find((s) => s.id === 'chill');
  return c ? clamp(1 - c.power, 0.3, 1) : 1;
};
export const playerStunned = (w: World): boolean => w.player.statuses.some((s) => s.id === 'stun');
