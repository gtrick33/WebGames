import { json, type Ctx } from '../../../../server/http';
import { requireAdmin } from '../../../../server/session';
import { listPlayers, overview } from '../../../../server/sigilfallGm';

/** GET /api/admin/sigilfall/players?q=&sort=&offset=: the numbers, and one page of the players who have a hero saved. Admins only. */
export async function onRequestGet({ request, env }: Ctx): Promise<Response> {
  const admin = await requireAdmin(env, request);
  if (admin instanceof Response) return admin;
  const url = new URL(request.url);
  const [list, numbers] = await Promise.all([
    listPlayers(env, url.searchParams.get('q') ?? '', url.searchParams.get('sort') ?? 'recent', Number(url.searchParams.get('offset')) || 0),
    overview(env),
  ]);
  return json({ overview: numbers, ...list });
}
