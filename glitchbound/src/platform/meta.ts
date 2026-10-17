import { useEffect } from 'react';
import { SITE_URL } from './env';

export const SITE_NAME = 'GlitchBound';
export const DEFAULT_DESCRIPTION =
  'GlitchBound is an independent browser arcade. Small games, big obsessions: polished games that start in a second, daily challenges and personal bests to beat. No installs.';

export function pageTitle(title?: string): string {
  return title ? `${title} · ${SITE_NAME}` : `${SITE_NAME} · Small Games. Big Obsessions.`;
}

function setMeta(selector: string, attr: 'content' | 'href', value: string): void {
  const el = document.head.querySelector(selector);
  if (el) el.setAttribute(attr, value);
}

/** Keeps <title>, description, canonical and Open Graph tags in sync after client-side navigation. */
export function usePageMeta(meta: { title?: string; description?: string; path: string; image?: string }): void {
  const { title, description = DEFAULT_DESCRIPTION, path, image } = meta;
  useEffect(() => {
    const full = pageTitle(title);
    const url = `${SITE_URL}${path}`;
    document.title = full;
    setMeta('meta[name="description"]', 'content', description);
    setMeta('link[rel="canonical"]', 'href', url);
    setMeta('meta[property="og:title"]', 'content', full);
    setMeta('meta[property="og:description"]', 'content', description);
    setMeta('meta[property="og:url"]', 'content', url);
    setMeta('meta[property="og:image"]', 'content', `${SITE_URL}${image ?? '/og.png'}`);
  }, [title, description, path, image]);
}
