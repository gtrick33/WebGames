import { CLASSES } from '../data/classes';
import { CLASS_ELEMENTS, STAT_ROLL } from '../data/items';
import { SKILLS } from '../data/skills';
import type { DmgType, Item, StatKey } from '../data/types';
import { RARITIES } from '../data/types';
import { itemMods, itemSlot, itemStats } from './items';
import type { Character } from './character';

/**
 * Is a piece better for this hero, as they play? (the owner, 2026-11-20: on a phone, a piece worth wearing should ask to
 * be worn, and the asking should know a tank from a healer from a fire mage.) Every stat is measured against what a
 * roll of it is worth at that item level (data/items.ts STAT_ROLL), so a point of crit and twenty of health are
 * weighed fairly, then by what the hero's specialization wants of it: a tank its armor and health, a healer its healing
 * and haste, a striker its power, its crits and its own elements. Before a specialization is chosen, the class's
 * elements all count, and the rest as a striker's. Rules only: ui/EquipAsk.tsx asks, ui/Panels.tsx marks the bag.
 */
export type GearRole = 'tank' | 'healer' | 'damage';

/** What a specialization is for, read from its own words (data/kits: "Tank: holds the line", "Shields and atonement"). */
export function gearRole(c: Pick<Character, 'cls' | 'spec'>): GearRole {
  if (c.spec === null) return 'damage';
  const role = CLASSES[c.cls].trees[c.spec].role.toLowerCase();
  if (/\btank\b|toughest/.test(role)) return 'tank';
  if (/heal|atonement/.test(role) && !/damage/.test(role)) return 'healer';
  return 'damage';
}

/** Does this specialization fight beside a companion of its own (a pet, demons, the dead)? */
const keepsCompanions = (c: Pick<Character, 'cls' | 'spec'>): boolean => c.spec !== null && /companion|demons|dead|ashbound/i.test(CLASSES[c.cls].trees[c.spec].role);

/** The elements a hero's damage is dealt in: their specialization's ability's and their basic attack's, or all the class's. */
export function heroElements(c: Pick<Character, 'cls' | 'spec'>): Set<StatKey> {
  const cls = CLASSES[c.cls];
  if (c.spec === null) return new Set(CLASS_ELEMENTS[c.cls]);
  const out = new Set<StatKey>();
  const add = (id: string | undefined): void => {
    const t = id ? SKILLS[id]?.base.dmgType : undefined;
    if (t) out.add(t as DmgType);
  };
  add(cls.trees[c.spec].skill);
  add(cls.basic);
  if (!out.size) for (const e of CLASS_ELEMENTS[c.cls]) out.add(e);
  return out;
}

const BASE_WEIGHTS: Record<GearRole, Partial<Record<StatKey, number>>> = {
  damage: { power: 1, crit: 0.9, critDmg: 0.6, haste: 0.8, hp: 0.25, hpPct: 0.35, armor: 0.25, speed: 0.3, regen: 0.2, ultCharge: 0.45, potion: 0.15, healing: 0.05 },
  tank: { armor: 1, hpPct: 1, hp: 0.85, regen: 0.6, power: 0.55, haste: 0.45, crit: 0.35, critDmg: 0.2, speed: 0.3, ultCharge: 0.45, potion: 0.35, healing: 0.1 },
  healer: { healing: 1, haste: 0.9, power: 0.55, crit: 0.6, critDmg: 0.3, hp: 0.35, hpPct: 0.45, armor: 0.3, regen: 0.4, speed: 0.3, ultCharge: 0.5, potion: 0.15 },
};

/** How much one roll of each stat is worth to this hero (1: a roll of what they want most). */
export function statWeights(c: Pick<Character, 'cls' | 'spec'>): Partial<Record<StatKey, number>> {
  const role = gearRole(c);
  const w: Partial<Record<StatKey, number>> = { ...BASE_WEIGHTS[role] };
  const mine = heroElements(c);
  const own = role === 'tank' ? 0.5 : role === 'healer' ? 0.35 : 0.85;
  for (const e of new Set<StatKey>([...CLASS_ELEMENTS[c.cls], 'physical', 'fire', 'frost', 'lightning', 'poison', 'arcane', 'shadow', 'holy', 'nature'])) w[e] = mine.has(e) ? own : 0.05;
  w.pet = keepsCompanions(c) ? 0.8 : 0.05;
  return w;
}

/** A roll of `stat` at item level `il`, the measure each stat is taken against. */
const rollAt = (stat: StatKey, il: number): number => {
  const r = STAT_ROLL[stat];
  return r ? Math.max(0.5, r.base + r.per * il) : 1;
};

/** A piece's worth to this hero: its stats weighed (above), and what it does besides (a skill changed, a set's power). */
export function gearValue(c: Pick<Character, 'cls' | 'spec'>, item: Item, at = item.il): number {
  const w = statWeights(c);
  let v = 0;
  for (const [s, n] of itemStats(item)) v += ((w[s] ?? 0.1) * n) / rollAt(s, at);
  // (a piece that changes how a skill works is worth more than a stat roll: an epic's or a legendary's power more still)
  v += itemMods(item).length * (0.9 + RARITIES.indexOf(item.r) * 0.25);
  return v;
}

export interface GearCompare {
  /** What it would take off (none: the slot is empty). */
  worn: Item | undefined;
  /** Better for this hero, by a margin worth the asking. */
  better: boolean;
  /** How much better (or worse), as a share of what is worn: 0.12 is 12% better. */
  gain: number;
  /** Each stat that changes, by how much (positive: gained), the ones that matter to this hero first. */
  deltas: { stat: StatKey; n: number; weight: number }[];
}

/** This piece against what the hero wears in its slot, weighed for how they play. */
export function compareGear(c: Pick<Character, 'cls' | 'spec' | 'equip'>, item: Item): GearCompare {
  const worn = c.equip[itemSlot(item)];
  const at = Math.max(item.il, worn?.il ?? 0);
  const mine = gearValue(c, item, at);
  const theirs = worn ? gearValue(c, worn, at) : 0;
  const gain = worn ? (mine - theirs) / Math.max(0.5, theirs) : 1;
  const w = statWeights(c);
  const sum = new Map<StatKey, number>();
  for (const [s, n] of itemStats(item)) sum.set(s, (sum.get(s) ?? 0) + n);
  if (worn) for (const [s, n] of itemStats(worn)) sum.set(s, (sum.get(s) ?? 0) - n);
  const deltas = [...sum]
    .filter(([, n]) => Math.abs(n) > 1e-6)
    .map(([stat, n]) => ({ stat, n: Math.round(n * 10) / 10, weight: w[stat] ?? 0.1 }))
    .sort((a, b) => b.weight - a.weight || Math.abs(b.n) - Math.abs(a.n));
  return { worn, better: !worn || gain > 0.04, gain, deltas };
}

