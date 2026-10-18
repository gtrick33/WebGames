import { verifyEmailLink } from '../../../../server/emailLogin';
import type { Ctx } from '../../../../server/http';
import { signInUnlessBanned } from '../../../../server/signin';
import { sendWelcome } from '../../../../server/welcome';
import { utcDay } from '../../../../server/http';

/** GET /api/auth/email/link?token=…: the button in the sign-in email. */
export async function onRequestGet({ request, env, waitUntil }: Ctx): Promise<Response> {
  const token = new URL(request.url).searchParams.get('token') ?? '';
  const identity = await verifyEmailLink(env, token);
  if (!identity) return Response.redirect(new URL('/signin?error=link', request.url).toString(), 303);
  const signed = await signInUnlessBanned(env, request, identity);
  if (!signed) return Response.redirect(new URL('/signin?error=banned', request.url).toString(), 303);
  const { user, cookie, created } = signed;
  if (created) waitUntil?.(sendWelcome(env, request, user, utcDay()));
  return new Response(null, { status: 303, headers: { location: created ? '/me?welcome=1' : '/me', 'set-cookie': cookie } });
}
