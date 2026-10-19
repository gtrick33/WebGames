/**
 * The Party Mode line-up: every party game, how it can be played (one phone passed around, a live
 * room with everyone on their own phone, or both) and its card text. The party page and the admin's
 * Party view both read this list; admins can hide, feature or relabel a game (src/catalog/settings.ts).
 */
export type PartyGameId = 'impostor' | 'prompts' | 'nhie' | 'charades' | 'board' | 'auction' | 'rps' | 'crass-act' | 'dial' | 'unique' | 'hues';
export type PartyRoomGame = 'impostor' | 'nhie' | 'auction' | 'board' | 'rps' | 'crass-act' | 'dial' | 'unique' | 'hues';

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
  /** Adults only: shows the "18+ Adults only" label wherever it is listed (see AdultLabel). */
  adult?: boolean;
  /**
   * Its logo, drawn like the arcade games' art: a square tile (room list, featured card, search) and a
   * wide strip for the game picker, under public/party/<id>/. Crass Act uses its arcade art instead.
   */
  art?: { tile: string; wide: string };
}

const art = (id: PartyGameId): { tile: string; wide: string } => ({ tile: `/party/${id}/tile.webp`, wide: `/party/${id}/wide.webp` });

export const PARTY_GAMES: PartyGame[] = [
  { id: 'impostor', title: 'Impostor', emoji: '🕵️', blurb: 'Everyone gets the secret word, except one. Say one word each, then vote out the faker.', time: '10–40 min', players: '3–16', color: '#7b4dff', onePhone: true, room: 'impostor', roomPlayers: '3–12', roomBlurb: 'Secret cards on each phone', sticker: 'New', art: art('impostor') },
  { id: 'crass-act', title: 'Crass Act', emoji: '😈', blurb: 'Fill in the blank with the rudest card in your hand. The funniest answer wins the round.', time: '15–45 min', players: '3–10', color: '#ff5a6c', onePhone: false, room: 'crass-act', roomPlayers: '3–10', roomBlurb: 'Fill-in-the-blank cards for adults', adult: true },
  { id: 'prompts', title: 'Party Prompts', emoji: '🃏', blurb: 'Truths, dares and “most likely to”, with your names on every card.', time: '15–45 min', players: '2–16', color: '#ff5a6c', onePhone: true, room: null, art: art('prompts') },
  { id: 'nhie', title: 'Never Have I Ever', emoji: '🙊', blurb: 'Five fingers up, reveal together. Last one standing wins.', time: '10–30 min', players: '3–16', color: '#a45cff', onePhone: true, room: 'nhie', roomPlayers: '3–16', roomBlurb: 'Answer in secret, reveal together', art: art('nhie') },
  { id: 'charades', title: 'Charades', emoji: '🎭', blurb: 'Act, describe, draw it, or hold the phone to your forehead and guess.', time: '10–30 min', players: '3–16', color: '#ff8a1f', onePhone: true, room: null, art: art('charades') },
  { id: 'dial', title: 'Dial It In', emoji: '📻', blurb: 'One player sees where the secret spot is on the dial and gives one clue. Can the group tune in?', time: '15–30 min', players: '2–16', color: '#14b8a6', onePhone: true, room: 'dial', roomPlayers: '2–16', roomBlurb: 'One clue, everyone turns the needle', sticker: 'New', art: art('dial') },
  { id: 'unique', title: 'One of a Kind', emoji: '🦄', blurb: 'Everyone gives a one-word clue, but matching clues cancel out. Can the guesser still get it?', time: '15–25 min', players: '3–10', color: '#f59e0b', onePhone: true, room: 'unique', roomPlayers: '3–10', roomBlurb: 'Everyone writes their clue at once', sticker: 'New', art: art('unique') },
  { id: 'hues', title: 'Hue Knew?', emoji: '🎨', blurb: 'Describe a secret color in one word. Whoever taps closest on the color board scores.', time: '15–30 min', players: '3–10', color: '#ec4899', onePhone: true, room: 'hues', roomPlayers: '2–12', roomBlurb: 'Tap your guess in secret, reveal together', sticker: 'New', art: art('hues') },
  { id: 'board', title: 'Dice Adventure', emoji: '🎲', blurb: 'Roll, race and dodge the nasty slides.', time: '10–35 min', players: '2–8', color: '#2fd1a0', onePhone: true, room: 'board', roomPlayers: '2–8', roomBlurb: 'One board on every phone, roll on your turn', art: art('board') },
  { id: 'auction', title: 'Name Your Price', emoji: '🔨', blurb: 'Bid play money and build the best collection.', time: '15–30 min', players: '2–8', color: '#ffb020', onePhone: true, room: 'auction', roomPlayers: '2–8', roomBlurb: 'Bid from your own phone', art: art('auction') },
  { id: 'rps', title: 'Rock Paper Scissors', emoji: '✊', blurb: 'Everyone throws in secret, all hands revealed at once. Last hand standing wins.', time: '2–10 min', players: '2–12', color: '#3d7bff', onePhone: false, room: 'rps', roomPlayers: '2–12', roomBlurb: 'Everyone throws at once. Last hand standing', art: art('rps') },
];

export const PARTY_IDS = PARTY_GAMES.map((g) => g.id);
export const isPartyId = (v: unknown): v is PartyGameId => typeof v === 'string' && (PARTY_IDS as string[]).includes(v);

/** Featured when no admin has chosen: the two big ones. */
export const DEFAULT_FEATURED: PartyGameId[] = ['impostor', 'crass-act'];
