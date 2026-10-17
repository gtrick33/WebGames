import { UUID_RE, utcDay } from '../../src/backend/leaderboard-rules';
import type { Ctx } from '../types';

/** GET /api/leaderboard?period=daily|all&playerId=... : top 50 plus the caller's own rank. */
export async function onRequestGet({ request, env }: Ctx): Promise<Response> {
  const url = new URL(request.url);
  const period = url.searchParams.get('period') === 'all' ? 'all' : `d:${utcDay(Date.now())}`;
  const playerId = url.searchParams.get('playerId') ?? '';
  const top = await env.DB.prepare('SELECT player_id, name, score, meters, skin FROM scores WHERE period = ? ORDER BY score DESC, updated_at ASC LIMIT 50')
    .bind(period)
    .all<{ player_id: string; name: string; score: number; meters: number; skin: string }>();
  let me: { rank: number; score: number; name: string } | null = null;
  if (UUID_RE.test(playerId)) {
    const row = await env.DB.prepare('SELECT name, score FROM scores WHERE player_id = ? AND period = ?').bind(playerId, period).first<{ name: string; score: number }>();
    if (row) {
      const ahead = await env.DB.prepare('SELECT COUNT(*) AS n FROM scores WHERE period = ? AND score > ?').bind(period, row.score).first<{ n: number }>();
      me = { rank: (ahead?.n ?? 0) + 1, score: row.score, name: row.name };
    }
  }
  return new Response(
    JSON.stringify({
      period: period === 'all' ? 'all' : 'daily',
      // Never expose other players' ids.
      entries: top.results.map((r, i) => ({ rank: i + 1, name: r.name, score: r.score, meters: r.meters, skin: r.skin, you: r.player_id === playerId })),
      me,
    }),
    { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=15' } },
  );
}
