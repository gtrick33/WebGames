import { MAX_LEVEL } from '../data/classes';
import { keyCache, keyLoot, keyMarks, MAX_IL } from '../data/keystones';
import { RIFT_TIERS, riftPool, SETS } from '../data/riftgear';
import { SLOTS, type Item, type ItemDef, type Rarity, type SlotId } from '../data/types';
import { RIFT_CAP_UNFINISHED } from '../data/wardens';
import { addItem, bagFull, type Character } from './character';
import { droppable, makeItem, rollGear } from './items';

/**
 * What the Rift gives, past its loot table: a Rift-forged piece for every new stone a hero opens, and the
 * Riftbroker's wagers. The Rift guide in the game (ui/RiftGuide.tsx) says all of it from the numbers here.
 */

/** Rift-forged gear is made for a hero at the top level: before it, the Rift gives levels and ordinary gear. */
export const FORGED_LEVEL = MAX_LEVEL;

/**
 * The Rift-forged pieces a hero has none of (worn or in the bag), in the order the stones give them: the class's set
 * and anyone's legendaries as they open, then the class's legendaries, then the specializations' sets, the hero's own
 * first. At most `n` (three a run, for a run fast enough to open three stones).
 */
export function riftFirsts(c: Pick<Character, 'cls' | 'bag' | 'equip' | 'level' | 'spec'>, stone: number, n: number): ItemDef[] {
  if (n <= 0 || c.level < FORGED_LEVEL) return [];
  const held = new Set([...c.bag, ...Object.values(c.equip)].flatMap((i) => (i ? [i.base] : [])));
  return riftPool(c.cls, stone)
    .filter((d) => !held.has(d.id))
    .sort((a, b) => (a.rift ?? 0) - (b.rift ?? 0) || Number(b.forSpec === c.spec) - Number(a.forSpec === c.spec))
    .slice(0, Math.min(n, 3));
}

/* ------------------------------------------------------------------ the Riftbroker */

/** What one wager costs, in Sigil Marks. */
export const WAGER_PRICE = 8;
/** The slots a wager can be made on. */
export const WAGER_SLOTS: readonly SlotId[] = SLOTS;

/**
 * A wager's odds at a stone: a legendary or a set piece likelier with every stone opened (the owner, 2026-11-22: "sigil
 * shop should drop legendaries more often and set gear a bit more often as well"). Legendary from 24% to 38%, a set
 * piece from 12% to 20%, the rest epic: no rare from the broker any more.
 */
export function wagerOdds(stone: number): Record<'rare' | 'epic' | 'legendary' | 'set', number> {
  const s = Math.max(0, stone);
  // (a little less since 2026-11-23, "a tad bit too high": legendary 30-45%, a set piece 15-25%, before)
  const legendary = Math.min(0.38, 0.24 + s * 0.01);
  const set = Math.min(0.2, 0.12 + s * 0.005);
  return { legendary, set, epic: 1 - legendary - set, rare: 0 };
}

/** Why the hero can't wager right now, or null. */
export function cantWager(c: Character): string | null {
  if (c.level < FORGED_LEVEL) return `The Riftbroker deals with level-${FORGED_LEVEL} heroes`;
  if (c.keystone < 1) return 'Clear a dungeon first: the broker wants to see a Riftstone';
  if (c.marks < WAGER_PRICE) return `${WAGER_PRICE} Sigil Marks a wager`;
  if (bagFull(c)) return 'Your bag is full';
  return null;
}

/**
 * A wager: Sigil Marks for an unseen piece for one slot, made at the item level of the hero's highest stone. It may
 * be anything that slot can be, a Rift-forged piece the stone has opened among them; a slot with nothing legendary
 * (or epic) for this class gives the next best.
 */
export function wager(c: Character, slot: SlotId, r: () => number = Math.random): Item | null {
  if (cantWager(c)) return null;
  const il = keyLoot(c.keystone, c.level);
  const odds = wagerOdds(c.keystone);
  const roll = r();
  // (a slot with no set piece gives a legendary in its place; one with nothing legendary, an epic; then a rare)
  let rarity: Rarity = roll < odds.set ? 'set' : roll < odds.set + odds.legendary ? 'legendary' : roll < odds.set + odds.legendary + odds.epic ? 'epic' : 'rare';
  let item: Item | null = null;
  for (const want of ['set', 'legendary', 'epic'] as const) {
    if (rarity !== want) continue;
    const pool = droppable(c.cls, il, want, c.keystone).filter((d) => d.slot === slot);
    if (pool.length) item = makeItem(pool[Math.floor(r() * pool.length)]!.id, il, r);
    else rarity = want === 'set' ? 'legendary' : want === 'legendary' ? 'epic' : 'rare';
  }
  item ??= rollGear(c.cls, il, 'rare', r, slot);
  if (!addItem(c, item)) return null;
  c.marks -= WAGER_PRICE;
  return item;
}

/* ------------------------------------------------------------------ what each stone gives, for the guide */

export interface StoneRow {
  stone: number;
  /** Item level of everything a run at this stone drops. */
  il: number;
  /** Pieces in the cache for a run in time, and Sigil Marks (in time, and late). */
  cache: number;
  marks: number;
  late: number;
  /** What this stone opens that the one before it didn't. */
  opens: string[];
}

/** The stones worth a line in the guide: the first, each one that opens something, and the last that still raises the item level. */
export function stoneRows(cls: Character['cls'], finished: boolean): StoneRow[] {
  const set = Object.values(SETS).find((s) => s.cls === cls && s.spec === undefined);
  const opens = (stone: number): string[] => {
    const out: string[] = [];
    if (stone === RIFT_TIERS.classSet) out.push(`${set?.name ?? 'Your set'}: six pieces, and legendaries any hero can wear`);
    if (stone === RIFT_TIERS.classLegendary) out.push('Your class’s own legendaries');
    if (stone === RIFT_TIERS.specSet) out.push('A set for each of your specializations, six pieces each, and their own legendaries');
    if (stone === RIFT_CAP_UNFINISHED + 1 && !finished) out.push('Asks for the story’s end: stones go no higher until you have finished it');
    return out;
  };
  const top = MAX_IL - keyLoot(0);
  const stones = [...new Set([1, RIFT_TIERS.classLegendary, RIFT_TIERS.specSet, 10, RIFT_CAP_UNFINISHED + 1, 15, 20, top])].sort((a, b) => a - b);
  return stones.map((stone) => ({ stone, il: keyLoot(stone), cache: keyCache(stone), marks: keyMarks(stone, true), late: keyMarks(stone, false), opens: opens(stone) }));
}
