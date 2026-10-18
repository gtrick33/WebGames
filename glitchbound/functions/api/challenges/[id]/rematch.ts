import { challengeRow, playerOf, viewOf } from '../../../../server/challenges';
import { bad, json, readJson, sameOrigin, type Ctx } from '../../../../server/http';
import { MAX_ROUNDS, roundSeed } from '../../../../src/platform/challenge';

/** POST /api/challenges/<id>/rematch { round, key? }: start the next round (a player who has played the current one). */
export async function onRequestPost({ request, env, params }: Ctx): Promise<Response> {
  if (!sameOrigin(request)) return bad('forbidden', 403);
  const row = await challengeRow(env, String(params?.id ?? ''));
  if (!row) return bad('not_found', 404);
  const body = await readJson(request, 1024);
  const player = await playerOf(env, request, body);
  if (!player) return bad('name_required');
  // Two players pressing Rematch at once must not skip a round.
  if (body?.round !== row.round) return json(await viewOf(env, row, player));
  const played = await env.DB.prepare('SELECT 1 AS ok FROM challenge_scores WHERE challenge_id = ? AND round = ? AND player = ?').bind(row.id, row.round, player).first();
  if (!played) return bad('play_first', 403, { message: 'Play this round before starting the next one.' });
  if (row.round >= MAX_ROUNDS) return bad('max_rounds', 409, { message: 'That was the last round of this challenge. Start a new one!' });
  const now = Date.now();
  const next = row.round + 1;
  // Rematches are always fresh content, even for a daily challenge.
  await env.DB.prepare('UPDATE challenges SET round = ?, seed = ?, mode = ?, updated_at = ? WHERE id = ? AND round = ?').bind(next, roundSeed(row.seed, next), 'fresh', now, row.id, row.round).run();
  const fresh = await challengeRow(env, row.id);
  return json(await viewOf(env, fresh!, player));
}
