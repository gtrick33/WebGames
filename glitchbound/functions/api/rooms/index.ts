import { bad, json, readJson, sameOrigin, type Ctx } from '../../../server/http';
import { isRoomGame, openRoom } from '../../../server/rooms';

/** POST /api/rooms { game?: RoomGame }: opens a new room and returns its code. Players then connect to /api/rooms/<code>/ws. */
export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (!sameOrigin(request)) return bad('forbidden', 403);
  const body = await readJson(request, 512);
  const room = await openRoom(env, isRoomGame(body?.game) ? body.game : 'crass-act');
  return room ? json(room) : bad('rooms_unavailable', 503);
}
