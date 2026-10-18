/**
 * The games a live room can host. Each engine is a set of pure functions over its own State, with
 * the same shape, so the room server does not need to know the rules. Rooms made before there was
 * more than one game have no `game` field: they are Unhinged.
 */
import * as unhinged from '../src/games/unhinged/engine';
import * as impostor from '../src/party/impostorRoom';

export type GameId = 'unhinged' | 'impostor';

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
  unhinged: unhinged as unknown as Engine,
  impostor: impostor as unknown as Engine,
};

export const isGameId = (v: unknown): v is GameId => v === 'unhinged' || v === 'impostor';

export const engineFor = (s: RoomState): Engine => ENGINES[s.game === 'impostor' ? 'impostor' : 'unhinged'];
