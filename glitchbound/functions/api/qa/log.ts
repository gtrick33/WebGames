import { auditAction } from '../../../server/audit';
import { bad, json, readJson, sameOrigin, type Ctx } from '../../../server/http';
import { requireStaff } from '../../../server/session';

/**
 * POST /api/qa/log { action, detail }: QA tools that only work in the browser (clearing this device's
 * saves, opening a hidden game...) report themselves here, so the audit trail has them too.
 */
export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (!sameOrigin(request)) return bad('bad_origin', 403);
  const staff = await requireStaff(env, request);
  if (staff instanceof Response) return staff;
  const body = await readJson(request);
  const action = typeof body?.action === 'string' && /^[a-z][a-z0-9_.-]{1,60}$/.test(body.action) ? body.action : '';
  if (!action) return bad('bad_request');
  await auditAction(env, request, staff, { action: `tool.${action}`, detail: body?.detail ?? null });
  return json({ ok: true });
}
