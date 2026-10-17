import type { RunStats } from '../src/game/world';

export function runStats(over: Partial<RunStats> = {}): RunStats {
  return { meters: 1000, coins: 30, score: 1300, nearMisses: 2, bestCombo: 2, powerups: 1, shieldSaves: 0, laneChanges: 20, time: 40, ...over };
}
