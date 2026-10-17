import { useEffect, useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from 'react';
import { flushSync } from 'react-dom';

/**
 * A deliberately tiny client router: four routes do not need a routing library. Paths are real
 * URLs (each has prerendered HTML in the build), so deep links and refreshes always work.
 */

export type Route =
  | { name: 'home' }
  | { name: 'game'; slug: string }
  | { name: 'daily' }
  | { name: 'privacy' }
  | { name: 'leaderboards' }
  | { name: 'me' }
  | { name: 'admin' }
  | { name: 'notfound' };

export function matchRoute(pathname: string): Route {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/' || path === '/index.html') return { name: 'home' };
  if (path === '/daily') return { name: 'daily' };
  if (path === '/privacy') return { name: 'privacy' };
  if (path === '/leaderboards') return { name: 'leaderboards' };
  if (path === '/me') return { name: 'me' };
  if (path === '/admin') return { name: 'admin' };
  const m = /^\/games\/([a-z0-9-]+)$/.exec(path);
  if (m?.[1]) return { name: 'game', slug: m[1] };
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
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (!samePage && doc.startViewTransition && !reducedMotion()) {
    doc.startViewTransition(() => flushSync(apply));
  } else {
    apply();
  }
  if (opts.scroll === false) return;
  if (url.hash) {
    requestAnimationFrame(() => document.getElementById(decodeURIComponent(url.hash.slice(1)))?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth' }));
  } else if (!samePage) {
    window.scrollTo(0, 0);
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

/** On first load, honour a #hash once the page has rendered. */
export function useInitialHashScroll(): void {
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id) requestAnimationFrame(() => document.getElementById(decodeURIComponent(id))?.scrollIntoView());
  }, []);
}
