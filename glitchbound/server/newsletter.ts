import { emailEnabled, esc, layoutEmail, sendBatch } from './email';
import { randomToken, siteUrl, type Env } from './http';

export const EMAIL_RE = /^[^@\s"<>]{1,64}@[^@\s"<>]{1,180}\.[a-z]{2,24}$/i;

export function footer(unsubscribeUrl: string): string {
  return `You get this because you asked GlitchBound to tell you about new games. <a href="${esc(unsubscribeUrl)}" style="color:#22e4ff">Unsubscribe</a> any time.`;
}

/** Sends the double opt-in email. Returns false when email is not configured yet. */
export async function sendConfirmation(env: Env, request: Request, email: string, token: string): Promise<boolean> {
  if (!emailEnabled(env)) return false;
  const base = siteUrl(env, request);
  const confirm = `${base}/api/subscribe/confirm?token=${encodeURIComponent(token)}`;
  await sendBatch(env, [
    {
      to: email,
      subject: 'Confirm: tell me when a new GlitchBound game drops',
      html: layoutEmail({
        heading: 'One click to confirm',
        body: '<p>Confirm your address and we will email you when a new game launches on GlitchBound. No other mail, ever.</p>',
        cta: { label: 'Yes, notify me', url: confirm },
        footer: 'If you did not ask for this, ignore this email and nothing happens.',
      }),
      text: `Confirm your GlitchBound new-game alerts: ${confirm}\nIf you did not ask for this, ignore this email.`,
    },
  ]);
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
