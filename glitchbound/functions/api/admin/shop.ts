import { logAdmin } from '../../../server/catalogSettings';
import { bad, json, readJson, sameOrigin, type Ctx } from '../../../server/http';
import { requireAdmin } from '../../../server/session';
import { giftItem, loadItems, shopReport, takeBack } from '../../../server/shop';
import { productIn } from '../../../src/catalog/shop';

/** GET /api/admin/shop: sales by item and the latest purchases. */
export async function onRequestGet({ request, env }: Ctx): Promise<Response> {
  const admin = await requireAdmin(env, request);
  if (admin instanceof Response) return admin;
  return json(await shopReport(env));
}

/**
 * POST /api/admin/shop:
 *   { action: 'gift', nickname, product }   give an item to a member, for support or a prize
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
    const nick = typeof body.nickname === 'string' ? body.nickname.trim() : '';
    const user = nick ? await env.DB.prepare('SELECT id, nickname FROM users WHERE nickname = ? COLLATE NOCASE').bind(nick).first<{ id: string; nickname: string }>() : null;
    if (!user) return bad('unknown_player', 404);
    await giftItem(env, user.id, product.id);
    await logAdmin(env, by, 'shop', `Gave ${product.name} to ${user.nickname}`);
    return json({ ok: true });
  }
  if (body?.action === 'takeBack') {
    if (typeof body.id !== 'string' || !(await takeBack(env, body.id))) return bad('unknown_purchase', 404);
    await logAdmin(env, by, 'shop', `Took back a purchase (${body.id.slice(0, 8)})`);
    return json({ ok: true });
  }
  return bad('bad_request');
}
