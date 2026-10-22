import type { Ctx } from '../server/http';

/** GET /riftbound: the game is now Sigilfall. The old tab's address redirects (query kept). */
export function onRequestGet({ request }: Ctx): Response {
  const url = new URL(request.url);
  url.pathname = '/sigilfall';
  return Response.redirect(url.toString(), 301);
}
