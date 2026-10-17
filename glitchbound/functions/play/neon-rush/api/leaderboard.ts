/**
 * NEON RUSH's own leaderboard API, served by GlitchBound at /play/neon-rush/api/leaderboard (the game calls it
 * with a relative URL). The handler lives in the game's folder; here it gets the game's D1 database.
 */
import { onRequestGet as handle } from '../../../../../neon-rush/functions/api/leaderboard';
import type { Ctx } from '../../../../server/http';

export function onRequestGet({ request, env }: Ctx): Promise<Response> {
  return handle({ request, env: { DB: env.NR_DB as never } });
}
