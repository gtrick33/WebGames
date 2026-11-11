import { bad, json, readJson, sameOrigin, type Ctx } from '../../../server/http';
import { isRoomGame, matchRoom } from '../../../server/rooms';

/** POST /api/rooms/match { game, skip?: string[], kind?: string }: quick match (`kind`: which of the game's queues). Returns { code, created }: a public room to join (a new one when nobody is waiting). */
export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (!sameOrigin(request)) return bad('forbidden', 403);
  const body = await readJson(request, 512);
  if (!isRoomGame(body?.game)) return bad('bad_game', 400);
  const skip = Array.isArray(body?.skip) ? body.skip.filter((c: unknown): c is string => typeof c === 'string') : [];
  const room = await matchRoom(env, body.game, skip, typeof body?.kind === 'string' ? body.kind : '');
  return room ? json(room) : bad('rooms_unavailable', 503);
}
