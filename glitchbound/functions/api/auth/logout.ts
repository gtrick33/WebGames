import { bad, json, sameOrigin, type Ctx } from '../../../server/http';
import { clearCookie, destroySession } from '../../../server/session';

/** POST /api/auth/logout */
export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (!sameOrigin(request)) return bad('bad_origin', 403);
  await destroySession(env, request);
  return json({ ok: true }, 200, { 'set-cookie': clearCookie(request) });
}
