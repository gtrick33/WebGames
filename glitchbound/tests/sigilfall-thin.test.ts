/**
 * A figure drawn with only as much shape as the screen can show (render3d/thin.ts). The figures are modeled for a
 * close look, six to ten thousand triangles each; in the Vigil's wide view one stands forty pixels tall, and a host
 * of them was half a million triangles a frame. Held to here: what is left out is smaller than the cell asked for,
 * and everything that makes the figure look as it does is kept.
 */
import { describe, expect, it } from 'vitest';
import type { MeshData } from '../src/games/sigilfall/render3d/pack';
import { thinMesh } from '../src/games/sigilfall/render3d/thin';

/** A model from loose triangles: every corner its own, as a faceted model's are. */
function mesh(tris: { p: [number, number, number][]; col?: [number, number, number]; nor?: [number, number, number]; bone?: number }[]): MeshData {
  const n = tris.length * 3;
  const m: MeshData = { n, i: n, min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity], pos: new Float32Array(n * 3), nor: new Int8Array(n * 3), sn: new Int8Array(n * 3), col: new Uint8Array(n * 3), skin: new Uint8Array(n * 3), idx: new Uint16Array(n), rig: 'medium' };
  tris.forEach((t, k) => {
    for (let c = 0; c < 3; c++) {
      const v = k * 3 + c;
      m.idx[v] = v;
      for (let a = 0; a < 3; a++) {
        m.pos[v * 3 + a] = t.p[c]![a]!;
        m.min[a] = Math.min(m.min[a]!, t.p[c]![a]!);
        m.max[a] = Math.max(m.max[a]!, t.p[c]![a]!);
        m.col[v * 3 + a] = (t.col ?? [200, 100, 50])[a]!;
        m.nor[v * 3 + a] = (t.nor ?? [0, 127, 0])[a]!;
        m.sn[v * 3 + a] = (t.nor ?? [0, 127, 0])[a]!;
      }
      m.skin![v * 3] = t.bone ?? 0;
      m.skin![v * 3 + 2] = 255;
    }
  });
  return m;
}

/** A flat sheet of `n` by `n` squares, `size` across, each square two triangles. */
function sheet(n: number, size: number, opts: { col?: (x: number, y: number) => [number, number, number] } = {}): MeshData {
  const tris: Parameters<typeof mesh>[0] = [];
  const s = size / n;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const a: [number, number, number] = [x * s, 0, y * s];
      const b: [number, number, number] = [(x + 1) * s, 0, y * s];
      const c: [number, number, number] = [(x + 1) * s, 0, (y + 1) * s];
      const d: [number, number, number] = [x * s, 0, (y + 1) * s];
      const col = opts.col?.(x, y);
      tris.push({ p: [a, b, c], col }, { p: [a, c, d], col });
    }
  }
  return mesh(tris);
}

const area = (m: MeshData): number => {
  let sum = 0;
  for (let t = 0; t < m.i; t += 3) {
    const [a, b, c] = [m.idx[t]!, m.idx[t + 1]!, m.idx[t + 2]!];
    const ux = m.pos[b * 3]! - m.pos[a * 3]!;
    const uy = m.pos[b * 3 + 1]! - m.pos[a * 3 + 1]!;
    const uz = m.pos[b * 3 + 2]! - m.pos[a * 3 + 2]!;
    const vx = m.pos[c * 3]! - m.pos[a * 3]!;
    const vy = m.pos[c * 3 + 1]! - m.pos[a * 3 + 1]!;
    const vz = m.pos[c * 3 + 2]! - m.pos[a * 3 + 2]!;
    sum += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
  }
  return sum;
};

describe('a figure with only as much shape as the screen can show', () => {
  it('leaves out what is finer than the cell, and keeps the figure the size it was', () => {
    // 32 by 32 squares on a sheet 1 across: a square is 1/32; a cell of 1/8 holds sixteen of them
    const full = sheet(32, 1);
    const thin = thinMesh(full, 1 / 8);
    expect(thin).not.toBe(full);
    expect(thin.i).toBeLessThan(full.i * 0.2);
    // (the same sheet: nothing has moved further than a cell, so it covers nearly what it covered)
    expect(area(thin)).toBeGreaterThan(area(full) * 0.7);
    expect(area(thin)).toBeLessThanOrEqual(area(full) + 1e-6);
    // every corner is one that was there
    const was = new Set<string>();
    for (let v = 0; v < full.n; v++) was.add(`${full.pos[v * 3]},${full.pos[v * 3 + 1]},${full.pos[v * 3 + 2]}`);
    for (let v = 0; v < thin.n; v++) expect(was.has(`${thin.pos[v * 3]},${thin.pos[v * 3 + 1]},${thin.pos[v * 3 + 2]}`)).toBe(true);
  });

  it('hands back the model itself when there is too little to take away', () => {
    const full = sheet(8, 1);
    // (a cell far smaller than a square: nothing falls together)
    expect(thinMesh(full, 1 / 64)).toBe(full);
    expect(thinMesh(full, 0)).toBe(full);
    expect(thinMesh(full, NaN)).toBe(full);
  });

  it('keeps every color where it was: none runs into its neighbor', () => {
    // a checkerboard, red and blue
    const full = sheet(32, 1, { col: (x, y) => ((x >> 2) + (y >> 2)) % 2 ? [255, 0, 0] : [0, 0, 255] });
    const thin = thinMesh(full, 1 / 8);
    expect(thin).not.toBe(full);
    for (let t = 0; t < thin.i; t += 3) {
      const c = [thin.idx[t]!, thin.idx[t + 1]!, thin.idx[t + 2]!].map((v) => `${thin.col[v * 3]},${thin.col[v * 3 + 1]},${thin.col[v * 3 + 2]}`);
      // (a triangle is one color, corner to corner, as it was)
      expect(new Set(c).size).toBe(1);
    }
    const colors = new Set<string>();
    for (let v = 0; v < thin.n; v++) colors.add(`${thin.col[v * 3]},${thin.col[v * 3 + 1]},${thin.col[v * 3 + 2]}`);
    expect([...colors].sort()).toEqual(['0,0,255', '255,0,0']);
  });

  it('keeps every facet, and what glows', () => {
    const tris: Parameters<typeof mesh>[0] = [];
    const s = 1 / 32;
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        // (half of it lit from above, half glowing: a normal too short to light)
        const nor: [number, number, number] = x < 16 ? [0, 127, 0] : [0, 0, 0];
        tris.push({ p: [[x * s, 0, y * s], [(x + 1) * s, 0, y * s], [(x + 1) * s, 0, (y + 1) * s]], nor }, { p: [[x * s, 0, y * s], [(x + 1) * s, 0, (y + 1) * s], [x * s, 0, (y + 1) * s]], nor });
      }
    }
    const thin = thinMesh(mesh(tris), 1 / 8);
    let lit = 0;
    let glow = 0;
    for (let t = 0; t < thin.i; t += 3) {
      const ns = [thin.idx[t]!, thin.idx[t + 1]!, thin.idx[t + 2]!].map((v) => thin.nor[v * 3 + 1]!);
      expect(new Set(ns).size).toBe(1);
      if (ns[0] === 127) lit++;
      else glow++;
    }
    expect(lit).toBeGreaterThan(0);
    expect(glow).toBeGreaterThan(0);
  });

  it('leaves no gap: corners that were at one place go to one place, with one set of bones and one ink', () => {
    const full = sheet(32, 1);
    // (each corner on a bone of its own, as nothing real is: only what stands for a cell may speak for it)
    for (let v = 0; v < full.n; v++) full.skin![v * 3] = v % 30;
    const thin = thinMesh(full, 1 / 8);
    const at = new Map<string, string>();
    for (let v = 0; v < thin.n; v++) {
      const place = `${thin.pos[v * 3]},${thin.pos[v * 3 + 1]},${thin.pos[v * 3 + 2]}`;
      const moved = `${thin.skin![v * 3]},${thin.skin![v * 3 + 1]},${thin.skin![v * 3 + 2]}|${thin.sn[v * 3]},${thin.sn[v * 3 + 1]},${thin.sn[v * 3 + 2]}`;
      if (at.has(place)) expect(at.get(place)).toBe(moved);
      at.set(place, moved);
    }
    // and every edge inside the sheet is still shared by two triangles: no hole was opened
    const edges = new Map<string, number>();
    const key = (v: number): string => `${thin.pos[v * 3]},${thin.pos[v * 3 + 2]}`;
    for (let t = 0; t < thin.i; t += 3) {
      for (let k = 0; k < 3; k++) {
        const a = key(thin.idx[t + k]!);
        const b = key(thin.idx[t + ((k + 1) % 3)]!);
        const e = a < b ? `${a}|${b}` : `${b}|${a}`;
        edges.set(e, (edges.get(e) ?? 0) + 1);
      }
    }
    const onRim = (e: string): boolean => {
      const [a, b] = e.split('|').map((p) => p.split(',').map(Number)) as [number[], number[]];
      // (the sheet's own rim, to within a cell: an edge there has one triangle, as it had)
      return [0, 1].some((axis) => (a[axis]! < 1 / 8 && b[axis]! < 1 / 8) || (a[axis]! > 7 / 8 && b[axis]! > 7 / 8));
    };
    for (const [e, n] of edges) if (!onRim(e)) expect(n, e).toBe(2);
  });

  it('keeps what is long and thin: a spear thinner than a cell is still a spear', () => {
    // a body of small squares, and a shaft 0.01 thick and 0.9 long standing out of it
    const body = sheet(32, 1);
    const shaft = mesh([
      { p: [[2, 0, 0], [2.01, 0, 0], [2.01, 0, 0.9]] },
      { p: [[2, 0, 0], [2.01, 0, 0.9], [2, 0, 0.9]] },
    ]);
    const both: MeshData = {
      ...body,
      n: body.n + shaft.n,
      i: body.i + shaft.i,
      max: [2.01, 0, 1],
      pos: Float32Array.from([...body.pos, ...shaft.pos]),
      nor: Int8Array.from([...body.nor, ...shaft.nor]),
      sn: Int8Array.from([...body.sn, ...shaft.sn]),
      col: Uint8Array.from([...body.col, ...shaft.col]),
      skin: Uint8Array.from([...body.skin!, ...shaft.skin!]),
      idx: Uint16Array.from([...body.idx, ...[...shaft.idx].map((v) => v + body.n)]),
    };
    const thin = thinMesh(both, 1 / 8);
    expect(thin).not.toBe(both);
    // the shaft's four corners are where they were
    const has = (x: number, z: number): boolean => {
      for (let v = 0; v < thin.n; v++) if (Math.abs(thin.pos[v * 3]! - x) < 1e-6 && Math.abs(thin.pos[v * 3 + 2]! - z) < 1e-6) return true;
      return false;
    };
    expect(has(2, 0) && has(2.01, 0) && has(2.01, 0.9) && has(2, 0.9)).toBe(true);
  });

  it('is quick enough to make in a frame: a ten-thousand-triangle figure in a few milliseconds', () => {
    const full = sheet(72, 1);
    expect(full.i / 3).toBeGreaterThan(10000);
    thinMesh(full, 1 / 24);
    const t0 = performance.now();
    for (let k = 0; k < 5; k++) thinMesh(full, 1 / 24);
    expect((performance.now() - t0) / 5).toBeLessThan(40);
  });
});

/* ------------------------------------------------------------------ in the world */

import * as THREE from 'three';
import { Crowd, THIN_PX } from '../src/games/sigilfall/render3d/crowd';
import type { RigAnim } from '../src/games/sigilfall/render3d/toon';

describe('figures in the world are drawn with the model that suits their size', () => {
  const rig = { tex: new THREE.DataTexture(new Float32Array(4), 1, 1) } as unknown as RigAnim;
  /** A figure 1 unit across with squares 1/72 of it: each `frame` draws one of them at `scale`, seen at `px` pixels a unit. */
  const stand = (): { crowd: Crowd; frame: (px: number, scale?: number, budget?: { left: number }) => number } => {
    const crowd = new Crowd(sheet(72, 1), rig, new THREE.Group(), 2, 0.022);
    return {
      crowd,
      frame: (px, scale = 1, budget = { left: 1 }) => {
        crowd.begin();
        crowd.put(0, 0, 0, 0, scale, scale, 0);
        crowd.end(px, budget);
        return crowd.fill.geometry.index!.count / 3;
      },
    };
  };
  const FULL = 72 * 72 * 2;

  it('whole where nobody says how big they stand: a portrait, the hall of heroes', () => {
    const { crowd } = stand();
    crowd.begin();
    crowd.put(0, 0, 0, 0, 1, 1, 0);
    crowd.end();
    expect(crowd.fill.geometry.index!.count / 3).toBe(FULL);
  });

  it('lighter where they stand small, with nothing coarser than the screen can show; the ink is the same model', () => {
    const { crowd, frame } = stand();
    // 24 pixels to a unit: a square of the model is a third of a pixel
    const drawn = frame(24);
    expect(drawn).toBeLessThan(FULL * 0.3);
    expect(crowd.ink!.geometry).toBe(crowd.fill.geometry);
    // (the least thing left in it is no more than THIN_PX pixels: about 16 cells across the 24 pixels)
    expect(drawn).toBeGreaterThan(((24 / THIN_PX) ** 2 * 2) * 0.5);
    // and it is made once: the same model every frame after
    const geo = crowd.fill.geometry;
    for (let i = 0; i < 300; i++) frame(24);
    expect(crowd.fill.geometry).toBe(geo);
  });

  it('whole at once when the camera draws in on them, and a finer model only if it stays', () => {
    const { crowd, frame } = stand();
    frame(24);
    const far = crowd.fill.geometry;
    // (three times as near: what suited them is far too coarse now)
    expect(frame(72)).toBe(FULL);
    for (let i = 0; i < 30; i++) frame(72);
    expect(crowd.fill.geometry.index!.count / 3).toBe(FULL);
    // back out again before it settled: the model it had
    frame(24);
    expect(crowd.fill.geometry).toBe(far);
    // stays near: a model for that
    for (let i = 0; i < 100; i++) frame(72);
    const near = crowd.fill.geometry.index!.count / 3;
    expect(near).toBeLessThan(FULL);
    expect(near).toBeGreaterThan(far.index!.count / 3);
  });

  it('goes by the largest of them: an elite among them is not drawn coarser than it should be', () => {
    const { crowd, frame } = stand();
    frame(24, 1);
    const small = crowd.fill.geometry.index!.count / 3;
    // one of them twice the size: all of them are drawn whole until a model is made for that
    expect(frame(24, 2)).toBeGreaterThan(small);
  });

  it('makes no more than the frame has room for', () => {
    const a = stand();
    const b = stand();
    const budget = { left: 1 };
    expect(a.frame(24, 1, budget)).toBeLessThan(FULL);
    // (the frame's one model has been made: the next kind waits its turn, drawn whole meanwhile)
    expect(b.frame(24, 1, budget)).toBe(FULL);
    expect(b.frame(24, 1, { left: 1 })).toBeLessThan(FULL);
  });

  it('keeps its figures through growing: more of them than it had room for', () => {
    const { crowd } = stand();
    crowd.begin();
    for (let i = 0; i < 40; i++) crowd.put(i, 0, 0, 0, 1, 1, 0);
    crowd.end(24, { left: 1 });
    expect(crowd.fill.count).toBe(40);
    const g = crowd.fill.geometry;
    expect(g.index!.count / 3).toBeLessThan(FULL);
    // (the lighter model is given where each stands and what it is doing, as the whole one is)
    expect((g.getAttribute('iAnim') as THREE.InstancedBufferAttribute).count).toBeGreaterThanOrEqual(40);
    expect(g.getAttribute('iTint')).toBe(crowd.fill.geometry.getAttribute('iTint'));
  });
});
