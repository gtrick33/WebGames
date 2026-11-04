import { productIn } from '../../../src/catalog/shop';
import { loadCatalog } from '../../../server/catalogSettings';
import { bad, json, readJson, sameOrigin, type Ctx } from '../../../server/http';
import { requireUser } from '../../../server/session';
import { canSell, loadItems, ownedBy, startCheckout } from '../../../server/shop';

/** POST /api/shop/checkout { product, agreeNow: true, agreeAge: true }: where to pay. Off until the shop is opened. */
export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (!sameOrigin(request)) return bad('bad_origin', 403);
  const user = await requireUser(env, request);
  if (user instanceof Response) return user;
  const day = new Date().toISOString().slice(0, 10);
  const cat = await loadCatalog(env, day, day);
  if (!cat.money?.shop) return bad('shop_closed', 404);
  const body = await readJson(request);
  const p = typeof body?.product === 'string' ? productIn(await loadItems(env), body.product) : undefined;
  if (!canSell(env, p)) return bad('not_for_sale', 404);
  // the two statements the law asks for: without them, no checkout
  if (body?.agreeNow !== true || body?.agreeAge !== true) return bad('must_agree');
  if ((await ownedBy(env, user.id)).includes(p.id)) return bad('already_yours', 409);
  const url = await startCheckout(env, user, p, new URL(request.url).origin);
  return url ? json({ url }) : bad('checkout_failed', 502);
}
