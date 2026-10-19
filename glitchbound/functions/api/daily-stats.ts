import { getGame } from '../../src/catalog/catalog';
import { addDays } from '../../src/platform/dates';
import { bad, json, type Ctx } from '../../server/http';

/**
 * GET /api/daily-stats?game=slug&day=YYYY-MM-DD&score=N: how a daily score compares with everyone who
 * played that game's daily that day (guests too). Built from the anonymous game_end events (each
 * visitor's best daily score of the day), so nothing personal is stored or returned: just how many
 * played and how many scored below or equal. Briefly cached.
 */
export async function onRequestGet({ request, env }: Ctx): Promise<Response> {
  const url = new URL(request.url);
  const game = getGame(url.searchParams.get('game') ?? '');
  if (!game) return bad('unknown_game', 404);
  const day = url.searchParams.get('day') ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return bad('bad_day');
  const score = Number(url.searchParams.get('score'));
  if (!Number.isFinite(score)) return bad('bad_score');
  // The game's day is the player's local date; events are filed by UTC day, so look one either side.
  const row = await env.DB.prepare(
    `WITH best AS (
       SELECT visitor, MAX(CAST(json_extract(props, '$.score') AS REAL)) AS s
       FROM events
       WHERE game = ? AND name = 'game_end' AND day BETWEEN ? AND ? AND json_extract(props, '$.dday') = ?
       GROUP BY visitor
     )
     SELECT COUNT(*) AS players, COALESCE(SUM(s < ?), 0) AS below, COALESCE(SUM(s = ?), 0) AS equal FROM best`,
  )
    .bind(game.slug, addDays(day, -1), addDays(day, 1), day, score, score)
    .first<{ players: number; below: number; equal: number }>();
  return json({ game: game.slug, day, players: row?.players ?? 0, below: row?.below ?? 0, equal: row?.equal ?? 0 }, 200, { 'cache-control': 'public, max-age=60' });
}
