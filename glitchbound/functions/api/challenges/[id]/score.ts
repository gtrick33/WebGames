import { challengeRow, isClosed, playerOf, viewOf } from '../../../../server/challenges';
import { bad, json, readJson, sameOrigin, type Ctx } from '../../../../server/http';
import { REPLAY_MAX } from '../../../../src/platform/challenge';

/** POST /api/challenges/<id>/score { round, score, stats?, replay?, key? }: the first finished score of a round counts. */
export async function onRequestPost({ request, env, params }: Ctx): Promise<Response> {
  if (!sameOrigin(request)) return bad('forbidden', 403);
  const row = await challengeRow(env, String(params?.id ?? ''));
  if (!row) return bad('not_found', 404);
  const body = await readJson(request, 24_000);
  const player = await playerOf(env, request, body);
  if (!player) return bad('name_required');
  const seated = await env.DB.prepare('SELECT 1 AS ok FROM challenge_players WHERE challenge_id = ? AND player = ? AND left_at IS NULL').bind(row.id, player).first();
  if (!seated) return bad('join_first', 403);
  if (await isClosed(env, row)) return bad('closed', 409, { message: 'This challenge has ended, so the score was not added.' });
  if (body?.round !== row.round) return bad('wrong_round', 409, { message: 'A new round has started. Open the challenge again.' });
  const score = typeof body?.score === 'number' && Number.isFinite(body.score) ? Math.max(0, Math.min(1e8, Math.round(body.score))) : null;
  if (score === null) return bad('invalid');
  const stats: Record<string, number> = {};
  if (body?.stats && typeof body.stats === 'object')
    for (const [k, v] of Object.entries(body.stats as Record<string, unknown>).slice(0, 12)) if (/^[a-zA-Z][a-zA-Z0-9_]{0,31}$/.test(k) && typeof v === 'number' && Number.isFinite(v)) stats[k] = Math.round(v * 100) / 100;
  const replay = typeof body?.replay === 'string' && body.replay.length <= REPLAY_MAX && /^[A-Za-z0-9+/=_-]*$/.test(body.replay) ? body.replay : '';
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO challenge_scores (challenge_id, round, player, score, stats, replay, at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (challenge_id, round, player) DO NOTHING').bind(row.id, row.round, player, score, JSON.stringify(stats), replay, now),
    env.DB.prepare('UPDATE challenges SET updated_at = ? WHERE id = ?').bind(now, row.id),
  ]);
  return json(await viewOf(env, { ...row, updated_at: now }, player));
}
