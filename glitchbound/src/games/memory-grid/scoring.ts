/** Memory Grid scoring and the numbers reported to the arcade. Pure. */
import type { Level, Mode } from './pattern';

/** Points for completing a pattern: 10 per step on 3x3, 15 on 4x4, 20 on 5x5. */
export function patternPoints(level: Pick<Level, 'size' | 'length'>): number {
  return level.length * (10 + (level.size - 3) * 5);
}

/** Perfect Recall: bonus for clearing the whole ladder, more for doing it quickly (player's-turn time only). */
export function perfectBonus(inputMs: number): number {
  return 500 + Math.max(0, Math.round(500 - inputMs / 100));
}

export interface RunSummary {
  mode: Mode;
  score: number;
  cleared: number;
  longest: number;
  accuracy: number;
  taps: number;
  inputMs: number;
  complete: boolean;
}

/**
 * Stats for host.report({ type: 'end' }). Keys match the registry entry. `time` is only sent for a completed
 * Perfect Recall run, because it is a lower-is-better record and a partial run has no completion time.
 */
export function reportStats(r: RunSummary): Record<string, number> {
  const stats: Record<string, number> = { longest: r.longest, patterns: r.cleared, accuracy: r.accuracy };
  if (r.mode === 'perfect' && r.complete) stats.time = Math.max(1, Math.round(r.inputMs / 1000));
  return stats;
}

export const MODE_NAMES: Record<Mode, string> = { classic: 'Classic', speed: 'Speed Run', daily: 'Daily Challenge', perfect: 'Perfect Recall' };

/** The run as a streak of squares: one 🟩 per pattern, then how it ended (never which tiles were lit). */
export function resultLine(r: Pick<RunSummary, 'mode' | 'cleared' | 'complete'>, ladder = 10): string {
  if (r.mode === 'perfect') return '🟩'.repeat(r.cleared) + (r.complete ? '' : '🟥' + '⬜'.repeat(Math.max(0, ladder - r.cleared - 1)));
  return '🟩'.repeat(Math.min(r.cleared, 20)) + (r.cleared > 20 ? '+' : '') + (r.complete ? '' : r.mode === 'speed' ? '⏱️' : '🟥');
}

/**
 * Spoiler-free share text: how far the run got (one square per pattern), never which tiles were lit.
 * Daily results name the date so friends compare the same puzzle.
 */
export function shareText(r: RunSummary & { day: string; streak: number; ladder?: number }): string {
  const squares = resultLine(r, r.ladder);
  const head = r.mode === 'daily' ? `Memory Grid · Daily ${r.day}` : `Memory Grid · ${MODE_NAMES[r.mode]}`;
  const facts = [`${r.score} pts`, `longest ${r.longest}`, `${r.accuracy}% accuracy`];
  if (r.mode === 'daily' && r.streak > 1) facts.push(`🔥 ${r.streak}-day streak`);
  return `${head}\n${squares}\n${facts.join(' · ')}`;
}

/** Whether `next` beats `best` (undefined = no previous record). */
export function isBetter(next: number, best: number | undefined, lowerIsBetter = false): boolean {
  if (best === undefined) return true;
  return lowerIsBetter ? next < best : next > best;
}
