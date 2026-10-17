import { bad, json, readJson, sameOrigin, type Ctx } from '../../server/http';
import { EMAIL_RE, sendConfirmation, upsertPending } from '../../server/newsletter';

/**
 * POST /api/subscribe { email }: "tell me about new games". Double opt-in: nothing is sent to the
 * address except one confirmation email, and announcements go only to confirmed addresses.
 */
export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (!sameOrigin(request)) return bad('bad_origin', 403);
  const body = await readJson(request);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!EMAIL_RE.test(email)) return bad('bad_email', 400, { message: 'That email address does not look right.' });
  const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM subscribers WHERE created_at > ?').bind(Date.now() - 60_000).first<{ n: number }>();
  if ((recent?.n ?? 0) > 20) return bad('slow_down', 429);
  const { token, status } = await upsertPending(env, email);
  if (status === 'confirmed') return json({ status: 'confirmed' });
  let sent: boolean;
  try {
    sent = await sendConfirmation(env, request, email, token);
  } catch {
    sent = false;
  }
  return json({ status: sent ? 'check_inbox' : 'saved' });
}
