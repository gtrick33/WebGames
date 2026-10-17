import type { Ctx } from '../../../server/http';
import { requireAdmin } from '../../../server/session';

/** GET /api/admin/subscribers: CSV export of the new-game email list. Admins only. */
export async function onRequestGet({ request, env }: Ctx): Promise<Response> {
  const admin = await requireAdmin(env, request);
  if (admin instanceof Response) return admin;
  const rows = await env.DB.prepare('SELECT email, status, created_at, confirmed_at FROM subscribers ORDER BY created_at').all<{ email: string; status: string; created_at: number; confirmed_at: number | null }>();
  const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const csv = ['email,status,created,confirmed', ...rows.results.map((r) => [r.email, r.status, new Date(r.created_at).toISOString(), r.confirmed_at ? new Date(r.confirmed_at).toISOString() : ''].map(cell).join(','))].join('\n');
  return new Response(csv + '\n', {
    headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="glitchbound-subscribers.csv"', 'cache-control': 'no-store' },
  });
}
