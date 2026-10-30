import { describe, expect, it } from 'vitest';
import { act, cleanCar, fairTaps, join, leave, liveRace, LEAD_MS, newRoom, replay, settleRace, tick, viewFor, type LiveCar } from '../src/games/launch-control/room';
import { DT } from '../src/games/launch-control/sim';
import { ENGINES, isGameId } from '../rooms/engines';
import { isRoomGame } from '../server/rooms';

const KEY_A = 'aaaaaaaaaaaaaaaaaaaa';
const KEY_B = 'bbbbbbbbbbbbbbbbbbbb';
const car = (id: string, lv = 0): LiveCar => ({ id, levels: [lv, lv, lv, lv, lv, 0], paint: 'p-yellow', livery: 'l-stripes', wheels: 'w-star', helmet: ['#fff', '#e63946'], suit: '#1d3557' });

/** Taps a perfect-ish run: launch at green, then shift in the middle of each green window. */
function goodTaps(cars: LiveCar[], seed: number, i: number): number[] {
  const race = liveRace(cars, seed);
  const taps: number[] = [];
  for (let k = 0; k < 3600 && race.racers[i]!.phase !== 'done'; k++) {
    const r = race.racers[i]!;
    const w = race.windowOf(i);
    const frac = r.rpm / r.spec.redline;
    if ((r.phase === 'staging' && race.out) || (r.phase === 'running' && w && frac >= (w.lo + w.hi) / 2)) {
      if (taps[taps.length - 1] !== k) {
        taps.push(k);
        race.tap(i);
      }
    }
    race.step();
  }
  return taps;
}

describe('Launch Control live: the room', () => {
  it('is a room game the server knows', () => {
    expect(isGameId('drag') && isRoomGame('drag')).toBe(true);
    expect(ENGINES.drag.newRoom('ABCDE', 0, 1)).toMatchObject({ game: 'drag', phase: 'lobby' });
  });

  it('seats two, starts when both pick a car and say ready, and settles the race from both tap lists', () => {
    const s = newRoom('ABCDE', 1000, 42);
    expect(join(s, KEY_A, 'Ana', 1000)).toBeNull();
    expect(join(s, KEY_B, 'Bo', 1000)).toBeNull();
    expect(join(s, 'cccccccccccccccccccc', 'Cy', 1000)).toBe('full');
    expect(act(s, KEY_A, { t: 'ready', ready: true }, 1100)).toMatch(/car/);
    act(s, KEY_A, { t: 'car', car: car('bumble', 2) }, 1100);
    act(s, KEY_B, { t: 'car', car: car('pico-pop') }, 1100);
    act(s, KEY_A, { t: 'ready', ready: true }, 1200);
    expect(s.phase).toBe('lobby');
    act(s, KEY_B, { t: 'ready', ready: true }, 1300);
    expect(s.phase).toBe('race');
    expect(s.startAt).toBe(1300 + LEAD_MS);
    const va = viewFor(s, KEY_A)!;
    expect(va.lanes).toHaveLength(2);
    // each phone races its taps; the room relays them
    const cars = s.lanes.map((n) => s.players[n]!.car!);
    const tapsA = goodTaps(cars, s.raceSeed, 0);
    const at = (k: number): number => s.startAt! + Math.ceil(k * DT * 1000) + 50;
    for (const k of tapsA) act(s, KEY_A, { t: 'tap', step: k }, at(k));
    expect(viewFor(s, KEY_B)!.taps[s.lanes[0]!]).toEqual(tapsA);
    // a stale (backwards) tap is ignored
    act(s, KEY_A, { t: 'tap', step: 0 }, at(tapsA[tapsA.length - 1]!));
    expect(s.players[s.lanes[0]!]!.taps).toEqual(tapsA);
    const end = at(3000);
    act(s, KEY_A, { t: 'finish', taps: tapsA }, end);
    expect(s.phase).toBe('race');
    act(s, KEY_B, { t: 'finish', taps: [] }, end);
    expect(s.phase).toBe('result');
    // Ana tapped a good run, Bo never tapped (auto launch, limiter all the way): Ana wins and scores
    expect(s.last!.winner).toBe(s.lanes[0]);
    expect(s.seats.find((x) => x.n === s.lanes[0])!.score).toBe(1);
    // both ready again: a rematch on a new seed
    const seed = s.raceSeed;
    act(s, KEY_A, { t: 'ready', ready: true }, 20000);
    act(s, KEY_B, { t: 'ready', ready: true }, 20000);
    expect(s.phase).toBe('race');
    expect(s.round).toBe(2);
    expect(s.raceSeed).not.toBe(seed);
  });

  it('settles when time runs out, and a friend who leaves the lobby frees the seat', () => {
    const s = newRoom('ABCDE', 0, 7);
    join(s, KEY_A, 'Ana', 0);
    join(s, KEY_B, 'Bo', 0);
    act(s, KEY_A, { t: 'car', car: car('bumble') }, 0);
    act(s, KEY_B, { t: 'car', car: car('bumble') }, 0);
    act(s, KEY_A, { t: 'ready', ready: true }, 0);
    act(s, KEY_B, { t: 'ready', ready: true }, 0);
    tick(s, s.deadline! + 1);
    expect(s.phase).toBe('result');
    // the same car with no taps on both sides: a dead heat, nobody scores
    expect(s.last!.winner).toBeNull();
    expect(s.seats.every((x) => x.score === 0)).toBe(true);
    const lobby = newRoom('FGHJK', 0, 1);
    join(lobby, KEY_A, 'Ana', 0);
    join(lobby, KEY_B, 'Bo', 0);
    leave(lobby, KEY_B, 10);
    expect(lobby.seats).toHaveLength(1);
    expect(join(lobby, 'cccccccccccccccccccc', 'Cy', 20)).toBeNull();
  });

  it('refuses taps from the future, early finishes and anticipated launches; settles when a racer drops out', () => {
    const s = newRoom('ABCDE', 0, 5);
    join(s, KEY_A, 'Ana', 0);
    join(s, KEY_B, 'Bo', 0);
    act(s, KEY_A, { t: 'car', car: car('bumble') }, 0);
    act(s, KEY_B, { t: 'car', car: car('bumble') }, 0);
    act(s, KEY_A, { t: 'ready', ready: true }, 0);
    act(s, KEY_B, { t: 'ready', ready: true }, 0);
    const cars = s.lanes.map((n) => s.players[n]!.car!);
    const taps = goodTaps(cars, s.raceSeed, 0);
    const a = s.lanes[0]!;
    // before the race clock even starts: a perfect run is refused, tap by tap and as a finish list
    for (const k of taps) act(s, KEY_A, { t: 'tap', step: k }, s.startAt! - 5000);
    expect(s.players[a]!.taps.length).toBeLessThan(2);
    act(s, KEY_A, { t: 'finish', taps }, s.startAt! - 5000);
    expect(s.players[a]!.finished).toBe(false);
    // half way down the strip the car can't have crossed yet
    act(s, KEY_A, { t: 'finish', taps: taps.filter((k) => k < 600) }, s.startAt! + 5000);
    expect(s.players[a]!.finished).toBe(false);
    // a launch tap 3 ms after lights out is a guess: the room counts it as a jump start
    const race = liveRace(cars, s.raceSeed);
    const out = Math.ceil(race.outAt / DT - 1e-9);
    expect(fairTaps(race, [out, out + 200])).toEqual([out - 1, out + 200]);
    expect(fairTaps(race, [out + 30])).toEqual([out + 30]);
    expect(taps[0]).toBe(out);
    expect(replay(liveRace(cars, s.raceSeed), [taps, []]).result().racers[0]!.launch).toBe('perfect');
    expect(replay(liveRace(cars, s.raceSeed), [fairTaps(race, taps), []]).result().racers[0]!.launch).toBe('jump');
    const settled = settleRace(cars, [taps, []], s.raceSeed, [1, 2]);
    expect(settled.times[1]!.crossed!).toBeGreaterThan(replay(liveRace(cars, s.raceSeed), [taps, []]).result().racers[0]!.crossed!);
    // Ana finishes on time; Bo drops out mid-race: the room settles at once instead of at the deadline
    const done = s.startAt! + 30000;
    act(s, KEY_A, { t: 'finish', taps }, done);
    expect(s.players[a]!.finished).toBe(true);
    expect(s.phase).toBe('race');
    leave(s, KEY_B, done + 100);
    expect(s.phase).toBe('result');
    expect(s.last!.winner).toBe(a);
  });

  it('refuses cars that are not in the game or not possible', () => {
    expect(cleanCar(car('bumble'))).not.toBeNull();
    expect(cleanCar(car('not-a-car'))).toBeNull();
    expect(cleanCar({ ...car('bumble'), levels: [9, 0, 0, 0, 0, 0] })).toBeNull();
    expect(cleanCar({ ...car('bumble'), suit: 'red' })).toBeNull();
    expect(cleanCar(null)).toBeNull();
  });
});

describe('Launch Control live: both phones agree', () => {
  it('the race does not depend on which phone has which lane, and a late tap replays to the same run', () => {
    const cars = [car('bumble', 3), car('pico-pop', 1)];
    const seed = 99;
    const a = goodTaps(cars, seed, 0);
    const b = goodTaps(cars, seed, 1);
    const fromA = replay(liveRace(cars, seed), [a, b]).result();
    const fromB = replay(liveRace([cars[1]!, cars[0]!], seed), [b, a]).result();
    expect(fromA.racers[0]!.et).toBeCloseTo(fromB.racers[1]!.et!, 9);
    expect(fromA.racers[1]!.et).toBeCloseTo(fromB.racers[0]!.et!, 9);
    expect(settleRace(cars, [a, b], seed, [1, 2]).winner).toBe(settleRace([cars[1]!, cars[0]!], [b, a], seed, [2, 1]).winner);
    // live play: a's taps applied as they happen, b's arriving 20 steps (a sixth of a second) late, replayed when they land
    let race = liveRace(cars, seed);
    let ai = 0;
    const seen: number[] = [];
    for (let k = 0; k < 3600 && !race.done; k++) {
      const arrived = b.filter((x) => x + 20 <= k);
      if (arrived.length > seen.length) {
        seen.splice(0, seen.length, ...arrived);
        race = replay(liveRace(cars, seed), [a.filter((x) => x < k), seen.filter((x) => x < k)], k);
        ai = a.filter((x) => x < k).length;
      }
      while (ai < a.length && a[ai] === k) {
        race.tap(0);
        ai++;
      }
      race.step();
    }
    expect(race.result().racers[0]!.et).toBeCloseTo(fromA.racers[0]!.et!, 9);
    expect(race.result().racers[1]!.et).toBeCloseTo(fromA.racers[1]!.et!, 9);
  });
});
