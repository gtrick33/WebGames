import type { Ctx } from '../../../server/http';

/** GET /games/unhinged/…: the game is now Crass Act. Old page, art and room links redirect (query kept). */
export function onRequestGet({ request }: Ctx): Response {
  const url = new URL(request.url);
  url.pathname = url.pathname.replace(/^\/games\/unhinged/, '/games/crass-act');
  return Response.redirect(url.toString(), 301);
}
