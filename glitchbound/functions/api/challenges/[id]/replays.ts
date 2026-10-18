import { challengeRow } from '../../../../server/challenges';
import { bad, json, type Ctx } from '../../../../server/http';

/** GET /api/challenges/<id>/replays: the current round's replays (e.g. Mini Racer ghosts) to race against. */
export async function onRequestGet({ env, params }: Ctx): Promise<Response> {
  const row = await challengeRow(env, String(params?.id ?? ''));
  if (!row) return bad('not_found', 404);
  const { results } = await env.DB.prepare(
    `SELECT p.name, s.replay FROM challenge_scores s JOIN challenge_players p ON p.challenge_id = s.challenge_id AND p.player = s.player
     WHERE s.challenge_id = ? AND s.round = ? AND s.replay != '' ORDER BY s.score DESC LIMIT 5`,
  )
    .bind(row.id, row.round)
    .all<{ name: string; replay: string }>();
  return json({ round: row.round, replays: results });
}
