import type { AuditRowDb } from '../../../server/audit';
import { json, type Ctx } from '../../../server/http';
import { requireAdmin } from '../../../server/session';
import type { AuditRow } from '../../../src/platform/apiTypes';

const PAGE = 100;
const CSV_MAX = 50_000;

/**
 * GET /api/admin/qa-audit?actor=&kind=action|request|auth&target=&before=<id>&format=csv
 * The QA audit trail, newest first (admins only). `before` pages back; CSV exports up to 50,000 rows.
 */
export async function onRequestGet({ request, env }: Ctx): Promise<Response> {
  const admin = await requireAdmin(env, request);
  if (admin instanceof Response) return admin;
  const p = new URL(request.url).searchParams;
  const where: string[] = [];
  const args: unknown[] = [];
  const filter = (sql: string, ...values: unknown[]): void => {
    where.push(sql);
    args.push(...values);
  };
  const actor = p.get('actor')?.trim().toLowerCase();
  if (actor) filter('actor_email = ?', actor);
  const kind = p.get('kind');
  if (kind === 'action' || kind === 'request' || kind === 'auth') filter('kind = ?', kind);
  const target = p.get('target')?.trim();
  if (target) filter('(target_id = ? OR target_email = ?)', target, target.toLowerCase());
  const before = Number(p.get('before'));
  if (Number.isInteger(before) && before > 0) filter('id < ?', before);
  const csv = p.get('format') === 'csv';
  const sql = `SELECT * FROM qa_audit ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY id DESC LIMIT ${csv ? CSV_MAX : PAGE + 1}`;
  const res = await env.DB.prepare(sql).bind(...args).all<AuditRowDb>();
  const rows: AuditRow[] = res.results.map((r) => ({ id: r.id, ts: r.ts, actor: r.actor_email, kind: r.kind, action: r.action, targetId: r.target_id, targetEmail: r.target_email, detail: r.detail, status: r.status, ip: r.ip, userAgent: r.user_agent }));
  if (!csv) return json({ rows: rows.slice(0, PAGE), more: rows.length > PAGE });

  // Spreadsheet-safe cells: quoted when needed, and never read as a formula.
  const cell = (v: unknown): string => {
    let s = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = ['id', 'time_utc', 'qa_email', 'kind', 'action', 'target_id', 'target_email', 'status', 'ip', 'user_agent', 'detail'];
  const lines = rows.map((r) => [r.id, new Date(r.ts).toISOString(), r.actor, r.kind, r.action, r.targetId, r.targetEmail, r.status, r.ip, r.userAgent, r.detail].map(cell).join(','));
  return new Response([head.join(','), ...lines].join('\n') + '\n', {
    headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="glitchbound-qa-audit-${new Date().toISOString().slice(0, 10)}.csv"`, 'cache-control': 'no-store' },
  });
}
