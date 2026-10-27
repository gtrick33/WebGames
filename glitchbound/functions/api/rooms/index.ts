import { bad, json, readJson, sameOrigin, type Ctx } from '../../../server/http';
import { isRoomGame, listRooms, openRoom } from '../../../server/rooms';

/** POST /api/rooms { game?: RoomGame, listed?: boolean }: opens a new room (public when listed) and returns its code. Players then connect to /api/rooms/<code>/ws. */
export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (!sameOrigin(request)) return bad('forbidden', 403);
  const body = await readJson(request, 512);
  const room = await openRoom(env, isRoomGame(body?.game) ? body.game : 'crass-act', body?.listed === true);
  return room ? json(room) : bad('rooms_unavailable', 503);
}

/** GET /api/rooms?game=<RoomGame>: the public rooms with a free seat (all games without `game`). */
export async function onRequestGet({ request, env }: Ctx): Promise<Response> {
  const game = new URL(request.url).searchParams.get('game');
  const rooms = await listRooms(env, isRoomGame(game) ? game : undefined);
  return rooms ? json({ rooms }) : bad('rooms_unavailable', 503);
}
