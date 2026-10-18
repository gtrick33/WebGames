/** Unhinged's live room connection: the shared room client (platform/rooms.ts) with Unhinged's types. */
import { createRoom as create, roomInfo, useRoom as useAnyRoom } from '../../platform/rooms';
import type { Action, RoomView } from './engine';

export type { Connection } from '../../platform/rooms';
export { roomInfo };

export const createRoom = (): Promise<string> => create('unhinged');

export const useRoom = (code: string, name: string) => useAnyRoom<RoomView, Action>(code, name);
