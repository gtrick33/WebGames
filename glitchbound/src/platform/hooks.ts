import { useEffect, useMemo, useState } from 'react';
import { GAMES } from '../catalog/games';
import { dailyRules } from '../catalog/settings';
import { useLiveCatalog } from './liveCatalog';
import { challengeForDay, currentStreak, type DailyChallenge } from './daily';
import { addDays, dayKey } from './dates';
import { doneDays } from './save';
import { useSave } from './store';

/** Games running on the page right now: clocks around the stage hold still meanwhile. */
let playing = 0;

/** Marks a game as running; returns the function that unmarks it. */
export function markPlaying(): () => void {
  playing++;
  let done = false;
  return () => {
    if (done) return;
    done = true;
    playing = Math.max(0, playing - 1);
  };
}

/**
 * Current time, refreshed every `ms` (only while mounted). Ticks are skipped while a game is being
 * played, so page re-renders never compete with the game's frames; it catches up on the next tick.
 */
export function useNow(ms = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!playing) setNow(new Date());
    }, ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return now;
}

export interface DailyState {
  challenge: DailyChallenge;
  today: string;
  best: number;
  /** A round counted toward today's challenge (even one that scored 0). */
  tried: boolean;
  done: boolean;
  streak: number;
  /** Completion for the last 7 days, oldest first, ending today. */
  week: boolean[];
}

/** Today's challenge plus this player's progress. Null when the catalog has no daily-capable game. */
export function useDaily(now: Date): DailyState | null {
  const save = useSave();
  const today = dayKey(now);
  // The admins' daily picks and exclusions come in through the live catalog.
  const live = useLiveCatalog();
  return useMemo(() => {
    const challenge = challengeForDay(today, GAMES, dailyRules(live.raw));
    if (!challenge) return null;
    const done = doneDays(save);
    const rec = save.daily[today];
    return {
      challenge,
      today,
      best: rec?.best ?? 0,
      tried: !!rec,
      done: rec?.done ?? false,
      streak: currentStreak(done, today),
      week: Array.from({ length: 7 }, (_, i) => done.has(addDays(today, i - 6))),
    };
  }, [save, today, live]);
}
