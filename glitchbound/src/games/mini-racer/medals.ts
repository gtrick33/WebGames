/**
 * Medals and the spoiler-free share text: a medal per lap against the track's par, the race medal
 * and the finishing place. Pure, unit tested.
 */
import { daysBetween } from '../../platform/dates';
import type { LapRecord } from './laps';
import { RACE_LAPS, type Result } from './sim';
import { medalTimes } from './track';

export type Medal = 'gold' | 'silver' | 'bronze' | null;

/** The first lap starts from the grid, standing still: it gets this much extra time. */
const START_MS = 900;

/** Medal times for a 3-lap race: three gold laps plus a little for the standing start. */
export function raceMedalTimes(par: number): { gold: number; silver: number; bronze: number } {
  return medalTimes(par * RACE_LAPS + START_MS);
}

const medalAt = (ms: number, m: { gold: number; silver: number; bronze: number }): Medal => (ms <= m.gold ? 'gold' : ms <= m.silver ? 'silver' : ms <= m.bronze ? 'bronze' : null);

export function raceMedal(par: number, race: number | null | undefined): Medal {
  if (!race) return null;
  return medalAt(race * 1000, raceMedalTimes(par));
}

/** A lap's medal against par (lap `index` 0 includes the standing start). Missed laps get none. */
export function lapMedal(par: number, lap: LapRecord, index: number): Medal {
  if (!lap.valid) return null;
  return medalAt(lap.time * 1000, medalTimes(par + (index === 0 ? START_MS : 0)));
}

const LAP_EMOJI = { gold: '🥇', silver: '🥈', bronze: '🥉' } as const;

/** 🥇🥈🥉 per lap, 🟩 for a lap slower than bronze, 🟥 for a lap that missed a checkpoint. */
export function lapLine(par: number, laps: readonly LapRecord[]): string {
  return laps
    .slice(0, 10)
    .map((l, i) => {
      const m = lapMedal(par, l, i);
      return m ? LAP_EMOJI[m] : l.valid ? '🟩' : '🟥';
    })
    .join('');
}

const EPOCH = '2026-10-18';
export const dailyNumber = (day: string): number => Math.max(1, daysBetween(EPOCH, day) + 1);

const ordinal = (n: number): string => (n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`);

/** e.g. "Mini Racer #3 🏎️ Lagoon Loop / 🥇🥈🥇 / 1:23.45 · 1st of 4 / 2,950 race points". */
export function shareText(opts: { result: Pick<Result, 'laps' | 'raceTime' | 'position' | 'standings' | 'score'>; par: number; trackName: string; day?: string; time: (s: number) => string; url: string }): string {
  const { result } = opts;
  const head = `Mini Racer ${opts.day ? `#${dailyNumber(opts.day)} ` : ''}🏎️ ${opts.trackName}`;
  const facts = [result.raceTime !== null ? opts.time(result.raceTime) : 'race time not counted'];
  if (result.position !== null) facts.push(`${result.position === 1 ? '🏆 ' : ''}${ordinal(result.position)} of ${result.standings.length}`);
  return [head, lapLine(opts.par, result.laps), facts.join(' · '), `${result.score.toLocaleString('en-US')} race points`, opts.url].join('\n');
}
