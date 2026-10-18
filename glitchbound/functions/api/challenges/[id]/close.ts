import { challengeRow, endOrLeave, notifyChallenge, playerOf, viewOf } from '../../../../server/challenges';
import { bad, json, readJson, sameOrigin, type Ctx } from '../../../../server/http';

/**
 * POST /api/challenges/<id>/close { key? }: the host ends the challenge for everyone; anyone else
 * leaves it. Answers the challenge as the player now sees it, or { gone: true } when it was deleted.
 */
export async function onRequestPost({ request, env, params, waitUntil }: Ctx): Promise<Response> {
  if (!sameOrigin(request)) return bad('forbidden', 403);
  const row = await challengeRow(env, String(params?.id ?? ''));
  if (!row) return json({ gone: true });
  const body = await readJson(request, 1024);
  const player = await playerOf(env, request, body);
  if (!player) return bad('name_required');
  const seated = await env.DB.prepare('SELECT 1 AS ok FROM challenge_players WHERE challenge_id = ? AND player = ?').bind(row.id, player).first();
  if (!seated) return bad('join_first', 403);
  const kept = await endOrLeave(env, row, player);
  notifyChallenge(env, waitUntil, row.id, Date.now());
  if (!kept) return json({ gone: true });
  return json(await viewOf(env, (await challengeRow(env, row.id))!, player));
}
