import { challengeRow, playerOf, viewOf } from '../../../server/challenges';
import { bad, json, type Ctx } from '../../../server/http';

/**
 * GET /api/challenges/<id>?key=…[&since=<updatedAt>]: players, rounds and scores (no other player's
 * keys are shown). Open challenges poll this every few seconds: with `since`, an unchanged challenge
 * answers 204 after a single read.
 */
export async function onRequestGet({ request, env, params }: Ctx): Promise<Response> {
  const row = await challengeRow(env, String(params?.id ?? ''));
  if (!row) return bad('not_found', 404);
  const since = Number(new URL(request.url).searchParams.get('since'));
  if (since > 0 && since === row.updated_at) return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
  return json(await viewOf(env, row, await playerOf(env, request, null)), 200, { 'cache-control': 'no-store' });
}
