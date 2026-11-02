import { getGame } from '../src/catalog/catalog';
import { MAX_PLAYERS, roundWinners } from '../src/platform/challenge';
import { hashString } from '../src/platform/dates';
import { challengeRow, viewOf } from './challenges';
import type { Env } from './http';
import type { Accent } from '../src/catalog/types';
import type { OgCard } from './ogImage';
import { roomStub, validCode } from './rooms';
import { readShare, shareGame, shareText } from './shares';

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
/** "Ana", "Ana and Bo", "Ana, Bo and Cy". */
const names = (list: string[]): string => (list.length < 2 ? (list[0] ?? '') : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`);

/**
 * How an ended challenge came out, from every round (most round wins, as the challenge history
 * says): "Ana won 2 rounds to 1", "Ana and Bo tied". A round only counts when two or more played it,
 * so nobody "wins" a round they played alone.
 */
function finalLine(rounds: { scores: { name: string; score: number }[] }[], lower: boolean): string {
  const wins = new Map<string, number>();
  for (const r of rounds) for (const w of roundWinners(r.scores, lower)) wins.set(w, (wins.get(w) ?? 0) + 1);
  const most = Math.max(0, ...wins.values());
  if (!most) return rounds.some((r) => r.scores.length) ? 'No round had two players' : 'Nobody played a round';
  const top = [...wins.keys()].filter((n) => wins.get(n) === most);
  if (top.length > 1) return `${names(top)} tied with ${most} round win${most === 1 ? '' : 's'} each`;
  const next = Math.max(0, ...[...wins].filter(([n]) => n !== top[0]).map(([, w]) => w));
  return `${top[0]} won ${next ? `${most} rounds to ${next}` : most === 1 ? 'the round' : `all ${most} rounds`}`;
}

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
    lines.push(finalLine(view.rounds, !!game?.challenge?.lowerIsBetter));
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

/** Party Mode rooms: how their invites read, and the colors of their pictures. */
const PARTY: Record<string, { name: string; pitch: string; accent: Accent }> = {
  impostor: { name: 'Impostor', pitch: 'Everyone gets the secret word except the impostor. Find them.', accent: 'violet' },
  nhie: { name: 'Never Have I Ever', pitch: 'Answer in secret on your phone, reveal together. Last one standing wins.', accent: 'magenta' },
  auction: { name: 'Name Your Price', pitch: 'Bid play money on heroes, villains and legends. Best collection wins.', accent: 'yellow' },
  board: { name: 'Dice Adventure', pitch: 'Roll, race and dodge the slides. Challenges, duels and trivia on the way.', accent: 'lime' },
  rps: { name: 'Rock Paper Scissors', pitch: 'Everyone throws in secret, all hands revealed at once. Last hand standing wins.', accent: 'blue' },
  dial: { name: 'Dial It In', pitch: 'One player sees the secret spot on the dial and gives one clue. Turn the needle together.', accent: 'teal' },
  unique: { name: 'One of a Kind', pitch: 'Everyone writes a one-word clue in secret. Matching clues cancel out. Can the guesser still get it?', accent: 'orange' },
  hues: { name: 'Hue Knew?', pitch: 'Describe a secret color in one word. Whoever taps closest on the color board scores.', accent: 'coral' },
  scribble: { name: 'Scribble Scramble', pitch: 'One player draws, everyone else races to guess the word. The faster you guess, the more you score.', accent: 'orange' },
};

/** Arcade games with their own live rooms: where the invite lands and how it reads (`busy`: what a game in progress is called, when nobody can join it). */
const GAMES: Record<string, { slug: string; title: (host: string) => string; pitch: string; busy?: string }> = {
  drag: { slug: 'launch-control', title: (h) => (h ? `${h} wants to race you in Launch Control` : 'Race me in Launch Control'), pitch: 'Head-to-head drag race, live on your own phone.' },
  backgammon: { slug: 'backgammon', title: (h) => (h ? `${h} wants a game of backgammon with you` : 'Play backgammon with me'), pitch: 'A live match on your own phone, to 3, 5 or 7 points.' },
  belot: { slug: 'belot', title: (h) => (h ? `${h} saved you a seat at the Belot table` : 'Join my Belot table'), pitch: 'Four players, two teams, first to 151. Live on your own phone.' },
  sigilfall: { slug: 'sigilfall', title: (h) => (h ? `${h} wants you in their Sigilfall party` : 'Join my Sigilfall party'), pitch: 'Riftstone runs and questing together, every hero on their own device.', busy: 'In a Riftstone run right now' },
  'crater-crew': { slug: 'crater-crew', title: (h) => (h ? `${h} wants you in a Crater Crew battle` : 'Join my Crater Crew battle'), pitch: 'Turn-based artillery for 2 to 6 crews, live on your own phone.' },
  'crass-act': { slug: 'crass-act', title: (h) => (h ? `${h} wants you in a Crass Act room` : 'Join my Crass Act room'), pitch: 'Fill-in-the-blank party cards for adults. 18+, free in your browser.' },
};

/** Phases where a room's game is over and the next one has not started (anything else but the lobby is a game in progress). */
const BETWEEN = new Set(['over', 'result', 'gameEnd', 'dealEnd']);

/** What the room is doing, as the card's status line and button. */
function roomStatus(info: { players: number; phase: string; full: boolean }, name: string, busy?: string): { line: string; cta: string } {
  const n = info.players;
  const people = `${n} player${n === 1 ? '' : 's'}`;
  if (info.full) return { line: `Room full${n ? ` · ${people}` : ''}`, cta: `Open ${name}` };
  if (info.phase === 'lobby' || !info.phase) return { line: n ? `${people} waiting` : '', cta: 'Join the room' };
  if (BETWEEN.has(info.phase)) return { line: `${people} · between games`, cta: 'Join the room' };
  if (busy) return { line: busy, cta: `Open ${name}` };
  return { line: `${n} playing · game in progress`, cta: 'Join the next round' };
}

/** A room (/r/<code>): Crass Act, a Party Mode game, or an arcade game's table. Who is waiting (or whether the room is full or playing), and the code. */
export async function roomInvite(env: Env, rawCode: string): Promise<Invite> {
  const code = rawCode.toUpperCase();
  let info: { host: string; players: number; phase: string; full: boolean; game: string } | null = null;
  let missing = false;
  if (validCode(code)) {
    const res = await roomStub(env, code)
      ?.fetch('https://room/info')
      .catch(() => null);
    if (res?.ok) {
      const raw = (await res.json()) as { host?: string; players?: number; phase?: string; full?: boolean; game?: string };
      info = { host: raw.host ?? '', players: raw.players ?? 0, phase: raw.phase ?? '', full: !!raw.full, game: raw.game ?? 'crass-act' };
    } else missing = res?.status === 404;
  }
  // A code that never was (mistyped) or a room that closed after three quiet hours: say we can't find it, and offer a new room.
  if (missing) {
    const title = `We can’t find room ${code}`;
    const lines = ['Check the code, or start a new room'];
    return {
      page: '/party',
      replaceUrl: `/party?room=${code}`,
      title,
      description: [...lines, 'Rooms close after three quiet hours. Party games on everyone’s own phone, free.'].join(' · '),
      card: { headline: title, lines, cta: 'Start a room' },
    };
  }
  // The room could not be asked (or the code is not one): the party page. Never the 18+ game by default.
  if (!info) {
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
  const { host, game } = info;
  const details = (name: string, pitch: string, busy?: string): { lines: string[]; description: string; cta: string } => {
    const status = roomStatus(info, name, busy);
    const lines = [[`Room ${code}`, status.line].filter(Boolean).join(' · ')];
    return { lines, description: `${lines[0]} · ${pitch}`, cta: status.cta };
  };
  const own = Object.hasOwn(GAMES, game) ? GAMES[game] : undefined;
  if (own) {
    const title = own.title(host);
    const entry = getGame(own.slug);
    const { lines, description, cta } = details(entry?.title ?? own.slug, own.pitch, own.busy);
    return {
      page: `/games/${own.slug}`,
      replaceUrl: `/games/${own.slug}?room=${code}`,
      title,
      description: entry?.adult && !description.includes('18+') ? `18+ · ${description}` : description,
      card: { headline: title, lines, game: gameOf(own.slug), cta, adult: entry?.adult || undefined },
    };
  }
  const party = Object.hasOwn(PARTY, game) ? PARTY[game]! : { name: 'party', pitch: 'Party games on everyone’s own phone.', accent: 'cyan' as Accent };
  const title = host ? `${host} wants you in a ${party.name} room` : `Join my ${party.name} room`;
  const { lines, description, cta } = details(party.name === 'party' ? 'Party Mode' : party.name, `${party.pitch} Free, on your own phone.`);
  return { page: '/party', replaceUrl: `/party?room=${code}`, title, description, card: { headline: title, lines, game: party.name === 'party' ? undefined : { title: party.name, accent: party.accent }, cta } };
}

/** Every shared result's card says who made it: a player, not the arcade. */
export const SHARED_BY = 'Shared by a player';

/**
 * A shared result (/s/<code>): built here from what the server knows and checks. The game (badge,
 * colors, button) comes from the link, the words are the result's own lines, checked again as they
 * are read (links made before the checks fall back to the game's own card), and the card is marked
 * as shared by a player.
 */
export async function shareInvite(env: Env, code: string): Promise<Invite | null> {
  const share = await readShare(env, code);
  if (!share) return null;
  const slug = shareGame(share.path);
  const game = slug ? getGame(slug) : undefined;
  const text = shareText(share.title, share.description) ?? { title: game ? `A ${game.title} result` : 'A GlitchBound result', description: '' };
  const lines = text.description ? text.description.split(' · ') : [];
  return {
    page: share.path,
    replaceUrl: share.path,
    title: text.title,
    description: [...lines, SHARED_BY].join(' · '),
    card: { headline: text.title, lines, game: slug ? gameOf(slug) : undefined, byline: SHARED_BY, cta: game ? `Play ${game.title}` : undefined, adult: game?.adult || undefined },
  };
}

export async function inviteFor(env: Env, kind: InviteKind, key: string): Promise<Invite | null> {
  if (kind === 'c') return challengeInvite(env, key);
  if (kind === 'r') return roomInvite(env, key);
  return shareInvite(env, key);
}

/** The picture's address: it changes with what the card says, so chat apps and caches never show an old one. */
export const cardUrl = (kind: InviteKind, key: string, card: OgCard): string => `/og/${kind}/${key}.png?v=${hashString(JSON.stringify(card)).toString(36)}`;
