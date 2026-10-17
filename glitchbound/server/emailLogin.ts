import { arcadeEmail } from './arcadeMail';
import { emailEnabled, sendBatch } from './email';
import { randomToken, sha256, siteUrl, type Env } from './http';
import { EMAIL_RE } from './newsletter';
import type { Identity } from './signin';

export const CODE_TTL_MS = 15 * 60_000;
const MAX_ATTEMPTS = 5;

interface CodeRow {
  id: string;
  email: string;
  code_hash: string;
  nickname: string | null;
  attempts: number;
  expires_at: number;
  used: number;
}

function sixDigits(): string {
  const n = new Uint32Array(1);
  crypto.getRandomValues(n);
  return String(n[0]! % 1_000_000).padStart(6, '0');
}

export function normalizeEmail(raw: unknown): string | null {
  const email = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  return EMAIL_RE.test(email) ? email : null;
}

/** Emails a 6-digit code and a one-click link (both valid 15 minutes, single use). */
export async function startEmailLogin(env: Env, request: Request, email: string, nickname: string | null): Promise<'sent' | 'rate_limited' | 'disabled'> {
  if (!emailEnabled(env)) return 'disabled';
  const now = Date.now();
  const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM login_codes WHERE email = ? AND created_at > ?').bind(email, now - 3600_000).first<{ n: number }>();
  if ((recent?.n ?? 0) >= 5) return 'rate_limited';
  const code = sixDigits();
  const link = randomToken(32);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM login_codes WHERE expires_at < ?').bind(now - 86400_000),
    env.DB.prepare('INSERT INTO login_codes (id, email, code_hash, link_hash, nickname, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(
      crypto.randomUUID(),
      email,
      await sha256(`${email}:${code}`),
      await sha256(link),
      nickname,
      now,
      now + CODE_TTL_MS,
    ),
  ]);
  const url = `${siteUrl(env, request)}/api/auth/email/link?token=${encodeURIComponent(link)}`;
  const { html, text } = arcadeEmail({
    kicker: 'SIGN-IN CODE',
    title: 'Your code is ready',
    intro: ['Type this code on GlitchBound to sign in. It works once, for 15 minutes.'],
    code,
    link: { label: 'OR SIGN IN WITH ONE TAP', url },
    signoff: 'The GlitchBound team',
    footer: 'If you did not try to sign in, ignore this email. Nobody can sign in without this code.',
  });
  await sendBatch(env, [{ to: email, subject: `${code} is your GlitchBound sign-in code`, html, text }]);
  return 'sent';
}

function identityFor(row: CodeRow): Identity {
  return { sub: `email:${row.email}`, email: row.email, name: '', givenName: '', picture: '', provider: 'email', nickname: row.nickname ?? undefined };
}

/** Checks a typed code. Each code allows 5 wrong attempts. */
export async function verifyEmailCode(env: Env, email: string, code: string): Promise<Identity | 'invalid' | 'expired' | 'locked'> {
  const row = await env.DB.prepare('SELECT * FROM login_codes WHERE email = ? AND used = 0 ORDER BY created_at DESC LIMIT 1').bind(email).first<CodeRow>();
  if (!row) return 'invalid';
  if (row.expires_at < Date.now()) return 'expired';
  if (row.attempts >= MAX_ATTEMPTS) return 'locked';
  if ((await sha256(`${email}:${code}`)) !== row.code_hash) {
    await env.DB.prepare('UPDATE login_codes SET attempts = attempts + 1 WHERE id = ?').bind(row.id).run();
    return row.attempts + 1 >= MAX_ATTEMPTS ? 'locked' : 'invalid';
  }
  await env.DB.prepare('UPDATE login_codes SET used = 1 WHERE id = ?').bind(row.id).run();
  return identityFor(row);
}

export async function verifyEmailLink(env: Env, token: string): Promise<Identity | null> {
  if (!/^[A-Za-z0-9_-]{30,64}$/.test(token)) return null;
  const row = await env.DB.prepare('SELECT * FROM login_codes WHERE link_hash = ? AND used = 0').bind(await sha256(token)).first<CodeRow>();
  if (!row || row.expires_at < Date.now()) return null;
  await env.DB.prepare('UPDATE login_codes SET used = 1 WHERE id = ?').bind(row.id).run();
  return identityFor(row);
}
