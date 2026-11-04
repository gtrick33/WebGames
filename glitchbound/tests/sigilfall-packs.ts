import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import type { MeshData, Pack, RigData } from '../src/games/sigilfall/render3d/pack';

interface RawMesh {
  n: number;
  i: number;
  min: [number, number, number];
  max: [number, number, number];
  pos: number;
  nor: number;
  sn: number;
  col: number;
  skin?: number;
  idx: number;
  rig?: string;
}

/** A pack as the game reads it, from the files it ships. */
export function readPack(name: string): Pack {
  const bytes = gunzipSync(readFileSync(`public/games/sigilfall/3d/${name}.pack`));
  const u8 = new Uint8Array(bytes);
  const len = new DataView(u8.buffer, u8.byteOffset, u8.byteLength).getUint32(0, true);
  const head = JSON.parse(Buffer.from(u8.subarray(4, 4 + len)).toString('utf8')) as { meshes: Record<string, RawMesh>; rigs: Record<string, RigData> };
  const start = (4 + len + 3) & ~3;
  const bin = u8.slice(start).buffer;
  const meshes: Record<string, MeshData> = {};
  for (const [id, m] of Object.entries(head.meshes)) {
    const q = new Uint16Array(bin, m.pos, m.n * 3);
    const pos = new Float32Array(m.n * 3);
    for (let i = 0; i < pos.length; i++) pos[i] = m.min[i % 3]! + (q[i]! / 65535) * (m.max[i % 3]! - m.min[i % 3]!);
    meshes[id] = { n: m.n, i: m.i, min: m.min, max: m.max, pos, nor: new Int8Array(bin, m.nor, m.n * 3), sn: new Int8Array(bin, m.sn, m.n * 3), col: new Uint8Array(bin, m.col, m.n * 3), skin: m.skin === undefined ? undefined : new Uint8Array(bin, m.skin, m.n * 3), idx: new Uint16Array(bin, m.idx, m.i), rig: m.rig };
  }
  return { meshes, rigs: head.rigs, bin };
}
