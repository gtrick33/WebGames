import { currentStreak } from './daily';
import { parseDayKey } from './dates';

/**
 * Small retention helpers: the streak state shown in the header, and the Wordle-style "today's
 * dailies" share text. Pure, unit tested.
 */

export interface StreakState {
  streak: number;
  doneToday: boolean;
  /** A streak from yesterday that ends at midnight unless a daily is finished today. */
  atRisk: boolean;
}

export function streakState(done: ReadonlySet<string>, today: string): StreakState {
  const streak = currentStreak(done, today);
  const doneToday = done.has(today);
  return { streak, doneToday, atRisk: streak > 0 && !doneToday };
}

/** Spoiler-free summary of today's dailies across the arcade. */
export function sweepShareText(opts: { day: string; games: { title: string; done: boolean }[]; streak: number; url: string }): string {
  const done = opts.games.filter((g) => g.done).length;
  const date = parseDayKey(opts.day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const head = done === opts.games.length ? `GlitchBound ${date} · daily sweep! 🧹` : `GlitchBound ${date} · ${done}/${opts.games.length} dailies`;
  const lines = [head, ...opts.games.map((g) => `${g.done ? '✅' : '⬜'} ${g.title}`)];
  if (opts.streak > 0) lines.push(`🔥 ${opts.streak}-day streak`);
  lines.push(opts.url);
  return lines.join('\n');
}
