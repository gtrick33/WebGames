import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { account } from '../src/platform/account';
import type { Me } from '../src/platform/apiTypes';
import { addDays, dayKey } from '../src/platform/dates';
import { useDaily } from '../src/platform/hooks';
import { useStreakDays } from '../src/platform/streak';
import { emptySave, SAVE_KEY } from '../src/platform/save';
import { saveStore } from '../src/platform/store';

describe('the streak the site shows', () => {
  afterEach(() => {
    localStorage.clear();
    saveStore.reload();
    account.reset();
  });

  it('is this browser’s record for a guest, and the server’s for a member', () => {
    const today = dayKey();
    const local = emptySave();
    local.daily[today] = { best: 9, done: true };
    local.daily[addDays(today, -1)] = { best: 9, done: true };
    localStorage.setItem(SAVE_KEY, JSON.stringify(local));
    saveStore.reload();
    account.reset({ status: 'guest' });
    const { result } = renderHook(() => useDaily(new Date(), useStreakDays()));
    expect(result.current?.streak).toBe(2);
    // signed in: only what the server recorded counts (yesterday was missed there)
    act(() => account.reset({ status: 'member', me: { dailyDays: [addDays(today, -2)] } as unknown as Me }));
    expect(result.current?.streak).toBe(0);
    expect(result.current?.week.slice(-3)).toEqual([true, false, false]);
    // a clear the server confirms counts at once
    act(() => account.addDailyDay(today));
    expect(result.current?.streak).toBe(1);
    expect(result.current?.done).toBe(true);
  });
});
