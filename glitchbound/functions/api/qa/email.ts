import { auditAction } from '../../../server/audit';
import { bad, json, readJson, sameOrigin, type Ctx } from '../../../server/http';
import { checkEmail, emailPlayer, getPlayer, playerDetail, QA_EMAILS_PER_HOUR } from '../../../server/qa';
import { requireStaff } from '../../../server/session';

/** POST /api/qa/email { userId, subject, message }: emails one player from hello@glitchboundstudio.com. */
export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (!sameOrigin(request)) return bad('bad_origin', 403);
  const staff = await requireStaff(env, request);
  if (staff instanceof Response) return staff;
  const body = await readJson(request, 16384);
  const target = await getPlayer(env, typeof body?.userId === 'string' ? body.userId : '');
  if (!target) return bad('not_found', 404, { message: 'No player with that id.' });
  const mail = checkEmail(body);
  if (typeof mail === 'string') return bad('bad_email', 400, { message: mail });
  if (staff.role === 'qa') {
    const recent = await env.DB.prepare(`SELECT COUNT(*) AS n FROM qa_audit WHERE actor_id = ? AND action = 'email.send' AND ts > ?`).bind(staff.user.id, Date.now() - 3600_000).first<{ n: number }>();
    if ((recent?.n ?? 0) >= QA_EMAILS_PER_HOUR) return bad('slow_down', 429, { message: `That’s ${QA_EMAILS_PER_HOUR} emails this hour. Try again later or ask an admin.` });
  }
  const sent = await emailPlayer(env, target, mail.subject, mail.message, staff.user.email);
  await auditAction(env, request, staff, { action: 'email.send', target, detail: { to: target.email, subject: mail.subject, message: mail.message, result: sent }, status: sent.ok ? 200 : 502 });
  if (!sent.ok) {
    const message = sent.error === 'email_not_configured' ? 'Email sending is not switched on (no Resend key).' : 'The email could not be sent. Try again in a minute.';
    return bad(sent.error ?? 'send_failed', 502, { message, player: await playerDetail(env, target) });
  }
  return json({ ok: true, player: await playerDetail(env, target) });
}
