import { afterEach, describe, expect, it, vi } from 'vitest';
import { fresh, isStaleBuildError } from '../src/platform/freshBuild';

describe('stale build after a deploy (#15-#18)', () => {
  const reload = vi.fn();
  const realLocation = window.location;
  const stubReload = () => Object.defineProperty(window, 'location', { configurable: true, value: { ...realLocation, reload } });
  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: realLocation });
    sessionStorage.clear();
    reload.mockReset();
  });

  it('recognises a missing code file in every browser, and nothing else', () => {
    expect(isStaleBuildError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isStaleBuildError(new TypeError('Failed to fetch dynamically imported module: https://x/assets/Game-abc.js'))).toBe(true);
    expect(isStaleBuildError(new TypeError('error loading dynamically imported module'))).toBe(true);
    expect(isStaleBuildError('Importing a module script failed.')).toBe(true);
    expect(isStaleBuildError(new TypeError("Cannot read properties of undefined (reading 'x')"))).toBe(false);
  });

  it('reloads into the new build once, then lets the error through', async () => {
    stubReload();
    const failing = fresh(() => Promise.reject(new TypeError('Importing a module script failed.')));
    let settled = false;
    void failing().then(
      () => (settled = true),
      () => (settled = true),
    );
    await new Promise((r) => setTimeout(r, 0));
    expect(reload).toHaveBeenCalledTimes(1);
    expect(settled).toBe(false);
    // A second failure within a minute is a real outage: no reload loop, the error shows.
    await expect(failing()).rejects.toThrow('Importing a module script failed.');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('passes real errors and successful loads straight through', async () => {
    stubReload();
    await expect(fresh(() => Promise.resolve(42))()).resolves.toBe(42);
    await expect(fresh(() => Promise.reject(new Error('boom')))()).rejects.toThrow('boom');
    expect(reload).not.toHaveBeenCalled();
  });
});
