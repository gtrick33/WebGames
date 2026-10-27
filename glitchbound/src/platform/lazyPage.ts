import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { fresh } from './freshBuild';

export type LazyPage<P> = LazyExoticComponent<ComponentType<P>> & {
  /** Starts loading the page's code; undefined once it is here. */
  preload: () => Promise<unknown> | undefined;
};

/**
 * A page (or a piece of one) that is a code chunk of its own (React.lazy). Its code can load ahead of time
 * (a link hovered or focused, the router waiting on it before switching pages): it then renders in the same
 * pass, with no empty frame or loading line before it.
 */
export function lazyPage<P extends object>(load: () => Promise<ComponentType<P>>): LazyPage<P> {
  let loaded: ComponentType<P> | undefined;
  let loading: Promise<ComponentType<P>> | undefined;
  const fetchPage = fresh(load);
  const start = (): Promise<ComponentType<P>> =>
    (loading ??= fetchPage().then(
      (page) => (loaded = page),
      (e: unknown) => {
        // a failed load (offline) tries again next time
        loading = undefined;
        throw e;
      },
    ));
  const module = (): Promise<{ default: ComponentType<P> }> => {
    const page = loaded;
    if (!page) return start().then((p) => ({ default: p }));
    // A thenable that calls back straight away: React.lazy then renders the page in this very pass.
    const ready = { then: (done: (m: { default: ComponentType<P> }) => void) => done({ default: page }) };
    return ready as unknown as Promise<{ default: ComponentType<P> }>;
  };
  return Object.assign(lazy(module), { preload: () => (loaded ? undefined : start()) });
}
