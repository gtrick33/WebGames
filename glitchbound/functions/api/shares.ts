import { bad, json, readJson, sameOrigin, type Ctx } from '../../server/http';
import { newCode, sharePath, shareText } from '../../server/shares';
import { visitorKey } from '../../server/visitor';

/** POST /api/shares { path, title, description }: a short link whose chat preview shows the result. */
export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (!sameOrigin(request)) return bad('forbidden', 403);
  const body = await readJson(request, 2048);
  const path = sharePath(body?.path);
  const text = shareText(body?.title, body?.description);
  if (!path || !text) return bad('invalid');
  const now = Date.now();
  const visitor = await visitorKey(request, now);
  const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM shares WHERE visitor = ? AND created_at > ?').bind(visitor, now - 86400_000).first<{ n: number }>();
  if ((recent?.n ?? 0) >= 300) return bad('too_many', 429);
  const code = newCode();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO shares (code, path, title, description, visitor, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(code, path, text.title, text.description, visitor, now),
    env.DB.prepare('DELETE FROM shares WHERE created_at < ?').bind(now - 180 * 86400_000),
  ]);
  return json({ code });
}
