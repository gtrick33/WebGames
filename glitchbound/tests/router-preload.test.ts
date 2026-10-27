import { afterEach, describe, expect, it, vi } from 'vitest';
import { navigate, prefetchPage, setPagePreloader } from '../src/router/router';

/**
 * Switching pages waits a moment for the next page's code (owner, 2026-10-27: "whenever i switch tabs there's
 * minor jitter"): the old page stays until the new one can show whole, instead of an empty page with the
 * footer pulled up under the header.
 */

const deferred = () => {
  let done!: () => void;
  const promise = new Promise<void>((r) => (done = r));
  return { promise, done };
};

afterEach(() => {
  setPagePreloader(() => undefined);
  window.history.replaceState(null, '', '/');
  vi.useRealTimers();
});

describe('page switches', () => {
  it('stay on the old page until the new page’s code is here', async () => {
    const code = deferred();
    let loaded = false;
    setPagePreloader((path) => (path === '/daily' && !loaded ? code.promise.then(() => void (loaded = true)) : undefined));
    navigate('/daily');
    expect(window.location.pathname).toBe('/');
    code.done();
    await vi.waitFor(() => expect(window.location.pathname).toBe('/daily'));
  });

  it('go at once when the code is already here, and a newer switch wins over one still waiting', async () => {
    const slow = deferred();
    setPagePreloader((path) => (path === '/party' ? slow.promise : undefined));
    navigate('/party');
    navigate('/about');
    expect(window.location.pathname).toBe('/about');
    slow.done();
    await slow.promise;
    await new Promise((r) => setTimeout(r, 0));
    expect(window.location.pathname).toBe('/about');
  });

  it('give up waiting after a moment on a slow connection', async () => {
    vi.useFakeTimers();
    setPagePreloader(() => new Promise(() => undefined));
    navigate('/leaderboards');
    expect(window.location.pathname).toBe('/');
    await vi.advanceTimersByTimeAsync(800);
    expect(window.location.pathname).toBe('/leaderboards');
  });

  it('start loading a linked page’s code on hover, but not the page already open', () => {
    const asked: string[] = [];
    setPagePreloader((path) => (asked.push(path), undefined));
    prefetchPage('/games/quizbelief?c=1');
    prefetchPage('/');
    prefetchPage('https://example.com/x');
    expect(asked).toEqual(['/games/quizbelief']);
  });
});
