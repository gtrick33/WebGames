import { json, type Ctx } from '../../../server/http';
import { findMembers } from '../../../server/members';
import { requireAdmin } from '../../../server/session';

/**
 * GET /api/admin/members?q=&limit=: up to 20 members whose nickname or email has `q` in it (or whose id it is), for the
 * admin's player picker; with no `q`, the members seen last. Admins only.
 *   → { members: [{ id, nickname, email, lastSeen }] }
 */
export async function onRequestGet({ request, env }: Ctx): Promise<Response> {
  const admin = await requireAdmin(env, request);
  if (admin instanceof Response) return admin;
  const url = new URL(request.url);
  return json({ members: await findMembers(env, url.searchParams.get('q') ?? '', Number(url.searchParams.get('limit')) || undefined) });
}
