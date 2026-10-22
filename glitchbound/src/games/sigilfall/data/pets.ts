import type { DmgType } from './types';

/**
 * Companions a hero can call: the warlock's demons, the ranger's wolf, the druid's treants. A pet
 * fights the hero's enemies, follows when there are none, and can be hit (taunting pets are what
 * enemies go for first). Its numbers are shares of the hero's, so it grows with them.
 */
export interface PetDef {
  id: string;
  name: string;
  /** Creature art (CREATURE_ART) and a color swap over it. */
  sprite: string;
  pal?: Record<string, string>;
  /** Health as a share of the hero's maximum. */
  hp: number;
  /** Damage per attack as a share of the class's reference damage (then the hero's multipliers apply). */
  dmg: number;
  dmgType: DmgType;
  speed: number;
  radius: number;
  /** Melee reach, or the range a ranged pet shoots from. */
  reach: number;
  ranged: boolean;
  /** Seconds between attacks. */
  attackCd: number;
  /** Enemies near it attack it instead of the hero. */
  taunt: boolean;
  /** Look of a ranged pet's shots. */
  shot?: string;
}

export const PETS: Record<string, PetDef> = {
  imp: { id: 'imp', name: 'Imp', sprite: 'imp', hp: 0.35, dmg: 0.55, dmgType: 'fire', speed: 80, radius: 4, reach: 110, ranged: true, attackCd: 1.4, taunt: false, shot: 'firebolt' },
  voidwalker: { id: 'voidwalker', name: 'Voidwalker', sprite: 'voidwalker', hp: 0.9, dmg: 0.35, dmgType: 'shadow', speed: 70, radius: 7, reach: 18, ranged: false, attackCd: 1.2, taunt: true },
  felguard: { id: 'felguard', name: 'Felguard', sprite: 'felguard', hp: 0.75, dmg: 0.95, dmgType: 'physical', speed: 82, radius: 7, reach: 20, ranged: false, attackCd: 1.1, taunt: true },
  infernal: { id: 'infernal', name: 'Infernal', sprite: 'infernal', hp: 1.2, dmg: 1.1, dmgType: 'fire', speed: 70, radius: 9, reach: 22, ranged: false, attackCd: 1.1, taunt: true },
  wolf: { id: 'wolf', name: 'Wolf', sprite: 'wolf', hp: 0.6, dmg: 0.45, dmgType: 'physical', speed: 105, radius: 6, reach: 16, ranged: false, attackCd: 0.9, taunt: true },
  treant: { id: 'treant', name: 'Treant', sprite: 'treant', hp: 0.3, dmg: 0.35, dmgType: 'nature', speed: 75, radius: 6, reach: 16, ranged: false, attackCd: 1.1, taunt: true },
};

