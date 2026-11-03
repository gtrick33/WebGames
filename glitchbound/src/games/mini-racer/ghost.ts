import { REPLAY_MAX } from '../../platform/challenge';
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

/**
 * Compact text form for sharing a ghost (friends' challenges): base64url of 32-bit integers
 * [time ms, t0 ms, x·10, y·10, a·1000, ...]. About 8 KB for a 25-second lap. A lap too long for the
 * arcade's limit (`max`, over a minute) is sent in the short form instead (see encodeShort).
 */
export function encodeReplay(g: Ghost, max = REPLAY_MAX): string {
  const ints = new Int32Array(2 + g.frames.length);
  ints[0] = Math.round(g.time * 1000);
  ints[1] = Math.round(g.t0 * 1000);
  g.frames.forEach((v, i) => (ints[2 + i] = Math.round(v * (i % 3 === 2 ? 1000 : 10))));
  const full = toBase64Url(new Uint8Array(ints.buffer));
  if (full.length <= max) return full;
  for (const every of [1, 2, 4]) {
    const short = encodeShort(ints, every);
    if (short && short.length <= max) return short;
  }
  // Still too long (a lap of several minutes): the arcade keeps it back and the score still counts.
  return full;
}

/**
 * The short form: a negative time marks it (older decoders reject it cleanly). Header of 32-bit
 * integers [-time ms, t0 ms, sample step, first x·10, y·10, a·1000], then 16-bit steps from each kept
 * sample to the next. `every` keeps every 1st, 2nd or 4th sample (20, 10 or 5 a second); the decoder
 * fills the gaps back in. Null if a step doesn't fit 16 bits.
 */
function encodeShort(ints: Int32Array, every: number): string | null {
  const count = (ints.length - 2) / 3;
  const kept = Math.floor((count - 1) / every) + 1;
  const view = new DataView(new ArrayBuffer(24 + (kept - 1) * 6));
  [-ints[0]!, ints[1]!, every, ints[2]!, ints[3]!, ints[4]!].forEach((v, i) => view.setInt32(i * 4, v, true));
  for (let k = 1; k < kept; k++) {
    for (let c = 0; c < 3; c++) {
      const d = ints[2 + k * every * 3 + c]! - ints[2 + (k - 1) * every * 3 + c]!;
      if (d < -32768 || d > 32767) return null;
      view.setInt16(24 + ((k - 1) * 3 + c) * 2, d, true);
    }
  }
  return toBase64Url(new Uint8Array(view.buffer));
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeReplay(text: string | null | undefined): Ghost | null {
  if (!text || !/^[A-Za-z0-9_-]+$/.test(text)) return null;
  try {
    const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    if (bytes.length >= 4 && new DataView(bytes.buffer).getInt32(0, true) < 0) return decodeShort(bytes);
    if (bin.length % 4 !== 0) return null;
    const ints = new Int32Array(bytes.buffer);
    const frames = Array.from(ints.subarray(2), (v, i) => v / (i % 3 === 2 ? 1000 : 10));
    const time = ints[0]! / 1000;
    if (frames.length < 6 || frames.length % 3 !== 0 || !(time > 0 && time < 600)) return null;
    return { time, t0: Math.max(0, ints[1]! / 1000), frames };
  } catch {
    return null;
  }
}

/** Reads the short form back into a ghost sampled at GHOST_HZ (gaps filled in a straight line). */
function decodeShort(bytes: Uint8Array): Ghost | null {
  if (bytes.length < 30 || (bytes.length - 24) % 6 !== 0) return null;
  const view = new DataView(bytes.buffer);
  const time = -view.getInt32(0, true) / 1000;
  const every = view.getInt32(8, true);
  if (!(time > 0 && time < 600) || ![1, 2, 4].includes(every)) return null;
  const kept: number[] = [view.getInt32(12, true), view.getInt32(16, true), view.getInt32(20, true)];
  for (let o = 24; o < bytes.length; o += 2) kept.push(kept[kept.length - 3]! + view.getInt16(o, true));
  const scale = (v: number, c: number): number => v / (c === 2 ? 1000 : 10);
  const frames: number[] = [];
  for (let k = 0; k + 3 < kept.length; k += 3) {
    for (let j = 0; j < every; j++) {
      const u = j / every;
      frames.push(
        scale(kept[k]! + (kept[k + 3]! - kept[k]!) * u, 0),
        scale(kept[k + 1]! + (kept[k + 4]! - kept[k + 1]!) * u, 1),
        j === 0 ? scale(kept[k + 2]!, 2) : lerpAngle(scale(kept[k + 2]!, 2), scale(kept[k + 5]!, 2), u),
      );
    }
  }
  frames.push(scale(kept[kept.length - 3]!, 0), scale(kept[kept.length - 2]!, 1), scale(kept[kept.length - 1]!, 2));
  return { time, t0: Math.max(0, view.getInt32(4, true) / 1000), frames };
}
