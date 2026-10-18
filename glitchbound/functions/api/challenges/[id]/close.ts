import { challengeRow, endOrLeave, playerOf, viewOf } from '../../../../server/challenges';
import { bad, json, readJson, sameOrigin, type Ctx } from '../../../../server/http';

/**
 * POST /api/challenges/<id>/close { key? }: the host ends the challenge for everyone; anyone else
 * leaves it. Answers the challenge as the player now sees it, or { gone: true } when it was deleted.
 */
export async function onRequestPost({ request, env, params }: Ctx): Promise<Response> {
  if (!sameOrigin(request)) return bad('forbidden', 403);
  const row = await challengeRow(env, String(params?.id ?? ''));
  if (!row) return json({ gone: true });
  const body = await readJson(request, 1024);
  const player = await playerOf(env, request, body);
  if (!player) return bad('name_required');
  const seated = await env.DB.prepare('SELECT 1 AS ok FROM challenge_players WHERE challenge_id = ? AND player = ?').bind(row.id, player).first();
  if (!seated) return bad('join_first', 403);
  if (!(await endOrLeave(env, row, player))) return json({ gone: true });
  return json(await viewOf(env, (await challengeRow(env, row.id))!, player));
}
