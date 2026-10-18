import type { GameEntry } from '../catalog/types';
import type { BestView } from './apiTypes';

export interface BestEntry {
  game: GameEntry;
  best: BestView;
  /** Share of players at or above this score (0.01 = top 1%), or null when the rank is unknown. */
  top: number | null;
}

/**
 * A member's bests ordered by how impressive they are: crowns first, then the best leaderboard
 * percentile, then the most recent. Games with very few players count a little less, so being #1 of
 * 2 does not outrank top 3% of 400.
 */
export function rankBests(bests: Record<string, BestView>, games: readonly GameEntry[]): BestEntry[] {
  const list: BestEntry[] = [];
  for (const game of games) {
    const best = bests[game.slug];
    if (!best) continue;
    const top = best.rank && best.players ? best.rank / best.players : null;
    list.push({ game, best, top });
  }
  const weight = (e: BestEntry): number => {
    if (e.top === null || !e.best.players) return 2;
    // Small boards are shrunk towards the middle (as if a few average players were added).
    return (e.best.rank! + 1) / (e.best.players + 2);
  };
  return list.sort((a, b) => {
    const crownA = a.best.rank === 1 ? 0 : 1;
    const crownB = b.best.rank === 1 ? 0 : 1;
    if (crownA !== crownB) return crownA - crownB;
    const d = weight(a) - weight(b);
    return d !== 0 ? d : b.best.at - a.best.at;
  });
}

/** "Top 3%" style label, or null when not meaningful. */
export function topLabel(e: BestEntry): string | null {
  if (e.best.rank === 1) return '#1';
  if (e.top === null || (e.best.players ?? 0) < 5) return null;
  const pct = Math.max(1, Math.ceil(e.top * 100));
  return pct <= 50 ? `Top ${pct}%` : null;
}
