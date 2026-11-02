import { afterEach, describe, expect, it, vi } from 'vitest';
import { QUICK } from '../rooms/engines';
import { alarmTime, IDLE_MS, IDLE_STEP, refusal, relayKeepAlive, SHARED_KEY } from '../rooms/live';
import { Room } from '../rooms/worker';
import * as sigilfall from '../src/games/sigilfall/net/room';
import { Outbox, rematchUrl } from '../src/platform/rooms';
import * as dial from '../src/party/rooms/dialRoom';
import * as nhie from '../src/party/rooms/nhieRoom';
import { AWAY_MS, cleanName, dropAway, KICKED_MAX, NAME_MAX } from '../src/party/rooms/seats';

const KEYS = ['aaaaaaaaaaaaaaaa1', 'bbbbbbbbbbbbbbbb2', 'cccccccccccccccc3', 'dddddddddddddddd4'];
const T0 = 1_800_000_000_000;
const key = (i: number): string => `k${String(i).padStart(16, '0')}`;

const lobby = (players = 3) => {
  const s = nhie.newRoom('ABCDE', T0, 7);
  KEYS.slice(0, players).forEach((k, i) => nhie.join(s, k, `P${i + 1}`, T0));
  return s;
};

describe('room list size (PB-05)', () => {
  it('lists a room with the seats its engine really has', () => {
    expect(nhie.summary(nhie.newRoom('ABCDE', T0, 1)).max).toBe(nhie.MAX_PLAYERS);
    expect(dial.summary(dial.newRoom('ABCDE', T0, 1)).max).toBe(16);
  });
  it('quick match fills a Never Have I Ever room to its 16 seats', () => {
    expect(QUICK.nhie.seats).toBe(nhie.MAX_PLAYERS);
  });
});

describe('player names (PB-06, PB-08)', () => {
  it('never cuts an emoji in half for the duplicate suffix', () => {
    const s = nhie.newRoom('ABCDE', T0, 1);
    const ten = '😀'.repeat(10);
    nhie.join(s, KEYS[0]!, ten, T0);
    nhie.join(s, KEYS[1]!, ten, T0);
    expect(s.seats[0]!.name).toBe(ten);
    expect(s.seats[1]!.name).toBe(`${'😀'.repeat(9)} 2`);
    expect(s.seats[1]!.name.length).toBeLessThanOrEqual(NAME_MAX);
    expect(s.seats[1]!.name).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
  });
  it('cuts long names on whole characters', () => {
    const name = cleanName(`${'a'.repeat(19)}👍🏽`);
    expect(name).toBe('a'.repeat(19));
    expect(cleanName('👨‍👩‍👧'.repeat(3)).length).toBeLessThanOrEqual(NAME_MAX);
  });
  it('strips invisible characters but keeps emoji joiners', () => {
    expect(cleanName('BG​-Na⁦me‎')).toBe('BG-Name');
    expect(cleanName('👨‍👩‍👧')).toBe('👨‍👩‍👧');
    expect(cleanName('​‍')).toBe('');
  });
  it('treats look-alike names as the same name', () => {
    const s = nhie.newRoom('ABCDE', T0, 1);
    nhie.join(s, KEYS[0]!, 'BG-Name', T0);
    nhie.join(s, KEYS[1]!, 'BG-Name​', T0);
    nhie.join(s, KEYS[2]!, 'ＢＧ-Name', T0);
    expect(s.seats.map((x) => x.name)).toEqual(['BG-Name', 'BG-Name 2', 'ＢＧ-Name 3']);
  });
});

describe('kicked players stay out (PB-07, SFC-11)', () => {
  it('refuses a removed key with its own message', () => {
    const s = lobby();
    expect(nhie.act(s, KEYS[0]!, { t: 'kick', seat: 2 }, T0)).toBeNull();
    expect(s.seats.some((x) => x.key === KEYS[1])).toBe(false);
    expect(nhie.join(s, KEYS[1]!, 'P2', T0 + 1000)).toBe('kicked');
    expect(refusal('kicked')).toMatchObject({ code: 'kicked', reason: 'You were removed from this room.' });
    expect(refusal('full').code).toBe('full');
    expect(nhie.join(s, KEYS[3]!, 'P4', T0)).toBeNull();
  });
  it('keeps the list capped', () => {
    const s = nhie.newRoom('ABCDE', T0, 1);
    nhie.join(s, KEYS[0]!, 'Host', T0);
    for (let i = 0; i < KICKED_MAX + 5; i++) {
      nhie.join(s, key(i), `G${i}`, T0);
      nhie.act(s, KEYS[0]!, { t: 'kick', seat: s.seats.find((x) => x.key === key(i))!.n }, T0);
    }
    expect(s.kicked).toHaveLength(KICKED_MAX);
    expect(s.kicked).toContain(key(KICKED_MAX + 4));
    expect(nhie.join(s, key(0), 'G0', T0)).toBeNull();
  });
  it('works for Sigilfall parties too', () => {
    const s = sigilfall.newRoom('ABCDE', T0, 1);
    sigilfall.join(s, KEYS[0]!, 'Lead', T0);
    sigilfall.join(s, KEYS[1]!, 'Friend', T0);
    expect(sigilfall.act(s, KEYS[0]!, { t: 'kick', n: 2 } as never, T0)).toBeNull();
    expect(sigilfall.join(s, KEYS[1]!, 'Friend', T0 + 5000)).toBe('kicked');
  });
});

describe('a short drop is not leaving (SFC-03)', () => {
  it('keeps the lobby seat and gives the host role back on rejoin', () => {
    const s = lobby();
    nhie.leave(s, KEYS[0]!, T0 + 1000);
    expect(s.seats.find((x) => x.key === KEYS[0])).toMatchObject({ n: 1, online: false });
    expect(s.host).toBe(2);
    nhie.join(s, KEYS[0]!, 'P1', T0 + 20_000);
    expect(s.seats.find((x) => x.key === KEYS[0])).toMatchObject({ n: 1, online: true, name: 'P1' });
    expect(s.host).toBe(1);
    expect(nhie.act(s, KEYS[0]!, { t: 'start' }, T0 + 21_000)).toBeNull();
  });
  it('gives the host role back even if someone joined while the host was away alone', () => {
    const s = lobby(1);
    nhie.leave(s, KEYS[0]!, T0);
    nhie.join(s, KEYS[1]!, 'P2', T0 + 1000);
    expect(s.host).toBe(2);
    nhie.join(s, KEYS[0]!, 'P1', T0 + 2000);
    expect(s.host).toBe(1);
  });
  it('lets the seat and the claim go after the grace period', () => {
    const s = lobby();
    nhie.leave(s, KEYS[0]!, T0);
    expect(alarmTime(s, null)).toBe(T0 + AWAY_MS);
    expect(dropAway(s, T0 + AWAY_MS - 1)).toBe(false);
    expect(dropAway(s, T0 + AWAY_MS)).toBe(true);
    expect(s.seats.map((x) => x.n)).toEqual([2, 3]);
    expect(s.hostAway).toBeUndefined();
    nhie.join(s, KEYS[0]!, 'P1', T0 + AWAY_MS + 1);
    expect(s.seats.find((x) => x.key === KEYS[0])!.n).toBe(4);
    expect(s.host).toBe(2);
  });
  it('keeps a Sigilfall hero card through the drop', () => {
    const s = sigilfall.newRoom('ABCDE', T0, 1);
    sigilfall.join(s, KEYS[0]!, 'Lead', T0);
    sigilfall.join(s, KEYS[1]!, 'Friend', T0);
    s.cards[1] = { level: 60 } as never;
    sigilfall.leave(s, KEYS[0]!, T0 + 100);
    sigilfall.join(s, KEYS[0]!, 'Lead', T0 + 5000);
    expect(s.host).toBe(1);
    expect(s.seats.find((x) => x.key === KEYS[0])!.n).toBe(1);
    expect(s.cards[1]).toEqual({ level: 60 });
  });
});

describe('relays keep a room alive (SFC-15)', () => {
  it('moves the idle clock at most once per idle step', () => {
    const s = sigilfall.newRoom('ABCDE', T0, 1);
    expect(relayKeepAlive(s, T0 + IDLE_STEP - 1)).toBe(false);
    expect(relayKeepAlive(s, T0 + IDLE_STEP)).toBe(true);
    expect(relayKeepAlive(s, T0 + IDLE_STEP + 1000)).toBe(false);
    let writes = 0;
    for (let now = T0; now < T0 + 4 * 60 * 60 * 1000; now += 50) if (relayKeepAlive(s, now)) writes++;
    expect(writes).toBeLessThanOrEqual(25);
    expect(alarmTime(s, null)).toBeGreaterThan(T0 + 4 * 60 * 60 * 1000 - IDLE_STEP + IDLE_MS - IDLE_STEP);
  });
});

describe('actions sent while reconnecting (CC-06)', () => {
  it('holds the last action sent while down and sends it once when back', () => {
    const box = new Outbox<{ t: string; n?: number }>();
    expect(box.send({ t: 'turn', n: 1 }, false)).toBeNull();
    expect(box.send({ t: 'turn', n: 2 }, false)).toBeNull();
    expect(JSON.parse(box.flush()!)).toEqual({ t: 'turn', n: 2 });
    expect(box.flush()).toBeNull();
    expect(box.send({ t: 'turn', n: 3 }, true)).toBe('{"t":"turn","n":3}');
    expect(box.flush()).toBeNull();
  });
  it('re-sends a resend action until the room confirms it', () => {
    const box = new Outbox<{ t: string }>();
    const wire = JSON.parse(box.send({ t: 'turn' }, true, true)!) as { $id: number };
    expect(wire.$id).toBe(1);
    expect(box.flush()).toBe('{"t":"turn","$id":1}');
    expect(box.flush()).toBe('{"t":"turn","$id":1}');
    box.ack(1);
    expect(box.flush()).toBeNull();
  });
});

describe('quick match after a lost race (PB-10)', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('finds another room, skipping the full one', async () => {
    const calls: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (String(url) === '/api/rooms/ABCDE') return new Response(JSON.stringify({ game: 'dial', full: true, players: 16, host: '', phase: 'lobby' }));
        calls.push(JSON.parse(String(init?.body)));
        return new Response(JSON.stringify({ code: 'FGHJK', created: false }));
      }),
    );
    const next = await rematchUrl('ABCDE', 'https://x.test/party?room=ABCDE&match=1');
    expect(calls).toEqual([{ game: 'dial', skip: ['ABCDE'] }]);
    expect(new URL(next!).searchParams.get('room')).toBe('FGHJK');
    expect(await rematchUrl('ABCDE', 'https://x.test/party?room=ABCDE')).toBeNull();
  });
});


describe('the old shared no-storage key', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('is refused at the door', async () => {
    vi.stubGlobal('WebSocketRequestResponsePair', class {});
    const room = new Room({ storage: {}, setWebSocketAutoResponse: () => undefined } as never, {});
    const res = await room.fetch(new Request(`https://room/ws?key=${SHARED_KEY}`, { headers: { Upgrade: 'websocket' } }));
    expect(res.status).toBe(400);
  });
});
