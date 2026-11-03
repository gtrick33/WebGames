import { describe, expect, it } from 'vitest';
import { rollGear, itemStats } from '../src/games/sigilfall/progress/items';
import { compareWith, statRows } from '../src/games/sigilfall/ui/compare';
import type { Item } from '../src/games/sigilfall/data/types';
import { rng } from '../src/games/sigilfall/core/math';
import { readyHero } from './sigilfall-bot';

/** The item card's comparison (owner, 2026-10: "like WoW: the equipped item's card next to the one I look at"). */
describe('Sigilfall item comparison', () => {
  const h = readyHero('warrior', 20);
  const r = rng(11);
  const helm = rollGear('warrior', 24, 'rare', r, 'head');

  it('compares a bag or shop item with the piece worn in its slot', () => {
    expect(compareWith(h, helm, false)).toBe(h.equip.head);
  });

  it('never compares the worn piece with itself, and compares nothing with an empty slot', () => {
    expect(compareWith(h, h.equip.head!, true)).toBeUndefined();
    expect(compareWith(h, h.equip.head!, false)).toBeUndefined();
    const bare = { ...h, equip: { ...h.equip, head: undefined } };
    expect(compareWith(bare, helm, false)).toBeUndefined();
  });

  it('a ring compares with the ring, a weapon with the weapon', () => {
    const ring = rollGear('warrior', 24, 'rare', r, 'ring');
    expect(compareWith(h, ring, false)).toBe(h.equip.ring);
    const sword = rollGear('warrior', 24, 'rare', r, 'weapon');
    expect(compareWith(h, sword, false)).toBe(h.equip.weapon);
  });

  it('keeps the ± deltas and lists the stats a swap would lose', () => {
    const worn = h.equip.head!;
    const { rows, lost } = statRows(helm, worn);
    const old = new Map(itemStats(worn));
    for (const row of rows) expect(row.delta).toBeCloseTo(row.v - (old.get(row.k) ?? 0));
    for (const [k] of lost) expect(rows.some((x) => x.k === k)).toBe(false);
    expect(rows.length + lost.length).toBeGreaterThanOrEqual(old.size);
    // nothing to compare: plain stats, no deltas, nothing lost
    const plain = statRows(helm);
    expect(plain.lost).toEqual([]);
    expect(plain.rows.every((x) => x.delta === 0)).toBe(true);
  });

  it('an item compared with a copy of itself shows no change', () => {
    const twin: Item = { ...helm, uid: 'twin' };
    expect(statRows(helm, twin).rows.every((x) => x.delta === 0)).toBe(true);
  });
});
