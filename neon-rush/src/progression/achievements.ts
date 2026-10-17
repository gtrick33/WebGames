import type { RunStats } from '../game/world';
import type { Profile } from './profile';

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  reward: number;
  target: number;
  /** Current progress toward `target`, given the profile (already updated) and the last run if any. */
  progress: (p: Profile, run: RunStats | null) => number;
  /** Single-run achievements only count the run that just finished. */
  perRun?: boolean;
}

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: 'first_run', name: 'Ignition', description: 'Finish your first run.', reward: 50, target: 1, progress: (p) => p.gamesPlayed },
  { id: 'dist_500', name: 'Warming Up', description: 'Drive 500 m in a single run.', reward: 75, target: 500, progress: (p) => p.bestDistance },
  { id: 'dist_1500', name: 'Cruise Control', description: 'Drive 1,500 m in a single run.', reward: 150, target: 1500, progress: (p) => p.bestDistance },
  { id: 'dist_3000', name: 'Light Speed', description: 'Drive 3,000 m in a single run. Unlocks Retro Arcade.', reward: 300, target: 3000, progress: (p) => p.bestDistance },
  { id: 'coins_50_run', name: 'Pocket Change', description: 'Collect 50 coins in a single run.', reward: 100, target: 50, perRun: true, progress: (_p, r) => r?.coins ?? 0 },
  { id: 'near_10_run', name: 'Daredevil', description: 'Get 10 near misses in a single run.', reward: 150, target: 10, perRun: true, progress: (_p, r) => r?.nearMisses ?? 0 },
  { id: 'combo_5', name: 'Thread the Needle', description: 'Reach a x5 near miss combo.', reward: 150, target: 5, perRun: true, progress: (_p, r) => r?.bestCombo ?? 0 },
  { id: 'collector', name: 'Collector', description: 'Collect 1,000 coins in total.', reward: 200, target: 1000, progress: (p) => p.totalCoins },
  { id: 'regular', name: 'Regular', description: 'Play 25 runs.', reward: 200, target: 25, progress: (p) => p.gamesPlayed },
  { id: 'new_paint', name: 'New Paint', description: 'Own 2 car skins.', reward: 50, target: 2, progress: (p) => p.ownedSkins.length },
  { id: 'level_5', name: 'Rising Star', description: 'Reach level 5.', reward: 250, target: 5, progress: (p) => p.level },
  { id: 'near_100_total', name: 'Phantom Driver', description: '100 near misses in total. Unlocks Phantom Chrome.', reward: 300, target: 100, progress: (p) => p.totalNearMisses },
];

export function getAchievement(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

/**
 * Unlock newly completed achievements and grant their rewards exactly once.
 * Safe to call repeatedly: already-unlocked achievements are skipped.
 */
export function evaluateAchievements(profile: Profile, run: RunStats | null, now = Date.now()): AchievementDef[] {
  const unlocked: AchievementDef[] = [];
  for (const a of ACHIEVEMENTS) {
    if (profile.achievements[a.id] !== undefined) continue;
    if (a.perRun && !run) continue;
    if (a.progress(profile, run) >= a.target) {
      profile.achievements[a.id] = now;
      profile.coins += a.reward;
      unlocked.push(a);
    }
  }
  return unlocked;
}
