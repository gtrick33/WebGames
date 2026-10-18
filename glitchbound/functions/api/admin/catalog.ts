import { loadCatalog, logAdmin } from '../../../server/catalogSettings';
import { bad, json, readJson, sameOrigin, type Ctx } from '../../../server/http';
import { requireAdmin } from '../../../server/session';
import { getGame } from '../../../src/catalog/catalog';
import { GAMES } from '../../../src/catalog/games';
import { compactSettings, isDay, sanitizeNotice, sanitizePatch, sanitizePick, settingsFor, type GameSettings } from '../../../src/catalog/settings';
import type { AdminCatalog } from '../../../src/platform/apiTypes';
import { addDays } from '../../../src/platform/dates';

const today = (): string => new Date().toISOString().slice(0, 10);

/** GET /api/admin/catalog: everything the Games tab edits, plus the recent change log. */
export async function onRequestGet({ request, env }: Ctx): Promise<Response> {
  const admin = await requireAdmin(env, request);
  if (admin instanceof Response) return admin;
  const t = today();
  const cat = await loadCatalog(env, addDays(t, -7), addDays(t, 62));
  const log = await env.DB.prepare('SELECT ts, admin, action, detail FROM admin_log ORDER BY ts DESC LIMIT 60')
    .all<{ ts: number; admin: string; action: string; detail: string }>()
    .then((r) => r.results)
    .catch(() => []);
  const out: AdminCatalog = { ...cat, log };
  return json(out);
}

const who = (u: { nickname: string; email: string }): string => u.nickname || u.email;

/**
 * POST /api/admin/catalog, one change at a time:
 *   { action: 'game', slug, patch }        change a game's settings (only the fields sent)
 *   { action: 'reset', slug }              back to the defaults
 *   { action: 'daily', day, pick | null }  hand-pick (or clear) the daily challenge for a date
 *   { action: 'notice', notice | null }    set or remove the site banner
 */
export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (!sameOrigin(request)) return bad('forbidden', 403);
  const admin = await requireAdmin(env, request);
  if (admin instanceof Response) return admin;
  const body = await readJson(request, 8192);
  const now = Date.now();
  const by = who(admin);
  switch (body?.action) {
    case 'game': {
      const game = typeof body.slug === 'string' ? getGame(body.slug) : undefined;
      if (!game) return bad('unknown_game', 404);
      const patch = sanitizePatch(body.patch);
      if (!Object.keys(patch).length) return bad('nothing_to_change');
      const cat = await loadCatalog(env, today(), today());
      const next: GameSettings = { ...settingsFor(cat, game.slug), ...patch };
      const statements = [
        env.DB.prepare('INSERT INTO game_settings (slug, data, updated_at, updated_by) VALUES (?, ?, ?, ?) ON CONFLICT (slug) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, updated_by = excluded.updated_by').bind(
          game.slug,
          JSON.stringify(compactSettings(next)),
          now,
          by,
        ),
      ];
      // One spotlight at a time: choosing a game clears it everywhere else.
      if (patch.spotlight) {
        for (const [slug, s] of Object.entries(cat.settings)) {
          if (slug === game.slug || !s.spotlight) continue;
          const other = compactSettings({ ...settingsFor(cat, slug), spotlight: false });
          statements.push(env.DB.prepare('UPDATE game_settings SET data = ?, updated_at = ?, updated_by = ? WHERE slug = ?').bind(JSON.stringify(other), now, by, slug));
        }
      }
      await env.DB.batch(statements);
      await logAdmin(env, by, 'game', `${game.title}: ${describe(patch)}`);
      return json({ ok: true });
    }
    case 'reset': {
      const game = typeof body.slug === 'string' ? getGame(body.slug) : undefined;
      if (!game) return bad('unknown_game', 404);
      await env.DB.prepare('DELETE FROM game_settings WHERE slug = ?').bind(game.slug).run();
      await logAdmin(env, by, 'reset', `${game.title}: back to defaults`);
      return json({ ok: true });
    }
    case 'daily': {
      if (!isDay(body.day) || body.day < addDays(today(), -2) || body.day > addDays(today(), 60)) return bad('invalid_day');
      if (body.pick === null) {
        await env.DB.prepare('DELETE FROM daily_picks WHERE day = ?').bind(body.day).run();
        await logAdmin(env, by, 'daily', `${body.day}: back to automatic`);
        return json({ ok: true });
      }
      const pick = sanitizePick(body.pick, GAMES);
      if (!pick) return bad('invalid_pick');
      await env.DB.prepare(
        'INSERT INTO daily_picks (day, slug, template, target, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (day) DO UPDATE SET slug = excluded.slug, template = excluded.template, target = excluded.target, updated_at = excluded.updated_at, updated_by = excluded.updated_by',
      )
        .bind(body.day, pick.slug, pick.template, pick.target, now, by)
        .run();
      const title = getGame(pick.slug)?.title ?? pick.slug;
      await logAdmin(env, by, 'daily', `${body.day}: ${title}${pick.target ? ` (target ${pick.target})` : ''}`);
      return json({ ok: true });
    }
    case 'notice': {
      if (body.notice === null) {
        await env.DB.prepare("DELETE FROM site_settings WHERE key = 'notice'").run();
        await logAdmin(env, by, 'notice', 'Banner removed');
        return json({ ok: true });
      }
      const notice = sanitizeNotice(body.notice, now);
      if (!notice) return bad('invalid_notice');
      await env.DB.prepare("INSERT INTO site_settings (key, value, updated_at, updated_by) VALUES ('notice', ?, ?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by")
        .bind(JSON.stringify(notice), now, by)
        .run();
      await logAdmin(env, by, 'notice', `Banner: ${notice.text}`);
      return json({ ok: true, notice });
    }
    default:
      return bad('unknown_action');
  }
}

const LABELS: Record<keyof GameSettings, string> = {
  hidden: 'hidden',
  newBadge: 'NEW badge',
  pinned: 'pinned',
  spotlight: 'spotlight',
  inDaily: 'in daily rotation',
  maintenance: 'maintenance',
  title: 'title',
  tagline: 'tagline',
  description: 'description',
};

/** "hidden: on, NEW badge: off" for the change log. */
function describe(patch: Partial<GameSettings>): string {
  return (Object.entries(patch) as [keyof GameSettings, unknown][])
    .map(([k, v]) => `${LABELS[k]}: ${typeof v === 'boolean' ? (v ? 'on' : 'off') : v === '' ? '(default)' : String(v).slice(0, 60)}`)
    .join(', ');
}
