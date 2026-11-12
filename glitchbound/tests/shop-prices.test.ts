/**
 * Sigilfall's shop prices came down on 2026-11-12 (the owner's call: low enough that a new player tries one). The
 * code holds the new prices; a list saved in Admin › Ads & shop holds its own copy, which wins, so migration 0022
 * moves the saved prices nobody had chosen and leaves alone the ones an admin set.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GLOAMKNIGHT_ITEM, MIN_CENTS, PRODUCTS, productIn, sanitizeProducts, withIncluded, type Product } from '../src/catalog/shop';
import { memoryD1 } from './d1';

const MIGRATION = readFileSync(join(process.cwd(), 'migrations/0022_sigilfall_prices.sql'), 'utf8');
const price = (id: string, items: readonly Product[] = PRODUCTS): number => productIn(items, id)!.cents;
/** What each Sigilfall item cost before, and costs now. */
const MOVED: [string, number, number][] = [
  ['sigilfall-gloamknight', 999, 499],
  ['sigilfall-crownforged-wyrm', 599, 299],
  ['sigilfall-galecrest-drake', 399, 199],
  ['sigilfall-runetusk-boar', 349, 199],
  ['sigilfall-cinderhorn-hart', 299, 149],
  ['sigilfall-moonglass-hart', 299, 149],
  ['sigilfall-gloamwing-drake', 599, 299],
  ['sigilfall-crownforged-helm', 199, 99],
  ['sigilfall-celestine-crown', 199, 99],
  ['sigilfall-gloamquill-cowl', 199, 99],
  ['sigilfall-duskborn-helm', 199, 99],
  ['sigilfall-crownforged-plate', 249, 149],
  ['sigilfall-celestine-mantle', 249, 149],
  ['sigilfall-gloamquill-mantle', 249, 149],
  ['sigilfall-duskborn-plate', 249, 149],
];

describe('Sigilfall’s shop prices', () => {
  it('are the lower ones in the code: every Sigilfall item, and nothing else moved', () => {
    for (const [id, was, now] of MOVED) {
      expect(price(id), id).toBe(now);
      expect(now, id).toBeLessThanOrEqual(was / 2 + 50);
      expect(now, id).toBeGreaterThanOrEqual(MIN_CENTS);
    }
    // every Sigilfall item is on the list above (a new one added to the shop gets its price on purpose)
    const sigil = PRODUCTS.filter((p) => p.sigil || p.id === GLOAMKNIGHT_ITEM).map((p) => p.id);
    expect(sigil.sort()).toEqual(MOVED.map(([id]) => id).sort());
    // the rest of the shop is where it was
    expect(price('ad-free')).toBe(199);
    for (const p of PRODUCTS) if (p.look) expect(p.cents, p.id).toBe(50);
  });

  it('keep the pack worth taking: it costs less than its pieces, and no mount costs more than it', () => {
    const pack = productIn(PRODUCTS, GLOAMKNIGHT_ITEM)!;
    const pieces = withIncluded([pack.id]).filter((id) => id !== pack.id);
    expect(pieces.length).toBe(5);
    expect(pieces.reduce((a, id) => a + price(id), 0)).toBeGreaterThan(pack.cents);
    for (const p of PRODUCTS) if (p.sigil?.kind === 'mount') expect(p.cents, p.id).toBeLessThan(pack.cents);
  });
});

describe('migration 0022: a price list saved in the admin panel', () => {
  const saved = (db: ReturnType<typeof memoryD1>): Product[] => {
    const row = db.sqlite.prepare("SELECT value FROM site_settings WHERE key = 'shop_items'").get() as { value: string } | undefined;
    return row ? (JSON.parse(row.value) as Product[]) : [];
  };
  const save = (db: ReturnType<typeof memoryD1>, items: unknown): void => {
    db.sqlite.prepare("INSERT OR REPLACE INTO site_settings (key, value, updated_at, updated_by) VALUES ('shop_items', ?, 0, 'test')").run(JSON.stringify(items));
  };
  /** The list as an admin's save left it before the change: every built-in item at its old price. */
  const oldList = (): Product[] => PRODUCTS.map((p) => ({ ...p, cents: MOVED.find(([id]) => id === p.id)?.[1] ?? p.cents }));

  it('moves every saved price that was still the old default, and keeps the list as it was otherwise', () => {
    const db = memoryD1();
    const before = oldList();
    save(db, before);
    db.sqlite.exec(MIGRATION);
    const after = saved(db);
    expect(after.map((p) => p.id)).toEqual(before.map((p) => p.id));
    for (const [id, , now] of MOVED) expect(price(id, after), id).toBe(now);
    // nothing but the price changed, and only on those
    for (const [i, p] of after.entries()) expect({ ...p, cents: 0 }, p.id).toEqual({ ...before[i]!, cents: 0 });
    expect(price('ad-free', after)).toBe(199);
    // the shop reads the migrated list as it reads any saved one: the saved price wins, and it is the new one
    expect(price(GLOAMKNIGHT_ITEM, sanitizeProducts(after))).toBe(499);
  });

  it('leaves a price an admin set by hand, an item an admin made, and a list that is not there', () => {
    const db = memoryD1();
    const list: Product[] = [...oldList(), { id: 'border-of-mine', name: 'Border of mine', blurb: 'A border an admin made.', cents: 999, look: { kind: 'border', style: 'solid', colors: ['#ffffff'] } as never }];
    // the pack put on offer at 7.49 by hand, a mount raised to 6.99
    list.find((p) => p.id === GLOAMKNIGHT_ITEM)!.cents = 749;
    list.find((p) => p.id === 'sigilfall-galecrest-drake')!.cents = 699;
    save(db, list);
    db.sqlite.exec(MIGRATION);
    const after = saved(db);
    expect(price(GLOAMKNIGHT_ITEM, after)).toBe(749);
    expect(price('sigilfall-galecrest-drake', after)).toBe(699);
    // (999 was the pack's old price, not this border's: an id is matched with its own old price)
    expect(price('border-of-mine', after)).toBe(999);
    expect(price('sigilfall-crownforged-wyrm', after)).toBe(299);
    expect(after.length).toBe(list.length);
    // run again (a database restored from a backup): nothing more to move
    db.sqlite.exec(MIGRATION);
    expect(saved(db)).toEqual(after);
    // no saved list: nothing is made up
    const empty = memoryD1();
    empty.sqlite.exec(MIGRATION);
    expect(saved(empty)).toEqual([]);
    // a broken value is left for the code's own fallback
    empty.sqlite.prepare("INSERT INTO site_settings (key, value, updated_at, updated_by) VALUES ('shop_items', 'not json', 0, 'test')").run();
    empty.sqlite.exec(MIGRATION);
    expect((empty.sqlite.prepare("SELECT value FROM site_settings WHERE key = 'shop_items'").get() as { value: string }).value).toBe('not json');
  });
});
