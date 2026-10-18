import { bad, json, sameOrigin, type Ctx } from '../../../server/http';
import { openRoom } from '../../../server/rooms';

/** POST /api/rooms: opens a new Unhinged room and returns its code. Players then connect to /api/rooms/<code>/ws. */
export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (!sameOrigin(request)) return bad('forbidden', 403);
  const room = await openRoom(env);
  return room ? json(room) : bad('rooms_unavailable', 503);
}
