import type { CloudUsage } from '../src/platform/apiTypes';
import type { D1Database, Env } from './http';

/**
 * Cloudflare usage for the admin dashboard. Database sizes and row counts come straight from D1 (no
 * setup). Daily request and row-read/write totals need the GraphQL Analytics API: set the secrets
 * CF_API_TOKEN (Account Analytics: Read) and CF_ACCOUNT_ID. Every part fails soft.
 */

/** Free-plan limits (Workers Free + D1 Free), shown next to the usage. */
export const FREE_LIMITS = {
  requestsPerDay: 100_000,
  d1RowsReadPerDay: 5_000_000,
  d1RowsWrittenPerDay: 100_000,
  d1StorageBytesPerDb: 500 * 1024 * 1024,
  d1StorageBytesTotal: 5 * 1024 * 1024 * 1024,
};

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
  };
  if (out.analytics.status !== 'ok') return out;

  const start = day(now - 13 * 86400_000);
  const end = day(now);
  const days = new Map<string, { day: string; requests: number | null; errors: number | null; rowsRead: number; rowsWritten: number; queries: number }>();
  const row = (d: string) => days.get(d) ?? days.set(d, { day: d, requests: null, errors: null, rowsRead: 0, rowsWritten: 0, queries: 0 }).get(d)!;
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

  out.analytics = { status: errors.length === 2 ? 'error' : 'ok', days: [...days.values()].sort((a, b) => a.day.localeCompare(b.day)), error: errors.join(' · ') };
  return out;
}
