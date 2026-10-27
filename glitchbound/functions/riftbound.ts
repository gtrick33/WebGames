import type { Ctx } from '../server/http';

/** GET or HEAD /riftbound: the game is now Sigilfall. The old tab's address redirects (query kept). */
export function onRequestGet({ request }: Ctx): Response {
  const url = new URL(request.url);
  url.pathname = '/sigilfall';
  return Response.redirect(url.toString(), 301);
}

// Link checkers and some crawlers ask with HEAD first; without this they get a 404.
export const onRequestHead = onRequestGet;
