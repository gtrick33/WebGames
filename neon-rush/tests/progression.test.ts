import { describe, expect, it } from 'vitest';
import { createProfile } from '../src/progression/profile';
import { computeRunRewards, finishRun, grantRewardOnce } from '../src/progression/run';
import { addXp, xpToNext } from '../src/progression/levels';
import { ACHIEVEMENTS, evaluateAchievements } from '../src/progression/achievements';
import { applyRunToChallenges, challengesForDay } from '../src/progression/challenges';
import { DAILY_REWARDS, canClaimDaily, claimDaily } from '../src/progression/daily';
import { daysBetween, dayKey } from '../src/core/dates';
import { runStats } from './fixtures';

describe('run rewards', () => {
  it('pays coins collected plus a distance bonus', () => {
    const r = computeRunRewards(runStats({ meters: 1234.9, coins: 30, nearMisses: 2 }));
    expect(r.coinsCollected).toBe(30);
    expect(r.distanceBonus).toBe(12);
    expect(r.coinsEarned).toBe(42);
    expect(r.xpEarned).toBe(123 + 30 + 10);
  });

  it('finishRun updates records and is idempotent per run id', () => {
    const p = createProfile();
    const start = p.coins;
    const s = finishRun(p, 'run-1', runStats({ meters: 800, coins: 20, score: 1000 }), '2026-10-17', 1);
    expect(s).not.toBeNull();
    expect(p.gamesPlayed).toBe(1);
    expect(p.bestDistance).toBe(800);
    expect(p.bestScore).toBe(1000);
    expect(s!.newBestScore).toBe(true);
    const coinsAfter = p.coins;
    expect(coinsAfter).toBeGreaterThanOrEqual(start + 28);
    // Duplicate callback: nothing more is granted.
    expect(finishRun(p, 'run-1', runStats({ meters: 800, coins: 20, score: 1000 }), '2026-10-17', 1)).toBeNull();
    expect(p.coins).toBe(coinsAfter);
    expect(p.gamesPlayed).toBe(1);
  });

  it('grantRewardOnce never pays twice', () => {
    const p = createProfile();
    expect(grantRewardOnce(p, 'ad:double:r1', 25)).toBe(true);
    expect(grantRewardOnce(p, 'ad:double:r1', 25)).toBe(false);
    expect(grantRewardOnce(p, 'ad:double:r2', 0)).toBe(false);
    expect(p.coins).toBe(createProfile().coins + 25);
  });
});

describe('levels', () => {
  it('levels up with rewards and carries XP over', () => {
    const p = createProfile();
    const need = xpToNext(1) + xpToNext(2);
    const ups = addXp(p, need + 5);
    expect(ups.map((u) => u.level)).toEqual([2, 3]);
    expect(p.level).toBe(3);
    expect(p.xp).toBe(5);
    expect(p.coins).toBeGreaterThan(createProfile().coins);
  });

  it('level 3 unlocks Lime Circuit through play', () => {
    const p = createProfile();
    const s = finishRun(p, 'r', runStats({ meters: 4000, coins: 120, nearMisses: 10 }), '2026-10-17');
    expect(p.level).toBeGreaterThanOrEqual(3);
    expect(p.ownedSkins).toContain('lime_circuit');
    expect(s!.skinsUnlocked.map((x) => x.id)).toContain('lime_circuit');
  });
});

describe('achievements', () => {
  it('unlock once and pay once', () => {
    const p = createProfile();
    p.gamesPlayed = 1;
    const first = evaluateAchievements(p, null, 1);
    expect(first.map((a) => a.id)).toContain('first_run');
    const coins = p.coins;
    expect(evaluateAchievements(p, null, 2)).toEqual([]);
    expect(p.coins).toBe(coins);
  });

  it('per-run achievements only count the run', () => {
    const p = createProfile();
    expect(evaluateAchievements(p, null).some((a) => a.id === 'near_10_run')).toBe(false);
    expect(evaluateAchievements(p, runStats({ nearMisses: 10 })).some((a) => a.id === 'near_10_run')).toBe(true);
  });

  it('3000 m unlocks Retro Arcade', () => {
    const p = createProfile();
    finishRun(p, 'long', runStats({ meters: 3100 }), '2026-10-17');
    expect(p.achievements.dist_3000).toBeDefined();
    expect(p.ownedSkins).toContain('retro_arcade');
  });

  it('has unique ids', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
  });
});

describe('daily challenges', () => {
  it('are deterministic per day and distinct', () => {
    const a = challengesForDay('2026-10-17');
    expect(a).toHaveLength(3);
    expect(challengesForDay('2026-10-17')).toEqual(a);
    expect(new Set(a.map((c) => c.metric)).size).toBe(3);
  });

  it('track progress, pay once and reset on a new day', () => {
    const p = createProfile();
    const day = '2026-10-17';
    const list = challengesForDay(day);
    const big = runStats({ meters: 7000, coins: 100, nearMisses: 20, powerups: 5 });
    let paid = 0;
    for (let i = 0; i < 6; i++) paid += applyRunToChallenges(p, big, day).length;
    expect(paid).toBe(list.length);
    expect(p.challenges.claimed).toHaveLength(list.length);
    applyRunToChallenges(p, runStats(), '2026-10-18');
    expect(p.challenges.day).toBe('2026-10-18');
    expect(p.challenges.claimed.every((id) => id.startsWith('2026-10-18'))).toBe(true);
  });
});

describe('daily login reward', () => {
  it('claims once per day and grows the streak on consecutive days', () => {
    const p = createProfile();
    const c1 = claimDaily(p, '2026-10-17');
    expect(c1).toEqual({ amount: DAILY_REWARDS[0], streak: 1 });
    expect(claimDaily(p, '2026-10-17')).toBeNull();
    expect(canClaimDaily(p, '2026-10-17')).toBe(false);
    expect(claimDaily(p, '2026-10-18')!.streak).toBe(2);
    expect(claimDaily(p, '2026-10-20')!.streak).toBe(1); // missed a day
  });

  it('cycles after seven days', () => {
    const p = createProfile();
    const amounts: number[] = [];
    for (let d = 1; d <= 8; d++) amounts.push(claimDaily(p, `2026-11-${String(d).padStart(2, '0')}`)!.amount);
    expect(amounts.slice(0, 7)).toEqual([...DAILY_REWARDS]);
    expect(amounts[7]).toBe(DAILY_REWARDS[0]);
  });

  it('date helpers handle month boundaries', () => {
    expect(daysBetween('2026-10-31', '2026-11-01')).toBe(1);
    expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
