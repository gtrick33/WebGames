/**
 * Gut Check rules: two things side by side, the left one's number showing. Does the right one have
 * more or less? A right call slides the right card over and brings a new one; one wrong call ends the
 * run. Pure and seeded: the same seed gives everyone the same chain of cards.
 */
import { CATEGORIES, type Category } from './bank';

/** mulberry32: a tiny deterministic RNG, so a seed gives everyone the same round. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A topic runs for this many calls, then a new one starts with a fresh card. */
export const PER_TOPIC = 5;

export interface Card {
  cat: number;
  item: number;
}

export interface Pair {
  left: Card;
  right: Card;
}

export const categoryOf = (c: Card): Category => CATEGORIES[c.cat]!;
export const valueOf = (c: Card): number => CATEGORIES[c.cat]!.items[c.item]![2];
export const nameOf = (c: Card): string => CATEGORIES[c.cat]!.items[c.item]![0];
export const emojiOf = (c: Card): string => CATEGORIES[c.cat]!.items[c.item]![1];

/**
 * Two values far enough apart that rounding can never change the answer. `ratio` is 1.25, or 1.4 when
 * one of the two varies a lot in the real world (breeds, sexes, kinds).
 */
export function clearlyDifferent(cat: Category, a: number, b: number, ratio = 1.25): boolean {
  if (cat.years) return Math.abs(a - b) >= 10;
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return lo > 0 && hi / lo >= ratio;
}

/** The ratio a pair of these two items needs (version 2 chains): wider for items that vary a lot. */
const ratioFor = (cat: Category, a: number, b: number): number => (cat.items[a]![3] || cat.items[b]![3] ? 1.4 : 1.25);

/**
 * The first `count` pairs of a run. Each topic lasts PER_TOPIC calls; within it the right card of
 * one pair is the left card of the next, and no item repeats inside a topic.
 *
 * Version 2 (the default) also remembers the whole run: unused items come first, and the same two
 * things are never paired twice while another pairing is possible. Version 1 is the original chain,
 * kept so dailies and challenges from before the change keep their cards.
 */
export function chain(seed: number, count: number, version: 1 | 2 = 2): Pair[] {
  if (version === 1) return chainV1(seed, count);
  const r = rng(seed);
  const pairs: Pair[] = [];
  let cat = -1;
  let left: Card | null = null;
  let visit = new Set<number>();
  const used = CATEGORIES.map(() => new Set<number>());
  const paired = new Set<string>();
  const key = (c: number, a: number, b: number): string => `${c}:${Math.min(a, b)}:${Math.max(a, b)}`;
  const topics = CATEGORIES.map((_, i) => i);
  let order: number[] = [];
  for (let i = 0; i < count; i++) {
    if (i % PER_TOPIC === 0 || !left) {
      if (order.length === 0) {
        order = topics.slice();
        for (let k = order.length - 1; k > 0; k--) {
          const j = Math.floor(r() * (k + 1));
          [order[k], order[j]] = [order[j]!, order[k]!];
        }
        if (order[0] === cat && order.length > 1) [order[0], order[1]] = [order[1]!, order[0]!];
      }
      cat = order.shift()!;
      visit = new Set();
      const all = CATEGORIES[cat]!.items.map((_, k) => k);
      const fresh = all.filter((k) => !used[cat]!.has(k));
      const from = fresh.length ? fresh : all;
      const first = from[Math.floor(r() * from.length)]!;
      left = { cat, item: first };
      visit.add(first);
      used[cat]!.add(first);
    }
    const c = CATEGORIES[cat]!;
    const l: number = left.item;
    const lv = valueOf(left);
    const ok = c.items.map((_, k) => k).filter((k) => !visit.has(k) && clearlyDifferent(c, lv, c.items[k]![2], ratioFor(c, l, k)));
    const unpaired = ok.filter((k) => !paired.has(key(cat, l, k)));
    const unused = unpaired.filter((k) => !used[cat]!.has(k));
    // Best: a thing not seen this run; then a pairing not seen; then anything new to this topic visit.
    const pool: number[] = unused.length ? unused : unpaired.length ? unpaired : ok.length ? ok : c.items.map((_, k) => k).filter((k) => k !== l && clearlyDifferent(c, lv, c.items[k]![2], ratioFor(c, l, k)));
    const item = pool[Math.floor(r() * pool.length)]!;
    visit.add(item);
    used[cat]!.add(item);
    paired.add(key(cat, l, item));
    const right = { cat, item };
    pairs.push({ left, right });
    left = right;
  }
  return pairs;
}

function chainV1(seed: number, count: number): Pair[] {
  const r = rng(seed);
  const pairs: Pair[] = [];
  let cat = -1;
  let left: Card | null = null;
  let used = new Set<number>();
  const topics = CATEGORIES.map((_, i) => i);
  let order: number[] = [];
  for (let i = 0; i < count; i++) {
    if (i % PER_TOPIC === 0 || !left) {
      // Next topic: walk a shuffled order of all topics, reshuffling when it runs out.
      if (order.length === 0) {
        order = topics.slice();
        for (let k = order.length - 1; k > 0; k--) {
          const j = Math.floor(r() * (k + 1));
          [order[k], order[j]] = [order[j]!, order[k]!];
        }
        if (order[0] === cat && order.length > 1) [order[0], order[1]] = [order[1]!, order[0]!];
      }
      cat = order.shift()!;
      used = new Set();
      const first = Math.floor(r() * CATEGORIES[cat]!.items.length);
      left = { cat, item: first };
      used.add(first);
    }
    const c = CATEGORIES[cat]!;
    const lv = valueOf(left);
    const options = c.items.map((_, k) => k).filter((k) => !used.has(k) && clearlyDifferent(c, lv, c.items[k]![2]));
    // A topic that runs dry (it cannot here, but stay safe) restarts with a fresh card.
    const pool = options.length ? options : c.items.map((_, k) => k).filter((k) => k !== left!.item && clearlyDifferent(c, lv, c.items[k]![2]));
    const item = pool[Math.floor(r() * pool.length)]!;
    used.add(item);
    const right = { cat, item };
    pairs.push({ left, right });
    left = right;
  }
  return pairs;
}

/** True when "more" (bigger, later, taller…) is the right call for this pair. */
export const answerIsMore = (p: Pair): boolean => valueOf(p.right) > valueOf(p.left);

/** Share line: a green square per right call and a red one for the miss, in rows of ten. */
export function resultLine(streak: number, missed: boolean): string {
  // Only the first 30 squares are shown: never build the whole streak (a damaged save can hold a huge one).
  const right = Math.max(0, Math.floor(streak) || 0);
  const shown = '🟩'.repeat(Math.min(right, 30)) + (missed && right < 30 ? '🟥' : '');
  const rows = shown.match(/(?:🟩|🟥){1,10}/gu) ?? [];
  return rows.join('\n') + (right + (missed ? 1 : 0) > 30 ? ' …' : '');
}
