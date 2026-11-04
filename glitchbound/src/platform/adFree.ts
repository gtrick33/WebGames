import { useAccount } from './account';

/** What a one-time purchase unlocks on this account (src/catalog/shop.ts). */
export const AD_FREE = 'ad-free';

/** This member bought the ad-free experience: no banners, and an extra try at a daily needs no ad. */
export function useAdFree(): boolean {
  return useAccount().me?.owned?.includes(AD_FREE) ?? false;
}
