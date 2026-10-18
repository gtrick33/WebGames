/**
 * The Party Mode line-up: every party game, how it can be played (one phone passed around, a live
 * room with everyone on their own phone, or both) and its card text. The party page and the admin's
 * Party view both read this list; admins can hide, feature or relabel a game (src/catalog/settings.ts).
 */
export type PartyGameId = 'impostor' | 'prompts' | 'nhie' | 'charades' | 'board' | 'auction' | 'rps' | 'unhinged';
export type PartyRoomGame = 'impostor' | 'nhie' | 'auction' | 'board' | 'rps' | 'unhinged';

export interface PartyGame {
  id: PartyGameId;
  title: string;
  emoji: string;
  blurb: string;
  time: string;
  players: string;
  color: string;
  /** Playable by passing one phone around (a mode on the party page). */
  onePhone: boolean;
  /** Playable in a live room, everyone on their own phone. */
  room: PartyRoomGame | null;
  /** The live room's player count and one-liner. */
  roomPlayers?: string;
  roomBlurb?: string;
  /** The sticker on its featured card when an admin has not set one. */
  sticker?: string;
}

export const PARTY_GAMES: PartyGame[] = [
  { id: 'impostor', title: 'Impostor', emoji: '🕵️', blurb: 'Everyone gets the secret word, except one. Say one word each, then vote out the faker.', time: '10–40 min', players: '3–16', color: '#7b4dff', onePhone: true, room: 'impostor', roomPlayers: '3–12', roomBlurb: 'Secret cards on each phone', sticker: 'New' },
  { id: 'unhinged', title: 'Unhinged', emoji: '😈', blurb: 'The card game for terrible people. Play the most horrible answer, win the round.', time: '15–45 min', players: '3–10', color: '#ff5a6c', onePhone: false, room: 'unhinged', roomPlayers: '3–10', roomBlurb: 'The card game for terrible people', sticker: '18+' },
  { id: 'prompts', title: 'Party Prompts', emoji: '🃏', blurb: 'Truths, dares and “most likely to”, with your names on every card.', time: '15–45 min', players: '2–16', color: '#ff5a6c', onePhone: true, room: null },
  { id: 'nhie', title: 'Never Have I Ever', emoji: '🙊', blurb: 'Five fingers up, reveal together. Last one standing wins.', time: '10–30 min', players: '3–16', color: '#a45cff', onePhone: true, room: 'nhie', roomPlayers: '3–16', roomBlurb: 'Answer in secret, reveal together' },
  { id: 'charades', title: 'Charades', emoji: '🎭', blurb: 'Act, describe, draw it, or play heads up with the phone on your forehead.', time: '10–30 min', players: '3–16', color: '#ff8a1f', onePhone: true, room: null },
  { id: 'board', title: 'Dice Adventure', emoji: '🎲', blurb: 'Roll, race and dodge the nasty slides.', time: '10–35 min', players: '2–8', color: '#2fd1a0', onePhone: true, room: 'board', roomPlayers: '2–8', roomBlurb: 'One board on every phone, roll on your turn' },
  { id: 'auction', title: 'Name Your Price', emoji: '🔨', blurb: 'Bid play money and build the best collection.', time: '15–30 min', players: '2–8', color: '#ffb020', onePhone: true, room: 'auction', roomPlayers: '2–8', roomBlurb: 'Bid from your own phone' },
  { id: 'rps', title: 'Rock Paper Scissors', emoji: '✊', blurb: 'Everyone throws in secret, all hands revealed at once. Last hand standing wins.', time: '2–10 min', players: '2–12', color: '#3d7bff', onePhone: false, room: 'rps', roomPlayers: '2–12', roomBlurb: 'Everyone throws at once. Last hand standing' },
];

export const PARTY_IDS = PARTY_GAMES.map((g) => g.id);
export const isPartyId = (v: unknown): v is PartyGameId => typeof v === 'string' && (PARTY_IDS as string[]).includes(v);

/** Featured when no admin has chosen: the two big ones. */
export const DEFAULT_FEATURED: PartyGameId[] = ['impostor', 'unhinged'];
