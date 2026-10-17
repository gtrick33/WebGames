import type { Profile } from './profile';

/** XP needed to go from `level` to `level + 1`. */
export function xpToNext(level: number): number {
  return 100 + 75 * level;
}

export function levelReward(newLevel: number): number {
  return 40 * newLevel;
}

export interface LevelUp {
  level: number;
  reward: number;
}

/** Add XP, applying any level ups and their coin rewards. */
export function addXp(profile: Profile, amount: number): LevelUp[] {
  const ups: LevelUp[] = [];
  profile.xp += Math.max(0, Math.floor(amount));
  while (profile.xp >= xpToNext(profile.level)) {
    profile.xp -= xpToNext(profile.level);
    profile.level += 1;
    const reward = levelReward(profile.level);
    profile.coins += reward;
    ups.push({ level: profile.level, reward });
  }
  return ups;
}
