/**
 * The ad rules with ads switched on (the build's settings stubbed): where a banner may show, when Google's script loads,
 * and the optional ad for one more try, which only plays from the player's press and only rewards a finished ad.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NO_MONEY } from '../src/catalog/settings';
import { AdRetry } from '../src/components/AdRetry';
import { AdSlot } from '../src/components/AdSlot';
import { setCatalog } from '../src/platform/liveCatalog';

vi.mock('../src/platform/env', async (load) => ({
  ...(await load<typeof import('../src/platform/env')>()),
  ADS: { client: 'ca-pub-1234567890', enabled: true, test: false, slots: { home: '111', game: '222' } },
}));

let seen: ((entries: { isIntersecting: boolean }[]) => void) | null = null;

beforeEach(() => {
  seen = null;
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
        seen = cb;
      }
      observe(): void {}
      disconnect(): void {}
    },
  );
  setCatalog({ settings: {}, picks: {}, notice: null, money: { ...NO_MONEY, ads: true, rewarded: true } });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  setCatalog({ settings: {}, picks: {}, notice: null });
  delete (window as unknown as { adBreak?: unknown }).adBreak;
  delete (window as unknown as { adConfig?: unknown }).adConfig;
  delete (window as unknown as { adsbygoogle?: unknown }).adsbygoogle;
});

describe('a banner', () => {
  it('shows labeled, and Google’s script waits until it is about to be seen', () => {
    const { container } = render(<AdSlot placement="home" />);
    expect(screen.getByText('Advertisement')).toBeTruthy();
    expect(container.querySelector('ins.adsbygoogle')?.getAttribute('data-ad-slot')).toBe('111');
    expect(document.querySelector('script[src*="googlesyndication"]')).toBeNull();
    act(() => seen?.([{ isIntersecting: true }]));
    expect(document.querySelector('script[src*="googlesyndication"]')).not.toBeNull();
  });

  it('never shows on an adults-only page', () => {
    const { container } = render(<AdSlot placement="game" adult />);
    expect(container.innerHTML).toBe('');
  });

  it('can be hidden place by place, and goes with the master switch', () => {
    setCatalog({ settings: {}, picks: {}, notice: null, money: { ...NO_MONEY, ads: true, adsGame: false } });
    const { container, rerender } = render(<AdSlot placement="game" />);
    expect(container.innerHTML).toBe('');
    rerender(<AdSlot placement="home" />);
    expect(container.querySelector('ins')).not.toBeNull();
    act(() => setCatalog({ settings: {}, picks: {}, notice: null, money: { ...NO_MONEY, ads: false } }));
    expect(container.innerHTML).toBe('');
  });
});

describe('the optional ad for one more try', () => {
  /** The adBreak call the page made, as Google's script would receive it. */
  const lastBreak = (): { type: string; beforeReward: (show: () => void) => void; adViewed: () => void; adBreakDone: () => void } => {
    const queue = (window as unknown as { adsbygoogle: Record<string, unknown>[] }).adsbygoogle;
    return queue.filter((o) => o.type === 'reward').at(-1) as never;
  };

  it('shows nothing until Google has an ad ready', () => {
    const { container } = render(<AdRetry name="daily-retry-crosswire" onRetry={() => undefined} />);
    expect(container.innerHTML).toBe('');
    expect(lastBreak().type).toBe('reward');
  });

  it('plays only from the player’s press, and only a finished ad gives the try', () => {
    const onRetry = vi.fn();
    const showAd = vi.fn();
    render(<AdRetry name="daily-retry-crosswire" onRetry={onRetry} />);
    act(() => lastBreak().beforeReward(showAd));
    expect(showAd).not.toHaveBeenCalled();
    expect(screen.getByText('This extra try doesn’t count for the boards.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Watch a short ad/ }));
    expect(showAd).toHaveBeenCalledOnce();
    // dismissed or not finished: no reward
    expect(onRetry).not.toHaveBeenCalled();
    act(() => lastBreak().adViewed());
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('goes away when there is no ad', () => {
    const { container } = render(<AdRetry name="daily-retry-crosswire" onRetry={() => undefined} />);
    act(() => lastBreak().beforeReward(() => undefined));
    expect(container.innerHTML).not.toBe('');
    act(() => lastBreak().adBreakDone());
    expect(container.innerHTML).toBe('');
  });
});
