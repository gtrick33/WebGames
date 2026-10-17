import { getGame } from '../../src/catalog/catalog';
import { json, readJson, sameOrigin, utcDay, type Ctx } from '../../server/http';
import { currentUser } from '../../server/session';
import { visitorKey } from '../../server/visitor';

const NAMES = new Set(['page_view', 'game_view', 'game_start', 'game_end', 'replay_click', 'share_click', 'daily_complete', 'search', 'category_select', 'game_error', 'favorite', 'sign_in', 'subscribe']);

/** POST /api/events { events: [{ name, props }] }: first-party, cookieless product analytics. */
export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (!sameOrigin(request)) return json({ ok: false }, 403);
  const body = await readJson(request, 16_384);
  const list = Array.isArray(body?.events) ? (body.events as unknown[]).slice(0, 25) : [];
  if (!list.length) return json({ ok: true, n: 0 });
  const now = Date.now();
  const day = utcDay(now);
  const [visitor, user] = await Promise.all([visitorKey(request, now), currentUser(env, request)]);
  const stmts = [];
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const e = raw as Record<string, unknown>;
    if (typeof e.name !== 'string' || !NAMES.has(e.name)) continue;
    const props: Record<string, string | number | boolean> = {};
    if (e.props && typeof e.props === 'object') {
      for (const [k, v] of Object.entries(e.props as Record<string, unknown>).slice(0, 8)) {
        if (!/^[a-z_]{1,20}$/.test(k)) continue;
        if (typeof v === 'number' && Number.isFinite(v)) props[k] = v;
        else if (typeof v === 'boolean') props[k] = v;
        else if (typeof v === 'string') props[k] = v.slice(0, 60);
      }
    }
    const game = typeof props.game === 'string' && getGame(props.game) ? props.game : '';
    stmts.push(
      env.DB.prepare('INSERT INTO events (ts, day, name, game, visitor, user_id, props) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(now, day, e.name, game, visitor, user?.id ?? null, JSON.stringify(props)),
    );
  }
  // Keep 180 days of events (cheap housekeeping on ~1% of requests).
  if (Math.random() < 0.01) stmts.push(env.DB.prepare('DELETE FROM events WHERE ts < ?').bind(now - 180 * 86400_000));
  if (stmts.length) await env.DB.batch(stmts);
  return json({ ok: true, n: stmts.length });
}
