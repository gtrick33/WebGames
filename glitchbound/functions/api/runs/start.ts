import { getGame } from '../../../src/catalog/catalog';
import { bad, json, readJson, sameOrigin, type Ctx } from '../../../server/http';
import { requireUser } from '../../../server/session';

/** POST /api/runs/start { game }: the server timestamps the start, so claimed scores can be checked against real time. */
export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (!sameOrigin(request)) return bad('bad_origin', 403);
  const user = await requireUser(env, request);
  if (user instanceof Response) return user;
  const body = await readJson(request);
  const game = getGame(typeof body?.game === 'string' ? body.game : '');
  if (!game) return bad('unknown_game', 404);
  const now = Date.now();
  const recent = await env.DB.prepare(`SELECT COUNT(*) AS n FROM runs WHERE user_id = ? AND started_at > ?`).bind(user.id, now - 60_000).first<{ n: number }>();
  if ((recent?.n ?? 0) > 30) return bad('slow_down', 429);
  const id = crypto.randomUUID();
  await env.DB.batch([
    // Open runs that were never finished are cleaned up as we go.
    env.DB.prepare(`DELETE FROM runs WHERE user_id = ? AND status = 'open' AND started_at < ?`).bind(user.id, now - 6 * 3600_000),
    env.DB.prepare(`INSERT INTO runs (id, user_id, game, started_at, status) VALUES (?, ?, ?, ?, 'open')`).bind(id, user.id, game.slug, now),
  ]);
  return json({ runId: id });
}
