import { getGame } from '../../src/catalog/catalog';
import { bad, json, readJson, sameOrigin, type Ctx } from '../../server/http';
import { requireUser } from '../../server/session';

/** POST /api/favorites { game, on } */
export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (!sameOrigin(request)) return bad('bad_origin', 403);
  const user = await requireUser(env, request);
  if (user instanceof Response) return user;
  const body = await readJson(request);
  const slug = typeof body?.game === 'string' ? body.game : '';
  if (!getGame(slug)) return bad('unknown_game', 404);
  if (body?.on) {
    await env.DB.prepare('INSERT OR IGNORE INTO favorites (user_id, game, created_at) VALUES (?, ?, ?)').bind(user.id, slug, Date.now()).run();
  } else {
    await env.DB.prepare('DELETE FROM favorites WHERE user_id = ? AND game = ?').bind(user.id, slug).run();
  }
  const favs = await env.DB.prepare('SELECT game FROM favorites WHERE user_id = ? ORDER BY created_at').bind(user.id).all<{ game: string }>();
  return json({ favorites: favs.results.map((f) => f.game) });
}
