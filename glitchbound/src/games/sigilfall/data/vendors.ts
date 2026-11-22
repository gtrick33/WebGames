import type { SlotId } from './types';

/**
 * Shops: what each vendor sells. Gear shops roll their stock for your class and level (see
 * progress/shop.ts); it changes when you level up or come back from an expedition.
 */

export type ShopId = 'inn' | 'weapons' | 'armor' | 'curios' | 'quartermaster';

export interface ShopDef {
  id: ShopId;
  name: string;
  /** One line under the name. */
  blurb: string;
  /** Gear shops: the slots they stock. */
  slots?: SlotId[];
}

export const SHOPS: Record<ShopId, ShopDef> = {
  inn: { id: 'inn', name: 'The Ember Hearth', blurb: 'Healing potions for the road.' },
  weapons: { id: 'weapons', name: 'Brannoc’s Forge', blurb: 'Weapons and off-hands for your class, at your level.', slots: ['weapon', 'offhand'] },
  armor: { id: 'armor', name: 'Odo’s Armory', blurb: 'Helms, armor, legwear, gloves and boots.', slots: ['head', 'chest', 'legs', 'hands', 'feet'] },
  curios: { id: 'curios', name: 'Wren’s Curios', blurb: 'Amulets, rings and relics.', slots: ['amulet', 'ring', 'relic'] },
  quartermaster: {
    id: 'quartermaster',
    name: 'The Sigil Quartermaster',
    blurb: 'Epic and legendary gear at the highest item level, for Sigil Marks. Bosses pay them out; the Riftstone pays more.',
  },
};

/** Sigil Marks a boss pays on Normal (×2 on Heroic, ×3 on Mythic). */
export const BOSS_MARKS: Record<string, number> = {
  grimtusk: 1,
  ossric: 2,
  morgrave: 4,
  hangman: 2,
  varric: 3,
  'the-drowned': 2,
  saltbeard: 3,
  'brother-pustule': 2,
  'the-rot-mother': 3,
  'slag-colossus': 2,
  'forgemaster-grold': 3,
  'king-hrodric': 2,
  'sir-corvane': 4,
  'the-sand-warden': 2,
  'the-sun-king': 4,
  'jarl-hrimfang': 2,
  'the-rime-wyrm': 4,
  'the-siege-breaker': 3,
  'general-morvain': 5,
  'hollow-guard': 4,
  vaelor: 10,
};

/**
 * The share of coin the road pays out against what it used to: coins from foes and chests, the purse a foe leaves in
 * place of a piece of gear, the gold a quest pays, what a piece melts down or sells for, and a potion a full belt has no
 * room for. The owner (2026-11-15): "gold currently is meaningless, either drop way less, or adjust prices, i say drop
 * less, ive got 50k gold and i have no idea what to use them for". What things cost stays as it was (the vendors'
 * gear, the quartermaster, potions, a respec), so a purchase is a choice again.
 */
export const GOLD_FIND = 0.25;

/** The quartermaster's prices, by rarity. */
export const QM_PRICE = { epic: { marks: 6, gold: 400 }, legendary: { marks: 16, gold: 1200 } } as const;

/** The level a hero needs to buy from the quartermaster. */
export const QM_LEVEL = 15;
/** How far above the hero's level the quartermaster's gear is made (progress/shop.ts qmLevel). */
export const QM_ABOVE = 5;
