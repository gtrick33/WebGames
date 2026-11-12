import type { FriendInvite } from '../../../src/platform/apiTypes';
import { bad, json, readJson, sameOrigin, type Ctx } from '../../../server/http';
import { currentUser, requireUser } from '../../../server/session';
import { invitePath, presencePlace, stampPresence } from '../../../server/friends';

/**
 * GET /api/friends/invites: friends asking you to join them right now. `?in=<game>` says the asker is in that game
 * (Sigilfall asks from inside itself). Asking is also how a tab says its player is here: friends see them as online
 * for a couple of minutes after (server/friends.ts).
 */
export async function onRequestGet({ request, env }: Ctx): Promise<Response> {
  const user = await currentUser(env, request);
  if (!user) return json({ invites: [] });
  await stampPresence(env, user as { id: string; online_at?: number; online_in?: string }, presencePlace(new URL(request.url).searchParams.get('in')));
  const rows = await env.DB.prepare(
    `SELECT i.id, i.game, i.code, u.nickname FROM friend_invites i JOIN users u ON u.id = i.from_id
     JOIN friends f ON f.user_id = i.to_id AND f.friend_id = i.from_id
     WHERE i.to_id = ? AND i.expires_at > ? ORDER BY i.created_at DESC LIMIT 5`,
  )
    .bind(user.id, Date.now())
    .all<{ id: number; game: string; code: string; nickname: string }>();
  const invites: FriendInvite[] = rows.results.flatMap((r) => {
    const href = invitePath(r.game, r.code);
    // (`code` is the room's own: a game that shows the invitation inside itself joins by it, without leaving)
    return href ? [{ id: r.id, game: r.game, from: r.nickname, href, code: r.code }] : [];
  });
  return json({ invites });
}

/** POST /api/friends/invites { id }: done with this invite (joined or dismissed). */
export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (!sameOrigin(request)) return bad('bad_origin', 403);
  const user = await requireUser(env, request);
  if (user instanceof Response) return user;
  const body = await readJson(request);
  if (!body || typeof body.id !== 'number') return bad('bad_request');
  await env.DB.prepare('DELETE FROM friend_invites WHERE id = ? AND to_id = ?').bind(body.id, user.id).run();
  return json({ ok: true });
}
