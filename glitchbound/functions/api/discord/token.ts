import { DiscordAuthError, discordReady, exchangeCode, playerKeyFor } from '../../../server/discord';
import { bad, json, readJson, sameOrigin, type Ctx } from '../../../server/http';

/**
 * POST /api/discord/token { code }: the Discord Activity's sign-in. Exchanges the code from the SDK's
 * `authorize` for an access token (the SDK's `authenticate` needs it), and returns the player's
 * Discord name and their key for challenges and rooms.
 */
export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (!sameOrigin(request)) return bad('forbidden', 403);
  if (!discordReady(env)) return bad('discord_not_configured', 503);
  const body = await readJson(request, 1024);
  const code = body?.code;
  if (typeof code !== 'string' || !/^[A-Za-z0-9_-]{8,256}$/.test(code)) return bad('bad_request');
  try {
    const { accessToken, user } = await exchangeCode(env.DISCORD_CLIENT_ID, env.DISCORD_CLIENT_SECRET, code);
    return json({ access_token: accessToken, user, key: await playerKeyFor(env.DISCORD_CLIENT_SECRET, user.id) });
  } catch (err) {
    if (err instanceof DiscordAuthError) return bad(err.message, err.message === 'discord_unavailable' ? 502 : 401);
    return bad('discord_unavailable', 502);
  }
}
