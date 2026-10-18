import { auditAction } from '../../../server/audit';
import { bad, json, readJson, sameOrigin, type Ctx } from '../../../server/http';
import { getPlayer, playerDetail, protectedFrom, REASON_MAX, setBan } from '../../../server/qa';
import { requireStaff } from '../../../server/session';

/**
 * POST /api/qa/ban { userId, banned, reason }: bans a player (signed out everywhere, can't sign in,
 * off the leaderboards) or lifts the ban. A reason is required to ban.
 */
export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (!sameOrigin(request)) return bad('bad_origin', 403);
  const staff = await requireStaff(env, request);
  if (staff instanceof Response) return staff;
  const body = await readJson(request);
  const target = await getPlayer(env, typeof body?.userId === 'string' ? body.userId : '');
  if (!target) return bad('not_found', 404, { message: 'No player with that id.' });
  const banned = body?.banned === true;
  const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, REASON_MAX) : '';
  if (target.id === staff.user.id) return bad('not_yourself', 400, { message: 'You can’t ban your own account.' });
  if (banned) {
    const refused = protectedFrom(env, staff.role, target);
    if (refused) {
      await auditAction(env, request, staff, { action: 'player.ban', target, detail: { reason, refused }, status: 403 });
      return bad('protected', 403, { message: refused });
    }
    if (!reason) return bad('reason_required', 400, { message: 'Write why this player is banned.' });
  }
  await setBan(env, target, banned, reason, staff.user.email);
  await auditAction(env, request, staff, { action: banned ? 'player.ban' : 'player.unban', target, detail: { reason, before: target.banned_at ? { at: target.banned_at, reason: target.ban_reason, by: target.banned_by } : null } });
  return json({ ok: true, player: await playerDetail(env, (await getPlayer(env, target.id))!) });
}
