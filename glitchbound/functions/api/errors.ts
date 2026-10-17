import { getGame } from '../../src/catalog/catalog';
import { json, readJson, sameOrigin, type Ctx } from '../../server/http';
import { browserFamily } from '../../server/visitor';

const KINDS = new Set(['js_error', 'unhandled_rejection', 'game_load_timeout', 'game_load_failed', 'game_crash', 'api_error']);

/** POST /api/errors { kind, message, game?, path? }: crash and bug reports from players' browsers. */
export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (!sameOrigin(request)) return json({ ok: false }, 403);
  const body = await readJson(request, 4096);
  const kind = typeof body?.kind === 'string' && KINDS.has(body.kind) ? body.kind : null;
  if (!kind) return json({ ok: false }, 400);
  const game = typeof body?.game === 'string' && getGame(body.game) ? body.game : '';
  const message = typeof body?.message === 'string' ? body.message.slice(0, 300) : '';
  const path = typeof body?.path === 'string' ? body.path.slice(0, 120) : '';
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO errors (ts, kind, game, message, path, browser) VALUES (?, ?, ?, ?, ?, ?)').bind(now, kind, game, message, path, browserFamily(request.headers.get('user-agent') ?? '')),
    env.DB.prepare('DELETE FROM errors WHERE ts < ?').bind(now - 90 * 86400_000),
  ]);
  return json({ ok: true });
}
