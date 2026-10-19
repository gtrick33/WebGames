/**
 * Live rooms in the browser (Crass Act and the Party Mode games): creating one, checking one exists, and the live
 * connection. The rooms themselves run on the glitchbound-rooms worker (rooms/worker.ts).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { track } from './analytics';
import { playerKey } from './challenges';

export type Connection = 'connecting' | 'open' | 'reconnecting' | 'gone';

export type RoomGame = 'crass-act' | 'impostor' | 'nhie' | 'auction' | 'board' | 'rps' | 'dial' | 'unique' | 'hues';

/** Creates a room for a game on the server; returns its code. */
export async function createRoom(game: RoomGame = 'crass-act'): Promise<string> {
  const res = await fetch('/api/rooms', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ game }) });
  const data = (await res.json().catch(() => ({}))) as { code?: string; error?: string };
  if (!res.ok || !data.code) throw new Error(data.error === 'rooms_unavailable' ? 'Rooms are not available right now. Try again in a minute.' : 'Could not open a room. Try again.');
  track('room_open', { room: game });
  return data.code;
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
export function useRoom<View, Action>(code: string, name: string) {
  const [view, setView] = useState<View | null>(null);
  const [conn, setConn] = useState<Connection>('connecting');
  const [error, setError] = useState('');
  const [gone, setGone] = useState('');
  const [skew, setSkew] = useState(0);
  const ws = useRef<WebSocket | null>(null);
  const nameRef = useRef(name);
  useEffect(() => {
    nameRef.current = name;
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
          const m = JSON.parse(ev.data) as { t: string; state?: View; now?: number; message?: string; reason?: string };
          if (m.t === 'state' && m.state) {
            // Counted once per visit to a room (the admin's room stats), not on every reconnect.
            if (!joined) {
              joined = true;
              track('room_join', { room: (m.state as { game?: string }).game ?? 'crass-act' });
            }
            setView(m.state);
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

  return { view, conn, error, clearError: () => setError(''), gone, skew, send };
}
