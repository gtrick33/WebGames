import { bad, json, readJson, sameOrigin, type Ctx } from '../../../server/http';
import { isRoomGame, matchRoom } from '../../../server/rooms';

/**
 * POST /api/rooms/match { game, skip?: string[], kind?: string, rating?: number, who?: string, alone?: 'bots' }: quick
 * match (`kind`: which of the game's queues; `rating` and `who`: a rated search, sent to players near its rating).
 * Returns { code, created, active? }: a public room to join (a new one when nobody is waiting), or `code: null` when a
 * rated search said `alone: 'bots'` and nobody else is around.
 */
export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (!sameOrigin(request)) return bad('forbidden', 403);
  const body = await readJson(request, 512);
  if (!isRoomGame(body?.game)) return bad('bad_game', 400);
  const skip = Array.isArray(body?.skip) ? body.skip.filter((c: unknown): c is string => typeof c === 'string') : [];
  const rating = typeof body?.rating === 'number' && Number.isFinite(body.rating) ? body.rating : null;
  const rated = rating !== null && typeof body?.who === 'string' ? { rating, who: body.who as string, ...(body?.alone === 'bots' ? { alone: 'bots' as const } : {}) } : undefined;
  const room = await matchRoom(env, body.game, skip, typeof body?.kind === 'string' ? body.kind : '', rated);
  return room ? json(room) : bad('rooms_unavailable', 503);
}
