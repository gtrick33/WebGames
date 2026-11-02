import type { GameEntry, ScoreLimits } from '../src/catalog/types';

/** Why a finished round can't be real (the 422 `error` of /api/runs/end and a challenge's score). */
export type Refusal = 'bad_score' | 'too_fast' | 'implausible_score' | 'above_max' | 'bad_stats';

/** Points allowed on top of the per-second rate (a game's first seconds, rounding). */
export const slackOf = (l: ScoreLimits): number => l.slack ?? Math.min(50, 10 * l.scorePerSecond);

/**
 * Checks a finished round against the game's registry `limits`, `seconds` after the server saw it start.
 * `round` marks a challenge round, which also has to fit `roundMax`. Returns '' for a plausible round.
 * Shared by leaderboard runs and challenge scores, so both refuse the same impossible rounds.
 */
export function refusal(game: GameEntry, score: number, stats: Record<string, number>, seconds: number, round = false): Refusal | '' {
  if (!(Number.isFinite(score) && score >= 0 && score <= 1e9)) return 'bad_score';
  const l = game.limits;
  if (!l) return '';
  if (seconds < (l.minSeconds ?? 1)) return 'too_fast';
  const max = Math.min(l.maxScore ?? Infinity, round ? (l.roundMax ?? Infinity) : Infinity);
  if (score > max) return 'above_max';
  if (score > l.scorePerSecond * seconds + slackOf(l)) return 'implausible_score';
  for (const [key, cap] of Object.entries(l.stats ?? {})) {
    const v = stats[key];
    if (v === undefined) continue;
    if (!Number.isFinite(v) || (cap.min !== undefined && v < cap.min) || (cap.max !== undefined && v > cap.max)) return 'bad_stats';
    if (cap.perSecond !== undefined && v > cap.perSecond * seconds + Math.max(1, Math.min(50, 10 * cap.perSecond))) return 'bad_stats';
  }
  const sum = (weights: Record<string, number>): number => Object.entries(weights).reduce((n, [k, w]) => n + w * (stats[k] ?? 0), 0);
  // Checked when the round reports those stats (a round without them has nothing to contradict its score).
  const reported = (weights: Record<string, number>): boolean => Object.keys(weights).every((k) => stats[k] !== undefined);
  if (l.scoreIs && reported(l.scoreIs) && score !== sum(l.scoreIs)) return 'bad_stats';
  if (l.scoreAtMost && reported(l.scoreAtMost) && score > sum(l.scoreAtMost)) return 'implausible_score';
  return '';
}
