import { validateNickname } from '../../src/platform/progression';
import { bad, json, readJson, sameOrigin, type Ctx } from '../../server/http';
import { buildMe, clientDay } from '../../server/members';
import { clearCookie, currentUser, requireUser } from '../../server/session';
import { randomToken } from '../../server/http';

/** GET /api/me?day=YYYY-MM-DD: the signed-in member, or { user: null }. */
export async function onRequestGet({ request, env }: Ctx): Promise<Response> {
  const user = await currentUser(env, request);
  if (!user) return json({ user: null });
  return json({ user: await buildMe(env, user, clientDay(new URL(request.url).searchParams.get('day'))) });
}

/** PATCH /api/me { nickname?, notify?, day? } */
export async function onRequestPatch({ request, env }: Ctx): Promise<Response> {
  if (!sameOrigin(request)) return bad('bad_origin', 403);
  const user = await requireUser(env, request);
  if (user instanceof Response) return user;
  const body = await readJson(request);
  if (!body) return bad('bad_request');
  if (body.nickname !== undefined) {
    const error = validateNickname(body.nickname);
    if (error) return bad('bad_nickname', 400, { message: error });
    const nick = (body.nickname as string).trim();
    const taken = await env.DB.prepare('SELECT 1 FROM users WHERE nickname = ? COLLATE NOCASE AND id != ?').bind(nick, user.id).first();
    if (taken) return bad('bad_nickname', 409, { message: 'That nickname is taken.' });
    await env.DB.prepare('UPDATE users SET nickname = ? WHERE id = ?').bind(nick, user.id).run();
  }
  if (typeof body.notify === 'boolean') {
    await env.DB.prepare('UPDATE users SET notify = ? WHERE id = ?').bind(body.notify ? 1 : 0, user.id).run();
    // Google verified this address, so a signed-in opt-in is confirmed immediately.
    if (body.notify) {
      await env.DB.prepare(
        `INSERT INTO subscribers (email, status, token, user_id, created_at, confirmed_at) VALUES (?, 'confirmed', ?, ?, ?, ?)
         ON CONFLICT (email) DO UPDATE SET status = 'confirmed', user_id = excluded.user_id, confirmed_at = excluded.confirmed_at`,
      )
        .bind(user.email, randomToken(24), user.id, Date.now(), Date.now())
        .run();
    } else {
      await env.DB.prepare(`UPDATE subscribers SET status = 'unsubscribed' WHERE email = ?`).bind(user.email).run();
    }
  }
  const fresh = await currentUser(env, request, true);
  return json({ user: await buildMe(env, fresh!, clientDay(body.day)) });
}

/**
 * DELETE /api/me: deletes the account and everything linked to it: coins and emails staff sent it
 * too, and a QA tester leaves the team (the QA audit trail is a legal record and stays).
 */
export async function onRequestDelete({ request, env }: Ctx): Promise<Response> {
  if (!sameOrigin(request)) return bad('bad_origin', 403);
  const user = await requireUser(env, request);
  if (user instanceof Response) return user;
  await env.DB.batch(
    ['sessions', 'favorites', 'runs', 'bests', 'dailies', 'quest_claims', 'coin_grants', 'player_emails', 'staff'].map((t) => env.DB.prepare(`DELETE FROM ${t} WHERE user_id = ?`).bind(user.id)).concat([
      env.DB.prepare('UPDATE events SET user_id = NULL WHERE user_id = ?').bind(user.id),
      env.DB.prepare('DELETE FROM subscribers WHERE user_id = ? OR email = ?').bind(user.id, user.email),
      env.DB.prepare('UPDATE feedback SET user_id = NULL WHERE user_id = ?').bind(user.id),
      env.DB.prepare("UPDATE bug_reports SET user_id = NULL, contact = '' WHERE user_id = ?").bind(user.id),
      env.DB.prepare('DELETE FROM users WHERE id = ?').bind(user.id),
    ]),
  );
  return json({ ok: true }, 200, { 'set-cookie': clearCookie(request) });
}
