import { playerKey } from '../../../platform/challenges';
import { createRoom } from '../../../platform/rooms';
import type { Action, View } from './room';

/**
 * The live connection to a co-op party's room (rooms/worker.ts; the room itself is net/room.ts). Like the
 * arcade's useRoom, but for a game that isn't React: it keeps the latest view, passes the fight's traffic
 * to `onRelay` as it comes, and reconnects by itself with the same player key (the seat is kept).
 */
export type LinkState = 'connecting' | 'open' | 'reconnecting' | 'gone';

export interface LinkHandlers {
  onView(v: View): void;
  /** The fight's traffic from another seat (net/coop.ts). */
  onRelay(n: number, d: unknown): void;
  onState(s: LinkState, reason?: string): void;
  onError?(message: string): void;
}

export class Link {
  state: LinkState = 'connecting';
  view: View | null = null;
  private ws: WebSocket | null = null;
  private stopped = false;
  private tries = 0;
  private retry = 0;
  private ping = 0;

  constructor(
    readonly code: string,
    private name: string,
    private readonly h: LinkHandlers,
  ) {
    this.connect();
  }

  /** Opens a new party room and connects to it. */
  static async create(name: string, h: LinkHandlers): Promise<Link> {
    return new Link(await createRoom('sigilfall'), name, h);
  }

  private connect(): void {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/api/rooms/${this.code}/ws?key=${encodeURIComponent(playerKey())}&name=${encodeURIComponent(this.name)}`);
    this.ws = ws;
    ws.onopen = () => {
      this.tries = 0;
      this.set('open');
      this.ping = window.setInterval(() => ws.readyState === WebSocket.OPEN && ws.send('ping'), 25_000);
    };
    ws.onmessage = (ev) => {
      if (typeof ev.data !== 'string' || ev.data === 'pong') return;
      let m: { t: string; state?: View; data?: { n: number; d: unknown }; message?: string; reason?: string };
      try {
        m = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (m.t === 'relay' && m.data) this.h.onRelay(m.data.n, m.data.d);
      else if (m.t === 'state' && m.state) {
        this.view = m.state;
        this.h.onView(m.state);
      } else if (m.t === 'error' && m.message) this.h.onError?.(m.message);
      else if (m.t === 'gone') {
        this.stopped = true;
        this.set('gone', m.reason ?? 'The party has closed.');
      }
    };
    ws.onclose = () => {
      window.clearInterval(this.ping);
      if (this.stopped) {
        if (this.state !== 'gone') this.set('gone');
        return;
      }
      this.set('reconnecting');
      this.retry = window.setTimeout(() => this.connect(), Math.min(5000, 400 * 2 ** this.tries++));
    };
  }

  private set(s: LinkState, reason?: string): void {
    this.state = s;
    this.h.onState(s, reason);
  }

  /** An action for the room (a card, the plan, start...). */
  send(a: Action): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(a));
  }

  /** The fight's traffic to everyone else in the party. */
  relay(d: unknown): void {
    this.send({ t: 'r', d });
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
