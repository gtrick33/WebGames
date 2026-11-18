import { bad, json, readJson, sameOrigin, type Ctx } from '../../../server/http';
import { matchFor, openBotMatch, openPeopleMatch, readStandings, reportMatch, roomRoster, settleDue } from '../../../server/ring';
import { currentUser, requireUser } from '../../../server/session';
import { isFormat, isReport, MATCH_ID, shownStanding } from '../../../src/games/sigilfall/arena/ranked';
import { FORMATS, seasonOf } from '../../../src/games/sigilfall/arena/ranks';

/**
 * The Ring's ranked ladder (server/ring.ts; the rules: src/games/sigilfall/arena/ranked.ts). Signed-in players only:
 * a guest's rating is a practice one, on their own device.
 *
 * GET  /api/sigilfall/ring[?match=<id>]           your standing in each format (what is due settled first), and a
 *                                                 match of yours as it stands.
 * POST /api/sigilfall/ring { action: 'bots', format }                  a ticket for a match against the computer.
 * POST /api/sigilfall/ring { action: 'people', code, run }             what a match found by a ranked search stands for you.
 * POST /api/sigilfall/ring { action: 'report', match, report }         your report of a match: won, lost, draw, left, void.
 */
export async function onRequestGet({ request, env }: Ctx): Promise<Response> {
  const user = await currentUser(env, request);
  if (!user) return json({ signedIn: false }, 200, { 'cache-control': 'no-store' });
  const now = Date.now();
  await settleDue(env, user.id, now, roomRoster(env));
  const id = new URL(request.url).searchParams.get('match');
  const match = id && MATCH_ID.test(id) ? await matchFor(env, user.id, id, now, roomRoster(env)) : null;
  const all = await readStandings(env, user.id, now);
  const standings = Object.fromEntries(FORMATS.map((f) => [f, shownStanding(all[f])]));
  return json({ signedIn: true, season: seasonOf(now), standings, ...(match ? { match } : {}) }, 200, { 'cache-control': 'no-store' });
}

export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (!sameOrigin(request)) return bad('bad_origin', 403);
  const user = await requireUser(env, request);
  if (user instanceof Response) return user;
  const body = await readJson(request, 1024);
  const now = Date.now();
  switch (body?.action) {
    case 'bots': {
      if (!isFormat(body.format)) return bad('bad_request');
      return json(await openBotMatch(env, user.id, body.format, now));
    }
    case 'people': {
      const code = typeof body.code === 'string' ? body.code.toUpperCase() : '';
      const run = typeof body.run === 'number' && Number.isInteger(body.run) && body.run > 0 ? body.run : 0;
      if (!/^[A-Z]{4,8}$/.test(code) || !run) return bad('bad_request');
      const out = await openPeopleMatch(env, user.id, code, run, roomRoster(env), now);
      return 'error' in out ? bad(out.error, 409) : json(out);
    }
    case 'report': {
      const id = typeof body.match === 'string' ? body.match : '';
      if (!MATCH_ID.test(id) || !isReport(body.report)) return bad('bad_request');
      const out = await reportMatch(env, user.id, id, body.report, now, roomRoster(env));
      return 'error' in out ? bad(out.error, 409) : json(out);
    }
    default:
      return bad('bad_request');
  }
}
