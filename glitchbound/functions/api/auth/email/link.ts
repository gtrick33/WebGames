import { verifyEmailLink } from '../../../../server/emailLogin';
import type { Ctx } from '../../../../server/http';
import { signIn } from '../../../../server/signin';

/** GET /api/auth/email/link?token=…: the button in the sign-in email. */
export async function onRequestGet({ request, env }: Ctx): Promise<Response> {
  const token = new URL(request.url).searchParams.get('token') ?? '';
  const identity = await verifyEmailLink(env, token);
  if (!identity) return Response.redirect(new URL('/signin?error=link', request.url).toString(), 303);
  const { cookie, created } = await signIn(env, request, identity);
  return new Response(null, { status: 303, headers: { location: created ? '/me?welcome=1' : '/me', 'set-cookie': cookie } });
}
