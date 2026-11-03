import { pinPoints, shelfRank } from '../../src/catalog/pins';
import type { FriendRow, FriendsView } from '../../src/platform/apiTypes';
import { levelForXp } from '../../src/platform/progression';
import { bad, json, readJson, sameOrigin, type Ctx, type Env } from '../../server/http';
import { INVITE_PATHS } from '../../server/friends';
import { syncPins } from '../../server/pins';
import { currentUser, requireUser, type UserRow } from '../../server/session';

/** Enough for a real circle of friends, and a limit on a code that leaked. */
const MAX_FRIENDS = 100;
/** How long a "join me" lasts: a room doesn't wait much longer. */
const INVITE_MS = 20 * 60_000;

/** Easy to read out loud: no 0/O, 1/I/L. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function newCode(): string {
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  return [...b].map((x) => CODE_ALPHABET[x % CODE_ALPHABET.length]).join('');
}

const normal = (raw: unknown): string => (typeof raw === 'string' ? raw.toUpperCase().replace(/[^A-Z0-9]/g, '') : '');

async function ownCode(env: Env, user: UserRow & { friend_code?: string | null }): Promise<string> {
  if (user.friend_code) return user.friend_code;
  const row = await env.DB.prepare('SELECT friend_code FROM users WHERE id = ?').bind(user.id).first<{ friend_code: string | null }>();
  if (row?.friend_code) return row.friend_code;
  const code = newCode();
  await env.DB.prepare('UPDATE users SET friend_code = ? WHERE id = ?').bind(code, user.id).run();
  return code;
}

async function view(env: Env, user: UserRow): Promise<FriendsView> {
  const [code, rows, pins, last, blocked] = await Promise.all([
    ownCode(env, user),
    env.DB.prepare('SELECT u.id, u.nickname, u.xp FROM friends f JOIN users u ON u.id = f.friend_id WHERE f.user_id = ? AND u.banned_at IS NULL ORDER BY u.nickname COLLATE NOCASE').bind(user.id).all<{ id: string; nickname: string; xp: number }>(),
    env.DB.prepare('SELECT p.user_id, p.pin FROM pins p JOIN friends f ON f.friend_id = p.user_id WHERE f.user_id = ?').bind(user.id).all<{ user_id: string; pin: string }>(),
    env.DB.prepare(`SELECT r.user_id, r.game, MAX(r.ended_at) AS at FROM runs r JOIN friends f ON f.friend_id = r.user_id WHERE f.user_id = ? AND r.status = 'ok' GROUP BY r.user_id`).bind(user.id).all<{ user_id: string; game: string; at: number }>(),
    env.DB.prepare('SELECT u.id, u.nickname FROM blocks b JOIN users u ON u.id = b.blocked_id WHERE b.user_id = ? ORDER BY u.nickname COLLATE NOCASE').bind(user.id).all<{ id: string; nickname: string }>(),
  ]);
  const held = new Map<string, string[]>();
  for (const p of pins.results) held.set(p.user_id, [...(held.get(p.user_id) ?? []), p.pin]);
  const played = new Map(last.results.map((r) => [r.user_id, r]));
  const friends: FriendRow[] = rows.results.map((u) => {
    const points = pinPoints(held.get(u.id) ?? []);
    const seen = played.get(u.id);
    return { id: u.id, nickname: u.nickname, level: levelForXp(u.xp), points, rank: shelfRank(points).title, lastGame: seen?.game ?? null, lastAt: seen?.at ?? null };
  });
  return { code, friends, blocked: blocked.results };
}

/** GET /api/friends: your code, friends and blocks. ?code=X: whose code this is (for the page a shared link opens, signed in or not). */
export async function onRequestGet({ request, env }: Ctx): Promise<Response> {
  const code = normal(new URL(request.url).searchParams.get('code'));
  if (code) {
    const owner = await env.DB.prepare('SELECT nickname, xp FROM users WHERE friend_code = ? AND banned_at IS NULL').bind(code).first<{ nickname: string; xp: number }>();
    return owner ? json({ nickname: owner.nickname, level: levelForXp(owner.xp) }) : bad('unknown_code', 404);
  }
  const user = await currentUser(env, request);
  if (!user) return bad('sign_in', 401);
  return json(await view(env, user));
}

/** POST /api/friends { action: 'add' | 'remove' | 'block' | 'unblock' | 'new_code' | 'invite', ... } */
export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (!sameOrigin(request)) return bad('bad_origin', 403);
  const user = await requireUser(env, request);
  if (user instanceof Response) return user;
  const body = await readJson(request);
  if (!body) return bad('bad_request');
  const id = typeof body.id === 'string' ? body.id : '';
  const now = Date.now();
  const unfriend = (a: string, b: string) => [env.DB.prepare('DELETE FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)').bind(a, b, b, a), env.DB.prepare('DELETE FROM friend_invites WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)').bind(a, b, b, a)];

  switch (body.action) {
    case 'add': {
      const friend = await env.DB.prepare('SELECT id, xp FROM users WHERE friend_code = ? AND banned_at IS NULL').bind(normal(body.code)).first<{ id: string; xp: number }>();
      // A block is never revealed: to the blocked player it looks like a code that doesn't work.
      const blocked = friend && (await env.DB.prepare('SELECT 1 FROM blocks WHERE (user_id = ? AND blocked_id = ?) OR (user_id = ? AND blocked_id = ?)').bind(user.id, friend.id, friend.id, user.id).first());
      if (!friend || blocked) return bad('unknown_code', 404);
      if (friend.id === user.id) return bad('own_code');
      const counts = await Promise.all([user.id, friend.id].map((u) => env.DB.prepare('SELECT COUNT(*) AS n FROM friends WHERE user_id = ?').bind(u).first<{ n: number }>()));
      if (counts.some((c) => (c?.n ?? 0) >= MAX_FRIENDS)) return bad('too_many');
      await env.DB.batch([
        env.DB.prepare('INSERT OR IGNORE INTO friends (user_id, friend_id, created_at) VALUES (?, ?, ?)').bind(user.id, friend.id, now),
        env.DB.prepare('INSERT OR IGNORE INTO friends (user_id, friend_id, created_at) VALUES (?, ?, ?)').bind(friend.id, user.id, now),
      ]);
      await Promise.all([syncPins(env, user), syncPins(env, friend)]);
      break;
    }
    case 'remove':
      if (!id) return bad('bad_request');
      await env.DB.batch(unfriend(user.id, id));
      break;
    case 'block':
      if (!id || id === user.id) return bad('bad_request');
      await env.DB.batch([env.DB.prepare('INSERT OR IGNORE INTO blocks (user_id, blocked_id, created_at) VALUES (?, ?, ?)').bind(user.id, id, now), ...unfriend(user.id, id)]);
      break;
    case 'unblock':
      if (!id) return bad('bad_request');
      await env.DB.prepare('DELETE FROM blocks WHERE user_id = ? AND blocked_id = ?').bind(user.id, id).run();
      break;
    case 'new_code':
      await env.DB.prepare('UPDATE users SET friend_code = ? WHERE id = ?').bind(newCode(), user.id).run();
      break;
    case 'invite': {
      const game = typeof body.game === 'string' ? body.game : '';
      const code = typeof body.code === 'string' ? body.code.toUpperCase() : '';
      if (!INVITE_PATHS[game] || !/^[A-Z]{4,8}$/.test(code)) return bad('bad_request');
      const friends = await env.DB.prepare('SELECT 1 FROM friends WHERE user_id = ? AND friend_id = ?').bind(user.id, id).first();
      if (!friends) return bad('not_friends', 403);
      // One waiting invite per friend and game: asking again replaces it, so nobody can flood a friend.
      await env.DB.batch([
        env.DB.prepare('DELETE FROM friend_invites WHERE (from_id = ? AND to_id = ? AND game = ?) OR expires_at < ?').bind(user.id, id, game, now),
        env.DB.prepare('INSERT INTO friend_invites (from_id, to_id, game, code, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)').bind(user.id, id, game, code, now, now + INVITE_MS),
      ]);
      return json({ ok: true });
    }
    default:
      return bad('bad_request');
  }
  const fresh = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first<UserRow>();
  return json(await view(env, fresh ?? user));
}
