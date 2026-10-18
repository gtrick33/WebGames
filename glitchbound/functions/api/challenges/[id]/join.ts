import { challengeRow, playerOf, SEAT_ERRORS, takeSeat } from '../../../../server/challenges';
import { bad, json, readJson, sameOrigin, type Ctx } from '../../../../server/http';
import { cleanName } from '../../../../src/platform/challenge';

/** POST /api/challenges/<id>/join { name, key? }: take a seat (up to 6 players; joining again just renames). */
export async function onRequestPost({ request, env, params }: Ctx): Promise<Response> {
  if (!sameOrigin(request)) return bad('forbidden', 403);
  const row = await challengeRow(env, String(params?.id ?? ''));
  if (!row) return bad('not_found', 404);
  const body = await readJson(request, 1024);
  const player = await playerOf(env, request, body);
  const name = cleanName(body?.name);
  if (!player || !name) return bad('name_required');
  const seat = await takeSeat(env, row, player, name);
  if ('error' in seat) return bad(seat.error, 409, { message: SEAT_ERRORS[seat.error] });
  return json(seat.view);
}
