import type { BuffDef, ClassDef, Effect, Empower, Mod, ProcDef, SkillDef, SkillOp, SkillSpec, StatKey, Stats, TalentNode } from '../types';

/**
 * Helpers for writing a class's kit (its definition, skills and talents) compactly. Every class lives
 * in its own file in this folder; classes.ts, skills.ts and talents.ts gather them.
 */

export interface Kit {
  def: ClassDef;
  skills: SkillDef[];
  talents: TalentNode[];
}

/** A full stat block from the few that differ. */
export const stats = (p: Partial<Stats>): Stats => ({
  hp: 0,
  hpPct: 0,
  power: 0,
  crit: 5,
  critDmg: 50,
  haste: 0,
  armor: 0,
  speed: 0,
  regen: 0,
  ultCharge: 0,
  potion: 0,
  physical: 0,
  fire: 0,
  frost: 0,
  lightning: 0,
  poison: 0,
  arcane: 0,
  shadow: 0,
  holy: 0,
  nature: 0,
  healing: 0,
  pet: 0,
  ...p,
});

/** A spec with neutral defaults, so each skill only lists what makes it itself. */
export function spec(p: Partial<SkillSpec> & Pick<SkillSpec, 'id' | 'cast'>): SkillSpec {
  return {
    aim: 'direction',
    range: 100,
    cooldown: 1,
    charges: 1,
    damage: 0,
    dmgType: 'physical',
    windup: 0,
    speed: 0,
    radius: 3,
    count: 1,
    spread: 0,
    pierce: 0,
    bounce: 0,
    area: 0,
    arc: 0,
    duration: 0,
    tick: 0,
    knock: 0,
    onHit: [],
    onImpact: [],
    onKill: [],
    onCast: [],
    bonusVs: [],
    extra: {},
    cost: 0,
    gen: 0,
    tags: [],
    ...p,
  };
}

/** A skill definition. */
export const skill = (cls: SkillDef['cls'], kind: SkillDef['kind'], unlock: number, name: string, blurb: string, base: SkillSpec): SkillDef => ({ id: base.id, name, cls, kind, unlock, blurb, base });

/* ------------------------------------------------------------- talents */

/** A stat modifier. */
export const S = (stat: StatKey, v: number, when?: 'lowHp' | 'afterDodge'): Mod => (when ? { t: 'stat', stat, v, when } : { t: 'stat', stat, v });
/** A skill modifier ('*' = every skill; 'basic', 'dodge', 'ult' = that slot). */
export const K = (skill: string, op: SkillOp): Mod => ({ t: 'skill', skill, op });
/** A proc. */
export const P = (proc: ProcDef): Mod => ({ t: 'proc', proc });
/** Shorthands for common skill ops. */
export const dmg = (skill: string, pct: number): Mod => K(skill, { op: 'damage', pct });
export const cdr = (skill: string, pct: number): Mod => K(skill, { op: 'cooldown', pct });
export const onHit = (skill: string, effect: Effect): Mod => K(skill, { op: 'onHit', effect });

/**
 * A talent: tree (0-2), row (0-6), column (0-3), id, name, ranks, icon, text, mods (per rank), and
 * optionally the talent it needs first.
 */
export function T(tree: 0 | 1 | 2, row: number, col: number, id: string, name: string, ranks: number, icon: string, text: string, mods: Mod[], requires?: string): TalentNode {
  return { id, name, tree, row, col, ranks, icon, text, mods, ...(requires ? { requires } : {}) };
}

/* ------------------------------------------------------------- combos */

/**
 * A specialization's combo (types.ts SpecDef.combo): the one thing its skills do together. Three kinds are written
 * with these: one skill setting up the next cast of another (`next`), charges built by small hits and spent by a
 * great one (`next` with a `max`), and a state that builds on the hero (`stack`). A fourth, a blow that sets off a
 * burn, a bleed or a curse, is the `detonate` effect.
 */
export const combo = (name: string, text: string, ...mods: Mod[]): { name: string; text: string; mods: Mod[] } => ({ name, text, mods });
/** The hero's next cast of `skill` is more than it is; with `max`, it builds a stack at a time and the cast takes them all. */
export const next = (id: string, name: string, color: string, skill: string, dur: number, how: Omit<Empower, 'skill'>, max?: number): BuffDef => ({ id: `combo-${id}`, name, dur, color, empower: { skill, ...how }, ...(max ? { max } : {}) });
/** A state on the hero that builds a stack at a time. */
export const stack = (id: string, name: string, color: string, dur: number, max: number, stats: Partial<Record<StatKey, number>>): BuffDef => ({ id: `combo-${id}`, name, dur, color, max, stats });
/** A combo's trigger. */
export const when = (id: string, on: ProcDef['on'], effect: Effect, text: string, o: Partial<Pick<ProcDef, 'skill' | 'status' | 'dmgType' | 'chance' | 'icd'>> = {}): Mod => P({ id: `combo-${id}`, on, chance: 1, icd: 0.15, ...o, effect, text });
