import { describe, expect, it } from 'vitest';
import { AdManager, MockAdProvider, NoAdProvider, DEFAULT_AD_POLICY, type AdProvider } from '../src/monetization/ads';
import { CATALOG, DisabledPurchaseProvider, MockPurchaseProvider, grantPurchase } from '../src/monetization/purchases';
import { selectProviders } from '../src/monetization/providers';
import { createProfile } from '../src/progression/profile';

function manager(provider: AdProvider, opts: { running?: () => boolean; noAds?: () => boolean; now?: () => number } = {}) {
  return new AdManager(provider, DEFAULT_AD_POLICY, {
    isRunActive: opts.running ?? (() => false),
    hasNoAdsEntitlement: opts.noAds ?? (() => false),
    now: opts.now,
  });
}

describe('ads', () => {
  it('no provider: nothing offered, game continues', async () => {
    const m = manager(new NoAdProvider());
    expect(m.canOfferRewarded()).toBe(false);
    expect((await m.showRewarded('double_coins')).status).toBe('unavailable');
    for (let i = 0; i < 20; i++) m.onRunCompleted();
    expect(await m.maybeShowInterstitial()).toBe(false);
  });

  it('never shows anything during an active run', async () => {
    let shown = 0;
    const m = manager(new MockAdProvider(async () => { shown++; return 'complete'; }), { running: () => true });
    expect((await m.showRewarded('double_coins')).status).toBe('blocked');
    for (let i = 0; i < 20; i++) m.onRunCompleted();
    expect(m.shouldShowInterstitial()).toBe(false);
    expect(await m.maybeShowInterstitial()).toBe(false);
    expect(shown).toBe(0);
  });

  it('rewards only on confirmed completion, de-duplicating callbacks', async () => {
    const ok = manager(new MockAdProvider(async () => 'complete', { duplicateCallbacks: true }));
    const r = await ok.showRewarded('double_coins');
    expect(r.status).toBe('completed');
    expect((await manager(new MockAdProvider(async () => 'cancel')).showRewarded('double_coins')).status).toBe('cancelled');
    expect((await manager(new MockAdProvider(async () => 'fail')).showRewarded('double_coins')).status).toBe('failed');
  });

  it('refuses a second concurrent rewarded request', async () => {
    let release: (v: 'complete') => void = () => {};
    const m = manager(new MockAdProvider(() => new Promise((r) => (release = r))));
    const first = m.showRewarded('double_coins');
    expect((await m.showRewarded('double_coins')).status).toBe('busy');
    release('complete');
    expect((await first).status).toBe('completed');
  });

  it('a throwing provider fails safely', async () => {
    const bad: AdProvider = { ...new NoAdProvider(), name: 'bad', isMock: false, isRewardedReady: () => true, isInterstitialReady: () => true, init: async () => {}, showRewarded: async () => { throw new Error('sdk'); }, showInterstitial: async () => { throw new Error('sdk'); } };
    const m = manager(bad);
    expect((await m.showRewarded('double_coins')).status).toBe('failed');
  });

  it('caps interstitial frequency and respects no_ads', async () => {
    let t = 0;
    const m = manager(new MockAdProvider(async () => 'complete'), { now: () => t });
    for (let i = 0; i < DEFAULT_AD_POLICY.firstInterstitialAfterRuns - 1; i++) m.onRunCompleted();
    expect(m.shouldShowInterstitial()).toBe(false);
    m.onRunCompleted();
    t = 10 * 60_000;
    expect(await m.maybeShowInterstitial()).toBe(true);
    for (let i = 0; i < DEFAULT_AD_POLICY.interstitialEveryRuns; i++) m.onRunCompleted();
    t += 60_000; // too soon
    expect(m.shouldShowInterstitial()).toBe(false);
    t += DEFAULT_AD_POLICY.interstitialMinIntervalMs;
    expect(m.shouldShowInterstitial()).toBe(true);

    const noAds = manager(new MockAdProvider(async () => 'complete'), { noAds: () => true, now: () => 1e12 });
    for (let i = 0; i < 50; i++) noAds.onRunCompleted();
    expect(noAds.shouldShowInterstitial()).toBe(false);
  });
});

describe('purchases', () => {
  it('disabled provider sells nothing', async () => {
    const d = new DisabledPurchaseProvider();
    expect(d.isAvailable()).toBe(false);
    expect(await d.getProducts()).toEqual([]);
    expect((await d.purchase()).status).toBe('unavailable');
  });

  it('refuses unverified real transactions and de-duplicates', () => {
    const p = createProfile();
    expect(grantPurchase(p, { status: 'success', productId: 'coins_small', transactionId: 'tx1', verified: false }, { allowUnverifiedMock: true })).toBe('unverified');
    expect(grantPurchase(p, { status: 'success', productId: 'coins_small', transactionId: 'tx1', verified: true }, { allowUnverifiedMock: false })).toBe('granted');
    expect(grantPurchase(p, { status: 'success', productId: 'coins_small', transactionId: 'tx1', verified: true }, { allowUnverifiedMock: false })).toBe('duplicate');
    expect(p.coins).toBe(createProfile().coins + 1000);
    expect(grantPurchase(p, { status: 'success', productId: 'nope', transactionId: 'tx2', verified: true }, { allowUnverifiedMock: false })).toBe('unknown_product');
  });

  it('mock purchases only grant when explicitly allowed (dev)', async () => {
    const mock = new MockPurchaseProvider(async () => 'success');
    const r = await mock.purchase('no_ads');
    expect(r.status).toBe('success');
    if (r.status !== 'success') return;
    expect(r.verified).toBe(false);
    const p = createProfile();
    expect(grantPurchase(p, r, { allowUnverifiedMock: false })).toBe('unverified');
    expect(grantPurchase(p, r, { allowUnverifiedMock: true })).toBe('granted');
    expect(p.entitlements).toContain('no_ads');
    expect(CATALOG.every((c) => c.priceLabel.length > 0)).toBe(true);
  });

  it('production builds never get mock providers', () => {
    const ui = { presentMockAd: async () => 'complete' as const, confirmMockPurchase: async () => 'success' as const };
    const prod = selectProviders({ DEV: false, VITE_AD_PROVIDER: 'mock', VITE_PURCHASE_PROVIDER: 'mock' }, ui);
    expect(prod.ads.name).toBe('none');
    expect(prod.purchases.name).toBe('disabled');
    const dev = selectProviders({ DEV: true }, ui);
    expect(dev.ads.isMock).toBe(true);
    expect(dev.purchases.isMock).toBe(true);
  });
});
