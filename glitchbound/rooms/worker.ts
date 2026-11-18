/**
 * glitchbound-rooms: live rooms for Crass Act and the Party Mode games (see engines.ts). One Durable
 * Object per room code holds the game state and every player's WebSocket. Sockets hibernate between
 * messages, so idle rooms cost nothing; a room deletes itself after 3 hours without activity. The site reaches it through the ROOMS binding
 * (functions/api/rooms/*); this worker has no public URL.
 *
 * Public rooms: a room opened public reports its players and phase to one more object, "lobby"
 * (lobby.ts), whenever they change, so others can find it in the room list or by quick match. The host
 * can make it private (or public again) from the room. A room quick match opened starts by itself once
 * enough have joined (QUICK in engines.ts), since nobody there has agreed on a host yet.
 *
 * The same objects also carry friends' challenge updates (one object per challenge, named
 * "challenge:<id>"): pages watch it over a socket (/watch) and the site pokes it whenever the
 * challenge changes (/notify), instead of every open page asking the database every few seconds.
 * Watching keeps nothing in storage.
 */
import { engineFor, ENGINES, isGameId, QUICK, type GameId, type RoomState as State } from './engines';
import * as lobbyList from './lobby';
import { alarmTime, IDLE_MS, REPLACED, refusal, relayKeepAlive, SHARED_KEY } from './live';
import { dropAway, type RoomBase } from '../src/party/rooms/seats';
import { roster as ringRoster, type State as RingState } from '../src/games/sigilfall/net/ringRoom';

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
interface Namespace {
  idFromName(name: string): unknown;
  get(id: unknown): { fetch(url: string, init?: RequestInit): Promise<Response> };
}
interface RoomsEnv {
  ROOM?: Namespace;
}
declare const WebSocketPair: new () => { 0: Socket; 1: Socket };
declare const WebSocketRequestResponsePair: new (request: string, response: string) => unknown;

const MAX_MESSAGE = 2048;
/** A quick-match room starts this long after it has enough players, or FULL_START_MS once it is full. */
const QUICK_START_MS = 20_000;
const FULL_START_MS = 5_000;
/** Streamed actions (strokes) are stored at most this often, besides when the engine asks. */
const RELAY_SAVE_MS = 2_000;

/** How a room is listed (kept beside the game state; the engines never see it). */
interface Listing {
  /** Shown in the public room list and found by quick match. */
  listed: boolean;
  /** Opened by quick match: starts by itself. */
  matched: boolean;
  /** When a quick-match room starts by itself. */
  startAt: number | null;
  /** Which of its game's queues quick match opened it for (lobby.ts `kind`). */
  kind?: string;
  /**
   * A ranked room's door key (The Ring): while it waits for players, only those quick match sent here (who were told
   * the key with the code) can take a new seat in it. A code passed around by hand doesn't open it.
   */
  door?: string;
  /** In the queue because a party put it there (the Ring's `queue` action), not opened by quick match. */
  queued?: boolean;
}
const NOT_LISTED: Listing = { listed: false, matched: false, startAt: null };

/** Who a seat's player is, as the site told the room when they connected (functions/api/rooms/[code]/ws.ts). */
interface Who {
  uid: string;
  net: string;
}
const cleanUid = (v: string | null): string => (v && /^[A-Za-z0-9_-]{1,64}$/.test(v) ? v : '');
const cleanNet = (v: string | null): string => (v && /^[0-9a-f]{8,32}$/.test(v) ? v : '');
/** The Ring's run as it began: its roster, with each seat's account and network (server/ring.ts reads it). */
interface RingRun {
  run: number;
  seed: number;
  format: number;
  at: number;
  ranked: boolean;
  seats: { n: number; team: 0 | 1; uid: string; net: string; party: boolean }[];
  /** When each seat last dropped out while the run went (gone from the room, or its connection lost), by seat. */
  left: Record<string, number>;
}
const newDoor = (): string => [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(16).padStart(2, '0')).join('');

const ROOM_CODE = 'ABCDEFGHJKMNPQRSTUVWXYZ';
const newCode = (): string => [...crypto.getRandomValues(new Uint8Array(5))].map((b) => ROOM_CODE[b % ROOM_CODE.length]).join('');

/** A page watching a challenge (not a player in a room). */
const isWatcher = (ws: Socket): boolean => (ws.deserializeAttachment() as { watch?: boolean } | null)?.watch === true;

const json = (data: unknown, status = 200): Response => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export class Room {
  private state: State | null = null;
  private listing: Listing = NOT_LISTED;
  private loaded = false;

  constructor(
    private readonly ctx: DurableState,
    private readonly env: RoomsEnv,
  ) {
    // Keep-alive pings are answered without waking the room.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  private async load(): Promise<State | null> {
    if (!this.loaded) {
      this.state = (await this.ctx.storage.get<State>('state')) ?? null;
      this.listing = (await this.ctx.storage.get<Listing>('listing')) ?? NOT_LISTED;
      this.loaded = true;
    }
    return this.state;
  }

  /** Each seat key's account and network (The Ring's ranked matches), kept as players connect. */
  private ids: Record<string, Who> | null = null;
  private async who(): Promise<Record<string, Who>> {
    return (this.ids ??= (await this.ctx.storage.get<Record<string, Who>>('ids')) ?? {});
  }

  /**
   * The Ring: a run that has just begun keeps its roster, accounts and networks with it, for the ranked ladder; and a
   * room a party put in the ranked queue is listed for quick match while it waits (and only then), behind a door key.
   */
  private async syncRing(s: State, runBefore: number, now: number): Promise<void> {
    if (s.game !== 'sigilfall-ring') return;
    const r = s as unknown as RingState;
    if (r.run !== runBefore && r.phase === 'run') {
      const ids = await this.who();
      const run: RingRun = {
        run: r.run,
        seed: r.runSeed,
        format: r.format,
        at: now,
        ranked: this.listing.matched || !!r.ranked,
        seats: ringRoster(r).map((x) => ({ n: x.n, team: x.team, uid: ids[x.key]?.uid ?? '', net: ids[x.key]?.net ?? '', party: x.party })),
        left: {},
      };
      await this.ctx.storage.put('ringRun', run);
    } else if (r.phase === 'run') {
      // while it goes: who has dropped out of it, and when (the ranked ladder takes its leavers from this, not from
      // anyone's word); a player back on their seat is taken off again
      const run = await this.ctx.storage.get<RingRun>('ringRun');
      if (run && run.run === r.run) {
        const left = { ...(run.left ?? {}) };
        for (const x of run.seats) {
          const on = r.seats.some((y) => y.n === x.n && y.online);
          if (on) delete left[x.n];
          else left[x.n] ??= now;
        }
        if (JSON.stringify(left) !== JSON.stringify(run.left ?? {})) await this.ctx.storage.put('ringRun', { ...run, left });
      }
    }
    // (a room quick match opened keeps its listing as it is: only a party's own room is put in and taken out)
    if (this.listing.matched && !this.listing.queued) return;
    const wanted = !!r.queue && r.phase === 'lobby';
    if (wanted === !!this.listing.queued) return;
    await this.setListing(wanted ? { listed: true, matched: true, startAt: null, kind: r.queue!.kind, door: newDoor(), queued: true } : NOT_LISTED);
    if (!wanted) this.reported ||= 'listed';
  }

  /** The alarm this object last set (forgotten when it hibernates or the alarm fires; then it is set again). */
  private alarmAt: number | null = null;

  private savedAt = 0;

  private async save(s: State): Promise<void> {
    this.schedule(s, Date.now());
    await this.ctx.storage.put('state', s);
    this.savedAt = Date.now();
    const at = alarmTime(s, this.listing.startAt);
    if (at !== this.alarmAt) {
      await this.ctx.storage.setAlarm(at);
      this.alarmAt = at;
    }
    await this.report(s);
  }

  private async setListing(l: Listing): Promise<void> {
    this.listing = l;
    await this.ctx.storage.put('listing', l);
  }

  /** A quick-match room counts down once enough are in the lobby (and stops if they leave). */
  private schedule(s: State, now: number): void {
    const l = this.listing;
    const rule = QUICK[(isGameId(s.game) ? s.game : 'crass-act') as GameId];
    if (!l.matched || rule.start === false) return;
    const sum = engineFor(s).summary(s) as { phase: string; players: number };
    const startAt = sum.phase !== 'lobby' || sum.players < rule.min ? null : sum.players >= rule.full ? Math.min(l.startAt ?? Infinity, now + FULL_START_MS) : (l.startAt ?? now + QUICK_START_MS);
    if (startAt !== l.startAt) {
      this.listing = { ...l, startAt };
      void this.ctx.storage.put('listing', this.listing);
    }
  }

  /** What the lobby last heard from this room ('' = nothing yet, or forgotten on hibernation: then it is told again). */
  private reported = '';

  /**
   * Tells the lobby about a public room whenever its players or phase change (an empty one is let go
   * there, unless quick match is still holding it), and that it is gone once private or closed.
   */
  private async report(s: State, closed = false): Promise<void> {
    if (!this.env.ROOM) return;
    const sum = engineFor(s).summary(s) as { code: string; phase: string; players: number; host: string; full: boolean; game?: string; max?: number };
    const game = (sum.game ?? 'crass-act') as GameId;
    // the room's real size (quick match fills QUICK.seats of it; engines without `max` seat exactly that)
    // (a party in the Ring's queue says the rating it searches at, how many it is and since when, and its door key)
    const q = this.listing.queued ? (s as unknown as RingState).queue : null;
    const party = q ? { mmr: q.mmr, rated: Math.max(1, (s as unknown as RingState).party?.length ?? 1), since: q.since } : {};
    const entry = !closed && this.listing.listed ? { code: sum.code, game, phase: sum.phase, players: sum.players, max: sum.max ?? QUICK[game].seats, host: sum.host, full: sum.full, matched: this.listing.matched, ...(this.listing.kind ? { kind: this.listing.kind } : {}), ...(this.listing.door ? { door: this.listing.door } : {}), ...party } : null;
    const sig = entry ? JSON.stringify(entry) : 'off';
    if (sig === this.reported) return;
    // A private room the lobby never heard of has nothing to take back.
    const tell = entry !== null || this.reported !== '' || (closed && this.listing.listed);
    this.reported = sig;
    if (!tell) return;
    const lobby = this.env.ROOM.get(this.env.ROOM.idFromName('lobby'));
    await lobby
      .fetch(entry ? 'https://room/lobby/put' : `https://room/lobby/drop?code=${sum.code}`, { method: 'POST', body: entry ? JSON.stringify({ ...entry, at: Date.now() }) : undefined })
      .catch(() => null);
  }

  private broadcast(s: State): void {
    const engine = engineFor(s);
    const room = { listed: this.listing.listed, matched: this.listing.matched, startAt: this.listing.startAt };
    for (const ws of this.ctx.getWebSockets()) {
      const key = (ws.deserializeAttachment() as { key?: string } | null)?.key;
      const view = key ? engine.viewFor(s, key) : null;
      try {
        if (view) ws.send(JSON.stringify({ t: 'state', state: view, now: Date.now(), room }));
        else {
          ws.send(JSON.stringify({ t: 'gone', reason: 'You were removed from this room.', code: 'kicked' }));
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
    if (url.pathname.startsWith('/lobby/')) return this.lobby(url, request, now);
    if (url.pathname === '/init' && request.method === 'POST') {
      if (await this.load()) return json({ error: 'exists' }, 409);
      const code = url.searchParams.get('code') ?? '';
      const game = url.searchParams.get('game');
      const s = ENGINES[isGameId(game) ? game : 'crass-act'].newRoom(code, now, crypto.getRandomValues(new Uint32Array(1))[0]!);
      this.state = s;
      const matched = url.searchParams.get('matched') === '1';
      const kind = matched ? lobbyList.cleanKind(url.searchParams.get('kind')) : '';
      const door = matched ? lobbyList.cleanDoor(url.searchParams.get('door')) : '';
      await this.setListing({ listed: matched || url.searchParams.get('listed') === '1', matched, startAt: null, ...(kind ? { kind } : {}), ...(door ? { door } : {}) });
      await this.save(s);
      return json({ ...(engineFor(s).summary(s) as object), listed: this.listing.listed });
    }
    if (url.pathname === '/ring-run') {
      const run = await this.ctx.storage.get<RingRun>('ringRun');
      return run ? json(run) : json({ error: 'not_found' }, 404);
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
      if (!ENGINES['crass-act'].validKey(key) || key === SHARED_KEY) return json({ error: 'bad_key' }, 400);
      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];
      // One seat, one tab: an older socket of the same player (another tab, or a connection that never
      // said goodbye) is told and closed; the seat stays, as this socket is still on it.
      const older = this.ctx.getWebSockets(key);
      this.ctx.acceptWebSocket(server, [key]);
      server.serializeAttachment({ key });
      const s = await this.load();
      // (who this player is, as the site said: kept for the Ring's ranked matches)
      const uid = cleanUid(url.searchParams.get('uid'));
      const net = cleanNet(url.searchParams.get('net'));
      if (s?.game === 'sigilfall-ring') {
        const ids = await this.who();
        if (ids[key]?.uid !== uid || ids[key]?.net !== net) {
          ids[key] = { uid, net };
          await this.ctx.storage.put('ids', ids);
        }
      }
      // (a ranked room waiting for players: a new seat only for whoever quick match sent here with its door key)
      const seated = !!s?.seats?.some((x) => x.key === key);
      const shut = !!s && s.game === 'sigilfall-ring' && !!this.listing.door && !seated && url.searchParams.get('door') !== this.listing.door;
      const err = s ? (shut ? 'full' : engineFor(s).join(s, key, url.searchParams.get('name') ?? '', now)) : 'not_found';
      if (!s || err) {
        server.send(JSON.stringify(refusal(err)));
        server.close(4004, err ?? 'gone');
      } else {
        for (const ws of older)
          try {
            ws.send(JSON.stringify(REPLACED));
            ws.close(4005, 'replaced');
          } catch {
            /* already closing */
          }
        await this.syncRing(s, (s as { run?: number }).run ?? 0, now);
        await this.save(s);
        this.broadcast(s);
      }
      return new Response(null, { status: 101, webSocket: client } as ResponseInit);
    }
    return json({ error: 'not_found' }, 404);
  }

  /** The "lobby" object: the public room list and quick match (lobby.ts). */
  private lobbyRooms: lobbyList.Lobby | null = null;
  private lobbySeekers: lobbyList.Seekers | null = null;

  private async lobby(url: URL, request: Request, now: number): Promise<Response> {
    const rooms = (this.lobbyRooms ??= (await this.ctx.storage.get<lobbyList.Lobby>('lobby')) ?? {});
    lobbyList.prune(rooms, now);
    const store = (): Promise<void> => this.ctx.storage.put('lobby', rooms);
    const game = url.searchParams.get('game') ?? undefined;
    if (url.pathname === '/lobby/list') return json({ rooms: lobbyList.list(rooms, now, game).map(({ claims: _c, at: _a, door: _d, ...r }) => r) });
    if (request.method !== 'POST') return json({ error: 'not_found' }, 404);
    if (url.pathname === '/lobby/put') {
      const r = (await request.json().catch(() => null)) as lobbyList.Listed | null;
      if (!r || typeof r.code !== 'string' || !isGameId(r.game)) return json({ error: 'bad' }, 400);
      lobbyList.put(rooms, r, now);
      await store();
      return json({ ok: true });
    }
    if (url.pathname === '/lobby/drop') {
      lobbyList.drop(rooms, url.searchParams.get('code') ?? '');
      await store();
      return json({ ok: true });
    }
    if (url.pathname === '/lobby/match') {
      if (!isGameId(game) || !this.env.ROOM) return json({ error: 'bad' }, 400);
      const skip = (url.searchParams.get('skip') ?? '').split(',').filter(Boolean);
      const kind = lobbyList.cleanKind(url.searchParams.get('kind'));
      // a rated search (The Ring) says its rating, who is searching (to count who else is around) and whether it
      // would rather fight the computer at once than wait in an empty queue
      const r = Number(url.searchParams.get('rating'));
      const rating = url.searchParams.has('rating') && Number.isFinite(r) ? Math.max(0, Math.min(5000, r)) : undefined;
      const who = lobbyList.cleanWho(url.searchParams.get('who'));
      const seekers = (this.lobbySeekers ??= (await this.ctx.storage.get<lobbyList.Seekers>('seekers')) ?? {});
      const active = who ? lobbyList.seen(seekers, game, kind, who, now) : 0;
      if (who) await this.ctx.storage.put('seekers', seekers);
      const found = lobbyList.match(rooms, game, now, skip, kind, rating);
      if (found) {
        await store();
        return json({ code: found.code, created: false, active: Math.max(1, active), ...(found.door ? { door: found.door } : {}) });
      }
      // nobody else is around in this queue: the computer, at once, rather than ten seconds of an empty room
      if (url.searchParams.get('alone') === 'bots' && active === 0) return json({ code: null, created: false, active: 0 });
      // Nobody waiting: open a room and hold it, before waiting on anything, so the next searcher lands in it too.
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = newCode();
        if (rooms[code]) continue;
        // (a rated queue's room has a door key, given with its code to whoever quick match sends there)
        const door = rating !== undefined ? newDoor() : '';
        lobbyList.reserve(rooms, code, game, QUICK[game].seats, now, kind, rating, door);
        const res = await this.env.ROOM.get(this.env.ROOM.idFromName(code)).fetch(`https://room/init?code=${code}&game=${game}&matched=1${kind ? `&kind=${kind}` : ''}${door ? `&door=${door}` : ''}`, { method: 'POST' });
        if (res.ok) {
          await store();
          return json({ code, created: true, active, ...(door ? { door } : {}) });
        }
        delete rooms[code];
        if (res.status !== 409) break;
      }
      return json({ error: 'rooms_unavailable' }, 503);
    }
    return json({ error: 'not_found' }, 404);
  }

  async webSocketMessage(ws: Socket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string' || isWatcher(ws)) return;
    const s = await this.load();
    // a game whose players stream more (Sigilfall's co-op frames) says how much
    if (message.length > (s ? (engineFor(s).maxMessage ?? MAX_MESSAGE) : MAX_MESSAGE)) return;
    const key = (ws.deserializeAttachment() as { key?: string } | null)?.key;
    if (!s || !key) return ws.close(4004, 'gone');
    let action: never;
    try {
      action = JSON.parse(message) as never;
    } catch {
      return;
    }
    // An action the page will send again after a reconnect until it hears it arrived (useRoom's `resend`).
    const id = (action as { $id?: unknown } | null)?.$id;
    if (typeof id === 'number') {
      delete (action as { $id?: unknown }).$id;
      ws.send(JSON.stringify({ t: 'ack', id }));
    }
    const now = Date.now();
    const engine = engineFor(s);
    // The host makes the room public or private (the room's own setting, not the game's).
    const own = action as { t?: unknown; listed?: unknown };
    if (own?.t === '$listing') {
      const me = s.seats?.find((x) => x.key === key);
      if (!me || me.n !== s.host || typeof own.listed !== 'boolean') return;
      await this.setListing({ ...this.listing, listed: own.listed, matched: own.listed && this.listing.matched, startAt: own.listed ? this.listing.startAt : null });
      // Made private after a hibernation: the lobby may still list it.
      if (!own.listed) this.reported ||= 'listed';
      await this.save(s);
      this.broadcast(s);
      return;
    }
    const relay = engine.relay?.(s, key, action, now);
    if (relay) {
      if (relay.self !== undefined) ws.send(JSON.stringify({ t: 'relay', data: relay.self }));
      if (relay.others !== undefined) {
        const out = JSON.stringify({ t: 'relay', data: relay.others });
        for (const other of this.ctx.getWebSockets())
          if (other !== ws && !isWatcher(other))
            try {
              other.send(out);
            } catch {
              /* closing */
            }
      }
      if (relayKeepAlive(s, now)) await this.save(s);
      else if (relay.save || (relay.save !== false && now - this.savedAt >= RELAY_SAVE_MS)) await this.ctx.storage.put('state', s).then(() => (this.savedAt = now));
      return;
    }
    engine.tick(s, now);
    const runBefore = (s as { run?: number }).run ?? 0;
    const err = engine.act(s, key, action, now);
    if (err) ws.send(JSON.stringify({ t: 'error', message: err }));
    await this.syncRing(s, runBefore, now);
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
    await this.syncRing(s, (s as { run?: number }).run ?? 0, Date.now());
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
      await this.report(s, true);
      await this.ctx.storage.deleteAll();
      this.state = null;
      this.listing = NOT_LISTED;
      return;
    }
    const engine = engineFor(s);
    // dropped players' grace ran out: their empty lobby seats go, and a dropped host's claim
    if (s.seats) dropAway(s as unknown as RoomBase, now);
    engine.tick(s, now);
    // A quick-match room's countdown ran out: the host's Start, on everyone's behalf.
    if (this.listing.startAt !== null && now >= this.listing.startAt) {
      const host = s.seats?.find((x) => x.n === s.host && x.online);
      await this.setListing({ ...this.listing, startAt: null });
      if (host) engine.act(s, host.key, { t: 'start' } as never, now);
    }
    await this.save(s);
    this.broadcast(s);
  }
}

export default {
  fetch(): Response {
    return new Response('Not found', { status: 404 });
  },
};
