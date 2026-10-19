import { useEffect, useState } from 'react';
import { useT } from '../i18n';
import './DailyCompare.css';

/** Below this many players the comparison is not shown (a young arcade shouldn't say "3 played"). */
export const MIN_PLAYERS = 20;

/** The share of today's other players a score beat (ties don't count as beaten), 0–100. */
export function beatShare(players: number, below: number): number {
  return Math.max(0, Math.min(100, Math.round((100 * below) / Math.max(1, players - 1))));
}

/**
 * "You beat 64% of today's players · 212 played": a daily result next to everyone else's (built from
 * anonymous game-end events, see functions/api/daily-stats.ts). Hidden until enough people played.
 */
export function DailyCompare({ game, day, score }: { game: string; day: string; score: number }) {
  const t = useT();
  const [stats, setStats] = useState<{ players: number; below: number } | null>(null);
  useEffect(() => {
    let live = true;
    // A moment's wait so this round's own event has reached the server.
    const id = window.setTimeout(() => {
      fetch(`/api/daily-stats?game=${encodeURIComponent(game)}&day=${day}&score=${score}`)
        .then((r) => (r.ok ? (r.json() as Promise<{ players: number; below: number }>) : null))
        .then((s) => live && s && setStats(s))
        .catch(() => undefined);
    }, 1500);
    return () => {
      live = false;
      window.clearTimeout(id);
    };
  }, [game, day, score]);
  if (!stats || stats.players < MIN_PLAYERS) return null;
  return (
    <p className="daily-compare" role="status">
      <b>{t('You beat {pct}% of today’s players', { pct: beatShare(stats.players, stats.below) })}</b>
      <span className="mono">{t('{n} played today', { n: stats.players.toLocaleString() })}</span>
    </p>
  );
}
