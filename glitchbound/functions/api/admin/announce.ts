import { getGame } from '../../../src/catalog/catalog';
import { announcementMail } from '../../../server/announcement';
import { emailEnabled, sendBatch, type Mail } from '../../../server/email';
import { bad, json, readJson, sameOrigin, siteUrl, type Ctx } from '../../../server/http';
import { sendConfirmation } from '../../../server/newsletter';
import { requireAdmin } from '../../../server/session';

/**
 * POST /api/admin/announce
 *   { action: 'test' | 'send', game, subject, message }  new-game announcement (test goes only to you)
 *   { action: 'confirmations' }                          (re)send confirmation emails to pending signups
 */
export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (!sameOrigin(request)) return bad('bad_origin', 403);
  const admin = await requireAdmin(env, request);
  if (admin instanceof Response) return admin;
  if (!emailEnabled(env)) return bad('email_not_configured', 503, { message: 'Set RESEND_API_KEY first (see docs/LAUNCH-GUIDE.md).' });
  const body = await readJson(request, 16_384);
  const base = siteUrl(env, request);

  if (body?.action === 'confirmations') {
    const pending = await env.DB.prepare(`SELECT email, token FROM subscribers WHERE status = 'pending' LIMIT 500`).all<{ email: string; token: string }>();
    let sent = 0;
    for (const p of pending.results) if (await sendConfirmation(env, request, p.email, p.token)) sent++;
    return json({ ok: true, sent });
  }

  const game = getGame(typeof body?.game === 'string' ? body.game : '');
  const subject = typeof body?.subject === 'string' ? body.subject.trim().slice(0, 120) : '';
  const message = typeof body?.message === 'string' ? body.message.trim().slice(0, 2000) : '';
  if (!game || !subject || !message) return bad('bad_request', 400, { message: 'Pick a game and write a subject and message.' });
  const make = (to: string, token: string): Mail => announcementMail(base, to, token, game, subject, message);

  if (body?.action === 'test') {
    const sent = await sendBatch(env, [make(admin.email, 'test-preview-token-not-valid')]);
    return json({ ok: true, sent, to: admin.email });
  }
  if (body?.action !== 'send') return bad('bad_request');
  const list = await env.DB.prepare(`SELECT email, token FROM subscribers WHERE status = 'confirmed'`).all<{ email: string; token: string }>();
  const sent = await sendBatch(env, list.results.map((r) => make(r.email, r.token)));
  await env.DB.prepare('INSERT INTO announcements (game, subject, sent_at, recipients, sent_by) VALUES (?, ?, ?, ?, ?)').bind(game.slug, subject, Date.now(), sent, admin.email).run();
  return json({ ok: true, sent });
}
