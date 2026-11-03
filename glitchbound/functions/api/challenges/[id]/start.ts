import { ALREADY_STARTED, attemptOf, challengeRow, isClosed, playerOf, sameAttempt } from '../../../../server/challenges';
import { bad, json, readJson, sameOrigin, type Ctx } from '../../../../server/http';

/**
 * POST /api/challenges/<id>/start { round, attempt?, key? }: the player started this round. The first start
 * is the round's one attempt: it keeps the clock the score is checked against, and its `attempt` token (kept by
 * the page, so a reload resumes the same attempt). A start under another token (the round quit and played
 * again, from a fresh browser or another device) is refused with 409 already_started.
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
  const attempt = attemptOf(body);
  await env.DB.prepare('INSERT INTO challenge_starts (challenge_id, round, player, started_at, attempt) VALUES (?, ?, ?, ?, ?) ON CONFLICT (challenge_id, round, player) DO NOTHING').bind(row.id, row.round, player, Date.now(), attempt).run();
  const start = await env.DB.prepare('SELECT started_at, attempt FROM challenge_starts WHERE challenge_id = ? AND round = ? AND player = ?').bind(row.id, row.round, player).first<{ started_at: number; attempt: string | null }>();
  if (start && !sameAttempt(start.attempt, attempt)) return bad('already_started', 409, { message: ALREADY_STARTED });
  return json({ round: row.round, startedAt: start?.started_at ?? null });
}
