import { bad, json, readJson, sameOrigin, type Ctx } from '../../server/http';
import { countToday, parseFeedback } from '../../server/reports';
import { currentUser } from '../../server/session';
import { browserFamily, visitorKey } from '../../server/visitor';

/** POST /api/feedback { stars 1-5, message?, game?, wish? }: the "rate GlitchBound" card. Guests welcome. */
export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (!sameOrigin(request)) return bad('forbidden', 403);
  const input = parseFeedback(await readJson(request, 4096));
  if (!input) return bad('invalid');
  const now = Date.now();
  const [visitor, user] = await Promise.all([visitorKey(request, now), currentUser(env, request)]);
  if ((await countToday(env, 'feedback', visitor, user?.id ?? null, now)) >= 5) return bad('too_many', 429);
  await env.DB.prepare('INSERT INTO feedback (ts, stars, message, game, wish, visitor, user_id, browser) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(now, input.stars, input.message, input.game, input.wish, visitor, user?.id ?? null, browserFamily(request.headers.get('user-agent') ?? ''))
    .run();
  return json({ ok: true });
}
