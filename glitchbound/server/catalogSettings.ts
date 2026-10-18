import { GAMES } from '../src/catalog/games';
import { applySettings, dailyRules, EMPTY_CATALOG, type DailyPick, type DailyRules, type GameSettings, type Notice, type PublicCatalog } from '../src/catalog/settings';
import type { GameEntry } from '../src/catalog/types';
import { addDays } from '../src/platform/dates';
import type { Env } from './http';

/**
 * Admin catalog settings from D1 (see migrations/0005_admin_catalog.sql and src/catalog/settings.ts).
 * Every reader falls back to the defaults when the tables are missing or empty.
 */

export async function loadCatalog(env: Env, from: string, to: string): Promise<PublicCatalog> {
  try {
    const [settings, picks, notice] = await Promise.all([
      env.DB.prepare('SELECT slug, data FROM game_settings').all<{ slug: string; data: string }>(),
      env.DB.prepare('SELECT day, slug, template, target FROM daily_picks WHERE day >= ? AND day <= ?').bind(from, to).all<{ day: string; slug: string; template: number | null; target: number | null }>(),
      env.DB.prepare("SELECT value FROM site_settings WHERE key = 'notice'").first<{ value: string }>(),
    ]);
    const out: PublicCatalog = { settings: {}, picks: {}, notice: null };
    for (const r of settings.results) {
      try {
        out.settings[r.slug] = JSON.parse(r.data) as Partial<GameSettings>;
      } catch {
        /* skip a broken row */
      }
    }
    for (const r of picks.results) out.picks[r.day] = { slug: r.slug, template: r.template, target: r.target } satisfies DailyPick;
    const n = notice?.value;
    if (n) {
      try {
        out.notice = JSON.parse(n) as Notice;
      } catch {
        /* no notice */
      }
    }
    return out;
  } catch {
    return EMPTY_CATALOG;
  }
}

/** What the server needs for a given day: the games players can see, and the daily rules. */
export async function liveRules(env: Env, day: string): Promise<{ games: GameEntry[]; rules: DailyRules }> {
  const cat = await loadCatalog(env, addDays(day, -1), addDays(day, 1));
  return { games: applySettings(GAMES, cat), rules: dailyRules(cat) };
}

export async function logAdmin(env: Env, admin: string, action: string, detail: string): Promise<void> {
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO admin_log (ts, admin, action, detail) VALUES (?, ?, ?, ?)').bind(now, admin, action, detail.slice(0, 500)),
    env.DB.prepare('DELETE FROM admin_log WHERE ts < ?').bind(now - 365 * 86400_000),
  ]);
}
