import type { HeroLook } from '../render/art/hero';

/**
 * The head a hero wears under no helmet: by the hair style they chose, a woman's or a man's, and with a beard the
 * bearded head of that same style (Body and Face in progress/character.ts). Used by the world and the portraits alike.
 */
const MAN = { short: 'Ranger_Head', pony: 'Rogue_Head', long: 'Mage_Head' } as const;
const WOMAN = { short: 'Witch_Head', pony: 'Helper_A_Head', long: 'Rogue_Head' } as const;
const BEARDED = { short: 'Hiker_Head', pony: 'Engineer_Head', long: 'Farmer_A_Head' } as const;

export function headOf(look: Pick<HeroLook, 'hairStyle' | 'female' | 'beard'>, bald: boolean): string {
  if (bald) return 'Knight_Head';
  if (look.beard && !look.female) return BEARDED[look.hairStyle];
  return (look.female ? WOMAN : MAN)[look.hairStyle];
}

/** Whether the head's hair is painted as metal in the pack (long hair and beards are): it takes the hair color too. */
export const hairIsMetal = (look: Pick<HeroLook, 'hairStyle' | 'female' | 'beard'>): boolean => look.hairStyle === 'long' || !!look.female || (!!look.beard && !look.female);
