import { validateNickname } from '../../../../src/platform/progression';
import { normalizeEmail, startEmailLogin } from '../../../../server/emailLogin';
import { bad, json, readJson, sameOrigin, type Ctx } from '../../../../server/http';

/** POST /api/auth/email/start { email, nickname? }: emails a sign-in code + link. Works for new and existing players. */
export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (!sameOrigin(request)) return bad('bad_origin', 403);
  const body = await readJson(request);
  const email = normalizeEmail(body?.email);
  if (!email) return bad('bad_email', 400, { message: 'That email address does not look right.' });
  let nickname: string | null = null;
  if (typeof body?.nickname === 'string' && body.nickname.trim()) {
    const err = validateNickname(body.nickname);
    if (err) return bad('bad_nickname', 400, { message: err });
    nickname = body.nickname.trim();
  }
  let result;
  try {
    result = await startEmailLogin(env, request, email, nickname);
  } catch {
    return bad('send_failed', 502, { message: 'We could not send the email. Please try again in a minute.' });
  }
  if (result === 'disabled') return bad('email_not_configured', 503, { message: 'Email sign-in is not switched on yet. Use Google for now.' });
  if (result === 'rate_limited') return bad('slow_down', 429, { message: 'Too many codes requested. Try again in an hour.' });
  return json({ ok: true });
}
