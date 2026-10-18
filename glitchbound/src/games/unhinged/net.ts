import { useCallback, useEffect, useRef, useState } from 'react';
import { playerKey } from '../../platform/challenges';
import type { Action, RoomView } from './engine';

export type Connection = 'connecting' | 'open' | 'reconnecting' | 'gone';

/** Creates a room on the server; returns its code. */
export async function createRoom(): Promise<string> {
  const res = await fetch('/api/rooms', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  const data = (await res.json().catch(() => ({}))) as { code?: string; error?: string };
  if (!res.ok || !data.code) throw new Error(data.error === 'rooms_unavailable' ? 'Rooms are not available right now. Try again in a minute.' : 'Could not open a room. Try again.');
  return data.code;
}

/** Whether a room exists (before connecting to it). */
export async function roomInfo(code: string): Promise<{ players: number; host: string; full: boolean; phase: string } | null> {
  const res = await fetch(`/api/rooms/${code}`, { cache: 'no-store' }).catch(() => null);
  return res?.ok ? ((await res.json()) as { players: number; host: string; full: boolean; phase: string }) : null;
}

/**
 * A live connection to a room: the latest view of the game, and `send` for actions. Reconnects by
 * itself (with the same player key, so you keep your seat and cards).
 */
export function useRoom(code: string, name: string) {
  const [view, setView] = useState<RoomView | null>(null);
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
          const m = JSON.parse(ev.data) as { t: string; state?: RoomView; now?: number; message?: string; reason?: string };
          if (m.t === 'state' && m.state) {
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
