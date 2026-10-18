import { challengeRow } from '../../../../server/challenges';
import { bad, type Ctx } from '../../../../server/http';

/**
 * GET /api/challenges/<id>/live (WebSocket): tells an open challenge page the moment the challenge
 * changes ({ t: 'changed', v: updatedAt }), so it fetches once instead of polling. The socket rests
 * on the rooms worker (one object per challenge, see rooms/worker.ts) and costs nothing while quiet.
 */
export async function onRequestGet({ request, env, params }: Ctx): Promise<Response> {
  if (request.headers.get('Upgrade') !== 'websocket') return bad('websocket_required', 426);
  const origin = request.headers.get('Origin');
  if (origin && new URL(origin).host !== new URL(request.url).host) return bad('forbidden', 403);
  if (!env.ROOMS) return bad('rooms_unavailable', 503);
  const row = await challengeRow(env, String(params?.id ?? ''));
  if (!row) return bad('not_found', 404);
  const stub = env.ROOMS.get(env.ROOMS.idFromName(`challenge:${row.id}`));
  return stub.fetch(new Request('https://room/watch', request));
}
