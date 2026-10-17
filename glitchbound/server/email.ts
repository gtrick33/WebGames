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
}

export function emailEnabled(env: Env): boolean {
  return !!env.RESEND_API_KEY && !!env.MAIL_FROM;
}

function payload(env: Env, m: Mail): Record<string, unknown> {
  return {
    from: env.MAIL_FROM,
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

/** Simple, email-client-safe layout in the site's neon style. */
export function layoutEmail(opts: { heading: string; body: string; cta?: { label: string; url: string }; footer: string }): string {
  const cta = opts.cta
    ? `<p style="margin:28px 0"><a href="${esc(opts.cta.url)}" style="display:inline-block;background:#22e4ff;color:#07021a;font-weight:800;text-decoration:none;padding:14px 26px;border-radius:999px;border:2px solid #07021a">${esc(opts.cta.label)}</a></p>`
    : '';
  return `<!doctype html><html><body style="margin:0;background:#0d0522;font-family:Avenir Next,Segoe UI,Helvetica,Arial,sans-serif;color:#f6f1ff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0d0522"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#1c0e42;border:2px solid #3b2678;border-radius:20px">
<tr><td style="padding:28px 28px 8px;font:700 13px monospace;letter-spacing:2px;color:#22e4ff">GLITCHBOUND</td></tr>
<tr><td style="padding:0 28px"><h1 style="margin:8px 0 16px;font-size:30px;line-height:1.05;color:#ffffff">${esc(opts.heading)}</h1>
<div style="font-size:16px;line-height:1.55;color:#cfc3f2">${opts.body}</div>${cta}</td></tr>
<tr><td style="padding:16px 28px 28px;font-size:12px;line-height:1.5;color:#a193cf">${opts.footer}</td></tr>
</table></td></tr></table></body></html>`;
}
