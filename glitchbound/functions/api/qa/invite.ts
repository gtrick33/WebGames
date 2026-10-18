import { json, type Ctx } from '../../../server/http';
import { findInvite, maskEmail } from '../../../server/staff';

/** GET /api/qa/invite?token=…: whether an invitation link still works, and which (masked) address it is for. */
export async function onRequestGet({ request, env }: Ctx): Promise<Response> {
  const invite = await findInvite(env, new URL(request.url).searchParams.get('token') ?? '');
  return json(invite ? { valid: true, email: maskEmail(invite.email), expires: invite.invite_expires } : { valid: false });
}
