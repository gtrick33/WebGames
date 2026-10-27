import { afterEach, describe, expect, it, vi } from 'vitest';
import { installErrorReporting, isBenignError, setActiveGame } from '../src/platform/analytics';

describe('crash reports', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('knows a ResizeObserver loop is browser noise, not a crash (issue #23)', () => {
    expect(isBenignError('ResizeObserver loop completed with undelivered notifications. @ launch-control:0')).toBe(true);
    expect(isBenignError('ResizeObserver loop limit exceeded')).toBe(true);
    expect(isBenignError("TypeError: undefined is not an object (evaluating 'a.b')")).toBe(false);
  });

  it('files script errors mid-game, but not the ResizeObserver loop', () => {
    vi.stubEnv('PROD', true);
    const fetch = vi.fn(() => Promise.resolve(new Response('{}')));
    vi.stubGlobal('fetch', fetch);
    installErrorReporting();
    const unset = setActiveGame('launch-control');
    window.dispatchEvent(new ErrorEvent('error', { message: 'ResizeObserver loop completed with undelivered notifications.' }));
    window.dispatchEvent(new ErrorEvent('error', { message: 'ResizeObserver loop limit exceeded' }));
    expect(fetch).not.toHaveBeenCalled();
    window.dispatchEvent(new ErrorEvent('error', { message: 'TypeError: boom', filename: 'https://x/assets/Game.js', lineno: 3 }));
    unset();
    expect(fetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body)) as { kind: string; game: string; message: string };
    expect(body).toMatchObject({ kind: 'js_error', game: 'launch-control', message: 'TypeError: boom @ Game.js:3' });
  });
});
