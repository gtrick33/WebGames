/**
 * The games a live room can host. Each engine is a set of pure functions over its own State, with
 * the same shape, so the room server does not need to know the rules. Rooms made before there was
 * more than one game have no `game` field: they are Crass Act.
 */
import * as crassAct from '../src/games/crass-act/engine';
import * as impostor from '../src/party/impostorRoom';
import * as auction from '../src/party/rooms/auctionRoom';
import * as board from '../src/party/rooms/boardRoom';
import * as nhie from '../src/party/rooms/nhieRoom';
import * as rps from '../src/party/rooms/rpsRoom';

export type GameId = 'crass-act' | 'impostor' | 'nhie' | 'auction' | 'board' | 'rps';

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
};

export const isGameId = (v: unknown): v is GameId => typeof v === 'string' && Object.hasOwn(ENGINES, v);

export const engineFor = (s: RoomState): Engine => ENGINES[isGameId(s.game) ? s.game : 'crass-act'];
