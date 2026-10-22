import { useMemo } from 'react';
import { useAccount } from './account';
import { doneDays } from './save';
import { useSave } from './store';

/**
 * The days that count for the streak: for a member, the Daily Challenges the server recorded as cleared
 * (from checked rounds, the same on every device); for a guest, this browser's own record. A day without
 * one ends the streak.
 */
export function useStreakDays(): ReadonlySet<string> {
  const save = useSave();
  const { status, me } = useAccount();
  return useMemo(() => (status === 'member' && me ? new Set(me.dailyDays ?? []) : doneDays(save)), [save, status, me]);
}
