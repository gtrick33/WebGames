import type { Ctx } from '../../../server/http';

/**
 * GET /games/wait-what: Quizbelief's page lives at /games/quizbelief (src/catalog/urls.ts). Only the page
 * moves (query kept, so challenge links still open); the art and the question banks stay in this folder.
 */
export function onRequestGet({ request }: Ctx): Response {
  const url = new URL(request.url);
  url.pathname = '/games/quizbelief';
  return Response.redirect(url.toString(), 301);
}
