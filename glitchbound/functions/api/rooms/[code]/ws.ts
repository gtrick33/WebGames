import { bad, type Ctx } from '../../../../server/http';
import { roomStub, validCode } from '../../../../server/rooms';
import { currentUser } from '../../../../server/session';

/** A network, as a room is told it: a short hash of the address (never the address), the same for everyone on it. */
async function netOf(request: Request): Promise<string> {
  const ip = request.headers.get('CF-Connecting-IP') ?? '';
  if (!ip) return '';
  const sum = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`glitchbound-room-net:${ip}`));
  return [...new Uint8Array(sum)].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * GET /api/rooms/<code>/ws?key=…&name=…: a player's live connection, handed straight to the room. The room is also
 * told who is signed in on it (`uid`) and a hash of the network it comes from (`net`): The Ring's ranked ladder
 * settles a match by the accounts in it (server/ring.ts), so these come from the session and the request here,
 * never from the page.
 */
export async function onRequestGet({ request, env, params }: Ctx): Promise<Response> {
  const code = String(params?.code ?? '').toUpperCase();
  if (!validCode(code)) return bad('not_found', 404);
  if (request.headers.get('Upgrade') !== 'websocket') return bad('websocket_required', 426);
  const origin = request.headers.get('Origin');
  if (origin && new URL(origin).host !== new URL(request.url).host) return bad('forbidden', 403);
  const stub = roomStub(env, code);
  if (!stub) return bad('rooms_unavailable', 503);
  const url = new URL(request.url);
  const search = new URLSearchParams(url.search);
  search.delete('uid');
  search.delete('net');
  const user = await currentUser(env, request).catch(() => null);
  if (user) search.set('uid', user.id);
  const net = await netOf(request).catch(() => '');
  if (net) search.set('net', net);
  return stub.fetch(new Request(`https://room/ws?${search.toString()}`, request));
}
