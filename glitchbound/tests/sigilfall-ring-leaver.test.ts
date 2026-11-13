/** Leaving a rated Ring match: half again a loss, whether walked out of or not come back to. */
import { beforeEach, describe, expect, it } from 'vitest';
import { afterMatch, forfeitLive, LEAVER_K, NEW_STANDING, readRing, writeRing } from '../src/games/sigilfall/arena/ladder';
import { liveGoing, LIVE_WAIT, readLive, writeLive, type LiveMatch } from '../src/games/sigilfall/arena/live';
import type { Snapshot } from '../src/games/sigilfall/arena/sim';

const live = (p: Snapshot['p'] | null, at = Date.now()): LiveMatch => ({
  setup: { seed: 1, map: 'sands', fighters: [] },
  rival: { name: 'The Zealot', blurb: '', team: [] },
  skill: 0.5,
  rivalRating: 1000,
  format: 1,
  stakes: { format: 1, rating: 1000, rank: '', color: '', win: 16, lose: 16, rival: 'The Zealot', blurb: '', rivalRating: 1000 },
  at,
  ...(p ? { snap: { p } as Snapshot } : {}),
});

describe('ring leavers', () => {
  beforeEach(() => localStorage.clear());

  it('a leaver loses half again what a loss costs', () => {
    const plain = afterMatch({ ...NEW_STANDING, rating: 1000 }, 1000, false);
    const left = afterMatch({ ...NEW_STANDING, rating: 1000 }, 1000, false, LEAVER_K);
    expect(left.change).toBe(Math.round(plain.change * 1.5));
    // (a win is a win)
    expect(afterMatch({ ...NEW_STANDING, rating: 1000 }, 1000, true, LEAVER_K).change).toBe(afterMatch({ ...NEW_STANDING, rating: 1000 }, 1000, true).change);
  });

  it('a match left while going waits a while, then counts as a leaver’s loss', () => {
    expect(liveGoing(live('fight'))).toBe(true);
    expect(liveGoing(live('fight', Date.now() - LIVE_WAIT - 1))).toBe(false);
    writeRing({ standings: { 1: { ...NEW_STANDING, rating: 1000, wins: 10, losses: 10 } }, sets: {} });
    const l = live('fight');
    writeLive(l);
    const change = forfeitLive(l);
    expect(change).toBe(-24);
    expect(readRing().standings[1]!.rating).toBe(976);
    expect(readLive()).toBeNull();
  });

  it('left before the gates lifted costs nothing', () => {
    writeRing({ standings: { 1: { ...NEW_STANDING, rating: 1000, wins: 10, losses: 10 } }, sets: {} });
    expect(forfeitLive(live('gates'))).toBe(0);
    expect(readRing().standings[1]!.rating).toBe(1000);
  });
});
