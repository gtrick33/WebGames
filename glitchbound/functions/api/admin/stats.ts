import { GAMES } from '../../../src/catalog/games';
import type { AdminStats } from '../../../src/platform/apiTypes';
import { emailEnabled } from '../../../server/email';
import { json, utcDay, type Ctx } from '../../../server/http';
import { requireAdmin } from '../../../server/session';

/** The 75th percentile of a list: the figure Google judges a site by. */
function p75(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.75))]!;
}

/** Real visitors' Core Web Vitals (src/platform/vitals.ts), one line per kind of device. */
function vitalsOf(rows: { props: string }[]): AdminStats['vitals'] {
  const by = new Map<string, { lcp: number[]; inp: number[]; cls: number[]; visits: number }>();
  for (const row of rows) {
    let v: { device?: unknown; lcp?: unknown; inp?: unknown; cls?: unknown };
    try {
      v = JSON.parse(row.props) as typeof v;
    } catch {
      continue;
    }
    const device = v.device === 'phone' ? 'phone' : 'computer';
    const b = by.get(device) ?? { lcp: [], inp: [], cls: [], visits: 0 };
    b.visits++;
    if (typeof v.lcp === 'number') b.lcp.push(v.lcp);
    if (typeof v.inp === 'number') b.inp.push(v.inp);
    if (typeof v.cls === 'number') b.cls.push(v.cls);
    by.set(device, b);
  }
  return [...by.entries()].map(([device, b]) => ({ device, visits: b.visits, lcp: p75(b.lcp), inp: p75(b.inp), cls: p75(b.cls) }));
}

/** GET /api/admin/stats: everything the admin dashboard shows. Admins only (ADMIN_EMAILS). */
export async function onRequestGet({ request, env }: Ctx): Promise<Response> {
  const admin = await requireAdmin(env, request);
  if (admin instanceof Response) return admin;
  const now = Date.now();
  const d7 = now - 7 * 86400_000;
  const d30 = now - 30 * 86400_000;
  const since14 = utcDay(now - 13 * 86400_000);
  const q = <T>(sql: string, ...args: unknown[]) => env.DB.prepare(sql).bind(...args).all<T>().then((r) => r.results);
  const one = <T>(sql: string, ...args: unknown[]) => env.DB.prepare(sql).bind(...args).first<T>();

  const [totals, newUsers, active, recent, subs, gameEvents, gameVisitors, gameRuns, gameErrors, daily, dailyRounds, retention, searches, errorKinds, latestErrors, announcements, vitalRows] = await Promise.all([
    one<{ n: number }>('SELECT COUNT(*) AS n FROM users'),
    one<{ n: number }>('SELECT COUNT(*) AS n FROM users WHERE created_at > ?', d7),
    one<{ n: number }>('SELECT COUNT(*) AS n FROM users WHERE last_seen > ?', d7),
    q<{ nickname: string; email: string; created_at: number }>('SELECT nickname, email, created_at FROM users ORDER BY created_at DESC LIMIT 10'),
    q<{ status: string; n: number }>('SELECT status, COUNT(*) AS n FROM subscribers GROUP BY status'),
    q<{ game: string; name: string; n: number }>(`SELECT game, name, COUNT(*) AS n FROM events WHERE ts > ? AND game != '' GROUP BY game, name`, d30),
    q<{ game: string; n: number }>(`SELECT game, COUNT(DISTINCT visitor || day) AS n FROM events WHERE ts > ? AND name = 'game_start' GROUP BY game`, d30),
    q<{ game: string; rounds: number; players: number; avg: number; best: number }>(
      `SELECT game, COUNT(*) AS rounds, COUNT(DISTINCT user_id) AS players, AVG(score) AS avg, MAX(score) AS best FROM runs WHERE status = 'ok' AND ended_at > ? GROUP BY game`,
      d30,
    ),
    q<{ game: string; n: number }>(`SELECT game, COUNT(*) AS n FROM errors WHERE ts > ? AND kind LIKE 'game_%' GROUP BY game`, d30),
    q<{ day: string; visitors: number; starts: number }>(
      `SELECT day, COUNT(DISTINCT visitor) AS visitors, SUM(name = 'game_start') AS starts FROM events WHERE day >= ? GROUP BY day ORDER BY day`,
      since14,
    ),
    q<{ day: string; n: number }>(`SELECT day, COUNT(*) AS n FROM events WHERE day >= ? AND name = 'game_end' GROUP BY day`, since14),
    q<{ day: string; returning_visitors: number; daily_players: number }>(
      `SELECT day,
         COUNT(DISTINCT CASE WHEN name = 'page_view' AND json_extract(props, '$.visit') = 'returning' THEN visitor END) AS returning_visitors,
         COUNT(DISTINCT CASE WHEN name = 'daily_complete' THEN visitor END) AS daily_players
       FROM events WHERE day >= ? AND name IN ('page_view', 'daily_complete') GROUP BY day`,
      since14,
    ),
    q<{ q: string; n: number; zero: number }>(
      `SELECT json_extract(props, '$.q') AS q, COUNT(*) AS n, SUM(json_extract(props, '$.results') = 0) AS zero FROM events
       WHERE name = 'search' AND ts > ? GROUP BY q ORDER BY n DESC LIMIT 15`,
      d30,
    ),
    q<{ kind: string; n: number }>('SELECT kind, COUNT(*) AS n FROM errors WHERE ts > ? GROUP BY kind ORDER BY n DESC', d7),
    q<{ ts: number; kind: string; game: string; message: string; path: string; browser: string }>('SELECT ts, kind, game, message, path, browser FROM errors ORDER BY ts DESC LIMIT 30'),
    q<{ game: string; subject: string; sent_at: number; recipients: number }>('SELECT game, subject, sent_at, recipients FROM announcements ORDER BY sent_at DESC LIMIT 10'),
    q<{ props: string }>(`SELECT props FROM events WHERE name = 'web_vitals' AND ts > ? ORDER BY ts DESC LIMIT 4000`, d7),
  ]);

  const ev = (slug: string, name: string) => gameEvents.find((e) => e.game === slug && e.name === name)?.n ?? 0;
  const days: AdminStats['daily'] = [];
  for (let i = 13; i >= 0; i--) {
    const day = utcDay(now - i * 86400_000);
    const d = daily.find((x) => x.day === day);
    const r = retention.find((x) => x.day === day);
    days.push({
      day,
      visitors: d?.visitors ?? 0,
      starts: d?.starts ?? 0,
      rounds: dailyRounds.find((x) => x.day === day)?.n ?? 0,
      returning: r?.returning_visitors ?? 0,
      dailyPlayers: r?.daily_players ?? 0,
    });
  }
  const sub = (s: string) => subs.find((x) => x.status === s)?.n ?? 0;
  const stats: AdminStats = {
    generatedAt: now,
    users: { total: totals?.n ?? 0, new7d: newUsers?.n ?? 0, active7d: active?.n ?? 0, recent: recent.map((u) => ({ nickname: u.nickname, email: u.email, createdAt: u.created_at })) },
    subscribers: { confirmed: sub('confirmed'), pending: sub('pending'), unsubscribed: sub('unsubscribed') },
    games: GAMES.map((g) => {
      const r = gameRuns.find((x) => x.game === g.slug);
      return {
        slug: g.slug,
        title: g.title,
        views: ev(g.slug, 'game_view'),
        starts: ev(g.slug, 'game_start'),
        ends: ev(g.slug, 'game_end'),
        visitors: gameVisitors.find((x) => x.game === g.slug)?.n ?? 0,
        players: r?.players ?? 0,
        signedInRounds: r?.rounds ?? 0,
        avgScore: r ? Math.round(r.avg) : null,
        bestScore: r?.best ?? null,
        loadErrors: gameErrors.find((x) => x.game === g.slug)?.n ?? 0,
      };
    }).sort((a, b) => b.starts - a.starts),
    daily: days,
    vitals: vitalsOf(vitalRows),
    searches: searches.filter((s) => s.q).map((s) => ({ q: s.q, n: s.n, zeroResults: s.zero ?? 0 })),
    errors: { kinds: errorKinds, latest: latestErrors },
    announcements: announcements.map((a) => ({ game: a.game, subject: a.subject, sentAt: a.sent_at, recipients: a.recipients })),
    emailEnabled: emailEnabled(env),
  };
  return json(stats);
}
