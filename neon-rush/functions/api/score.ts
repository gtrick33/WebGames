import { UUID_RE, checkClaim, normalizeName, utcDay, validateName } from '../../src/backend/leaderboard-rules';
import { json, readJson, type Ctx } from '../types';

const int = (v: unknown): number => (typeof v === 'number' ? v : Number.NaN);

/** POST /api/score: submit a finished run. The server re-checks everything. */
export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  const body = await readJson(request);
  if (!body) return json({ error: 'bad_request' }, 400);
  const { runId, playerId, name } = body;
  if (typeof runId !== 'string' || !UUID_RE.test(runId) || typeof playerId !== 'string' || !UUID_RE.test(playerId)) {
    return json({ error: 'bad_ids' }, 400);
  }
  const nameError = validateName(name);
  if (nameError) return json({ error: 'bad_name', message: nameError }, 400);
  const cleanName = normalizeName(name as string);
  const skin = typeof body.skin === 'string' ? body.skin.slice(0, 32).replace(/[^a-z0-9_]/g, '') : '';

  const run = await env.DB.prepare('SELECT player_id, started_at, submitted FROM runs WHERE id = ?')
    .bind(runId)
    .first<{ player_id: string; started_at: number; submitted: number }>();
  if (!run || run.player_id !== playerId) return json({ error: 'unknown_run' }, 404);
  if (run.submitted) return json({ error: 'already_submitted' }, 409);

  const now = Date.now();
  const claim = {
    score: int(body.score),
    meters: int(body.meters),
    coins: int(body.coins),
    nearMisses: int(body.nearMisses),
    durationMs: int(body.durationMs),
  };
  const reason = checkClaim(claim, now - run.started_at);
  if (reason) {
    await env.DB.prepare('UPDATE runs SET submitted = 1 WHERE id = ?').bind(runId).run();
    return json({ error: 'rejected', reason }, 422);
  }

  const day = `d:${utcDay(now)}`;
  const upsert = `INSERT INTO scores (player_id, period, name, score, meters, skin, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (player_id, period) DO UPDATE SET
      name = excluded.name,
      score = MAX(scores.score, excluded.score),
      meters = CASE WHEN excluded.score > scores.score THEN excluded.meters ELSE scores.meters END,
      skin = CASE WHEN excluded.score > scores.score THEN excluded.skin ELSE scores.skin END,
      updated_at = excluded.updated_at`;
  await env.DB.batch([
    env.DB.prepare('UPDATE runs SET submitted = 1 WHERE id = ?').bind(runId),
    env.DB.prepare(upsert).bind(playerId, 'all', cleanName, claim.score, claim.meters, skin, now),
    env.DB.prepare(upsert).bind(playerId, day, cleanName, claim.score, claim.meters, skin, now),
  ]);

  const rank = async (period: string) => {
    const best = await env.DB.prepare('SELECT score FROM scores WHERE player_id = ? AND period = ?').bind(playerId, period).first<{ score: number }>();
    if (!best) return null;
    const ahead = await env.DB.prepare('SELECT COUNT(*) AS n FROM scores WHERE period = ? AND score > ?').bind(period, best.score).first<{ n: number }>();
    return { rank: (ahead?.n ?? 0) + 1, best: best.score };
  };
  return json({ ok: true, daily: await rank(day), allTime: await rank('all') });
}
