import { playerKey } from '../../../platform/challenges';
import { createRoom, type RoomGame } from '../../../platform/rooms';
import type { Action, View } from './room';

/**
 * The live connection to a co-op party's room (rooms/worker.ts; the room itself is net/room.ts). Like the
 * arcade's useRoom, but for a game that isn't React: it keeps the latest view, passes the fight's traffic
 * to `onRelay` as it comes, and reconnects by itself with the same player key (the seat is kept).
 */
export type LinkState = 'connecting' | 'open' | 'reconnecting' | 'gone';

export interface LinkHandlers<V = View> {
  onView(v: V): void;
  /** The fight's traffic from another seat (net/coop.ts). */
  onRelay(n: number, d: unknown): void;
  onState(s: LinkState, reason?: string): void;
  onError?(message: string): void;
}

/** The room's codes for turning a player away (net/room.ts join), passed on for the game to word. */
const CODES = new Set(['full', 'in_run']);
/** How often the round trip to the room is measured (a `ping` the room answers without waking: rooms/worker.ts). */
const PING_MS = 3_000;
/** A measured round trip moves the kept one this much of the way (one slow answer doesn't swing it). */
const RTT_EASE = 0.3;

/**
 * On the dev server only: `?netlag=120` holds every message this long each way (ms), and `&netjitter=40` adds up to that
 * much more at random (in order still, as the room keeps it), to play a party as if a friend were far away. Kept for the
 * tab (the game's pages drop the address's query).
 */
const fakeLag = (): { lag: number; jitter: number } => {
  if (!import.meta.env.DEV || typeof location === 'undefined') return { lag: 0, jitter: 0 };
  const ms = (k: string): number => {
    try {
      const said = new URLSearchParams(location.search).get(k);
      if (said !== null) sessionStorage.setItem(`gb-${k}`, said);
      return Math.max(0, Math.min(2000, Number(sessionStorage.getItem(`gb-${k}`)) || 0));
    } catch {
      return 0;
    }
  };
  return { lag: ms('netlag'), jitter: ms('netjitter') };
};
// (read as the game loads, while the address still has it)
fakeLag();

export class Link<V = View, A = Action> {
  state: LinkState = 'connecting';
  view: V | null = null;
  private ws: WebSocket | null = null;
  private stopped = false;
  private tries = 0;
  private retry = 0;
  private ping = 0;
  /** Why the room sent this player away (its words), until the socket closes with the room's own code. */
  private goneWhy = '';
  /** When the last `ping` went out (performance.now), until its answer. */
  private pingAt = 0;
  /**
   * The round trip from this player to the room and back, in ms (0 until measured). Between two players it is about
   * both of theirs added: every message goes through the room.
   */
  rtt = 0;
  private readonly fake = fakeLag();
  /** (fake lag: when the last held message goes, so they keep their order) */
  private outAt = 0;
  private inAt = 0;

  constructor(
    readonly code: string,
    private name: string,
    private readonly h: LinkHandlers<V>,
    /** A ranked room's door key, from quick match (rooms/worker.ts): it lets a new seat be taken while it waits. */
    private readonly door = '',
  ) {
    this.connect();
  }

  /** Opens a new party room and connects to it. */
  static async create<V = View, A = Action>(name: string, h: LinkHandlers<V>, game: RoomGame = 'sigilfall'): Promise<Link<V, A>> {
    return new Link<V, A>(await createRoom(game), name, h);
  }

  private connect(): void {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/api/rooms/${this.code}/ws?key=${encodeURIComponent(playerKey())}&name=${encodeURIComponent(this.name)}${this.door ? `&door=${this.door}` : ''}`);
    this.ws = ws;
    ws.onopen = () => {
      this.tries = 0;
      this.set('open');
      // (the same ping keeps the connection alive)
      const ping = (): void => {
        if (ws.readyState !== WebSocket.OPEN) return;
        this.pingAt = performance.now();
        this.out(ws, 'ping');
      };
      ping();
      this.ping = window.setInterval(ping, PING_MS);
    };
    ws.onmessage = (ev) => {
      if (typeof ev.data !== 'string') return;
      const data = ev.data;
      this.held(() => this.take(data));
    };
    ws.onclose = (ev) => {
      window.clearInterval(this.ping);
      if (this.stopped) {
        if (this.state !== 'gone') this.set('gone', this.goneWhy ? (CODES.has(ev.reason) ? ev.reason : this.goneWhy) : undefined);
        return;
      }
      this.set('reconnecting');
      this.retry = window.setTimeout(() => this.connect(), Math.min(5000, 400 * 2 ** this.tries++));
    };
  }

  /** A message from the room. */
  private take(data: string): void {
    if (data === 'pong') {
      if (this.pingAt) {
        const ms = performance.now() - this.pingAt;
        this.rtt = this.rtt ? this.rtt + (ms - this.rtt) * RTT_EASE : ms;
        this.pingAt = 0;
      }
      return;
    }
    let m: { t: string; state?: V; data?: { n: number; d: unknown }; message?: string; reason?: string };
    try {
      m = JSON.parse(data);
    } catch {
      return;
    }
    if (m.t === 'relay' && m.data) {
      // (a bad message from another seat never breaks the connection)
      try {
        this.h.onRelay(m.data.n, m.data.d);
      } catch {
        /* dropped */
      }
    }
    else if (m.t === 'state' && m.state) {
      this.view = m.state;
      this.h.onView(m.state);
    } else if (m.t === 'error' && m.message) this.h.onError?.(m.message);
    else if (m.t === 'gone') {
      // said once the socket closes: its close reason is the room's own code ('full', 'in_run'), which the
      // game puts in its words
      this.stopped = true;
      this.goneWhy = m.reason ?? 'The party has closed.';
    }
  }

  /** Sends now, or (fake lag on the dev server) after the held time. */
  private out(ws: WebSocket, msg: string): void {
    if (!this.fake.lag && !this.fake.jitter) return ws.send(msg);
    const at = Math.max(this.outAt, performance.now() + this.fake.lag + Math.random() * this.fake.jitter);
    this.outAt = at;
    window.setTimeout(() => ws.readyState === WebSocket.OPEN && ws.send(msg), at - performance.now());
  }

  /** Takes a message now, or (fake lag) after the held time. */
  private held(fn: () => void): void {
    if (!this.fake.lag && !this.fake.jitter) return fn();
    const at = Math.max(this.inAt, performance.now() + this.fake.lag + Math.random() * this.fake.jitter);
    this.inAt = at;
    window.setTimeout(fn, at - performance.now());
  }

  private set(s: LinkState, reason?: string): void {
    this.state = s;
    this.h.onState(s, reason);
  }

  /** An action for the room (a card, the plan, start...). */
  send(a: A): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.out(this.ws, JSON.stringify(a));
  }

  /** The fight's traffic to everyone else in the party. */
  relay(d: unknown): void {
    this.send({ t: 'r', d } as A);
  }

  get open(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  close(): void {
    this.stopped = true;
    window.clearTimeout(this.retry);
    window.clearInterval(this.ping);
    this.ws?.close();
  }
}
