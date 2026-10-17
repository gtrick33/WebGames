import { markOnce, type Profile } from '../progression/profile';

/**
 * Real-money purchase abstraction. Production ships with DisabledPurchaseProvider.
 * A real provider must use the payment method required by the distribution platform
 * (e.g. App Store / Google Play billing inside native apps) and must verify every
 * transaction on a trusted server before any entitlement is granted.
 */

export type ProductKind = 'consumable' | 'non_consumable';

export interface Product {
  id: string;
  title: string;
  description: string;
  kind: ProductKind;
  /** Display price from the store. Mock prices are labelled as such in the UI. */
  priceLabel: string;
  grants: { coins?: number; skins?: string[]; entitlements?: string[] };
}

export type PurchaseResult =
  | { status: 'success'; productId: string; transactionId: string; verified: boolean }
  | { status: 'cancelled' | 'failed' | 'unavailable' | 'pending' };

export interface PurchaseProvider {
  readonly name: string;
  readonly isMock: boolean;
  isAvailable(): boolean;
  getProducts(): Promise<Product[]>;
  purchase(productId: string): Promise<PurchaseResult>;
}

export const CATALOG: readonly Product[] = [
  { id: 'coins_small', title: 'Coin Stack', description: '1,000 coins', kind: 'consumable', priceLabel: '$0.99', grants: { coins: 1000 } },
  { id: 'coins_large', title: 'Coin Vault', description: '6,000 coins', kind: 'consumable', priceLabel: '$4.99', grants: { coins: 6000 } },
  {
    id: 'bundle_night', title: 'Night Shift Bundle', description: 'Crimson Racer, Purple Vaporwave and Midnight Black',
    kind: 'non_consumable', priceLabel: '$2.99', grants: { skins: ['crimson', 'vaporwave', 'midnight'] },
  },
  { id: 'no_ads', title: 'Remove Ads', description: 'No interstitial ads, ever. Rewarded ads stay optional.', kind: 'non_consumable', priceLabel: '$2.99', grants: { entitlements: ['no_ads'] } },
];

export class DisabledPurchaseProvider implements PurchaseProvider {
  readonly name = 'disabled';
  readonly isMock = false;
  isAvailable(): boolean {
    return false;
  }
  async getProducts(): Promise<Product[]> {
    return [];
  }
  async purchase(): Promise<PurchaseResult> {
    return { status: 'unavailable' };
  }
}

export type MockPurchaseOutcome = 'success' | 'cancel' | 'fail';

/** Development stand-in. Transactions are fake, flagged unverified and prefixed "mock_". */
export class MockPurchaseProvider implements PurchaseProvider {
  readonly name = 'mock';
  readonly isMock = true;
  private n = 0;
  constructor(private readonly confirm: (p: Product) => Promise<MockPurchaseOutcome>) {}
  isAvailable(): boolean {
    return true;
  }
  async getProducts(): Promise<Product[]> {
    return [...CATALOG];
  }
  async purchase(productId: string): Promise<PurchaseResult> {
    const product = CATALOG.find((p) => p.id === productId);
    if (!product) return { status: 'failed' };
    const outcome = await this.confirm(product);
    if (outcome === 'cancel') return { status: 'cancelled' };
    if (outcome === 'fail') return { status: 'failed' };
    return { status: 'success', productId, transactionId: `mock_${Date.now()}_${++this.n}`, verified: false };
  }
}

export type GrantResult = 'granted' | 'duplicate' | 'unverified' | 'unknown_product';

/**
 * Apply a purchase to the profile exactly once per transaction id.
 * Unverified transactions are refused unless they come from the dev mock provider
 * (and the mock is only ever constructed in development builds).
 */
export function grantPurchase(
  profile: Profile,
  result: Extract<PurchaseResult, { status: 'success' }>,
  opts: { allowUnverifiedMock: boolean },
): GrantResult {
  const product = CATALOG.find((p) => p.id === result.productId);
  if (!product) return 'unknown_product';
  const isMockTx = result.transactionId.startsWith('mock_');
  if (!result.verified && !(opts.allowUnverifiedMock && isMockTx)) return 'unverified';
  if (!markOnce(profile.processedTransactions, result.transactionId, 200)) return 'duplicate';
  if (product.grants.coins) profile.coins += product.grants.coins;
  for (const s of product.grants.skins ?? []) if (!profile.ownedSkins.includes(s)) profile.ownedSkins.push(s);
  for (const e of product.grants.entitlements ?? []) if (!profile.entitlements.includes(e)) profile.entitlements.push(e);
  return 'granted';
}
