import { daysBetween } from '../core/dates';
import type { Profile } from './profile';

/** Rewards for consecutive daily logins; the cycle repeats after day 7. */
export const DAILY_REWARDS = [50, 75, 100, 125, 150, 200, 300] as const;

export function dailyRewardFor(streak: number): number {
  const idx = (Math.max(1, streak) - 1) % DAILY_REWARDS.length;
  return DAILY_REWARDS[idx] ?? DAILY_REWARDS[0];
}

export function canClaimDaily(profile: Profile, today: string): boolean {
  return profile.daily.lastClaimDay !== today;
}

/** Streak the player would have if they claimed today. */
export function nextStreak(profile: Profile, today: string): number {
  const last = profile.daily.lastClaimDay;
  if (!last) return 1;
  const gap = daysBetween(last, today);
  return gap === 1 ? profile.daily.streak + 1 : gap === 0 ? profile.daily.streak : 1;
}

export interface DailyClaim {
  amount: number;
  streak: number;
}

/** Claim today's reward. Returns null if it was already claimed today (repeat taps are harmless). */
export function claimDaily(profile: Profile, today: string): DailyClaim | null {
  if (!canClaimDaily(profile, today)) return null;
  const streak = nextStreak(profile, today);
  const amount = dailyRewardFor(streak);
  profile.daily = { lastClaimDay: today, streak };
  profile.coins += amount;
  return { amount, streak };
}
