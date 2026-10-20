import { afterEach, describe, expect, it, vi } from 'vitest';
import { fresh, isStaleBuildError, onPreloadError } from '../src/platform/freshBuild';

describe('stale build after a deploy (#15-#19)', () => {
  const reload = vi.fn();
  const realLocation = window.location;
  const stubReload = () => Object.defineProperty(window, 'location', { configurable: true, value: { ...realLocation, reload } });
  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: realLocation });
    sessionStorage.clear();
    reload.mockReset();
    vi.resetModules();
  });

  /** The same module as a new page load sees it (its "already reloading" flag starts clear). */
  const nextPage = () => import('../src/platform/freshBuild');

  it('recognises a missing code file in every browser, and nothing else', () => {
    expect(isStaleBuildError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isStaleBuildError(new TypeError('Failed to fetch dynamically imported module: https://x/assets/Game-abc.js'))).toBe(true);
    expect(isStaleBuildError(new TypeError('error loading dynamically imported module'))).toBe(true);
    expect(isStaleBuildError('Importing a module script failed.')).toBe(true);
    expect(isStaleBuildError(new TypeError("Cannot read properties of undefined (reading 'x')"))).toBe(false);
  });

  it('reloads into the new build once; everything else that fails meanwhile waits for it', async () => {
    stubReload();
    const page = await nextPage();
    const failing = page.fresh(() => Promise.reject(new TypeError('Importing a module script failed.')));
    let settled = false;
    const watch = (p: Promise<unknown>) =>
      void p.then(
        () => (settled = true),
        () => (settled = true),
      );
    watch(failing());
    watch(failing());
    await new Promise((r) => setTimeout(r, 0));
    expect(reload).toHaveBeenCalledTimes(1);
    expect(settled).toBe(false);
  });

  it('lets the error through when the new page fails again within a minute (a real outage, no loop)', async () => {
    stubReload();
    const first = await nextPage();
    void first.fresh(() => Promise.reject(new TypeError('Importing a module script failed.')))();
    await new Promise((r) => setTimeout(r, 0));
    expect(reload).toHaveBeenCalledTimes(1);
    vi.resetModules();
    const second = await nextPage();
    await expect(second.fresh(() => Promise.reject(new TypeError('Importing a module script failed.')))()).rejects.toThrow('Importing a module script failed.');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('never cancels Vite’s preload error, so a lazy import can’t resolve to nothing (#19)', async () => {
    stubReload();
    const page = await nextPage();
    const e = new Event('vite:preloadError', { cancelable: true });
    window.addEventListener('vite:preloadError', page.onPreloadError);
    window.dispatchEvent(e);
    window.removeEventListener('vite:preloadError', page.onPreloadError);
    expect(e.defaultPrevented).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('passes real errors and successful loads straight through', async () => {
    stubReload();
    await expect(fresh(() => Promise.resolve(42))()).resolves.toBe(42);
    await expect(fresh(() => Promise.reject(new Error('boom')))()).rejects.toThrow('boom');
    expect(reload).not.toHaveBeenCalled();
    expect(onPreloadError).toBeTypeOf('function');
  });
});
