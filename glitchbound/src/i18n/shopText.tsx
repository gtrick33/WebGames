import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { useLang, type Lang } from '.';
import enLegal from './legal/en';
import enShop from './shop/en';
import type { LegalText, ShopText } from './shopTypes';

export { fill, marks, plural, priceIn } from './shopFormat';

/**
 * The shop's and the legal pages' words in the reader's language (src/i18n/shopTypes.ts). English comes with the page;
 * any other language is its own small file, loaded when it's needed. While it loads the page waits (null), so it
 * never shows a flash of English.
 */
const SHOP = import.meta.glob<{ default: ShopText }>('./shop/*.ts');
const LEGAL = import.meta.glob<{ default: LegalText }>('./legal/*.ts');

const shopCache = new Map<Lang, ShopText>([['en', enShop]]);
const legalCache = new Map<Lang, LegalText>([['en', enLegal]]);

function useWords<T>(cache: Map<Lang, T>, files: Record<string, () => Promise<{ default: T }>>, dir: string): { lang: Lang; words: T | null } {
  const lang = useLang();
  const [, loaded] = useState(0);
  const load = files[`./${dir}/${lang}.ts`];
  useEffect(() => {
    if (cache.has(lang) || !load) return;
    let live = true;
    void load().then((m) => {
      cache.set(lang, m.default);
      if (live) loaded((n) => n + 1);
    });
    return () => {
      live = false;
    };
  }, [cache, lang, load]);
  // (a language without its file reads the English)
  return { lang, words: cache.get(lang) ?? (load ? null : (cache.get('en') ?? null)) };
}

export const useShopText = (): { lang: Lang; words: ShopText | null } => useWords(shopCache, SHOP, 'shop');
export const useLegalText = (): { lang: Lang; words: LegalText | null } => useWords(legalCache, LEGAL, 'legal');

type Part = ReactNode | ((words: string) => ReactNode);

/**
 * Rich text as React: <tag>words</tag> becomes parts[tag](words), and {name} becomes parts[name]. A tag or a name with
 * no part is shown as its words, so a mistake reads oddly rather than breaking the page.
 */
export function rich(text: string, parts: Record<string, Part> = {}): ReactNode {
  const out: ReactNode[] = [];
  const re = /<(\w+)>(.*?)<\/\1>|\{(\w+)\}/g;
  let at = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > at) out.push(text.slice(at, m.index));
    const key = m[1] ?? m[3]!;
    const part = parts[key];
    if (m[1]) out.push(typeof part === 'function' ? part(m[2]!) : (part ?? m[2]));
    else out.push(typeof part === 'function' ? part('') : (part ?? m[0]));
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push(text.slice(at));
  return out.map((p, i) => <Fragment key={i}>{p}</Fragment>);
}
