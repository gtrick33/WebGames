import { pickWeighted, randInt } from '../core/math';
import { BASE_DEFS, BASES, CLASS_ELEMENTS, ITEM_DEFS, ITEMS, MINOR_MODS, RARE_SUFFIX, RARITY_MUL, RARITY_ROLLS, SLOT_STATS, STAT_ROLL, STAT_WORD } from '../data/items';
import type { ClassId, Item, ItemDef, ItemIcon, Mod, Rarity, SlotId, StatKey } from '../data/types';
import { RARITIES } from '../data/types';

/** Item helpers: what an item is, what it does, and how loot is rolled. Pure functions. */

export const isAuthored = (item: Item): boolean => !!ITEM_DEFS[item.base];
export const itemDef = (item: Item): ItemDef | undefined => ITEM_DEFS[item.base];

export function itemSlot(item: Item): SlotId {
  return ITEM_DEFS[item.base]?.slot ?? BASE_DEFS[item.base]?.slot ?? 'relic';
}
export function itemClass(item: Item): ClassId | undefined {
  return ITEM_DEFS[item.base]?.cls ?? BASE_DEFS[item.base]?.cls;
}
export function itemIcon(item: Item): ItemIcon {
  return ITEM_DEFS[item.base]?.icon ?? BASE_DEFS[item.base]?.icon ?? 'relic';
}
export function itemTint(item: Item): string {
  return ITEM_DEFS[item.base]?.tint ?? BASE_DEFS[item.base]?.tint ?? '#ccc';
}
export function itemName(item: Item): string {
  return ITEM_DEFS[item.base]?.name ?? item.n ?? BASE_DEFS[item.base]?.name ?? 'Unknown item';
}

const round1 = (v: number): number => Math.round(v * 10) / 10;
/** Stats where a decimal matters (health regeneration); everything else is a whole number. */
const fine = (k: StatKey): boolean => k === 'regen';
const tidy = (k: StatKey, v: number): number => (fine(k) ? round1(v) : Math.max(1, Math.round(v)));

/** An item's stats, in display order. */
export function itemStats(item: Item): [StatKey, number][] {
  const def = ITEM_DEFS[item.base];
  if (def) return def.stats.map((s) => [s.stat, tidy(s.stat, (s.base + s.per * item.il) * RARITY_MUL[def.rarity] * 0.85)]);
  const base = BASE_DEFS[item.base];
  const out: [StatKey, number][] = [];
  if (base?.implicit) out.push([base.implicit.stat, tidy(base.implicit.stat, (base.implicit.base + base.implicit.per * item.il) * RARITY_MUL[item.r])]);
  for (const [k, v] of item.st) {
    const i = out.findIndex(([s]) => s === k);
    if (i >= 0) out[i] = [k, tidy(k, out[i]![1] + v)];
    else out.push([k, v]);
  }
  return out;
}

/** What the item does besides stats. */
export function itemMods(item: Item): Mod[] {
  const def = ITEM_DEFS[item.base];
  if (def) return def.mods;
  if (item.sm !== undefined) {
    const m = MINOR_MODS[item.sm];
    if (m) return [{ t: 'skill', skill: m.skill, op: m.op }];
  }
  return [];
}

/** Whether a class can use the item. */
export const usableBy = (item: Item, cls: ClassId): boolean => {
  const c = itemClass(item);
  return !c || c === cls;
};

/** A rough worth used to sort the bag and to price salvage. */
export function itemScore(item: Item): number {
  const rank = RARITIES.indexOf(item.r);
  return item.il * 10 + rank * 25 + itemStats(item).length * 3 + itemMods(item).length * 15;
}

export const salvageValue = (item: Item): number => Math.round((4 + item.il * 2) * [1, 1.6, 3, 6, 12][RARITIES.indexOf(item.r)]!);

/* -------------------------------------------------------------- generation */

export type LootSource = 'enemy' | 'elite' | 'boss' | 'chest-common' | 'chest-rare' | 'chest-epic' | 'quest';

const RARITY_WEIGHTS: Record<LootSource, number[]> = {
  //            common uncommon rare epic legendary
  enemy: [58, 30, 10, 1.8, 0.2],
  elite: [0, 25, 55, 17, 3],
  boss: [0, 0, 45, 45, 10],
  'chest-common': [30, 45, 22, 3, 0],
  'chest-rare': [0, 30, 50, 18, 2],
  'chest-epic': [0, 0, 20, 70, 10],
  quest: [0, 40, 50, 10, 0],
};

/** Picks a rarity; higher difficulty tiers move the odds up. */
export function rollRarity(source: LootSource, tier: number, r: () => number): Rarity {
  const w = RARITY_WEIGHTS[source].map((v, i) => v * (i >= 2 ? 1 + tier * 0.6 : 1) * (i >= 3 ? 1 + tier * 0.5 : 1));
  return pickWeighted(RARITIES, (x) => w[RARITIES.indexOf(x)]!, r());
}

let uidCounter = 0;
/** A unique id for a new item (time + counter + random, so two devices never clash). */
export function newUid(r: () => number = Math.random): string {
  uidCounter = (uidCounter + 1) % 46656;
  return `${Date.now().toString(36)}${uidCounter.toString(36).padStart(3, '0')}${Math.floor(r() * 1296).toString(36).padStart(2, '0')}`;
}

/** A hand-made item at an item level. */
export function makeItem(defId: string, il: number, r: () => number = Math.random): Item | null {
  const def = ITEM_DEFS[defId];
  if (!def) return null;
  return { uid: newUid(r), base: def.id, r: def.rarity, il: Math.max(def.minLevel, Math.round(il)), st: [], fresh: true };
}

/** Rolls one generated stat value. */
function rollStat(stat: StatKey, il: number, rarity: Rarity, r: () => number): number {
  const roll = STAT_ROLL[stat];
  let v = (roll.base + roll.per * il) * RARITY_MUL[rarity] * (0.8 + r() * 0.4);
  if (roll.max) v = Math.min(roll.max, v);
  return tidy(stat, v);
}

/** Generated gear for a class at an item level (common to rare). */
export function rollGear(cls: ClassId, il: number, rarity: Rarity, r: () => number, slot?: SlotId): Item {
  const bases = BASES.filter((b) => (!b.cls || b.cls === cls) && (!slot || b.slot === slot));
  const base = bases[Math.floor(r() * bases.length)] ?? BASES[0]!;
  const pool = SLOT_STATS[base.slot].map((s) => ((s as string) === 'element' ? CLASS_ELEMENTS[cls][Math.floor(r() * CLASS_ELEMENTS[cls].length)]! : s));
  const unique = [...new Set(pool)];
  const n = Math.min(RARITY_ROLLS[rarity], unique.length);
  const picked: StatKey[] = [];
  while (picked.length < n) {
    const s = unique[Math.floor(r() * unique.length)]!;
    if (!picked.includes(s)) picked.push(s);
  }
  const st: [StatKey, number][] = picked.map((s) => [s, rollStat(s, il, rarity, r)]);
  const item: Item = { uid: newUid(r), base: base.id, r: rarity, il, st, fresh: true };
  if (rarity === 'rare') {
    const options = MINOR_MODS.map((m, i) => ({ m, i })).filter((x) => x.m.cls === cls);
    if (options.length) item.sm = options[Math.floor(r() * options.length)]!.i;
  }
  const top = [...st].sort((a, b) => b[1] / (STAT_ROLL[b[0]].base + STAT_ROLL[b[0]].per * il) - a[1] / (STAT_ROLL[a[0]].base + STAT_ROLL[a[0]].per * il))[0];
  const word = top ? STAT_WORD[top[0]] : '';
  item.n = [word, base.name].filter(Boolean).join(' ') + (rarity === 'rare' ? ` ${RARE_SUFFIX[Math.floor(r() * RARE_SUFFIX.length)]}` : '');
  return item;
}

/** Hand-made items that can drop at this level for this class (never quest or boss specials). */
export function droppable(cls: ClassId, il: number, rarity: Rarity): ItemDef[] {
  return ITEMS.filter((d) => d.rarity === rarity && !d.special && d.minLevel <= il && (!d.cls || d.cls === cls));
}

/** One random item for a class: generated gear up to rare, hand-made items at epic and legendary. */
export function rollLoot(cls: ClassId, il: number, source: LootSource, tier: number, r: () => number): Item {
  let rarity = rollRarity(source, tier, r);
  if (rarity === 'epic' || rarity === 'legendary' || rarity === 'uncommon') {
    // Uncommon can also be a hand-made helper item (Mender's Charm); epic/legendary always are.
    const pool = droppable(cls, il, rarity);
    if (pool.length && (rarity !== 'uncommon' || r() < 0.08)) return makeItem(pool[Math.floor(r() * pool.length)]!.id, il, r)!;
    if (rarity === 'legendary') {
      const epics = droppable(cls, il, 'epic');
      if (epics.length) return makeItem(epics[Math.floor(r() * epics.length)]!.id, il, r)!;
    }
    if (rarity !== 'uncommon') rarity = 'rare';
  }
  return rollGear(cls, il, rarity, r);
}

/** Gold dropped by an enemy. */
export const goldDrop = (range: [number, number], level: number, r: () => number): number => Math.round(randInt(r, range[0], range[1]) * (1 + 0.2 * (level - 1)));
