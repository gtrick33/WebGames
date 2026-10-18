import type { Ctx } from '../../server/http';
import { roomStub, validCode } from '../../server/rooms';
import { previewPage } from '../../server/shares';

/** GET /r/<code>: a room invite (Unhinged or Impostor). Chats show who is waiting; people land in the room. */
export async function onRequestGet({ request, env, params }: Ctx): Promise<Response> {
  const code = String(params?.code ?? '').toUpperCase();
  let host = '';
  let players = 0;
  let game = 'unhinged';
  if (validCode(code)) {
    const res = await roomStub(env, code)
      ?.fetch('https://room/info')
      .catch(() => null);
    if (res?.ok) ({ host, players, game = 'unhinged' } = (await res.json()) as { host: string; players: number; game?: string });
  }
  if (game === 'impostor') {
    const title = host ? `${host} wants you in an Impostor room 🕵️` : 'Join my Impostor room 🕵️';
    const description = `Room ${code} · ${players ? `${players} player${players === 1 ? '' : 's'} waiting · ` : ''}Everyone gets the secret word except the impostor. Find them. Free, on your own phone.`;
    return previewPage(env, request, '/party', { title, description, image: '/games/unhinged/og.jpg', replaceUrl: validCode(code) ? `/party?room=${code}` : '/party' });
  }
  const target = validCode(code) ? `/games/unhinged?room=${code}` : '/games/unhinged';
  const title = host ? `${host} wants you in an Unhinged room 😈` : 'Join my Unhinged room 😈';
  const description = `Room ${code} · ${players ? `${players} player${players === 1 ? '' : 's'} waiting · ` : ''}The card game for terrible people. 18+, free in your browser.`;
  return previewPage(env, request, '/games/unhinged', { title, description, image: '/games/unhinged/og.jpg', replaceUrl: target });
}
