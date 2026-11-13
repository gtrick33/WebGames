/**
 * The Ring's matchmaking and rating after the owner's notes of 2026-11-13: "initially, if the queues are empty, you
 * should match every player with every player, however, figure out a better mmr matchmaking where rating won/lost is
 * respective and similar to wow ... this matchmaking should be dynamic, if there's no people at all or their number is
 * unsufficient for queue, start the bots match instantly".
 */
import { describe, expect, it } from 'vitest';
import { ACTIVE_MS, match, RATING_ANY_MS, RATING_WINDOW, ratingWindow, reserve, seen, type Lobby, type Seekers } from '../rooms/lobby';
import { afterMatch, K_BASE, K_NEW, PLACEMENT, ratingChange, stakesOf } from '../src/games/sigilfall/arena/ladder';
import { NEW_STANDING } from '../src/games/sigilfall/arena/ranks';

const T0 = 1_800_000_000_000;
const G = 'sigilfall-ring';
const seasoned = { ...NEW_STANDING, wins: 20, losses: 20 };

/** A room quick match opened for a searcher of `rating`, `ago` ms before T0, with that searcher sat down. */
function waiting(l: Lobby, code: string, rating: number, ago = 0, kind = '2'): void {
  const r = reserve(l, code, G, 6, T0 - ago, kind, rating);
  r.players = 1;
  r.claims = [];
}

describe('The Ring: who meets whom', () => {
  it('a thin queue matches everyone with everyone, whatever their ratings', () => {
    const l: Lobby = {};
    waiting(l, 'AAAAA', 2100);
    expect(match(l, G, T0, [], '2', 900)?.code).toBe('AAAAA');
    expect(ratingWindow(0, 1)).toBe(Infinity);
  });

  it('with several waiting, a searcher goes to the one nearest their rating', () => {
    const l: Lobby = {};
    waiting(l, 'AAAAA', 1000);
    waiting(l, 'BBBBB', 1500);
    waiting(l, 'CCCCC', 2000);
    expect(match(l, G, T0, [], '2', 1480)?.code).toBe('BBBBB');
    expect(match(l, G, T0, [], '2', 1950)?.code).toBe('CCCCC');
    // (and only in their own queue)
    expect(match(l, G, T0, [], '3', 1950)).toBeNull();
  });

  it('nobody near enough: the searcher opens their own room rather than being thrown in far above or below', () => {
    const l: Lobby = {};
    waiting(l, 'AAAAA', 1000);
    waiting(l, 'BBBBB', 1100);
    expect(match(l, G, T0, [], '2', 1000 + RATING_WINDOW + 200)).toBeNull();
  });

  it('the window widens the longer a room waits, and a room that has waited long takes anyone', () => {
    expect(ratingWindow(4000, 3)).toBeGreaterThan(ratingWindow(0, 3));
    const l: Lobby = {};
    waiting(l, 'AAAAA', 1000, RATING_ANY_MS);
    waiting(l, 'BBBBB', 1100, RATING_ANY_MS);
    expect(match(l, G, T0, [], '2', 1900)?.code).toBe('BBBBB');
  });

  it('a room’s rating is the mean of the searchers sent to it', () => {
    const l: Lobby = {};
    waiting(l, 'AAAAA', 1000);
    match(l, G, T0, [], '2', 1200);
    expect(l.AAAAA!.mmr).toBe(1100);
    expect(l.AAAAA!.rated).toBe(2);
  });

  it('a search without a rating (every other game’s quick match) is matched as before', () => {
    const l: Lobby = {};
    waiting(l, 'AAAAA', 2400);
    waiting(l, 'BBBBB', 900);
    expect(match(l, G, T0, [], '2')?.code).toBeTruthy();
  });

  it('counts who else is around in a queue, not the searcher themselves, and forgets the quiet', () => {
    const s: Seekers = {};
    expect(seen(s, G, '2', 'aaaaaa', T0)).toBe(0);
    // (the same player searching again is still alone: the computer at once)
    expect(seen(s, G, '2', 'aaaaaa', T0 + 5000)).toBe(0);
    expect(seen(s, G, '3', 'bbbbbb', T0 + 6000)).toBe(0);
    expect(seen(s, G, '2', 'cccccc', T0 + 7000)).toBe(1);
    expect(seen(s, G, '2', 'dddddd', T0 + 5000 + ACTIVE_MS)).toBe(1);
  });
});

describe('The Ring: what a match is worth', () => {
  it('against lower players a win pays less and a loss costs more; against higher, the other way round', () => {
    const lowWin = ratingChange(1600, 1300, true);
    const lowLoss = -ratingChange(1600, 1300, false);
    const evenWin = ratingChange(1600, 1600, true);
    const evenLoss = -ratingChange(1600, 1600, false);
    const highWin = ratingChange(1600, 1900, true);
    const highLoss = -ratingChange(1600, 1900, false);
    expect(lowWin).toBeLessThan(evenWin);
    expect(lowLoss).toBeGreaterThan(evenLoss);
    expect(evenWin).toBe(evenLoss);
    expect(highWin).toBeGreaterThan(evenWin);
    expect(highLoss).toBeLessThan(evenLoss);
    expect(stakesOf(seasoned, 1300, 1600)).toEqual({ win: lowWin, lose: lowLoss });
  });

  it('2v2 and 3v3 against people are worked from the two sides’ means, as rated arenas do', () => {
    // a 1500 carried by a 2100 partner against two 1800s: their side is the favourite, so a win pays less
    const carried = afterMatch({ ...seasoned, rating: 1500 }, 1800, true, 1, 1800);
    const alone = afterMatch({ ...seasoned, rating: 1500 }, 1800, true);
    expect(carried.change).toBe(K_BASE / 2);
    expect(carried.change).toBeLessThan(alone.change);
  });

  it('a newcomer’s first matches move further, while the ladder finds where they belong', () => {
    const fresh = afterMatch({ ...NEW_STANDING }, 1000, true);
    expect(fresh.change).toBe(K_NEW / 2);
    expect(afterMatch({ ...NEW_STANDING, wins: PLACEMENT }, 1000, true).change).toBe(K_BASE / 2);
  });
});
