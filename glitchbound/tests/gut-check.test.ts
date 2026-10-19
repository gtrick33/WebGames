import { describe, expect, it } from 'vitest';
import { getGame } from '../src/catalog/catalog';
import { CATEGORIES } from '../src/games/gut-check/bank';
import { answerIsMore, chain, clearlyDifferent, PER_TOPIC, resultLine, valueOf } from '../src/games/gut-check/logic';

describe('Gut Check', () => {
  it('has a clean fact bank', () => {
    for (const c of CATEGORIES) {
      const names = c.items.map(([n]) => n);
      expect(new Set(names).size, c.id).toBe(names.length);
      for (const [name, emoji, v] of c.items) {
        expect(name.length, name).toBeLessThanOrEqual(34);
        expect(emoji.length).toBeGreaterThan(0);
        expect(v, name).toBeGreaterThan(0);
        expect(c.format(v)).not.toMatch(/NaN|undefined|\b0 /);
      }
      expect(c.items.length).toBeGreaterThanOrEqual(10);
    }
  });

  it('builds the same chain for the same seed, and a different one otherwise', () => {
    expect(chain(9, 40)).toEqual(chain(9, 40));
    expect(chain(9, 40)).not.toEqual(chain(10, 40));
  });

  it('only pairs things that are clearly different, and chains each topic', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const pairs = chain(seed * 2654435761, 60);
      pairs.forEach((p, i) => {
        const cat = CATEGORIES[p.left.cat]!;
        expect(p.right.cat).toBe(p.left.cat);
        expect(clearlyDifferent(cat, valueOf(p.left), valueOf(p.right))).toBe(true);
        expect(valueOf(p.left)).not.toBe(valueOf(p.right));
        if (i % PER_TOPIC !== 0) expect(p.left).toEqual(pairs[i - 1]!.right);
      });
    }
  });

  it('answers by value', () => {
    const [p] = chain(3, 1);
    expect(answerIsMore(p!)).toBe(valueOf(p!.right) > valueOf(p!.left));
  });

  it('shares rows of ten squares', () => {
    expect(resultLine(3, true)).toBe('🟩🟩🟩🟥');
    expect(resultLine(12, false)).toBe('🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩\n🟩🟩');
    expect(resultLine(40, true).endsWith(' …')).toBe(true);
  });

  it('keeps a quick player inside the score limits', () => {
    const limits = getGame('gut-check')!.limits!;
    // One call a second is about as fast as the reveal allows.
    expect(1).toBeLessThan(limits.scorePerSecond);
  });
});
