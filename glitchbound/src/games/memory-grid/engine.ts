/**
 * Memory Grid game state. A pure state machine: every function takes a state and returns a new one (or the
 * same object when the action is not allowed right now). Timers, sound and rendering live in the UI.
 *
 *   showing --playbackDone--> input --tap (all right)--> cleared --next--> showing ...
 *                                   \--tap (wrong)----> over (or "missed" --next--> showing in Speed Run)
 *   input --tick (Speed Run clock hits 0)--> over
 */
import { levelFor, patternFor, roundsIn, SPEED_PENALTY_SECONDS, SPEED_SECONDS, type Level, type Mode } from './pattern';
import { patternPoints, perfectBonus } from './scoring';

export type Phase = 'showing' | 'input' | 'cleared' | 'missed' | 'over';
export type EndReason = 'mistake' | 'timeout' | 'complete';

export interface RunState {
  mode: Mode;
  seed: string;
  phase: Phase;
  /** 1-based index of the current pattern. */
  round: number;
  level: Level;
  sequence: number[];
  /** How many steps of the current sequence the player has repeated. */
  step: number;
  /** Patterns completed. */
  cleared: number;
  /** Longest sequence completed. */
  longest: number;
  score: number;
  taps: number;
  correctTaps: number;
  mistakes: number;
  /** Time spent on the player's turn, in ms (playback does not count). */
  inputMs: number;
  /** Speed Run clock, in ms. */
  timeLeftMs: number;
  /** Result of the latest tap, for feedback. */
  lastTap: { tile: number; ok: boolean; at: number } | null;
  end: EndReason | null;
}

/** Taps on the same tile closer than this are treated as one (ghost double-fires from touch + mouse). */
export const DUPLICATE_TAP_MS = 90;

function roundState(s: Pick<RunState, 'mode' | 'seed'>, round: number, cleared: number) {
  const level = levelFor(s.mode, round, cleared);
  return { round, level, sequence: patternFor(s.seed, round, level), step: 0, phase: 'showing' as Phase, lastTap: null };
}

export function createRun(mode: Mode, seed: string): RunState {
  const base = { mode, seed };
  return {
    ...base,
    ...roundState(base, 1, 0),
    cleared: 0,
    longest: 0,
    score: 0,
    taps: 0,
    correctTaps: 0,
    mistakes: 0,
    inputMs: 0,
    timeLeftMs: mode === 'speed' ? SPEED_SECONDS * 1000 : 0,
    end: null,
  };
}

/** Playback finished: the player's turn begins. */
export function playbackDone(s: RunState): RunState {
  return s.phase === 'showing' ? { ...s, phase: 'input' } : s;
}

/** Whether a tap would be accepted right now (input is ignored during playback and transitions). */
export function acceptsInput(s: RunState): boolean {
  return s.phase === 'input';
}

export function tap(s: RunState, tile: number, at: number): RunState {
  if (!acceptsInput(s)) return s;
  if (!Number.isInteger(tile) || tile < 0 || tile >= s.level.size * s.level.size) return s;
  if (s.lastTap && s.lastTap.tile === tile && at - s.lastTap.at < DUPLICATE_TAP_MS && at >= s.lastTap.at) return s;

  const ok = s.sequence[s.step] === tile;
  const taps = s.taps + 1;
  if (!ok) {
    const next = { ...s, taps, mistakes: s.mistakes + 1, lastTap: { tile, ok, at } };
    if (s.mode === 'speed') {
      const timeLeftMs = Math.max(0, s.timeLeftMs - SPEED_PENALTY_SECONDS * 1000);
      return timeLeftMs === 0 ? { ...next, timeLeftMs, phase: 'over', end: 'timeout' } : { ...next, timeLeftMs, phase: 'missed' };
    }
    return { ...next, phase: 'over', end: 'mistake' };
  }

  const step = s.step + 1;
  const base = { ...s, taps, correctTaps: s.correctTaps + 1, step, lastTap: { tile, ok, at } };
  if (step < s.sequence.length) return base;

  const cleared = s.cleared + 1;
  let score = s.score + patternPoints(s.level);
  const done = cleared >= roundsIn(s.mode);
  if (done && s.mode === 'perfect') score += perfectBonus(s.inputMs);
  return {
    ...base,
    cleared,
    longest: Math.max(s.longest, s.sequence.length),
    score,
    phase: done ? 'over' : 'cleared',
    end: done ? 'complete' : null,
  };
}

/** Move on after the "cleared" / "missed" feedback beat. */
export function next(s: RunState): RunState {
  if (s.phase !== 'cleared' && s.phase !== 'missed') return s;
  return { ...s, ...roundState(s, s.round + 1, s.cleared) };
}

/** Advance the player's-turn clock by dt ms (only during input). */
export function tick(s: RunState, dt: number): RunState {
  if (s.phase !== 'input' || !(dt > 0)) return s;
  const inputMs = s.inputMs + dt;
  if (s.mode !== 'speed') return { ...s, inputMs };
  const timeLeftMs = Math.max(0, s.timeLeftMs - dt);
  return timeLeftMs === 0 ? { ...s, inputMs, timeLeftMs, phase: 'over', end: 'timeout' } : { ...s, inputMs, timeLeftMs };
}

/** Accuracy as a whole percentage (100 when nothing was tapped yet). */
export function accuracy(s: Pick<RunState, 'taps' | 'correctTaps'>): number {
  return s.taps === 0 ? 100 : Math.round((s.correctTaps / s.taps) * 100);
}
