import { playerOf, SEAT_ERRORS } from '../../../server/challenges';
import { callGames, challengeForCall, discordReady, isActivityGame, roomForCall, sweepInstances, validInstance } from '../../../server/discord';
import { bad, json, readJson, sameOrigin, type Ctx } from '../../../server/http';
import { cleanName } from '../../../src/platform/challenge';

/**
 * POST /api/discord/play { instanceId, game, name, key }: the challenge (Wait, What?) or room
 * (Crass Act) that everyone in this Discord call shares; started by the first player who picks it.
 */
export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (!sameOrigin(request)) return bad('forbidden', 403);
  if (!discordReady(env)) return bad('discord_not_configured', 503);
  const body = await readJson(request, 1024);
  const instance = body?.instanceId;
  if (!validInstance(instance) || !isActivityGame(body?.game)) return bad('bad_request');
  const now = Date.now();
  await sweepInstances(env, now);
  if (body.game === 'crass-act') {
    const room = await roomForCall(env, instance, now);
    return 'error' in room ? bad(room.error, 503) : json({ room: room.code });
  }
  const player = await playerOf(env, request, body);
  const name = cleanName(body?.name);
  if (!player || !name) return bad('name_required');
  const r = await challengeForCall(env, instance, player, name, now);
  if (!('error' in r)) return json({ challenge: r.id });
  if (r.error === 'too_many') return bad('too_many', 429);
  if (r.error === 'try_again') return bad('try_again', 503);
  return bad(r.error, 409, { message: SEAT_ERRORS[r.error] });
}

/** GET /api/discord/play?instanceId=…: what is already running in this call, and how many are in. */
export async function onRequestGet({ request, env }: Ctx): Promise<Response> {
  if (!discordReady(env)) return bad('discord_not_configured', 503);
  const instance = new URL(request.url).searchParams.get('instanceId');
  if (!validInstance(instance)) return bad('bad_request');
  return json({ games: await callGames(env, instance) });
}
