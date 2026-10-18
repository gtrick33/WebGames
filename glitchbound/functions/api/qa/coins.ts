import { auditAction } from '../../../server/audit';
import { bad, json, readJson, sameOrigin, type Ctx } from '../../../server/http';
import { checkGrant, getPlayer, grantCoins, playerDetail } from '../../../server/qa';
import { requireStaff } from '../../../server/session';

/** POST /api/qa/coins { userId, game, amount, note }: coins for one game's wallet, collected when the player next opens it. */
export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (!sameOrigin(request)) return bad('bad_origin', 403);
  const staff = await requireStaff(env, request);
  if (staff instanceof Response) return staff;
  const body = await readJson(request);
  const target = await getPlayer(env, typeof body?.userId === 'string' ? body.userId : '');
  if (!target) return bad('not_found', 404, { message: 'No player with that id.' });
  const grant = checkGrant(body);
  if (typeof grant === 'string') return bad('bad_grant', 400, { message: grant });
  const id = await grantCoins(env, target, grant, staff.user.email);
  await auditAction(env, request, staff, { action: 'coins.grant', target, detail: { grantId: id, ...grant } });
  return json({ ok: true, player: await playerDetail(env, target) });
}
