import type { Ctx } from '../../../server/http';
import { inviteFor, type InviteKind } from '../../../server/invites';
import { renderOgCard } from '../../../server/ogImage';

const KEYS: Record<InviteKind, RegExp> = { c: /^[A-Za-z0-9]{5,12}$/, r: /^[A-Za-z]{5}$/, s: /^[A-Za-z0-9]{5,12}$/ };

/**
 * GET /og/<c|r|s>/<key>.png: the picture a shared link previews with (a challenge, a room, a shared
 * result), drawn from what the server knows. Each one is drawn once per data center: the preview
 * pages ask for it with ?v=<what it says>, so a cached copy is never out of date. Anything unknown
 * gets the site's own card.
 */
export async function onRequestGet({ request, env, params, waitUntil }: Ctx): Promise<Response> {
  const kind = String(params?.kind ?? '') as InviteKind;
  const key = /^(.+)\.png$/.exec(String(params?.file ?? ''))?.[1] ?? '';
  if (!Object.hasOwn(KEYS, kind) || !KEYS[kind].test(key)) return Response.redirect(new URL('/og-home.jpg', request.url).toString(), 302);
  const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  const hit = await cache?.match(request).catch(() => undefined);
  if (hit) return hit;
  const invite = await inviteFor(env, kind, key).catch(() => null);
  if (!invite) return Response.redirect(new URL('/og-home.jpg', request.url).toString(), 302);
  const png = await renderOgCard(invite.card);
  // A versioned address can be kept for long; a bare one changes with the challenge or room.
  const versioned = new URL(request.url).searchParams.has('v');
  const res = new Response(png, { headers: { 'content-type': 'image/png', 'cache-control': `public, max-age=${versioned ? 30 * 86400 : 300}` } });
  if (cache) waitUntil?.(cache.put(request, res.clone()).catch(() => undefined));
  return res;
}
