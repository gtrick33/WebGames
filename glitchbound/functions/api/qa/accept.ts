import { audit } from '../../../server/audit';
import { bad, json, readJson, sameOrigin, type Ctx } from '../../../server/http';
import { buildMe, clientDay } from '../../../server/members';
import { acceptInvite, findInvite, maskEmail } from '../../../server/staff';
import { currentUser, isAdmin, requireUser } from '../../../server/session';

/** POST /api/qa/accept { token }: joins the QA team. The signed-in account must use the invited address. */
export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (!sameOrigin(request)) return bad('bad_origin', 403);
  const user = await requireUser(env, request);
  if (user instanceof Response) return user;
  const body = await readJson(request);
  const token = typeof body?.token === 'string' ? body.token : '';
  if (isAdmin(env, user)) return bad('already_admin', 409, { message: 'You’re an admin: you already have every QA tool.' });
  const invite = await findInvite(env, token);
  const result = await acceptInvite(env, token, user);
  if (result === 'invalid') return bad('invalid_invite', 404, { message: 'This invitation has expired or was already used. Ask an admin for a new one.' });
  if (result === 'wrong_account') return bad('wrong_account', 403, { message: `This invitation is for ${maskEmail(invite!.email)}. Sign out and sign in with that address.` });
  if (result === 'taken') return bad('taken', 409, { message: 'This account is already on the QA team with another address.' });
  await audit(env, request, user, { kind: 'auth', action: 'qa.joined', detail: { invitedBy: invite!.invited_by } });
  return json({ ok: true, user: await buildMe(env, (await currentUser(env, request, true))!, clientDay(body?.day)) });
}
