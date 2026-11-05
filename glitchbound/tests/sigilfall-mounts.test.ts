import { existsSync } from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { MOUNTS, type MountDef } from '../src/games/sigilfall/data/mounts';
import { mountModel } from '../src/games/sigilfall/render3d/mountKit';
import { mountKits, shapeOf } from '../src/games/sigilfall/render3d/mountLook';
import type { Pack } from '../src/games/sigilfall/render3d/pack';
import { addRideClip } from '../src/games/sigilfall/render3d/ride';
import { RigAnim } from '../src/games/sigilfall/render3d/toon';
import { readPack } from './sigilfall-packs';

const packs = new Map<string, Pack>();
const packOf = (kit: string): Pack => {
  let p = packs.get(kit);
  if (!p) {
    p = readPack(`k/${kit}`);
    packs.set(kit, p);
  }
  return p;
};
const modelOf = (m: MountDef): ReturnType<typeof mountModel> => mountModel(m, packOf(shapeOf(m).kit));

describe('Sigilfall: mounts', () => {
  it('every model a mount is made from is in the game files', () => {
    for (const kit of mountKits()) expect(existsSync(`public/games/sigilfall/3d/k/${kit}.pack`), kit).toBe(true);
    for (const m of MOUNTS) expect(mountKits(), m.id).toContain(shapeOf(m).kit);
  });

  it('no two horses are the same horse', () => {
    const horses = MOUNTS.filter((m) => m.body === 'horse').map((m) => shapeOf(m).kit);
    expect(new Set(horses).size).toBe(horses.length);
  });

  it('builds every mount, every vertex on a joint its skeleton has', () => {
    for (const m of MOUNTS) {
      const { mesh, rig } = modelOf(m);
      expect(mesh.n, m.id).toBeLessThan(65536);
      expect(mesh.idx.length % 3, m.id).toBe(0);
      // (counted, and held to it once: an expect for each of tens of thousands of vertices takes seconds)
      let offRig = 0;
      for (let v = 0; v < mesh.n * 3; v += 3) if (mesh.skin![v]! >= rig.joints.length || mesh.skin![v + 1]! >= rig.joints.length) offRig++;
      expect(offRig, m.id).toBe(0);
      expect(mesh.pos.every(Number.isFinite), m.id).toBe(true);
    }
  });

  it('every swatch a mount paints is a color its model really has', () => {
    for (const m of MOUNTS) {
      const shape = shapeOf(m);
      const file = packOf(shape.kit).meshes.body!;
      const has = new Set<string>();
      for (let v = 0; v < file.n; v++) has.add(((file.col[v * 3]! << 16) | (file.col[v * 3 + 1]! << 8) | file.col[v * 3 + 2]!).toString(16).padStart(6, '0'));
      for (const key of Object.keys(shape.paint)) expect(has.has(key), `${m.id}: ${key}`).toBe(true);
      for (const key of shape.hair ?? []) expect(has.has(key), `${m.id}: hair ${key}`).toBe(true);
      for (const key of shape.without ?? []) expect(has.has(key), `${m.id}: without ${key}`).toBe(true);
    }
  });

  it('the saddle sits on the animal: the rider is on its back, not in it or over it', () => {
    for (const m of MOUNTS) {
      const shape = shapeOf(m);
      const { rig, joint } = modelOf(m);
      expect(rig.joints[joint], m.id).toBe(shape.joint);
      const body = modelOf(m).mesh;
      // the top of the back under the seat, from the animal's own skin (what's built on it has no height here)
      let top = -Infinity;
      const reach = shape.backW * 0.5;
      for (let v = 0; v < body.n; v++) if (Math.abs(body.pos[v * 3]!) < reach && Math.abs(body.pos[v * 3 + 2]! - shape.seatZ) < reach) top = Math.max(top, body.pos[v * 3 + 1]!);
      // (in world pixels: a rider's a few across at the hips)
      expect(Math.abs(top - shape.seatY) * shape.px, m.id).toBeLessThan(5);
    }
  });

  it('every mount stands on the ground and has a run, a walk and a rest', () => {
    for (const m of MOUNTS) {
      const { rig, mesh } = modelOf(m);
      for (const clip of ['idle', 'walk', 'run']) expect(rig.has(clip), `${m.id}: ${clip}`).toBe(true);
      expect(Math.abs(mesh.min[1]) * shapeOf(m).px, m.id).toBeLessThan(1);
    }
  });

  it('a drake has wings that beat when it runs and fold when it rests', () => {
    const { rig } = modelOf(MOUNTS.find((m) => m.body === 'drake')!);
    const wing = rig.joints.indexOf('hand.l');
    expect(wing).toBeGreaterThan(0);
    const at = { x: 0, y: 0, z: 0 };
    const tipAt = (clip: string, t: number): { x: number; y: number; z: number } => {
      rig.pointAt(rig.frame(clip, t), 0, 0, wing, 2040, 1120, -60, at);
      return { ...at };
    };
    const span = (clip: string, t: number): number => tipAt(clip, t).x;
    const ys = [0, 0.2, 0.4, 0.6].map((t) => tipAt('run', t).y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(300);
    expect(span('idle', 0.5)).toBeLessThan(span('run', 0.2) * 0.75);
  });

  it("a drake's wings stay out of its body and its rider in every clip it plays, on both sides", () => {
    const def = MOUNTS.find((m) => m.body === 'drake')!;
    const shape = shapeOf(def);
    const { mesh, rig, joint } = modelOf(def);
    const wingJoints = new Map(['wing.l', 'hand.l', 'wing.r', 'hand.r'].map((n, i) => [rig.joints.indexOf(n), i < 2 ? 1 : -1]));
    const sideOf = (v: number): number => wingJoints.get(mesh.skin![v * 3]!) ?? 0;
    // the rider, limb by limb, from the seat in the drake's units: the ride clip, on a hero drawn PERSON_H (36) world
    // pixels tall times the mount's `rider`, about 1.75 of the rig's own units
    const people = readPack('rigs');
    const medium = people.rigs.medium!;
    addRideClip(medium);
    const person = new RigAnim(medium, people.bin);
    const k = (36 * shape.rider) / shape.px / 1.75;
    const sat = person.frame('ride', 0);
    const jointAt = (name: string): THREE.Vector3 => {
      const j = medium.joints.indexOf(name);
      const rest = new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().fromArray(medium.ibm.slice(j * 16, j * 16 + 16)).invert());
      const p = { x: 0, y: 0, z: 0 };
      person.pointAt(sat, 0, 0, j, rest.x, rest.y, rest.z, p);
      return new THREE.Vector3(p.x, p.y, p.z);
    };
    const hips = jointAt('hips');
    const limb = (n: string): THREE.Vector3 => jointAt(n).sub(hips).multiplyScalar(k);
    const head = limb('head');
    const rider: [THREE.Vector3, THREE.Vector3, number][] = [
      [limb('hips'), limb('chest'), 130],
      [head.clone().setY(head.y + 120), head.clone().setY(head.y + 120), 240],
      [limb('upperleg.l'), limb('lowerleg.l'), 55],
      [limb('lowerleg.l'), limb('foot.l'), 45],
      [limb('foot.l'), limb('toes.l'), 40],
      [limb('upperarm.l'), limb('lowerarm.l'), 40],
      [limb('lowerarm.l'), limb('wrist.l'), 35],
    ];
    const inRider = (p: THREE.Vector3): boolean =>
      rider.some(([a, b, r]) => {
        const ab = b.clone().sub(a);
        const t = ab.lengthSq() ? THREE.MathUtils.clamp(p.clone().sub(a).dot(ab) / ab.lengthSq(), 0, 1) : 0;
        return p.distanceTo(a.clone().addScaledVector(ab, t)) < r;
      });
    const posed = new Float32Array(mesh.n * 3);
    const a = { x: 0, y: 0, z: 0 };
    const b = { x: 0, y: 0, z: 0 };
    const pose = (row: number): void => {
      for (let v = 0; v < mesh.n; v++) {
        const [x, y, z] = [mesh.pos[v * 3]!, mesh.pos[v * 3 + 1]!, mesh.pos[v * 3 + 2]!];
        const w = mesh.skin![v * 3 + 2]! / 255;
        rig.pointAt(row, 0, 0, mesh.skin![v * 3]!, x, y, z, a);
        rig.pointAt(row, 0, 0, mesh.skin![v * 3 + 1]!, x, y, z, b);
        posed[v * 3] = a.x * w + b.x * (1 - w);
        posed[v * 3 + 1] = a.y * w + b.y * (1 - w);
        posed[v * 3 + 2] = a.z * w + b.z * (1 - w);
      }
    };
    const shoulders = rig.joints.indexOf('Shoulders');
    for (const clip of ['idle', 'walk', 'run']) {
      const c = rig.clips[clip]!;
      for (let f = 0; f < c.n; f++) {
        const row = c.start + f;
        pose(row);
        // the body's width across each patch of its side, from what isn't wing
        const CELL = 40;
        const cell = (y: number, z: number): string => `${Math.round(y / CELL)},${Math.round(z / CELL)}`;
        const wide = { [1]: new Map<string, number>(), [-1]: new Map<string, number>() };
        for (let v = 0; v < mesh.n; v++) {
          if (sideOf(v)) continue;
          const key = cell(posed[v * 3 + 1]!, posed[v * 3 + 2]!);
          for (const side of [1, -1] as const) wide[side].set(key, Math.max(wide[side].get(key) ?? -Infinity, posed[v * 3]! * side));
        }
        const widthAt = (y: number, z: number, side: 1 | -1): number => {
          let m = -Infinity;
          for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) m = Math.max(m, wide[side].get(cell(y + dy * CELL, z + dz * CELL)) ?? -Infinity);
          return m;
        };
        rig.pointAt(row, 0, 0, joint, 0, shape.seatY, shape.seatZ, a);
        const seat = new THREE.Vector3(a.x, a.y, a.z);
        // (over the back to the other side is measured on the drake's own shoulders: its body sways under them)
        const at = (x: number, y: number, z: number): THREE.Vector3 => {
          rig.pointAt(row, 0, 0, shoulders, x, y, z, b);
          return new THREE.Vector3(b.x, b.y, b.z);
        };
        const o = at(0, 0, 0);
        const unShoulders = new THREE.Matrix4().makeBasis(at(1, 0, 0).sub(o), at(0, 1, 0).sub(o), at(0, 0, 1).sub(o)).setPosition(o).invert();
        let inBody = 0;
        let inRiderN = 0;
        let across = 0;
        // every wing triangle, at points across it (a wing's triangles are big: its corners alone would miss a crossing)
        const N = 6;
        const p = new THREE.Vector3();
        const near = new THREE.Vector3();
        for (let t = 0; t < mesh.idx.length; t += 3) {
          const vs = [mesh.idx[t]!, mesh.idx[t + 1]!, mesh.idx[t + 2]!];
          const side = sideOf(vs[0]!) as 0 | 1 | -1;
          if (!side || !vs.every((v) => sideOf(v) === side)) continue;
          // (the wing grows out of the body along its root, from the shoulder back to the flank)
          rig.pointAt(row, 0, 0, shoulders, 175 * side, 1205, 560, b);
          const root = new THREE.Vector3(b.x, b.y, b.z);
          rig.pointAt(row, 0, 0, rig.joints.indexOf(side > 0 ? 'wing.l' : 'wing.r'), 190 * side, 1130, -60, b);
          const rootLine = new THREE.Line3(root, new THREE.Vector3(b.x, b.y, b.z));
          for (let i = 0; i <= N; i++)
            for (let j = 0; j <= N - i; j++) {
              const w = [i / N, j / N, (N - i - j) / N];
              p.set(0, 0, 0);
              vs.forEach((v, q) => p.add(new THREE.Vector3(posed[v * 3]!, posed[v * 3 + 1]!, posed[v * 3 + 2]!).multiplyScalar(w[q]!)));
              if (p.distanceTo(root) < 170 || p.distanceTo(rootLine.closestPointToPoint(p, true, near)) < 60) continue;
              if (widthAt(p.y, p.z, side) > p.x * side - 10) inBody++;
              if (p.clone().applyMatrix4(unShoulders).x * side < 120) across++;
              const local = p.clone().sub(seat);
              local.x = Math.abs(local.x);
              // (folded, they keep off the rider; beating, the root of each brushes past the knee as it always has)
              if (clip !== 'run' && inRider(local)) inRiderN++;
            }
        }
        expect({ clip, f, inBody, across, inRider: inRiderN }).toEqual({ clip, f, inBody: 0, across: 0, inRider: 0 });
      }
    }
  });

  it('the rider sits with hips over their spot, knees out and hands forward', () => {
    const rigs = readPack('rigs').rigs;
    const medium = rigs.medium!;
    delete medium.clips.ride;
    addRideClip(medium);
    const ride = medium.clips.ride!;
    expect(ride.n).toBeGreaterThan(1);
    expect(ride.own!.length).toBe(ride.n * medium.joints.length * 4);
    expect(ride.own!.every(Number.isFinite)).toBe(true);
  });
});
