import { pinPoints, shelfRank } from '../../src/catalog/pins';
import type { PinsView } from '../../src/platform/apiTypes';
import { levelForXp } from '../../src/platform/progression';
import { json, bad, type Ctx } from '../../server/http';
import { heldPins, pinRarity, syncPins } from '../../server/pins';
import { currentUser } from '../../server/session';

/**
 * GET /api/pins: the Trophy Shelf. A guest gets the rarity alone (the page shows every pin as still to earn);
 * a member's pins are brought up to date first. ?friend=<id> shows a friend's shelf, to friends only.
 */
export async function onRequestGet({ request, env }: Ctx): Promise<Response> {
  const me = await currentUser(env, request);
  const friendId = new URL(request.url).searchParams.get('friend');
  const rarity = await pinRarity(env);
  if (friendId) {
    if (!me) return bad('sign_in', 401);
    const friend = await env.DB.prepare('SELECT u.id, u.nickname, u.xp FROM friends f JOIN users u ON u.id = f.friend_id WHERE f.user_id = ? AND f.friend_id = ?').bind(me.id, friendId).first<{ id: string; nickname: string; xp: number }>();
    if (!friend) return bad('not_friends', 403);
    const pins = await heldPins(env, friend.id);
    const points = pinPoints(pins.map((p) => p.id));
    const view: PinsView = { pins, points, rank: shelfRank(points).title, rarity, owner: { nickname: friend.nickname, level: levelForXp(friend.xp) } };
    return json(view);
  }
  if (!me) {
    const view: PinsView = { pins: [], points: 0, rank: shelfRank(0).title, rarity, owner: null };
    return json(view);
  }
  await syncPins(env, me);
  const pins = await heldPins(env, me.id);
  const points = pinPoints(pins.map((p) => p.id));
  const view: PinsView = { pins, points, rank: shelfRank(points).title, rarity, owner: null };
  return json(view);
}
