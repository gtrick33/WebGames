import { normalizeEmail } from '../../../server/emailLogin';
import { bad, isLocal, json, readJson, sameOrigin, type Ctx } from '../../../server/http';
import { isAdminEmail, requireAdmin } from '../../../server/session';
import { inviteStaff, listStaff, type StaffDb } from '../../../server/staff';

/** GET /api/admin/staff: the QA team (admins only). */
export async function onRequestGet({ request, env }: Ctx): Promise<Response> {
  const admin = await requireAdmin(env, request);
  if (admin instanceof Response) return admin;
  return json({ staff: await listStaff(env) });
}

/**
 * POST /api/admin/staff, one change at a time:
 *   { action: 'invite', email }   add a QA tester: emails them a one-time invitation (also renews one)
 *   { action: 'block', email }    take their QA access away for now (they stay on the list)
 *   { action: 'unblock', email }  give it back
 *   { action: 'remove', email }   delete them from the team (their audit trail stays)
 */
export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (!sameOrigin(request)) return bad('bad_origin', 403);
  const admin = await requireAdmin(env, request);
  if (admin instanceof Response) return admin;
  const body = await readJson(request);
  const email = normalizeEmail(body?.email);
  if (!email) return bad('bad_email', 400, { message: 'That email address does not look right.' });
  const now = Date.now();
  const row = await env.DB.prepare('SELECT * FROM staff WHERE email = ?').bind(email).first<StaffDb>();
  const by = admin.email.toLowerCase();
  switch (body?.action) {
    case 'invite': {
      if (isAdminEmail(env, email)) return bad('is_admin', 409, { message: 'That address is an admin: admins already have every QA tool.' });
      if (row?.status === 'active') return bad('already_active', 409, { message: 'Already on the QA team.' });
      if (row?.status === 'blocked') return bad('blocked', 409, { message: 'This tester is blocked. Unblock them instead.' });
      try {
        const { sent, link } = await inviteStaff(env, request, email, admin, now);
        // Local development has no email: the link comes back so the flow can be tried.
        const dev = !sent && env.DEV_LOGIN === '1' && isLocal(request) ? { devLink: link } : {};
        return json({ ok: true, sent, ...dev, staff: await listStaff(env) });
      } catch {
        return bad('send_failed', 502, { message: 'The invitation was saved but the email could not be sent. Try “Resend invite” in a minute.' });
      }
    }
    case 'block':
    case 'unblock': {
      if (!row) return bad('not_found', 404, { message: 'Not on the QA team.' });
      const status = body.action === 'block' ? 'blocked' : row.user_id ? 'active' : 'invited';
      await env.DB.prepare('UPDATE staff SET status = ?, updated_by = ?, updated_at = ? WHERE email = ?').bind(status, by, now, email).run();
      return json({ ok: true, staff: await listStaff(env) });
    }
    case 'remove': {
      if (!row) return bad('not_found', 404, { message: 'Not on the QA team.' });
      await env.DB.prepare('DELETE FROM staff WHERE email = ?').bind(email).run();
      return json({ ok: true, staff: await listStaff(env) });
    }
    default:
      return bad('bad_request');
  }
}
