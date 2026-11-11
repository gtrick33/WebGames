/**
 * Live rooms in the browser (Crass Act and the Party Mode games): creating one, checking one exists, and the live
 * connection. The rooms themselves run on the glitchbound-rooms worker (rooms/worker.ts).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { track } from './analytics';
import { playerKey } from './challenges';

export type Connection = 'connecting' | 'open' | 'reconnecting' | 'gone';

export type RoomGame = 'crass-act' | 'impostor' | 'nhie' | 'auction' | 'board' | 'rps' | 'dial' | 'unique' | 'hues' | 'drag' | 'belot' | 'backgammon' | 'scribble' | 'sigilfall' | 'sigilfall-ring' | 'sigilfall-vigil' | 'crater-crew';

/** Rooms that belong to an arcade game (not Party Mode): the game page that opens them. */
export const GAME_ROOM_PAGE: Partial<Record<RoomGame, string>> = { 'crass-act': '/games/crass-act', drag: '/games/launch-control', belot: '/games/belot', backgammon: '/games/backgammon', sigilfall: '/games/sigilfall', 'sigilfall-ring': '/games/sigilfall', 'sigilfall-vigil': '/games/sigilfall', 'crater-crew': '/games/crater-crew' };

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

/**
 * Quick match: the code of a public room about to start (or a new one, held for the next searcher). `skip`: rooms
 * found full. `kind`: which of the game's queues (The Ring's '1', '2' and '3' for its formats).
 */
export async function quickMatch(game: RoomGame, skip: readonly string[] = [], kind = ''): Promise<{ code: string; created: boolean }> {
  const res = await fetch('/api/rooms/match', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(kind ? { game, skip, kind } : { game, skip }) }).catch(() => null);
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

/** Why a room sent you away: 'full', 'kicked', 'replaced' (open in another tab) or 'closed'. */
export type GoneCode = 'full' | 'kicked' | 'replaced' | 'closed';

/** A drop shorter than this never shows as "Reconnecting…" (a phone switching networks, a tab coming back). */
export const RECONNECT_QUIET_MS = 2500;

const SEATED_KEY = 'gb-room-seats';
/** How long a reload brings you straight back into a room you were in (under the same name). */
export const SEATED_MS = 12 * 60 * 60 * 1000;

/** Remembers the name you sat down with in a room, so a reload of `?room=` takes you back in without asking. */
export function rememberSeat(code: string, name: string, now = Date.now()): void {
  try {
    const all = JSON.parse(localStorage.getItem(SEATED_KEY) ?? '{}') as Record<string, { name: string; at: number }>;
    for (const [c, v] of Object.entries(all)) if (!v || now - v.at > SEATED_MS) delete all[c];
    all[code] = { name, at: now };
    localStorage.setItem(SEATED_KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable: a reload asks for the name again */
  }
}

/** The name you were seated under in this room lately, or null. */
export function seatedName(code: string, now = Date.now()): string | null {
  try {
    const v = (JSON.parse(localStorage.getItem(SEATED_KEY) ?? '{}') as Record<string, { name?: unknown; at?: unknown }>)[code];
    return v && typeof v.name === 'string' && v.name.trim() && typeof v.at === 'number' && now - v.at <= SEATED_MS ? v.name : null;
  } catch {
    return null;
  }
}

/**
 * The action to send again once the socket is back: the last one sent while it was down (it never left the
 * page), or one sent with `resend` that the room has not confirmed yet. Rooms ignore an action that comes
 * too late (a turn already passed), so sending it again is safe; a plain action is sent at most once.
 */
export class Outbox<Action> {
  private nextId = 1;
  private waiting: { action: Action; id?: number } | null = null;

  /** What to put on the wire for `a` now (null: hold it for the reconnect). */
  send(a: Action, open: boolean, resend = false): string | null {
    const id = resend ? this.nextId++ : undefined;
    const wire = JSON.stringify(id === undefined ? a : { ...a, $id: id });
    if (!open || resend) this.waiting = { action: a, id };
    else this.waiting = null;
    return open ? wire : null;
  }

  /** The room confirmed action `id`. */
  ack(id: number): void {
    if (this.waiting?.id === id) this.waiting = null;
  }

  /** What to send on a fresh connection (once; a `resend` action stays until confirmed). */
  flush(): string | null {
    const w = this.waiting;
    if (!w) return null;
    if (w.id === undefined) this.waiting = null;
    return JSON.stringify(w.id === undefined ? w.action : { ...w.action, $id: w.id });
  }

  clear(): void {
    this.waiting = null;
  }
}

/**
 * Quick match sent you to a room that filled up first: the address of another one (skipping the full ones),
 * or null when this page wasn't opened by quick match (or no other room could be found).
 */
export async function rematchUrl(code: string, href: string): Promise<string | null> {
  const url = new URL(href);
  if (url.searchParams.get('match') !== '1' || url.searchParams.get('room') !== code) return null;
  const skip = [...new Set([...(url.searchParams.get('skip') ?? '').split(',').filter(Boolean), code])];
  if (skip.length > 5) return null;
  const info = await roomInfo(code);
  try {
    const found = await quickMatch(info?.game ?? 'crass-act', skip);
    url.searchParams.set('room', found.code);
    url.searchParams.set('skip', skip.join(','));
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * A live connection to a room: the latest view of the game, and `send` for actions. Reconnects by
 * itself (with the same player key, so you keep your seat and cards); a short drop doesn't show, and an
 * action sent meanwhile goes out once the connection is back (`send(a, { resend: true })` also re-sends
 * one the room may not have received). `View` and `Action` are the room game's own types (see rooms/engines.ts).
 */
export function useRoom<View, Action>(code: string, name: string, onRelay?: (data: unknown) => void) {
  const [view, setView] = useState<View | null>(null);
  const [listing, setListing] = useState<RoomListing | null>(null);
  const relayRef = useRef(onRelay);
  const [conn, setConn] = useState<Connection>('connecting');
  const [error, setError] = useState('');
  const [gone, setGone] = useState('');
  const [goneCode, setGoneCode] = useState<GoneCode | ''>('');
  const outbox = useRef(new Outbox<Action>());
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
    const box = outbox.current;
    let quiet = 0;
    const connect = (): void => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const socket = new WebSocket(`${proto}://${location.host}/api/rooms/${code}/ws?key=${encodeURIComponent(playerKey())}&name=${encodeURIComponent(nameRef.current)}`);
      ws.current = socket;
      socket.onopen = () => {
        tries = 0;
        window.clearTimeout(quiet);
        quiet = 0;
        setConn('open');
        ping = window.setInterval(() => socket.readyState === WebSocket.OPEN && socket.send('ping'), 25_000);
        const again = box.flush();
        if (again) socket.send(again);
      };
      socket.onmessage = (ev) => {
        if (typeof ev.data !== 'string' || ev.data === 'pong') return;
        try {
          const m = JSON.parse(ev.data) as { t: string; state?: View; now?: number; message?: string; reason?: string; code?: string; id?: number; room?: RoomListing; data?: unknown };
          if (m.t === 'relay') relayRef.current?.(m.data);
          else if (m.t === 'ack' && typeof m.id === 'number') box.ack(m.id);
          else if (m.t === 'state' && m.state) {
            // Counted once per visit to a room (the admin's room stats), not on every reconnect.
            if (!joined) {
              joined = true;
              track('room_join', { room: (m.state as { game?: string }).game ?? 'crass-act' });
              if (nameRef.current.trim()) rememberSeat(code, nameRef.current.trim());
            }
            setView(m.state);
            if (m.room) setListing(m.room);
            if (m.now) setSkew(m.now - Date.now());
          } else if (m.t === 'error' && m.message) setError(m.message);
          else if (m.t === 'gone') {
            stopped = true;
            box.clear();
            const why = (['full', 'kicked', 'replaced'] as const).find((c) => c === m.code) ?? 'closed';
            const show = (): void => {
              setGoneCode(why);
              setGone(m.reason ?? 'The room has closed.');
            };
            // quick match lost a race for the last seat: on to another room
            if (why === 'full')
              void rematchUrl(code, location.href).then(
                (next) => (next ? location.replace(next) : show()),
                show,
              );
            else show();
          }
        } catch {
          /* ignore */
        }
      };
      socket.onclose = () => {
        window.clearInterval(ping);
        if (stopped) {
          window.clearTimeout(quiet);
          setConn('gone');
          return;
        }
        // shown only once the drop has lasted a moment (not reset by each retry)
        if (!quiet) quiet = window.setTimeout(() => setConn('reconnecting'), RECONNECT_QUIET_MS);
        retry = window.setTimeout(connect, Math.min(5000, 400 * 2 ** tries++));
      };
    };
    connect();
    return () => {
      stopped = true;
      window.clearTimeout(retry);
      window.clearTimeout(quiet);
      window.clearInterval(ping);
      box.clear();
      ws.current?.close();
    };
  }, [code]);

  const send = useCallback((a: Action, opts?: { resend?: boolean }) => {
    const s = ws.current;
    const open = s?.readyState === WebSocket.OPEN;
    const wire = outbox.current.send(a, open, opts?.resend === true);
    if (wire && open) s!.send(wire);
  }, []);

  /** The host makes the room public or private. */
  const setListed = useCallback((listed: boolean) => {
    const s = ws.current;
    if (s?.readyState === WebSocket.OPEN) s.send(JSON.stringify({ t: '$listing', listed }));
  }, []);

  return { view, conn, error, clearError: () => setError(''), gone, goneCode, skew, send, listing, setListed };
}
