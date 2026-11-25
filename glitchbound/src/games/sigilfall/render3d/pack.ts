import * as THREE from 'three';

/**
 * The game's 3D files (scripts/sigilfall-3d-assets.mjs writes them): plain numbers, colors baked into the
 * vertices, so a whole hero merges into one draw call and recoloring is rewriting a few bytes.
 */

const BASE = '/games/sigilfall/3d/';
/** Bump when the built files change, so a browser doesn't keep old ones. */
const VERSION = '6';

export interface MeshData {
  n: number;
  i: number;
  min: [number, number, number];
  max: [number, number, number];
  pos: Float32Array;
  nor: Int8Array;
  sn: Int8Array;
  col: Uint8Array;
  /** Per vertex: first joint, second joint, the first's share of 255. */
  skin?: Uint8Array;
  idx: Uint16Array;
  /** The skeleton this is bound to. */
  rig?: string;
}

export interface ClipData {
  n: number;
  fps: number;
  q: number;
  tj: number[];
  t: number;
  sj: number[];
  s: number;
  /** A clip made in the browser keeps its rotations here rather than in the file (a rider's seat). */
  own?: Int16Array;
}

export interface RigData {
  joints: string[];
  parents: number[];
  rest: number[];
  ibm: number[];
  base: number[];
  clips: Record<string, ClipData>;
}

export interface Pack {
  meshes: Record<string, MeshData>;
  rigs: Record<string, RigData>;
  bin: ArrayBuffer;
}

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

const packs = new Map<string, Promise<Pack>>();

/**
 * How much of the model files asked for so far has come, in bytes as sent: what the wait before the title shows
 * (ui/Warming.tsx). On a slow line the title's models are most of a first visit's wait (NINE_PLAN.md piece 7).
 * `total` counts only files whose size the server said; `files` and `done` count them all.
 */
export const packLoad = { got: 0, total: 0, files: 0, done: 0 };

async function fetchPack(name: string): Promise<Pack> {
  packLoad.files++;
  const res = await fetch(`${BASE}${name}.pack?v=${VERSION}`);
  if (!res.ok || !res.body) throw new Error(`${name}: ${res.status}`);
  const size = Number(res.headers.get('content-length') ?? 0);
  if (size > 0) packLoad.total += size;
  const counted = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, to) {
      if (size > 0) packLoad.got += chunk.byteLength;
      to.enqueue(chunk);
    },
  });
  const bytes = await new Response(res.body.pipeThrough(counted).pipeThrough(new DecompressionStream('gzip') as unknown as TransformStream<Uint8Array, Uint8Array>)).arrayBuffer();
  packLoad.done++;
  const jsonLen = new DataView(bytes).getUint32(0, true);
  const head = JSON.parse(new TextDecoder().decode(new Uint8Array(bytes, 4, jsonLen))) as { meshes: Record<string, RawMesh>; rigs: Record<string, RigData> };
  const start = (4 + jsonLen + 3) & ~3;
  const bin = bytes.slice(start);
  const meshes: Record<string, MeshData> = {};
  for (const [id, m] of Object.entries(head.meshes)) {
    const q = new Uint16Array(bin, m.pos, m.n * 3);
    const pos = new Float32Array(m.n * 3);
    for (let i = 0; i < pos.length; i++) {
      const c = i % 3;
      pos[i] = m.min[c]! + (q[i]! / 65535) * (m.max[c]! - m.min[c]!);
    }
    meshes[id] = {
      n: m.n,
      i: m.i,
      min: m.min,
      max: m.max,
      pos,
      nor: new Int8Array(bin, m.nor, m.n * 3),
      sn: new Int8Array(bin, m.sn, m.n * 3),
      col: new Uint8Array(bin, m.col, m.n * 3),
      skin: m.skin === undefined ? undefined : new Uint8Array(bin, m.skin, m.n * 3),
      idx: new Uint16Array(bin, m.idx, m.i),
      rig: m.rig,
    };
  }
  return { meshes, rigs: head.rigs, bin };
}

/** Loads a file once; a failed download may be tried again. */
export function loadPack(name: string): Promise<Pack> {
  let p = packs.get(name);
  if (!p) {
    p = fetchPack(name);
    packs.set(name, p);
    p.catch(() => packs.delete(name));
  }
  return p;
}

/** A model as the graphics card takes it. */
export function toGeometry(m: MeshData, col: Uint8Array = m.col): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(m.pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(m.nor, 3, true));
  g.setAttribute('aSn', new THREE.BufferAttribute(m.sn, 3, true));
  g.setAttribute('aCol', new THREE.BufferAttribute(col, 3, true));
  if (m.skin) g.setAttribute('aSkin', new THREE.BufferAttribute(m.skin, 3));
  g.setIndex(new THREE.BufferAttribute(m.idx, 1));
  return g;
}

/** A bunch of models as one, with every vertex in its own place. */
export function mergeMeshes(parts: MeshData[]): MeshData {
  let n = 0;
  let i = 0;
  for (const p of parts) {
    n += p.n;
    i += p.i;
  }
  const out: MeshData = {
    n,
    i,
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
    pos: new Float32Array(n * 3),
    nor: new Int8Array(n * 3),
    sn: new Int8Array(n * 3),
    col: new Uint8Array(n * 3),
    skin: new Uint8Array(n * 3),
    idx: new Uint16Array(i),
    rig: parts[0]?.rig,
  };
  let v = 0;
  let t = 0;
  for (const p of parts) {
    out.pos.set(p.pos, v * 3);
    out.nor.set(p.nor, v * 3);
    out.sn.set(p.sn, v * 3);
    out.col.set(p.col, v * 3);
    if (p.skin) out.skin!.set(p.skin, v * 3);
    for (let k = 0; k < p.i; k++) out.idx[t++] = p.idx[k]! + v;
    for (let c = 0; c < 3; c++) {
      out.min[c] = Math.min(out.min[c]!, p.min[c]!);
      out.max[c] = Math.max(out.max[c]!, p.max[c]!);
    }
    v += p.n;
  }
  return out;
}
