import type { Ctx } from '../../server/http';
import { cardUrl, roomInvite } from '../../server/invites';
import { previewPage } from '../../server/shares';

/** GET /r/<code>: a room invite (Crass Act, a Party Mode game, or an arcade game's table). Chats show who is waiting (as a picture); people land in the room. */
export async function onRequestGet({ request, env, params }: Ctx): Promise<Response> {
  const code = String(params?.code ?? '').toUpperCase();
  const invite = await roomInvite(env, code);
  return previewPage(env, request, invite.page, { title: invite.title, description: invite.description, image: cardUrl('r', code, invite.card), imageAlt: invite.card.headline, replaceUrl: invite.replaceUrl });
}
