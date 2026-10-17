import { normalizeEmail, verifyEmailCode } from '../../../../server/emailLogin';
import { bad, json, readJson, sameOrigin, type Ctx } from '../../../../server/http';
import { buildMe, clientDay } from '../../../../server/members';
import { signIn } from '../../../../server/signin';

const MESSAGES: Record<string, string> = {
  invalid: 'That code is not right. Check the latest email.',
  expired: 'That code has expired. Ask for a new one.',
  locked: 'Too many wrong tries. Ask for a new code.',
};

/** POST /api/auth/email/verify { email, code }: signs in (or signs up) with the emailed code. */
export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (!sameOrigin(request)) return bad('bad_origin', 403);
  const body = await readJson(request);
  const email = normalizeEmail(body?.email);
  const code = typeof body?.code === 'string' ? body.code.replace(/\D/g, '') : '';
  if (!email || code.length !== 6) return bad('bad_request', 400, { message: 'Enter the 6-digit code from the email.' });
  const result = await verifyEmailCode(env, email, code);
  if (typeof result === 'string') return bad(result, 401, { message: MESSAGES[result] });
  const { user, cookie, created } = await signIn(env, request, result);
  return json({ user: await buildMe(env, user, clientDay(body?.day)), created }, 200, { 'set-cookie': cookie });
}
