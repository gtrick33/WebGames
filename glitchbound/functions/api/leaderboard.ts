import { getGame } from '../../src/catalog/catalog';
import type { LeaderRow } from '../../src/platform/apiTypes';
import { levelForXp } from '../../src/platform/progression';
import { bad, json, type Ctx } from '../../server/http';
import { currentUser } from '../../server/session';
import { LISTED } from '../../server/staff';

/**
 * GET /api/leaderboard?game=slug&period=all|24h: top 50 members, plus your own row if you are lower.
 * Banned players and QA testers are left off (a tester still sees their own row).
 */
export async function onRequestGet({ request, env }: Ctx): Promise<Response> {
  const url = new URL(request.url);
  const game = getGame(url.searchParams.get('game') ?? '');
  if (!game) return bad('unknown_game', 404);
  const period = url.searchParams.get('period') === '24h' ? '24h' : 'all';
  const me = await currentUser(env, request);
  const sql =
    period === 'all'
      ? `SELECT b.user_id, b.score, b.at, u.nickname, u.xp FROM bests b JOIN users u ON u.id = b.user_id WHERE b.game = ? AND ${LISTED} ORDER BY b.score DESC, b.at ASC LIMIT 50`
      : `SELECT r.user_id, MAX(r.score) AS score, MAX(r.ended_at) AS at, u.nickname, u.xp FROM runs r JOIN users u ON u.id = r.user_id
         WHERE r.game = ? AND r.status = 'ok' AND r.ended_at > ? AND ${LISTED} GROUP BY r.user_id ORDER BY score DESC, at ASC LIMIT 50`;
  const stmt = env.DB.prepare(sql);
  const res = await (period === 'all' ? stmt.bind(game.slug) : stmt.bind(game.slug, Date.now() - 86400_000)).all<{ user_id: string; score: number; at: number; nickname: string; xp: number }>();
  const rows: LeaderRow[] = res.results.map((r, i) => ({ rank: i + 1, nickname: r.nickname, level: levelForXp(r.xp), score: r.score, at: r.at, you: r.user_id === me?.id }));
  let mine: LeaderRow | null = null;
  if (me && !rows.some((r) => r.you) && period === 'all') {
    const b = await env.DB.prepare('SELECT score, at FROM bests WHERE user_id = ? AND game = ?').bind(me.id, game.slug).first<{ score: number; at: number }>();
    if (b) {
      const ahead = await env.DB.prepare(`SELECT COUNT(*) AS n FROM bests b JOIN users u ON u.id = b.user_id WHERE b.game = ? AND b.score > ? AND ${LISTED}`).bind(game.slug, b.score).first<{ n: number }>();
      mine = { rank: (ahead?.n ?? 0) + 1, nickname: me.nickname, level: levelForXp(me.xp), score: b.score, at: b.at, you: true };
    }
  }
  return json({ game: game.slug, period, rows, mine }, 200, { 'cache-control': 'no-store' });
}
