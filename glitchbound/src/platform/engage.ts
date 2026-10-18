import { currentStreak } from './daily';
import { parseDayKey } from './dates';
import { getLang, t } from '../i18n';

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

export interface SweepShare {
  title: string;
  /** For chats: the emoji row with ✓/✗ per game, how many are done and the streak. */
  text: string;
  /** For the picture card, which draws the game tiles instead of the emoji row. */
  cardLines: string[];
}

/**
 * The Daily Sweep, spoiler-free: one row of game emoji with ✓ (done) or ✗ (not yet), then how many
 * are done and the streak. e.g.
 *   GlitchBound · Daily sweep! 🧹 Oct 18
 *   🧠✓ 🎨✓ 🔤✓ 🏎️✗
 *   3 of 4 done · 🔥 12 day streak
 */
export function sweepShare(opts: { day: string; games: { emoji?: string; done: boolean }[]; streak: number; url: string }): SweepShare {
  const done = opts.games.filter((g) => g.done).length;
  const lang = getLang();
  const date = parseDayKey(opts.day).toLocaleDateString(lang === 'en' ? 'en-US' : lang, { month: 'short', day: 'numeric' });
  const head = done === opts.games.length ? `${t('Daily sweep!')} 🧹` : t('Today’s dailies');
  const facts = [t('{a} of {b} done', { a: done, b: opts.games.length })];
  if (opts.streak > 0) facts.push(`🔥 ${t('{n} day streak', { n: opts.streak })}`);
  const row = opts.games.map((g) => `${g.emoji ?? '🎮'}${g.done ? '✓' : '✗'}`).join(' ');
  return {
    title: `GlitchBound · ${head}`,
    text: [`GlitchBound · ${head} ${date}`, row, facts.join(' · '), opts.url].join('\n'),
    cardLines: [head, `${date} · ${facts[0]}`, ...facts.slice(1)],
  };
}
