import { challengeRow, isClosed, playerOf } from '../../../../server/challenges';
import { bad, json, readJson, sameOrigin, type Ctx } from '../../../../server/http';

/**
 * POST /api/challenges/<id>/start { round, key? }: the player started this round. Idempotent: the
 * first start counts, so a reload or a second tab can't restart the clock the score is checked against.
 */
export async function onRequestPost({ request, env, params }: Ctx): Promise<Response> {
  if (!sameOrigin(request)) return bad('forbidden', 403);
  const row = await challengeRow(env, String(params?.id ?? ''));
  if (!row) return bad('not_found', 404);
  const body = await readJson(request, 1024);
  const player = await playerOf(env, request, body);
  if (!player) return bad('name_required');
  const seated = await env.DB.prepare('SELECT 1 AS ok FROM challenge_players WHERE challenge_id = ? AND player = ? AND left_at IS NULL').bind(row.id, player).first();
  if (!seated) return bad('join_first', 403);
  if (await isClosed(env, row)) return bad('closed', 409);
  if (body?.round !== row.round) return bad('wrong_round', 409);
  await env.DB.prepare('INSERT INTO challenge_starts (challenge_id, round, player, started_at) VALUES (?, ?, ?, ?) ON CONFLICT (challenge_id, round, player) DO NOTHING').bind(row.id, row.round, player, Date.now()).run();
  const start = await env.DB.prepare('SELECT started_at FROM challenge_starts WHERE challenge_id = ? AND round = ? AND player = ?').bind(row.id, row.round, player).first<{ started_at: number }>();
  return json({ round: row.round, startedAt: start?.started_at ?? null });
}
