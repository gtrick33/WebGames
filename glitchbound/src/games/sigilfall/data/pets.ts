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
  /** A person (an NPC look id) rather than a creature: companions, villagers, a door. */
  look?: string;
  /**
   * What it does: fights (the default), stands still and draws attacks (a ward: a door, a gate), or
   * follows the hero and never fights (people being rescued).
   */
  role?: 'fighter' | 'ward' | 'follower';
  /** Doesn't take damage (rescued people are not a timer of their own). */
  unhurt?: boolean;
}

export const PETS: Record<string, PetDef> = {
  imp: { id: 'imp', name: 'Imp', sprite: 'imp', hp: 0.35, dmg: 0.55, dmgType: 'fire', speed: 80, radius: 4, reach: 110, ranged: true, attackCd: 1.4, taunt: false, shot: 'firebolt' },
  voidwalker: { id: 'voidwalker', name: 'Voidwalker', sprite: 'voidwalker', hp: 0.9, dmg: 0.35, dmgType: 'shadow', speed: 70, radius: 7, reach: 18, ranged: false, attackCd: 1.2, taunt: true },
  felguard: { id: 'felguard', name: 'Felguard', sprite: 'felguard', hp: 0.75, dmg: 0.95, dmgType: 'physical', speed: 82, radius: 7, reach: 20, ranged: false, attackCd: 1.1, taunt: true },
  infernal: { id: 'infernal', name: 'Infernal', sprite: 'infernal', hp: 1.2, dmg: 1.1, dmgType: 'fire', speed: 70, radius: 9, reach: 22, ranged: false, attackCd: 1.1, taunt: true },
  wolf: { id: 'wolf', name: 'Wolf', sprite: 'wolf', hp: 0.6, dmg: 0.45, dmgType: 'physical', speed: 105, radius: 6, reach: 16, ranged: false, attackCd: 0.9, taunt: true },
  // the Prologue's companions and the people and door they protect (story pets: STORY_BIBLE.md §2)
  mara: { id: 'mara', name: 'Mara Venn', sprite: 'villager', look: 'mara-venn', hp: 1.1, dmg: 0.45, dmgType: 'physical', speed: 84, radius: 6, reach: 20, ranged: false, attackCd: 1.0, taunt: true },
  elyra: { id: 'elyra', name: 'Elyra', sprite: 'villager', look: 'elyra', hp: 0.6, dmg: 0.5, dmgType: 'holy', speed: 78, radius: 5, reach: 120, ranged: true, attackCd: 1.3, taunt: false, shot: 'holy' },
  'briar-child': { id: 'briar-child', name: 'Bramble child', sprite: 'villager', look: 'briar-child', hp: 1, dmg: 0, dmgType: 'physical', speed: 92, radius: 4, reach: 0, ranged: false, attackCd: 9, taunt: false, role: 'follower', unhurt: true },
  'chapel-door': { id: 'chapel-door', name: 'The chapel door', sprite: 'villager', look: 'door', hp: 2.4, dmg: 0, dmgType: 'physical', speed: 0, radius: 9, reach: 0, ranged: false, attackCd: 9, taunt: true, role: 'ward' },
  // Act I: the Vale's people, who fight beside the hero, walk into the camp, or wait to be led home
  'fern-ranger': { id: 'fern-ranger', name: 'Fernstead ranger', sprite: 'villager', look: 'fern-ranger', hp: 0.6, dmg: 0.35, dmgType: 'physical', speed: 86, radius: 5, reach: 130, ranged: true, attackCd: 1.2, taunt: false, shot: 'arrow' },
  'mill-militia': { id: 'mill-militia', name: 'Millbrook militia', sprite: 'villager', look: 'mill-militia', hp: 0.8, dmg: 0.35, dmgType: 'physical', speed: 80, radius: 6, reach: 20, ranged: false, attackCd: 1.1, taunt: true },
  sefa: { id: 'sefa', name: 'Sefa', sprite: 'villager', look: 'sefa', hp: 0.8, dmg: 0.5, dmgType: 'physical', speed: 92, radius: 5, reach: 120, ranged: true, attackCd: 1.0, taunt: false, shot: 'arrow' },
  'mill-carter': { id: 'mill-carter', name: 'Millbrook carter', sprite: 'villager', look: 'mill-carter', hp: 1, dmg: 0, dmgType: 'physical', speed: 70, radius: 5, reach: 0, ranged: false, attackCd: 9, taunt: false, role: 'follower', unhurt: true },
  'reed-villager': { id: 'reed-villager', name: 'Reedwater villager', sprite: 'villager', look: 'reed-villager', hp: 1, dmg: 0, dmgType: 'physical', speed: 88, radius: 4, reach: 0, ranged: false, attackCd: 9, taunt: false, role: 'follower', unhurt: true },
  'reed-healer': { id: 'reed-healer', name: 'Reedwater healer', sprite: 'villager', look: 'reed-healer', hp: 1, dmg: 0, dmgType: 'physical', speed: 72, radius: 5, reach: 0, ranged: false, attackCd: 9, taunt: false, role: 'follower', unhurt: true },
  'gull-hand': { id: 'gull-hand', name: 'Gullport dockhand', sprite: 'villager', look: 'gull-hand', hp: 0.8, dmg: 0.4, dmgType: 'physical', speed: 80, radius: 6, reach: 20, ranged: false, attackCd: 1.1, taunt: true },
  'gull-smith': { id: 'gull-smith', name: 'Gullport smith', sprite: 'villager', look: 'gull-smith', hp: 1, dmg: 0, dmgType: 'physical', speed: 70, radius: 6, reach: 0, ranged: false, attackCd: 9, taunt: false, role: 'follower', unhurt: true },
  'hearth-rider': { id: 'hearth-rider', name: 'Hearthstead rider', sprite: 'villager', look: 'hearth-rider', hp: 0.9, dmg: 0.45, dmgType: 'physical', speed: 96, radius: 6, reach: 22, ranged: false, attackCd: 1.0, taunt: true },
  // what must not fall: a harvest stone being cleansed, a boat on its slip, a village gate
  'harvest-stone': { id: 'harvest-stone', name: 'The Harvest Stone', sprite: 'villager', look: 'stone', hp: 2, dmg: 0, dmgType: 'physical', speed: 0, radius: 8, reach: 0, ranged: false, attackCd: 9, taunt: true, role: 'ward' },
  'ines-boat': { id: 'ines-boat', name: 'The Patience', sprite: 'villager', look: 'boat', hp: 2.2, dmg: 0, dmgType: 'physical', speed: 0, radius: 12, reach: 0, ranged: false, attackCd: 9, taunt: true, role: 'ward' },
  'hearth-gate': { id: 'hearth-gate', name: 'Hearthstead’s gate', sprite: 'villager', look: 'gate', hp: 3, dmg: 0, dmgType: 'physical', speed: 0, radius: 14, reach: 0, ranged: false, attackCd: 9, taunt: true, role: 'ward' },
  treant: { id: 'treant', name: 'Treant', sprite: 'treant', hp: 0.3, dmg: 0.35, dmgType: 'nature', speed: 75, radius: 6, reach: 16, ranged: false, attackCd: 1.1, taunt: true },
};

