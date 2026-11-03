import type { DailyRules } from '../catalog/settings';
import type { DailyTemplate, GameEntry } from '../catalog/types';
import type { EndEvent } from './contract';
import { addDays, daysBetween, hashString } from './dates';
import { themeGames, themeOf, THEMES_SINCE } from './themes';

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

/** A template's text for a target, before `{n}` is filled in: its singular form for 1 when it has one. */
export const templateText = (tpl: DailyTemplate, target: number): string => (target === 1 && tpl.one ? tpl.one : tpl.label);

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
  // From THEMES_SINCE, the day's theme narrows the rotation to the games that fit it (when any can).
  // Like the rotation, it steps past excluded games, so excluding one only changes its own days.
  if (!game && day >= THEMES_SINCE) {
    const fits = themeGames(themeOf(day), pool).sort((a, b) => a.slug.localeCompare(b.slug));
    for (let i = 0; i < fits.length && !game; i++) {
      const g = fits[(h + i) % fits.length]!;
      if (!rules?.exclude.has(g.slug)) game = g;
    }
  }
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
  const text = templateText(tpl, target);
  return {
    day,
    number: Math.max(1, daysBetween(DAILY_EPOCH, day) + 1),
    game,
    metric: tpl.metric,
    target,
    unit,
    label: text.replace('{n}', fmt(target)),
    template: text,
  };
}

/** The kind of round a per-mode best counts (StatDef.mode). */
export const roundKind = (e: { daily?: boolean; challenge?: unknown }): 'daily' | 'challenge' | 'other' => (e.daily ? 'daily' : e.challenge ? 'challenge' : 'other');

/**
 * A round's stats with its per-mode stats settled (StatDef.mode/of): one of the round's kind reads its
 * `of` stat when the game doesn't report it itself; one of another kind is dropped. So a per-mode stat
 * works (bests, the Daily Challenge, quests) before and after a game reports it.
 */
export function modeStats(game: GameEntry, score: number, stats: Record<string, number>, kind: ReturnType<typeof roundKind>): Record<string, number> {
  const out = { ...stats };
  for (const s of game.stats) {
    if (!s.mode || !s.of) continue;
    if (s.mode !== kind) delete out[s.key];
    else if (out[s.key] === undefined) {
      const v = s.of === 'score' ? score : out[s.of];
      if (v !== undefined) out[s.key] = v;
    }
  }
  return out;
}

/** The value a finished round achieved for the challenge's metric. */
export function metricValue(metric: string, event: EndEvent): number {
  return metric === 'score' ? event.score : (event.stats?.[metric] ?? 0);
}

/** Whether the challenge's metric is a lower-is-better stat (a time: "in under {n} seconds"). */
export const lowerIsBetter = (c: Pick<DailyChallenge, 'game' | 'metric'>): boolean => c.game.stats.find((s) => s.key === c.metric)?.lowerIsBetter === true;

/**
 * Whether a round's value clears the challenge: reaching the target, or for a lower-is-better stat
 * staying at or under it (0 means the round didn't report it, e.g. no daily time outside the daily).
 */
export function isDone(c: Pick<DailyChallenge, 'game' | 'metric' | 'target'>, value: number): boolean {
  return lowerIsBetter(c) ? value > 0 && value <= c.target : value >= c.target;
}

/** The better of two of the day's values (for a lower-is-better stat, 0 is "none yet"). */
export function better(c: Pick<DailyChallenge, 'game' | 'metric'>, a: number, b: number): number {
  if (!lowerIsBetter(c)) return Math.max(a, b);
  if (!(a > 0)) return b;
  if (!(b > 0)) return a;
  return Math.min(a, b);
}

/** How far the day's best is toward the target, 0 to 1. */
export function progressOf(c: Pick<DailyChallenge, 'game' | 'metric' | 'target'>, best: number): number {
  if (lowerIsBetter(c)) return best > 0 ? Math.min(1, c.target / best) : 0;
  return Math.min(1, best / c.target);
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
    `GlitchBound Challenge #${c.number} · ${c.game.title}`,
    `Cleared: ${fmt(best)}${unit} (target ${lowerIsBetter(c) ? 'under ' : ''}${fmt(c.target)}${unit})`,
    `${row}  streak ${streak}`,
    url,
  ].join('\n');
}

/** The longest run of consecutive days in a list. */
export function longestStreak(days: Iterable<string>): number {
  const sorted = [...new Set(days)].sort();
  let best = 0;
  let run = 0;
  let prev = 0;
  for (const d of sorted) {
    const t = Date.parse(`${d}T12:00:00Z`);
    run = prev && t - prev === 86400_000 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = t;
  }
  return best;
}
