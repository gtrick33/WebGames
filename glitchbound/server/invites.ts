import { getGame } from '../src/catalog/catalog';
import { MAX_PLAYERS } from '../src/platform/challenge';
import { hashString } from '../src/platform/dates';
import { challengeRow, viewOf } from './challenges';
import type { Env } from './http';
import type { OgCard } from './ogImage';
import { roomStub, validCode } from './rooms';
import { readShare } from './shares';

/**
 * What a shared link says in a chat: the page it opens, the preview's title and description, and
 * the picture card (server/ogImage.ts) that carries the invite or result. Shared links are sent bare
 * (no text, no emoji), so this is all the message there is. Used by the preview pages (/c/, /r/,
 * /s/) and by the pictures themselves (/og/<kind>/<key>.png).
 */
export interface Invite {
  /** The site page served under the link (its preview tags are replaced). */
  page: string;
  /** Where the app goes once open. */
  replaceUrl: string;
  title: string;
  description: string;
  card: OgCard;
}

export type InviteKind = 'c' | 'r' | 's';

const fmt = (n: number): string => n.toLocaleString('en-US');
const gameOf = (slug: string): OgCard['game'] => {
  const g = getGame(slug);
  return g ? { title: g.title, accent: g.accent } : undefined;
};

/** A friends' challenge (/c/<id>): who challenges you, and the score to beat. Null when it is gone. */
export async function challengeInvite(env: Env, id: string): Promise<Invite | null> {
  const row = await challengeRow(env, id);
  if (!row) return null;
  const game = getGame(row.game);
  const gameTitle = game?.title ?? 'GlitchBound';
  // Seen from the host, to know which seat and score are theirs (nothing of it is sent).
  const view = await viewOf(env, row, row.host);
  const host = view.players.find((p) => p.you)?.name ?? view.players[0]?.name ?? 'A friend';
  const scores = view.rounds.find((r) => r.round === view.round)?.scores ?? [];
  const top = scores[0];
  const hostTop = top?.you;
  let headline: string;
  const lines: string[] = [];
  if (view.closed) {
    headline = `${host}'s ${gameTitle} challenge has ended`;
    if (top) lines.push(`${top.name} won with ${fmt(top.score)}`);
  } else if (top && hostTop) headline = `${host} challenges you to beat ${fmt(top.score)} in ${gameTitle}`;
  else {
    headline = `${host} challenges you in ${gameTitle}`;
    lines.push(top ? `${top.name} leads with ${fmt(top.score)}` : 'Be the first to set a score');
  }
  lines.push(`${view.players.length}/${MAX_PLAYERS} players · Round ${view.round}`);
  return {
    page: '/challenge',
    replaceUrl: `/c/${row.id}`,
    title: headline,
    description: [...lines, view.closed ? 'Start a new one, free in your browser' : 'Tap to play, free in your browser'].join(' · '),
    card: { headline, lines, game: gameOf(row.game), cta: view.closed ? 'Start a new challenge' : top ? 'Can you beat it?' : 'Play your round' },
  };
}

/** Party Mode rooms: how their invites read. */
const PARTY: Record<string, { name: string; pitch: string }> = {
  impostor: { name: 'Impostor', pitch: 'Everyone gets the secret word except the impostor. Find them.' },
  nhie: { name: 'Never Have I Ever', pitch: 'Answer in secret on your phone, reveal together. Last one standing wins.' },
  auction: { name: 'Name Your Price', pitch: 'Bid play money on heroes, villains and legends. Best collection wins.' },
  board: { name: 'Dice Adventure', pitch: 'Roll, race and dodge the slides. Challenges, duels and trivia on the way.' },
  rps: { name: 'Rock Paper Scissors', pitch: 'Everyone throws in secret, all hands revealed at once. Last hand standing wins.' },
  dial: { name: 'Dial It In', pitch: 'One player sees the secret spot on the dial and gives one clue. Turn the needle together.' },
  unique: { name: 'One of a Kind', pitch: 'Everyone writes a one-word clue in secret. Matching clues cancel out. Can the guesser still get it?' },
  hues: { name: 'Hue Knew?', pitch: 'Describe a secret color in one word. Whoever taps closest on the color board scores.' },
  scribble: { name: 'Scribble Scramble', pitch: 'One player draws, everyone else races to guess the word. The faster you guess, the more you score.' },
};

/** Arcade games with their own live rooms: where the invite lands and how it reads. */
const GAMES: Record<string, { slug: string; title: (host: string) => string; pitch: string }> = {
  drag: { slug: 'launch-control', title: (h) => (h ? `${h} wants to race you in Launch Control` : 'Race me in Launch Control'), pitch: 'Head-to-head drag race, live on your own phone.' },
  backgammon: { slug: 'backgammon', title: (h) => (h ? `${h} wants a game of backgammon with you` : 'Play backgammon with me'), pitch: 'A live match on your own phone, to 3, 5 or 7 points.' },
  belot: { slug: 'belot', title: (h) => (h ? `${h} saved you a seat at the Belot table` : 'Join my Belot table'), pitch: 'Four players, two teams, first to 151. Live on your own phone.' },
  'crass-act': { slug: 'crass-act', title: (h) => (h ? `${h} wants you in a Crass Act room` : 'Join my Crass Act room'), pitch: 'Fill-in-the-blank party cards for adults. 18+, free in your browser.' },
};

/** A room (/r/<code>): Crass Act, a Party Mode game, or an arcade game's table. Who is waiting, and the code. */
export async function roomInvite(env: Env, rawCode: string): Promise<Invite> {
  const code = rawCode.toUpperCase();
  let host = '';
  let players = 0;
  let game: string | null = null;
  if (validCode(code)) {
    const res = await roomStub(env, code)
      ?.fetch('https://room/info')
      .catch(() => null);
    if (res?.ok) ({ host, players, game = 'crass-act' } = (await res.json()) as { host: string; players: number; game?: string });
  }
  const waiting = players ? `${players} player${players === 1 ? '' : 's'} waiting` : '';
  const details = (pitch: string): { lines: string[]; description: string } => {
    const lines = [[`Room ${code}`, waiting].filter(Boolean).join(' · ')];
    return { lines, description: `${lines[0]} · ${pitch}` };
  };
  // No such room (rooms close after three quiet hours): the party page says so. Never the 18+ game by default.
  if (game === null) {
    const title = 'Join my party room';
    const lines = validCode(code) ? [`Room ${code}`] : [];
    return {
      page: '/party',
      replaceUrl: validCode(code) ? `/party?room=${code}` : '/party',
      title,
      description: [...lines, 'Party games on everyone’s own phone. Free, no sign-up.'].join(' · '),
      card: { headline: title, lines: [...lines, 'Party games on everyone’s own phone'], cta: 'Join the room' },
    };
  }
  const own = Object.hasOwn(GAMES, game) ? GAMES[game] : undefined;
  if (own) {
    const title = own.title(host);
    const { lines, description } = details(own.pitch);
    return { page: `/games/${own.slug}`, replaceUrl: `/games/${own.slug}?room=${code}`, title, description, card: { headline: title, lines, game: gameOf(own.slug), cta: 'Join the room' } };
  }
  const party = Object.hasOwn(PARTY, game) ? PARTY[game]! : { name: 'party', pitch: 'Party games on everyone’s own phone.' };
  const title = host ? `${host} wants you in a ${party.name} room` : `Join my ${party.name} room`;
  const { lines, description } = details(`${party.pitch} Free, on your own phone.`);
  return { page: '/party', replaceUrl: `/party?room=${code}`, title, description, card: { headline: title, lines, cta: 'Join the room' } };
}

/** A shared result (/s/<code>): the result as the sharer's own words (in their language), on the game's colors. */
export async function shareInvite(env: Env, code: string): Promise<Invite | null> {
  const share = await readShare(env, code);
  if (!share) return null;
  const slug = /^\/games\/([a-z0-9-]+)/.exec(share.path)?.[1];
  const lines = share.description ? share.description.split(' · ') : [];
  return { page: share.path, replaceUrl: share.path, title: share.title, description: share.description, card: { headline: share.title, lines, game: slug ? gameOf(slug) : undefined } };
}

export async function inviteFor(env: Env, kind: InviteKind, key: string): Promise<Invite | null> {
  if (kind === 'c') return challengeInvite(env, key);
  if (kind === 'r') return roomInvite(env, key);
  return shareInvite(env, key);
}

/** The picture's address: it changes with what the card says, so chat apps and caches never show an old one. */
export const cardUrl = (kind: InviteKind, key: string, card: OgCard): string => `/og/${kind}/${key}.png?v=${hashString(JSON.stringify(card)).toString(36)}`;
