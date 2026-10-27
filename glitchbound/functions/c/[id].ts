import type { Ctx } from '../../server/http';
import { cardUrl, challengeInvite } from '../../server/invites';
import { previewPage } from '../../server/shares';

/** GET /c/<id>: a challenge invite. Chats show who challenged you (as a picture); people land on the challenge page. */
export async function onRequestGet({ request, env, params }: Ctx): Promise<Response> {
  const id = String(params?.id ?? '');
  const invite = await challengeInvite(env, id).catch(() => null);
  if (!invite) {
    // A challenge that is over (deleted): the app says so, instead of dropping people on the home page unexplained.
    if (!/^[A-Za-z0-9]{5,12}$/.test(id)) return Response.redirect(new URL('/', request.url).toString(), 302);
    return previewPage(env, request, '/challenge', { title: 'This challenge has closed · GlitchBound', description: 'Start a new one and send the link to your friends.', replaceUrl: `/c/${id}` });
  }
  return previewPage(env, request, invite.page, { title: invite.title, description: invite.description, image: cardUrl('c', id, invite.card), imageAlt: invite.card.headline, replaceUrl: invite.replaceUrl });
}
