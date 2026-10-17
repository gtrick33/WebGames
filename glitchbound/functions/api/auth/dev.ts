import { bad, isLocal, json, readJson, type Ctx } from '../../../server/http';
import { buildMe, clientDay } from '../../../server/members';
import { signIn } from '../../../server/signin';

/**
 * POST /api/auth/dev { email, name }: LOCAL TESTING ONLY. Works only when DEV_LOGIN=1 is set in
 * .dev.vars (never in production) and the request is to localhost.
 */
export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (env.DEV_LOGIN !== '1' || !isLocal(request)) return bad('not_found', 404);
  const body = await readJson(request);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return bad('bad_email');
  const name = typeof body?.name === 'string' ? body.name.slice(0, 40) : 'Tester';
  const { user, cookie } = await signIn(env, request, { sub: `dev:${email}`, email, name, givenName: name, picture: '', provider: 'google' });
  return json({ user: await buildMe(env, user, clientDay(body?.day)) }, 200, { 'set-cookie': cookie });
}
