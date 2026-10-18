import type { Ctx } from '../../server/http';
import { roomStub, validCode } from '../../server/rooms';
import { previewPage } from '../../server/shares';

/** Party Mode rooms: how their invites read in chats. */
const PARTY: Record<string, { name: string; emoji: string; pitch: string }> = {
  impostor: { name: 'Impostor', emoji: '🕵️', pitch: 'Everyone gets the secret word except the impostor. Find them.' },
  nhie: { name: 'Never Have I Ever', emoji: '🙊', pitch: 'Answer in secret on your phone, reveal together. Last one standing wins.' },
  auction: { name: 'Name Your Price', emoji: '🔨', pitch: 'Bid play money on heroes, villains and legends. Best collection wins.' },
  board: { name: 'Dice Adventure', emoji: '🎲', pitch: 'Roll, race and dodge the slides. Challenges, duels and trivia on the way.' },
  rps: { name: 'Rock Paper Scissors', emoji: '✊', pitch: 'Everyone throws in secret, all hands revealed at once. Last hand standing wins.' },
};

/** GET /r/<code>: a room invite (Unhinged or a Party Mode game). Chats show who is waiting; people land in the room. */
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
  const party = Object.hasOwn(PARTY, game) ? PARTY[game] : undefined;
  if (party) {
    const title = host ? `${host} wants you in a ${party.name} room ${party.emoji}` : `Join my ${party.name} room ${party.emoji}`;
    const description = `Room ${code} · ${players ? `${players} player${players === 1 ? '' : 's'} waiting · ` : ''}${party.pitch} Free, on your own phone.`;
    return previewPage(env, request, '/party', { title, description, image: '/og.png', replaceUrl: validCode(code) ? `/party?room=${code}` : '/party' });
  }
  const target = validCode(code) ? `/games/unhinged?room=${code}` : '/games/unhinged';
  const title = host ? `${host} wants you in an Unhinged room 😈` : 'Join my Unhinged room 😈';
  const description = `Room ${code} · ${players ? `${players} player${players === 1 ? '' : 's'} waiting · ` : ''}The card game for terrible people. 18+, free in your browser.`;
  return previewPage(env, request, '/games/unhinged', { title, description, image: '/games/unhinged/og.jpg', replaceUrl: target });
}
