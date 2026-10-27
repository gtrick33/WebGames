import type { Ctx } from '../../server/http';
import { cardUrl, shareInvite } from '../../server/invites';
import { previewPage } from '../../server/shares';

/** GET /s/<code>: a shared result. Chats show the result as a picture; people land on the game. */
export async function onRequestGet({ request, env, params }: Ctx): Promise<Response> {
  const code = typeof params?.code === 'string' ? params.code : '';
  const invite = await shareInvite(env, code).catch(() => null);
  if (!invite) return Response.redirect(new URL('/', request.url).toString(), 302);
  return previewPage(env, request, invite.page, { title: invite.title, description: invite.description, image: cardUrl('s', code, invite.card), imageAlt: invite.card.headline, replaceUrl: invite.replaceUrl });
}
