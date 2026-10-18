import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChallengeView } from '../src/platform/challenge';

const poll = vi.fn<(id: string, since: number) => Promise<ChallengeView | null>>();
vi.mock('../src/platform/challenges', () => ({ pollChallenge: (id: string, since: number) => poll(id, since) }));
const { watchChallenge } = await import('../src/platform/challengeLive');

/** A stand-in socket the test opens, messages and closes by hand. */
class FakeSocket {
  static all: FakeSocket[] = [];
  static OPEN = 1;
  readyState = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  constructor(public url: string) {
    FakeSocket.all.push(this);
  }
  send(m: string): void {
    this.sent.push(m);
  }
  close(): void {
    this.readyState = 3;
    this.onclose?.();
  }
  open(): void {
    this.readyState = 1;
    this.onopen?.();
  }
  fail(): void {
    this.readyState = 3;
    this.onclose?.();
  }
}

const view = (updatedAt: number) => ({ updatedAt, closesAt: 0 }) as ChallengeView;

describe('live challenge updates (instead of polling every 3 seconds)', () => {
  let current: ChallengeView;
  const handlers = () => ({ current: () => current, onView: (v: ChallengeView) => (current = v), onGone: vi.fn() });
  beforeEach(() => {
    vi.useFakeTimers();
    FakeSocket.all = [];
    vi.stubGlobal('WebSocket', FakeSocket);
    poll.mockReset();
    poll.mockResolvedValue(null);
    current = view(100);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('fetches only when the channel says it changed', async () => {
    const stop = watchChallenge('abc', handlers());
    const ws = FakeSocket.all[0]!;
    expect(ws.url).toMatch(/\/api\/challenges\/abc\/live$/);
    ws.open();
    await vi.advanceTimersByTimeAsync(10);
    expect(poll).toHaveBeenCalledTimes(1); // catch up once on connect
    // A minute of quiet: no requests at all (only the keep-alive ping on the socket).
    await vi.advanceTimersByTimeAsync(60_000);
    expect(poll).toHaveBeenCalledTimes(1);
    expect(ws.sent).toContain('ping');
    poll.mockResolvedValueOnce(view(200));
    ws.onmessage?.({ data: JSON.stringify({ t: 'changed', v: 200 }) });
    await vi.advanceTimersByTimeAsync(10);
    expect(poll).toHaveBeenLastCalledWith('abc', 100);
    expect(current.updatedAt).toBe(200);
    // The same change again (or one we already have) costs nothing.
    ws.onmessage?.({ data: JSON.stringify({ t: 'changed', v: 200 }) });
    await vi.advanceTimersByTimeAsync(10);
    expect(poll).toHaveBeenCalledTimes(2);
    stop();
    expect(ws.readyState).toBe(3);
  });

  it('falls back to a check every 20 seconds when sockets cannot connect', async () => {
    const stop = watchChallenge('abc', handlers());
    // Every connection attempt fails at once (rooms down or sockets blocked).
    const failAll = () => FakeSocket.all.filter((s) => s.readyState === 0).forEach((s) => s.fail());
    for (let t = 0; t < 120; t++) {
      failAll();
      await vi.advanceTimersByTimeAsync(1000);
    }
    // Over two minutes: about one check per 20 s, never zero, never a flood.
    expect(poll.mock.calls.length).toBeGreaterThanOrEqual(4);
    expect(poll.mock.calls.length).toBeLessThanOrEqual(6);
    // Once a socket connects, the fallback stops.
    await vi.advanceTimersByTimeAsync(60_000);
    const last = FakeSocket.all.at(-1)!;
    const before = poll.mock.calls.length;
    last.open(); // catches up once…
    expect(poll.mock.calls.length).toBe(before + 1);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(poll.mock.calls.length).toBe(before + 1); // …then no more checks while connected
    stop();
  });

  it('reports a deleted challenge', async () => {
    const h = handlers();
    const { ApiError } = await import('../src/platform/account');
    poll.mockRejectedValueOnce(new ApiError(404, 'not_found', 'not_found'));
    watchChallenge('abc', h);
    FakeSocket.all[0]!.open();
    await vi.advanceTimersByTimeAsync(10);
    expect(h.onGone).toHaveBeenCalled();
  });
});
