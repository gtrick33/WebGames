import { DRUID } from './kits/druid';
import { GLOAMKNIGHT } from './kits/gloamknight';
import { stats, type Kit } from './kits/kit';
import { MAGE } from './kits/mage';
import { PALADIN } from './kits/paladin';
import { PRIEST } from './kits/priest';
import { RANGER } from './kits/ranger';
import { WARLOCK } from './kits/warlock';
import { WARRIOR } from './kits/warrior';
import type { ClassDef, ClassId, Stats } from './types';

/** Every class's kit (definition, skills, talents), in the order the class list shows them. */
export const KITS: Record<ClassId, Kit> = { warrior: WARRIOR, mage: MAGE, ranger: RANGER, paladin: PALADIN, priest: PRIEST, warlock: WARLOCK, druid: DRUID, gloamknight: GLOAMKNIGHT };

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
/**
 * What every hero's blows come to, as a share of what their skill, level and gear make them. The owner after a
 * level 34 mage walked through the Tomb of the Sun King without drinking a potion (2026-11-15): "scale down the dmg
 * for every class this is insane, i want the game to feel hard af and be super rewarding when you beat a boss". Their
 * play-bot cleared a pack of three of the Sunscorch's mummies in 1.2 seconds. The same for every class and every
 * kind of blow (skills, damage over time, companions, thorns), so the classes and their trees stand to each other as
 * they did; the ultimate's charge is measured against it too, so it comes as often as it did.
 */
export const HERO_DAMAGE = 0.5;
/**
 * How far a level is into the harder game (HERO_DAMAGE here; BOSS_DAMAGE, MOB_DAMAGE and BOSS_HEALTH in sim/world.ts;
 * SPIKE in sim/ai.ts): none of it at level 4, where a new hero meets their first boss in what they were given, and all
 * of it from level 14. Measured with the play-bot first: the first dungeons already asked the most of it (a boss's blow
 * took a third of a mage's health in Gallows Keep and a fifth in the Tomb of the Sun King), and the first night is for
 * learning to fight.
 */
export const hardening = (level: number): number => Math.max(0, Math.min(1, (level - 4) / 10));
/** HERO_DAMAGE at a hero's level (hardening). */
export const heroDamage = (level: number): number => 1 - (1 - HERO_DAMAGE) * hardening(level);
