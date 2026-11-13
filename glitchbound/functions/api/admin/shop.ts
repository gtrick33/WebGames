import { logAdmin } from '../../../server/catalogSettings';
import { bad, json, readJson, sameOrigin, type Ctx } from '../../../server/http';
import { requireAdmin } from '../../../server/session';
import { giftItem, loadItems, shopReport, takeBack } from '../../../server/shop';
import { productIn } from '../../../src/catalog/shop';

/**
 * GET /api/admin/shop?q=&offset=&limit=: sales by item, and one page of the purchases (newest first, 10 by default, at
 * most 100) found by the player's nickname or email, the item's name or id, or the purchase's id; with how many match.
 *   → { items, recent, total, offset, limit }
 */
export async function onRequestGet({ request, env }: Ctx): Promise<Response> {
  const admin = await requireAdmin(env, request);
  if (admin instanceof Response) return admin;
  const url = new URL(request.url);
  const num = (key: string): number | undefined => (url.searchParams.has(key) ? Number(url.searchParams.get(key)) : undefined);
  return json(await shopReport(env, { q: url.searchParams.get('q') ?? '', offset: num('offset'), limit: num('limit') }));
}

/**
 * POST /api/admin/shop:
 *   { action: 'gift', userId, product }     give an item to a member, for support or a prize (picked in the player picker)
 *   { action: 'gift', nickname, product }   the same, by nickname (what this took before the picker)
 *   { action: 'takeBack', id }              take a purchase back (refund the money in Stripe)
 */
export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (!sameOrigin(request)) return bad('forbidden', 403);
  const admin = await requireAdmin(env, request);
  if (admin instanceof Response) return admin;
  const body = await readJson(request);
  const by = admin.nickname || admin.email;
  if (body?.action === 'gift') {
    const product = typeof body.product === 'string' ? productIn(await loadItems(env), body.product) : undefined;
    if (!product) return bad('unknown_item', 404);
    const id = typeof body.userId === 'string' ? body.userId.trim().slice(0, 64) : '';
    const nick = typeof body.nickname === 'string' ? body.nickname.trim() : '';
    const user = id
      ? await env.DB.prepare('SELECT id, nickname FROM users WHERE id = ?').bind(id).first<{ id: string; nickname: string }>()
      : nick
        ? await env.DB.prepare('SELECT id, nickname FROM users WHERE nickname = ? COLLATE NOCASE').bind(nick).first<{ id: string; nickname: string }>()
        : null;
    if (!user) return bad('unknown_player', 404, { message: id ? 'That player’s account is gone.' : 'No player with that nickname.' });
    await giftItem(env, user.id, product.id);
    await logAdmin(env, by, 'shop', `Gave ${product.name} to ${user.nickname}`);
    return json({ ok: true, nickname: user.nickname });
  }
  if (body?.action === 'takeBack') {
    if (typeof body.id !== 'string' || !(await takeBack(env, body.id))) return bad('unknown_purchase', 404);
    await logAdmin(env, by, 'shop', `Took back a purchase (${body.id.slice(0, 8)})`);
    return json({ ok: true });
  }
  return bad('bad_request');
}
