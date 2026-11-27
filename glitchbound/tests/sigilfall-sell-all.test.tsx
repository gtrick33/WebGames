import { readFileSync } from 'node:fs';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { rng } from '../src/games/sigilfall/core/math';
import type { SigilEngine } from '../src/games/sigilfall/engine';
import { addItem, bagWorth, newCharacter, salvageAll, type Character } from '../src/games/sigilfall/progress/character';
import { rollGear, salvageValue } from '../src/games/sigilfall/progress/items';
import { SellAll, sellAllNote } from '../src/games/sigilfall/ui/SellAll';

/**
 * Sell all (the owner, 2026-11-27: "a button in the bag inventory tab, called "sell all" where it calculates the whole
 * amount of every item in the bag and salvages them ... a similar button to every merchant that has an option to sell
 * an item to them").
 */

const hero = (): Character => {
  const c = newCharacter('mage', 'Test', 'hero0', 0);
  for (const [i, r] of (['common', 'uncommon', 'rare', 'epic', 'legendary'] as const).entries()) addItem(c, rollGear('mage', 10 + i, r, rng(40 + i)));
  return c;
};

afterEach(cleanup);

describe('Sigilfall: Sell all', () => {
  it('the bag is worth what its pieces fetch one at a time, a bought piece only its share of what was paid', () => {
    const c = hero();
    c.bag[0]!.paid = 8;
    expect(bagWorth(c)).toBe(c.bag.reduce((sum, it) => sum + salvageValue(it), 0));
    expect(salvageValue(c.bag[0]!)).toBe(2);
  });

  it('sells the whole bag for that, and leaves what is worn alone', () => {
    const c = hero();
    const worn = Object.values(c.equip).filter(Boolean).length;
    const worth = bagWorth(c);
    const gold = c.gold;
    expect(salvageAll(c)).toEqual({ n: 5, gold: worth });
    expect(c.bag).toHaveLength(0);
    expect(c.gold).toBe(gold + worth);
    expect(Object.values(c.equip).filter(Boolean)).toHaveLength(worn);
    expect(salvageAll(c)).toEqual({ n: 0, gold: 0 });
  });

  it('says which finer pieces would go with the rest', () => {
    const c = hero();
    // (a new hero wears nothing: every piece in the bag is an upgrade)
    expect(sellAllNote(c)).toBe('1 legendary, 1 epic, 1 rare and 5 upgrades');
    c.bag = c.bag.filter((it) => it.r === 'common');
    expect(sellAllNote(c)).toBe('1 upgrade');
    // a plain piece this hero can't wear: nothing to warn of
    c.bag = [rollGear('warrior', 10, 'common', rng(7), 'weapon')];
    expect(sellAllNote(c)).toBe('');
  });

  it('asks first, with the count and the gold, and sells on the second tap', () => {
    const c = hero();
    const worth = bagWorth(c);
    const sold: { n: number; gold: number }[] = [];
    const engine = { hero: c, salvageAll: () => salvageAll(c) } as unknown as SigilEngine;
    const view = render(<SellAll engine={engine} onSold={(got) => sold.push(got)} />);
    const gold = worth.toLocaleString('en-US');
    fireEvent.click(view.getByText(`Sell all · ${gold} g`));
    expect(view.getByText(`Sell all 5 items for ${gold} gold?`)).toBeTruthy();
    expect(view.getByText('Includes 1 legendary, 1 epic, 1 rare and 5 upgrades.')).toBeTruthy();
    // nothing goes on a change of mind
    fireEvent.click(view.getByText('Cancel'));
    expect(c.bag).toHaveLength(5);
    fireEvent.click(view.getByText(`Sell all · ${gold} g`));
    fireEvent.click(view.getByText(`Sell all 5 items for ${gold} gold?`));
    expect(sold).toEqual([{ n: 5, gold: worth }]);
    expect(c.bag).toHaveLength(0);
    view.rerender(<SellAll engine={engine} />);
    expect(view.container.textContent).toBe('');
  });

  it('is in the bag and at every vendor who buys (one Sell tab for them all), through one sale of the whole bag', () => {
    const read = (f: string): string => readFileSync(`src/games/sigilfall/${f}`, 'utf8');
    expect(read('ui/Panels.tsx')).toContain('<SellAll');
    expect(read('ui/Shop.tsx')).toContain('<SellAll');
    expect(read('engine.ts')).toContain('const got = salvageAll(this.hero);');
  });
});
