import { describe, expect, it } from 'vitest';
import { ANSWERS, pickCount, PROMPTS } from '../src/games/crass-act/cards';
import { act, fill, GRACE_MS, HAND_SIZE, join, leave, LOBBY_KEEP_MS, MAX_PLAYERS, newRoom, RECYCLE_MS, stillPicking, summary, tick, viewFor, type Action, type State } from '../src/games/crass-act/engine';

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
    expect(fill('My safe word is ____.', ['The audacity.']).map((p) => p.text).join('')).toBe('My safe word is the audacity.');
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
    // A dropped connection keeps the crown for the grace period; then the next player online has it.
    expect(s.host).toBe(s.seats[0]!.n);
    expect(s.deadline).toBe(now + GRACE_MS);
    tick(s, now + GRACE_MS);
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

  it('plays a tie-breaker when players reach the target together, until exactly one leads', () => {
    const s = room(4, true);
    playAll(s);
    // Two players reach the target in the same round (vote mode can have joint winners).
    s.seats[0]!.score = s.settings.target;
    s.seats[1]!.score = s.settings.target;
    s.phase = 'reveal';
    s.ends = s.deadline = now;
    expect(viewFor(s, KEYS[2]!)!.tiebreak).toBe(true);
    now += 10_000;
    tick(s, now);
    expect(s.phase).toBe('picking');
    expect(s.champion).toBeNull();
    expect(viewFor(s, KEYS[3]!)!.tiebreak).toBe(true);
    // One of them pulls ahead: game over, and they are the champion.
    s.seats[1]!.score++;
    s.phase = 'reveal';
    s.ends = s.deadline = now;
    expect(viewFor(s, KEYS[0]!)!.tiebreak).toBe(false);
    tick(s, now + 1);
    expect(s.phase).toBe('over');
    expect(s.champion).toBe(s.seats[1]!.n);
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

describe('Crass Act Bulgarian deck', () => {
  it('has unique Bulgarian prompts and answers, one or two blanks each', async () => {
    const { ANSWERS_BG, PROMPTS_BG } = await import('../src/games/crass-act/cards-bg');
    expect(PROMPTS_BG.length).toBeGreaterThanOrEqual(75);
    expect(ANSWERS_BG.length).toBeGreaterThanOrEqual(200);
    expect(new Set(PROMPTS_BG).size).toBe(PROMPTS_BG.length);
    expect(new Set(ANSWERS_BG).size).toBe(ANSWERS_BG.length);
    for (const p of PROMPTS_BG) expect([1, 2]).toContain(pickCount(p));
    for (const card of [...PROMPTS_BG, ...ANSWERS_BG]) expect(card).toMatch(/[А-Яа-я]/);
  });

  it('the host switches a room to the Bulgarian cards between games; hands and piles start over', async () => {
    const { ANSWERS_BG, PROMPTS_BG } = await import('../src/games/crass-act/cards-bg');
    const s = newRoom('ABCDE', now, 7);
    KEYS.slice(0, 3).forEach((k, i) => join(s, k, `P${i + 1}`, now));
    expect(s.settings.deck).toBe('en');
    expect(act(s, KEYS[1]!, { t: 'settings', deck: 'bg' }, now)).toBe('Only the host can change settings.');
    expect(act(s, KEYS[0]!, { t: 'settings', deck: 'bg' }, now)).toBeNull();
    expect(act(s, KEYS[0]!, { t: 'start' }, now)).toBeNull();
    const v = viewFor(s, KEYS[1]!)!;
    expect(PROMPTS_BG).toContain(v.prompt!.text);
    for (const c of viewFor(s, KEYS[2]!)!.hand) expect(ANSWERS_BG).toContain(c.text);
    // Mid-game the deck can't change.
    expect(act(s, KEYS[0]!, { t: 'settings', deck: 'en' }, now)).toBe('Settings can only change between games.');
  });

  it('rooms saved before decks existed keep playing the English cards', () => {
    const s = room(3);
    delete (s.settings as { deck?: string }).deck;
    const v = viewFor(s, KEYS[1]!)!;
    expect(PROMPTS).toContain(v.prompt!.text);
  });
});

describe('Crass Act rooms survive people coming and going', () => {
  const key = (i: number): string => `player${String(i).padStart(2, '0')}xxxxxxxxxxxxxxxx`;
  const seatOfKey = (s: State, k: string) => s.seats.find((x) => x.key === k);

  it('refuses crafted vote and pick indexes', () => {
    const s = room(4, true);
    playAll(s);
    expect(s.phase).toBe('judging');
    for (const entry of ['length', '__proto__', -1, 1.5, 99, null] as unknown as number[]) act(s, KEYS[0]!, { t: 'vote', entry }, now);
    expect(s.votes).toEqual({});
    // A bad vote that got into a saved room never voids the real ones.
    s.votes = { 99: 'length' as unknown as number };
    const own = (k: string): number => s.entries.findIndex((e) => e.seat === seatOfKey(s, k)!.n);
    const target = (own(KEYS[1]!) + 1) % 4 === own(KEYS[2]!) ? (own(KEYS[1]!) + 2) % 4 : (own(KEYS[1]!) + 1) % 4;
    for (const k of KEYS.slice(1)) act(s, k, { t: 'vote', entry: own(k) === target ? (target + 1) % 4 : target }, now);
    now += 60_000;
    tick(s, now);
    expect(s.phase).toBe('reveal');
    expect(s.winners).toEqual([s.entries[target]!.seat]);

    const j = room(4);
    playAll(j);
    expect(act(j, keyOfSeat(j, j.judge), { t: 'pick', entry: '__proto__' as unknown as number }, now)).toBeNull();
    expect(j.phase).toBe('judging');
  });

  it('when the judge leaves, the round goes to a quick vote instead of waiting', () => {
    const s = room(4);
    const judgeKey = keyOfSeat(s, s.judge);
    act(s, judgeKey, { t: 'leave' }, now);
    playAll(s);
    expect(s.phase).toBe('judging');
    expect(s.judgeLeft).toBe(true);
    const v = viewFor(s, KEYS.find((k) => k !== judgeKey)!, now)!;
    expect(v.voting && v.judgeLeft).toBe(true);
    expect(v.deadline).toBe(now + 30_000);
    // Everyone still here votes (not for their own card), and the round ends at once.
    const left = KEYS.filter((k) => k !== judgeKey);
    const own = (k: string): number => s.entries.findIndex((e) => e.seat === seatOfKey(s, k)!.n);
    for (const k of left) expect(act(s, k, { t: 'vote', entry: (own(k) + 1) % 3 }, now)).toBeNull();
    expect(s.phase).toBe('reveal');
    // Next round the following player judges, and it is a judge round again.
    const nextJudge = s.seats.find((x) => x.online && x.n > seatOfKey(s, judgeKey)!.n)?.n ?? s.seats.find((x) => x.online)!.n;
    now += 10_000;
    tick(s, now);
    expect(s.phase).toBe('picking');
    expect(s.judgeLeft).toBe(false);
    expect(s.judge).toBe(nextJudge);
  });

  it('when the judge left, the host can settle the vote at once; nobody else can pick', () => {
    const s = room(4);
    // The host judges round 1: let another player's turn come up first.
    playAll(s);
    act(s, keyOfSeat(s, s.judge), { t: 'pick', entry: 0 }, now);
    now += 10_000;
    tick(s, now);
    const judgeKey = keyOfSeat(s, s.judge);
    expect(judgeKey).not.toBe(KEYS[0]);
    act(s, judgeKey, { t: 'leave' }, now);
    playAll(s);
    expect(s.judgeLeft).toBe(true);
    const other = KEYS.find((k) => k !== judgeKey && k !== KEYS[0])!;
    expect(act(s, other, { t: 'pick', entry: 0 }, now)).toBeNull();
    expect(s.phase).toBe('judging');
    expect(act(s, KEYS[0]!, { t: 'pick', entry: 1 }, now)).toBeNull();
    expect(s.phase).toBe('reveal');
    expect(s.winners).toEqual([s.entries[1]!.seat]);
  });

  it('a judge whose connection drops while judging gets the grace period, then everyone votes', () => {
    const s = room(4);
    playAll(s);
    const judgeKey = keyOfSeat(s, s.judge);
    leave(s, judgeKey, now);
    expect(s.judgeLeft).toBeFalsy();
    expect(s.deadline).toBe(now + GRACE_MS);
    now += GRACE_MS;
    tick(s, now);
    expect(s.judgeLeft).toBe(true);
    expect(act(s, judgeKey, { t: 'pick', entry: 0 }, now)).toBeNull();
    expect(s.phase).toBe('judging');
  });

  it('a dropped connection in the lobby keeps the seat and the crown; the opener gets the crown back', () => {
    const s = newRoom('ABCDE', now, 3);
    KEYS.slice(0, 3).forEach((k, i) => join(s, k, `P${i + 1}`, now));
    leave(s, KEYS[0]!, now);
    expect(s.seats).toHaveLength(3);
    expect(s.host).toBe(1);
    join(s, KEYS[0]!, 'P1', now + 5000);
    expect(s.seats.map((x) => x.n)).toEqual([1, 2, 3]);
    expect(s.host).toBe(1);
    // Gone longer: the crown moves on, and comes back when the opener returns.
    leave(s, KEYS[0]!, now);
    tick(s, now + GRACE_MS);
    expect(s.host).toBe(2);
    join(s, KEYS[0]!, 'P1', now + GRACE_MS + 1000);
    expect(s.host).toBe(1);
    // Someone who never comes back is dropped from the lobby after a minute; Leave drops them at once.
    leave(s, KEYS[2]!, now);
    tick(s, now + LOBBY_KEEP_MS);
    expect(s.seats.map((x) => x.n)).toEqual([1, 2]);
    act(s, KEYS[1]!, { t: 'leave' }, now);
    expect(s.seats.map((x) => x.n)).toEqual([1]);
  });

  it('a 3-player round waits out a dropped connection instead of falling back to the lobby', () => {
    const s = room(3);
    const player = s.seats.find((x) => x.n !== s.judge)!;
    leave(s, player.key, now);
    expect(s.phase).toBe('picking');
    join(s, player.key, 'P', now + 10_000);
    tick(s, now + GRACE_MS + 1);
    expect(s.phase).toBe('picking');
    // Not back in time: the round can't go on with two players.
    leave(s, player.key, now + 30_000);
    tick(s, now + 30_000 + GRACE_MS);
    expect(s.phase).toBe('lobby');
  });

  it('frees the seats of players who left so new friends can join a full room', () => {
    const s = newRoom('ABCDE', now, 5);
    for (let i = 0; i < MAX_PLAYERS; i++) expect(join(s, key(i), `P${i}`, now)).toBeNull();
    act(s, key(0), { t: 'start' }, now);
    expect(join(s, key(10), 'New', now)).toBe('full');
    for (let i = 3; i < MAX_PLAYERS; i++) leave(s, key(i), now);
    expect(summary(s, now + 1000).full).toBe(true);
    // A seat is held for a couple of minutes (its player may be on the way back)…
    expect(join(s, key(10), 'New', now + 1000)).toBe('full');
    // …then the longest-gone seat goes to a newcomer.
    const later = now + RECYCLE_MS;
    tick(s, later);
    expect(summary(s, later).full).toBe(false);
    expect(join(s, key(10), 'New', later)).toBeNull();
    expect(s.seats).toHaveLength(MAX_PLAYERS);
    expect(seatOfKey(s, key(3))).toBeUndefined();
    expect(seatOfKey(s, key(10))!.waiting).toBe(true);
    // A returning player whose seat was kept still gets it back.
    expect(join(s, key(4), 'P4', later)).toBeNull();
    expect(seatOfKey(s, key(4))!.n).toBe(5);
  });

  it('a seated player can always get back into a full room', () => {
    const s = newRoom('ABCDE', now, 6);
    for (let i = 0; i < MAX_PLAYERS; i++) join(s, key(i), `P${i}`, now);
    act(s, key(0), { t: 'start' }, now);
    leave(s, key(0), now);
    const hand = [...seatOfKey(s, key(0))!.hand];
    expect(join(s, key(0), 'P0', now + 500_000)).toBeNull();
    expect(seatOfKey(s, key(0))!.hand).toEqual(hand);
  });

  it('the judge moves to the next seat even when the last judge left', () => {
    const s = newRoom('ABCDE', now, 8);
    for (let i = 0; i < 5; i++) join(s, key(i), `P${i}`, now);
    act(s, key(0), { t: 'start' }, now);
    const order: number[] = [s.judge!];
    const next = (): void => {
      for (let i = 0; i < 5; i++) {
        const v = viewFor(s, key(i), now);
        if (v && v.phase === 'picking' && !v.played && v.judge !== v.you && !v.waiting && v.players.find((p) => p.you)!.online)
          act(s, key(i), { t: 'play', cards: v.hand.slice(0, v.prompt!.pick).map((c) => c.id) }, now);
      }
      if (s.phase === 'judging') act(s, keyOfSeat(s, s.host), { t: 'vote', entry: 0 } as Action, now);
      now += 200_000;
      tick(s, now);
      tick(s, now + 200_000);
      now += 200_000;
      if (s.phase === 'reveal') tick(s, (now += 10_000));
      order.push(s.judge!);
    };
    next();
    next();
    act(s, key(2), { t: 'leave' }, now);
    next();
    expect(order).toEqual([1, 2, 3, 4]);
  });

  it('"Play again (new cards)" deals everyone a fresh hand', () => {
    const s = room();
    for (let i = 0; i < 200 && s.phase !== 'over'; i++) {
      playAll(s);
      now += 200_000;
      tick(s, now);
    }
    expect(s.phase).toBe('over');
    const before = s.seats.map((x) => [...x.hand]);
    act(s, keyOfSeat(s, s.host), { t: 'start' }, now);
    s.seats.forEach((x, i) => {
      expect(x.hand).toHaveLength(HAND_SIZE);
      expect(x.hand.some((c) => before[i]!.includes(c))).toBe(false);
    });
  });

  it('in vote mode only the host moves on from the reveal', () => {
    const s = room(4, true);
    playAll(s);
    now += 60_000;
    tick(s, now);
    expect(s.phase).toBe('reveal');
    act(s, KEYS[2]!, { t: 'next' }, now);
    expect(s.phase).toBe('reveal');
    act(s, KEYS[0]!, { t: 'next' }, now);
    expect(s.phase).toBe('picking');
  });

  it('rooms saved before the phase timer had its own field keep their timer', () => {
    const s = room(4);
    const at = s.ends!;
    delete s.ends;
    s.deadline = at;
    expect(viewFor(s, KEYS[0]!, now)!.deadline).toBe(at);
    tick(s, at - 1);
    expect(s.round).toBe(1);
    // Nobody played in time: the next round starts.
    tick(s, at);
    expect(s.round).toBe(2);
  });

  it('never cuts an emoji in half in a name', () => {
    const s = newRoom('ABCDE', now, 1);
    join(s, KEYS[0]!, '😈'.repeat(25), now);
    expect(s.seats[0]!.name).toBe('😈'.repeat(20));
    join(s, KEYS[1]!, '😈'.repeat(25), now);
    expect(s.seats[1]!.name).toBe(`${'😈'.repeat(17)} 2`);
  });
});

describe('Crass Act filled-in cards', () => {
  const text = (prompt: string, cards: string[]): string => fill(prompt, cards).map((p) => p.text).join('');
  it('writes a common first word in lowercase mid-sentence, and keeps names and sentence starts', () => {
    expect(text('Ten out of ten dentists recommend ____.', ['A pig at a dinner party'])).toBe('Ten out of ten dentists recommend a pig at a dinner party.');
    expect(text('Ten out of ten dentists recommend ____.', ['Satan'])).toBe('Ten out of ten dentists recommend Satan.');
    expect(text('I was raised by ____.', ['Grandma\'s dentures'])).toBe('I was raised by Grandma\'s dentures.');
    expect(text('____: the reason I\'m single.', ['A sex dream'])).toBe('A sex dream: the reason I\'m single.');
    expect(text('What\'s that smell? ____.', ['The audacity.'])).toBe('What\'s that smell? The audacity.');
    expect(text('Grandma\'s last text: "____ lol."', ['Crying in the shower'])).toBe('Grandma\'s last text: "Crying in the shower lol."');
    expect(text('Мама пак е сложила ____ в баницата.', ['Баба Марта с проблем с алкохола'])).toBe('Мама пак е сложила Баба Марта с проблем с алкохола в баницата.');
    expect(text('Мама пак е сложила ____ в баницата.', ['Чичо Пешо по потник'])).toBe('Мама пак е сложила чичо Пешо по потник в баницата.');
  });

  it('keeps the period of "a.m." without doubling the full stop', () => {
    expect(text('My safe word is ____.', ['A kebab at 3 a.m.'])).toBe('My safe word is a kebab at 3 a.m.');
    expect(text('____: the reason I\'m tired.', ['A kebab at 3 a.m.'])).toBe('A kebab at 3 a.m.: the reason I\'m tired.');
  });
});
