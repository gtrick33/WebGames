/**
 * glitchbound-rooms: live rooms for Crass Act and the Party Mode games (see engines.ts). One Durable
 * Object per room code holds the game state and every player's WebSocket. Sockets hibernate between
 * messages, so idle rooms cost nothing; a room deletes itself after 3 hours without activity. The site reaches it through the ROOMS binding
 * (functions/api/rooms/*); this worker has no public URL.
 *
 * The same objects also carry friends' challenge updates (one object per challenge, named
 * "challenge:<id>"): pages watch it over a socket (/watch) and the site pokes it whenever the
 * challenge changes (/notify), instead of every open page asking the database every few seconds.
 * Watching keeps nothing in storage.
 */
import { engineFor, ENGINES, isGameId, type RoomState as State } from './engines';

interface Socket {
  send(message: string): void;
  close(code?: number, reason?: string): void;
  serializeAttachment(value: unknown): void;
  deserializeAttachment(): unknown;
}
interface Storage {
  get<T>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
  deleteAll(): Promise<void>;
  setAlarm(time: number): Promise<void>;
  deleteAlarm(): Promise<void>;
}
interface DurableState {
  storage: Storage;
  acceptWebSocket(ws: Socket, tags?: string[]): void;
  getWebSockets(tag?: string): Socket[];
  setWebSocketAutoResponse(pair: unknown): void;
}
declare const WebSocketPair: new () => { 0: Socket; 1: Socket };
declare const WebSocketRequestResponsePair: new (request: string, response: string) => unknown;

const IDLE_MS = 3 * 60 * 60 * 1000;
/** The idle-close alarm is rounded up to this, so it only needs rewriting every few minutes (each write is billed). */
const IDLE_STEP = 10 * 60 * 1000;
const MAX_MESSAGE = 2048;

/** A page watching a challenge (not a player in a room). */
const isWatcher = (ws: Socket): boolean => (ws.deserializeAttachment() as { watch?: boolean } | null)?.watch === true;

const json = (data: unknown, status = 200): Response => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export class Room {
  private state: State | null = null;
  private loaded = false;

  constructor(
    private readonly ctx: DurableState,
    _env: unknown,
  ) {
    // Keep-alive pings are answered without waking the room.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  private async load(): Promise<State | null> {
    if (!this.loaded) {
      this.state = (await this.ctx.storage.get<State>('state')) ?? null;
      this.loaded = true;
    }
    return this.state;
  }

  /** The alarm this object last set (forgotten when it hibernates or the alarm fires; then it is set again). */
  private alarmAt: number | null = null;

  private async save(s: State): Promise<void> {
    await this.ctx.storage.put('state', s);
    const at = Math.min(s.deadline ?? Infinity, Math.ceil((s.updated + IDLE_MS) / IDLE_STEP) * IDLE_STEP);
    if (at !== this.alarmAt) {
      await this.ctx.storage.setAlarm(at);
      this.alarmAt = at;
    }
  }

  private broadcast(s: State): void {
    const engine = engineFor(s);
    for (const ws of this.ctx.getWebSockets()) {
      const key = (ws.deserializeAttachment() as { key?: string } | null)?.key;
      const view = key ? engine.viewFor(s, key) : null;
      try {
        if (view) ws.send(JSON.stringify({ t: 'state', state: view, now: Date.now() }));
        else {
          ws.send(JSON.stringify({ t: 'gone', reason: 'You were removed from the room.' }));
          ws.close(4003, 'removed');
        }
      } catch {
        /* socket already closing */
      }
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const now = Date.now();
    if (url.pathname === '/init' && request.method === 'POST') {
      if (await this.load()) return json({ error: 'exists' }, 409);
      const code = url.searchParams.get('code') ?? '';
      const game = url.searchParams.get('game');
      const s = ENGINES[isGameId(game) ? game : 'crass-act'].newRoom(code, now, crypto.getRandomValues(new Uint32Array(1))[0]!);
      this.state = s;
      await this.save(s);
      return json(engineFor(s).summary(s));
    }
    if (url.pathname === '/info') {
      const s = await this.load();
      return s ? json(engineFor(s).summary(s)) : json({ error: 'not_found' }, 404);
    }
    if (url.pathname === '/watch') {
      if (request.headers.get('Upgrade') !== 'websocket') return json({ error: 'websocket_required' }, 426);
      const pair = new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1], ['watch']);
      pair[1].serializeAttachment({ watch: true });
      return new Response(null, { status: 101, webSocket: pair[0] } as ResponseInit);
    }
    if (url.pathname === '/notify' && request.method === 'POST') {
      const v = Number(url.searchParams.get('v')) || now;
      const watchers = this.ctx.getWebSockets('watch');
      for (const ws of watchers) {
        try {
          ws.send(JSON.stringify({ t: 'changed', v }));
        } catch {
          /* closing */
        }
      }
      return json({ ok: true, watchers: watchers.length });
    }
    if (url.pathname === '/ws') {
      if (request.headers.get('Upgrade') !== 'websocket') return json({ error: 'websocket_required' }, 426);
      const key = url.searchParams.get('key');
      if (!ENGINES['crass-act'].validKey(key)) return json({ error: 'bad_key' }, 400);
      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];
      this.ctx.acceptWebSocket(server, [key]);
      server.serializeAttachment({ key });
      const s = await this.load();
      const err = s ? engineFor(s).join(s, key, url.searchParams.get('name') ?? '', now) : 'not_found';
      if (!s || err) {
        server.send(JSON.stringify({ t: 'gone', reason: err === 'full' ? 'This room is full.' : 'This room has closed.' }));
        server.close(4004, err ?? 'gone');
      } else {
        await this.save(s);
        this.broadcast(s);
      }
      return new Response(null, { status: 101, webSocket: client } as ResponseInit);
    }
    return json({ error: 'not_found' }, 404);
  }

  async webSocketMessage(ws: Socket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string' || message.length > MAX_MESSAGE || isWatcher(ws)) return;
    const s = await this.load();
    const key = (ws.deserializeAttachment() as { key?: string } | null)?.key;
    if (!s || !key) return ws.close(4004, 'gone');
    let action: never;
    try {
      action = JSON.parse(message) as never;
    } catch {
      return;
    }
    const now = Date.now();
    const engine = engineFor(s);
    engine.tick(s, now);
    const err = engine.act(s, key, action, now);
    if (err) ws.send(JSON.stringify({ t: 'error', message: err }));
    await this.save(s);
    this.broadcast(s);
  }

  async webSocketClose(ws: Socket): Promise<void> {
    await this.disconnect(ws);
  }

  async webSocketError(ws: Socket): Promise<void> {
    await this.disconnect(ws);
  }

  private async disconnect(ws: Socket): Promise<void> {
    if (isWatcher(ws)) return;
    const s = await this.load();
    const key = (ws.deserializeAttachment() as { key?: string } | null)?.key;
    if (!s || !key) return;
    const others = this.ctx.getWebSockets(key).filter((x) => x !== ws);
    if (others.length > 0) return;
    engineFor(s).leave(s, key, Date.now());
    await this.save(s);
    this.broadcast(s);
  }

  async alarm(): Promise<void> {
    this.alarmAt = null;
    const s = await this.load();
    if (!s) return;
    const now = Date.now();
    if (now - s.updated >= IDLE_MS) {
      for (const ws of this.ctx.getWebSockets()) ws.close(4004, 'closed');
      await this.ctx.storage.deleteAll();
      this.state = null;
      return;
    }
    engineFor(s).tick(s, now);
    await this.save(s);
    this.broadcast(s);
  }
}

export default {
  fetch(): Response {
    return new Response('Not found', { status: 404 });
  },
};
