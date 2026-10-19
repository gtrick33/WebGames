import type { HallRow } from '../../src/platform/apiTypes';
import { levelForXp } from '../../src/platform/progression';
import { json, type Ctx } from '../../server/http';
import { currentUser } from '../../server/session';
import { listed } from '../../server/staff';

/**
 * GET /api/hall: the Hall of Fame across all games. Crowns = #1 spots, podiums = top-3 spots,
 * records = personal bests beaten. Ranked by crowns, then podiums, then records, then level.
 * Banned players and QA testers are left off, and so are scores of 0 (bests stored before they stopped counting).
 */
export async function onRequestGet({ request, env }: Ctx): Promise<Response> {
  const me = await currentUser(env, request);
  const [ranked, records, users] = await Promise.all([
    env.DB.prepare(`SELECT b.user_id, b.game, RANK() OVER (PARTITION BY b.game ORDER BY b.score DESC) AS r FROM bests b JOIN users u ON u.id = b.user_id WHERE b.score > 0 AND ${listed(env)}`).all<{ user_id: string; game: string; r: number }>(),
    env.DB.prepare(`SELECT user_id, COUNT(*) AS n FROM runs WHERE new_best = 1 AND status = 'ok' GROUP BY user_id`).all<{ user_id: string; n: number }>(),
    env.DB.prepare(`SELECT u.id, u.nickname, u.xp FROM users u WHERE u.id IN (SELECT DISTINCT user_id FROM bests WHERE score > 0) AND ${listed(env)}`).all<{ id: string; nickname: string; xp: number }>(),
  ]);
  const agg = new Map<string, { crowns: number; podiums: number; games: number }>();
  for (const row of ranked.results) {
    const a = agg.get(row.user_id) ?? { crowns: 0, podiums: 0, games: 0 };
    a.games++;
    if (row.r === 1) a.crowns++;
    if (row.r <= 3) a.podiums++;
    agg.set(row.user_id, a);
  }
  const rec = new Map(records.results.map((r) => [r.user_id, r.n]));
  const rows: HallRow[] = users.results
    .map((u) => ({ id: u.id, nickname: u.nickname, level: levelForXp(u.xp), xp: u.xp, records: rec.get(u.id) ?? 0, ...(agg.get(u.id) ?? { crowns: 0, podiums: 0, games: 0 }) }))
    .sort((a, b) => b.crowns - a.crowns || b.podiums - a.podiums || b.records - a.records || b.xp - a.xp)
    .slice(0, 100)
    .map((u, i) => ({ rank: i + 1, nickname: u.nickname, level: u.level, crowns: u.crowns, podiums: u.podiums, records: u.records, games: u.games, you: u.id === me?.id }));
  return json({ rows });
}
