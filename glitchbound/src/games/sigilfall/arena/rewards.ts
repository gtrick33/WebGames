import type { Look } from '../progress/wardrobe';
import { bestRating, RANKS } from './ranks';

/**
 * What the Ring gives: every rank reached is a title (progress/titles.ts) and a suit of Ringforged armor in that
 * rank's own colors, a helm and a harness for the Wardrobe. They are earned by the best rating this device has seen
 * the player reach and kept for good; any class wears them, on any hero and in plain clothes. The armor is one set of
 * shapes (render3d/armorKit.ts `ringforged`) in six colorways (main, trim, cloth, glow): iron for the first blood, then
 * richer metal and brighter light the higher the rank.
 */

export interface RingReward {
  /** The rating it is earned at (a rank's own). */
  at: number;
  rank: string;
  color: string;
  /** What its helm and harness are called. */
  helm: string;
  harness: string;
  colors: [string, string, string, string];
}

const SUITS: Record<number, Pick<RingReward, 'helm' | 'harness' | 'colors'>> = {
  1150: { helm: 'Blooded Helm', harness: 'Blooded Harness', colors: ['#6c717c', '#c8a868', '#6a2a2a', '#ffd9a0'] },
  1300: { helm: 'Sandwalker Helm', harness: 'Sandwalker Harness', colors: ['#a8763a', '#ead7a0', '#3f6a34', '#9df07a'] },
  1500: { helm: 'Pit Veteran’s Helm', harness: 'Pit Veteran’s Harness', colors: ['#3e4654', '#5ab0ff', '#1d2f55', '#8fd0ff'] },
  1700: { helm: 'Bladeward Helm', harness: 'Bladeward Harness', colors: ['#cfd6e4', '#b48cff', '#3d2a78', '#d6c0ff'] },
  1900: { helm: 'Ring-Warden’s Helm', harness: 'Ring-Warden’s Harness', colors: ['#f1e9d6', '#ffb45c', '#8e1f2c', '#ffe6a8'] },
  2100: { helm: 'Ashbreaker Helm', harness: 'Ashbreaker Regalia', colors: ['#27222a', '#ff5a3a', '#4a1418', '#ff8a4a'] },
};

/** Every reward, lowest rank first (the first rank is where everyone starts: it gives nothing). */
export const RING_REWARDS: readonly RingReward[] = RANKS.filter((r) => r.at > 0 && SUITS[r.at]).map((r) => ({ at: r.at, rank: r.name, color: r.color, ...SUITS[r.at]! }));

export const ringLookId = (at: number, slot: 'head' | 'chest'): string => `ring-${at}-${slot}`;

/** The Wardrobe looks the rewards are (two each). */
export const RING_LOOKS: readonly (Look & { ring: number })[] = RING_REWARDS.flatMap((r) =>
  (['head', 'chest'] as const).map((slot) => ({
    id: ringLookId(r.at, slot),
    slot,
    name: slot === 'head' ? r.helm : r.harness,
    icon: slot === 'head' ? ('helm' as const) : ('plate' as const),
    mat: 'plate' as const,
    tint: r.colors[0],
    r: 'legendary' as const,
    set: 'ringforged',
    colors: [...r.colors],
    authored: true,
    shop: true,
    ring: r.at,
  })),
);

const BY_ID = new Map(RING_LOOKS.map((l) => [l.id, l]));

/** A Ring reward look by its id (earned or not), or undefined. */
export const ringLook = (id: string): (Look & { ring: number }) | undefined => BY_ID.get(id);

/** Whether the look is a Ring reward this device's player has earned. */
export const ownsRingLook = (id: string): boolean => {
  const l = BY_ID.get(id);
  return !!l && bestRating() >= l.ring;
};

/** The Ring looks earned so far, highest first. */
export const ownedRingLooks = (): Look[] => {
  const best = bestRating();
  return RING_LOOKS.filter((l) => best >= l.ring).reverse();
};

/** The rewards a climb from one best rating to another has just earned. */
export const rewardsBetween = (was: number, now: number): RingReward[] => RING_REWARDS.filter((r) => r.at > was && r.at <= now);

/** The next reward above a rating, or null at the top. */
export const nextReward = (best: number): RingReward | null => RING_REWARDS.find((r) => r.at > best) ?? null;
