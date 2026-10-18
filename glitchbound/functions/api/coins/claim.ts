import { getGame } from '../../../src/catalog/catalog';
import { bad, json, readJson, sameOrigin, type Ctx } from '../../../server/http';
import { claimCoins } from '../../../server/qa';
import { requireUser } from '../../../server/session';

/** POST /api/coins/claim { game }: collects the coins QA or an admin gave you for this game (once). */
export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (!sameOrigin(request)) return bad('bad_origin', 403);
  const user = await requireUser(env, request);
  if (user instanceof Response) return user;
  const body = await readJson(request);
  const game = typeof body?.game === 'string' ? getGame(body.game) : undefined;
  if (!game?.wallet) return bad('unknown_game', 404);
  return json(await claimCoins(env, user.id, game.slug));
}
