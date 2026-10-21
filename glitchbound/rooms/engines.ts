/**
 * The games a live room can host (the party games, Crass Act, Launch Control's live races and Belot's tables). Each engine is a set of pure functions over its own State, with
 * the same shape, so the room server does not need to know the rules. Rooms made before there was
 * more than one game have no `game` field: they are Crass Act.
 */
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
import * as unique from '../src/party/rooms/uniqueRoom';

export type GameId = 'crass-act' | 'impostor' | 'nhie' | 'auction' | 'board' | 'rps' | 'dial' | 'unique' | 'hues' | 'drag' | 'belot';

/** What every room engine provides (`State` stays opaque to the server). */
export interface Engine {
  newRoom(code: string, now: number, seed: number): RoomState;
  join(s: RoomState, key: string, name: string, now: number): string | null;
  leave(s: RoomState, key: string, now: number): void;
  tick(s: RoomState, now: number): void;
  act(s: RoomState, key: string, action: never, now: number): string | null;
  viewFor(s: RoomState, key: string): unknown;
  summary(s: RoomState): unknown;
  validKey(k: unknown): k is string;
}

/** The fields the server itself reads from any room. */
export interface RoomState {
  game?: string;
  updated: number;
  deadline: number | null;
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
};

export const isGameId = (v: unknown): v is GameId => typeof v === 'string' && Object.hasOwn(ENGINES, v);

export const engineFor = (s: RoomState): Engine => ENGINES[isGameId(s.game) ? s.game : 'crass-act'];
