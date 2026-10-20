import { announcementMail } from '../../../server/announcement';
import { emailEnabled, sendBatch } from '../../../server/email';
import { bad, json, readJson, sha256, siteUrl, utcDay, type Ctx } from '../../../server/http';
import { welcomeMail } from '../../../server/welcome';

/**
 * POST /api/admin/test-email { to, kind: 'announce' | 'welcome' }  with header  x-admin-token: <ADMIN_TEST_TOKEN>
 *
 * Sends a preview of a real email template (a made-up game for announcements), marked as a test.
 * Only to the addresses in ADMIN_EMAILS, and only with the ADMIN_TEST_TOKEN secret.
 */
export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  const expected = env.ADMIN_TEST_TOKEN;
  const given = request.headers.get('x-admin-token') ?? '';
  if (!expected || expected.length < 24 || (await sha256(given)) !== (await sha256(expected))) return bad('forbidden', 403);
  if (!emailEnabled(env)) return bad('email_not_configured', 503);
  const body = await readJson(request);
  const to = typeof body?.to === 'string' ? body.to.trim().toLowerCase() : '';
  const admins = (env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!admins.includes(to)) return bad('not_an_admin_address', 400);
  const base = siteUrl(env, request);

  if (body?.kind === 'welcome') {
    const mail = welcomeMail(base, { id: `preview-${utcDay()}`, email: to, nickname: typeof body.nickname === 'string' ? body.nickname.slice(0, 14) : 'Player' }, utcDay());
    const sent = await sendBatch(env, [{ ...mail, subject: `${mail.subject} (test)` }]);
    return json({ ok: true, sent, to, kind: 'welcome' });
  }

  const mail = announcementMail(
    base,
    to,
    'test-preview-token-not-valid',
    { title: 'Pixel Drift', tagline: 'One button. Endless neon corners. How long can you hold the line?', categories: ['racing'] },
    'Pixel Drift is live on GlitchBound (test)',
    'A new game just landed in the arcade (this is a test, the game is made up).\nTap to drift a little pixel car around neon corners and chain perfect turns into a combo. It has its own Daily Challenge too.',
  );
  const sent = await sendBatch(env, [mail]);
  return json({ ok: true, sent, to, kind: 'announce' });
}
