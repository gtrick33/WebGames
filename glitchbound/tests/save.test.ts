import { describe, expect, it } from 'vitest';
import { challengeForDay } from '../src/platform/daily';
import { dayKey } from '../src/platform/dates';
import { applyRound, doneDays, emptySave, readSave, recentSlugs, sanitizeSave, SAVE_KEY, writeSave, type KV } from '../src/platform/save';
import { fakeGame } from './fixtures';

function memKV(initial: Record<string, string> = {}): KV & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v;
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
}

const game = fakeGame();
const games = [game];

describe('reading saves', () => {
  it('starts empty when nothing is stored', () => {
    expect(readSave(memKV())).toEqual(emptySave());
  });

  it('recovers from corrupted JSON and keeps a copy for debugging', () => {
    const kv = memKV({ [SAVE_KEY]: '{not json' });
    expect(readSave(kv)).toEqual(emptySave());
    expect(kv.data[`${SAVE_KEY}.corrupt`]).toBe('{not json');
  });

  it('keeps valid parts and drops invalid ones', () => {
    const save = sanitizeSave({
      v: 1,
      games: {
        ok: { plays: 3, best: { score: 10, bad: 'x', neg: -5 }, last: 5 },
        'BAD SLUG': { plays: 1 },
        weird: 'nope',
      },
      daily: { '2026-10-17': { best: 4, done: true }, yesterday: { best: 1, done: true }, '2026-10-16': { done: 'yes' } },
    });
    expect(save.games).toEqual({ ok: { plays: 3, best: { score: 10 }, last: 5 } });
    expect(save.daily).toEqual({ '2026-10-17': { best: 4, done: true }, '2026-10-16': { best: 0, done: false } });
  });

  it('ignores unknown versions and non-objects', () => {
    expect(sanitizeSave({ v: 2, games: { a: { plays: 1 } } })).toEqual(emptySave());
    expect(sanitizeSave(null)).toEqual(emptySave());
    expect(sanitizeSave([1, 2])).toEqual(emptySave());
  });

  it('survives storage that throws', () => {
    const broken: KV = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('full');
      },
      removeItem: () => undefined,
    };
    expect(readSave(broken)).toEqual(emptySave());
    expect(writeSave(broken, emptySave())).toBe(false);
  });

  it('round-trips through storage', () => {
    const kv = memKV();
    const save = emptySave();
    applyRound(save, game, { type: 'end', score: 42, stats: { time: 30 } }, games, new Date(2026, 9, 1, 12));
    expect(writeSave(kv, save)).toBe(true);
    expect(readSave(kv)).toEqual(save);
  });
});

describe('recording rounds', () => {
  it('tracks plays and bests, honouring lower-is-better stats', () => {
    const save = emptySave();
    const t = new Date(2026, 9, 2, 12);
    const first = applyRound(save, game, { type: 'end', score: 100, stats: { time: 40 } }, games, t);
    expect(first).toMatchObject({ firstPlay: true, newBests: [] });
    const second = applyRound(save, game, { type: 'end', score: 150, stats: { time: 45 } }, games, t);
    expect(second.newBests).toEqual(['score']);
    const third = applyRound(save, game, { type: 'end', score: 120, stats: { time: 31 } }, games, t);
    expect(third.newBests).toEqual(['time']);
    expect(save.games['test-game']).toMatchObject({ plays: 3, best: { score: 150, time: 31 } });
  });

  it('ignores stat keys the registry does not declare', () => {
    const save = emptySave();
    applyRound(save, game, { type: 'end', score: 1, stats: { injected: 999 } }, games, new Date(2026, 9, 2, 12));
    expect(save.games['test-game']?.best).toEqual({ score: 1 });
  });

  it('completes today’s daily challenge once, when the target is reached', () => {
    const now = new Date(2026, 9, 20, 12);
    const challenge = challengeForDay(dayKey(now), games)!;
    const save = emptySave();
    const miss = applyRound(save, game, { type: 'end', score: challenge.target - 1 }, games, now);
    expect(miss.dailyCompleted).toBe(false);
    expect(save.daily[dayKey(now)]).toEqual({ best: challenge.target - 1, done: false });
    const hit = applyRound(save, game, { type: 'end', score: challenge.target }, games, now);
    expect(hit.dailyCompleted).toBe(true);
    const again = applyRound(save, game, { type: 'end', score: challenge.target + 10 }, games, now);
    expect(again.dailyCompleted).toBe(false);
    expect(doneDays(save).has(dayKey(now))).toBe(true);
  });

  it('records a game’s own daily once per day, without counting it as a streak day (only the challenge does)', () => {
    const now = new Date(2026, 9, 20, 12);
    const own = fakeGame({ slug: 'own', daily: undefined, ownDaily: { label: 'Today’s grid' } });
    const save = emptySave();
    expect(applyRound(save, own, { type: 'end', score: 5 }, [own], now).gameDailyCompleted).toBe(false);
    expect(applyRound(save, own, { type: 'end', score: 5, daily: true }, [own], now).gameDailyCompleted).toBe(true);
    expect(applyRound(save, own, { type: 'end', score: 9, daily: true }, [own], now).gameDailyCompleted).toBe(false);
    expect(save.gameDailies[dayKey(now)]).toEqual(['own']);
    expect(doneDays(save).has(dayKey(now))).toBe(false);
    // A game without ownDaily cannot claim a daily.
    const plain = fakeGame({ slug: 'plain', daily: undefined });
    expect(applyRound(save, plain, { type: 'end', score: 1, daily: true }, [plain], now).gameDailyCompleted).toBe(false);
    // Survives a save round-trip; junk is dropped.
    expect(sanitizeSave(JSON.parse(JSON.stringify(save))).gameDailies).toEqual({ [dayKey(now)]: ['own'] });
    expect(sanitizeSave({ v: 1, gameDailies: { bad: ['x'], '2026-10-20': ['ok', 3, 'NO PE'] } }).gameDailies).toEqual({ '2026-10-20': ['ok'] });
  });

  it('does not count rounds of other games toward the daily', () => {
    const other = fakeGame({ slug: 'other', daily: undefined });
    const save = emptySave();
    applyRound(save, other, { type: 'end', score: 99999 }, [game, other], new Date(2026, 9, 20, 12));
    expect(save.daily).toEqual({});
  });

  it('prunes daily history older than 60 days', () => {
    const save = emptySave();
    save.daily['2026-01-01'] = { best: 1, done: true };
    applyRound(save, game, { type: 'end', score: 1 }, games, new Date(2026, 9, 20, 12));
    expect(save.daily['2026-01-01']).toBeUndefined();
  });

  it('lists recently played games, newest first', () => {
    const save = emptySave();
    applyRound(save, game, { type: 'end', score: 1 }, games, new Date(2026, 9, 1));
    applyRound(save, fakeGame({ slug: 'b' }), { type: 'end', score: 1 }, games, new Date(2026, 9, 3));
    expect(recentSlugs(save)).toEqual(['b', 'test-game']);
  });
});
