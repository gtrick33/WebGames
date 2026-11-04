import { bad, json, type Ctx } from '../../../../../server/http';
import { requireAdmin } from '../../../../../server/session';
import { playerDetail } from '../../../../../server/sigilfallGm';

/** GET /api/admin/sigilfall/players/:id: everything the server holds of one player's Sigilfall. Admins only. */
export async function onRequestGet({ request, env, params }: Ctx): Promise<Response> {
  const admin = await requireAdmin(env, request);
  if (admin instanceof Response) return admin;
  const id = typeof params?.id === 'string' ? params.id : '';
  const player = id && id.length <= 64 ? await playerDetail(env, id) : null;
  if (!player) return bad('not_found', 404, { message: 'No player with that id.' });
  return json({ player });
}
