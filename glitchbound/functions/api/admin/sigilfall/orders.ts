import { logAdmin } from '../../../../server/catalogSettings';
import { bad, json, readJson, sameOrigin, type Ctx } from '../../../../server/http';
import { requireAdmin } from '../../../../server/session';
import { cancelOrder, checkOrder, fileOrder, restoreHero } from '../../../../server/sigilfallGm';

const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/**
 * POST /api/admin/sigilfall/orders: a game master's work on a player, admins only, each written to the change log.
 *   { action: 'file', userId, slot, created, heroName, kind, payload, label, note }  asks the player's game to do something
 *   { action: 'cancel', userId, id }                                                 calls an order back while it waits
 *   { action: 'restore', userId, graveId, note }                                     brings a deleted hero back
 */
export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (!sameOrigin(request)) return bad('bad_origin', 403);
  const admin = await requireAdmin(env, request);
  if (admin instanceof Response) return admin;
  const body = await readJson(request);
  const userId = text(body?.userId, 64);
  const player = userId ? await env.DB.prepare('SELECT id, nickname FROM users WHERE id = ?').bind(userId).first<{ id: string; nickname: string }>() : null;
  if (!player) return bad('not_found', 404, { message: 'No player with that id.' });
  const by = admin.email || admin.nickname;
  const note = text(body?.note, 300);
  switch (body?.action) {
    case 'file': {
      const kind = text(body.kind, 20);
      const order = checkOrder(kind, body.payload, text(body.label, 80));
      if (typeof order === 'string') return bad('bad_order', 400, { message: order });
      const slot = order.forPlayer ? -1 : Number(body.slot);
      const created = order.forPlayer ? 0 : Number(body.created);
      if (!order.forPlayer && (![0, 1, 2].includes(slot) || !Number.isFinite(created) || created <= 0)) return bad('bad_order', 400, { message: 'Pick a hero.' });
      const heroName = order.forPlayer ? '' : text(body.heroName, 20);
      const id = await fileOrder(env, { userId, slot, created, heroName }, order, note, by);
      await logAdmin(env, by, 'sigilfall', `Sigilfall, ${player.nickname}${heroName ? ` (${heroName})` : ''}: ${order.summary}${note ? `. Why: ${note}` : ''}`.slice(0, 1000));
      return json({ ok: true, id });
    }
    case 'cancel': {
      const id = text(body.id, 64);
      if (!(await cancelOrder(env, id))) return bad('too_late', 409, { message: 'It has already been carried out.' });
      await logAdmin(env, by, 'sigilfall', `Sigilfall, ${player.nickname}: called an order back`);
      return json({ ok: true });
    }
    case 'restore': {
      const id = await restoreHero(env, userId, text(body.graveId, 64), note, by);
      if (!id) return bad('not_found', 404, { message: 'That hero has already been brought back or is gone.' });
      await logAdmin(env, by, 'sigilfall', `Sigilfall, ${player.nickname}: brought a deleted hero back${note ? `. Why: ${note}` : ''}`.slice(0, 1000));
      return json({ ok: true, id });
    }
    default:
      return bad('unknown_action');
  }
}
