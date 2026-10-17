import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AdSenseH5Provider, isValidAdSenseClient } from '../src/monetization/adsense';
import { selectProviders } from '../src/monetization/providers';

type Pushed = Record<string, unknown> & {
  beforeReward?: (show: () => void) => void;
  adViewed?: () => void;
  adDismissed?: () => void;
  adBreakDone?: (i: { breakStatus: string }) => void;
  onReady?: () => void;
};

const g = globalThis as unknown as { window?: unknown; document?: unknown; adsbygoogle?: Pushed[] };

beforeEach(() => {
  const attrs: Record<string, string> = {};
  g.window = globalThis;
  g.document = { createElement: () => ({ setAttribute: (k: string, v: string) => (attrs[k] = v) }), head: { appendChild: () => undefined } };
  g.adsbygoogle = [];
});
afterEach(() => {
  delete g.window;
  delete g.document;
  delete g.adsbygoogle;
});

async function ready(): Promise<AdSenseH5Provider> {
  const p = new AdSenseH5Provider({ client: 'ca-pub-1234567890123456', testMode: true, soundOn: () => true, onAdStart: () => {}, onAdEnd: () => {} });
  await p.init();
  const cfg = g.adsbygoogle!.find((o) => typeof o.onReady === 'function');
  expect(cfg?.preloadAdBreaks).toBe('on');
  cfg!.onReady!();
  return p;
}

describe('Google H5 Games Ads provider', () => {
  it('validates publisher ids', () => {
    expect(isValidAdSenseClient('ca-pub-1234567890123456')).toBe(true);
    expect(isValidAdSenseClient('pub-123')).toBe(false);
    expect(isValidAdSenseClient(undefined)).toBe(false);
  });

  it('grants the reward only when Google reports the ad as viewed', async () => {
    const p = await ready();
    let rewards = 0;
    const pending = p.showRewarded('double_coins', () => rewards++);
    const brk = g.adsbygoogle!.at(-1)!;
    expect(brk.type).toBe('reward');
    let shown = false;
    brk.beforeReward!(() => (shown = true));
    expect(shown).toBe(true);
    brk.adViewed!();
    brk.adBreakDone!({ breakStatus: 'viewed' });
    expect(await pending).toBe('closed');
    expect(rewards).toBe(1);
  });

  it('gives nothing when dismissed or when no ad is available', async () => {
    const p = await ready();
    let rewards = 0;
    const dismissed = p.showRewarded('double_coins', () => rewards++);
    const b1 = g.adsbygoogle!.at(-1)!;
    b1.adDismissed!();
    b1.adBreakDone!({ breakStatus: 'dismissed' });
    expect(await dismissed).toBe('closed');
    const none = p.showRewarded('double_coins', () => rewards++);
    g.adsbygoogle!.at(-1)!.adBreakDone!({ breakStatus: 'noAdPreloaded' });
    expect(await none).toBe('failed');
    expect(rewards).toBe(0);
  });

  it('uses the "next" placement between runs', async () => {
    const p = await ready();
    const r = p.showInterstitial('between_runs');
    const b = g.adsbygoogle!.at(-1)!;
    expect(b.type).toBe('next');
    b.adBreakDone!({ breakStatus: 'frequencyCapped' });
    expect(await r).toBe('skipped');
  });

  it('is selected in production only with a valid publisher id', () => {
    const ui = { presentMockAd: async () => 'complete' as const, confirmMockPurchase: async () => 'success' as const };
    expect(selectProviders({ DEV: false, VITE_ADSENSE_CLIENT: 'ca-pub-1234567890123456', VITE_ADS_ENABLED: 'on' }, ui).ads.name).toBe('adsense-h5');
    // The publisher id alone (used for ads.txt verification) must not switch ads on.
    expect(selectProviders({ DEV: false, VITE_ADSENSE_CLIENT: 'ca-pub-1234567890123456' }, ui).ads.name).toBe('none');
    expect(selectProviders({ DEV: false, VITE_ADSENSE_CLIENT: 'garbage' }, ui).ads.name).toBe('none');
    expect(selectProviders({ DEV: false }, ui).ads.name).toBe('none');
  });
});
