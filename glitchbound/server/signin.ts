import { defaultNickname } from '../src/platform/progression';
import type { GoogleIdentity } from './google';
import type { Env } from './http';
import { createSession, sessionCookie, type UserRow } from './session';

/** Finds or creates the user for a verified identity and starts a session. */
export async function signIn(env: Env, request: Request, id: GoogleIdentity): Promise<{ user: UserRow; cookie: string }> {
  const now = Date.now();
  let user = await env.DB.prepare('SELECT * FROM users WHERE google_sub = ?').bind(id.sub).first<UserRow>();
  if (!user) {
    const userId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO users (id, google_sub, email, name, avatar, nickname, xp, notify, created_at, last_seen) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`,
    )
      .bind(userId, id.sub, id.email, id.name, id.picture, defaultNickname(id.givenName || id.name, userId), now, now)
      .run();
  } else {
    await env.DB.prepare('UPDATE users SET email = ?, name = ?, avatar = ?, last_seen = ? WHERE id = ?').bind(id.email, id.name, id.picture, now, user.id).run();
  }
  user = (await env.DB.prepare('SELECT * FROM users WHERE google_sub = ?').bind(id.sub).first<UserRow>())!;
  // A verified sign-in confirms any earlier newsletter signup for the same address.
  await env.DB.prepare(`UPDATE subscribers SET user_id = ? WHERE email = ? AND user_id IS NULL`).bind(user.id, id.email).run();
  const token = await createSession(env, user.id);
  return { user, cookie: sessionCookie(token, request) };
}
