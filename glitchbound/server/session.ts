import { bad, randomToken, sha256, type Env } from './http';

export const COOKIE = 'gb_session';
const DAYS = 30;

export interface UserRow {
  id: string;
  google_sub: string;
  email: string;
  name: string;
  avatar: string;
  nickname: string;
  xp: number;
  notify: number;
  created_at: number;
  last_seen: number;
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie') ?? '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

export function sessionCookie(token: string, request: Request): string {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${DAYS * 86400}${secure}`;
}

export function clearCookie(request: Request): string {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

/** Creates a session and returns the cookie value. Only a hash of the token is stored. */
export async function createSession(env: Env, userId: string): Promise<string> {
  const token = randomToken();
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND expires_at < ?').bind(userId, now),
    env.DB.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').bind(await sha256(token), userId, now, now + DAYS * 86400_000),
  ]);
  return token;
}

export async function destroySession(env: Env, request: Request): Promise<void> {
  const token = readCookie(request, COOKIE);
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run();
}

export async function currentUser(env: Env, request: Request): Promise<UserRow | null> {
  const token = readCookie(request, COOKIE);
  if (!token || token.length > 100) return null;
  const row = await env.DB.prepare(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?`,
  )
    .bind(await sha256(token), Date.now())
    .first<UserRow>();
  if (row && Date.now() - row.last_seen > 3600_000) {
    await env.DB.prepare('UPDATE users SET last_seen = ? WHERE id = ?').bind(Date.now(), row.id).run();
  }
  return row;
}

export function isAdmin(env: Env, user: UserRow | null): boolean {
  if (!user) return false;
  const admins = (env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(user.email.toLowerCase());
}

/** Returns the user, or a 401 response to send back. */
export async function requireUser(env: Env, request: Request): Promise<UserRow | Response> {
  return (await currentUser(env, request)) ?? bad('sign_in_required', 401);
}

export async function requireAdmin(env: Env, request: Request): Promise<UserRow | Response> {
  const user = await currentUser(env, request);
  if (!user) return bad('sign_in_required', 401);
  return isAdmin(env, user) ? user : bad('forbidden', 403);
}
