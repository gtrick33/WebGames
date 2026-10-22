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
    blurb: 'Epic and legendary gear at the highest item level, for Sigil Marks. Bosses pay them out; harder tiers pay more.',
  },
};

/** Sigil Marks a boss pays on Normal (×2 on Heroic, ×3 on Mythic). */
export const BOSS_MARKS: Record<string, number> = { grimtusk: 1, ossric: 2, morgrave: 4 };

/** The quartermaster's prices, by rarity. */
export const QM_PRICE = { epic: { marks: 6, gold: 400 }, legendary: { marks: 16, gold: 1200 } } as const;

/** The level a hero needs to buy from the quartermaster (the gear is made for the top level). */
export const QM_LEVEL = 15;
