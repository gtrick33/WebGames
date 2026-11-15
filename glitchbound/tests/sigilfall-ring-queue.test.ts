/**
 * Looking for a match in The Ring: other players first, the computer after ten seconds (the owner: "try to find
 * existing players for a while and after 10 secs of loading screen, load bots if noone is queing"). The searchers here
 * are driven by the same rules the game uses (arena/queue.ts), against the room the rooms worker runs
 * (net/ringRoom.ts) and the lobby that pairs them (rooms/lobby.ts).
 */
import { describe, expect, it } from 'vitest';
import { match, put, reserve, list, type Lobby } from '../rooms/lobby';
import { afterMatch, forfeitLive, LEAVER_K, liveGoing, ratingChange, readRing, standingOf, writeLive, type LiveMatch } from '../src/games/sigilfall/arena/ladder';
import { DROP_MS, FOUND_MS, leftBehind, rivalsOf, SEEK_GRACE_MS, SEEK_MS, seekFacts, seekStep, WRONG_MS } from '../src/games/sigilfall/arena/queue';
import { NEW_STANDING } from '../src/games/sigilfall/arena/ranks';
import type { Format } from '../src/games/sigilfall/arena/ranks';
import { act, cleanPick, join, leave, newRoom, summary, viewFor, type State } from '../src/games/sigilfall/net/ringRoom';

const KEY = (i: number): string => String.fromCharCode(97 + i).repeat(20);
const PICK = { cls: 'warrior', bar: ['w-strike', 'w-rend', 'w-charge', 'w-shout'], talents: [] };

/** A searcher: when they began, what they want, and what they have seen of the room. */
interface Searcher {
  i: number;
  format: Format;
  since: number;
  fullAt: number;
  wrongAt: number;
  out: 'bots' | 'next' | null;
}

const seat = (s: State, i: number, format: Format, now: number): Searcher => {
  expect(join(s, KEY(i), `P${i}`, now)).toBeNull();
  return { i, format, since: now, fullAt: 0, wrongAt: 0, out: null };
};

/** One look at the room by one searcher, and what they do about it (as net/ringSeek.ts does). */
function turn(s: State, p: Searcher, now: number): string {
  if (p.out || s.phase === 'run') return 'idle';
  const v = viewFor(s, KEY(p.i))!;
  const f = seekFacts(v, p.format);
  p.fullAt = f.full ? p.fullAt || now : 0;
  p.wrongAt = f.wrong ? p.wrongAt || now : 0;
  const step = seekStep(f, now - p.since, p.fullAt ? now - p.fullAt : 0, p.wrongAt ? now - p.wrongAt : 0);
  if (step.do === 'setup') expect(act(s, KEY(p.i), { t: 'setup', format: p.format, map: 'forge' }, now)).toBeNull();
  else if (step.do === 'pick') act(s, KEY(p.i), { t: 'pick', pick: { ...PICK, team: step.team } }, now);
  else if (step.do === 'start') expect(act(s, KEY(p.i), { t: 'start' }, now)).toBeNull();
  else if (step.do === 'bots' || step.do === 'next') {
    p.out = step.do;
    act(s, KEY(p.i), { t: 'bye' }, now);
  }
  return step.do;
}

/** Everyone looks, a quarter second apart, until `until`. */
function wait(s: State, ps: Searcher[], from: number, until: number): number {
  let now = from;
  for (; now <= until && s.phase !== 'run'; now += 250) for (const p of ps) turn(s, p, now);
  return now;
}

const sides = (s: State): [number[], number[]] => [0, 1].map((t) => s.seats.filter((x) => s.picks[x.n]?.team === t).map((x) => x.n)) as [number[], number[]];

describe('Sigilfall: a search finds other players first', () => {
  it('two looking for a 1v1 are put on opposite sides and the gates open at once', () => {
    const s = newRoom('ABCDE', 0, 7);
    const a = seat(s, 0, 1, 0);
    wait(s, [a], 0, 2000);
    expect(s.format).toBe(1);
    expect(s.map).toBe('forge');
    expect(s.phase).toBe('lobby');
    const b = seat(s, 1, 1, 2000);
    const at = wait(s, [a, b], 2000, 9000);
    expect(s.phase).toBe('run');
    // (a moment to read who was found, and no more: not the rest of the ten seconds)
    expect(at - 2000).toBeGreaterThanOrEqual(FOUND_MS);
    expect(at - 2000).toBeLessThan(FOUND_MS + 1000);
    expect(sides(s).map((x) => x.length)).toEqual([1, 1]);
    expect(a.out).toBeNull();
    expect(b.out).toBeNull();
  });

  it('nobody in ten seconds: the computer, and not a moment sooner', () => {
    const s = newRoom('ABCDE', 0, 7);
    const a = seat(s, 0, 1, 0);
    wait(s, [a], 0, SEEK_MS - 250);
    expect(a.out).toBeNull();
    expect(s.phase).toBe('lobby');
    wait(s, [a], SEEK_MS, SEEK_MS);
    expect(a.out).toBe('bots');
    // (and the room is left empty, so the lobby lets it go)
    expect(s.seats.length).toBe(0);
  });

  it('a 2v2 with only two people starts when the first one’s ten seconds are up, one to a side', () => {
    const s = newRoom('ABCDE', 0, 7);
    const a = seat(s, 0, 2, 0);
    wait(s, [a], 0, 4000);
    const b = seat(s, 1, 2, 4000);
    wait(s, [a, b], 4000, SEEK_MS - 250);
    expect(s.phase).toBe('lobby');
    expect(sides(s).map((x) => x.length)).toEqual([1, 1]);
    wait(s, [a, b], SEEK_MS, SEEK_MS + 500);
    expect(s.phase).toBe('run');
    expect(s.format).toBe(2);
  });

  it('four looking for a 2v2 end two to a side, however they sat down', () => {
    const s = newRoom('ABCDE', 0, 7);
    const a = seat(s, 0, 2, 0);
    wait(s, [a], 0, 500);
    // (three arrive in the same moment and all see the same empty side)
    const rest = [1, 2, 3].map((i) => seat(s, i, 2, 500));
    for (const p of rest) act(s, KEY(p.i), { t: 'pick', pick: { ...PICK, team: 1 } }, 500);
    wait(s, [a, ...rest], 500, 9000);
    expect(s.phase).toBe('run');
    expect(sides(s).map((x) => x.length)).toEqual([2, 2]);
  });

  it('a room for another format is left, after a moment for its host to set it', () => {
    const s = newRoom('ABCDE', 0, 7);
    const a = seat(s, 0, 3, 0);
    wait(s, [a], 0, 500);
    expect(s.format).toBe(3);
    const b = seat(s, 1, 1, 500);
    expect(turn(s, b, 500)).toBe('wait');
    expect(turn(s, b, 500 + WRONG_MS)).toBe('next');
    expect(s.seats.map((x) => x.n)).toEqual([1]);
  });

  it('a third who lands in a full 1v1 moves on and the two fight', () => {
    const s = newRoom('ABCDE', 0, 7);
    const a = seat(s, 0, 1, 0);
    wait(s, [a], 0, 250);
    const b = seat(s, 1, 1, 250);
    turn(s, b, 250);
    const c = seat(s, 2, 1, 300);
    expect(turn(s, c, 300)).toBe('next');
    wait(s, [a, b], 500, 5000);
    expect(s.phase).toBe('run');
    expect(sides(s).map((x) => x.length)).toEqual([1, 1]);
  });

  it('someone whose host never says go fights the computer a little after their own ten seconds', () => {
    const s = newRoom('ABCDE', 0, 7);
    const a = seat(s, 0, 2, 0);
    wait(s, [a], 0, 1000);
    const b = seat(s, 1, 2, 1000);
    // (the host's game has stopped answering: only the other one looks)
    wait(s, [b], 1000, 1000 + SEEK_MS + SEEK_GRACE_MS - 250);
    expect(b.out).toBeNull();
    wait(s, [b], 1000 + SEEK_MS + SEEK_GRACE_MS, 1000 + SEEK_MS + SEEK_GRACE_MS);
    expect(b.out).toBe('bots');
  });

  it('a host who walks off hands the room on, and whoever is left still gets a match or the computer', () => {
    const s = newRoom('ABCDE', 0, 7);
    const a = seat(s, 0, 2, 0);
    wait(s, [a], 0, 6000);
    const b = seat(s, 1, 2, 6000);
    turn(s, b, 6000);
    leave(s, KEY(0), 6500);
    act(s, KEY(0), { t: 'bye' }, 6500);
    expect(viewFor(s, KEY(1))!.host).toBe(viewFor(s, KEY(1))!.you);
    // now the host, alone: their own ten seconds, then the computer
    wait(s, [b], 6500, 6000 + SEEK_MS - 250);
    expect(b.out).toBeNull();
    wait(s, [b], 6000 + SEEK_MS, 6000 + SEEK_MS);
    expect(b.out).toBe('bots');
  });
});

describe('Sigilfall: each format has its own queue', () => {
  const T0 = 1_800_000_000_000;

  it('a search only meets rooms of its own format, and holds no more seats than the format has', () => {
    const l: Lobby = {};
    reserve(l, 'ONEVS', 'sigilfall-ring', 6, T0, '1');
    reserve(l, 'THREE', 'sigilfall-ring', 6, T0, '3');
    expect(match(l, 'sigilfall-ring', T0 + 10, [], '3')?.code).toBe('THREE');
    expect(match(l, 'sigilfall-ring', T0 + 10, [], '2')).toBeNull();
    // (a game with no queues is untouched, and never sees a queue's rooms)
    expect(match(l, 'sigilfall-ring', T0 + 10)).toBeNull();
    // the room reports itself: one player, and room for two in all
    const s = newRoom('ONEVS', T0, 1);
    join(s, KEY(0), 'P0', T0);
    act(s, KEY(0), { t: 'setup', format: 1, map: 'sands' }, T0);
    const sum = summary(s);
    expect(sum.max).toBe(2);
    put(l, { ...sum, matched: true, at: T0 + 100, kind: '1' }, T0 + 100);
    expect(match(l, 'sigilfall-ring', T0 + 200, [], '1')?.code).toBe('ONEVS');
    // that seat is held: a third searcher gets a room of their own
    expect(match(l, 'sigilfall-ring', T0 + 300, [], '1')).toBeNull();
  });

  it('the one a room was opened for is not counted twice once they are in it', () => {
    const l: Lobby = {};
    // (as the worker does it: the room is held, its player arrives a moment later, then the next searcher asks)
    reserve(l, 'DUELS', 'sigilfall-ring', 6, T0, '1');
    put(l, { code: 'DUELS', game: 'sigilfall-ring', phase: 'lobby', players: 0, max: 4, host: '', full: false, matched: true, at: T0 + 20 }, T0 + 20);
    put(l, { code: 'DUELS', game: 'sigilfall-ring', phase: 'lobby', players: 1, max: 4, host: 'Ana', full: false, matched: true, at: T0 + 300 }, T0 + 300);
    put(l, { code: 'DUELS', game: 'sigilfall-ring', phase: 'lobby', players: 1, max: 2, host: 'Ana', full: false, matched: true, at: T0 + 400 }, T0 + 400);
    expect(l.DUELS?.claims).toEqual([]);
    expect(match(l, 'sigilfall-ring', T0 + 3000, [], '1')?.code).toBe('DUELS');
    expect(match(l, 'sigilfall-ring', T0 + 3100, [], '1')).toBeNull();
  });

  it('a room keeps its queue through its own reports, and stays out of the public list', () => {
    const l: Lobby = {};
    reserve(l, 'TWOVS', 'sigilfall-ring', 6, T0, '2');
    put(l, { code: 'TWOVS', game: 'sigilfall-ring', phase: 'lobby', players: 1, max: 4, host: 'Ana', full: false, matched: true, at: T0 + 50 }, T0 + 50);
    expect(l.TWOVS?.kind).toBe('2');
    expect(list(l, T0 + 60, 'sigilfall-ring')).toEqual([]);
    expect(match(l, 'sigilfall-ring', T0 + 60, [], '2')?.code).toBe('TWOVS');
    // once it has started nobody else is sent there
    put(l, { code: 'TWOVS', game: 'sigilfall-ring', phase: 'run', players: 2, max: 4, host: 'Ana', full: false, matched: true, at: T0 + 900 }, T0 + 900);
    expect(match(l, 'sigilfall-ring', T0 + 1000, [], '2')).toBeNull();
  });
});

describe('Sigilfall: a match against people is rated, and a leaver pays for it alone', () => {
  /** A 2v2 that has begun: seats 1 and 3 against 2 and 4, each with the rating they came with. */
  const begun = (): State => {
    const s = newRoom('ABCDE', 0, 7);
    for (let i = 0; i < 4; i++) join(s, KEY(i), `P${i}`, 0);
    act(s, KEY(0), { t: 'setup', format: 2, map: 'frost' }, 0);
    [1000, 1400, 1100, 1200].forEach((rating, i) => expect(act(s, KEY(i), { t: 'pick', pick: { ...PICK, team: (i % 2) as 0 | 1, rating } }, 0)).toBeNull());
    expect(act(s, KEY(0), { t: 'start' }, 0)).toBeNull();
    return s;
  };

  it('a rating travels with a player’s choices, whole and in bounds, and is not asked of a room of friends', () => {
    expect(cleanPick({ ...PICK, team: 0, rating: 1234.6 })?.rating).toBe(1235);
    expect(cleanPick({ ...PICK, team: 0, rating: 1e9 })?.rating).toBe(9999);
    expect(cleanPick({ ...PICK, team: 0, rating: 'high' })).toEqual({ ...PICK, team: 0 });
    expect(cleanPick({ ...PICK, team: 0 })).toEqual({ ...PICK, team: 0 });
  });

  it('each side is up against the other side’s own rating', () => {
    const s = begun();
    expect(rivalsOf(viewFor(s, KEY(0))!)).toEqual({ names: ['P1', 'P3'], rating: 1300, ours: 1050 });
    expect(rivalsOf(viewFor(s, KEY(1))!)).toEqual({ names: ['P0', 'P2'], rating: 1050, ours: 1300 });
    // (so the same result moves the two sides the same way an even match against the computer would)
    expect(ratingChange(1000, 1300, true)).toBeGreaterThan(ratingChange(1400, 1050, true));
  });

  it('someone walking out ends the match for everyone else, at once', () => {
    const s = begun();
    const seats = s.seats.map((x) => x.n);
    const away = new Map<number, number>();
    expect(leftBehind(viewFor(s, KEY(0))!, seats, away, 1000)).toBe(false);
    act(s, KEY(3), { t: 'bye' }, 2000);
    for (const i of [0, 1, 2]) expect(leftBehind(viewFor(s, KEY(i))!, seats, new Map(), 2000), `P${i}`).toBe(true);
  });

  it('a lost connection is given a while to come back, and then counts as leaving', () => {
    const s = begun();
    const seats = s.seats.map((x) => x.n);
    const away = new Map<number, number>();
    leave(s, KEY(1), 5000);
    expect(leftBehind(viewFor(s, KEY(0))!, seats, away, 5000)).toBe(false);
    expect(leftBehind(viewFor(s, KEY(0))!, seats, away, 5000 + DROP_MS - 1)).toBe(false);
    // back in time: the count starts again
    expect(join(s, KEY(1), 'P1', 9000)).toBeNull();
    expect(leftBehind(viewFor(s, KEY(0))!, seats, away, 9000)).toBe(false);
    expect(away.size).toBe(0);
    leave(s, KEY(1), 10_000);
    expect(leftBehind(viewFor(s, KEY(0))!, seats, away, 10_000)).toBe(false);
    expect(leftBehind(viewFor(s, KEY(0))!, seats, away, 10_000 + DROP_MS)).toBe(true);
  });

  it('a match against people that was closed can’t be gone back to: it is a leaver’s loss, as against the computer', () => {
    const live: LiveMatch = {
      setup: { seed: 1, map: 'sands', fighters: [] },
      rival: { name: 'P1', blurb: '', team: [] },
      skill: 0,
      rivalRating: 1000,
      format: 1,
      stakes: { format: 1, rating: 1000, rank: 'Unblooded', color: '#fff', win: 16, lose: 16, rival: 'P1', blurb: '', rivalRating: 1000 },
      at: Date.now(),
      people: true,
    };
    expect(liveGoing(live)).toBe(false);
    expect(liveGoing({ ...live, people: false })).toBe(true);
    // closed before the gates lifted: nothing
    writeLive(live);
    expect(forfeitLive(live)).toBe(0);
    // closed while it was fought: what walking out of it costs
    const before = standingOf(readRing(), 1).rating;
    const fought = { ...live, snap: { p: 'fight' } as LiveMatch['snap'] };
    writeLive(fought);
    const cost = forfeitLive(fought);
    expect(cost).toBe(afterMatch({ ...NEW_STANDING, rating: before }, 1000, false, LEAVER_K).change);
    expect(cost).toBeLessThan(0);
    expect(standingOf(readRing(), 1).rating).toBe(before + cost);
  });
});
