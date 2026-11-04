import { loadAdSense } from './adScript';
import { ADS } from './env';

/**
 * The optional ad a player chooses to watch for a reward, through Google's Ad Placement API. Its rules, which this
 * follows: the player opts in by pressing a button, the ad only plays from that press, the reward is only given once
 * the ad was watched, and the reward has no value outside the site (an extra try here). Ordinary AdSense units may
 * not be used this way, and Google approves an account for this separately (docs/LEGAL-READINESS.md).
 */
interface AdBreak {
  type: 'reward';
  name: string;
  beforeAd?: () => void;
  afterAd?: () => void;
  beforeReward: (show: () => void) => void;
  adDismissed: () => void;
  adViewed: () => void;
  adBreakDone: () => void;
}

interface AdWindow {
  adsbygoogle?: unknown[];
  adBreak?: (o: AdBreak) => void;
  adConfig?: (o: Record<string, unknown>) => void;
}

function setup(): AdWindow {
  const w = window as unknown as AdWindow;
  if (!w.adBreak) {
    w.adsbygoogle = w.adsbygoogle ?? [];
    // Google's documented shim: both calls queue on adsbygoogle until the script has loaded
    const push = (o: unknown): void => void w.adsbygoogle!.push(o);
    w.adBreak = push;
    w.adConfig = push;
    loadAdSense(ADS.client, ADS.test);
    w.adConfig({ preloadAdBreaks: 'on' });
  }
  return w;
}

export interface RewardedCalls {
  /** An ad is ready: `show` must be called from the player's own press. Without an ad this is never called. */
  onReady: (show: () => void) => void;
  /** The ad was watched to the end: give the reward. */
  onReward: () => void;
  /** It's over, however it went (no ad, dismissed, watched). */
  onDone: () => void;
  /** Quiet the game's sound while the ad plays. */
  onAdStart?: () => void;
  onAdEnd?: () => void;
}

export function prepareRewarded(name: string, c: RewardedCalls): void {
  setup().adBreak?.({
    type: 'reward',
    name,
    beforeAd: c.onAdStart,
    afterAd: c.onAdEnd,
    beforeReward: c.onReady,
    adDismissed: () => undefined,
    adViewed: c.onReward,
    adBreakDone: c.onDone,
  });
}
