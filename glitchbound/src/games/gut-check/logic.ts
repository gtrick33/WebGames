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

/** Two values far enough apart that rounding can never change the answer. */
export function clearlyDifferent(cat: Category, a: number, b: number): boolean {
  if (cat.years) return Math.abs(a - b) >= 10;
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return lo > 0 && hi / lo >= 1.25;
}

/**
 * The first `count` pairs of a run. Each topic lasts PER_TOPIC calls; within it the right card of
 * one pair is the left card of the next, and no item repeats inside a topic.
 */
export function chain(seed: number, count: number): Pair[] {
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
  const marks = '🟩'.repeat(streak) + (missed ? '🟥' : '');
  const shown = [...marks].slice(0, 30).join('');
  const rows = shown.match(/(?:🟩|🟥){1,10}/gu) ?? [];
  return rows.join('\n') + ([...marks].length > 30 ? ' …' : '');
}
