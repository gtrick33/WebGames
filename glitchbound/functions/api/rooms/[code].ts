import { bad, json, type Ctx } from '../../../server/http';
import { roomStub, validCode } from '../../../server/rooms';

/** GET /api/rooms/<code>: whether a room exists, who hosts it and how many are in. */
export async function onRequestGet({ env, params }: Ctx): Promise<Response> {
  const code = String(params?.code ?? '').toUpperCase();
  if (!validCode(code)) return bad('not_found', 404);
  const stub = roomStub(env, code);
  if (!stub) return bad('rooms_unavailable', 503);
  const res = await stub.fetch('https://room/info');
  return res.ok ? json(await res.json()) : bad('not_found', 404);
}
