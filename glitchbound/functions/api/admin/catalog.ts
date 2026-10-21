import { loadCatalog, logAdmin } from '../../../server/catalogSettings';
import { bad, json, readJson, sameOrigin, type Ctx } from '../../../server/http';
import { requireAdmin } from '../../../server/session';
import { getGame } from '../../../src/catalog/catalog';
import { GAMES } from '../../../src/catalog/games';
import { compactParty, compactSettings, isDay, partySettingsFor, sanitizeLayout, sanitizeNotice, sanitizePartyPatch, sanitizePatch, sanitizePick, settingsFor, type GameSettings, type PartySettings } from '../../../src/catalog/settings';
import { isPartyId, PARTY_GAMES } from '../../../src/party/catalog';
import type { AdminCatalog } from '../../../src/platform/apiTypes';
import { HOLIDAYS, isSeasonSetting } from '../../../src/platform/seasons';
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
 *   { action: 'layout', layout | null }    home page banner order, sizes, colors and stickers (null = automatic)
 *   { action: 'season', season }           holiday look: 'auto' (by the calendar), 'off' or a holiday id
 *   { action: 'party', id, patch | null }  a Party Mode game's settings (null = back to the defaults)
 */
export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (!sameOrigin(request)) return bad('forbidden', 403);
  const admin = await requireAdmin(env, request);
  if (admin instanceof Response) return admin;
  const body = await readJson(request, 16384);
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
      if (!notice) return bad('invalid_notice', 400, { message: 'Write a message for the notice.' });
      // A link that isn't kept would otherwise vanish without a word.
      const link = (body.notice as { link?: unknown }).link;
      if (typeof link === 'string' && link.trim() && !notice.link) return bad('invalid_link', 400, { message: 'Links start with / (a page of this site) or https://' });
      await env.DB.prepare("INSERT INTO site_settings (key, value, updated_at, updated_by) VALUES ('notice', ?, ?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by")
        .bind(JSON.stringify(notice), now, by)
        .run();
      await logAdmin(env, by, 'notice', `Banner: ${notice.text}`);
      return json({ ok: true, notice });
    }
    case 'layout': {
      const layout = body.layout === null ? null : sanitizeLayout(body.layout, GAMES);
      if (!layout) {
        await env.DB.prepare("DELETE FROM site_settings WHERE key = 'layout'").run();
        await logAdmin(env, by, 'layout', 'Home page banners: back to automatic');
        return json({ ok: true, layout: null });
      }
      await env.DB.prepare("INSERT INTO site_settings (key, value, updated_at, updated_by) VALUES ('layout', ?, ?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by")
        .bind(JSON.stringify(layout), now, by)
        .run();
      const first = layout.order.slice(0, 3).map((slug) => getGame(slug)?.title ?? slug);
      await logAdmin(env, by, 'layout', `Home page banners updated${first.length ? `: ${first.join(', ')} first` : ''}`);
      return json({ ok: true, layout });
    }
    case 'season': {
      if (!isSeasonSetting(body.season)) return bad('invalid_season');
      if (body.season === 'auto') await env.DB.prepare("DELETE FROM site_settings WHERE key = 'season'").run();
      else
        await env.DB.prepare("INSERT INTO site_settings (key, value, updated_at, updated_by) VALUES ('season', ?, ?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by")
          .bind(body.season, now, by)
          .run();
      const name = body.season === 'auto' ? 'automatic (by the calendar)' : body.season === 'off' ? 'off' : (HOLIDAYS.find((h) => h.id === body.season)?.name ?? body.season);
      await logAdmin(env, by, 'season', `Holiday look: ${name}`);
      return json({ ok: true, season: body.season });
    }
    case 'party': {
      if (!isPartyId(body.id)) return bad('unknown_game', 404);
      const cat = await loadCatalog(env, today(), today());
      const all: Record<string, Partial<PartySettings>> = { ...cat.party };
      const name = PARTY_GAMES.find((g) => g.id === body.id)?.title ?? body.id;
      let detail = 'back to defaults';
      if (body.patch === null) delete all[body.id];
      else {
        const patch = sanitizePartyPatch(body.patch);
        if (!Object.keys(patch).length) return bad('nothing_to_change');
        all[body.id] = compactParty({ ...partySettingsFor(cat, body.id), ...patch });
        detail = (Object.entries(patch) as [string, unknown][]).map(([k, v]) => `${k}: ${typeof v === 'boolean' ? (v ? 'on' : 'off') : v === '' ? '(default)' : String(v).slice(0, 60)}`).join(', ');
      }
      for (const k of Object.keys(all)) if (!Object.keys(all[k]!).length) delete all[k];
      await env.DB.prepare("INSERT INTO site_settings (key, value, updated_at, updated_by) VALUES ('party', ?, ?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by")
        .bind(JSON.stringify(all), now, by)
        .run();
      await logAdmin(env, by, 'party', `Party · ${name}: ${detail}`);
      return json({ ok: true });
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
  flagship: 'best game',
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
