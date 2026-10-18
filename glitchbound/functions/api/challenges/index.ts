import { challengeRow, listFor, newChallenge, playerOf, startStatements, sweep, tooManyToday, viewOf } from '../../../server/challenges';
import { bad, json, readJson, sameOrigin, type Ctx } from '../../../server/http';
import { getGame } from '../../../src/catalog/catalog';
import { cleanName } from '../../../src/platform/challenge';

/** POST /api/challenges { game, mode: 'daily' | 'fresh', day?, name, key? }: start a challenge (you are its first player). */
export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (!sameOrigin(request)) return bad('forbidden', 403);
  const body = await readJson(request, 2048);
  const game = typeof body?.game === 'string' ? getGame(body.game) : undefined;
  if (!game?.challenge) return bad('unknown_game', 404);
  const player = await playerOf(env, request, body);
  const name = cleanName(body?.name);
  if (!player || !name) return bad('name_required');
  const now = Date.now();
  if (await tooManyToday(env, player, now)) return bad('too_many', 429);
  const c = newChallenge(game.slug, body?.mode === 'daily' ? 'daily' : 'fresh', body?.day, player, name, now);
  await env.DB.batch(startStatements(env, c));
  await sweep(env, now);
  const row = await challengeRow(env, c.id);
  return json(await viewOf(env, row!, player));
}

/** GET /api/challenges?key=…: the challenges this player is in. */
export async function onRequestGet({ request, env }: Ctx): Promise<Response> {
  const player = await playerOf(env, request, null);
  if (!player) return json({ challenges: [] });
  await sweep(env);
  return json({ challenges: await listFor(env, player) }, 200, { 'cache-control': 'no-store' });
}
