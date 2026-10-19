import { describe, expect, it } from 'vitest';
import { ANSWERS, pickCount, PROMPTS } from '../src/games/crass-act/cards';
import { act, fill, HAND_SIZE, join, leave, newRoom, stillPicking, tick, viewFor, type State } from '../src/games/crass-act/engine';

const KEYS = ['aaaaaaaaaaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbbbbbbbbbb', 'cccccccccccccccccccccccc', 'dddddddddddddddddddddddd'];
let now = 1_000_000;

function room(players = 4, vote = false): State {
  const s = newRoom('ABCDE', now, 42);
  KEYS.slice(0, players).forEach((k, i) => expect(join(s, k, `P${i + 1}`, now)).toBeNull());
  if (vote) expect(act(s, KEYS[0]!, { t: 'settings', vote: true }, now)).toBeNull();
  expect(act(s, KEYS[0]!, { t: 'start' }, now)).toBeNull();
  return s;
}

/** Everyone who still has to plays their first card(s). */
function playAll(s: State): void {
  for (const k of KEYS) {
    const v = viewFor(s, k);
    if (!v || v.phase !== 'picking' || v.played || v.judge === v.you || v.waiting) continue;
    expect(act(s, k, { t: 'play', cards: v.hand.slice(0, v.prompt!.pick).map((c) => c.id) }, now)).toBeNull();
  }
}

const keyOfSeat = (s: State, n: number | null): string => s.seats.find((x) => x.n === n)!.key;

describe('Crass Act cards', () => {
  it('has plenty of unique prompts and answers', () => {
    expect(PROMPTS.length).toBeGreaterThan(150);
    expect(ANSWERS.length).toBeGreaterThan(400);
    expect(new Set(PROMPTS).size).toBe(PROMPTS.length);
    expect(new Set(ANSWERS).size).toBe(ANSWERS.length);
    for (const p of PROMPTS) expect([1, 2]).toContain(pickCount(p));
  });

  it('fills blanks with the played cards', () => {
    expect(fill('My safe word is ____.', ['The audacity.']).map((p) => p.text).join('')).toBe('My safe word is The audacity.');
    expect(fill('____ + ____ = love.', ['A', 'B']).filter((p) => p.card).map((p) => p.text)).toEqual(['A', 'B']);
  });
});

describe('Crass Act rooms', () => {
  it('needs three players to start and only the host can start', () => {
    const s = newRoom('ABCDE', now, 1);
    join(s, KEYS[0]!, 'Ana', now);
    join(s, KEYS[1]!, 'Bo', now);
    expect(act(s, KEYS[1]!, { t: 'start' }, now)).toMatch(/host/);
    expect(act(s, KEYS[0]!, { t: 'start' }, now)).toMatch(/3 players/);
    join(s, KEYS[2]!, 'Ana', now);
    expect(s.seats.map((x) => x.name)).toEqual(['Ana', 'Bo', 'Ana 2']);
    expect(act(s, KEYS[0]!, { t: 'start' }, now)).toBeNull();
    expect(s.phase).toBe('picking');
    for (const x of s.seats) expect(x.hand).toHaveLength(HAND_SIZE);
  });

  it('plays a full round: judge waits, everyone plays, judge picks, a point is scored', () => {
    const s = room();
    const judgeKey = keyOfSeat(s, s.judge);
    expect(act(s, judgeKey, { t: 'play', cards: [s.seats.find((x) => x.key === judgeKey)!.hand[0]!] }, now)).toMatch(/judge/);
    playAll(s);
    expect(s.phase).toBe('judging');
    const jv = viewFor(s, judgeKey)!;
    expect(jv.entries).toHaveLength(3);
    expect(jv.entries.every((e) => e.name === undefined)).toBe(true);
    expect(act(s, judgeKey, { t: 'pick', entry: 1 }, now)).toBeNull();
    expect(s.phase).toBe('reveal');
    expect(s.seats.reduce((n, x) => n + x.score, 0)).toBe(1);
    const rv = viewFor(s, KEYS[0]!)!;
    expect(rv.entries.filter((e) => e.won)).toHaveLength(1);
    expect(rv.entries.every((e) => typeof e.name === 'string')).toBe(true);
    // Hands are topped up and the judge moves on next round.
    const prevJudge = s.judge;
    now += 10_000;
    tick(s, now);
    expect(s.phase).toBe('picking');
    expect(s.judge).not.toBe(prevJudge);
    for (const x of s.seats) expect(x.hand).toHaveLength(HAND_SIZE);
  });

  it('never shows another player\'s hand or key', () => {
    const s = room();
    const v = viewFor(s, KEYS[1]!)!;
    const text = JSON.stringify(v);
    for (const k of KEYS) expect(text).not.toContain(k);
    const mine = s.seats.find((x) => x.key === KEYS[1])!.hand;
    expect(v.hand.map((c) => c.id)).toEqual(mine);
  });

  it('does not repeat cards in a session', () => {
    const s = room();
    const seenPrompts: number[] = [];
    const played: number[] = [];
    for (let r = 0; r < 40 && s.phase !== 'over'; r++) {
      if (s.phase !== 'picking') break;
      seenPrompts.push(s.prompt!);
      playAll(s);
      played.push(...s.entries.flatMap((e) => e.cards));
      if ((s.phase as string) === 'judging') act(s, keyOfSeat(s, s.judge), { t: 'pick', entry: 0 }, now);
      now += 10_000;
      tick(s, now);
    }
    expect(s.phase).toBe('over');
    expect(new Set(seenPrompts).size).toBe(seenPrompts.length);
    expect(new Set(played).size).toBe(played.length);
    expect(s.seats.some((x) => x.score >= s.settings.target)).toBe(true);
    expect(viewFor(s, KEYS[0]!)!.history.length).toBeGreaterThan(0);
  });

  it('moves on when time runs out: missing players are skipped, then the judge is picked for', () => {
    const s = room();
    const judgeKey = keyOfSeat(s, s.judge);
    const player = s.seats.find((x) => x.key !== judgeKey)!;
    act(s, player.key, { t: 'play', cards: player.hand.slice(0, viewFor(s, player.key)!.prompt!.pick) }, now);
    now += 200_000;
    tick(s, now);
    // Only one card played: it wins by default.
    expect(s.phase).toBe('reveal');
    expect(s.winners).toEqual([player.n]);
  });

  it('vote mode: everyone plays, nobody votes for themselves, the most votes win', () => {
    const s = room(4, true);
    expect(s.judge).toBeNull();
    playAll(s);
    expect(s.phase).toBe('judging');
    const own = (k: string): number => viewFor(s, k)!.entries.findIndex((e) => e.mine);
    expect(act(s, KEYS[0]!, { t: 'vote', entry: own(KEYS[0]!) }, now)).toMatch(/yourself/);
    const target = (own(KEYS[0]!) + 1) % 4;
    for (const k of KEYS) {
      const pickFor = own(k) === target ? (target + 1) % 4 : target;
      expect(act(s, k, { t: 'vote', entry: pickFor }, now)).toBeNull();
    }
    expect(s.phase).toBe('reveal');
    expect(s.winners).toHaveLength(1);
    expect(viewFor(s, KEYS[0]!)!.entries[target]!.won).toBe(true);
  });

  it('keeps your seat and cards when you reconnect; a late joiner waits for the next round', () => {
    const s = room();
    const hand = [...s.seats[1]!.hand];
    leave(s, KEYS[1]!, now);
    expect(s.seats[1]!.online).toBe(false);
    join(s, KEYS[1]!, 'whatever', now);
    expect(s.seats[1]!.hand).toEqual(hand);
    expect(s.seats[1]!.name).toBe('P2');
    const late = 'eeeeeeeeeeeeeeeeeeeeeeee';
    join(s, late, 'Late', now);
    expect(viewFor(s, late)!.waiting).toBe(true);
    expect(stillPicking(s).some((x) => x.key === late)).toBe(false);
  });

  it('hands the host role on, and lets the host remove players', () => {
    const s = room();
    leave(s, KEYS[0]!, now);
    expect(s.host).toBe(s.seats[1]!.n);
    expect(act(s, KEYS[2]!, { t: 'kick', seat: s.seats[3]!.n }, now)).toMatch(/host/);
    expect(act(s, KEYS[1]!, { t: 'kick', seat: s.seats[3]!.n }, now)).toBeNull();
    expect(s.seats).toHaveLength(3);
  });

  it('allows one hand swap per game', () => {
    const s = room();
    const p = s.seats.find((x) => x.n !== s.judge)!;
    const before = [...p.hand];
    expect(act(s, p.key, { t: 'swap' }, now)).toBeNull();
    expect(p.hand).toHaveLength(HAND_SIZE);
    expect(p.hand.some((c) => before.includes(c))).toBe(false);
    expect(act(s, p.key, { t: 'swap' }, now)).toMatch(/already/);
  });

  it('starts a new game with a fresh swap and no old greatest hits', () => {
    const s = room();
    const p = s.seats.find((x) => x.n !== s.judge)!;
    expect(act(s, p.key, { t: 'swap' }, now)).toBeNull();
    for (let i = 0; i < 200 && s.phase !== 'over'; i++) {
      playAll(s);
      now += 200_000;
      tick(s, now);
    }
    expect(s.phase).toBe('over');
    expect(s.history.length).toBeGreaterThan(0);
    expect(act(s, keyOfSeat(s, s.host), { t: 'start' }, now)).toBeNull();
    expect(s.history).toEqual([]);
    expect(s.seats.every((x) => !x.swapped && x.score === 0)).toBe(true);
  });

  it('keeps every vote on the right card when the host removes a player mid-vote', () => {
    const s = room(4, true);
    playAll(s);
    expect(s.phase).toBe('judging');
    const own = (k: string): number => s.entries.findIndex((e) => e.seat === s.seats.find((x) => x.key === k)!.n);
    // P1 votes for the last card; then the host removes the player whose card comes first.
    const first = s.entries[0]!.seat;
    const voter = KEYS.find((k) => own(k) !== 3 && keyOfSeat(s, first) !== k && k !== KEYS[0])!;
    const lastCard = s.entries[3]!.cards;
    expect(act(s, voter, { t: 'vote', entry: 3 }, now)).toBeNull();
    expect(act(s, KEYS[0]!, { t: 'kick', seat: first === s.seats[0]!.n ? s.seats[1]!.n : first }, now)).toBeNull();
    const voted = s.votes[s.seats.find((x) => x.key === voter)?.n ?? -1];
    if (voted !== undefined) expect(s.entries[voted]!.cards).toEqual(lastCard);
    for (const i of Object.values(s.votes)) expect(s.entries[i]).toBeDefined();
  });

  it('starts the round over when every played card is removed while judging', () => {
    const s = room(4);
    playAll(s);
    expect(s.phase).toBe('judging');
    // The host judges the first round, so every card on the table is someone else's.
    expect(s.judge).toBe(s.host);
    for (const e of [...s.entries]) act(s, KEYS[0]!, { t: 'kick', seat: e.seat }, now);
    expect(s.entries).toEqual([]);
    expect(s.phase).not.toBe('judging');
    now += 200_000;
    expect(() => tick(s, now)).not.toThrow();
  });

  it('lets only players in this round vote', () => {
    const s = room(3, true);
    const late = 'eeeeeeeeeeeeeeeeeeeeeeee';
    join(s, late, 'Late', now);
    playAll(s);
    expect(s.phase).toBe('judging');
    expect(act(s, late, { t: 'vote', entry: 0 }, now)).toMatch(/next round/);
    expect(Object.keys(s.votes)).toHaveLength(0);
  });
});
