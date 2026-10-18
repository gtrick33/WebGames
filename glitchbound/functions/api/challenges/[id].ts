import { challengeRow, playerOf, viewOf } from '../../../server/challenges';
import { bad, json, type Ctx } from '../../../server/http';

/** GET /api/challenges/<id>?key=…: players, rounds and scores (no other player's keys are shown). */
export async function onRequestGet({ request, env, params }: Ctx): Promise<Response> {
  const row = await challengeRow(env, String(params?.id ?? ''));
  if (!row) return bad('not_found', 404);
  return json(await viewOf(env, row, await playerOf(env, request, null)), 200, { 'cache-control': 'no-store' });
}
