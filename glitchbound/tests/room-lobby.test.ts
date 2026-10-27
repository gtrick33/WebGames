import { describe, expect, it } from 'vitest';
import { CLAIM_MS, list, match, prune, put, reserve, RESERVE_MS, STALE_MS, type Lobby } from '../rooms/lobby';
import { ENGINES, QUICK } from '../rooms/engines';

const T0 = 1_800_000_000_000;
const report = (code: string, over: Partial<Parameters<typeof put>[1]> = {}) => ({ code, game: 'hues', phase: 'lobby', players: 2, max: 12, host: 'Ana', full: false, matched: false, at: T0, ...over });

describe('public room list', () => {
  it('lists public rooms with a free seat, open lobbies and busy rooms first', () => {
    const l: Lobby = {};
    put(l, report('AAAAA', { players: 1 }), T0);
    put(l, report('BBBBB', { players: 5 }), T0);
    put(l, report('CCCCC', { players: 8, phase: 'guess' }), T0);
    put(l, report('DDDDD', { full: true }), T0);
    put(l, report('EEEEE', { game: 'rps' }), T0);
    expect(list(l, T0, 'hues').map((r) => r.code)).toEqual(['BBBBB', 'AAAAA', 'CCCCC']);
    expect(list(l, T0).map((r) => r.code)).toContain('EEEEE');
  });

  it('forgets rooms everyone left, and rooms that stopped reporting', () => {
    const l: Lobby = {};
    put(l, report('AAAAA'), T0);
    put(l, report('AAAAA', { players: 0 }), T0 + 1000);
    expect(l.AAAAA).toBeUndefined();
    put(l, report('BBBBB'), T0);
    prune(l, T0 + STALE_MS + 1);
    expect(l.BBBBB).toBeUndefined();
  });
});

describe('quick match', () => {
  it('sends searchers to the fullest open room of the game, quick-match rooms first', () => {
    const l: Lobby = {};
    put(l, report('AAAAA', { players: 4 }), T0);
    put(l, report('BBBBB', { players: 2, matched: true }), T0);
    put(l, report('CCCCC', { players: 6, phase: 'guess' }), T0);
    expect(match(l, 'hues', T0)?.code).toBe('BBBBB');
    expect(match(l, 'hues', T0, ['BBBBB'])?.code).toBe('AAAAA');
    expect(match(l, 'rps', T0)).toBeNull();
  });

  it('holds seats for players on their way, so a two-seat room is not overbooked', () => {
    const l: Lobby = {};
    put(l, report('AAAAA', { game: 'backgammon', players: 1, max: 2, matched: true }), T0);
    expect(match(l, 'backgammon', T0 + 10)?.code).toBe('AAAAA');
    expect(match(l, 'backgammon', T0 + 20)).toBeNull();
    // The seat frees up if nobody arrives.
    expect(match(l, 'backgammon', T0 + 20 + CLAIM_MS)?.code).toBe('AAAAA');
  });

  it('keeps a new quick-match room for the searcher, and the next searcher joins it', () => {
    const l: Lobby = {};
    reserve(l, 'NEWRM', 'scribble', 10, T0);
    // The room's own first report (nobody in yet) does not drop it.
    put(l, report('NEWRM', { game: 'scribble', players: 0, matched: true }), T0 + 50);
    expect(match(l, 'scribble', T0 + 100)?.code).toBe('NEWRM');
    // Nobody ever came: it lapses.
    prune(l, T0 + RESERVE_MS + 1);
    expect(l.NEWRM).toBeUndefined();
  });
});

describe('quick match rules', () => {
  it('cover every room game with sensible numbers', () => {
    for (const game of Object.keys(ENGINES) as (keyof typeof ENGINES)[]) {
      const q = QUICK[game];
      expect(q.min).toBeGreaterThanOrEqual(2);
      expect(q.full).toBeGreaterThanOrEqual(q.min);
      expect(q.seats).toBeGreaterThanOrEqual(q.full);
    }
  });
});
