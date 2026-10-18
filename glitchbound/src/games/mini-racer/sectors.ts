/**
 * Sector timing. Each lap is split into SECTORS parts at checkpoint gates; the split at a sector line is
 * the lap time so far. Splits are compared with a reference lap: in Time Trial your best-ever lap on
 * the track (stored with your bests), in a race your previous lap this session.
 */

export const SECTORS = 3;

/** Checkpoint indices that end sectors 1..SECTORS-1 (the last sector ends at the line). */
export function sectorGates(checkpoints: number): number[] {
  const out: number[] = [];
  for (let k = 1; k < SECTORS; k++) out.push(Math.max(1, Math.min(checkpoints - 1, Math.round((checkpoints * k) / SECTORS))));
  return out;
}

/** Cumulative split times for a lap: [end of S1, end of S2, ..., lap time]. */
export type Splits = number[];

export interface SplitEvent {
  /** 0-based sector just completed. */
  sector: number;
  /** Lap time so far at this line, seconds. */
  time: number;
  /** Time vs the reference at the same line (negative = faster), or null with no reference. */
  delta: number | null;
  /** This sector alone, seconds, and the reference's same sector. */
  sectorTime: number;
  refSector: number | null;
}

export type Reference = 'best' | 'previous';

/** Which lap to compare against. */
export function chooseReference(mode: 'trial' | 'race', best: Splits | null, previous: Splits | null): { kind: Reference; splits: Splits | null } {
  return mode === 'trial' ? { kind: 'best', splits: best } : { kind: 'previous', splits: previous };
}

/** Per-sector times from cumulative splits. */
export function sectorTimes(splits: Splits): number[] {
  return splits.map((t, i) => t - (i > 0 ? splits[i - 1]! : 0));
}

export class SectorTimer {
  private readonly gates: number[];
  private current: number[] = [];
  /** Splits of every completed valid lap, in order. */
  readonly laps: Splits[] = [];
  private invalid = false;

  constructor(checkpoints: number) {
    this.gates = sectorGates(checkpoints);
  }

  /** Call when a lap starts (the line, or GO). */
  begin(): void {
    this.current = [];
    this.invalid = false;
  }

  /** A checkpoint was crossed in order, `time` seconds into the lap. Returns a split at sector lines. */
  checkpoint(index: number, time: number, reference: Splits | null): SplitEvent | null {
    const sector = this.gates.indexOf(index);
    if (sector < 0 || sector !== this.current.length) return null;
    this.current.push(time);
    return this.split(sector, time, reference);
  }

  /** A checkpoint was skipped: this lap gets no splits. */
  miss(): void {
    this.invalid = true;
  }

  /** The lap ended. Returns the final split, and stores the lap's splits if it was valid. */
  lap(time: number, valid: boolean, reference: Splits | null): SplitEvent | null {
    const ok = valid && !this.invalid && this.current.length === SECTORS - 1;
    const ev = ok ? this.split(SECTORS - 1, time, reference) : null;
    if (ok) this.laps.push([...this.current, time]);
    this.begin();
    return ev;
  }

  /** Splits of the last valid lap (the race reference for the next one). */
  get previous(): Splits | null {
    return this.laps[this.laps.length - 1] ?? null;
  }

  /** Splits so far in the current lap. */
  get partial(): number[] {
    return this.current;
  }

  private split(sector: number, time: number, reference: Splits | null): SplitEvent {
    const ref = reference && reference.length === SECTORS ? reference : null;
    const prev = sector > 0 ? this.current[sector - 1]! : 0;
    const refPrev = ref && sector > 0 ? ref[sector - 1]! : 0;
    return {
      sector,
      time,
      delta: ref ? time - ref[sector]! : null,
      sectorTime: time - prev,
      refSector: ref ? ref[sector]! - refPrev : null,
    };
  }
}

/** Best time of each sector across laps (the end-of-race summary). */
export function bestSectors(laps: Splits[]): number[] | null {
  if (laps.length === 0) return null;
  const per = laps.map(sectorTimes);
  return per[0]!.map((_, i) => Math.min(...per.map((p) => p[i]!)));
}
