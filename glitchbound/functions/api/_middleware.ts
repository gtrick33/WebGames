import { audit, redactBody, redactQuery } from '../../server/audit';
import { activityOrigin } from '../../server/discord';
import type { Ctx, Env } from '../../server/http';
import { COOKIE, currentUser, isAudited, readCookie } from '../../server/session';

/**
 * Inside the Discord Activity the site is served through Discord's proxy, so browser requests carry
 * `Origin: https://<client id>.discordsays.com` while these Functions see their own host. That one
 * origin is this site (in Discord), so it counts as our own for the same-origin checks (sameOrigin,
 * the rooms WebSocket). Every other origin, other Discord apps included, is left as it is.
 */
function withDiscordOrigin(request: Request, env: Env): Request {
  const origin = request.headers.get('origin');
  const id = env.DISCORD_CLIENT_ID ?? '';
  if (!origin || !/^\d{15,25}$/.test(id) || origin !== activityOrigin(id)) return request;
  const headers = new Headers(request.headers);
  headers.set('origin', new URL(request.url).origin);
  return new Request(request, { headers });
}

/**
 * Every API request a QA tester makes is written to the legal audit trail (server/audit.ts) with its
 * result, whatever the endpoint. Admins and players are not logged. The signed-in user looked up
 * here is reused by the endpoint (currentUser remembers it per request).
 */
export async function onRequest(ctx: Ctx & { next: (request?: Request) => Promise<Response> }): Promise<Response> {
  const { env } = ctx;
  const request = withDiscordOrigin(ctx.request, env);
  const next = (): Promise<Response> => (request === ctx.request ? ctx.next() : ctx.next(request));
  const actor = readCookie(request, COOKIE) ? await currentUser(env, request).catch(() => null) : null;
  if (!actor || !isAudited(env, actor)) return next();

  const url = new URL(request.url);
  const body = request.method === 'GET' || request.method === 'HEAD' ? '' : await request.clone().text().catch(() => '');
  const log = (status: number): Promise<void> =>
    audit(env, request, actor, {
      kind: 'request',
      action: `${request.method} ${url.pathname}`,
      detail: { query: redactQuery(url.search), body: redactBody(body) ?? undefined },
      status,
    });
  let res: Response;
  try {
    res = await next();
  } catch (err) {
    await log(500);
    throw err;
  }
  await log(res.status);
  return res;
}
