import { lerpAngle } from './geometry';

/**
 * Ghost replays: the car's pose sampled at a fixed interval through a lap, relative to the moment
 * the lap began. Small enough for localStorage (a 25 s lap at 20 Hz is ~500 frames).
 */

export const GHOST_HZ = 20;
/** v2: tracks start on their longest straight, so v1 ghosts (other lap origin) no longer line up. */
const VERSION = 2;

export interface Ghost {
  /** Lap time in seconds. */
  time: number;
  /** Seconds after the lap start of the first frame. */
  t0: number;
  /** Flat [x, y, a, x, y, a, ...]. */
  frames: number[];
}

export interface Pose {
  x: number;
  y: number;
  a: number;
}

export class GhostRecorder {
  private frames: number[] = [];
  private t0 = 0;
  private nextT = 0;

  /** Starts a new lap at race time `lapStart`. */
  begin(lapStart: number): void {
    this.frames = [];
    this.t0 = -1;
    this.nextT = lapStart;
  }

  /** Records the pose if a sample is due (call every physics tick). */
  sample(time: number, lapStart: number, p: Pose): void {
    if (time < this.nextT) return;
    if (this.t0 < 0) this.t0 = time - lapStart;
    this.frames.push(Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10, Math.round(p.a * 1000) / 1000);
    this.nextT += 1 / GHOST_HZ;
    if (this.nextT <= time) this.nextT = time + 1 / GHOST_HZ;
    // Safety cap: 3 minutes.
    if (this.frames.length > GHOST_HZ * 180 * 3) this.frames.length = GHOST_HZ * 180 * 3;
  }

  finish(lapTime: number): Ghost {
    return { time: lapTime, t0: Math.max(0, this.t0), frames: this.frames.slice() };
  }
}

/** Pose of the ghost `t` seconds into its lap, or null outside the recording. */
export function ghostPose(g: Ghost, t: number): Pose | null {
  const count = g.frames.length / 3;
  if (count === 0) return null;
  const f = (t - g.t0) * GHOST_HZ;
  if (f < 0 || f > count - 1) return null;
  const i = Math.min(count - 2, Math.floor(f));
  if (i < 0) return { x: g.frames[0]!, y: g.frames[1]!, a: g.frames[2]! };
  const u = f - i;
  const a = i * 3;
  const b = a + 3;
  return {
    x: g.frames[a]! + (g.frames[b]! - g.frames[a]!) * u,
    y: g.frames[a + 1]! + (g.frames[b + 1]! - g.frames[a + 1]!) * u,
    a: lerpAngle(g.frames[a + 2]!, g.frames[b + 2]!, u),
  };
}

export function encodeGhost(g: Ghost): string {
  return JSON.stringify({ v: VERSION, time: g.time, t0: g.t0, f: g.frames });
}

/** Parses stored text; returns null for anything malformed (old versions, tampering, quota truncation). */
export function decodeGhost(text: string | null): Ghost | null {
  if (!text) return null;
  try {
    const o = JSON.parse(text) as { v?: unknown; time?: unknown; t0?: unknown; f?: unknown };
    if (o.v !== VERSION || typeof o.time !== 'number' || typeof o.t0 !== 'number' || !Array.isArray(o.f)) return null;
    if (o.f.length % 3 !== 0 || o.f.length < 6 || !o.f.every((n) => typeof n === 'number' && Number.isFinite(n))) return null;
    if (!(o.time > 0 && o.time < 600)) return null;
    return { time: o.time, t0: o.t0, frames: o.f as number[] };
  } catch {
    return null;
  }
}
