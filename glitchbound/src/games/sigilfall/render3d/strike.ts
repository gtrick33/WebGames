/**
 * Where the blow is inside an attack clip.
 *
 * Every attack the packs give opens with a slow lift (half a second on the overhead chop) and only then comes down.
 * The rules strike the moment a button goes down, or the moment an enemy's wind-up ends, so a clip played from its
 * start showed the lift and was cut off before the weapon moved: nobody in the game was ever seen landing a blow.
 * This finds the blow in any clip of any rig by measuring it: the stretch where the joints move fastest. Whoever
 * plays the clip starts there (see moves.ts for the hero, worldCast.ts for everyone else).
 */

import type { RigAnim } from './toon';

export interface Strike {
  /** Where someone winding up starts their lift (seconds into the clip). */
  lift: number;
  /** The top of the lift: where the blow itself starts. */
  from: number;
  /** Where it has landed. */
  hit: number;
  /** Where the follow-through is over. */
  to: number;
}

/** A clip nothing is known about yet (its rig still loading): much as the clips ran before. */
export const UNMEASURED: Strike = { lift: 0, from: 0.18, hit: 0.34, to: 0.8 };

/** How much of its top speed a joint keeps while the blow is still on. */
const SHARE = 0.4;
/** How long before the blow a wind-up starts lifting, and how long after it someone is still following through. */
const LIFT = 0.42;
const AFTER = 0.42;

const found = new WeakMap<RigAnim, Map<string, Strike>>();
const at = { x: 0, y: 0, z: 0 };

/** Each joint's own place in the model at rest: the inverse of its inverse bind matrix, moved to the origin. */
function restPlaces(rig: RigAnim): Float32Array {
  const J = rig.joints.length;
  const out = new Float32Array(J * 3);
  const m = rig.ibm;
  for (let j = 0; j < J; j++) {
    const o = j * 16;
    if (o + 15 >= m.length) break;
    const a = m[o]!;
    const b = m[o + 4]!;
    const c = m[o + 8]!;
    const d = m[o + 1]!;
    const e = m[o + 5]!;
    const f = m[o + 9]!;
    const g = m[o + 2]!;
    const h = m[o + 6]!;
    const i = m[o + 10]!;
    const tx = m[o + 12]!;
    const ty = m[o + 13]!;
    const tz = m[o + 14]!;
    const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
    if (Math.abs(det) < 1e-9) continue;
    out[j * 3] = -(((e * i - f * h) * tx + (c * h - b * i) * ty + (b * f - c * e) * tz) / det);
    out[j * 3 + 1] = -(((f * g - d * i) * tx + (a * i - c * g) * ty + (c * d - a * f) * tz) / det);
    out[j * 3 + 2] = -(((d * h - e * g) * tx + (b * g - a * h) * ty + (a * e - b * d) * tz) / det);
  }
  return out;
}

const rests = new WeakMap<RigAnim, Float32Array>();

/** How fast the fastest joint moves between each pose of a clip and the next (model units a second). */
export function clipSpeeds(rig: RigAnim, clip: string): number[] {
  const c = rig.clips[clip];
  if (!c || c.n < 2) return [];
  let rest = rests.get(rig);
  if (!rest) {
    rest = restPlaces(rig);
    rests.set(rig, rest);
  }
  // (the joints the model was rigged with: any added after them have no place at rest)
  const J = Math.min(rig.joints.length, Math.floor(rig.ibm.length / 16));
  const last = new Float32Array(J * 3);
  const out: number[] = [];
  for (let f = 0; f < c.n; f++) {
    let top = 0;
    for (let j = 0; j < J; j++) {
      rig.pointAt(c.start + f, 0, 0, j, rest[j * 3]!, rest[j * 3 + 1]!, rest[j * 3 + 2]!, at);
      if (f > 0) top = Math.max(top, Math.hypot(at.x - last[j * 3]!, at.y - last[j * 3 + 1]!, at.z - last[j * 3 + 2]!));
      last[j * 3] = at.x;
      last[j * 3 + 1] = at.y;
      last[j * 3 + 2] = at.z;
    }
    if (f > 0) out.push(top * c.fps);
  }
  return out;
}

/** The blow in a clip of this rig: found once, then remembered. */
export function strikeOf(rig: RigAnim | null | undefined, clip: string): Strike {
  if (!rig || !rig.has(clip)) return UNMEASURED;
  let mine = found.get(rig);
  if (!mine) {
    mine = new Map();
    found.set(rig, mine);
  }
  const known = mine.get(clip);
  if (known) return known;
  const c = rig.clips[clip]!;
  const length = c.n / c.fps;
  const speeds = clipSpeeds(rig, clip);
  let peak = 0;
  for (let i = 1; i < speeds.length; i++) if (speeds[i]! > speeds[peak]!) peak = i;
  let strike: Strike;
  if (!speeds.length || speeds[peak]! < 1e-4) strike = { lift: 0, from: 0, hit: Math.min(length, 0.2), to: Math.min(length, 0.6) };
  else {
    const floor = speeds[peak]! * SHARE;
    let first = peak;
    while (first > 0 && speeds[first - 1]! >= floor) first--;
    let end = peak;
    while (end < speeds.length - 1 && speeds[end + 1]! >= floor) end++;
    const from = first / c.fps;
    const hit = Math.min(length, (end + 1) / c.fps);
    strike = { lift: Math.max(0, from - LIFT), from, hit, to: Math.min(length, hit + AFTER) };
  }
  mine.set(clip, strike);
  return strike;
}
