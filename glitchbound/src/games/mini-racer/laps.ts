import { crossFraction, type Vec } from './geometry';
import type { Checkpoint, Gate } from './track';

/**
 * Lap timing and checkpoint validation. A lap counts only when every checkpoint was crossed in
 * order, in the driving direction, since the last time over the line. Cutting across the infield
 * misses a gate, so that lap is shown but doesn't count.
 */

export interface LapRecord {
  /** Lap time in seconds. */
  time: number;
  /** All checkpoints crossed in order. */
  valid: boolean;
  /** Valid and no hard bumps. */
  clean: boolean;
}

export interface LapState {
  /** Index of the checkpoint we expect next; 0 = the line. Equal to the count once all are passed. */
  next: number;
  /** False until the car first crosses the start line (the grid is just behind it). */
  started: boolean;
  /** Race time the current lap began. */
  lapStart: number;
  laps: LapRecord[];
  /** A checkpoint was skipped this lap. */
  missed: boolean;
  /** Hard bump this lap. */
  bumped: boolean;
}

export type LapEvent =
  | { type: 'checkpoint'; index: number; time: number }
  | { type: 'missed'; index: number }
  | { type: 'lap'; lap: LapRecord; number: number };

export function newLapState(): LapState {
  return { next: 0, started: false, lapStart: 0, laps: [], missed: false, bumped: false };
}

/** Fraction along p0→p1 where it crosses the gate going forward, or null. */
export function crossGate(gate: Gate, p0: Vec, p1: Vec): number | null {
  const move = (p1.x - p0.x) * gate.dir.x + (p1.y - p0.y) * gate.dir.y;
  if (move <= 0) return null;
  return crossFraction(p0, p1, gate.a, gate.b);
}

function crossCheckpoint(cp: Checkpoint, p0: Vec, p1: Vec): number | null {
  for (const g of cp.gates) {
    const u = crossGate(g, p0, p1);
    if (u !== null) return u;
  }
  return null;
}

/**
 * Feeds one movement step (p0 at time t0 → p1 at t1) and returns what happened. Mutates `state`.
 * Crossing times are interpolated inside the step, so lap times don't depend on the frame rate.
 */
export function advanceLaps(state: LapState, cps: Checkpoint[], p0: Vec, p1: Vec, t0: number, t1: number): LapEvent[] {
  const events: LapEvent[] = [];
  const n = cps.length;
  for (let k = 0; k < n; k++) {
    const u = crossCheckpoint(cps[k]!, p0, p1);
    if (u === null) continue;
    const t = t0 + (t1 - t0) * u;
    if (k === 0) {
      if (!state.started) {
        state.started = true;
        state.next = 1;
        continue;
      }
      // Ignore a re-cross right after the line (wiggling over it) before any checkpoint.
      if (state.next === 1 && !state.missed) continue;
      const valid = state.next === n && !state.missed;
      const lap: LapRecord = { time: t - state.lapStart, valid, clean: valid && !state.bumped };
      state.laps.push(lap);
      events.push({ type: 'lap', lap, number: state.laps.length });
      state.lapStart = t;
      state.next = 1;
      state.missed = false;
      state.bumped = false;
    } else if (state.started) {
      if (k === state.next) {
        state.next++;
        events.push({ type: 'checkpoint', index: k, time: t - state.lapStart });
      } else if (k > state.next) {
        // Skipped one or more gates.
        if (!state.missed) events.push({ type: 'missed', index: state.next });
        state.missed = true;
        state.next = k + 1;
      }
    }
  }
  return events;
}

export function bestLap(laps: LapRecord[]): number | null {
  let best: number | null = null;
  for (const l of laps) if (l.valid && (best === null || l.time < best)) best = l.time;
  return best;
}
