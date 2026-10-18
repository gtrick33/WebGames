import { auditAction } from '../../../server/audit';
import { json, type Ctx } from '../../../server/http';
import { searchPlayers } from '../../../server/qa';
import { requireStaff } from '../../../server/session';

/** GET /api/qa/players?q=email|nickname|id: players for the QA tab (the most recently seen when q is empty). */
export async function onRequestGet({ request, env }: Ctx): Promise<Response> {
  const staff = await requireStaff(env, request);
  if (staff instanceof Response) return staff;
  const q = new URL(request.url).searchParams.get('q') ?? '';
  const players = await searchPlayers(env, q);
  await auditAction(env, request, staff, { action: 'player.search', detail: { q, results: players.map((p) => p.id) } });
  return json({ players });
}
