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
  dial: { name: 'Dial It In', emoji: '📻', pitch: 'One player sees the secret spot on the dial and gives one clue. Turn the needle together.' },
  unique: { name: 'One of a Kind', emoji: '🦄', pitch: 'Everyone writes a one-word clue in secret. Matching clues cancel out. Can the guesser still get it?' },
  hues: { name: 'Hue Knew?', emoji: '🎨', pitch: 'Describe a secret colour in one word. Whoever taps closest on the colour board scores.' },
};

/** GET /r/<code>: a room invite (Crass Act or a Party Mode game). Chats show who is waiting; people land in the room. */
export async function onRequestGet({ request, env, params }: Ctx): Promise<Response> {
  const code = String(params?.code ?? '').toUpperCase();
  let host = '';
  let players = 0;
  let game: string | null = null;
  if (validCode(code)) {
    const res = await roomStub(env, code)
      ?.fetch('https://room/info')
      .catch(() => null);
    if (res?.ok) ({ host, players, game = 'crass-act' } = (await res.json()) as { host: string; players: number; game?: string });
  }
  // No such room (rooms close after three quiet hours): the party page says so. Never the 18+ game by default.
  if (game === null)
    return previewPage(env, request, '/party', {
      title: 'Join my party room 🎉',
      description: `${validCode(code) ? `Room ${code} · ` : ''}Party games on everyone’s own phone. Free, no sign-up.`,
      image: '/og.png',
      replaceUrl: validCode(code) ? `/party?room=${code}` : '/party',
    });
  const party = Object.hasOwn(PARTY, game) ? PARTY[game] : undefined;
  if (party) {
    const title = host ? `${host} wants you in a ${party.name} room ${party.emoji}` : `Join my ${party.name} room ${party.emoji}`;
    const description = `Room ${code} · ${players ? `${players} player${players === 1 ? '' : 's'} waiting · ` : ''}${party.pitch} Free, on your own phone.`;
    return previewPage(env, request, '/party', { title, description, image: '/og.png', replaceUrl: `/party?room=${code}` });
  }
  const target = `/games/crass-act?room=${code}`;
  const title = host ? `${host} wants you in a Crass Act room 😈` : 'Join my Crass Act room 😈';
  const description = `Room ${code} · ${players ? `${players} player${players === 1 ? '' : 's'} waiting · ` : ''}Fill-in-the-blank party cards for adults. 18+, free in your browser.`;
  return previewPage(env, request, '/games/crass-act', { title, description, image: '/games/crass-act/og.jpg', replaceUrl: target });
}
