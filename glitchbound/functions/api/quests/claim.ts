import { levelForXp } from '../../../src/platform/progression';
import { bad, json, readJson, sameOrigin, type Ctx } from '../../../server/http';
import { buildMe, clientDay, questViews } from '../../../server/members';
import { currentUser, requireUser } from '../../../server/session';

/** POST /api/quests/claim { questId, day }: collect XP for a finished quest (once). */
export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (!sameOrigin(request)) return bad('bad_origin', 403);
  const user = await requireUser(env, request);
  if (user instanceof Response) return user;
  const body = await readJson(request);
  const day = clientDay(body?.day);
  const quest = (await questViews(env, user, day)).find((q) => q.id === body?.questId);
  if (!quest) return bad('unknown_quest', 404);
  if (!quest.done) return bad('not_done', 409);
  if (quest.claimed) return bad('already_claimed', 409);
  const before = levelForXp(user.xp);
  try {
    await env.DB.batch([
    env.DB.prepare('INSERT INTO quest_claims (user_id, day, quest_id, xp, at) VALUES (?, ?, ?, ?, ?)').bind(user.id, day, quest.id, quest.xp, Date.now()),
    env.DB.prepare('UPDATE users SET xp = xp + ? WHERE id = ?').bind(quest.xp, user.id),
    ]);
  } catch {
    return bad('already_claimed', 409); // a double click raced us; the batch is atomic
  }
  const fresh = (await currentUser(env, request))!;
  return json({ xp: quest.xp, levelUp: levelForXp(fresh.xp) > before, user: await buildMe(env, fresh, day) });
}
