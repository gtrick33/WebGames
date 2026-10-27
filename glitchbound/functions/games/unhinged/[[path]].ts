import type { Ctx } from '../../../server/http';

/** GET or HEAD /games/unhinged/…: the game is now Crass Act. Old page, art and room links redirect (query kept). */
export function onRequestGet({ request }: Ctx): Response {
  const url = new URL(request.url);
  url.pathname = url.pathname.replace(/^\/games\/unhinged/, '/games/crass-act');
  return Response.redirect(url.toString(), 301);
}

// Link checkers and some crawlers ask with HEAD first; without this they get a 404.
export const onRequestHead = onRequestGet;
