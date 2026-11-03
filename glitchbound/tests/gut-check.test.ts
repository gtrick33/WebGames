import { describe, expect, it } from 'vitest';
import { getGame } from '../src/catalog/catalog';
import { CATEGORIES, formatIn, formatValue, pairUnit, unitOf } from '../src/games/gut-check/bank';
import { answerIsMore, chain, clearlyDifferent, PER_TOPIC, resultLine, valueOf, type Pair } from '../src/games/gut-check/logic';
import { CHAIN, parseSave } from '../src/games/gut-check/save';
import { hashString } from '../src/platform/dates';

describe('Gut Check', () => {
  it('has a clean fact bank', () => {
    for (const c of CATEGORIES) {
      const names = c.items.map(([n]) => n);
      expect(new Set(names).size, c.id).toBe(names.length);
      for (const [name, emoji, v] of c.items) {
        expect(name.length, name).toBeLessThanOrEqual(34);
        expect(emoji.length).toBeGreaterThan(0);
        expect(v, name).toBeGreaterThan(0);
        expect(formatValue(c, v)).not.toMatch(/NaN|undefined|\b0 |tonnes|football/);
        expect(name).not.toMatch(/football/i);
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
    // A damaged save can hold a huge streak: only the shown squares are ever built.
    expect(resultLine(3e8, true)).toBe(resultLine(30, false) + ' …');
    expect(resultLine(30, true)).toBe(resultLine(30, false) + ' …');
  });

  it('keeps the cards of dailies and challenges from before the no-repeat chain', () => {
    // The original chain, byte for byte (hashes taken before version 2 was added).
    const days = ['2026-10-19', '2026-11-03', '2026-11-09'];
    const old = days.map((d) => hashString(JSON.stringify(chain(hashString(`gut-check:${d}`), 300, 1))));
    old.push(hashString(JSON.stringify(chain(12345, 300, 1))));
    expect(old).toEqual([1497941227, 2249875896, 2829437971, 118466943]);
  });

  it('never repeats a pairing early in a run, and uses fresh things first', () => {
    const key = (p: Pair): string => `${p.left.cat}:${Math.min(p.left.item, p.right.item)}:${Math.max(p.left.item, p.right.item)}`;
    let repeats = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const pairs = chain(seed * 2654435761, 90);
      // (The original chain repeated about two pairings per 90 calls.)
      repeats += 90 - new Set(pairs.map(key)).size;
      // Two visits per topic in 90 calls (12 cards): a topic with more things never shows one twice.
      const shown = pairs.flatMap((p, i) => (i % PER_TOPIC === 0 ? [p.left, p.right] : [p.right])).filter((c) => CATEGORIES[c.cat]!.items.length > 12);
      const ids = shown.map((c) => `${c.cat}:${c.item}`);
      expect(new Set(ids).size, `seed ${seed}`).toBe(ids.length);
    }
    expect(repeats).toBeLessThanOrEqual(1);
    // A perfect run of 300: pairings only come back in the two smallest topics, once they run out.
    for (let seed = 1; seed <= 50; seed++) {
      const seen = new Set<string>();
      for (const p of chain(seed * 7919, CHAIN)) {
        if (seen.has(key(p))) expect(['river', 'mountain']).toContain(CATEGORIES[p.left.cat]!.id);
        seen.add(key(p));
      }
    }
  });

  it('keeps a wider gap for things whose real number varies a lot', () => {
    for (let seed = 1; seed <= 200; seed++)
      for (const p of chain(seed * 40503, 120)) {
        const c = CATEGORIES[p.left.cat]!;
        if (c.items[p.left.item]![3] || c.items[p.right.item]![3]) expect(clearlyDifferent(c, valueOf(p.left), valueOf(p.right), 1.4)).toBe(true);
      }
  });

  it('counts up in the final unit', () => {
    const weight = CATEGORIES.find((c) => c.id === 'weight')!;
    const tons = unitOf(weight, 1500);
    expect(formatIn(weight, tons, 1500)).toBe('about 1.5 metric tons');
    // Mid-count it stays in metric tons (never "918 kg", then "1.1 metric tons").
    expect(formatIn(weight, tons, 918)).toBe('about 0.92 metric tons');
    expect(formatValue(weight, 0.8)).toBe('about 800 g');
  });

  it('says both numbers of a comparison in one unit, metric or US, and big numbers in words', () => {
    const cat = (id: string) => CATEGORIES.find((c) => c.id === id)!;
    const weight = cat('weight');
    const speed = cat('speed');
    // Hedgehog vs Rabbit: 800 g vs 2,000 g, not 800 g vs 2 kg.
    expect(formatIn(weight, pairUnit(weight, 0.8, 2), 2)).toBe('about 2,000 g');
    // Walking person vs Sloth: the slower one has the smaller number.
    expect(formatIn(speed, pairUnit(speed, 5, 0.25), 0.25)).toBe('about 0.25 km/h');
    // Too far apart to share one (an elephant in grams): each in its own.
    expect(formatIn(weight, pairUnit(weight, 6000, 0.0001), 0.0001)).toBe('about 0.1 g');
    // US units, rounded to three significant digits.
    expect(formatValue(weight, 1500, true)).toBe('about 1.65 tons');
    expect(formatValue(weight, 2, true)).toBe('about 4.41 lb');
    expect(formatValue(speed, 110, true)).toBe('about 68.4 mph');
    expect(formatValue(cat('mountain'), 8849, true)).toBe('about 29,000 ft high');
    expect(formatValue(cat('area'), 17.1e6, true)).toBe('about 6.6 million sq mi');
    expect(formatValue(cat('people'), 1440e6)).toBe('about 1.44 billion people');
    expect(cat('people').note).toMatch(/as of 2024/);
    for (const c of CATEGORIES) for (const [, , v] of c.items) expect(formatValue(c, v, true)).not.toMatch(/NaN|undefined|\b0 /);
  });

  it('loads a damaged save without throwing, clamped to what a run can reach', () => {
    for (const raw of ['garbage', 'null', '[]', '{"best":"x","daily":5}', null]) expect(parseSave(raw).best).toBe(0);
    const s = parseSave(JSON.stringify({ best: 1e21, runs: 1e9, daily: { '2026-11-03': { best: 1e21, tries: 1, open: true } }, progress: { day: '2026-11-03', i: 299.5 }, rounds: { 'ab12:1': { i: 1e9, done: 1e9, missed: true }, bad: { i: 1 } } }));
    expect(s.best).toBe(CHAIN);
    expect(s.daily['2026-11-03']!.best).toBe(CHAIN);
    expect(s.progress).toBeUndefined();
    expect(s.rounds).toEqual({ 'ab12:1': { i: CHAIN - 1, done: CHAIN, missed: true } });
    expect(() => resultLine(s.daily['2026-11-03']!.best, true)).not.toThrow();
  });

  it('keeps a quick player inside the score limits', () => {
    const limits = getGame('gut-check')!.limits!;
    // One call a second is about as fast as the reveal allows.
    expect(1).toBeLessThan(limits.scorePerSecond);
  });
});
