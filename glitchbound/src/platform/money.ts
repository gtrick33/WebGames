import { NO_MONEY, type MoneySettings } from '../catalog/settings';
import { ADS } from './env';
import { useLiveCatalog } from './liveCatalog';

/**
 * Ads and the shop, as the admins have set them (Admin › Ads & shop). Everything is off until the owner opens it, and
 * off means nothing loads and nothing shows: no ad script, no Shop tab, and the legal pages say there is nothing to buy.
 * docs/LEGAL-READINESS.md lists what must be done before each switch goes on.
 */
export const useMoney = (): MoneySettings => useLiveCatalog().raw.money ?? NO_MONEY;

/** Banner ads need the AdSense settings in the build and the admins' switch. */
export const bannersOn = (m: MoneySettings): boolean => ADS.enabled && m.ads;

/** The optional "watch an ad for one more try" needs the same, and its own switch (Google approves it separately). */
export const rewardedOn = (m: MoneySettings): boolean => ADS.enabled && m.rewarded;
