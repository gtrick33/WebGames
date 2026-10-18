import { getGame } from '../../../src/catalog/catalog';
import { auditAction } from '../../../server/audit';
import { bad, json, readJson, sameOrigin, type Ctx } from '../../../server/http';
import { buildMe, clientDay } from '../../../server/members';
import { resetOwnProgress } from '../../../server/qa';
import { currentUser, requireStaff } from '../../../server/session';

/**
 * POST /api/qa/reset { scope: 'game' | 'today' | 'all', game?, day? }: wipes the tester's OWN account
 * progress (a game's bests and rounds, today's daily and quests, or everything and XP) to test again.
 */
export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (!sameOrigin(request)) return bad('bad_origin', 403);
  const staff = await requireStaff(env, request);
  if (staff instanceof Response) return staff;
  const body = await readJson(request);
  const scope = body?.scope === 'game' || body?.scope === 'today' || body?.scope === 'all' ? body.scope : null;
  const game = typeof body?.game === 'string' ? getGame(body.game) : undefined;
  if (!scope || (scope === 'game' && !game)) return bad('bad_request', 400, { message: 'Pick what to reset.' });
  const day = clientDay(body?.day);
  await resetOwnProgress(env, staff.user, scope, game?.slug ?? null, day);
  await auditAction(env, request, staff, { action: 'tool.reset_progress', detail: { scope, game: game?.slug, day } });
  return json({ ok: true, user: await buildMe(env, (await currentUser(env, request, true))!, day) });
}
