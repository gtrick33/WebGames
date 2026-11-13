import * as THREE from 'three';
import type { Kit } from './kits';
import type { MeshData } from './pack';

/**
 * What a great beast wears or carries (Kit.gear), made part of its body. Each piece was drawn as a thing of its own,
 * set where the beast stands at rest, and stayed there while the beast moved under it: Ossa bent to her blow and
 * her anvil hung in the air where her back had been. So the pieces are fitted once, when the beast's model comes in,
 * and each is hung from the bone that moves the body nearest it; from then on it goes where that part of the beast
 * goes (and takes the beast's outline, its flash when struck and its fading with it).
 *
 * `propOf`: a piece's model by name, or null if it isn't loaded. With any piece missing nothing is fitted (the
 * pieces are then drawn as they were, each frame: render3d/cast.ts worn), so a beast never wears half its gear twice.
 *
 * `tint`: the beast's own color (Kit.tint and gain), which until now was laid over the whole figure as it was drawn.
 * It is painted into the body here instead, and the figure is then drawn untinted, so that the gear keeps its own
 * colors (a red crab's tint made its trophy bones red too).
 */
export function withGear(body: MeshData, gear: NonNullable<Kit['gear']>, propOf: (id: string) => MeshData | null, tint: readonly [number, number, number] = [1, 1, 1]): MeshData | null {
  if (!body.skin || !gear.length) return null;
  const pieces: { g: NonNullable<Kit['gear']>[number]; m: MeshData; turn: number; flat?: boolean }[] = [];
  for (const g of gear) {
    const m = propOf(g.m);
    if (!m) return null;
    // (a wall banner has only a front: once more, turned about, for the other side. Two sheets back to back would each
    // show the other's ink line as a black cloth, so a piece like this gives its own light and has no ink: toon.ts)
    pieces.push({ g, m, turn: g.turn ?? 0, flat: !!g.both });
    if (g.both) pieces.push({ g, m, turn: (g.turn ?? 0) + Math.PI, flat: true });
  }
  const add = pieces.reduce((n, p) => n + p.m.n, 0);
  const tris = pieces.reduce((n, p) => n + p.m.i, 0);
  if (body.n + add > 65535) return null;
  // the beast's own measures: how tall it stands, and its middle (it is its middle that stands on its spot)
  const H = body.max[1] - body.min[1] || 1;
  const mx = (body.min[0] + body.max[0]) / 2;
  const mz = (body.min[2] + body.max[2]) / 2;
  const n = body.n + add;
  const pos = new Float32Array(n * 3);
  pos.set(body.pos);
  const nor = new Int8Array(n * 3);
  nor.set(body.nor);
  const sn = new Int8Array(n * 3);
  sn.set(body.sn);
  const col = new Uint8Array(n * 3);
  for (let i = 0; i < body.n * 3; i++) col[i] = Math.min(255, Math.round(body.col[i]! * tint[i % 3]!));
  const skin = new Uint8Array(n * 3);
  skin.set(body.skin);
  const idx = new Uint16Array(body.i + tris);
  idx.set(body.idx.subarray(0, body.i));
  const used = new Uint8Array(body.n);
  for (let t = 0; t < body.i; t++) used[body.idx[t]!] = 1;
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  let at = body.n;
  let it = body.i;
  for (const { g, m, turn, flat } of pieces) {
    // fitted by its longest side, standing on its own middle (as the pieces always were)
    const long = Math.max(0.01, m.max[0] - m.min[0], m.max[1] - m.min[1], m.max[2] - m.min[2]);
    const k = (g.h * H) / long;
    const fx = (m.min[0] + m.max[0]) / 2;
    const fy = m.min[1];
    const fz = (m.min[2] + m.max[2]) / 2;
    const tc = Math.cos(turn);
    const ts = Math.sin(turn);
    const px = mx + (g.x ?? 0) * H - (fx * tc + fz * ts) * k;
    const py = g.y * H - fy * k;
    const pz = mz + (g.z ?? 0) * H - (fz * tc - fx * ts) * k;
    if (g.tipX || g.tipZ) q.setFromEuler(e.set(g.tipX ?? 0, turn, g.tipZ ?? 0, 'YXZ'));
    else q.setFromEuler(e.set(0, turn, 0, 'YXZ'));
    // the bone that moves the body nearest the piece's middle
    const cx = mx + (g.x ?? 0) * H;
    const cy = g.y * H + ((m.max[1] - m.min[1]) * k) / 2;
    const cz = mz + (g.z ?? 0) * H;
    let joint = 0;
    let best = Infinity;
    for (let b = 0; b < body.n; b++) {
      if (!used[b]) continue;
      const d = (body.pos[b * 3]! - cx) ** 2 + (body.pos[b * 3 + 1]! - cy) ** 2 + (body.pos[b * 3 + 2]! - cz) ** 2;
      if (d < best) {
        best = d;
        joint = body.skin[b * 3]!;
      }
    }
    const own = g.tint ? [parseInt(g.tint.slice(1, 3), 16) / 255, parseInt(g.tint.slice(3, 5), 16) / 255, parseInt(g.tint.slice(5, 7), 16) / 255] : [1, 1, 1];
    for (let i = 0; i < m.n; i++) {
      v.set(m.pos[i * 3]! * k, m.pos[i * 3 + 1]! * k, m.pos[i * 3 + 2]! * k).applyQuaternion(q);
      pos[(at + i) * 3] = v.x + px;
      pos[(at + i) * 3 + 1] = v.y + py;
      pos[(at + i) * 3 + 2] = v.z + pz;
      v.set(m.nor[i * 3]!, m.nor[i * 3 + 1]!, m.nor[i * 3 + 2]!).applyQuaternion(q);
      nor[(at + i) * 3] = flat ? 0 : Math.round(v.x);
      nor[(at + i) * 3 + 1] = flat ? 0 : Math.round(v.y);
      nor[(at + i) * 3 + 2] = flat ? 0 : Math.round(v.z);
      v.set(m.sn[i * 3]!, m.sn[i * 3 + 1]!, m.sn[i * 3 + 2]!).applyQuaternion(q);
      sn[(at + i) * 3] = Math.round(v.x);
      sn[(at + i) * 3 + 1] = Math.round(v.y);
      sn[(at + i) * 3 + 2] = Math.round(v.z);
      for (let c = 0; c < 3; c++) col[(at + i) * 3 + c] = Math.min(255, Math.round(m.col[i * 3 + c]! * own[c]! * (flat ? 0.82 : 1)));
      skin[(at + i) * 3] = joint;
      skin[(at + i) * 3 + 1] = joint;
      skin[(at + i) * 3 + 2] = 255;
    }
    for (let t = 0; t < m.i; t++) idx[it + t] = m.idx[t]! + at;
    at += m.n;
    it += m.i;
  }
  // (its own measures stay the beast's: how big it is drawn goes by them, and its gear must not make it smaller)
  return { ...body, n, i: body.i + tris, pos, nor, sn, col, skin, idx };
}
