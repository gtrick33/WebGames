import { UUID_RE } from '../../src/backend/leaderboard-rules';
import { json, readJson, type Ctx } from '../types';

/** POST /api/run: issue a server-timestamped run token. Required to submit a score. */
export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  const body = await readJson(request);
  const playerId = body?.playerId;
  if (typeof playerId !== 'string' || !UUID_RE.test(playerId)) return json({ error: 'bad_player' }, 400);
  const now = Date.now();
  // Light rate limit: one run start per player every 2 seconds.
  const last = await env.DB.prepare('SELECT started_at FROM runs WHERE player_id = ? ORDER BY started_at DESC LIMIT 1')
    .bind(playerId)
    .first<{ started_at: number }>();
  if (last && now - last.started_at < 2000) return json({ error: 'rate_limited' }, 429);
  const runId = crypto.randomUUID();
  const stmts = [env.DB.prepare('INSERT INTO runs (id, player_id, started_at) VALUES (?, ?, ?)').bind(runId, playerId, now)];
  // Occasionally clean up stale run tokens.
  if (Math.random() < 0.02) stmts.push(env.DB.prepare('DELETE FROM runs WHERE started_at < ?').bind(now - 86_400_000));
  await env.DB.batch(stmts);
  return json({ runId, serverTime: now });
}
