import type { AdProvider, InterstitialPlacement, InterstitialResult, RewardedPlacement } from './ads';

/**
 * Google H5 Games Ads (Ad Placement API) provider.
 * Follows https://developers.google.com/ad-placement : a single adsbygoogle.js script, and the
 * adBreak()/adConfig() functions defined via the documented push shim.
 * Requires an approved AdSense account with H5 Games Ads access. Inactive unless a publisher id
 * (ca-pub-...) is configured at build time.
 */

interface PlacementInfo {
  breakType?: string;
  breakName?: string;
  breakFormat?: string;
  breakStatus?: string;
}

interface AdBreakConfig {
  type: string;
  name: string;
  beforeAd?: () => void;
  afterAd?: () => void;
  beforeReward?: (showAdFn: () => void) => void;
  adDismissed?: () => void;
  adViewed?: () => void;
  adBreakDone?: (info: PlacementInfo) => void;
}

interface AdConfigOptions {
  preloadAdBreaks?: 'on' | 'auto';
  sound?: 'on' | 'off';
  onReady?: () => void;
}

type AdsQueue = unknown[] & { push: (o: unknown) => number };

declare global {
  interface Window {
    adsbygoogle?: AdsQueue;
  }
}

export interface AdSenseOptions {
  /** AdSense publisher id, e.g. "ca-pub-1234567890123456". Public, not a secret. */
  client: string;
  /** Google's testing mode (data-adbreak-test="on"). Must be off for real traffic. */
  testMode: boolean;
  soundOn: () => boolean;
  /** Mute/pause game audio while an ad plays. */
  onAdStart: () => void;
  onAdEnd: () => void;
}

const CLIENT_RE = /^ca-pub-\d{10,20}$/;

export function isValidAdSenseClient(id: string | undefined): id is string {
  return typeof id === 'string' && CLIENT_RE.test(id);
}

export class AdSenseH5Provider implements AdProvider {
  readonly name = 'adsense-h5';
  readonly isMock = false;
  private ready = false;
  private adBreak: ((o: AdBreakConfig) => void) | null = null;
  private adConfig: ((o: AdConfigOptions) => void) | null = null;

  constructor(private readonly opts: AdSenseOptions) {}

  async init(): Promise<void> {
    if (!isValidAdSenseClient(this.opts.client) || typeof document === 'undefined') return;
    const script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(this.opts.client)}`;
    if (this.opts.testMode) script.setAttribute('data-adbreak-test', 'on');
    script.onerror = () => {
      // Blocked by an ad blocker or offline: the game simply runs without ads.
      this.ready = false;
    };
    document.head.appendChild(script);

    // The documented shim: adBreak and adConfig both push onto the adsbygoogle queue.
    window.adsbygoogle = window.adsbygoogle || ([] as unknown as AdsQueue);
    const push = (o: unknown) => {
      window.adsbygoogle?.push(o);
    };
    this.adBreak = push;
    this.adConfig = push;
    this.adConfig({
      preloadAdBreaks: 'on',
      sound: this.opts.soundOn() ? 'on' : 'off',
      onReady: () => {
        this.ready = true;
      },
    });
  }

  /** Keep Google informed when the player toggles sound. */
  setSound(on: boolean): void {
    this.adConfig?.({ sound: on ? 'on' : 'off' });
  }

  isRewardedReady(): boolean {
    return this.ready;
  }

  isInterstitialReady(): boolean {
    return this.ready;
  }

  showRewarded(placement: RewardedPlacement, onReward: (token: string) => void): Promise<'closed' | 'failed'> {
    const adBreak = this.adBreak;
    if (!adBreak || !this.ready) return Promise.resolve('failed');
    return new Promise((resolve) => {
      let settled = false;
      const done = (r: 'closed' | 'failed') => {
        if (!settled) {
          settled = true;
          resolve(r);
        }
      };
      adBreak({
        type: 'reward',
        name: placement,
        beforeAd: () => this.opts.onAdStart(),
        afterAd: () => this.opts.onAdEnd(),
        // The player already accepted the explained reward by tapping "Double coins", so show it now.
        beforeReward: (showAdFn) => showAdFn(),
        adDismissed: () => undefined,
        // Only this callback grants the reward (Google confirms the ad was watched).
        adViewed: () => onReward(`h5-${placement}-${Date.now()}`),
        adBreakDone: (info) => done(info.breakStatus === 'viewed' || info.breakStatus === 'dismissed' ? 'closed' : 'failed'),
      });
      // Safety net if Google never calls back (blocked script, network issues).
      setTimeout(() => done('failed'), 90_000);
    });
  }

  showInterstitial(placement: InterstitialPlacement): Promise<InterstitialResult> {
    const adBreak = this.adBreak;
    if (!adBreak || !this.ready) return Promise.resolve('skipped');
    return new Promise((resolve) => {
      let settled = false;
      const done = (r: InterstitialResult) => {
        if (!settled) {
          settled = true;
          resolve(r);
        }
      };
      adBreak({
        type: 'next',
        name: placement,
        beforeAd: () => this.opts.onAdStart(),
        afterAd: () => this.opts.onAdEnd(),
        adBreakDone: (info) => done(info.breakStatus === 'viewed' ? 'shown' : info.breakStatus === 'error' ? 'failed' : 'skipped'),
      });
      setTimeout(() => done('skipped'), 30_000);
    });
  }
}
