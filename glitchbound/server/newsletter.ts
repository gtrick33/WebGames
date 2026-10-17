import { arcadeEmail } from './arcadeMail';
import { emailEnabled, sendBatch } from './email';
import { randomToken, siteUrl, type Env } from './http';

export const EMAIL_RE = /^[^@\s"<>]{1,64}@[^@\s"<>]{1,180}\.[a-z]{2,24}$/i;

/** Sends the double opt-in email. Returns false when email is not configured yet. */
export async function sendConfirmation(env: Env, request: Request, email: string, token: string): Promise<boolean> {
  if (!emailEnabled(env)) return false;
  const base = siteUrl(env, request);
  const confirm = `${base}/api/subscribe/confirm?token=${encodeURIComponent(token)}`;
  const { html, text } = arcadeEmail({
    kicker: 'ONE STEP LEFT',
    title: 'Confirm your new-game alerts',
    intro: ['Tap below and we will email you whenever a new game launches on GlitchBound. Nothing else, and you can unsubscribe in one tap.'],
    link: { label: 'YES, NOTIFY ME', url: confirm },
    signoff: 'The GlitchBound team',
    footer: 'If you did not ask for this, ignore this email and nothing happens.',
  });
  await sendBatch(env, [{ to: email, subject: 'Confirm your GlitchBound new-game alerts', html, text }]);
  return true;
}

export async function upsertPending(env: Env, email: string): Promise<{ token: string; status: string }> {
  const existing = await env.DB.prepare('SELECT status, token FROM subscribers WHERE email = ?').bind(email).first<{ status: string; token: string }>();
  if (existing?.status === 'confirmed') return existing;
  const token = existing?.token ?? randomToken(24);
  await env.DB.prepare(
    `INSERT INTO subscribers (email, status, token, created_at) VALUES (?, 'pending', ?, ?)
     ON CONFLICT (email) DO UPDATE SET status = 'pending'`,
  )
    .bind(email, token, Date.now())
    .run();
  return { token, status: 'pending' };
}
