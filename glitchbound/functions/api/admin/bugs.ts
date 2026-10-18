import { bad, json, readJson, sameOrigin, type Ctx } from '../../../server/http';
import { BUG_STATUSES } from '../../../server/reports';
import { requireAdmin } from '../../../server/session';

/** POST /api/admin/bugs { id, status, note? }: triage a bug report (the reporter sees the status on /me/bugs). */
export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (!sameOrigin(request)) return bad('forbidden', 403);
  const admin = await requireAdmin(env, request);
  if (admin instanceof Response) return admin;
  const body = await readJson(request, 4096);
  const id = typeof body?.id === 'number' ? Math.floor(body.id) : 0;
  const status = typeof body?.status === 'string' && (BUG_STATUSES as readonly string[]).includes(body.status) ? body.status : null;
  if (!id || !status) return bad('invalid');
  const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 500) : '';
  await env.DB.prepare('UPDATE bug_reports SET status = ?, admin_note = ?, updated_at = ? WHERE id = ?').bind(status, note, Date.now(), id).run();
  return json({ ok: true });
}
