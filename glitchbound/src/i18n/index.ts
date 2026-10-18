/**
 * Interface languages. English is the source: every `t('English text')` call is also its own key,
 * so anything not translated yet simply shows in English. Each other language is a lazy chunk
 * (src/i18n/locales/<code>.ts) loaded before the first render, so the page never flashes English.
 *
 *   t('Daily #{n}', { n: 12 })   → "Daily #12" / "Дневно #12" …
 *
 * The games' own content (trivia questions, word puzzles, cards) stays in English.
 */
import { useSyncExternalStore } from 'react';

export type Lang = 'en' | 'bg' | 'es' | 'de' | 'fr' | 'it' | 'pt' | 'pl' | 'ro' | 'tr' | 'nl' | 'uk';

export const LANGS: { code: Lang; name: string; flag: string }[] = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'bg', name: 'Български', flag: '🇧🇬' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
  { code: 'pl', name: 'Polski', flag: '🇵🇱' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'ro', name: 'Română', flag: '🇷🇴' },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
  { code: 'uk', name: 'Українська', flag: '🇺🇦' },
];

type Dict = Record<string, string>;

/** Each locale is a list of translations in the order of KEYS (src/i18n/keys.ts). */
const LOADERS: Record<Exclude<Lang, 'en'>, () => Promise<{ default: string[] }>> = {
  bg: () => import('./locales/bg'),
  de: () => import('./locales/de'),
  es: () => import('./locales/es'),
  fr: () => import('./locales/fr'),
  it: () => import('./locales/it'),
  nl: () => import('./locales/nl'),
  pl: () => import('./locales/pl'),
  pt: () => import('./locales/pt'),
  ro: () => import('./locales/ro'),
  tr: () => import('./locales/tr'),
  uk: () => import('./locales/uk'),
};

const KEY = 'glitchbound.lang';
const isLang = (v: unknown): v is Lang => typeof v === 'string' && LANGS.some((l) => l.code === v);

/** The saved choice, else the browser's first supported language, else English. */
export function detectLang(saved: string | null, preferred: readonly string[]): Lang {
  if (isLang(saved)) return saved;
  for (const p of preferred) {
    const code = p.toLowerCase().split('-')[0];
    if (isLang(code)) return code;
  }
  return 'en';
}

let lang: Lang = 'en';
let dict: Dict = {};
let version = 0;
const listeners = new Set<() => void>();
const emit = (): void => {
  version++;
  for (const fn of listeners) fn();
};

/** Pairs the English keys with a locale's translations (blank entries fall back to English). */
export function dictFrom(keys: readonly string[], words: readonly string[]): Dict {
  const d: Dict = {};
  keys.forEach((k, i) => {
    const w = words[i];
    if (w) d[k] = w;
  });
  return d;
}

async function load(next: Lang): Promise<void> {
  let d: Dict = {};
  if (next !== 'en') {
    try {
      const [{ KEYS }, words] = await Promise.all([import('./keys'), LOADERS[next]()]);
      d = dictFrom(KEYS, words.default);
    } catch {
      /* offline: stay in English */
    }
  }
  lang = next;
  dict = d;
  if (typeof document !== 'undefined') document.documentElement.lang = next;
  emit();
}

/** Picks the language at start-up and loads its words (await it before the first render). */
export function startI18n(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(KEY);
  } catch {
    /* storage blocked */
  }
  const first = detectLang(saved, navigator.languages ?? [navigator.language]);
  return first === 'en' ? Promise.resolve() : load(first);
}

export function setLang(next: Lang): Promise<void> {
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* storage blocked */
  }
  return load(next);
}

export const getLang = (): Lang => lang;

/** Translates an English interface text, filling {placeholders}. */
export function t(text: string, vars?: Record<string, string | number>): string {
  const s = dict[text] ?? text;
  return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s;
}

/** For components: re-renders when the language changes; returns `t`. */
export function useT(): typeof t {
  useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => version,
    () => version,
  );
  return t;
}

export function useLang(): Lang {
  useT();
  return lang;
}

/** A game's tagline or description in the current language (falls back to English). */
export const tGame = (text: string): string => dict[text] ?? text;

/** A daily challenge's goal ("Clear {n} gaps…") in the current language. */
export const tDaily = (c: { label: string; template?: string; target: number }): string =>
  c.template && dict[c.template] ? dict[c.template]!.replace('{n}', Math.round(c.target).toLocaleString('en-US')) : c.label;
