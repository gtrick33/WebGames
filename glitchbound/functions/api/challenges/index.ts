import { challengeRow, listFor, playerOf, viewOf } from '../../../server/challenges';
import { bad, json, readJson, sameOrigin, type Ctx } from '../../../server/http';
import { newCode } from '../../../server/shares';
import { getGame } from '../../../src/catalog/catalog';
import { cleanName, dailySeed } from '../../../src/platform/challenge';

/** POST /api/challenges { game, mode: 'daily' | 'fresh', day?, name, key? }: start a challenge (you are its first player). */
export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (!sameOrigin(request)) return bad('forbidden', 403);
  const body = await readJson(request, 2048);
  const game = typeof body?.game === 'string' ? getGame(body.game) : undefined;
  if (!game?.challenge) return bad('unknown_game', 404);
  const player = await playerOf(env, request, body);
  const name = cleanName(body?.name);
  if (!player || !name) return bad('name_required');
  const now = Date.now();
  const mine = await env.DB.prepare('SELECT COUNT(*) AS n FROM challenges WHERE host = ? AND created_at > ?').bind(player, now - 86400_000).first<{ n: number }>();
  if ((mine?.n ?? 0) >= 60) return bad('too_many', 429);
  const mode = body?.mode === 'daily' ? 'daily' : 'fresh';
  const day = typeof body?.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.day) ? body.day : new Date(now).toISOString().slice(0, 10);
  const seed = mode === 'daily' ? dailySeed(game.slug, day) : crypto.getRandomValues(new Uint32Array(1))[0]!;
  const id = newCode(7);
  await env.DB.batch([
    env.DB.prepare('INSERT INTO challenges (id, game, mode, day, seed, round, host, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)').bind(id, game.slug, mode, mode === 'daily' ? day : '', seed, player, now, now),
    env.DB.prepare('INSERT INTO challenge_players (challenge_id, player, name, joined_at) VALUES (?, ?, ?, ?)').bind(id, player, name, now),
    env.DB.prepare('DELETE FROM challenges WHERE updated_at < ?').bind(now - 60 * 86400_000),
  ]);
  const row = await challengeRow(env, id);
  return json(await viewOf(env, row!, player));
}

/** GET /api/challenges?key=…: the challenges this player is in. */
export async function onRequestGet({ request, env }: Ctx): Promise<Response> {
  const player = await playerOf(env, request, null);
  if (!player) return json({ challenges: [] });
  return json({ challenges: await listFor(env, player) });
}
