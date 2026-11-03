import type { RunStats } from '../game/world';
import { evaluateAchievements, type AchievementDef } from './achievements';
import { applyRunToChallenges, type Challenge } from './challenges';
import { addXp, type LevelUp } from './levels';
import { markOnce, type Profile } from './profile';
import { syncSkinUnlocks } from '../cosmetics/shop';
import type { SkinDef } from '../cosmetics/skins';

export interface RunRewards {
  coinsCollected: number;
  distanceBonus: number;
  coinsEarned: number;
  xpEarned: number;
}

/** Coins and XP for a run. Coins collected count 1:1, plus a small distance bonus. */
export function computeRunRewards(stats: RunStats): RunRewards {
  const meters = Math.max(0, Math.floor(stats.meters));
  const coinsCollected = Math.max(0, Math.floor(stats.coins));
  const distanceBonus = Math.floor(meters / 100);
  return {
    coinsCollected,
    distanceBonus,
    coinsEarned: coinsCollected + distanceBonus,
    xpEarned: Math.floor(meters / 10) + coinsCollected + stats.nearMisses * 5,
  };
}

/** A run left from the pause menu counts as played only once it got this far. */
export const MIN_COUNTED_SECONDS = 10;
export const MIN_COUNTED_METERS = 200;

/** Whether a run counts toward "runs played" (missions, achievements). Crashed runs always do. */
export function countsAsPlayed(stats: RunStats, abandoned: boolean): boolean {
  return !abandoned || stats.time >= MIN_COUNTED_SECONDS || stats.meters >= MIN_COUNTED_METERS;
}

export interface RunSummary {
  runId: string;
  stats: RunStats;
  rewards: RunRewards;
  newBestScore: boolean;
  newBestDistance: boolean;
  levelUps: LevelUp[];
  achievements: AchievementDef[];
  challenges: Challenge[];
  skinsUnlocked: SkinDef[];
}

/**
 * Apply a finished run to the profile. Idempotent per runId: calling it twice for the same run
 * (double callbacks, re-renders) returns null the second time and grants nothing. An `abandoned`
 * run (left from the pause menu) still pays what it earned, but a very short one isn't a run played.
 */
export function finishRun(profile: Profile, runId: string, stats: RunStats, day: string, now = Date.now(), abandoned = false): RunSummary | null {
  if (!markOnce(profile.processedRunIds, runId, 50)) return null;
  const rewards = computeRunRewards(stats);
  const meters = Math.floor(stats.meters);
  const newBestScore = stats.score > profile.bestScore;
  const newBestDistance = meters > profile.bestDistance;

  const played = countsAsPlayed(stats, abandoned);
  if (played) profile.gamesPlayed += 1;
  profile.lifetimeDistance += meters;
  profile.totalCoins += rewards.coinsCollected;
  profile.totalNearMisses += stats.nearMisses;
  profile.bestScore = Math.max(profile.bestScore, stats.score);
  profile.bestDistance = Math.max(profile.bestDistance, meters);
  profile.coins += rewards.coinsEarned;

  const levelUps = addXp(profile, rewards.xpEarned);
  const challenges = applyRunToChallenges(profile, stats, day, played);
  const achievements = evaluateAchievements(profile, stats, now);
  const skinsUnlocked = syncSkinUnlocks(profile);
  // Unlocking a skin may complete "own N skins".
  achievements.push(...evaluateAchievements(profile, null, now));

  return { runId, stats, rewards, newBestScore, newBestDistance, levelUps, achievements, challenges, skinsUnlocked };
}

/** Grant a one-off reward (e.g. rewarded ad bonus) exactly once per reward id. */
export function grantRewardOnce(profile: Profile, rewardId: string, coins: number): boolean {
  if (coins <= 0 || !markOnce(profile.grantedRewardIds, rewardId, 100)) return false;
  profile.coins += Math.floor(coins);
  return true;
}
