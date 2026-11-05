import { GLOAMKNIGHT_ITEM } from '../../../catalog/shop';
import type { ClassId } from '../data/types';
import { BASE_HERO_SLOTS, HERO_SLOTS } from './save';

/**
 * Classes sold in the site's shop (src/catalog/shop.ts), and the item that unlocks each: the Gloamknight comes in the
 * Gloamknight Pack, with two more hero places and looks made for it. Every other class is free.
 * Whether a member may play one comes from their account's purchases each time it's asked, never from a save: a
 * refund locks the class again, and a hero of it is kept, waiting, until it's bought again.
 */
export const PAID_CLASSES: Partial<Record<ClassId, string>> = { gloamknight: GLOAMKNIGHT_ITEM };

/** Who is asking: the signed-in member (their purchases, and whether they're an admin), or no one (a guest). */
export interface Buyer {
  owned?: readonly string[];
  isAdmin?: boolean;
}

/** How many hero places this account plays: three, and all of them with the Gloamknight Pack (or for an admin). */
export const heroSlots = (me: Buyer | null | undefined): number => (me?.isAdmin || me?.owned?.includes(GLOAMKNIGHT_ITEM) ? HERO_SLOTS : BASE_HERO_SLOTS);

/** Whether this account may play the class: it's free, its purchase stands, or an admin is testing it. */
export function classOpen(cls: ClassId, me: Buyer | null | undefined): boolean {
  const item = PAID_CLASSES[cls];
  return !item || !!me?.isAdmin || !!me?.owned?.includes(item);
}
