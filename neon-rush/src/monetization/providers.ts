import { DEFAULT_AD_POLICY, MockAdProvider, NoAdProvider, type AdPolicy, type AdProvider, type MockAdPresenter } from './ads';
import { AdSenseH5Provider, isValidAdSenseClient, type AdSenseOptions } from './adsense';
import { DisabledPurchaseProvider, MockPurchaseProvider, type MockPurchaseOutcome, type Product, type PurchaseProvider } from './purchases';

export interface MonetizationConfig {
  ads: AdProvider;
  purchases: PurchaseProvider;
  adPolicy: AdPolicy;
}

/**
 * Pick providers from build-time env. Mock providers are only allowed in development builds:
 * a production build always gets the "none"/"disabled" providers until real ones are integrated.
 */
export function selectProviders(
  env: { DEV: boolean; VITE_AD_PROVIDER?: string; VITE_PURCHASE_PROVIDER?: string; VITE_ADSENSE_CLIENT?: string; VITE_ADSENSE_TEST?: string; VITE_ADS_ENABLED?: string },
  ui: { presentMockAd: MockAdPresenter; confirmMockPurchase: (p: Product) => Promise<MockPurchaseOutcome> },
  adHooks?: Omit<AdSenseOptions, 'client' | 'testMode'>,
): MonetizationConfig {
  // `import.meta.env.DEV` is a compile-time constant, so production bundles drop the mock classes entirely.
  const dev = import.meta.env.DEV && env.DEV;
  const adChoice = env.VITE_AD_PROVIDER ?? (dev ? 'mock' : 'none');
  const purchaseChoice = env.VITE_PURCHASE_PROVIDER ?? (dev ? 'mock' : 'disabled');
  // Real Google ads need a valid publisher id AND the explicit VITE_ADS_ENABLED=on switch
  // (the id alone only publishes ads.txt, e.g. for AdSense site verification before approval).
  const wantAdSense =
    isValidAdSenseClient(env.VITE_ADSENSE_CLIENT) && env.VITE_ADS_ENABLED === 'on' && (!dev || adChoice === 'adsense');
  const ads: AdProvider = wantAdSense
    ? new AdSenseH5Provider({
        client: env.VITE_ADSENSE_CLIENT as string,
        testMode: env.VITE_ADSENSE_TEST === 'on',
        soundOn: adHooks?.soundOn ?? (() => true),
        onAdStart: adHooks?.onAdStart ?? (() => undefined),
        onAdEnd: adHooks?.onAdEnd ?? (() => undefined),
      })
    : dev && adChoice === 'mock'
      ? new MockAdProvider(ui.presentMockAd)
      : new NoAdProvider();
  const purchases: PurchaseProvider =
    dev && purchaseChoice === 'mock' ? new MockPurchaseProvider(ui.confirmMockPurchase) : new DisabledPurchaseProvider();
  return { ads, purchases, adPolicy: DEFAULT_AD_POLICY };
}
