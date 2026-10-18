import { nicknameCandidates } from '../src/platform/progression';
import { audit } from './audit';
import type { GoogleIdentity } from './google';
import { bad, type Env } from './http';
import { createSession, isAdmin, sessionCookie, type UserRow } from './session';

/** Thrown by signIn for a banned account. */
export class AccountBanned extends Error {
  constructor() {
    super('banned');
  }
}

export const BANNED_MESSAGE = 'This account has been suspended. If you think this is a mistake, write to hello@glitchboundstudio.com.';
export const bannedResponse = (): Response => bad('banned', 403, { message: BANNED_MESSAGE });

/** signIn, with a banned account turned into null (the caller answers with bannedResponse). */
export async function signInUnlessBanned(env: Env, request: Request, id: Identity): Promise<Awaited<ReturnType<typeof signIn>> | null> {
  try {
    return await signIn(env, request, id);
  } catch (err) {
    if (err instanceof AccountBanned) return null;
    throw err;
  }
}

/** A verified identity: from Google, or an email address proven with a one-time code. */
export type Identity = GoogleIdentity & { provider: 'google' | 'email'; nickname?: string };

async function pickNickname(env: Env, id: Identity, seed: string): Promise<string> {
  const wanted = id.nickname ? [id.nickname] : [];
  const list = [...wanted, ...nicknameCandidates(id.name, id.givenName, seed)];
  const placeholders = list.map(() => '?').join(',');
  const taken = await env.DB.prepare(`SELECT nickname FROM users WHERE nickname COLLATE NOCASE IN (${placeholders})`)
    .bind(...list)
    .all<{ nickname: string }>();
  const used = new Set(taken.results.map((r) => r.nickname.toLowerCase()));
  return list.find((n) => !used.has(n.toLowerCase())) ?? `Player${seed.replace(/[^0-9]/g, '').slice(0, 6) || '1000'}`;
}

/**
 * Finds or creates the user for a verified identity and starts a session. Accounts are linked by
 * verified email: signing in with Google and with an email code for the same address gives the
 * same account.
 */
export async function signIn(env: Env, request: Request, id: Identity): Promise<{ user: UserRow; cookie: string; created: boolean }> {
  const now = Date.now();
  let created = false;
  let user =
    (await env.DB.prepare('SELECT * FROM users WHERE google_sub = ?').bind(id.sub).first<UserRow>()) ??
    (await env.DB.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE ORDER BY created_at LIMIT 1').bind(id.email).first<UserRow>());
  if (!user) {
    const userId = crypto.randomUUID();
    const nickname = await pickNickname(env, id, userId);
    await env.DB.prepare(
      `INSERT INTO users (id, google_sub, email, name, avatar, nickname, xp, notify, created_at, last_seen) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`,
    )
      .bind(userId, id.sub, id.email, id.name, id.picture, nickname, now, now)
      .run();
    created = true;
    user = (await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first<UserRow>())!;
  } else {
    if (user.banned_at) throw new AccountBanned();
    // An email-code account that later signs in with Google is upgraded to the Google identity.
    const sub = id.provider === 'google' && user.google_sub.startsWith('email:') ? id.sub : user.google_sub;
    await env.DB.prepare('UPDATE users SET google_sub = ?, name = ?, avatar = ?, last_seen = ? WHERE id = ?')
      .bind(sub, id.name || user.name, id.picture || user.avatar, now, user.id)
      .run();
  }
  await env.DB.prepare(`UPDATE subscribers SET user_id = ? WHERE email = ? AND user_id IS NULL`).bind(user.id, id.email).run();
  const token = await createSession(env, user.id);
  // QA testers' sign-ins go into the audit trail (admins' do not).
  if (!created && !isAdmin(env, user)) {
    const staff = await env.DB.prepare('SELECT status FROM staff WHERE user_id = ?').bind(user.id).first<{ status: string }>();
    if (staff) await audit(env, request, user, { kind: 'auth', action: 'auth.sign_in', detail: { provider: id.provider, staffStatus: staff.status } });
  }
  return { user, cookie: sessionCookie(token, request), created };
}
