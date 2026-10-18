import { verifyGoogleAccessToken, verifyGoogleIdToken } from '../../../server/google';
import { bad, json, readJson, sameOrigin, type Ctx } from '../../../server/http';
import { buildMe, clientDay } from '../../../server/members';
import { bannedResponse, signInUnlessBanned } from '../../../server/signin';
import { sendWelcome } from '../../../server/welcome';

/**
 * POST /api/auth/google { accessToken } (our styled button, Google token client)
 *                    or { credential }  (Google's ID-token button / One Tap)
 * Verifies the token with Google and starts a session.
 */
export async function onRequestPost({ request, env, waitUntil }: Ctx): Promise<Response> {
  if (!sameOrigin(request)) return bad('bad_origin', 403);
  if (!env.GOOGLE_CLIENT_ID) return bad('sign_in_not_configured', 503);
  const body = await readJson(request, 8192);
  const token = body?.accessToken ?? body?.credential;
  if (typeof token !== 'string' || token.length > 4096) return bad('bad_request');
  let identity;
  try {
    identity = body?.accessToken ? await verifyGoogleAccessToken(token, env.GOOGLE_CLIENT_ID) : await verifyGoogleIdToken(token, env.GOOGLE_CLIENT_ID);
  } catch (err) {
    return bad('invalid_credential', 401, { reason: err instanceof Error ? err.message : 'unknown' });
  }
  const signed = await signInUnlessBanned(env, request, { ...identity, provider: 'google' });
  if (!signed) return bannedResponse();
  const { user, cookie, created } = signed;
  if (created) waitUntil?.(sendWelcome(env, request, user, clientDay(body?.day)));
  return json({ user: await buildMe(env, user, clientDay(body?.day)), created }, 200, { 'set-cookie': cookie });
}
