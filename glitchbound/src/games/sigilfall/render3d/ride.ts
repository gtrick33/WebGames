import * as THREE from 'three';
import type { RigData } from './pack';

/**
 * How someone sits a saddle. The clips from the pack sit on a chair, with the hips far behind where the figure stands
 * and the knees together in front: on a horse that's a rider stuck through its back. This one is made here: hips over
 * the figure's own spot, knees out either side of the animal, feet hanging down its flanks, hands up at the reins.
 *
 * Each bone says where it points in the model's own space; the joint angles come from that.
 */

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z).normalize();

/** Where each bone points, from its joint to the next (the character faces +z, its left is +x). */
const BONES: Record<string, { to: string; aim: THREE.Vector3 }> = {
  'upperleg.l': { to: 'lowerleg.l', aim: v(0.82, -0.42, 0.38) },
  'lowerleg.l': { to: 'foot.l', aim: v(0.3, -0.92, -0.1) },
  'upperleg.r': { to: 'lowerleg.r', aim: v(-0.82, -0.42, 0.38) },
  'lowerleg.r': { to: 'foot.r', aim: v(-0.3, -0.92, -0.1) },
  'upperarm.l': { to: 'lowerarm.l', aim: v(0.5, -0.72, 0.42) },
  'lowerarm.l': { to: 'wrist.l', aim: v(-0.38, -0.12, 0.92) },
  'upperarm.r': { to: 'lowerarm.r', aim: v(-0.5, -0.72, 0.42) },
  'lowerarm.r': { to: 'wrist.r', aim: v(0.38, -0.12, 0.92) },
};

/** Frames round the loop, and how long it takes: a small rock in the saddle. */
const FRAMES = 16;
const FPS = 10;

export function addRideClip(rig: RigData): void {
  if (rig.clips.ride) return;
  const J = rig.joints.length;
  const index = (name: string): number => rig.joints.indexOf(name);

  const quat = (j: number): THREE.Quaternion => new THREE.Quaternion(rig.rest[j * 10 + 3]!, rig.rest[j * 10 + 4]!, rig.rest[j * 10 + 5]!, rig.rest[j * 10 + 6]!).normalize();
  const base = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().fromArray(rig.base));

  // the skeleton at rest, in the model's own space
  const restTurn: THREE.Quaternion[] = [];
  const restAt: THREE.Vector3[] = [];
  for (let j = 0; j < J; j++) {
    const par = rig.parents[j]!;
    const parentTurn = par < 0 ? base : restTurn[par]!;
    restTurn[j] = parentTurn.clone().multiply(quat(j));
    const local = new THREE.Vector3(rig.rest[j * 10]!, rig.rest[j * 10 + 1]!, rig.rest[j * 10 + 2]!);
    restAt[j] = par < 0 ? local : local.applyQuaternion(parentTurn).add(restAt[par]!);
  }

  // what each aimed bone does, from rest
  const aimed = new Map<number, THREE.Quaternion>();
  for (const [name, b] of Object.entries(BONES)) {
    const j = index(name);
    const to = index(b.to);
    if (j < 0 || to < 0) continue;
    const dir = restAt[to]!.clone().sub(restAt[j]!).normalize();
    aimed.set(j, new THREE.Quaternion().setFromUnitVectors(dir, b.aim));
  }

  const own = new Int16Array(FRAMES * J * 4);
  const worldTurn: THREE.Quaternion[] = [];
  const spine = index('spine');
  const chest = index('chest');
  const head = index('head');
  const lean = new THREE.Quaternion();
  const xAxis = new THREE.Vector3(1, 0, 0);
  for (let f = 0; f < FRAMES; f++) {
    const a = (f / FRAMES) * Math.PI * 2;
    for (let j = 0; j < J; j++) {
      const par = rig.parents[j]!;
      const parentTurn = par < 0 ? base : worldTurn[par]!;
      let turned: THREE.Quaternion;
      const aim = aimed.get(j);
      if (aim) turned = aim.clone().multiply(restTurn[j]!);
      else if (j === spine || j === chest || j === head) {
        // upright, leaning a touch into the ride
        const by = j === spine ? 0.1 + Math.sin(a) * 0.012 : j === chest ? 0.14 + Math.sin(a) * 0.018 : 0.02 - Math.sin(a) * 0.02;
        turned = lean.setFromAxisAngle(xAxis, by).clone().multiply(restTurn[j]!);
      } else turned = restTurn[j]!.clone();
      worldTurn[j] = turned;
      const q = parentTurn.clone().invert().multiply(turned).normalize();
      const at = (f * J + j) * 4;
      own[at] = Math.round(q.x * 32767);
      own[at + 1] = Math.round(q.y * 32767);
      own[at + 2] = Math.round(q.z * 32767);
      own[at + 3] = Math.round(q.w * 32767);
    }
  }
  rig.clips.ride = { n: FRAMES, fps: FPS, q: 0, tj: [], t: 0, sj: [], s: 0, own };
}
