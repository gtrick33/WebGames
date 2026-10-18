import { bad, json, sameOrigin, type Ctx } from '../../../server/http';
import { newRoomCode, roomStub } from '../../../server/rooms';

/** POST /api/rooms: opens a new Unhinged room and returns its code. Players then connect to /api/rooms/<code>/ws. */
export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (!sameOrigin(request)) return bad('forbidden', 403);
  if (!env.ROOMS) return bad('rooms_unavailable', 503);
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newRoomCode();
    const res = await roomStub(env, code)!.fetch(`https://room/init?code=${code}`, { method: 'POST' });
    if (res.ok) return json(await res.json());
    if (res.status !== 409) return bad('rooms_unavailable', 503);
  }
  return bad('try_again', 503);
}
