import type { AdminReports } from '../../../src/platform/apiTypes';
import { json, type Ctx } from '../../../server/http';
import { requireAdmin } from '../../../server/session';

/** GET /api/admin/reports: feedback ratings and bug reports for the admin dashboard. */
export async function onRequestGet({ request, env }: Ctx): Promise<Response> {
  const admin = await requireAdmin(env, request);
  if (admin instanceof Response) return admin;
  const d30 = Date.now() - 30 * 86400_000;
  const q = <T>(sql: string, ...args: unknown[]) => env.DB.prepare(sql).bind(...args).all<T>().then((r) => r.results);
  const [dist, byGame, wishes, latest, bugs, counts] = await Promise.all([
    q<{ stars: number; n: number }>('SELECT stars, COUNT(*) AS n FROM feedback WHERE ts > ? GROUP BY stars', d30),
    q<{ game: string; n: number; avg: number }>('SELECT game, COUNT(*) AS n, AVG(stars) AS avg FROM feedback WHERE ts > ? GROUP BY game ORDER BY n DESC', d30),
    q<{ wish: string; n: number }>(`SELECT wish, COUNT(*) AS n FROM feedback WHERE ts > ? AND wish != '' GROUP BY wish ORDER BY n DESC`, d30),
    q<{ ts: number; stars: number; message: string; game: string; wish: string; browser: string; nickname: string | null }>(
      `SELECT f.ts, f.stars, f.message, f.game, f.wish, f.browser, u.nickname FROM feedback f LEFT JOIN users u ON u.id = f.user_id
       WHERE f.message != '' ORDER BY f.ts DESC LIMIT 40`,
    ),
    q<{ id: number; ts: number; title: string; description: string; game: string; category: string; severity: string; device: string; page: string; contact: string; status: string; admin_note: string; nickname: string | null }>(
      `SELECT b.id, b.ts, b.title, b.description, b.game, b.category, b.severity, b.device, b.page, b.contact, b.status, b.admin_note, u.nickname
       FROM bug_reports b LEFT JOIN users u ON u.id = b.user_id
       ORDER BY CASE b.status WHEN 'open' THEN 0 ELSE 1 END, CASE b.severity WHEN 'blocker' THEN 0 WHEN 'annoying' THEN 1 ELSE 2 END, b.ts DESC LIMIT 100`,
    ),
    q<{ status: string; n: number }>('SELECT status, COUNT(*) AS n FROM bug_reports GROUP BY status'),
  ]);
  const total = dist.reduce((n, d) => n + d.n, 0);
  const out: AdminReports = {
    feedback: {
      total30d: total,
      average: total ? Math.round((dist.reduce((n, d) => n + d.stars * d.n, 0) / total) * 100) / 100 : 0,
      distribution: [1, 2, 3, 4, 5].map((s) => dist.find((d) => d.stars === s)?.n ?? 0),
      byGame: byGame.map((g) => ({ game: g.game, n: g.n, average: Math.round(g.avg * 100) / 100 })),
      wishes,
      latest: latest.map((f) => ({ ts: f.ts, stars: f.stars, message: f.message, game: f.game, wish: f.wish, browser: f.browser, nickname: f.nickname })),
    },
    bugs: {
      open: counts.find((c) => c.status === 'open')?.n ?? 0,
      fixed: counts.find((c) => c.status === 'fixed')?.n ?? 0,
      wontfix: counts.find((c) => c.status === 'wontfix')?.n ?? 0,
      list: bugs.map((b) => ({ ...b, note: b.admin_note })),
    },
  };
  return json(out);
}
