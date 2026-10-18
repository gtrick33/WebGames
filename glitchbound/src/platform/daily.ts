import type { DailyRules } from '../catalog/settings';
import type { GameEntry } from '../catalog/types';
import type { EndEvent } from './contract';
import { addDays, daysBetween, hashString } from './dates';

/** Day #1 of the GlitchBound daily challenge. */
export const DAILY_EPOCH = '2026-10-17';

export interface DailyChallenge {
  day: string;
  number: number;
  game: GameEntry;
  metric: string;
  target: number;
  unit: string;
  /** e.g. "Drive 1,800 m in a single run". */
  label: string;
  /** The label before the target was filled in ("Drive {n} m in a single run"), for translations. */
  template: string;
}

export const fmt = (n: number): string => Math.round(n).toLocaleString('en-US');

/**
 * Today's challenge, identical for every player on the same calendar day. Returns null when no game
 * in the catalog offers daily templates (then the arcade hides the daily feature instead of faking it).
 */
let defaultRules: DailyRules | null = null;

/** The browser's current admin rules (from /api/catalog). The server always passes rules explicitly. */
export function setDefaultDailyRules(rules: DailyRules | null): void {
  defaultRules = rules;
}

export function challengeForDay(day: string, games: GameEntry[], rules: DailyRules | null = defaultRules): DailyChallenge | null {
  const pool = games
    .filter((g) => (g.daily?.length ?? 0) > 0 && g.released <= day)
    .sort((a, b) => a.slug.localeCompare(b.slug));
  if (pool.length === 0) return null;
  const h = hashString(`glitchbound-daily-${day}`);
  // An admin's pick for the date wins. Otherwise the usual rotation, stepping past games the admins
  // took out (only the days that would have landed on them change).
  const pick = rules?.picks[day];
  let game = pick ? games.find((g) => g.slug === pick.slug && (g.daily?.length ?? 0) > 0) : undefined;
  if (!game) {
    const start = h % pool.length;
    for (let i = 0; i < pool.length && !game; i++) {
      const g = pool[(start + i) % pool.length]!;
      if (!rules?.exclude.has(g.slug)) game = g;
    }
    if (!game) return null;
  }
  const picked = pick && pick.slug === game.slug ? pick : null;
  const templates = game.daily!;
  const tpl = (picked?.template !== null && picked?.template !== undefined ? templates[picked.template] : undefined) ?? templates[(h >>> 8) % templates.length]!;
  const target = picked?.target ?? tpl.targets[(h >>> 16) % tpl.targets.length]!;
  const unit = game.stats.find((s) => s.key === tpl.metric)?.unit ?? '';
  return {
    day,
    number: Math.max(1, daysBetween(DAILY_EPOCH, day) + 1),
    game,
    metric: tpl.metric,
    target,
    unit,
    label: tpl.label.replace('{n}', fmt(target)),
    template: tpl.label,
  };
}

/** The value a finished round achieved for the challenge's metric. */
export function metricValue(metric: string, event: EndEvent): number {
  return metric === 'score' ? event.score : (event.stats?.[metric] ?? 0);
}

/**
 * Consecutive completed days ending today, or ending yesterday if today is not done yet
 * (so a streak is not shown as broken before the player had a chance to play today).
 */
export function currentStreak(doneDays: ReadonlySet<string>, today: string): number {
  let day = doneDays.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (doneDays.has(day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

/** Spoiler-free share text: no URLs with personal data, just the result and a link to the daily page. */
export function dailyShareText(c: DailyChallenge, best: number, streak: number, lastWeek: boolean[], url: string): string {
  const row = lastWeek.map((d) => (d ? '■' : '□')).join('');
  const unit = c.unit ? ` ${c.unit}` : '';
  return [
    `GlitchBound Daily #${c.number} · ${c.game.title}`,
    `Cleared: ${fmt(best)}${unit} (target ${fmt(c.target)}${unit})`,
    `${row}  streak ${streak}`,
    url,
  ].join('\n');
}
