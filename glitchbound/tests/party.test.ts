import { describe, expect, it } from 'vitest';
import { canBid, minBid, reduceAuction, startAuction, summaries, auctionAwards, type AuctionState } from '../src/party/auction';
import { boardAwards, currentPlayer, makeBoard, reduceBoard, standings, startBoard, BOARD_LENGTH, type Tile } from '../src/party/board';
import { AUCTION_ITEMS } from '../src/party/content/auction';
import { CHALLENGES } from '../src/party/content/challenges';
import { CHARADES, CHARADES_CATEGORIES } from '../src/party/content/charades';
import { NHIE } from '../src/party/content/nhie';
import { TRIVIA } from '../src/party/content/trivia';
import { allowedIntensities, consequenceText, draw, fillChallenge, filterContent, intensityWeights, makePlayer, pickPlayers, playersProblem, rng } from '../src/party/engine';
import { emptySession, sanitizeSession } from '../src/party/session';

const players = ['Ana', 'Bo', 'Cy', 'Di'].map((n, i) => makePlayer(n, i, `id${i}`));

describe('players', () => {
  it('needs 2+ named, distinct players', () => {
    expect(playersProblem(players.slice(0, 1))).toMatch(/at least 2/);
    expect(playersProblem([makePlayer('Ana', 0, 'a'), makePlayer('', 1, 'b')])).toMatch(/name/);
    expect(playersProblem([makePlayer('Ana', 0, 'a'), makePlayer('ana', 1, 'b')])).toMatch(/Two players/);
    expect(playersProblem(players)).toBeNull();
  });

  it('spreads turns: the least-picked players are chosen first', () => {
    const r = rng(1);
    const part = { id0: 5, id1: 5, id2: 0, id3: 5 };
    let cy = 0;
    for (let i = 0; i < 200; i++) if (pickPlayers(players, 1, part, r)[0]!.id === 'id2') cy++;
    expect(cy).toBeGreaterThan(80);
    const two = pickPlayers(players, 2, {}, r);
    expect(two[0]!.id).not.toBe(two[1]!.id);
    expect(pickPlayers(players, 1, {}, r, ['id0', 'id1', 'id2'])[0]!.id).toBe('id3');
  });

  it('fills names and teams into prompts', () => {
    const r = rng(2);
    const f = fillChallenge({ text: '{A} vs {B}', target: 'two' }, players, { part: {}, scores: {}, r });
    expect(f.players).toHaveLength(2);
    expect(f.text).toBe(`${f.players[0]!.name} vs ${f.players[1]!.name}`);
    const lead = fillChallenge({ text: '{A} leads', target: 'leader' }, players, { part: {}, scores: { id3: 9 }, r });
    expect(lead.text).toBe('Di leads');
    const teams = fillChallenge({ text: '{TEAM1} | {TEAM2}', target: 'teams' }, players, { part: {}, scores: {}, r });
    expect(teams.teams![0].length + teams.teams![1].length).toBe(4);
  });
});

describe('content and filters', () => {
  it('has unique ids and placeholders that match the targeting', () => {
    for (const list of [CHALLENGES, NHIE, CHARADES, AUCTION_ITEMS, TRIVIA] as { id: string }[][]) {
      expect(new Set(list.map((x) => x.id)).size).toBe(list.length);
    }
    for (const c of CHALLENGES) {
      if (c.text.includes('{B}')) expect(['two', 'one']).toContain(c.target);
      if (c.target === 'two') expect(c.text).toContain('{B}');
      if (c.text.includes('{TEAM1}')) expect(c.target).toBe('teams');
    }
    expect(CHALLENGES.length).toBeGreaterThan(150);
    expect(NHIE.length).toBeGreaterThan(130);
    expect(CHARADES.length).toBeGreaterThan(250);
    expect(AUCTION_ITEMS.length).toBeGreaterThan(180);
  });

  it('keeps After Dark out unless the group confirmed they are adults, and honours excluded topics', () => {
    const base = { intensities: ['casual', 'spicy', 'afterdark'] as const, adultConfirmed: false, excludedTags: ['phone'] };
    expect(allowedIntensities({ ...base, intensities: [...base.intensities] })).toEqual(['casual', 'spicy']);
    const list = filterContent(CHALLENGES, { ...base, intensities: [...base.intensities] });
    expect(list.some((c) => c.intensity === 'afterdark')).toBe(false);
    expect(list.some((c) => c.tags?.includes('phone'))).toBe(false);
    expect(filterContent(CHALLENGES, { ...base, intensities: ['afterdark'], adultConfirmed: true }).every((c) => c.intensity === 'afterdark')).toBe(true);
  });

  it('never repeats a card until the deck runs out, and never back to back after a reshuffle', () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ id: `x${i}` }));
    const r = rng(3);
    let used: string[] = [];
    const seen: string[] = [];
    for (let i = 0; i < 10; i++) {
      const d = draw(items, used, r);
      seen.push(d.item!.id);
      used = d.used;
    }
    expect(new Set(seen).size).toBe(10);
    const after = draw(items, used, r);
    expect(used.slice(-2)).not.toContain(after.item!.id);
  });

  it('never asks for alcohol when the group chose another consequence', () => {
    const r = rng(4);
    expect(consequenceText('points', 2, r)).toBe('lose 2 points');
    expect(consequenceText('tasks', 1, r)).not.toMatch(/sip|drink/);
    expect(consequenceText('sips', 1, r)).toMatch(/water counts/);
  });
});

describe('Dice & Board Adventure', () => {
  const tiles: Tile[] = [{ kind: 'start' }, { kind: 'rest' }, { kind: 'lucky', value: 3 }, { kind: 'card' }, { kind: 'again' }, { kind: 'swap' }, { kind: 'setback', value: 2 }, { kind: 'rest' }, { kind: 'finish' }];

  it('builds boards of the chosen length with a start and a finish', () => {
    for (const size of ['short', 'medium', 'long'] as const) {
      const b = makeBoard(size, 7);
      expect(b).toHaveLength(BOARD_LENGTH[size]);
      expect(b[0]!.kind).toBe('start');
      expect(b[b.length - 1]!.kind).toBe('finish');
      for (const t of b) if (t.kind === 'shortcut' || t.kind === 'slide') expect(t.value!).toBeGreaterThan(0);
    }
  });

  it('moves, resolves tiles and passes the turn in order', () => {
    let s = startBoard(tiles, ['a', 'b'], 1);
    s = reduceBoard(s, { type: 'roll', value: 1 }); // rest: turn passes immediately
    expect(s.pos.a).toBe(1);
    expect(currentPlayer(s)).toBe('b');
    s = reduceBoard(s, { type: 'roll', value: 2 }); // lucky +3
    expect(s.phase).toBe('event');
    s = reduceBoard(s, { type: 'resolve', ok: true });
    expect(s.pos.b).toBe(5);
    expect(currentPlayer(s)).toBe('a');
    s = reduceBoard(s, { type: 'roll', value: 3 }); // a: 1 -> 4 (again)
    s = reduceBoard(s, { type: 'resolve', ok: true });
    expect(currentPlayer(s)).toBe('a');
    expect(s.phase).toBe('roll');
    s = reduceBoard(s, { type: 'roll', value: 1 }); // a: 4 -> 5 (swap)
    s = reduceBoard(s, { type: 'resolve', ok: true, swapWith: 'b' });
    expect(s.pos).toEqual({ a: 5, b: 5 });
    expect(reduceBoard(s, { type: 'resolve', ok: true })).toBe(s); // nothing to resolve
  });

  it('stops on the finish and crowns the winner', () => {
    let s = startBoard(tiles, ['a', 'b'], 1);
    s = { ...s, pos: { a: 6, b: 0 } };
    s = reduceBoard(s, { type: 'roll', value: 6 });
    expect(s.phase).toBe('done');
    expect(s.winner).toBe('a');
    expect(s.pos.a).toBe(8);
    expect(standings(s)[0]).toBe('a');
    expect(reduceBoard(s, { type: 'roll', value: 3 })).toBe(s);
    expect(boardAwards(s).length).toBeGreaterThan(0);
  });

  it('a challenge skipped moves you back, done moves you forward', () => {
    let s = startBoard(tiles, ['a', 'b'], 1);
    s = reduceBoard(s, { type: 'roll', value: 3 }); // card
    const skipped = reduceBoard(s, { type: 'resolve', ok: false });
    expect(skipped.pos.a).toBe(2);
    const done = reduceBoard(s, { type: 'resolve', ok: true });
    expect(done.pos.a).toBe(4);
  });
});

describe('Name Your Price auctions', () => {
  const items = AUCTION_ITEMS.slice(0, 6);
  const settings = { budget: 10, limit: 2, increment: 1, rounds: 6 };

  it('sells to the highest bidder once everyone else passes and charges only them', () => {
    let s = startAuction(settings, ['a', 'b', 'c'], items);
    expect(s.active).toBe('a');
    s = reduceAuction(s, { type: 'bid' }); // a $1
    expect(s.active).toBe('b');
    s = reduceAuction(s, { type: 'bid', amount: 4 }); // b $4
    s = reduceAuction(s, { type: 'pass' }); // c
    s = reduceAuction(s, { type: 'pass' }); // a
    expect(s.phase).toBe('sold');
    const b = s.players.find((p) => p.id === 'b')!;
    expect(b.budget).toBe(6);
    expect(b.items[0]!.paid).toBe(4);
    expect(s.players.find((p) => p.id === 'a')!.budget).toBe(10);
  });

  it('rejects bids below the minimum or above the budget', () => {
    let s = startAuction(settings, ['a', 'b'], items);
    s = reduceAuction(s, { type: 'bid', amount: 3 });
    expect(minBid(s)).toBe(4);
    expect(reduceAuction(s, { type: 'bid', amount: 2 })).toBe(s);
    expect(reduceAuction(s, { type: 'bid', amount: 11 })).toBe(s);
  });

  it('goes unsold when everyone passes, and moves on', () => {
    let s = startAuction(settings, ['a', 'b'], items);
    s = reduceAuction(reduceAuction(s, { type: 'pass' }), { type: 'pass' });
    expect(s.phase).toBe('unsold');
    s = reduceAuction(s, { type: 'next' });
    expect(s.phase).toBe('bidding');
    expect(s.index).toBe(1);
    expect(s.active).toBe('b'); // the opener rotates
  });

  it('never lets anyone exceed the collection limit and always finishes', () => {
    let s: AuctionState = startAuction({ budget: 50, limit: 1, increment: 1, rounds: 6 }, ['a', 'b'], items);
    for (let guard = 0; guard < 200 && s.phase !== 'done'; guard++) {
      if (s.phase === 'bidding') s = reduceAuction(s, { type: 'bid' });
      else s = reduceAuction(s, { type: 'next' });
      if (s.phase === 'bidding' && s.active && !canBid(s, s.active)) throw new Error('active player cannot bid');
    }
    expect(s.phase).toBe('done');
    for (const p of s.players) expect(p.items.length).toBeLessThanOrEqual(1);
    expect(summaries(s).every((x) => x.left >= 0)).toBe(true);
    expect(auctionAwards(s).length).toBeGreaterThan(0);
  });

  it('a player who runs out of money drops out of bidding', () => {
    let s = startAuction({ budget: 2, limit: 5, increment: 1, rounds: 6 }, ['a', 'b'], items);
    s = reduceAuction(s, { type: 'bid', amount: 2 }); // a spends everything; b cannot afford $3
    expect(s.phase).toBe('sold');
    s = reduceAuction(s, { type: 'next' });
    expect(s.active).toBe('b');
    expect(canBid(s, 'a')).toBe(false);
  });
});

describe('session recovery', () => {
  it('repairs broken saves and keeps what is valid', () => {
    expect(sanitizeSession(null)).toEqual(emptySession());
    const s = sanitizeSession({ v: 1, players: [{ id: 'x', name: '  Zoe  ' }, { bad: true }], settings: { consequence: 'nope', intensities: ['afterdark', 'zzz'] }, scores: { x: 3, y: 'no' } });
    expect(s.players.map((p) => p.name)).toEqual(['Zoe']);
    expect(s.settings.consequence).toBe('points');
    expect(s.settings.intensities).toEqual(['afterdark']);
    expect(s.settings.adultConfirmed).toBe(false);
    expect(s.scores).toEqual({ x: 3 });
  });
});

describe('hotter levels mostly deal their own cards', () => {
  const share = (intensities: ('casual' | 'spicy' | 'afterdark')[], level: string): number => {
    const settings = { intensities, adultConfirmed: true, excludedTags: [] as string[] };
    const deck = filterContent(CHALLENGES, settings);
    const w = intensityWeights(settings);
    const r = rng(11);
    let used: string[] = [];
    let hits = 0;
    const N = 400;
    for (let i = 0; i < N; i++) {
      const d = draw(deck, used, r, (c) => w[c.intensity]);
      used = d.used;
      if (d.item!.intensity === level) hits++;
    }
    return hits / N;
  };

  it('After Dark is mostly After Dark, with only a sprinkle of casual cards', () => {
    expect(share(['casual', 'spicy', 'afterdark'], 'afterdark')).toBeGreaterThan(0.65);
    expect(share(['casual', 'spicy', 'afterdark'], 'casual')).toBeLessThan(0.08);
  });

  it('Spicy is mostly Spicy', () => {
    expect(share(['casual', 'spicy'], 'spicy')).toBeGreaterThan(0.8);
  });

  it('casual-only stays casual and After Dark needs the adult confirmation', () => {
    expect(share(['casual'], 'casual')).toBe(1);
    expect(intensityWeights({ intensities: ['casual', 'afterdark'], adultConfirmed: false }).afterdark).toBe(0);
  });

  it('has plenty of new cards per level and 18+ charades are marked adult', () => {
    const by = (lvl: string) => CHALLENGES.filter((c) => c.intensity === lvl).length;
    expect(by('spicy')).toBeGreaterThan(120);
    expect(by('afterdark')).toBeGreaterThan(150);
    expect(NHIE.filter((n) => n.category === 'adults').length).toBeGreaterThan(80);
    expect(CHARADES_CATEGORIES.find((c) => c.id === 'afterdark')?.adult).toBe(true);
    expect(CHARADES.length).toBeGreaterThan(700);
    // Every touch/kiss dare can be switched off and says skipping is fine.
    for (const c of CHALLENGES.filter((x) => x.tags?.includes('contact'))) expect(c.note).toMatch(/skip/i);
  });
});
