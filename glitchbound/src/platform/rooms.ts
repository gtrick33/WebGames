/**
 * Live rooms in the browser (Crass Act and the Party Mode games): creating one, checking one exists, and the live
 * connection. The rooms themselves run on the glitchbound-rooms worker (rooms/worker.ts).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { track } from './analytics';
import { playerKey } from './challenges';

export type Connection = 'connecting' | 'open' | 'reconnecting' | 'gone';

export type RoomGame = 'crass-act' | 'impostor' | 'nhie' | 'auction' | 'board' | 'rps' | 'dial' | 'unique' | 'hues' | 'drag' | 'belot' | 'backgammon' | 'scribble' | 'sigilfall' | 'crater-crew';

/** Rooms that belong to an arcade game (not Party Mode): the game page that opens them. */
export const GAME_ROOM_PAGE: Partial<Record<RoomGame, string>> = { 'crass-act': '/games/crass-act', drag: '/games/launch-control', belot: '/games/belot', backgammon: '/games/backgammon', sigilfall: '/games/sigilfall', 'crater-crew': '/games/crater-crew' };

/** Creates a room for a game on the server; returns its code. A public (`listed`) room shows in the room list and quick match. */
export async function createRoom(game: RoomGame = 'crass-act', listed = false): Promise<string> {
  const res = await fetch('/api/rooms', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ game, listed }) });
  const data = (await res.json().catch(() => ({}))) as { code?: string; error?: string };
  if (!res.ok || !data.code) throw new Error(data.error === 'rooms_unavailable' ? 'Rooms are not available right now. Try again in a minute.' : 'Could not open a room. Try again.');
  track('room_open', { room: game });
  return data.code;
}

/** A public room in the room list. */
export interface ListedRoom {
  code: string;
  game: RoomGame;
  phase: string;
  players: number;
  max: number;
  host: string;
  full: boolean;
  /** Opened by quick match. */
  matched: boolean;
}

/** Public rooms with a free seat (one game's, or every game's). Throws when rooms are unavailable. */
export async function listRooms(game?: RoomGame): Promise<ListedRoom[]> {
  const res = await fetch(`/api/rooms${game ? `?game=${game}` : ''}`, { cache: 'no-store' }).catch(() => null);
  const data = (await res?.json().catch(() => ({}))) as { rooms?: ListedRoom[] } | undefined;
  if (!res?.ok || !Array.isArray(data?.rooms)) throw new Error('The room list is not available right now. Try again in a minute.');
  return data.rooms;
}

/** Quick match: the code of a public room about to start (or a new one, held for the next searcher). `skip`: rooms found full. */
export async function quickMatch(game: RoomGame, skip: readonly string[] = []): Promise<{ code: string; created: boolean }> {
  const res = await fetch('/api/rooms/match', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ game, skip }) }).catch(() => null);
  const data = (await res?.json().catch(() => ({}))) as { code?: string; created?: boolean; error?: string } | undefined;
  if (!res?.ok || !data?.code) throw new Error('Matchmaking is not available right now. Try again in a minute.');
  track('room_match', { room: game, created: data.created ? 1 : 0 });
  return { code: data.code, created: data.created === true };
}

/** How the room is listed: public (in the room list), opened by quick match, and when a quick-match room starts by itself. */
export interface RoomListing {
  listed: boolean;
  matched: boolean;
  startAt: number | null;
}

/** Whether a room exists (before connecting to it). */
export async function roomInfo(code: string): Promise<{ players: number; host: string; full: boolean; phase: string; game?: RoomGame } | null> {
  const res = await fetch(`/api/rooms/${code}`, { cache: 'no-store' }).catch(() => null);
  return res?.ok ? ((await res.json()) as { players: number; host: string; full: boolean; phase: string; game?: RoomGame }) : null;
}

/**
 * A live connection to a room: the latest view of the game, and `send` for actions. Reconnects by
 * itself (with the same player key, so you keep your seat and cards). `View` and `Action` are the
 * room game's own types (see rooms/engines.ts).
 */
export function useRoom<View, Action>(code: string, name: string, onRelay?: (data: unknown) => void) {
  const [view, setView] = useState<View | null>(null);
  const [listing, setListing] = useState<RoomListing | null>(null);
  const relayRef = useRef(onRelay);
  const [conn, setConn] = useState<Connection>('connecting');
  const [error, setError] = useState('');
  const [gone, setGone] = useState('');
  const [skew, setSkew] = useState(0);
  const ws = useRef<WebSocket | null>(null);
  const nameRef = useRef(name);
  useEffect(() => {
    nameRef.current = name;
    relayRef.current = onRelay;
  });

  useEffect(() => {
    let stopped = false;
    let joined = false;
    let tries = 0;
    let retry = 0;
    let ping = 0;
    const connect = (): void => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const socket = new WebSocket(`${proto}://${location.host}/api/rooms/${code}/ws?key=${encodeURIComponent(playerKey())}&name=${encodeURIComponent(nameRef.current)}`);
      ws.current = socket;
      socket.onopen = () => {
        tries = 0;
        setConn('open');
        ping = window.setInterval(() => socket.readyState === WebSocket.OPEN && socket.send('ping'), 25_000);
      };
      socket.onmessage = (ev) => {
        if (typeof ev.data !== 'string' || ev.data === 'pong') return;
        try {
          const m = JSON.parse(ev.data) as { t: string; state?: View; now?: number; message?: string; reason?: string; room?: RoomListing; data?: unknown };
          if (m.t === 'relay') relayRef.current?.(m.data);
          else if (m.t === 'state' && m.state) {
            // Counted once per visit to a room (the admin's room stats), not on every reconnect.
            if (!joined) {
              joined = true;
              track('room_join', { room: (m.state as { game?: string }).game ?? 'crass-act' });
            }
            setView(m.state);
            if (m.room) setListing(m.room);
            if (m.now) setSkew(m.now - Date.now());
          } else if (m.t === 'error' && m.message) setError(m.message);
          else if (m.t === 'gone') {
            stopped = true;
            setGone(m.reason ?? 'The room has closed.');
          }
        } catch {
          /* ignore */
        }
      };
      socket.onclose = () => {
        window.clearInterval(ping);
        if (stopped) {
          setConn('gone');
          return;
        }
        setConn('reconnecting');
        retry = window.setTimeout(connect, Math.min(5000, 400 * 2 ** tries++));
      };
    };
    connect();
    return () => {
      stopped = true;
      window.clearTimeout(retry);
      window.clearInterval(ping);
      ws.current?.close();
    };
  }, [code]);

  const send = useCallback((a: Action) => {
    const s = ws.current;
    if (s?.readyState === WebSocket.OPEN) s.send(JSON.stringify(a));
  }, []);

  /** The host makes the room public or private. */
  const setListed = useCallback((listed: boolean) => {
    const s = ws.current;
    if (s?.readyState === WebSocket.OPEN) s.send(JSON.stringify({ t: '$listing', listed }));
  }, []);

  return { view, conn, error, clearError: () => setError(''), gone, skew, send, listing, setListed };
}
