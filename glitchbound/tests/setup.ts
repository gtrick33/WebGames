// jsdom lacks a few browser APIs the site uses; provide minimal stand-ins.
import { afterEach, vi } from 'vitest';

// (test files share their workers: each starts with its own fresh modules, so no store, cache or room a file before
// left behind can reach it; the page's own state is reset after every test below)
vi.resetModules();

afterEach(async () => {
  // (the testing library this file's tests rendered with, not one from before the modules were reset)
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  vi.useRealTimers();
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState(null, '', '/');
});

if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: query.includes('reduce'),
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

class NoopObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): [] {
    return [];
  }
}
window.IntersectionObserver ??= NoopObserver as unknown as typeof IntersectionObserver;
window.ResizeObserver ??= NoopObserver as unknown as typeof ResizeObserver;
HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext'];
window.scrollTo = (() => undefined) as typeof window.scrollTo;

if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
}
