import { challengeRow, isClosed, playerOf, viewOf } from '../../../../server/challenges';
import { bad, json, readJson, sameOrigin, type Ctx } from '../../../../server/http';
import { cleanName, MAX_PLAYERS } from '../../../../src/platform/challenge';

/** POST /api/challenges/<id>/join { name, key? }: take a seat (up to 6 players; joining again just renames). */
export async function onRequestPost({ request, env, params }: Ctx): Promise<Response> {
  if (!sameOrigin(request)) return bad('forbidden', 403);
  const row = await challengeRow(env, String(params?.id ?? ''));
  if (!row) return bad('not_found', 404);
  const body = await readJson(request, 1024);
  const player = await playerOf(env, request, body);
  const name = cleanName(body?.name);
  if (!player || !name) return bad('name_required');
  if (await isClosed(env, row)) return bad('closed', 409, { message: 'This challenge has ended.' });
  // Seats: players who left free theirs, but their names stay taken (their scores are still on the board).
  const { results: all } = await env.DB.prepare('SELECT player, name, left_at FROM challenge_players WHERE challenge_id = ?').bind(row.id).all<{ player: string; name: string; left_at: number | null }>();
  const results = all.filter((p) => p.left_at === null);
  const seated = results.some((p) => p.player === player);
  if (!seated && results.length >= MAX_PLAYERS) return bad('full', 409, { message: 'This challenge already has 6 players.' });
  // Names are unique within a challenge so the scoreboard stays readable.
  let unique = name;
  for (let i = 2; all.some((p) => p.player !== player && p.name.toLowerCase() === unique.toLowerCase()); i++) unique = `${name.slice(0, 17)} ${i}`;
  const now = Date.now();
  // A new face counts as activity (the others' screens update, and the challenge stays open).
  await env.DB.batch([
    env.DB.prepare('INSERT INTO challenge_players (challenge_id, player, name, joined_at) VALUES (?, ?, ?, ?) ON CONFLICT (challenge_id, player) DO UPDATE SET name = excluded.name, left_at = NULL').bind(row.id, player, unique, now),
    env.DB.prepare('UPDATE challenges SET updated_at = ? WHERE id = ?').bind(now, row.id),
  ]);
  return json(await viewOf(env, { ...row, updated_at: now }, player));
}
