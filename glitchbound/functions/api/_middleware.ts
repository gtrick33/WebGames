import { activityOrigin } from '../../server/discord';
import type { Ctx } from '../../server/http';

/**
 * Inside the Discord Activity the site is served through Discord's proxy, so browser requests carry
 * `Origin: https://<client id>.discordsays.com` while these Functions see their own host. That one
 * origin is this site (in Discord), so it counts as our own for the same-origin checks (sameOrigin,
 * the rooms WebSocket). Every other origin, other Discord apps included, is left as it is.
 */
export async function onRequest(ctx: Ctx & { next: (request?: Request) => Promise<Response> }): Promise<Response> {
  const { request, env } = ctx;
  const origin = request.headers.get('origin');
  const id = env.DISCORD_CLIENT_ID ?? '';
  if (!origin || !/^\d{15,25}$/.test(id) || origin !== activityOrigin(id)) return ctx.next();
  const headers = new Headers(request.headers);
  headers.set('origin', new URL(request.url).origin);
  return ctx.next(new Request(request, { headers }));
}
