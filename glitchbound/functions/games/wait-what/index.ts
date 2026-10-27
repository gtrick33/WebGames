import type { Ctx } from '../../../server/http';

/**
 * GET or HEAD /games/wait-what: Quizbelief's page lives at /games/quizbelief (src/catalog/urls.ts). Only the page
 * moves (query kept, so challenge links still open); the art and the question banks stay in this folder.
 */
export function onRequestGet({ request }: Ctx): Response {
  const url = new URL(request.url);
  url.pathname = '/games/quizbelief';
  return Response.redirect(url.toString(), 301);
}

// Link checkers and some crawlers ask with HEAD first; without this they get a 404.
export const onRequestHead = onRequestGet;
