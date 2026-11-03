import type { Item, StatKey } from '../data/types';
import type { Character } from '../progress/character';
import { modLines } from '../progress/describe';
import { itemMods, itemSlot, itemStats } from '../progress/items';

/** What an inspected item is compared with: the piece worn in its slot (none for the worn piece itself or an empty slot). */
export function compareWith(h: Pick<Character, 'equip'>, item: Item, worn: boolean): Item | undefined {
  const cur = h.equip[itemSlot(item)];
  return !worn && cur && cur.uid !== item.uid ? cur : undefined;
}

export interface StatRow {
  k: StatKey;
  v: number;
  /** the change against the worn piece (0 when nothing is compared) */
  delta: number;
}

/** An item's stats with their change against `against`, then the stats only `against` has (lost if swapped). */
export function statRows(item: Item, against?: Item): { rows: StatRow[]; lost: [StatKey, number][] } {
  const stats = itemStats(item);
  const old = against ? new Map(itemStats(against)) : null;
  const rows = stats.map(([k, v]) => ({ k, v, delta: old ? v - (old.get(k) ?? 0) : 0 }));
  const lost = old ? [...old.entries()].filter(([k]) => !stats.some(([s]) => s === k)) : [];
  return { rows, lost };
}

/** The "changes how you fight" lines of `item` that `other` doesn't have (what a swap would give up). */
export function linesOnlyIn(item: Item, other: Item): string[] {
  const theirs = new Set(modLines(itemMods(other)));
  return modLines(itemMods(item)).filter((l) => !theirs.has(l));
}
