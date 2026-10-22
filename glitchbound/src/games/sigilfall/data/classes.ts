import { DRUID } from './kits/druid';
import { stats, type Kit } from './kits/kit';
import { MAGE } from './kits/mage';
import { PALADIN } from './kits/paladin';
import { PRIEST } from './kits/priest';
import { RANGER } from './kits/ranger';
import { WARLOCK } from './kits/warlock';
import { WARRIOR } from './kits/warrior';
import type { ClassDef, ClassId, Stats } from './types';

/** Every class's kit (definition, skills, talents), in the order the class list shows them. */
export const KITS: Record<ClassId, Kit> = { warrior: WARRIOR, mage: MAGE, ranger: RANGER, paladin: PALADIN, priest: PRIEST, warlock: WARLOCK, druid: DRUID };

export const CLASSES: Record<ClassId, ClassDef> = Object.fromEntries(Object.entries(KITS).map(([id, k]) => [id, k.def])) as Record<ClassId, ClassDef>;

export const CLASS_IDS = Object.keys(KITS) as ClassId[];
export const emptyStats = (): Stats => stats({ crit: 0, critDmg: 0 });
export { stats as baseStats };

/**
 * Experience to go from `level` to the next one. Steep, like the classic MMOs: a level takes minutes at
 * first and the better part of an hour near the top.
 */
export const xpToNext = (level: number): number => Math.floor(40 * level ** 1.55 + 20);
export const MAX_LEVEL = 60;

/** Damage multiplier from character level alone. */
export const levelPower = (level: number): number => 1 + 0.12 * (level - 1);
