import { rng } from '../core/math';
import { MAX_LEVEL } from '../data/classes';
import { ITEMS } from '../data/items';
import type { Item, Rarity } from '../data/types';
import { QM_LEVEL, QM_PRICE, SHOPS, type ShopId } from '../data/vendors';
import { addItem, bagFull, POTION_CAP, type Character } from './character';
import { makeItem, rollGear, salvageValue, usableBy } from './items';

/**
 * Vendors. Stock is rolled from the hero, their level and how many times shops have restocked (every
 * expedition), so it is the same every time you look until it changes; bought pieces stay sold.
 */

export interface Price {
  gold: number;
  marks: number;
}

export interface ShopItem {
  item: Item;
  price: Price;
}

/** What one healing potion costs at a level. */
export const potionPrice = (level: number): number => 6 + level * 3;

/** What a vendor pays for an item (the same as salvaging it). */
export const sellPrice = (item: Item): number => salvageValue(item);

/** What a vendor asks for generated gear. */
export const gearPrice = (item: Item): number => Math.max(12, Math.round(salvageValue(item) * 4));

function seedOf(c: Character, shop: ShopId): number {
  const key = `${c.created}:${c.cls}:${shop}:${c.level}:${c.restock}`;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return h >>> 0;
}

const GEAR_RARITIES: Rarity[] = ['common', 'common', 'uncommon', 'uncommon', 'rare', 'rare'];

/** Everything a vendor has for this hero right now (sold pieces left out). */
export function stockFor(c: Character, shop: ShopId): ShopItem[] {
  const def = SHOPS[shop];
  const r = rng(seedOf(c, shop));
  const out: ShopItem[] = [];
  if (shop === 'quartermaster') {
    for (const d of ITEMS) {
      if (d.special || (d.rarity !== 'epic' && d.rarity !== 'legendary')) continue;
      const item = makeItem(d.id, MAX_LEVEL, r)!;
      if (!usableBy(item, c.cls)) continue;
      out.push({ item, price: { gold: QM_PRICE[d.rarity].gold, marks: QM_PRICE[d.rarity].marks } });
    }
  } else if (def.slots) {
    GEAR_RARITIES.forEach((rarity, i) => {
      const slot = def.slots![i % def.slots!.length]!;
      const item = rollGear(c.cls, c.level, rarity, r, slot);
      out.push({ item, price: { gold: gearPrice(item), marks: 0 } });
    });
  }
  // stable ids (item ids are otherwise time-based): the same stock keeps the same ids until it changes
  const seed = seedOf(c, shop).toString(36);
  out.forEach((s, i) => (s.item.uid = `v${seed}${i.toString(36)}`));
  return out.filter((s) => !c.sold.includes(s.item.uid));
}

/** Why the hero can't buy this right now, or null. */
export function cantBuy(c: Character, shop: ShopId, s: ShopItem): string | null {
  if (shop === 'quartermaster' && c.level < QM_LEVEL) return `Reach level ${QM_LEVEL} first`;
  if (c.gold < s.price.gold) return 'Not enough gold';
  if (c.marks < s.price.marks) return 'Not enough Sigil Marks';
  if (bagFull(c)) return 'Your bag is full';
  return null;
}

/** Buys a piece of stock into the bag. Returns the item, or null when it can't be bought. */
export function buyItem(c: Character, shop: ShopId, uid: string): Item | null {
  const s = stockFor(c, shop).find((x) => x.item.uid === uid);
  if (!s || cantBuy(c, shop, s)) return null;
  const item: Item = { ...s.item, fresh: true };
  if (!addItem(c, item)) return null;
  c.gold -= s.price.gold;
  c.marks -= s.price.marks;
  c.sold.push(item.uid);
  return item;
}

/** Buys up to `n` potions (as many as the gold and the cap allow). Returns how many were bought. */
export function buyPotions(c: Character, n: number): number {
  const price = potionPrice(c.level);
  const can = Math.min(n, POTION_CAP - c.potions, Math.floor(c.gold / price));
  if (can <= 0) return 0;
  c.potions += can;
  c.gold -= can * price;
  return can;
}

/** New stock everywhere (an expedition ended). */
export function restock(c: Character): void {
  c.restock += 1;
  c.sold = [];
}
