/**
 * Keeps an open challenge live (loaded only when a challenge is open). The challenge's channel on
 * the rooms worker (GET /api/challenges/<id>/live, see rooms/worker.ts) says when something changed,
 * then this fetches once. It used to ask every 3 seconds, which was most of the site's server
 * requests. Without sockets (blocked, or rooms down) it checks every 20 seconds instead.
 */
import { ApiError } from './account';
import type { ChallengeView } from './challenge';
import { pollChallenge } from './challenges';

const FALLBACK_POLL_MS = 20_000;
/** Keeps the socket alive through proxies (answered by the worker without waking anything). */
const PING_MS = 45_000;

export interface LiveHandlers {
  current: () => ChallengeView | null;
  onView: (v: ChallengeView) => void;
  onGone: () => void;
}

/** Starts watching; returns the function that stops it. */
export function watchChallenge(id: string, h: LiveHandlers): () => void {
  let stop = false;
  let socket: WebSocket | null = null;
  let ping = 0;
  let retry = 0;
  /** The fallback check's timer (0 = not running). */
  let poll = 0;
  let tries = 0;
  let fetching = false;
  let again = false;

  /** One fetch of the latest view (204 when nothing changed since ours). */
  const refresh = async (): Promise<void> => {
    if (stop) return;
    if (fetching) {
      again = true;
      return;
    }
    fetching = true;
    try {
      const cur = h.current();
      // Past its closing time, ask for the whole view: it comes back closed.
      const since = cur && cur.closesAt && Date.now() > cur.closesAt ? 0 : (cur?.updatedAt ?? 0);
      const v = await pollChallenge(id, since);
      if (!stop && v) h.onView(v);
    } catch (e) {
      if (!stop && e instanceof ApiError && e.status === 404) h.onGone();
    } finally {
      fetching = false;
      if (again && !stop) {
        again = false;
        void refresh();
      }
    }
  };

  /** Starts the fallback check (once: retries must not keep pushing it back). */
  const slowPoll = (): void => {
    if (poll) return;
    const next = (): void => {
      poll = window.setTimeout(() => {
        if (!document.hidden) void refresh();
        next();
      }, FALLBACK_POLL_MS);
    };
    next();
  };
  const stopPoll = (): void => {
    window.clearTimeout(poll);
    poll = 0;
  };

  const connect = (): void => {
    if (stop || document.hidden || socket) return;
    const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/challenges/${id}/live`);
    socket = ws;
    ws.onopen = () => {
      tries = 0;
      stopPoll();
      void refresh(); // anything that changed while connecting
      ping = window.setInterval(() => ws.readyState === WebSocket.OPEN && ws.send('ping'), PING_MS);
    };
    ws.onmessage = (e) => {
      if (typeof e.data !== 'string' || e.data === 'pong') return;
      try {
        const m = JSON.parse(e.data) as { t?: string; v?: number };
        if (m.t === 'changed' && m.v !== h.current()?.updatedAt) void refresh();
      } catch {
        /* ignore */
      }
    };
    ws.onclose = () => {
      window.clearInterval(ping);
      if (socket !== ws) return;
      socket = null;
      if (stop) return;
      if (++tries >= 3) slowPoll();
      retry = window.setTimeout(connect, Math.min(60_000, 1000 * 2 ** tries));
    };
  };

  const onVisible = (): void => {
    if (document.hidden) return;
    void refresh();
    if (!socket) {
      window.clearTimeout(retry);
      connect();
    }
  };
  connect();
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    stop = true;
    window.clearTimeout(retry);
    stopPoll();
    window.clearInterval(ping);
    document.removeEventListener('visibilitychange', onVisible);
    const s = socket;
    socket = null;
    s?.close();
  };
}
