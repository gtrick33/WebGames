import { bad, json, readJson, sameOrigin, type Ctx } from '../../../server/http';
import { requireUser } from '../../../server/session';
import { closeOrders, waitingOrders } from '../../../server/sigilfallGm';

/** GET /api/sigilfall/orders: what a game master has asked this player's game to do, oldest first. */
export async function onRequestGet({ request, env }: Ctx): Promise<Response> {
  const user = await requireUser(env, request);
  if (user instanceof Response) return user;
  return json({ orders: await waitingOrders(env, user.id) });
}

/** POST /api/sigilfall/orders { done: [{ id, result }] }: how they went ('' for done, otherwise why not). Only the player's own orders. */
export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (!sameOrigin(request)) return bad('bad_origin', 403);
  const user = await requireUser(env, request);
  if (user instanceof Response) return user;
  const body = await readJson(request);
  const raw = Array.isArray(body?.done) ? (body.done as unknown[]).slice(0, 25) : [];
  const done = raw.flatMap((d) => {
    const o = d as { id?: unknown; result?: unknown } | null;
    return o && typeof o.id === 'string' && o.id.length <= 64 ? [{ id: o.id, result: typeof o.result === 'string' ? o.result : '' }] : [];
  });
  await closeOrders(env, user.id, done);
  return json({ ok: true });
}
