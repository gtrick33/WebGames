import { verifyGoogleIdToken } from '../../../server/google';
import { bad, json, readJson, sameOrigin, type Ctx } from '../../../server/http';
import { clientDay, buildMe } from '../../../server/members';
import { signIn } from '../../../server/signin';

/** POST /api/auth/google { credential, day }: verify the Google ID token and start a session. */
export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (!sameOrigin(request)) return bad('bad_origin', 403);
  if (!env.GOOGLE_CLIENT_ID) return bad('sign_in_not_configured', 503);
  const body = await readJson(request, 8192);
  const credential = body?.credential;
  if (typeof credential !== 'string' || credential.length > 4096) return bad('bad_request');
  let identity;
  try {
    identity = await verifyGoogleIdToken(credential, env.GOOGLE_CLIENT_ID);
  } catch (err) {
    return bad('invalid_credential', 401, { reason: err instanceof Error ? err.message : 'unknown' });
  }
  const { user, cookie } = await signIn(env, request, identity);
  return json({ user: await buildMe(env, user, clientDay(body?.day)) }, 200, { 'set-cookie': cookie });
}
