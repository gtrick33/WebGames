/**
 * Advertising abstraction. The game ships with NoAdProvider in production until a real network
 * is integrated following that network's official documentation. MockAdProvider exists for local
 * development only and is never selected in a production build.
 */

export type RewardedPlacement = 'double_coins';
export type InterstitialPlacement = 'between_runs';

export type RewardedResult =
  | { status: 'completed'; token: string }
  | { status: 'cancelled' | 'failed' | 'unavailable' | 'busy' | 'blocked' };

export type InterstitialResult = 'shown' | 'skipped' | 'failed';

export interface AdProvider {
  readonly name: string;
  /** True for development stand-ins. Mock impressions are never revenue. */
  readonly isMock: boolean;
  init(): Promise<void>;
  isRewardedReady(): boolean;
  isInterstitialReady(): boolean;
  /**
   * Show a rewarded ad. `onReward` must be invoked only when the network confirms the reward
   * (it may be invoked more than once by buggy SDKs; AdManager de-duplicates).
   */
  showRewarded(placement: RewardedPlacement, onReward: (token: string) => void): Promise<'closed' | 'failed'>;
  showInterstitial(placement: InterstitialPlacement): Promise<InterstitialResult>;
}

export class NoAdProvider implements AdProvider {
  readonly name = 'none';
  readonly isMock = false;
  async init(): Promise<void> {}
  isRewardedReady(): boolean {
    return false;
  }
  isInterstitialReady(): boolean {
    return false;
  }
  async showRewarded(): Promise<'closed' | 'failed'> {
    return 'failed';
  }
  async showInterstitial(): Promise<InterstitialResult> {
    return 'skipped';
  }
}

export type MockAdOutcome = 'complete' | 'cancel' | 'fail';
/** Renders the clearly-labelled dev mock ad and resolves with what the developer clicked. */
export type MockAdPresenter = (kind: 'rewarded' | 'interstitial') => Promise<MockAdOutcome>;

export class MockAdProvider implements AdProvider {
  readonly name = 'mock';
  readonly isMock = true;
  private counter = 0;

  constructor(private readonly present: MockAdPresenter, private readonly opts: { duplicateCallbacks?: boolean } = {}) {}

  async init(): Promise<void> {}
  isRewardedReady(): boolean {
    return true;
  }
  isInterstitialReady(): boolean {
    return true;
  }

  async showRewarded(_placement: RewardedPlacement, onReward: (token: string) => void): Promise<'closed' | 'failed'> {
    const outcome = await this.present('rewarded');
    if (outcome === 'fail') return 'failed';
    if (outcome === 'complete') {
      const token = `mock-${Date.now()}-${++this.counter}`;
      onReward(token);
      // Simulate a misbehaving SDK firing the reward callback twice.
      if (this.opts.duplicateCallbacks) onReward(token);
    }
    return 'closed';
  }

  async showInterstitial(): Promise<InterstitialResult> {
    const outcome = await this.present('interstitial');
    return outcome === 'fail' ? 'failed' : 'shown';
  }
}

export interface AdPolicy {
  /** Never show an interstitial before this many completed runs in a session. */
  firstInterstitialAfterRuns: number;
  /** Then at most once every N completed runs... */
  interstitialEveryRuns: number;
  /** ...and never more often than this. */
  interstitialMinIntervalMs: number;
  maxInterstitialsPerSession: number;
  maxRewardedPerSession: number;
}

export const DEFAULT_AD_POLICY: AdPolicy = {
  firstInterstitialAfterRuns: 4,
  interstitialEveryRuns: 4,
  interstitialMinIntervalMs: 4 * 60_000,
  maxInterstitialsPerSession: 3,
  maxRewardedPerSession: 10,
};

export interface AdManagerDeps {
  isRunActive: () => boolean;
  hasNoAdsEntitlement: () => boolean;
  now?: () => number;
}

/** Enforces placement rules and frequency caps on top of any provider. */
export class AdManager {
  private busy = false;
  private runsSinceInterstitial = 0;
  private completedRuns = 0;
  private lastInterstitialAt = -Infinity;
  private interstitialsShown = 0;
  private rewardedShown = 0;
  private readonly now: () => number;

  constructor(readonly provider: AdProvider, private readonly policy: AdPolicy, private readonly deps: AdManagerDeps) {
    this.now = deps.now ?? (() => Date.now());
  }

  get isMock(): boolean {
    return this.provider.isMock;
  }

  /** Whether to show the (always optional, user-initiated) rewarded button. */
  canOfferRewarded(): boolean {
    return !this.busy && !this.deps.isRunActive() && this.rewardedShown < this.policy.maxRewardedPerSession && this.provider.isRewardedReady();
  }

  /**
   * Show a rewarded ad after an explicit user action. Resolves 'completed' at most once,
   * only when the provider confirmed the reward.
   */
  async showRewarded(placement: RewardedPlacement): Promise<RewardedResult> {
    if (this.deps.isRunActive()) return { status: 'blocked' };
    if (this.busy) return { status: 'busy' };
    if (!this.canOfferRewarded()) return { status: 'unavailable' };
    this.busy = true;
    let token: string | null = null;
    try {
      const closed = await this.provider.showRewarded(placement, (t) => {
        if (token === null) token = t; // ignore duplicate callbacks
      });
      this.rewardedShown++;
      if (token !== null) return { status: 'completed', token };
      return { status: closed === 'failed' ? 'failed' : 'cancelled' };
    } catch {
      return { status: 'failed' };
    } finally {
      this.busy = false;
    }
  }

  /** Call when a run has fully ended (game over shown). */
  onRunCompleted(): void {
    this.completedRuns++;
    this.runsSinceInterstitial++;
  }

  shouldShowInterstitial(): boolean {
    if (this.deps.hasNoAdsEntitlement() || this.deps.isRunActive() || this.busy) return false;
    if (this.interstitialsShown >= this.policy.maxInterstitialsPerSession) return false;
    if (this.completedRuns < this.policy.firstInterstitialAfterRuns) return false;
    if (this.runsSinceInterstitial < this.policy.interstitialEveryRuns) return false;
    if (this.now() - this.lastInterstitialAt < this.policy.interstitialMinIntervalMs) return false;
    return this.provider.isInterstitialReady();
  }

  /** Only ever called between runs (after game over, before the next run starts). */
  async maybeShowInterstitial(): Promise<boolean> {
    if (!this.shouldShowInterstitial()) return false;
    this.busy = true;
    try {
      const r = await this.provider.showInterstitial('between_runs');
      if (r === 'shown') {
        this.interstitialsShown++;
        this.runsSinceInterstitial = 0;
        this.lastInterstitialAt = this.now();
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      this.busy = false;
    }
  }
}
