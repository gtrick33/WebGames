import type { CloudUsage, CloudUsageDay } from '../src/platform/apiTypes';
import type { D1Database, Env } from './http';

/**
 * Cloudflare usage for the admin dashboard. Database sizes and row counts come straight from D1 (no
 * setup). Daily request and row-read/write totals need the GraphQL Analytics API: set the secrets
 * CF_API_TOKEN (Account Analytics: Read) and CF_ACCOUNT_ID. Every part fails soft.
 */

/** Free-plan limits (Workers Free, D1 Free, Durable Objects on Workers Free), shown next to the usage. */
export const FREE_LIMITS = {
  requestsPerDay: 100_000,
  d1RowsReadPerDay: 5_000_000,
  d1RowsWrittenPerDay: 100_000,
  d1StorageBytesPerDb: 500 * 1024 * 1024,
  d1StorageBytesTotal: 5 * 1024 * 1024 * 1024,
  doRequestsPerDay: 100_000,
  doGbSecondsPerDay: 13_000,
  doRowsReadPerDay: 5_000_000,
  doRowsWrittenPerDay: 100_000,
  doStorageBytes: 5 * 1024 * 1024 * 1024,
};

/** Durable Objects are billed as 128 MB each while active; activeTime is in microseconds. */
const GB_PER_OBJECT = 128 / 1024;

/** Room games from the site's own events (room_open when a room is made, room_join when a player connects). */
async function roomStats(env: Env, now: number): Promise<CloudUsage['rooms']> {
  const since = now - 30 * 86400_000;
  const since14 = day(now - 13 * 86400_000);
  const today = day(now);
  try {
    const [games, days] = await Promise.all([
      env.DB.prepare(
        `SELECT json_extract(props, '$.room') AS game,
                SUM(name = 'room_open') AS opened,
                SUM(name = 'room_join') AS joins,
                COUNT(DISTINCT CASE WHEN name = 'room_join' THEN visitor END) AS players,
                SUM(name = 'room_open' AND day = ?) AS openedToday
           FROM events WHERE ts > ? AND name IN ('room_open', 'room_join') GROUP BY game ORDER BY opened DESC`,
      )
        .bind(today, since)
        .all<{ game: string | null; opened: number; joins: number; players: number; openedToday: number }>(),
      env.DB.prepare(`SELECT day, SUM(name = 'room_open') AS opened, SUM(name = 'room_join') AS joins FROM events WHERE day >= ? AND name IN ('room_open', 'room_join') GROUP BY day ORDER BY day`)
        .bind(since14)
        .all<{ day: string; opened: number; joins: number }>(),
    ]);
    return { games: (games.results ?? []).map((g) => ({ ...g, game: g.game ?? 'unknown' })), days: days.results ?? [] };
  } catch {
    return { games: [], days: [] };
  }
}

const TABLES: Record<'DB' | 'NR_DB', string[]> = {
  DB: ['users', 'sessions', 'runs', 'bests', 'dailies', 'favorites', 'quest_claims', 'events', 'errors', 'subscribers', 'announcements', 'login_codes', 'feedback', 'bug_reports', 'error_issues'],
  NR_DB: ['scores', 'runs'],
};

async function dbInfo(db: D1Database, tables: string[]): Promise<{ sizeBytes: number | null; tables: { name: string; rows: number }[] }> {
  let sizeBytes: number | null = null;
  try {
    // D1 reports the database size in every result's metadata.
    const res = (await db.prepare('SELECT 1').run()) as { meta?: { size_after?: number } };
    sizeBytes = typeof res?.meta?.size_after === 'number' ? res.meta.size_after : null;
  } catch {
    /* unavailable locally */
  }
  const rows = await Promise.all(
    tables.map(async (name) => {
      try {
        const r = await db.prepare(`SELECT COUNT(*) AS n FROM ${name}`).first<{ n: number }>();
        return { name, rows: r?.n ?? 0 };
      } catch {
        return null;
      }
    }),
  );
  return { sizeBytes, tables: rows.filter((r): r is { name: string; rows: number } => !!r) };
}

async function graphql(env: Env, query: string, variables: Record<string, unknown>): Promise<unknown> {
  const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.CF_API_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const data = (await res.json()) as { data?: unknown; errors?: { message: string }[] | null };
  if (!res.ok || data.errors?.length) throw new Error(data.errors?.[0]?.message ?? `HTTP ${res.status}`);
  return data.data;
}

const day = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

export async function cloudUsage(env: Env): Promise<CloudUsage> {
  const now = Date.now();
  const [main, nr] = await Promise.all([dbInfo(env.DB, TABLES.DB), dbInfo(env.NR_DB, TABLES.NR_DB)]);
  const out: CloudUsage = {
    generatedAt: now,
    limits: FREE_LIMITS,
    databases: [
      { name: 'glitchbound', ...main },
      { name: 'neon-rush-leaderboard', ...nr },
    ],
    analytics: env.CF_API_TOKEN && env.CF_ACCOUNT_ID ? { status: 'ok', days: [], error: '' } : { status: 'not_configured', days: [], error: '' },
    rooms: await roomStats(env, now),
  };
  if (out.analytics.status !== 'ok') return out;

  const start = day(now - 13 * 86400_000);
  const end = day(now);
  const days = new Map<string, CloudUsageDay>();
  const blank = (d: string): CloudUsageDay => ({ day: d, requests: null, errors: null, workerRequests: null, rowsRead: 0, rowsWritten: 0, queries: 0, doRequests: null, doGbSeconds: null, doRowsRead: null, doRowsWritten: null, wsMessages: null, doStoredBytes: null });
  const row = (d: string) => days.get(d) ?? days.set(d, blank(d)).get(d)!;
  for (let i = 13; i >= 0; i--) row(day(now - i * 86400_000));
  const errors: string[] = [];

  try {
    const data = (await graphql(
      env,
      `query ($account: String!, $start: Date!, $end: Date!) {
        viewer { accounts(filter: { accountTag: $account }) {
          d1AnalyticsAdaptiveGroups(limit: 1000, filter: { date_geq: $start, date_leq: $end }) {
            sum { readQueries writeQueries rowsRead rowsWritten }
            dimensions { date }
          }
        } }
      }`,
      { account: env.CF_ACCOUNT_ID, start, end },
    )) as { viewer: { accounts: { d1AnalyticsAdaptiveGroups: { sum: { readQueries: number; writeQueries: number; rowsRead: number; rowsWritten: number }; dimensions: { date: string } }[] }[] } };
    for (const g of data.viewer.accounts[0]?.d1AnalyticsAdaptiveGroups ?? []) {
      const r = row(g.dimensions.date);
      r.rowsRead += g.sum.rowsRead;
      r.rowsWritten += g.sum.rowsWritten;
      r.queries += g.sum.readQueries + g.sum.writeQueries;
    }
  } catch (e) {
    errors.push(`D1: ${(e as Error).message}`);
  }

  try {
    const data = (await graphql(
      env,
      `query ($account: String!, $start: Date!, $end: Date!) {
        viewer { accounts(filter: { accountTag: $account }) {
          pagesFunctionsInvocationsAdaptiveGroups(limit: 1000, filter: { date_geq: $start, date_leq: $end }) {
            sum { requests errors }
            dimensions { date }
          }
        } }
      }`,
      { account: env.CF_ACCOUNT_ID, start, end },
    )) as { viewer: { accounts: { pagesFunctionsInvocationsAdaptiveGroups: { sum: { requests: number; errors: number }; dimensions: { date: string } }[] }[] } };
    for (const g of data.viewer.accounts[0]?.pagesFunctionsInvocationsAdaptiveGroups ?? []) {
      const r = row(g.dimensions.date);
      r.requests = (r.requests ?? 0) + g.sum.requests;
      r.errors = (r.errors ?? 0) + g.sum.errors;
    }
  } catch (e) {
    errors.push(`Functions: ${(e as Error).message}`);
  }

  /** One dataset per query, so a field the account cannot read only blanks its own columns. */
  const dataset = async <G>(label: string, name: string, fields: string, apply: (g: G & { dimensions: { date: string } }) => void, filter = ''): Promise<void> => {
    try {
      const data = (await graphql(
        env,
        `query ($account: String!, $start: Date!, $end: Date!) {
          viewer { accounts(filter: { accountTag: $account }) {
            ${name}(limit: 1000, filter: { date_geq: $start, date_leq: $end${filter} }) { ${fields} dimensions { date } }
          } }
        }`,
        { account: env.CF_ACCOUNT_ID, start, end },
      )) as { viewer: { accounts: Record<string, (G & { dimensions: { date: string } })[]>[] } };
      for (const g of data.viewer.accounts[0]?.[name] ?? []) apply(g);
    } catch (e) {
      errors.push(`${label}: ${(e as Error).message}`);
    }
  };
  const add = (a: number | null, b: number): number => (a ?? 0) + b;
  await Promise.all([
    dataset<{ sum: { requests: number } }>('Rooms worker', 'workersInvocationsAdaptive', 'sum { requests }', (g) => {
      const r = row(g.dimensions.date);
      r.workerRequests = add(r.workerRequests, g.sum.requests);
    }, ', scriptName: "glitchbound-rooms"'),
    dataset<{ sum: { requests: number } }>('Room requests', 'durableObjectsInvocationsAdaptiveGroups', 'sum { requests }', (g) => {
      const r = row(g.dimensions.date);
      r.doRequests = add(r.doRequests, g.sum.requests);
    }),
    dataset<{ sum: { activeTime: number; inboundWebsocketMsgCount: number } }>('Room compute', 'durableObjectsPeriodicGroups', 'sum { activeTime inboundWebsocketMsgCount }', (g) => {
      const r = row(g.dimensions.date);
      r.doGbSeconds = add(r.doGbSeconds, (g.sum.activeTime / 1e6) * GB_PER_OBJECT);
      r.wsMessages = add(r.wsMessages, g.sum.inboundWebsocketMsgCount);
    }),
    dataset<{ sum: { rowsRead: number; rowsWritten: number } }>('Room storage rows', 'durableObjectsPeriodicGroups', 'sum { rowsRead rowsWritten }', (g) => {
      const r = row(g.dimensions.date);
      r.doRowsRead = add(r.doRowsRead, g.sum.rowsRead);
      r.doRowsWritten = add(r.doRowsWritten, g.sum.rowsWritten);
    }),
    dataset<{ max: { storedBytes: number } }>('Room storage', 'durableObjectsStorageGroups', 'max { storedBytes }', (g) => {
      const r = row(g.dimensions.date);
      r.doStoredBytes = Math.max(r.doStoredBytes ?? 0, g.max.storedBytes);
    }),
  ]);

  out.analytics = { status: errors.length >= 7 ? 'error' : 'ok', days: [...days.values()].sort((a, b) => a.day.localeCompare(b.day)), error: errors.join(' · ') };
  return out;
}
