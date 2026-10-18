import { auditAction } from '../../../../server/audit';
import { bad, json, type Ctx } from '../../../../server/http';
import { getPlayer, playerDetail } from '../../../../server/qa';
import { requireStaff } from '../../../../server/session';

/** GET /api/qa/players/:id: one player's account, bests, recent rounds, coin grants and emails. */
export async function onRequestGet({ request, env, params }: Ctx): Promise<Response> {
  const staff = await requireStaff(env, request);
  if (staff instanceof Response) return staff;
  const id = typeof params?.id === 'string' ? params.id : '';
  const target = await getPlayer(env, id);
  if (!target) return bad('not_found', 404, { message: 'No player with that id.' });
  await auditAction(env, request, staff, { action: 'player.view', target });
  return json({ player: await playerDetail(env, target) });
}
