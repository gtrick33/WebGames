/**
 * The games a live room can host (the party games, Crass Act, Launch Control's live races, Belot's and Backgammon's tables). Each engine is a set of pure functions over its own State, with
 * the same shape, so the room server does not need to know the rules. Rooms made before there was
 * more than one game have no `game` field: they are Crass Act.
 */
import * as backgammon from '../src/games/backgammon/room';
import * as belot from '../src/games/belot/room';
import * as crassAct from '../src/games/crass-act/engine';
import * as drag from '../src/games/launch-control/room';
import * as impostor from '../src/party/impostorRoom';
import * as auction from '../src/party/rooms/auctionRoom';
import * as board from '../src/party/rooms/boardRoom';
import * as dial from '../src/party/rooms/dialRoom';
import * as hues from '../src/party/rooms/huesRoom';
import * as nhie from '../src/party/rooms/nhieRoom';
import * as rps from '../src/party/rooms/rpsRoom';
import * as scribble from '../src/party/rooms/scribbleRoom';
import * as unique from '../src/party/rooms/uniqueRoom';
import * as sigilfall from '../src/games/sigilfall/net/room';
import * as craterCrew from '../src/games/crater-crew/room';

export type GameId = 'crass-act' | 'impostor' | 'nhie' | 'auction' | 'board' | 'rps' | 'dial' | 'unique' | 'hues' | 'drag' | 'belot' | 'backgammon' | 'scribble' | 'sigilfall' | 'crater-crew';

/** What every room engine provides (`State` stays opaque to the server). */
export interface Engine {
  newRoom(code: string, now: number, seed: number): RoomState;
  join(s: RoomState, key: string, name: string, now: number): string | null;
  leave(s: RoomState, key: string, now: number): void;
  tick(s: RoomState, now: number): void;
  act(s: RoomState, key: string, action: never, now: number): string | null;
  viewFor(s: RoomState, key: string): unknown;
  /**
   * Optional: actions that stream (a drawing's strokes) instead of changing what everyone's view shows.
   * Returns null for an ordinary action; otherwise the room sends `others` to everyone else and `self`
   * back to the sender as they are, without sending everyone a new view. `save`: worth storing now
   * (false: nothing in the state changed, so it is not stored at all).
   */
  relay?(s: RoomState, key: string, action: never, now: number): Relay | null;
  summary(s: RoomState): unknown;
  validKey(k: unknown): k is string;
  /** Optional: the largest message this game's players send (MAX_MESSAGE otherwise). */
  maxMessage?: number;
}

export interface Relay {
  others?: unknown;
  self?: unknown;
  save?: boolean;
}

/** The fields the server itself reads from any room. */
export interface RoomState {
  game?: string;
  updated: number;
  deadline: number | null;
  /** Every room seats players by their private key, one of them the host. */
  seats?: { key: string; n: number; online: boolean }[];
  host?: number;
}

export const ENGINES: Record<GameId, Engine> = {
  'crass-act': crassAct as unknown as Engine,
  impostor: impostor as unknown as Engine,
  nhie: nhie as unknown as Engine,
  auction: auction as unknown as Engine,
  board: board as unknown as Engine,
  rps: rps as unknown as Engine,
  dial: dial as unknown as Engine,
  unique: unique as unknown as Engine,
  hues: hues as unknown as Engine,
  drag: drag as unknown as Engine,
  belot: belot as unknown as Engine,
  backgammon: backgammon as unknown as Engine,
  scribble: scribble as unknown as Engine,
  sigilfall: sigilfall as unknown as Engine,
  'crater-crew': craterCrew as unknown as Engine,
};

/**
 * Public rooms and quick match: how many it takes to start, how many make a full game (a quick-match
 * room then starts in a few seconds), and how many seats quick match fills. `start: false`: the game
 * starts by itself when everyone is ready (Launch Control's races), so a quick-match room never needs
 * the host's Start.
 */
export const QUICK: Record<GameId, { min: number; full: number; seats: number; start?: false }> = {
  'crass-act': { min: 3, full: 6, seats: 10 },
  impostor: { min: 3, full: 6, seats: 12 },
  nhie: { min: 3, full: 6, seats: 16 },
  auction: { min: 2, full: 5, seats: 8 },
  board: { min: 2, full: 4, seats: 8 },
  rps: { min: 2, full: 6, seats: 12 },
  dial: { min: 2, full: 6, seats: 12 },
  unique: { min: 3, full: 6, seats: 10 },
  hues: { min: 2, full: 6, seats: 12 },
  drag: { min: 2, full: 2, seats: 2, start: false },
  // Empty places at the table are dealt to the computer.
  belot: { min: 2, full: 4, seats: 4 },
  backgammon: { min: 2, full: 2, seats: 2 },
  scribble: { min: 2, full: 6, seats: 10 },
  // a party of heroes: never matched with strangers (the game opens private rooms only)
  sigilfall: { min: 2, full: 4, seats: 4, start: false },
  'crater-crew': { min: 2, full: 4, seats: 8 },
};

export const isGameId = (v: unknown): v is GameId => typeof v === 'string' && Object.hasOwn(ENGINES, v);

export const engineFor = (s: RoomState): Engine => ENGINES[isGameId(s.game) ? s.game : 'crass-act'];
