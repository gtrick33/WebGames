/**
 * Every language's shop, email and legal pages (src/i18n/shop/<code>.ts, src/i18n/legal/<code>.ts) against the English:
 * the same entries, each one filled in, with the same <tags> and {placeholders}, every built-in item named, and the
 * statements and plural words in place.
 */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PRODUCTS } from '../src/catalog/shop';
import { LANGS } from '../src/i18n';
import { marks } from '../src/i18n/shopFormat';
import type { LegalText, ShopText } from '../src/i18n/shopTypes';
import { TERMS_UPDATED } from '../src/pages/TermsPage';

const shops = import.meta.glob<{ default: ShopText }>('../src/i18n/shop/*.ts', { eager: true });
const legals = import.meta.glob<{ default: LegalText }>('../src/i18n/legal/*.ts', { eager: true });
const en = { shop: shops['../src/i18n/shop/en.ts']!.default, legal: legals['../src/i18n/legal/en.ts']!.default };
const codes = (dir: string): string[] => readdirSync(join(process.cwd(), 'src/i18n', dir)).map((f) => f.replace(/\.ts$/, '')).sort();

/** Every text in an object, by its path ("sale.who", "terms.fair.2", "privacy.rounds.other"). */
function texts(v: unknown, path = ''): Map<string, string> {
  const out = new Map<string, string>();
  if (typeof v === 'string') out.set(path, v);
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) for (const [p, t] of texts(x, path ? `${path}.${k}` : k)) out.set(p, t);
  return out;
}

describe('the shop and legal pages in every language', () => {
  it('has both files for every language the site offers', () => {
    const want = LANGS.map((l) => l.code).sort();
    expect(codes('shop')).toEqual(want);
    expect(codes('legal')).toEqual(want);
  });

  it('English matches the catalog and the terms page', () => {
    expect(en.legal.terms.updated).toBe(TERMS_UPDATED);
    for (const p of PRODUCTS) expect(en.shop.items[p.id], p.id).toEqual({ name: p.name, blurb: p.blurb });
  });

  const others = codes('shop').filter((c) => c !== 'en');
  for (const code of others) {
    it(`${code}: every entry, filled in, with the same <tags> and {placeholders} as English`, () => {
      const shop = shops[`../src/i18n/shop/${code}.ts`]?.default;
      const legal = legals[`../src/i18n/legal/${code}.ts`]?.default;
      expect(shop, `src/i18n/shop/${code}.ts`).toBeTruthy();
      expect(legal, `src/i18n/legal/${code}.ts`).toBeTruthy();
      for (const [mine, source] of [
        [texts({ ...shop!, items: undefined }), texts({ ...en.shop, items: undefined })],
        [texts(legal), texts(en.legal)],
      ] as const) {
        for (const [path, english] of source) {
          // (plural forms a language doesn't use may be left out; "other" never)
          if (/\.(rounds|dailies)\.(zero|one|two|few|many)$/.test(path)) continue;
          const t = mine.get(path);
          expect(t, `${code}: ${path}`).toBeTruthy();
          expect(marks(t!), `${code}: ${path}`).toEqual(marks(english));
        }
        for (const path of mine.keys()) expect(source.has(path) || /\.(rounds|dailies)\.\w+$/.test(path), `${code}: ${path} isn't in English`).toBe(true);
      }
      expect(Object.keys(shop!.items).sort()).toEqual(PRODUCTS.map((p) => p.id).sort());
      for (const p of PRODUCTS) {
        expect(shop!.items[p.id]!.name, `${code}: ${p.id}`).toBeTruthy();
        expect(shop!.items[p.id]!.blurb, `${code}: ${p.id}`).not.toBe(p.blurb);
      }
      // the statements are the buyer's own words: never left in English
      expect(shop!.shop.agreeNow).not.toBe(en.shop.shop.agreeNow);
      expect(shop!.shop.agreeAge).not.toBe(en.shop.shop.agreeAge);
      expect(legal!.terms.fair).toHaveLength(4);
    });
  }
});
