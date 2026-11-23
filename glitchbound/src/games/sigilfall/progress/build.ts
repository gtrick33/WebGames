import { TAU } from '../core/math';
import { CLASSES, emptyStats } from '../data/classes';
import { ITEM_DEFS } from '../data/items';
import { SETS, type SetDef } from '../data/riftgear';
import { SKILLS } from '../data/skills';
import { SPEC_LEVEL, TALENTS } from '../data/talents';
import type { Effect, FormDef, GroundSpec, Mod, PointsDef, ProcDef, Rarity, ResourceDef, SkillOp, SkillSpec, SlotKey, Stats, StatKey } from '../data/types';
import { SKILL_SLOTS, SLOTS } from '../data/types';
import { hasUltimate, SIGIL_BONUS, sigilCount, slotOpen, type Character } from './character';
import { opText } from './describe';
import { itemMods, itemName, itemStats } from './items';
import { paragonStats } from './paragon';

/**
 * Turns a hero (class, level, talents, gear) into what the simulation runs: final stats, the procs
 * that can trigger, and every skill on the bar with all of its modifiers applied.
 *
 * Resolution order, the same for every skill:
 *   1. the skill's base spec;
 *   2. talents, in tree order, then items, in slot order (weapon, off-hand, head, chest, legs, hands,
 *      feet, amulet, ring, relic);
 *   3. counts (projectiles, pierce, bounce, charges, extra knobs) add up as they come;
 *   4. percentages of the same kind add up, then apply once (+30% and +20% area = +50%);
 *   5. effects merge by kind: the same status keeps the stronger duration and power, two explosions
 *      become one bigger one, splits keep the larger count; nothing stacks without limit;
 *   6. caps: cooldowns never drop below half, bounces 4, projectiles 11, charges 3, chain jumps 8,
 *      traps 6, echoes 2.
 * A modifier names its skill by id ('*' = every skill, 'basic' / 'dodge' / 'ult' = that slot), so it
 * can only ever change the skill it names.
 */

export interface ModSource {
  name: string;
  kind: 'talent' | 'item';
  rarity?: Rarity;
}

export interface SkillNote {
  source: ModSource;
  text: string;
}

export interface ResolvedSkill {
  spec: SkillSpec;
  notes: SkillNote[];
}

export interface HeroBuild {
  stats: Stats;
  /** Extra stats while below half health / for 3 s after a dodge. */
  lowHp: Partial<Stats>;
  afterDodge: Partial<Stats>;
  maxHp: number;
  /** The class's resource (null for none) and its maximum (mana grows with level; the others are fixed). */
  resource: ResourceDef | null;
  maxMana: number;
  /** The druid shape the build was made for (null: none). */
  form: FormDef | null;
  /** Skill ids on the bar (null = empty or not learned yet). */
  bar: Record<SlotKey, string | null>;
  skills: Record<string, ResolvedSkill>;
  procs: ProcDef[];
  /** The specialization's points (SpecDef.points), or null. */
  points: PointsDef | null;
}

interface Entry {
  mod: Mod;
  rank: number;
  source: ModSource;
}

/** Every modifier the hero has: the specialization's passive, talents (tree order), then items (slot order). */
export function collectMods(c: Character): Entry[] {
  const out: Entry[] = [];
  const spec = c.spec !== null && c.level >= SPEC_LEVEL ? CLASSES[c.cls].trees[c.spec] : null;
  if (spec) for (const mod of spec.passive.mods) out.push({ mod, rank: 1, source: { name: spec.passive.name, kind: 'talent' } });
  if (spec?.combo) for (const mod of spec.combo.mods) out.push({ mod, rank: 1, source: { name: spec.combo.name, kind: 'talent' } });
  for (const node of TALENTS[c.cls]) {
    const rank = c.talents[node.id] ?? 0;
    if (rank > 0) for (const mod of node.mods) out.push({ mod, rank, source: { name: node.name, kind: 'talent' } });
  }
  for (const slot of SLOTS) {
    const item = c.equip[slot];
    if (!item) continue;
    for (const mod of itemMods(item)) out.push({ mod, rank: 1, source: { name: itemName(item), kind: 'item', rarity: item.r } });
  }
  // what a set gives for the pieces of it worn
  for (const { set, worn } of setsWorn(c.equip)) {
    for (const b of set.bonuses) if (worn >= b.need) for (const mod of b.mods) out.push({ mod, rank: 1, source: { name: set.name, kind: 'item', rarity: 'legendary' } });
  }
  return out;
}

/** The sets a hero wears pieces of, and how many of each. */
export function setsWorn(equip: Character['equip']): { set: SetDef; worn: number }[] {
  const n = new Map<string, number>();
  for (const slot of SLOTS) {
    const id = equip[slot] ? ITEM_DEFS[equip[slot]!.base]?.set : undefined;
    if (id) n.set(id, (n.get(id) ?? 0) + 1);
  }
  return [...n].flatMap(([id, worn]) => (SETS[id] ? [{ set: SETS[id]!, worn }] : []));
}

/** The skill ids a mod's `skill` field can stand for. */
function targets(skill: string, c: Character): (id: string) => boolean {
  const def = CLASSES[c.cls];
  if (skill === '*') return () => true;
  if (skill === 'basic') return (id) => id === def.basic || !!def.forms?.some((f) => f.basic === id);
  if (skill === 'dodge') return (id) => id === def.dodge || !!def.forms?.some((f) => f.dodge === id);
  if (skill === 'ult') return (id) => id === def.ult || def.trees.some((t) => t.ult === id);
  return (id) => id === skill;
}

/* ------------------------------------------------------------ effects */

const cloneGround = (g: GroundSpec): GroundSpec => ({ ...g, status: g.status ? { ...g.status } : undefined });

function cloneEffect(e: Effect): Effect {
  switch (e.kind) {
    case 'explode':
      return { ...e, status: e.status ? { ...e.status } : undefined };
    case 'nova':
      return { ...e, status: e.status ? { ...e.status } : undefined };
    case 'ground':
      return { ...e, ground: cloneGround(e.ground) };
    case 'buff':
      return { ...e, buff: { ...e.buff, stats: e.buff.stats ? { ...e.buff.stats } : undefined } };
    default:
      return { ...e };
  }
}

/** An effect with its numbers multiplied by a talent's rank. */
export function scaleEffect(e: Effect, rank: number): Effect {
  const x = cloneEffect(e);
  if (rank === 1) return x;
  switch (x.kind) {
    case 'status':
      x.power *= rank;
      break;
    case 'explode':
    case 'chain':
    case 'nova':
    case 'shockwave':
    case 'riftBurst':
    case 'cast':
      x.mul *= rank;
      break;
    case 'heal':
    case 'shield':
    case 'charge':
      x.pct *= rank;
      break;
    case 'cdr':
      x.s *= rank;
      break;
    case 'resource':
    case 'points':
      x.n *= rank;
      break;
    case 'buff':
      if (x.buff.stats) for (const k of Object.keys(x.buff.stats) as StatKey[]) x.buff.stats[k] = (x.buff.stats[k] ?? 0) * rank;
      if (x.buff.dr) x.buff.dr = Math.min(70, x.buff.dr * rank);
      if (x.buff.hot) x.buff.hot *= rank;
      // (a next cast made stronger: stronger again with every rank)
      if (x.buff.empower?.pct) x.buff.empower = { ...x.buff.empower, pct: x.buff.empower.pct * rank };
      break;
    default:
      break;
  }
  return x;
}

/** Adds an effect to a list, merging with one of the same kind (see the rules at the top). */
export function mergeEffect(list: Effect[], e: Effect): void {
  const i = list.findIndex(
    (x) =>
      x.kind === e.kind &&
      (x.kind !== 'status' || (e.kind === 'status' && x.status === e.status)) &&
      (x.kind !== 'resetCd' || (e.kind === 'resetCd' && x.skill === e.skill)) &&
      (x.kind !== 'buff' || (e.kind === 'buff' && x.buff.id === e.buff.id)) &&
      (x.kind !== 'summon' || (e.kind === 'summon' && x.pet === e.pet && (x.dur === 0) === (e.dur === 0))) &&
      (x.kind !== 'cast' || (e.kind === 'cast' && x.skill === e.skill)),
  );
  if (i < 0) {
    list.push(cloneEffect(e));
    return;
  }
  const a = list[i]!;
  const strongest = (p: number, q: number): number => Math.max(p, q) + 0.25 * Math.min(p, q);
  switch (a.kind) {
    case 'status':
      if (e.kind === 'status') list[i] = { ...a, dur: Math.max(a.dur, e.dur), power: Math.max(a.power, e.power), chance: Math.max(a.chance ?? 1, e.chance ?? 1) };
      break;
    case 'explode':
      if (e.kind === 'explode') list[i] = { ...a, radius: Math.max(a.radius, e.radius), mul: Math.min(2, strongest(a.mul, e.mul)), status: a.status ?? e.status };
      break;
    case 'split':
      if (e.kind === 'split') list[i] = { ...a, count: Math.min(6, Math.max(a.count, e.count)), mul: Math.max(a.mul, e.mul) };
      break;
    case 'chain':
      if (e.kind === 'chain') list[i] = { ...a, jumps: Math.min(4, Math.max(a.jumps, e.jumps)), range: Math.max(a.range, e.range), mul: Math.min(1, Math.max(a.mul, e.mul)) };
      break;
    // (two echoes of the same skill: the stronger, as often as the most)
    case 'cast':
      if (e.kind === 'cast') list[i] = { ...a, mul: Math.max(a.mul, e.mul), times: Math.max(a.times ?? 1, e.times ?? 1) };
      break;
    case 'heal':
      if (e.kind === 'heal') list[i] = { ...a, pct: Math.max(a.pct, e.pct) };
      break;
    case 'shield':
      if (e.kind === 'shield') list[i] = { ...a, pct: Math.max(a.pct, e.pct), dur: Math.max(a.dur, e.dur) };
      break;
    case 'nova':
      if (e.kind === 'nova') list[i] = { ...a, radius: Math.max(a.radius, e.radius), mul: Math.min(2.5, strongest(a.mul, e.mul)), status: a.status ?? e.status };
      break;
    case 'shockwave':
      if (e.kind === 'shockwave') list[i] = { ...a, length: Math.max(a.length, e.length), width: Math.max(a.width, e.width), mul: Math.min(1.5, strongest(a.mul, e.mul)) };
      break;
    case 'ground':
      if (e.kind === 'ground') list[i] = { kind: 'ground', ground: mergeGround(a.ground, e.ground) };
      break;
    case 'charge':
      if (e.kind === 'charge') list[i] = { ...a, pct: a.pct + e.pct };
      break;
    case 'cdr':
      if (e.kind === 'cdr') list[i] = { ...a, s: Math.max(a.s, e.s) };
      break;
    case 'buff':
      if (e.kind === 'buff') {
        const st: Partial<Record<StatKey, number>> = { ...a.buff.stats };
        for (const [k, v] of Object.entries(e.buff.stats ?? {})) st[k as StatKey] = Math.max(st[k as StatKey] ?? 0, v ?? 0);
        list[i] = { kind: 'buff', buff: { ...a.buff, dur: Math.max(a.buff.dur, e.buff.dur), stats: st, dr: Math.min(70, Math.max(a.buff.dr ?? 0, e.buff.dr ?? 0)) || undefined, hot: Math.max(a.buff.hot ?? 0, e.buff.hot ?? 0) || undefined } };
      }
      break;
    case 'summon':
      if (e.kind === 'summon') list[i] = { ...a, count: Math.min(4, Math.max(a.count, e.count)), dur: Math.max(a.dur, e.dur) };
      break;
    case 'resource':
      if (e.kind === 'resource') list[i] = { ...a, n: a.n + e.n };
      break;
    case 'points':
      if (e.kind === 'points') list[i] = { ...a, n: a.n + e.n };
      break;
    case 'fear':
      if (e.kind === 'fear') list[i] = { ...a, radius: Math.max(a.radius, e.radius), dur: Math.max(a.dur, e.dur) };
      break;
    case 'sacrifice':
      if (e.kind === 'sacrifice') list[i] = { ...a, pct: Math.max(a.pct, e.pct) };
      break;
    default:
      break;
  }
}

function mergeGround(a: GroundSpec | undefined, b: GroundSpec): GroundSpec {
  if (!a) return cloneGround(b);
  return { ...a, radius: Math.max(a.radius, b.radius), dur: Math.max(a.dur, b.dur), mul: Math.max(a.mul, b.mul), status: a.status ?? b.status };
}

/* ------------------------------------------------------------- skills */

/** A combo blow never lands more than this many times as hard. */
export const COMBO_MOST = 4;

const CAPS: Record<string, number> = { jumps: 8, maxTraps: 6, echo: 2, meteors: 4, strikes: 10, pull: 120, comboMul: 2, comboArc: 1.5 };

/** Applies modifiers to a skill's base spec (exported for tests). */
export function applyOps(base: SkillSpec, ops: { op: SkillOp; rank: number }[]): SkillSpec {
  const s: SkillSpec = {
    ...base,
    onHit: base.onHit.map(cloneEffect),
    onImpact: base.onImpact.map(cloneEffect),
    onKill: base.onKill.map(cloneEffect),
    onCast: base.onCast.map(cloneEffect),
    trail: base.trail ? cloneGround(base.trail) : undefined,
    bonusVs: base.bonusVs.map((b) => ({ ...b })),
    afterDodge: base.afterDodge ? { ...base.afterDodge } : undefined,
    combo: base.combo ? { ...base.combo, vs: [...base.combo.vs], extra: base.combo.extra?.map(cloneEffect) } : undefined,
    spend: base.spend ? { ...base.spend } : undefined,
    extra: { ...base.extra },
    tags: [...base.tags],
  };
  const acc = { damage: 0, cooldown: 0, area: 0, range: 0, duration: 0, arc: 0, cost: 0 };
  for (const { op, rank } of ops) {
    switch (op.op) {
      case 'damage':
      case 'cooldown':
      case 'area':
      case 'range':
      case 'duration':
      case 'arc':
        acc[op.op] += op.pct * rank;
        break;
      case 'pierce':
        s.pierce += op.n * rank;
        break;
      case 'bounce':
        s.bounce += op.n * rank;
        break;
      case 'projectiles': {
        const before = s.count;
        s.count += op.n * rank;
        s.spread = op.spread ?? (before > 1 ? (s.spread * (s.count - 1)) / (before - 1) : 0.16 * (s.count - 1));
        break;
      }
      case 'charges':
        s.charges += op.n * rank;
        break;
      case 'extra':
        s.extra[op.key] = (s.extra[op.key] ?? 0) + op.n * rank;
        break;
      case 'convert':
        s.dmgType = op.dmgType;
        if (op.look) s.look = op.look;
        break;
      case 'onHit':
      case 'onImpact':
      case 'onKill':
      case 'onCast':
        mergeEffect(s[op.op], scaleEffect(op.effect, rank));
        break;
      case 'trail':
        s.trail = mergeGround(s.trail, op.ground);
        break;
      case 'bonusVs': {
        const b = s.bonusVs.find((x) => x.status === op.status);
        if (b) b.pct = Math.min(150, b.pct + op.pct * rank);
        else s.bonusVs.push({ status: op.status, pct: op.pct * rank });
        break;
      }
      case 'afterDodge':
        s.afterDodge = s.afterDodge ? { window: Math.max(s.afterDodge.window, op.window), pct: Math.min(150, s.afterDodge.pct + op.pct * rank) } : { window: op.window, pct: op.pct * rank };
        break;
      case 'gen':
        s.gen += op.n * rank;
        break;
      case 'cost':
        acc.cost += op.pct * rank;
        break;
      case 'combo': {
        // a skill made a combo blow takes the op's whole combo; one already a combo is added to: what it needs, what it
        // consumes and does besides, and `add` more on its multiplier a rank
        const c = op.combo;
        const cur = s.combo ?? { name: c.name ?? 'Combo', vs: [], mult: c.mult ?? 1.5 };
        if (s.combo && c.mult !== undefined) cur.mult = Math.max(cur.mult, c.mult);
        cur.mult = Math.min(COMBO_MOST, cur.mult + (op.add ?? 0) * rank);
        for (const v of c.vs ?? []) if (!cur.vs.includes(v)) cur.vs.push(v);
        if (c.consume) cur.consume = true;
        if (c.extra) {
          cur.extra ??= [];
          for (const e of c.extra) mergeEffect(cur.extra, scaleEffect(e, rank));
        }
        s.combo = cur;
        break;
      }
      case 'build':
        s.build = (s.build ?? 0) + op.n * rank;
        break;
      case 'spend':
        s.spend = { ...(s.spend ?? { per: 0 }), per: (s.spend?.per ?? 0) + op.per * rank };
        break;
    }
  }
  s.cost *= Math.max(0, 1 - acc.cost / 100);
  s.damage *= 1 + acc.damage / 100;
  s.cooldown *= Math.max(0.5, 1 - acc.cooldown / 100);
  const area = 1 + acc.area / 100;
  s.area *= area;
  if (area !== 1) {
    for (const list of [s.onHit, s.onImpact]) {
      for (const e of list) {
        if (e.kind === 'explode' || e.kind === 'nova') e.radius *= area;
        if (e.kind === 'ground') e.ground.radius *= area;
      }
    }
  }
  s.range *= 1 + acc.range / 100;
  s.duration *= 1 + acc.duration / 100;
  // longer-lasting skills also give longer buffs
  if (acc.duration) for (const e of s.onCast) if (e.kind === 'buff') e.buff.dur *= 1 + acc.duration / 100;
  s.arc = Math.min(TAU, s.arc * (1 + acc.arc / 100));
  s.bounce = Math.min(4, s.bounce);
  s.count = Math.min(11, s.count);
  s.charges = Math.min(3, s.charges);
  for (const [k, cap] of Object.entries(CAPS)) if (s.extra[k] !== undefined) s.extra[k] = Math.min(cap, s.extra[k]!);
  return s;
}

/** One skill with every modifier the hero has, plus a note per modifier for the UI. */
export function resolveSkill(c: Character, id: string, mods: Entry[] = collectMods(c)): ResolvedSkill {
  const def = SKILLS[id];
  if (!def) throw new Error(`unknown skill ${id}`);
  const ops: { op: SkillOp; rank: number }[] = [];
  const notes: SkillNote[] = [];
  for (const e of mods) {
    if (e.mod.t !== 'skill' || !targets(e.mod.skill, c)(id)) continue;
    ops.push({ op: e.mod.op, rank: e.rank });
    notes.push({ source: e.source, text: opText(id, scaleOp(e.mod.op, e.rank)) });
  }
  return { spec: applyOps(def.base, ops), notes };
}

/** An op with its numbers multiplied by rank (for the text). */
function scaleOp(op: SkillOp, rank: number): SkillOp {
  if (rank === 1) return op;
  switch (op.op) {
    case 'damage':
    case 'cooldown':
    case 'area':
    case 'range':
    case 'duration':
    case 'arc':
    case 'bonusVs':
    case 'afterDodge':
      return { ...op, pct: op.pct * rank };
    case 'pierce':
    case 'bounce':
    case 'projectiles':
    case 'charges':
    case 'extra':
    case 'gen':
      return { ...op, n: op.n * rank };
    case 'cost':
      return { ...op, pct: op.pct * rank };
    case 'combo':
      return { ...op, add: (op.add ?? 0) * rank };
    case 'build':
      return { ...op, n: op.n * rank };
    case 'spend':
      return { ...op, per: op.per * rank };
    case 'onHit':
    case 'onImpact':
    case 'onKill':
    case 'onCast':
      return { ...op, effect: scaleEffect(op.effect, rank) };
    default:
      return op;
  }
}

/* -------------------------------------------------------------- stats */

export function heroStats(c: Character, mods: Entry[] = collectMods(c)): { stats: Stats; lowHp: Partial<Stats>; afterDodge: Partial<Stats>; maxHp: number } {
  const def = CLASSES[c.cls];
  const stats: Stats = { ...def.base };
  stats.hp = def.base.hp + def.hpPer * (c.level - 1);
  for (const slot of SLOTS) {
    const item = c.equip[slot];
    if (item) for (const [k, v] of itemStats(item)) stats[k] += v;
  }
  const lowHp: Partial<Stats> = {};
  const afterDodge: Partial<Stats> = {};
  for (const e of mods) {
    if (e.mod.t !== 'stat') continue;
    const v = e.mod.v * e.rank;
    if (e.mod.when === 'lowHp') lowHp[e.mod.stat] = (lowHp[e.mod.stat] ?? 0) + v;
    else if (e.mod.when === 'afterDodge') afterDodge[e.mod.stat] = (afterDodge[e.mod.stat] ?? 0) + v;
    else stats[e.mod.stat] += v;
  }
  // Paragon points (past level 60)
  if (c.para) for (const [k, v] of Object.entries(paragonStats(c.para)) as [StatKey, number][]) stats[k] += v;
  const sigils = sigilCount(c) * SIGIL_BONUS;
  stats.hpPct += sigils;
  stats.power += sigils;
  stats.crit = Math.min(75, stats.crit);
  stats.speed = Math.min(40, stats.speed);
  const maxHp = Math.round(stats.hp * (1 + stats.hpPct / 100));
  return { stats, lowHp, afterDodge, maxHp };
}

/** Procs from talents (scaled by rank) and items. */
export function heroProcs(mods: Entry[]): ProcDef[] {
  const out: ProcDef[] = [];
  for (const e of mods) {
    if (e.mod.t !== 'proc') continue;
    const p = e.mod.proc;
    if (out.some((x) => x.id === p.id)) continue;
    // (a chance that grows with the rank, "4% chance per rank", leaves what it does as it is)
    out.push(p.perRank === 'chance' ? { ...p, chance: Math.min(1, p.chance * e.rank), effect: cloneEffect(p.effect) } : { ...p, effect: scaleEffect(p.effect, e.rank) });
  }
  return out;
}

/** Every skill id a class can ever use (its pool, specializations, shapes, ultimate and dodge). */
export function classSkillIds(c: Character): string[] {
  const def = CLASSES[c.cls];
  const ids = [def.basic, ...def.skills, ...def.trees.map((t) => t.skill), def.ult, ...def.trees.flatMap((t) => (t.ult ? [t.ult] : [])), def.dodge];
  for (const f of def.forms ?? []) ids.push(f.basic, ...f.skills, f.dodge, ...(f.specSwap ? [f.specSwap.skill] : []));
  return [...new Set(ids)];
}

/** The skills of a druid shape for this hero (a specialization may swap one in). */
export function formSkills(c: Character, f: FormDef): [string, string] {
  const s: [string, string] = [...f.skills];
  if (f.specSwap && c.spec === f.specSwap.tree && c.level >= SPEC_LEVEL) s[f.specSwap.slot] = f.specSwap.skill;
  return s;
}

/**
 * The basic attack has room to breathe, and the skills carry the fight (the owner: "my mage has a machine gun basic
 * skill ... i can just spam this non stop, it needs to have a bit of breathing space, this counts for all classes,
 * abilities should be more meaningful"). Every basic attack (each shape's too) comes at least BASIC_SLOW times slower
 * and never more often than every BASIC_MIN seconds, so the quickest (a mage's bolt, a ranger's arrow) slow the most
 * and the already slow (a priest's Smite) only a little. Each hit grows with that, so a basic attack keeps BASIC_KEEP of
 * the damage a second it had; what a hit gives back (rage, mana, focus; not Zeal, whole points a strike) grows with it
 * too. Every other skill that deals damage hits SKILL_WEIGHT times harder.
 */
export const BASIC_SLOW = 1.3;
export const BASIC_MIN = 0.75;
export const BASIC_KEEP = 0.85;
export const SKILL_WEIGHT = 1.25;
/** How much slower a basic attack of this cooldown comes now (and so how much harder each of its hits lands, before BASIC_KEEP). */
export const basicSlow = (cooldown: number): number => Math.max(cooldown * BASIC_SLOW, BASIC_MIN) / Math.max(0.01, cooldown);
function paceBasics(def: (typeof CLASSES)[keyof typeof CLASSES], skills: Record<string, ResolvedSkill>): void {
  const basics = new Set([def.basic, ...(def.forms ?? []).map((f) => f.basic)]);
  const dodges = new Set([def.dodge, ...(def.forms ?? []).map((f) => f.dodge)]);
  const whole = def.resource?.kind === 'holy';
  for (const [id, r] of Object.entries(skills)) {
    const s = r.spec;
    if (basics.has(id)) {
      const k = basicSlow(s.cooldown);
      s.cooldown *= k;
      s.damage *= k * BASIC_KEEP;
      if (!whole) s.gen *= k;
      if (s.extra.manaOnHit) s.extra.manaOnHit *= k;
    } else if (!dodges.has(id) && s.damage > 0) s.damage *= SKILL_WEIGHT;
  }
}

/**
 * The whole build. In a druid shape (`formId`), the basic attack and dodge are the shape's, the slot
 * with the shape's skill keeps it (to change back) and the other two slots hold the shape's skills.
 */
export function buildHero(c: Character, formId: string | null = null): HeroBuild {
  const mods = collectMods(c);
  const def = CLASSES[c.cls];
  const form = (formId && def.forms?.find((f) => f.id === formId)) || null;
  const bar: Record<SlotKey, string | null> = {
    basic: def.basic,
    // a slot works from its level (SLOT_LEVELS); a skill left in one that has not opened yet waits there
    s1: slotOpen(c, 0) ? c.skills[0] : null,
    s2: slotOpen(c, 1) ? c.skills[1] : null,
    s3: slotOpen(c, 2) ? c.skills[2] : null,
    s4: slotOpen(c, 3) ? c.skills[3] : null,
    ult: hasUltimate(c) ? heroUlt(c) : null,
    dodge: def.dodge,
  };
  if (form) {
    bar.basic = form.basic;
    bar.dodge = form.dodge;
    const extra = formSkills(c, form);
    let k = 0;
    for (const slot of SKILL_SLOTS) if (bar[slot] !== form.skill) bar[slot] = extra[k++] ?? null;
  }
  const skills: Record<string, ResolvedSkill> = {};
  for (const id of classSkillIds(c)) if (SKILLS[id]) skills[id] = resolveSkill(c, id, mods);
  paceBasics(def, skills);
  const res = def.resource ?? null;
  const maxMana = res ? Math.round(res.base + res.perLevel * (c.level - 1)) : 0;
  const base = heroStats(c, mods);
  if (form) {
    for (const [k, v] of Object.entries(form.stats)) base.stats[k as StatKey] += v ?? 0;
    base.stats.crit = Math.min(75, base.stats.crit);
    base.stats.speed = Math.min(50, base.stats.speed);
    if (form.hpPct) base.maxHp = Math.round(base.maxHp * (1 + form.hpPct / 100));
  }
  const spec = c.spec !== null && c.level >= SPEC_LEVEL ? def.trees[c.spec] : null;
  // (the points are shown and kept only while something on the bar builds them, or something gives them)
  const procs = heroProcs(mods);
  const builds = Object.values(bar).some((id) => !!id && (skills[id]?.spec.build ?? 0) > 0) || procs.some((p) => p.effect.kind === 'points');
  return { ...base, resource: res, maxMana, form, bar, skills, procs, points: spec?.points && builds ? spec.points : null };
}

/** The ultimate a hero carries: their specialization's own once they have one (SpecDef.ult), else the class's. */
export function heroUlt(c: Character): string {
  const def = CLASSES[c.cls];
  const spec = c.spec !== null && c.level >= SPEC_LEVEL ? def.trees[c.spec] : null;
  return spec?.ult ?? def.ult;
}

/** Damage multiplier of a stat block for a damage type (power + that element). */
export const typeBonus = (stats: Partial<Record<StatKey, number>>, type: StatKey): number => 1 + ((stats.power ?? 0) + (stats[type] ?? 0)) / 100;

export { emptyStats };
