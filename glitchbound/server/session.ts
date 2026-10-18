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
  /** Set while the player is banned (by QA or an admin). */
  banned_at?: number | null;
  ban_reason?: string;
  banned_by?: string;
  /** The QA staff row of this account (active or blocked), from currentUser's join; null for everyone else. */
  staff_status?: string | null;
}

/** Staff roles. Admins are listed in ADMIN_EMAILS; QA testers are invited by an admin (server/staff.ts). */
export type Role = 'admin' | 'qa';

export function readCookie(request: Request, name: string): string | null {
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

async function lookupUser(env: Env, request: Request): Promise<UserRow | null> {
  const token = readCookie(request, COOKIE);
  if (!token || token.length > 100) return null;
  const row = await env.DB.prepare(
    `SELECT u.*, st.status AS staff_status FROM sessions s JOIN users u ON u.id = s.user_id LEFT JOIN staff st ON st.user_id = u.id WHERE s.token_hash = ? AND s.expires_at > ?`,
  )
    .bind(await sha256(token), Date.now())
    .first<UserRow>();
  // A banned player counts as signed out (their sessions are deleted when the ban is made, too).
  if (!row || row.banned_at) return null;
  if (Date.now() - row.last_seen > 3600_000) {
    await env.DB.prepare('UPDATE users SET last_seen = ? WHERE id = ?').bind(Date.now(), row.id).run();
  }
  return row;
}

const known = new WeakMap<Request, Promise<UserRow | null>>();

/**
 * The signed-in member, looked up once per request (the API middleware reads it first to keep the
 * QA audit trail, then the endpoint reuses it). Pass `fresh` to read it again after changing it.
 */
export function currentUser(env: Env, request: Request, fresh = false): Promise<UserRow | null> {
  const seen = fresh ? undefined : known.get(request);
  if (seen) return seen;
  const user = lookupUser(env, request);
  known.set(request, user);
  // A failed lookup is not remembered, so the next caller tries again.
  user.catch(() => known.delete(request));
  return user;
}

export function isAdminEmail(env: Env, email: string): boolean {
  const admins = (env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.toLowerCase());
}

export function isAdmin(env: Env, user: UserRow | null): boolean {
  return !!user && isAdminEmail(env, user.email);
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

/** Admin, QA tester (an accepted, not blocked invitation) or nobody. */
export function roleOf(env: Env, user: UserRow | null): Role | null {
  if (!user) return null;
  if (isAdmin(env, user)) return 'admin';
  return user.staff_status === 'active' ? 'qa' : null;
}

/** QA testers' requests are written to the legal audit trail (blocked ones too); admins' are not. */
export function isAudited(env: Env, user: UserRow | null): boolean {
  return !!user?.staff_status && !isAdmin(env, user);
}

/** The QA tools are for admins and QA testers. Returns the user and role, or a 401/403 response. */
export async function requireStaff(env: Env, request: Request): Promise<{ user: UserRow; role: Role } | Response> {
  const user = await currentUser(env, request);
  if (!user) return bad('sign_in_required', 401);
  const role = roleOf(env, user);
  return role ? { user, role } : bad('forbidden', 403);
}
