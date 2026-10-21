import { describe, expect, it } from 'vitest';
import { notifyHost, runEndMessage } from '../src/analytics/embed';
import { runStats } from './fixtures';

function fakeWindow(embedded: boolean) {
  const sent: { data: unknown; origin: string }[] = [];
  const parent = { postMessage: (data: unknown, origin: string) => sent.push({ data, origin }) };
  const win = embedded ? { parent } : ({} as { parent: unknown });
  if (!embedded) win.parent = win;
  return { win: win as unknown as Window, sent };
}

describe('host embed bridge', () => {
  it('posts versioned start and end messages to the parent when embedded', () => {
    const { win, sent } = fakeWindow(true);
    notifyHost({ type: 'start' }, win);
    notifyHost(runEndMessage(runStats({ score: 1234, meters: 987.6, coins: 41, nearMisses: 7 })), win);
    expect(sent).toEqual([
      { data: { source: 'glitchbound-game', version: 1, type: 'start' }, origin: '*' },
      { data: { source: 'glitchbound-game', version: 1, type: 'end', score: 1234, stats: { meters: 987, coins: 41, nearMisses: 7 } }, origin: '*' },
    ]);
  });

  it('does nothing when the game is the top-level page', () => {
    const { win, sent } = fakeWindow(false);
    notifyHost({ type: 'start' }, win);
    expect(sent).toHaveLength(0);
  });

  it('never throws if posting fails', () => {
    const win = { parent: { postMessage: () => { throw new Error('blocked'); } } } as unknown as Window;
    expect(() => notifyHost({ type: 'start' }, win)).not.toThrow();
  });
});

describe('host commands', () => {
  function host() {
    const listeners: ((e: MessageEvent) => void)[] = [];
    const parent = {};
    const win = {
      parent,
      addEventListener: (_: string, fn: (e: MessageEvent) => void) => listeners.push(fn),
      removeEventListener: () => undefined,
    } as unknown as Window;
    const send = (data: unknown, source: unknown = parent) => listeners.forEach((fn) => fn({ data, source } as MessageEvent));
    return { win, send };
  }

  it('accepts identity and pause from the parent window only', async () => {
    const { listenToHost } = await import('../src/analytics/embed');
    const { win, send } = host();
    const got: unknown[] = [];
    listenToHost((c) => got.push(c), win);
    send({ source: 'glitchbound-host', version: 1, type: 'identity', name: 'BraveFox27' });
    send({ source: 'glitchbound-host', version: 1, type: 'pause' });
    send({ source: 'glitchbound-host', version: 1, type: 'pause' }, {}); // not the parent
    send({ source: 'other', version: 1, type: 'pause' });
    send({ source: 'glitchbound-host', version: 2, type: 'pause' });
    expect(got).toEqual([{ type: 'identity', name: 'BraveFox27' }, { type: 'pause' }]);
  });

  it('accepts a challenge seed (whole numbers only) and its end', async () => {
    const { listenToHost } = await import('../src/analytics/embed');
    const { win, send } = host();
    const got: unknown[] = [];
    listenToHost((c) => got.push(c), win);
    send({ source: 'glitchbound-host', version: 1, type: 'challenge', seed: 123456 });
    send({ source: 'glitchbound-host', version: 1, type: 'challenge', seed: 1.5 });
    send({ source: 'glitchbound-host', version: 1, type: 'challenge', seed: 'x' });
    send({ source: 'glitchbound-host', version: 1, type: 'challenge', seed: null });
    expect(got).toEqual([{ type: 'challenge', seed: 123456 }, { type: 'challenge', seed: null }]);
  });

  it('accepts coin gifts (positive whole numbers only)', async () => {
    const { listenToHost } = await import('../src/analytics/embed');
    const { win, send } = host();
    const got: unknown[] = [];
    listenToHost((c) => got.push(c), win);
    send({ source: 'glitchbound-host', version: 1, type: 'coins', amount: 500 });
    send({ source: 'glitchbound-host', version: 1, type: 'coins', amount: -5 });
    send({ source: 'glitchbound-host', version: 1, type: 'coins', amount: 2.5 });
    send({ source: 'glitchbound-host', version: 1, type: 'coins', amount: '100' });
    send({ source: 'glitchbound-host', version: 1, type: 'coins', amount: 1e12 });
    send({ source: 'glitchbound-host', version: 1, type: 'coins', amount: 50 }, {}); // not the parent
    expect(got).toEqual([{ type: 'coins', amount: 500 }]);
  });

  it('learns whether the arcade menu is available (true/false only)', async () => {
    const { listenToHost } = await import('../src/analytics/embed');
    const { win, send } = host();
    const got: unknown[] = [];
    listenToHost((c) => got.push(c), win);
    send({ source: 'glitchbound-host', version: 1, type: 'menu', available: true });
    send({ source: 'glitchbound-host', version: 1, type: 'menu', available: 'yes' });
    send({ source: 'glitchbound-host', version: 1, type: 'menu', available: false });
    expect(got).toEqual([{ type: 'menu', available: true }, { type: 'menu', available: false }]);
  });
});
