import { emailEnabled, esc, layoutEmail, sendBatch } from '../../../server/email';
import { bad, json, readJson, sha256, siteUrl, type Ctx } from '../../../server/http';

/**
 * POST /api/admin/test-email { to }  with header  x-admin-token: <ADMIN_TEST_TOKEN>
 *
 * Sends a clearly-marked TEST announcement for a made-up game, to check how announcements look and
 * whether they land in the inbox. Can only send to the addresses in ADMIN_EMAILS, and only with the
 * ADMIN_TEST_TOKEN secret, so it cannot be used to email anyone else.
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
  const game = { title: 'Pixel Drift', tagline: 'Drift a glowing pixel car around ever-tighter neon corners. One button. Endless corners.' };
  const message =
    'A brand-new game just landed in the arcade: Pixel Drift. Tap to drift, release to straighten, and chain perfect corners for a combo. ' +
    'There is a new Daily Challenge for it too.';
  const sent = await sendBatch(env, [
    {
      to,
      subject: '[TEST] New on GlitchBound: Pixel Drift',
      unsubscribeUrl: `${base}/api/unsubscribe?token=test-preview-token-not-valid`,
      html: layoutEmail({
        heading: game.title,
        body: `<p style="margin:0 0 12px;color:#ffd12e;font:700 12px monospace;letter-spacing:1px">TEST EMAIL · MOCK GAME · NOT A REAL RELEASE</p>
<p style="margin:0 0 12px">${esc(message)}</p><p style="margin:0;color:#a193cf">${esc(game.tagline)}</p>`,
        cta: { label: 'Open the arcade', url: base },
        footer: `This is a test of GlitchBound new-game announcements, sent only to admins. Real announcements include a one-click unsubscribe link.`,
      }),
      text: `[TEST] ${game.title}\n\n${message}\n\n${game.tagline}\n\nOpen the arcade: ${base}\n\nThis is a test email sent only to admins.`,
    },
  ]);
  return json({ ok: true, sent, to });
}
