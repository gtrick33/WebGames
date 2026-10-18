import { challengeRow, viewOf } from '../../server/challenges';
import type { Ctx } from '../../server/http';
import { previewPage } from '../../server/shares';
import { getGame } from '../../src/catalog/catalog';
import { MAX_PLAYERS } from '../../src/platform/challenge';

/** GET /c/<id>: a challenge invite. Chats show who challenged you; people land on the challenge page. */
export async function onRequestGet({ request, env, params }: Ctx): Promise<Response> {
  const id = String(params?.id ?? '');
  const row = await challengeRow(env, id).catch(() => null);
  if (!row) return Response.redirect(new URL('/', request.url).toString(), 302);
  const game = getGame(row.game);
  const view = await viewOf(env, row, null);
  const host = view.players[0]?.name ?? 'A friend';
  const top = view.rounds[0]?.scores[0];
  const title = `${host} challenged you in ${game?.title ?? 'GlitchBound'}! ⚔️`;
  const description = [
    top ? `${top.name} leads with ${top.score.toLocaleString('en-US')}` : 'Be the first to set a score',
    `${view.players.length}/${MAX_PLAYERS} players`,
    `Round ${view.round}`,
    'Tap to play, free in your browser',
  ].join(' · ');
  return previewPage(env, request, '/challenge', { title, description, image: game ? `/games/${game.slug}/og.jpg` : undefined, replaceUrl: `/c/${row.id}` });
}
