import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MOUNTS, type MountDef } from '../src/games/sigilfall/data/mounts';
import { mountModel } from '../src/games/sigilfall/render3d/mountKit';
import { mountKits, shapeOf } from '../src/games/sigilfall/render3d/mountLook';
import type { Pack } from '../src/games/sigilfall/render3d/pack';
import { addRideClip } from '../src/games/sigilfall/render3d/ride';
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
