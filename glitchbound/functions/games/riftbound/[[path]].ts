import type { Ctx } from '../../../server/http';

/** GET or HEAD /games/riftbound/…: the game is now Sigilfall. Its page goes to /sigilfall, its art to the new folder (query kept). */
export function onRequestGet({ request }: Ctx): Response {
  const url = new URL(request.url);
  url.pathname = /^\/games\/riftbound\/?$/.test(url.pathname) ? '/sigilfall' : url.pathname.replace(/^\/games\/riftbound/, '/games/sigilfall');
  return Response.redirect(url.toString(), 301);
}

// Link checkers and some crawlers ask with HEAD first; without this they get a 404.
export const onRequestHead = onRequestGet;
