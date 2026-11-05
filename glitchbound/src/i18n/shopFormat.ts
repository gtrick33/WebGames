import type { Lang } from '.';
import type { Plural } from './shopTypes';

/** Plain helpers for the shop's and legal pages' words (src/i18n/shopTypes.ts), with nothing of the browser: the server uses them too. */

/** The locale Intl formats a language with: the site's Portuguese is Portugal's (plain "pt" would count and write prices as Brazil does). */
const INTL: Partial<Record<Lang, string>> = { pt: 'pt-PT' };
const intl = (lang: Lang): string => INTL[lang] ?? lang;

/** Fills each {name} in a plain text. */
export const fill = (text: string, values: Record<string, string | number>): string => text.replace(/\{(\w+)\}/g, (m, k: string) => (k in values ? String(values[k]) : m));

/** A count in words: the language's plural category for n, with {n} filled in. */
export function plural(lang: Lang, words: Plural, n: number): string {
  const cat = new Intl.PluralRules(intl(lang)).select(n) as keyof Plural;
  return fill(words[cat] ?? words.other, { n });
}

/** A price as the language writes it (1,99 €, 1,99 € …); English keeps the shop's own "€1.99". */
export function priceIn(lang: Lang, cents: number): string {
  if (lang === 'en') return `€${(cents / 100).toFixed(2)}`;
  return new Intl.NumberFormat(intl(lang), { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

/** The <tags> and {placeholders} a text uses, sorted: every language must use the same ones as English. */
export const marks = (text: string): string[] => [...text.matchAll(/<(\w+)>|\{(\w+)\}/g)].map((m) => (m[1] ? `<${m[1]}>` : `{${m[2]}}`)).sort();
