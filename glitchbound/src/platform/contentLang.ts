/**
 * Languages a game can have its own content in (questions, cards, its in-game text). This is separate
 * from the interface languages: the site is translated into many, a game only into the ones it lists
 * in its catalog entry (`contentLangs`). A game plays in the site's language when it has it, else in
 * English, so the one language setting (the picker in the header and footer) decides both.
 */
export type ContentLang = 'en' | 'bg' | 'de' | 'es' | 'fr' | 'it' | 'nl' | 'pl' | 'pt' | 'ro' | 'tr' | 'uk';

export const CONTENT_LANGS: readonly ContentLang[] = ['en', 'bg', 'de', 'es', 'fr', 'it', 'nl', 'pl', 'pt', 'ro', 'tr', 'uk'];

/** English and Bulgarian: the languages Crass Act, Fussbox and Whatsit carry their own text in. */
export type BasicLang = 'en' | 'bg';

/** A game that ships only English and Bulgarian narrows the language it is given to those two. */
export const basicLang = (lang: ContentLang | undefined): BasicLang => (lang === 'bg' ? 'bg' : 'en');

export const isContentLang = (v: unknown): v is ContentLang => typeof v === 'string' && (CONTENT_LANGS as readonly string[]).includes(v);

/**
 * The language a game's content plays in for this site language (a Lang code from src/i18n; kept as a
 * string so the catalog, which build scripts import, stays free of browser code).
 */
export function contentLangFor(langs: readonly ContentLang[] | undefined, site: string): ContentLang {
  return isContentLang(site) && langs?.includes(site) ? site : 'en';
}
