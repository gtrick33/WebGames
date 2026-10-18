import { bad, type Ctx } from '../../../../server/http';
import { roomStub, validCode } from '../../../../server/rooms';

/** GET /api/rooms/<code>/ws?key=…&name=…: a player's live connection, handed straight to the room. */
export async function onRequestGet({ request, env, params }: Ctx): Promise<Response> {
  const code = String(params?.code ?? '').toUpperCase();
  if (!validCode(code)) return bad('not_found', 404);
  if (request.headers.get('Upgrade') !== 'websocket') return bad('websocket_required', 426);
  const origin = request.headers.get('Origin');
  if (origin && new URL(origin).host !== new URL(request.url).host) return bad('forbidden', 403);
  const stub = roomStub(env, code);
  if (!stub) return bad('rooms_unavailable', 503);
  const url = new URL(request.url);
  return stub.fetch(new Request(`https://room/ws${url.search}`, request));
}
