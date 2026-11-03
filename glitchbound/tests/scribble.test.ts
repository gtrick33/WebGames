import { describe, expect, it } from 'vitest';
import { onRequestGet as invite } from '../functions/r/[code]';
import { ENGINES, isGameId, QUICK } from '../rooms/engines';
import type { Env } from '../server/http';
import { EASY, HARD, MEDIUM, TIERS } from '../src/party/content/scribble';
import { PARTY_GAMES } from '../src/party/catalog';
import * as room from '../src/party/rooms/scribbleRoom';
import { drawerPoints, guessPoints, H, isHit, isNear, mask, replay, validOp, W } from '../src/party/scribble';
import { InkStore } from '../src/party/ui/scribbleInk';

const KEYS = ['aaaaaaaaaaaaaaaa1', 'bbbbbbbbbbbbbbbb2', 'cccccccccccccccc3', 'dddddddddddddddd4'];
const T0 = 1_800_000_000_000;

const started = (players = 3) => {
  const s = room.newRoom('ABCDE', T0, 7);
  KEYS.slice(0, players).forEach((k, i) => room.join(s, k, `P${i + 1}`, T0));
  expect(room.act(s, KEYS[0]!, { t: 'start' }, T0)).toBeNull();
  return s;
};
const keyOf = (s: room.State, n: number): string => s.seats.find((x) => x.n === n)!.key;

describe('Scribble Scramble words', () => {
  it('has three tiers of clean, unique words that fit the blanks', () => {
    const all = [...EASY, ...MEDIUM, ...HARD];
    expect(new Set(all).size).toBe(all.length);
    for (const tier of TIERS) expect(tier.length).toBeGreaterThan(90);
    for (const w of all) {
      expect(w).toMatch(/^[a-z]+( [a-z]+)*$/);
      expect(w.length).toBeLessThanOrEqual(20);
    }
  });
});

describe('Scribble Scramble rules', () => {
  it('accepts the word typed loosely and spots near misses', () => {
    expect(isHit('  Ice   Cream!', 'ice cream')).toBe(true);
    expect(isHit('icecream', 'ice cream')).toBe(true);
    expect(isHit('cats', 'cat')).toBe(true);
    expect(isHit('dog', 'cat')).toBe(false);
    expect(isHit('', 'cat')).toBe(false);
    expect(isNear('lighthose', 'lighthouse')).toBe(true);
    expect(isNear('baloon', 'balloon')).toBe(true);
    expect(isNear('balon', 'balloon')).toBe(false);
    expect(isNear('cab', 'cat')).toBe(false);
    expect(isNear('lighthouse', 'lighthouse')).toBe(false);
  });

  it('shows the word as blanks, keeping spaces and hints', () => {
    expect(mask('ice cream', [])).toBe('___ _____');
    expect(mask('ice cream', [0, 4])).toBe('i__ c____');
  });

  it('scores faster guesses and harder words higher', () => {
    expect(guessPoints(0, 80_000, 80_000, 0)).toBe(350);
    expect(guessPoints(0, 0, 80_000, 5)).toBe(80);
    expect(guessPoints(2, 40_000, 80_000, 3)).toBeGreaterThan(guessPoints(0, 40_000, 80_000, 3));
    expect(guessPoints(1, 60_000, 80_000, 1)).toBeGreaterThan(guessPoints(1, 20_000, 80_000, 1));
    expect(drawerPoints(2, 3, 3)).toBe(400);
    expect(drawerPoints(0, 0, 3)).toBe(0);
  });

  it('checks every op and replays undo and clear', () => {
    expect(validOp([0, 3, 1, 10, 10])).toBe(true);
    expect(validOp([0, 99, 1, 10, 10])).toBe(false);
    expect(validOp([0, 3, 1, W, 10])).toBe(false);
    expect(validOp([1, 5, 5, 6, 6])).toBe(true);
    expect(validOp([1, 5, 5, 6])).toBe(false);
    expect(validOp([2, 0, 1, H - 1])).toBe(true);
    expect(validOp([3])).toBe(true);
    expect(validOp([4, 1])).toBe(false);
    expect(validOp('x')).toBe(false);
    const marks = replay([[0, 1, 1, 0, 0], [1, 5, 5, 9, 9], [2, 4, 50, 50], [3], [0, 2, 0, 1, 1], [4], [0, 3, 2, 7, 7]]);
    expect(marks).toEqual([{ kind: 'stroke', color: 3, size: 2, pts: [7, 7] }]);
  });
});

describe('Scribble Scramble room', () => {
  it('is a room game everywhere it needs to be', () => {
    expect(isGameId('scribble')).toBe(true);
    expect(ENGINES.scribble.newRoom('ABCDE', T0, 1)).toMatchObject({ game: 'scribble', phase: 'lobby' });
    expect(QUICK.scribble.min).toBe(room.MIN_PLAYERS);
    expect(PARTY_GAMES.find((g) => g.id === 'scribble')?.room).toBe('scribble');
  });

  it('offers the drawer one word of each tier, secret from everyone else', () => {
    const s = started();
    expect(s.phase).toBe('choose');
    const drawer = keyOf(s, s.turn!.drawer);
    const guesser = KEYS.find((k) => k !== drawer)!;
    const mine = room.viewFor(s, drawer)!;
    expect(mine.turn!.offer).toHaveLength(3);
    expect(EASY).toContain(mine.turn!.offer![0]);
    expect(MEDIUM).toContain(mine.turn!.offer![1]);
    expect(HARD).toContain(mine.turn!.offer![2]);
    const theirs = room.viewFor(s, guesser)!;
    expect(theirs.turn!.offer).toBeNull();
    expect(JSON.stringify(theirs)).not.toContain(mine.turn!.offer![1]);
  });

  it('streams strokes from the drawer only, and syncs a late phone', () => {
    const s = started();
    const drawer = keyOf(s, s.turn!.drawer);
    const guesser = KEYS.find((k) => k !== drawer)!;
    room.act(s, drawer, { t: 'pick', tier: 1 }, T0 + 1000);
    expect(s.phase).toBe('draw');
    expect(room.relay(s, guesser, { t: 'ink', turn: s.count, ops: [[0, 1, 1, 5, 5]] }, T0 + 2000)).toEqual({});
    expect(s.ink).toHaveLength(0);
    const out = room.relay(s, drawer, { t: 'ink', turn: s.count, ops: [[0, 1, 1, 5, 5], [1, 6, 6, 7, 7], [9 as never], [2, 4, 100, 100]] }, T0 + 2000);
    expect(out).toEqual({ others: { turn: s.count, at: 0, ops: [[0, 1, 1, 5, 5], [1, 6, 6, 7, 7], [2, 4, 100, 100]] }, save: true });
    expect(room.relay(s, drawer, { t: 'ink', turn: s.count - 1, ops: [[3]] }, T0 + 2100)).toEqual({});
    expect(room.viewFor(s, guesser)!.ink).toBe(3);
    expect(room.relay(s, guesser, { t: 'sync' }, T0 + 2200)).toEqual({ self: { turn: s.count, at: 0, ops: s.ink, sync: true } });
    // Not an ink action: handled as usual.
    expect(room.relay(s, guesser, { t: 'say', text: 'hi' }, T0)).toBeNull();
  });

  it('scores a right guess by speed, keeps it from spoiling, and ends the turn when all have it', () => {
    const s = started(3);
    const drawerN = s.turn!.drawer;
    const drawer = keyOf(s, drawerN);
    const [g1, g2] = KEYS.slice(0, 3).filter((k) => k !== drawer) as [string, string];
    room.act(s, drawer, { t: 'pick', tier: 2 }, T0);
    const word = s.turn!.word!;
    room.act(s, g1, { t: 'say', text: 'banana boat' }, T0 + 1000);
    room.act(s, g1, { t: 'say', text: word.toUpperCase() }, T0 + 5000);
    expect(s.turn!.hits).toHaveLength(1);
    expect(s.turn!.hits[0]!.points).toBeGreaterThan(500);
    // The one who got it now sees the word and chats only with the drawer.
    expect(room.viewFor(s, g1)!.turn!.word).toBe(word);
    expect(room.viewFor(s, g2)!.turn!.word).toBeNull();
    room.act(s, g1, { t: 'say', text: `it was ${word}` }, T0 + 6000);
    expect(JSON.stringify(room.viewFor(s, g2)!.chat)).not.toContain(word);
    expect(room.viewFor(s, drawer)!.chat.some((m) => m.text.includes(word))).toBe(true);
    // The drawer can't type the answer.
    expect(room.act(s, drawer, { t: 'say', text: word }, T0 + 7000)).toMatch(/giving/);
    room.act(s, g2, { t: 'say', text: word }, T0 + 60_000);
    expect(s.phase).toBe('reveal');
    expect(s.turn!.hits[1]!.points).toBeLessThan(s.turn!.hits[0]!.points);
    expect(s.turn!.gained[drawerN]).toBe(400);
    expect(room.viewFor(s, g2)!.turn!.word).toBe(word);
  });

  it('shows letter hints over time, runs every turn and ends with results', () => {
    const s = started(2);
    let now = T0;
    for (let guard = 0; guard < 200 && s.phase !== 'result'; guard++) {
      now = Math.max(now, s.deadline ?? now) + 1;
      room.tick(s, now);
      if (s.phase === 'draw' && s.turn!.word!.replace(/ /g, '').length > 5 && now >= s.turn!.end - 1000) expect(s.turn!.shown.length).toBeGreaterThan(0);
    }
    expect(s.phase).toBe('result');
    expect(s.count).toBe(2);
  });

  it('moves on when the drawer leaves, and drops to the lobby below two players', () => {
    const s = started(3);
    const drawer = keyOf(s, s.turn!.drawer);
    room.leave(s, drawer, T0 + 10);
    expect(s.phase).toBe('reveal');
    const s2 = started(2);
    room.leave(s2, KEYS[1]!, T0 + 10);
    expect(s2.phase).toBe('lobby');
  });

  it('skips the turn of someone who left: nobody draws twice in "everyone draws once"', () => {
    const s = started(3);
    const drawers = [s.turn!.drawer];
    room.leave(s, KEYS[1]!, T0 + 10);
    let now = T0 + 10;
    for (let guard = 0; guard < 200 && s.phase !== 'result'; guard++) {
      now = Math.max(now, s.deadline ?? now) + 1;
      room.tick(s, now);
      if (s.phase === 'choose' && s.turn!.drawer !== drawers.at(-1)) drawers.push(s.turn!.drawer);
    }
    expect(s.phase).toBe('result');
    expect(drawers).toEqual([1, 3]);
  });

  it('says so when a guess comes too fast, instead of dropping it silently', () => {
    const s = started(3);
    const drawer = keyOf(s, s.turn!.drawer);
    expect(room.act(s, drawer, { t: 'pick', tier: 0 }, T0 + 10)).toBeNull();
    expect(s.phase).toBe('draw');
    const guesser = KEYS.slice(0, 3).find((k) => k !== drawer)!;
    expect(room.act(s, guesser, { t: 'say', text: 'first try' }, T0 + 100)).toBeNull();
    expect(room.act(s, guesser, { t: 'say', text: 'second try' }, T0 + 100 + room.CHAT_GAP_MS - 50)).toMatch(/Too fast/);
    expect(room.act(s, guesser, { t: 'say', text: 'second try' }, T0 + 100 + room.CHAT_GAP_MS + 1)).toBeNull();
  });

  it('only lets the host change settings, between games', () => {
    const s = room.newRoom('ABCDE', T0, 1);
    room.join(s, KEYS[0]!, 'Host', T0);
    room.join(s, KEYS[1]!, 'Guest', T0);
    expect(room.act(s, KEYS[1]!, { t: 'settings', settings: { clock: 60 } }, T0)).toMatch(/host/);
    expect(room.act(s, KEYS[0]!, { t: 'settings', settings: { clock: 100, laps: 2, hints: false } }, T0)).toBeNull();
    expect(s.settings).toEqual({ clock: 100, laps: 2, hints: false });
    expect(room.act(s, KEYS[0]!, { t: 'settings', settings: { clock: 7 as never } }, T0)).toBeNull();
    expect(s.settings.clock).toBe(100);
  });

  it('has an invite page', async () => {
    const page = '<html><head><title>GlitchBound</title></head><body></body></html>';
    const env = {
      DB: {},
      NR_DB: {},
      ASSETS: { fetch: async () => new Response(page) },
      ROOMS: { idFromName: (n: string) => n, get: () => ({ fetch: async () => Response.json({ code: 'ABCDE', phase: 'lobby', players: 2, host: 'Ana', full: false, game: 'scribble' }) }) },
    } as unknown as Env;
    const res = await invite({ request: new Request('https://glitchboundstudio.com/r/ABCDE'), env, params: { code: 'ABCDE' } } as never);
    const html = await res.text();
    expect(html).toContain('Scribble Scramble');
    expect(html).toContain('/party?room=ABCDE');
  });
});

describe('Scribble Scramble ink on the phone', () => {
  it('follows the room in order and notices gaps', () => {
    const ink = new InkStore();
    ink.reset(1);
    ink.receive({ turn: 1, at: 0, ops: [[0, 1, 1, 0, 0]] });
    ink.receive({ turn: 1, at: 1, ops: [[1, 4, 4]] });
    expect(ink.marks).toEqual([{ kind: 'stroke', color: 1, size: 1, pts: [0, 0, 4, 4] }]);
    ink.receive({ turn: 1, at: 5, ops: [[3]] });
    expect(ink.behind).toBe(true);
    ink.receive({ turn: 1, at: 0, ops: [[0, 2, 2, 1, 1], [4], [0, 3, 3, 2, 2]], sync: true });
    expect(ink.behind).toBe(false);
    expect(ink.ops).toHaveLength(3);
    expect(ink.marks).toHaveLength(1);
    ink.receive({ turn: 2, at: 0, ops: [[0, 5, 0, 9, 9]] });
    expect(ink.turn).toBe(2);
    expect(ink.marks).toHaveLength(1);
    ink.receive({ full: true });
    expect(ink.full).toBe(true);
  });
});
