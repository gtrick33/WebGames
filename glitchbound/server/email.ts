/**
 * Email through Resend (https://resend.com/docs/api-reference/emails/send-batch-emails).
 * Every function is a no-op that reports `false` until RESEND_API_KEY is set as a Pages secret.
 */
import type { Env } from './http';

export interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
  unsubscribeUrl?: string;
  /** Override the sender display, e.g. "Sava at GlitchBound <hello@glitchboundstudio.com>". */
  from?: string;
}

export function emailEnabled(env: Env): boolean {
  return !!env.RESEND_API_KEY && !!env.MAIL_FROM;
}

function payload(env: Env, m: Mail): Record<string, unknown> {
  return {
    from: m.from ?? env.MAIL_FROM,
    ...(env.MAIL_REPLY_TO ? { reply_to: env.MAIL_REPLY_TO } : {}),
    to: [m.to],
    subject: m.subject,
    html: m.html,
    text: m.text,
    ...(m.unsubscribeUrl ? { headers: { 'List-Unsubscribe': `<${m.unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } } : {}),
  };
}

/** Sends up to 100 emails per request. Returns how many were accepted. */
export async function sendBatch(env: Env, mails: Mail[]): Promise<number> {
  if (!emailEnabled(env) || mails.length === 0) return 0;
  let sent = 0;
  for (let i = 0; i < mails.length; i += 100) {
    const chunk = mails.slice(i, i + 100);
    const res = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify(chunk.map((m) => payload(env, m))),
    });
    if (!res.ok) throw new Error(`resend_${res.status}: ${(await res.text()).slice(0, 200)}`);
    sent += chunk.length;
  }
  return sent;
}

export const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
