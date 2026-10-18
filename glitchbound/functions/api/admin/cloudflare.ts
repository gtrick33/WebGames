import { cloudUsage } from '../../../server/cloudflare';
import { json, type Ctx } from '../../../server/http';
import { requireAdmin } from '../../../server/session';

/** GET /api/admin/cloudflare: database sizes, row counts and daily usage against the free-plan limits. */
export async function onRequestGet({ request, env }: Ctx): Promise<Response> {
  const admin = await requireAdmin(env, request);
  if (admin instanceof Response) return admin;
  return json(await cloudUsage(env));
}
