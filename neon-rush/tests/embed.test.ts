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
