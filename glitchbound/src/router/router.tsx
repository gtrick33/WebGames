import { useEffect, useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from 'react';
import { flushSync } from 'react-dom';
import { currentSlug, getGame, sectionGame } from '../catalog/catalog';

/**
 * A deliberately tiny client router: four routes do not need a routing library. Paths are real
 * URLs (each has prerendered HTML in the build), so deep links and refreshes always work.
 */

export type Route =
  | { name: 'home' }
  | { name: 'game'; slug: string }
  /** A game with a section of its own (Sigilfall): its tab's path, or its /games/<slug> address. */
  | { name: 'section'; slug: string }
  | { name: 'daily' }
  | { name: 'privacy' }
  | { name: 'terms' }
  | { name: 'about' }
  | { name: 'contact' }
  | { name: 'leaderboards' }
  | { name: 'me' }
  | { name: 'bugs' }
  | { name: 'party' }
  | { name: 'admin' }
  | { name: 'signin' }
  | { name: 'challenges' }
  | { name: 'challenge'; id: string }
  | { name: 'discord' }
  | { name: 'notfound' };

export function matchRoute(pathname: string): Route {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/' || path === '/index.html') return { name: 'home' };
  if (path === '/daily') return { name: 'daily' };
  if (path === '/privacy') return { name: 'privacy' };
  if (path === '/terms') return { name: 'terms' };
  if (path === '/about') return { name: 'about' };
  if (path === '/contact') return { name: 'contact' };
  if (path === '/leaderboards') return { name: 'leaderboards' };
  if (path === '/me') return { name: 'me' };
  if (path === '/me/bugs') return { name: 'bugs' };
  if (path === '/party') return { name: 'party' };
  if (path === '/admin') return { name: 'admin' };
  if (path === '/signin') return { name: 'signin' };
  if (path === '/c') return { name: 'challenges' };
  if (path === '/discord') return { name: 'discord' };
  const section = sectionGame(path);
  if (section) return { name: 'section', slug: section.slug };
  const c = /^\/c\/([A-Za-z0-9]{5,12})$/.exec(path);
  if (c?.[1]) return { name: 'challenge', id: c[1] };
  const m = /^\/games\/([a-z0-9-]+)$/.exec(path);
  if (m?.[1]) {
    const slug = currentSlug(m[1]);
    return getGame(slug)?.section ? { name: 'section', slug } : { name: 'game', slug };
  }
  return { name: 'notfound' };
}

const listeners = new Set<() => void>();
const emit = (): void => listeners.forEach((fn) => fn());

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  window.addEventListener('popstate', fn);
  return () => {
    listeners.delete(fn);
    window.removeEventListener('popstate', fn);
  };
}

const snapshot = (): string => window.location.pathname + window.location.search + window.location.hash;

export function useLocation(): { pathname: string; search: string; hash: string } {
  useSyncExternalStore(subscribe, snapshot, () => '/');
  return { pathname: window.location.pathname, search: window.location.search, hash: window.location.hash };
}

const reducedMotion = (): boolean => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarsePointer = (): boolean => typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

export function navigate(to: string, opts: { replace?: boolean; scroll?: boolean } = {}): void {
  const url = new URL(to, window.location.href);
  if (url.origin !== window.location.origin) {
    window.location.href = url.href;
    return;
  }
  const samePage = url.pathname === window.location.pathname;
  const apply = (): void => {
    if (opts.replace) window.history.replaceState(null, '', url);
    else window.history.pushState(null, '', url);
    emit();
  };
  const scroll = (): void => {
    if (opts.scroll === false) return;
    if (url.hash) {
      // A new page jumps straight to its anchor; only a scroll within the same page glides.
      const behavior = samePage && !reducedMotion() ? 'smooth' : 'auto';
      document.getElementById(decodeURIComponent(url.hash.slice(1)))?.scrollIntoView({ behavior });
    } else if (!samePage) {
      window.scrollTo(0, 0);
    }
  };
  const doc = document as Document & { startViewTransition?: (cb: () => void) => { updateCallbackDone: Promise<void>; ready: Promise<void> } };
  // Touch screens skip the transition: iOS Safari can leave its snapshot frozen on screen until the next tap.
  if (!samePage && doc.startViewTransition && !reducedMotion() && !coarsePointer()) {
    const vt = doc.startViewTransition(() => flushSync(apply));
    // A skipped or aborted transition (a second click, a hidden tab) rejects `ready`: the page still changes, nothing to report.
    vt.ready.catch(() => undefined);
    vt.updateCallbackDone.then(scroll, scroll);
  } else {
    // Rendered at once, so the anchor to scroll to is already on the page.
    flushSync(apply);
    scroll();
  }
}

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

/** An <a> that navigates client-side for same-origin, unmodified left clicks. */
export function Link({ href, onClick, ...rest }: LinkProps) {
  const handle = (e: MouseEvent<HTMLAnchorElement>): void => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (rest.target && rest.target !== '_self') return;
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin) return;
    e.preventDefault();
    navigate(href);
  };
  return <a href={href} onClick={handle} {...rest} />;
}

/** On first load, honor a #hash once the page has rendered. */
export function useInitialHashScroll(): void {
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id) requestAnimationFrame(() => document.getElementById(decodeURIComponent(id))?.scrollIntoView());
  }, []);
}
