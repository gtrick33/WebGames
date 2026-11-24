/**
 * Builds Sigilfall's 3D game files from the downloaded low-poly packs (the packs stay out of the repository;
 * only the files this writes to public/games/sigilfall/3d/ ship). Run by hand when the model list changes:
 *
 *   node scripts/sigilfall-3d-assets.mjs            (reads the packs from ~/Downloads)
 *   SIGILFALL_ONLY=bosses node scripts/sigilfall-3d-assets.mjs     (only the bosses' own files, k/boss_*.pack)
 *   SIGILFALL_PACKS=/some/dir node scripts/sigilfall-3d-assets.mjs
 *
 * Every model becomes plain numbers with its colors baked into the vertices (the packs' textures are swatch
 * grids), so a whole hero merges into one draw call and recoloring is rewriting a few bytes. A file is a gzipped
 * [u32 JSON length][JSON][pad][binary]; src/games/sigilfall/render3d/pack.ts reads it.
 */
import { gzipSync } from 'node:zlib';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

const SRC = process.env.SIGILFALL_PACKS ?? join(homedir(), 'Downloads');
const OUT = new URL('../public/games/sigilfall/3d/', import.meta.url).pathname;
const K = 'The Complete KayKit Collection v8/';

/* ------------------------------------------------------------------ small math */

const IDENT = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function mul(a, b) {
  const o = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[r + 4] * b[c * 4 + 1] + a[r + 8] * b[c * 4 + 2] + a[r + 12] * b[c * 4 + 3];
  return o;
}
function trs(t = [0, 0, 0], q = [0, 0, 0, 1], s = [1, 1, 1]) {
  const [x, y, z, w] = q;
  const [sx, sy, sz] = s;
  const xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z;
  return [(1 - 2 * (yy + zz)) * sx, 2 * (xy + wz) * sx, 2 * (xz - wy) * sx, 0, 2 * (xy - wz) * sy, (1 - 2 * (xx + zz)) * sy, 2 * (yz + wx) * sy, 0, 2 * (xz + wy) * sz, 2 * (yz - wx) * sz, (1 - 2 * (xx + yy)) * sz, 0, t[0], t[1], t[2], 1];
}
const point = (m, x, y, z) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
function dirOf(m, x, y, z) {
  const v = [m[0] * x + m[4] * y + m[8] * z, m[1] * x + m[5] * y + m[9] * z, m[2] * x + m[6] * y + m[10] * z];
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
const toSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const invert = (m) => new THREE.Matrix4().fromArray(m).invert().toArray();

/* ------------------------------------------------------------------ reading glTF */

const imageCache = new Map();

function findFile(dir, uri) {
  const name = decodeURIComponent(uri);
  for (const p of [join(dir, name), join(dir, 'Textures', name), join(dir, '..', name), join(dir, '..', 'Textures', name), join(dir, '..', '..', name), join(dir, '..', '..', 'Textures', name)]) if (existsSync(p)) return p;
  return null;
}

function loadGltf(path) {
  const raw = readFileSync(path);
  const dir = dirname(path);
  let g;
  const buffers = [];
  if (raw.readUInt32LE(0) === 0x46546c67) {
    const jl = raw.readUInt32LE(12);
    g = JSON.parse(raw.subarray(20, 20 + jl).toString('utf8'));
    buffers.push(raw.subarray(20 + jl + 8));
  } else {
    g = JSON.parse(raw.toString('utf8'));
    for (const b of g.buffers ?? []) {
      if (b.uri?.startsWith('data:')) buffers.push(Buffer.from(b.uri.split(',')[1], 'base64'));
      else buffers.push(readFileSync(findFile(dir, b.uri)));
    }
  }
  return { g, buffers, dir, path };
}

function accessor(doc, i) {
  const a = doc.g.accessors[i];
  const v = doc.g.bufferViews[a.bufferView];
  const comps = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[a.type];
  const buf = doc.buffers[v.buffer ?? 0];
  const off = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const size = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }[a.componentType];
  const stride = v.byteStride ?? size * comps;
  const out = new Float64Array(a.count * comps);
  for (let n = 0; n < a.count; n++) {
    for (let c = 0; c < comps; c++) {
      const at = off + n * stride + c * size;
      let val;
      switch (a.componentType) {
        case 5120: val = buf.readInt8(at); if (a.normalized) val = Math.max(val / 127, -1); break;
        case 5121: val = buf.readUInt8(at); if (a.normalized) val /= 255; break;
        case 5122: val = buf.readInt16LE(at); if (a.normalized) val = Math.max(val / 32767, -1); break;
        case 5123: val = buf.readUInt16LE(at); if (a.normalized) val /= 65535; break;
        case 5125: val = buf.readUInt32LE(at); break;
        default: val = buf.readFloatLE(at);
      }
      out[n * comps + c] = val;
    }
  }
  return { data: out, comps, count: a.count };
}

async function textureOf(doc, texIndex) {
  const tex = doc.g.textures[texIndex];
  const imgDef = doc.g.images[tex.source];
  let key;
  let input;
  if (imgDef.uri && !imgDef.uri.startsWith('data:')) {
    const p = findFile(doc.dir, imgDef.uri);
    if (!p) throw new Error(`${doc.path}: no ${imgDef.uri}`);
    key = p;
    input = p;
  } else if (imgDef.uri) {
    key = `${doc.path}#${tex.source}`;
    input = Buffer.from(imgDef.uri.split(',')[1], 'base64');
  } else {
    key = `${doc.path}#${tex.source}`;
    const v = doc.g.bufferViews[imgDef.bufferView];
    input = doc.buffers[v.buffer ?? 0].subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength);
  }
  let img = imageCache.get(key);
  if (!img) {
    const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    img = { data, w: info.width, h: info.height };
    imageCache.set(key, img);
  }
  return img;
}

function nodeTree(doc) {
  const nodes = doc.g.nodes ?? [];
  const parent = new Array(nodes.length).fill(-1);
  nodes.forEach((n, i) => (n.children ?? []).forEach((c) => (parent[c] = i)));
  const local = nodes.map((n) => n.matrix ?? trs(n.translation, n.rotation, n.scale));
  const world = new Array(nodes.length).fill(null);
  const worldOf = (i) => {
    if (world[i]) return world[i];
    world[i] = parent[i] < 0 ? local[i] : mul(worldOf(parent[i]), local[i]);
    return world[i];
  };
  nodes.forEach((_, i) => worldOf(i));
  return { nodes, parent, local, world };
}

/** Every primitive of a node, as flat arrays in `xf` space with colors baked in. */
async function primsOf(doc, meshIndex, xf) {
  const out = [];
  for (const p of doc.g.meshes[meshIndex].primitives) {
    const posA = accessor(doc, p.attributes.POSITION);
    const norA = p.attributes.NORMAL !== undefined ? accessor(doc, p.attributes.NORMAL) : null;
    const uvA = p.attributes.TEXCOORD_0 !== undefined ? accessor(doc, p.attributes.TEXCOORD_0) : null;
    const colA = p.attributes.COLOR_0 !== undefined ? accessor(doc, p.attributes.COLOR_0) : null;
    const mat = p.material !== undefined ? doc.g.materials[p.material] : null;
    const pbr = mat?.pbrMetallicRoughness ?? {};
    const f = pbr.baseColorFactor ?? [1, 1, 1, 1];
    const img = pbr.baseColorTexture && uvA ? await textureOf(doc, pbr.baseColorTexture.index) : null;
    const n = posA.count;
    const pos = new Float32Array(n * 3);
    const nor = new Float32Array(n * 3);
    const col = new Uint8Array(n * 3);
    for (let v = 0; v < n; v++) {
      const q = point(xf, posA.data[v * 3], posA.data[v * 3 + 1], posA.data[v * 3 + 2]);
      pos.set(q, v * 3);
      const d = norA ? dirOf(xf, norA.data[v * 3], norA.data[v * 3 + 1], norA.data[v * 3 + 2]) : [0, 1, 0];
      nor.set(d, v * 3);
      let r = 1, g = 1, b = 1;
      if (img) {
        const u = ((uvA.data[v * 2] % 1) + 1) % 1;
        const w = ((uvA.data[v * 2 + 1] % 1) + 1) % 1;
        const px = Math.min(img.w - 1, Math.floor(u * img.w));
        const py = Math.min(img.h - 1, Math.floor(w * img.h));
        const at = (py * img.w + px) * 4;
        r = img.data[at] / 255;
        g = img.data[at + 1] / 255;
        b = img.data[at + 2] / 255;
      }
      r *= toSrgb(f[0]);
      g *= toSrgb(f[1]);
      b *= toSrgb(f[2]);
      if (colA) {
        r *= toSrgb(colA.data[v * colA.comps]);
        g *= toSrgb(colA.data[v * colA.comps + 1]);
        b *= toSrgb(colA.data[v * colA.comps + 2]);
      }
      col[v * 3] = Math.round(r * 255);
      col[v * 3 + 1] = Math.round(g * 255);
      col[v * 3 + 2] = Math.round(b * 255);
    }
    let idx;
    if (p.indices !== undefined) idx = Array.from(accessor(doc, p.indices).data);
    else idx = Array.from({ length: n }, (_, i) => i);
    out.push({ p, n, pos, nor, col, idx });
  }
  return out;
}

/* ------------------------------------------------------------------ meshes */

/** Averaged normals per position: the ink hull stays closed where the model has hard edges. */
function smoothNormals(pos, nor) {
  const n = pos.length / 3;
  const sum = new Map();
  const key = (i) => `${Math.round(pos[i * 3] * 2000)},${Math.round(pos[i * 3 + 1] * 2000)},${Math.round(pos[i * 3 + 2] * 2000)}`;
  for (let i = 0; i < n; i++) {
    const k = key(i);
    const s = sum.get(k) ?? [0, 0, 0];
    s[0] += nor[i * 3];
    s[1] += nor[i * 3 + 1];
    s[2] += nor[i * 3 + 2];
    sum.set(k, s);
  }
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const s = sum.get(key(i));
    const l = Math.hypot(s[0], s[1], s[2]) || 1;
    out[i * 3] = s[0] / l;
    out[i * 3 + 1] = s[1] / l;
    out[i * 3 + 2] = s[2] / l;
  }
  return out;
}

function joinParts(parts) {
  let n = 0, m = 0;
  for (const p of parts) {
    n += p.n;
    m += p.idx.length;
  }
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  const col = new Uint8Array(n * 3);
  const skin = parts[0].skin ? new Uint8Array(n * 3) : null;
  const idx = new Array(m);
  let v = 0, t = 0;
  for (const p of parts) {
    pos.set(p.pos, v * 3);
    nor.set(p.nor, v * 3);
    col.set(p.col, v * 3);
    if (skin) skin.set(p.skin, v * 3);
    for (let i = 0; i < p.idx.length; i++) idx[t++] = p.idx[i] + v;
    v += p.n;
  }
  return { n, pos, nor, col, skin, idx };
}

class Pack {
  constructor() {
    this.meshes = {};
    this.rigs = {};
    this.chunks = [];
    this.size = 0;
  }
  put(buf) {
    const pad = (4 - (this.size % 4)) % 4;
    if (pad) {
      this.chunks.push(Buffer.alloc(pad));
      this.size += pad;
    }
    const at = this.size;
    const b = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
    this.chunks.push(b);
    this.size += b.length;
    return at;
  }
  addMesh(name, m) {
    if (m.n > 65535) throw new Error(`${name}: ${m.n} vertices`);
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < m.n; i++) {
      for (let c = 0; c < 3; c++) {
        min[c] = Math.min(min[c], m.pos[i * 3 + c]);
        max[c] = Math.max(max[c], m.pos[i * 3 + c]);
      }
    }
    const qpos = new Uint16Array(m.n * 3);
    for (let i = 0; i < m.n * 3; i++) {
      const c = i % 3;
      const span = max[c] - min[c] || 1;
      qpos[i] = Math.round(((m.pos[i] - min[c]) / span) * 65535);
    }
    const toI8 = (a) => Int8Array.from(a, (x) => Math.round(Math.max(-1, Math.min(1, x)) * 127));
    const sn = smoothNormals(m.pos, m.nor);
    this.meshes[name] = {
      n: m.n,
      i: m.idx.length,
      min: min.map((x) => +x.toFixed(4)),
      max: max.map((x) => +x.toFixed(4)),
      pos: this.put(qpos),
      nor: this.put(toI8(m.nor)),
      sn: this.put(toI8(sn)),
      col: this.put(m.col),
      skin: m.skin ? this.put(m.skin) : undefined,
      idx: this.put(Uint16Array.from(m.idx)),
    };
  }
  write(file) {
    const json = Buffer.from(JSON.stringify({ meshes: this.meshes, rigs: this.rigs }));
    const head = Buffer.alloc(4);
    head.writeUInt32LE(json.length);
    const pad = Buffer.alloc((4 - ((4 + json.length) % 4)) % 4);
    const all = Buffer.concat([head, json, pad, ...this.chunks]);
    const gz = gzipSync(all, { level: 9 });
    const p = join(OUT, file);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, gz);
    return gz.length;
  }
}

/* ------------------------------------------------------------------ rigs and clips */

function rigFrom(doc) {
  const skin = doc.g.skins[0];
  const tree = nodeTree(doc);
  const joints = skin.joints.map((j) => tree.nodes[j].name);
  const index = new Map(skin.joints.map((j, i) => [j, i]));
  // parents come before children, so the palette can be walked in order
  const order = [];
  const seen = new Set();
  const visit = (i) => {
    if (seen.has(i)) return;
    seen.add(i);
    const par = tree.parent[skin.joints[i]];
    if (index.has(par)) visit(index.get(par));
    order.push(i);
  };
  skin.joints.forEach((_, i) => visit(i));
  const ibmA = accessor(doc, skin.inverseBindMatrices);
  const names = order.map((i) => joints[i]);
  const parents = order.map((i) => {
    const par = tree.parent[skin.joints[i]];
    return index.has(par) ? order.indexOf(index.get(par)) : -1;
  });
  const rest = [];
  const ibm = [];
  for (const i of order) {
    const n = tree.nodes[skin.joints[i]];
    rest.push(...(n.translation ?? [0, 0, 0]), ...(n.rotation ?? [0, 0, 0, 1]), ...(n.scale ?? [1, 1, 1]));
    for (let c = 0; c < 16; c++) ibm.push(ibmA.data[i * 16 + c]);
  }
  const rootParent = tree.parent[skin.joints[order[0]]];
  const base = rootParent >= 0 ? tree.world[rootParent] : IDENT;
  return { joints: names, parents, rest: rest.map((x) => +x.toFixed(6)), ibm: ibm.map((x) => +x.toFixed(6)), base: base.map((x) => +x.toFixed(6)), clips: {}, _skinIndex: new Map(order.map((oi, ni) => [oi, ni])) };
}

function sampler(doc, s, comps) {
  const times = accessor(doc, s.input).data;
  const vals = accessor(doc, s.output).data;
  const step = s.interpolation === 'STEP';
  const cubic = s.interpolation === 'CUBICSPLINE';
  return (t) => {
    let a;
    if (t <= times[0]) a = 0;
    else if (t >= times[times.length - 1]) a = times.length - 1;
    else {
      let lo = 0, hi = times.length - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (times[mid] <= t) lo = mid;
        else hi = mid;
      }
      a = lo;
    }
    const b = Math.min(a + 1, times.length - 1);
    const k = b === a || step ? 0 : (t - times[a]) / (times[b] - times[a]);
    const w = cubic ? 3 * comps : comps;
    const off = cubic ? comps : 0;
    const out = new Array(comps);
    for (let c = 0; c < comps; c++) out[c] = vals[a * w + off + c] * (1 - k) + vals[b * w + off + c] * k;
    if (comps === 4) {
      // (a short lerp of neighbours, kept on the short way round)
      let dot = 0;
      for (let c = 0; c < 4; c++) dot += vals[a * w + off + c] * vals[b * w + off + c];
      if (dot < 0) for (let c = 0; c < 4; c++) out[c] = vals[a * w + off + c] * (1 - k) - vals[b * w + off + c] * k;
      const l = Math.hypot(...out) || 1;
      for (let c = 0; c < 4; c++) out[c] /= l;
    }
    return out;
  };
}

/** Bakes one animation onto a rig at `fps`: all rotations, and moves and scales only for the joints that have them. */
function bakeClip(pack, rigName, rig, doc, anim, id, fps) {
  const tree = nodeTree(doc);
  const J = rig.joints.length;
  const chans = rig.joints.map(() => ({}));
  let dur = 0;
  for (const c of anim.channels) {
    const nodeName = doc.g.nodes[c.target.node]?.name;
    const j = rig.joints.indexOf(nodeName);
    if (j < 0) continue;
    const s = anim.samplers[c.sampler];
    const times = accessor(doc, s.input).data;
    dur = Math.max(dur, times[times.length - 1]);
    chans[j][c.target.path] = sampler(doc, s, c.target.path === 'rotation' ? 4 : 3);
  }
  const defaults = rig.joints.map((name, j) => {
    const i = tree.nodes.findIndex((n) => n.name === name);
    const n = i >= 0 ? tree.nodes[i] : null;
    const r = rig.rest;
    return {
      t: n?.translation ?? [r[j * 10], r[j * 10 + 1], r[j * 10 + 2]],
      q: n?.rotation ?? [r[j * 10 + 3], r[j * 10 + 4], r[j * 10 + 5], r[j * 10 + 6]],
      s: n?.scale ?? [r[j * 10 + 7], r[j * 10 + 8], r[j * 10 + 9]],
    };
  });
  const n = Math.max(1, Math.round(dur * fps));
  const quats = new Int16Array(n * J * 4);
  const tj = [];
  const sj = [];
  const moves = rig.joints.map(() => []);
  const sizes = rig.joints.map(() => []);
  for (let f = 0; f < n; f++) {
    const t = (f / n) * dur;
    for (let j = 0; j < J; j++) {
      const q = chans[j].rotation ? chans[j].rotation(t) : defaults[j].q;
      for (let c = 0; c < 4; c++) quats[(f * J + j) * 4 + c] = Math.round(q[c] * 32767);
      moves[j].push(chans[j].translation ? chans[j].translation(t) : defaults[j].t);
      sizes[j].push(chans[j].scale ? chans[j].scale(t) : defaults[j].s);
    }
  }
  const differs = (list, r, off) => list.some((v) => Math.abs(v[0] - r[off]) + Math.abs(v[1] - r[off + 1]) + Math.abs(v[2] - r[off + 2]) > 2e-3);
  for (let j = 0; j < J; j++) {
    if (differs(moves[j], rig.rest, j * 10)) tj.push(j);
    if (differs(sizes[j], rig.rest, j * 10 + 7)) sj.push(j);
  }
  const tv = new Float32Array(n * tj.length * 3);
  tj.forEach((j, a) => moves[j].forEach((v, f) => tv.set(v, (f * tj.length + a) * 3)));
  const sv = new Float32Array(n * sj.length * 3);
  sj.forEach((j, a) => sizes[j].forEach((v, f) => sv.set(v, (f * sj.length + a) * 3)));
  rig.clips[id] = { n, fps: n / dur, q: pack.put(quats), tj, t: tj.length ? pack.put(tv) : 0, sj, s: sj.length ? pack.put(sv) : 0 };
}

const cleanRig = (r) => {
  const copy = { ...r };
  delete copy._skinIndex;
  return copy;
};

/** Every mesh of a character as parts skinned to `rig` (rigid pieces are tied to the bone above them). */
async function partsOf(doc, rig) {
  const tree = nodeTree(doc);
  const parts = {};
  for (let i = 0; i < tree.nodes.length; i++) {
    const node = tree.nodes[i];
    if (node.mesh === undefined) continue;
    const skinned = node.skin !== undefined;
    const prims = await primsOf(doc, node.mesh, skinned ? IDENT : tree.world[i]);
    const name = node.name ?? `mesh${i}`;
    for (const pr of prims) {
      pr.skin = new Uint8Array(pr.n * 3);
      if (skinned) {
        const skin = doc.g.skins[node.skin];
        const jn = accessor(doc, pr.p.attributes.JOINTS_0);
        const wt = accessor(doc, pr.p.attributes.WEIGHTS_0);
        const mapJ = (raw) => {
          let nodeI = skin.joints[raw];
          for (;;) {
            const j = rig.joints.indexOf(tree.nodes[nodeI]?.name);
            if (j >= 0) return j;
            nodeI = tree.parent[nodeI];
            if (nodeI < 0) return 0;
          }
        };
        for (let v = 0; v < pr.n; v++) {
          const inf = [0, 1, 2, 3].map((c) => ({ j: jn.data[v * 4 + c], w: wt.data[v * 4 + c] })).sort((a, b) => b.w - a.w);
          const sum = inf[0].w + inf[1].w || 1;
          pr.skin[v * 3] = mapJ(inf[0].j);
          pr.skin[v * 3 + 1] = mapJ(inf[1].j);
          pr.skin[v * 3 + 2] = Math.round((inf[0].w / sum) * 255);
        }
      } else {
        let up = tree.parent[i];
        let j = 0;
        while (up >= 0) {
          const k = rig.joints.indexOf(tree.nodes[up].name);
          if (k >= 0) {
            j = k;
            break;
          }
          up = tree.parent[up];
        }
        for (let v = 0; v < pr.n; v++) {
          pr.skin[v * 3] = j;
          pr.skin[v * 3 + 1] = j;
          pr.skin[v * 3 + 2] = 255;
        }
      }
    }
    if (prims.length) parts[name] = joinParts(prims);
  }
  return parts;
}

/** A prop: everything in the file, joined, in model space. */
async function propOf(path) {
  const doc = loadGltf(path);
  const tree = nodeTree(doc);
  const prims = [];
  for (let i = 0; i < tree.nodes.length; i++) {
    if (tree.nodes[i].mesh === undefined) continue;
    prims.push(...(await primsOf(doc, tree.nodes[i].mesh, tree.world[i])));
  }
  if (!prims.length) throw new Error(`no mesh in ${path}`);
  return joinParts(prims);
}

/** Which of the two KayKit rigs a character is bound to. */
function whichRig(doc, medium, large) {
  const skin = doc.g.skins[0];
  const tree = nodeTree(doc);
  const ibm = accessor(doc, skin.inverseBindMatrices).data;
  const score = (rig) => {
    let d = 0;
    skin.joints.forEach((nodeI, a) => {
      const j = rig.joints.indexOf(tree.nodes[nodeI].name);
      if (j < 0) {
        d += 1;
        return;
      }
      for (let c = 12; c < 15; c++) d += Math.abs(ibm[a * 16 + c] - rig.ibm[j * 16 + c]);
    });
    return d;
  };
  const m = score(medium);
  const l = score(large);
  return { rig: m <= l ? 'medium' : 'large', err: Math.min(m, l) };
}

/* ------------------------------------------------------------------ what goes in */

const CHARS = `${K}KayKit Adventurers 2.0/Characters/gltf/`;
const FW = `${K}KayKit Fantasy Weapons Bits 1.0/Assets/gltf/`;
const ADV = `${K}KayKit Adventurers 2.0/Assets/gltf/`;
const FOREST = `${K}KayKit Forest Nature Pack 1.0/Assets/gltf/Color1/`;
const NAT = 'kenney_nature-kit/Models/GLTF format/';
const HEX = `${K}KayKit Medieval Hexagon Pack 1.0.1/Assets/gltf/`;
const DUN = `${K}KayKit Dungeon Pack 1.1/Assets/gltf/`;
const HAL = `${K}KayKit Halloween Bits 1.0/Assets/gltf/`;
const FUR = `${K}KayKit Furniture Bits 1.0/Assets/gltf/`;
const TOOL = `${K}KayKit RPG Tools Bits 1.0/Assets/gltf/`;
const GRAVE = 'kenney_graveyard-kit_5/Models/GLB format/';

function findChar(name) {
  for (const s of ['KayKit Mystery Monthly Series 4 (1.1)', 'KayKit Mystery Monthly Series 5 (1.1)', 'KayKit Mystery Monthly Series 6 (1.1)', 'KayKit Skeletons 1.1', 'KayKit Adventurers 2.0/Characters/gltf']) {
    const stack = [join(SRC, K, s)];
    while (stack.length) {
      const d = stack.pop();
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) {
          if (!/source|samples|fbx/i.test(f)) stack.push(p);
        } else if (f === `${name}.glb`) return p;
      }
    }
  }
  throw new Error(`no character ${name}`);
}

let bitIndex = null;
/** A weapon or bit by name, wherever in the KayKit packs it lives. */
function findBit(name) {
  if (!bitIndex) {
    bitIndex = new Map();
    const stack = [join(SRC, K)];
    while (stack.length) {
      const d = stack.pop();
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) {
          if (!/source|samples|fbx|^obj$|unity|characters|animations/i.test(f)) stack.push(p);
        } else if (/\.(gltf|glb)$/.test(f)) {
          const n = f.replace(/\.gltf\.glb$|\.gltf$|\.glb$/, '');
          if (!bitIndex.has(n)) bitIndex.set(n, p);
        }
      }
    }
  }
  const p = bitIndex.get(name);
  if (!p) throw new Error(`no bit ${name}`);
  return p;
}

/** A rigid thing tied to a joint: placed where the joint is at rest. */
function tiePart(m, rig, jointName, shift = null, scale = 1) {
  const j = rig.joints.indexOf(jointName);
  if (j < 0) throw new Error(`no joint ${jointName}`);
  let world = invert(rig.ibm.slice(j * 16, j * 16 + 16));
  if (shift || scale !== 1) world = mul(world, trs(shift ?? [0, 0, 0], [0, 0, 0, 1], [scale, scale, scale]));
  const pos = new Float32Array(m.n * 3);
  const nor = new Float32Array(m.n * 3);
  const skin = new Uint8Array(m.n * 3);
  for (let v = 0; v < m.n; v++) {
    pos.set(point(world, m.pos[v * 3], m.pos[v * 3 + 1], m.pos[v * 3 + 2]), v * 3);
    nor.set(dirOf(world, m.nor[v * 3], m.nor[v * 3 + 1], m.nor[v * 3 + 2]), v * 3);
    skin[v * 3] = j;
    skin[v * 3 + 1] = j;
    skin[v * 3 + 2] = 255;
  }
  return { n: m.n, pos, nor, col: m.col, skin, idx: m.idx };
}

/** A part made for one skeleton, moved onto the same joint of another. */
function moveToRig(m, fromRig, rig) {
  const out = { ...m, pos: new Float32Array(m.n * 3), nor: new Float32Array(m.nor), skin: new Uint8Array(m.skin) };
  for (let v = 0; v < m.n; v++) {
    const name = fromRig.joints[m.skin[v * 3]];
    const j = rig.joints.indexOf(name);
    const fromI = fromRig.ibm.slice(m.skin[v * 3] * 16, m.skin[v * 3] * 16 + 16);
    const local = point(fromI, m.pos[v * 3], m.pos[v * 3 + 1], m.pos[v * 3 + 2]);
    const toW = invert(rig.ibm.slice(j * 16, j * 16 + 16));
    out.pos.set(point(toW, local[0], local[1], local[2]), v * 3);
    out.skin[v * 3] = j;
    out.skin[v * 3 + 1] = j;
    out.skin[v * 3 + 2] = 255;
  }
  return out;
}

function grayed(m, floor = 70) {
  const col = new Uint8Array(m.n * 3);
  for (let v = 0; v < m.n; v++) {
    const l = 0.3 * m.col[v * 3] + 0.59 * m.col[v * 3 + 1] + 0.11 * m.col[v * 3 + 2];
    const c = Math.min(255, floor + l * 0.85);
    col[v * 3] = c;
    col[v * 3 + 1] = c;
    col[v * 3 + 2] = c;
  }
  return { ...m, col };
}

/* ------------------------------------------------------------------ built creatures */

const mixed = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Low-poly shapes, skinned whole to one joint each (or, a `tube`, ring by ring between two). */
class Builder {
  constructor() {
    this.parts = [];
    this.o = [0, 0, 0];
  }
  /** Where what's shaped next is set down: shapes are made round their joint, and the joint stands here. */
  at(p) {
    this.o = [p[0], p[1], p[2]];
    return this;
  }
  /** `color`: one color, or what color a point is by which way it faces. */
  blob(joint, c, r, color, seg = 7, rings = 5) {
    return this.oval(joint, c, r, color, null, seg, rings);
  }
  /** A blob turned: `turn` {x, y, z} in radians. Its colors go by the way a point faced before the turn. */
  oval(joint, c, r, color, turn = null, seg = 7, rings = 5) {
    const pos = [];
    const nor = [];
    const col = [];
    const skin = [];
    const idx = [];
    const e = turn && (turn.x || turn.y || turn.z) ? new THREE.Euler(turn.x ?? 0, turn.y ?? 0, turn.z ?? 0) : null;
    const v = new THREE.Vector3();
    for (let i = 0; i <= rings; i++) {
      const a = (i / rings) * Math.PI;
      for (let j = 0; j <= seg; j++) {
        const bb = (j / seg) * Math.PI * 2;
        const n = [Math.sin(a) * Math.cos(bb), Math.cos(a), Math.sin(a) * Math.sin(bb)];
        let p = [n[0] * r[0], n[1] * r[1], n[2] * r[2]];
        // (the way the skin of a squashed ball faces isn't the way out from its middle)
        let m = [n[0] / r[0], n[1] / r[1], n[2] / r[2]];
        const ml = Math.hypot(m[0], m[1], m[2]) || 1;
        m = m.map((x) => x / ml);
        if (e) {
          v.set(p[0], p[1], p[2]).applyEuler(e);
          p = [v.x, v.y, v.z];
          v.set(m[0], m[1], m[2]).applyEuler(e);
          m = [v.x, v.y, v.z];
        }
        pos.push(c[0] + p[0], c[1] + p[1], c[2] + p[2]);
        nor.push(m[0], m[1], m[2]);
        const cl = typeof color === 'function' ? color(n) : color;
        const shade = 0.86 + 0.14 * m[1];
        col.push(cl[0] * shade, cl[1] * shade, cl[2] * shade);
        skin.push(joint, joint, 255);
      }
    }
    for (let i = 0; i < rings; i++) {
      for (let j = 0; j < seg; j++) {
        const p = i * (seg + 1) + j;
        idx.push(p, p + 1, p + seg + 1, p + 1, p + seg + 2, p + seg + 1);
      }
    }
    this.add(pos, nor, col, skin, idx);
    return this;
  }
  /**
   * One skin over a run of rings (a serpent's length): each ring {p, rx, ry, skin: [joint, joint, share], color(nx, ny)},
   * placed in the model, not round a joint. The first end is closed here; the last ring closes the other.
   */
  tube(rings, seg = 8) {
    const pos = [];
    const nor = [];
    const col = [];
    const skin = [];
    const idx = [];
    const all = [{ ...rings[0], rx: 0.001, ry: 0.001 }, ...rings];
    // (across starts out to the side, and is carried along the run from ring to ring, so the skin doesn't twist)
    let u = [1, 0, 0];
    all.forEach((ring, i) => {
      const a = all[Math.max(0, i - 1)].p;
      const z = all[Math.min(all.length - 1, i + 1)].p;
      let A = [z[0] - a[0], z[1] - a[1], z[2] - a[2]];
      const l = Math.hypot(A[0], A[1], A[2]) || 1;
      A = A.map((x) => x / l);
      const d = u[0] * A[0] + u[1] * A[1] + u[2] * A[2];
      u = u.map((x, c) => x - A[c] * d);
      const ul = Math.hypot(u[0], u[1], u[2]) || 1;
      u = u.map((x) => x / ul);
      const v = [A[1] * u[2] - A[2] * u[1], A[2] * u[0] - A[0] * u[2], A[0] * u[1] - A[1] * u[0]];
      for (let j = 0; j <= seg; j++) {
        const t = (j / seg) * Math.PI * 2;
        const n = [u[0] * Math.cos(t) + v[0] * Math.sin(t), u[1] * Math.cos(t) + v[1] * Math.sin(t), u[2] * Math.cos(t) + v[2] * Math.sin(t)];
        pos.push(ring.p[0] + u[0] * Math.cos(t) * ring.rx + v[0] * Math.sin(t) * ring.ry, ring.p[1] + u[1] * Math.cos(t) * ring.rx + v[1] * Math.sin(t) * ring.ry, ring.p[2] + u[2] * Math.cos(t) * ring.rx + v[2] * Math.sin(t) * ring.ry);
        nor.push(n[0], n[1], n[2]);
        const cl = ring.color(n[0], n[1]);
        const shade = 0.88 + 0.12 * n[1];
        col.push(cl[0] * shade, cl[1] * shade, cl[2] * shade);
        skin.push(ring.skin[0], ring.skin[1], ring.skin[2]);
      }
    });
    for (let i = 0; i < all.length - 1; i++) {
      for (let j = 0; j < seg; j++) {
        const p = i * (seg + 1) + j;
        idx.push(p, p + 1, p + seg + 1, p + 1, p + seg + 2, p + seg + 1);
      }
    }
    this.parts.push({ n: pos.length / 3, pos: Float32Array.from(pos), nor: Float32Array.from(nor), col: Uint8Array.from(col, (c) => Math.max(0, Math.min(255, c * 255))), skin: Uint8Array.from(skin), idx });
    return this;
  }
  /** A thin skin between three points (a wing's web), `top` above and `under` below. */
  sheet(joint, a, b, c, top, under) {
    let n = [(b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]), (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]), (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])];
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    n = n.map((x) => x / l);
    // (so that the first face is the one that looks up)
    const [p, q, r] = n[1] >= 0 ? [a, b, c] : [a, c, b];
    if (n[1] < 0) n = n.map((x) => -x);
    const T = 0.012;
    const pos = [];
    const nor = [];
    const col = [];
    const skin = [];
    for (const [pts, s, cl] of [[[p, q, r], 1, top], [[p, r, q], -1, under]]) {
      for (const pt of pts) {
        pos.push(pt[0] + n[0] * T * s, pt[1] + n[1] * T * s, pt[2] + n[2] * T * s);
        nor.push(n[0] * s, n[1] * s, n[2] * s);
        col.push(cl[0], cl[1], cl[2]);
        skin.push(joint, joint, 255);
      }
    }
    this.add(pos, nor, col, skin, [0, 1, 2, 3, 4, 5]);
    return this;
  }
  /** A tapered limb from one point to another. */
  limb(joint, a, b, r0, r1, color, seg = 5) {
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const l = Math.hypot(...d) || 1;
    const z = d.map((x) => x / l);
    const up = Math.abs(z[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    const x = [up[1] * z[2] - up[2] * z[1], up[2] * z[0] - up[0] * z[2], up[0] * z[1] - up[1] * z[0]];
    const xl = Math.hypot(...x);
    x[0] /= xl;
    x[1] /= xl;
    x[2] /= xl;
    const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
    const pos = [];
    const nor = [];
    const col = [];
    const skin = [];
    const idx = [];
    for (let e = 0; e < 2; e++) {
      const o = e ? b : a;
      const r = e ? r1 : r0;
      for (let j = 0; j <= seg; j++) {
        const t = (j / seg) * Math.PI * 2;
        const n = [x[0] * Math.cos(t) + y[0] * Math.sin(t), x[1] * Math.cos(t) + y[1] * Math.sin(t), x[2] * Math.cos(t) + y[2] * Math.sin(t)];
        pos.push(o[0] + n[0] * r, o[1] + n[1] * r, o[2] + n[2] * r);
        nor.push(n[0], n[1], n[2]);
        col.push(color[0], color[1], color[2]);
        skin.push(joint, joint, 255);
      }
    }
    for (let j = 0; j < seg; j++) idx.push(j, j + 1, j + seg + 1, j + 1, j + seg + 2, j + seg + 1);
    this.add(pos, nor, col, skin, idx);
    return this;
  }
  add(pos, nor, col, skin, idx) {
    for (let i = 0; i < pos.length; i++) pos[i] += this.o[i % 3];
    this.parts.push({ n: pos.length / 3, pos: Float32Array.from(pos), nor: Float32Array.from(nor), col: Uint8Array.from(col, (c) => Math.max(0, Math.min(255, c * 255))), skin: Uint8Array.from(skin), idx });
  }
  done() {
    return joinParts(this.parts);
  }
}

const rgb = (hex) => [parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255];

/** A skeleton from a list of joints (name, parent, place relative to it), with clips from functions of time. */
function builtRig(pack, id, joints, clips) {
  const J = joints.length;
  const names = joints.map((j) => j[0]);
  const parents = joints.map((j) => (j[1] ? names.indexOf(j[1]) : -1));
  const rest = [];
  const world = [];
  const ibm = [];
  joints.forEach((j, i) => {
    rest.push(...j[2], 0, 0, 0, 1, 1, 1, 1);
    const m = trs(j[2]);
    world[i] = parents[i] < 0 ? m : mul(world[parents[i]], m);
    ibm.push(...invert(world[i]));
  });
  const rig = { joints: names, parents, rest, ibm, base: IDENT, clips: {} };
  for (const [clip, def] of Object.entries(clips)) {
    const fps = 15;
    const n = Math.max(2, Math.round(def.dur * fps));
    const quats = new Int16Array(n * J * 4);
    const moves = new Float32Array(n * J * 3);
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    for (let f = 0; f < n; f++) {
      const t = (f / n) * def.dur;
      for (let j = 0; j < J; j++) {
        const pose = def.pose(names[j], j, t, f / n) ?? {};
        e.set(pose.rx ?? 0, pose.ry ?? 0, pose.rz ?? 0);
        q.setFromEuler(e);
        quats[(f * J + j) * 4] = q.x * 32767;
        quats[(f * J + j) * 4 + 1] = q.y * 32767;
        quats[(f * J + j) * 4 + 2] = q.z * 32767;
        quats[(f * J + j) * 4 + 3] = q.w * 32767;
        moves[(f * J + j) * 3] = joints[j][2][0] + (pose.dx ?? 0);
        moves[(f * J + j) * 3 + 1] = joints[j][2][1] + (pose.dy ?? 0);
        moves[(f * J + j) * 3 + 2] = joints[j][2][2] + (pose.dz ?? 0);
      }
    }
    const tj = Array.from({ length: J }, (_, i) => i);
    rig.clips[clip] = { n, fps: n / def.dur, q: pack.put(quats), tj, t: pack.put(moves), sj: [], s: 0 };
  }
  pack.rigs[id] = rig;
  return rig;
}

/** Crawling things: a head, a body in its plates, legs that bend at a knee, and claws, a tail, a shell or a horn. */
function bugKit(id, o) {
  const pack = new Pack();
  const joints = [['root', null, [0, 0, 0]], ['body', 'root', [0, o.h, 0]]];
  // (where each joint stands in the model: a part is shaped round its joint, then set down there)
  const W = { root: [0, 0, 0], body: [0, o.h, 0] };
  const joint = (name, parent, at) => {
    joints.push([name, parent, at]);
    W[name] = W[parent].map((x, i) => x + at[i]);
    b.at(W[name]);
    return joints.length - 1;
  };
  const dark = rgb(o.dark);
  const main = rgb(o.main);
  const light = rgb(o.light);
  const pale = mixed(light, [1, 0.97, 0.9], 0.45);
  const black = [0.07, 0.05, 0.08];
  const [bx, by, bz] = o.body;
  const b = new Builder();
  b.at(W.body);
  const under = (top, n) => (n[1] < -0.25 ? mixed(top, dark, 0.6) : top);
  const eye = (p, r) => {
    b.blob(1, p, [r, r, r], o.eye ? rgb(o.eye) : black, 6, 4);
    if (o.eye) b.blob(1, [p[0], p[1], p[2] + r * 0.62], [r * 0.5, r * 0.62, r * 0.5], black, 5, 3);
    b.blob(1, [p[0] + r * 0.3, p[1] + r * 0.45, p[2] + r * 0.72], [r * 0.3, r * 0.3, r * 0.3], [1, 1, 1], 4, 2);
  };
  // the head, set low at the front
  const hr = o.head ?? [bx * 0.55, by * 0.6, bz * 0.4];
  const hz = bz * 0.9 + hr[2] * 0.5;
  const hy = -by * 0.12;
  if (o.kind === 'crab') {
    // one wide shell, pale at its rim and under, pocked on top, spined along its front edge
    b.blob(1, [0, 0, 0], o.body, (n) => (n[1] < -0.2 ? pale : n[1] < 0.22 ? light : Math.sin(n[0] * 13) * Math.sin(n[2] * 11 + 1) > 0.55 ? mixed(main, dark, 0.55) : main), 12, 7);
    for (let k = -3; k <= 3; k++) {
      const a = (k / 3) * 1.15;
      const p = [Math.sin(a) * bx * 0.93, by * 0.1, Math.cos(a) * bz * 0.93];
      b.limb(1, p, [p[0] * 1.14, by * 0.3, p[2] * 1.16 + 0.02], 0.05, 0.004, light);
    }
    for (const s of [-1, 1]) {
      b.limb(1, [s * bx * 0.3, by * 0.5, bz * 0.72], [s * bx * 0.34, by * 1.25, bz * 0.86], 0.035, 0.03, main);
      eye([s * bx * 0.34, by * 1.3, bz * 0.88], 0.075);
    }
  } else {
    if (o.kind === 'scorpion') {
      // a low run of plates, each lapped over the next
      for (let k = 0; k < 5; k++) {
        const f = 1 - k * 0.09;
        b.blob(1, [0, by * (0.05 - k * 0.03), bz * (0.62 - k * 0.36)], [bx * f, by * f, bz * 0.3], (n) => under(k % 2 ? mixed(main, dark, 0.35) : main, n), 9, 5);
      }
    } else b.blob(1, [0, 0, 0], o.body, (n) => under(main, n), 9, 6);
    b.blob(1, [0, hy, hz], hr, (n) => under(mixed(main, dark, 0.45), n), 8, 5);
    if (o.abdomen) {
      // a spider's great hind part, tipped up, with its mark down the back
      const a = o.abdomen;
      b.oval(1, [0, by * 0.45, -bz * 0.7 - a[2] * 0.82], a, (n) => (n[1] > 0.25 && Math.abs(n[0]) < 0.3 && Math.sin(n[2] * 8.5 + 0.6) > -0.1 ? light : n[1] < -0.3 ? mixed(dark, black, 0.4) : dark), { x: 0.28 }, 10, 7);
    }
    if (o.shell) {
      // wing cases: a seam down the middle, a shine along one side, ribbed
      b.blob(1, [0, by * 0.18, bz * 0.58], [bx * 0.84, by * 0.78, bz * 0.36], (n) => under(mixed(light, main, 0.5), n), 9, 5);
      b.blob(1, [0, by * 0.3, -bz * 0.3], [bx * 1.06, by * 0.95, bz * 0.92], (n) => {
        if (n[1] < -0.2) return mixed(main, dark, 0.5);
        if (Math.abs(n[0]) < 0.07 && n[1] > 0) return dark;
        if (n[1] > 0.55 && n[0] > 0.18 && n[0] < 0.5) return mixed(light, [1, 1, 1], 0.45);
        return Math.sin(Math.abs(n[0]) * 19) > 0.72 ? mixed(light, main, 0.55) : light;
      }, 12, 7);
    }
    // eyes
    if (o.kind === 'spider') {
      for (const s of [-1, 1]) {
        eye([s * hr[0] * 0.34, hy + hr[1] * 0.5, hz + hr[2] * 0.78], 0.06);
        eye([s * hr[0] * 0.72, hy + hr[1] * 0.42, hz + hr[2] * 0.5], 0.04);
        eye([s * hr[0] * 0.3, hy + hr[1] * 0.85, hz + hr[2] * 0.4], 0.032);
      }
    } else for (const s of [-1, 1]) eye([s * hr[0] * 0.62, hy + hr[1] * 0.45, hz + hr[2] * 0.66], o.eyeSize ?? 0.06);
    // jaws, and feelers
    if (o.jaws) for (const s of [-1, 1]) {
      const p = [s * hr[0] * 0.42, hy - hr[1] * 0.2, hz + hr[2] * 0.75];
      b.limb(1, p, [s * hr[0] * 0.5, hy - hr[1] * 0.45, hz + hr[2] * 0.75 + o.jaws * 0.6], o.jaws * 0.3, o.jaws * 0.22, mixed(main, dark, 0.6));
      b.limb(1, [s * hr[0] * 0.5, hy - hr[1] * 0.45, hz + hr[2] * 0.75 + o.jaws * 0.6], [s * hr[0] * 0.12, hy - hr[1] * 0.75, hz + hr[2] * 0.75 + o.jaws * 1.05], o.jaws * 0.22, 0.004, pale);
    }
    if (o.feelers) for (const s of [-1, 1]) {
      const p = [s * hr[0] * 0.35, hy + hr[1] * 0.6, hz + hr[2] * 0.5];
      const q = [s * hr[0] * 0.9, hy + hr[1] * 1.5 * o.feelers, hz + hr[2] * 0.9 + 0.14 * o.feelers];
      b.limb(1, p, q, 0.022, 0.016, dark, 4);
      b.limb(1, q, [q[0] + s * 0.12 * o.feelers, q[1] - 0.04, q[2] + 0.16 * o.feelers], 0.016, 0.004, dark, 4);
    }
    if (o.horn) {
      // a stag-beetle's horn: up and forward, forked at its end
      const p = [0, hy + hr[1] * 0.5, hz + hr[2] * 0.3];
      const q = [0, hy + hr[1] * 0.5 + o.horn * 0.75, hz + hr[2] * 0.3 + o.horn * 0.7];
      b.limb(1, p, q, 0.085, 0.06, mixed(light, main, 0.4));
      for (const s of [-1, 1]) b.limb(1, q, [s * o.horn * 0.3, q[1] + o.horn * 0.3, q[2] + o.horn * 0.12], 0.06, 0.004, pale);
    }
  }
  // legs: out and up to a knee, then down to the ground; the front pair reaching forward, the hind pair back
  const pairs = o.legs / 2;
  for (let k = 0; k < pairs; k++) {
    const row = pairs > 1 ? 0.5 - k / (pairs - 1) : 0;
    for (const s of [-1, 1]) {
      const name = `leg${k * 2 + (s > 0 ? 1 : 0)}`;
      const at = [s * bx * (o.kind === 'crab' ? 0.72 : 0.7), -by * 0.25, row * bz * (o.spread ?? 1.2) + (o.legsAt ?? 0)];
      const j = joint(name, 'body', at);
      const fan = row * (o.fan ?? 1.1);
      const knee = [s * o.reach * 0.5, o.knee, fan * o.reach * 0.4];
      const foot = [s * o.reach, -(o.h + at[1]) + 0.015, fan * o.reach * 0.85];
      b.limb(j, [0, 0, 0], knee, o.leg, o.leg * 0.8, mixed(main, dark, 0.5));
      b.blob(j, knee, [o.leg * 1.05, o.leg * 1.05, o.leg * 1.05], main, 5, 3);
      b.limb(j, knee, foot, o.leg * 0.78, o.leg * 0.18, dark);
      if (o.pads) b.blob(j, [foot[0], foot[1], foot[2]], [o.pads, 0.012, o.pads], light, 6, 2);
    }
  }
  if (o.claws) {
    const c = o.claws;
    const a = o.arm ?? 0.3;
    for (const s of [-1, 1]) {
      const j = joint(s < 0 ? 'clawL' : 'clawR', 'body', [s * bx * 0.7, -by * 0.05, bz * 0.72]);
      const elbow = [s * a * 0.95, 0.05, a * 0.55];
      const wrist = [s * a * 0.8, 0.07, a * 1.5];
      b.limb(j, [0, 0, 0], elbow, c * 0.36, c * 0.32, main);
      b.blob(j, elbow, [c * 0.36, c * 0.36, c * 0.36], mixed(main, dark, 0.3), 5, 3);
      b.limb(j, elbow, wrist, c * 0.32, c * 0.4, main);
      // the hand, and its two fingers closing on each other
      b.oval(j, [wrist[0], wrist[1], wrist[2] + c * 0.55], [c * 0.72, c * 0.56, c * 0.95], (n) => (n[1] < -0.2 ? pale : light), { y: s * -0.25 }, 8, 5);
      b.limb(j, [wrist[0] + s * c * 0.34, wrist[1], wrist[2] + c * 1.05], [wrist[0] - s * c * 0.05, wrist[1], wrist[2] + c * 2.35], c * 0.34, 0.006, pale);
      b.limb(j, [wrist[0] - s * c * 0.36, wrist[1], wrist[2] + c * 0.95], [wrist[0] - s * c * 0.2, wrist[1], wrist[2] + c * 2.1], c * 0.24, 0.006, pale);
    }
  }
  if (o.tail) {
    // a scorpion's tail: up from the hind end, over the back, the sting hanging forward
    const k = o.tail;
    const steps = [[0, 0.2, -0.16], [0, 0.25, -0.03], [0, 0.21, 0.13], [0, 0.1, 0.21], [0, -0.02, 0.19]].map((v) => v.map((x) => x * k));
    let last = 'body';
    let at = [0, by * 0.2, -bz * 1.02];
    for (let i = 0; i < 5; i++) {
      const j = joint(`tail${i}`, last, at);
      const r = (0.105 - i * 0.008) * k;
      if (i < 4) {
        b.blob(j, [0, 0, 0], [r, r, r], i % 2 ? mixed(main, dark, 0.4) : main, 6, 4);
        b.limb(j, [0, 0, 0], steps[i], r * 0.8, r * 0.75, i % 2 ? main : mixed(main, dark, 0.4));
      } else {
        b.blob(j, [0, 0, 0], [r * 1.25, r * 1.25, r * 1.35], light, 7, 5);
        b.limb(j, [0, -r * 0.4, r * 0.9], [0, -r * 2.6, r * 2.3], r * 0.62, 0.004, [0.2, 0.1, 0.08]);
      }
      at = steps[i];
      last = `tail${i}`;
    }
  }
  const legSwing = (name, t, amp) => {
    const n = Number(name.slice(3));
    const side = n % 2 ? 1 : -1;
    const ph = (n % 2 === Math.floor(n / 2) % 2 ? 0 : Math.PI) + t;
    // (forward and back about the upright, lifted on the way forward)
    return { ry: Math.sin(ph) * amp * side, rz: side * Math.max(0, Math.cos(ph)) * amp * 0.55 };
  };
  const tau = Math.PI * 2;
  builtRig(pack, id, joints, {
    idle: {
      dur: 1.6,
      pose: (n, j, t, u) => {
        if (n === 'body') return { dy: Math.sin(u * tau) * 0.014 };
        if (n.startsWith('tail')) return { rx: Math.sin(u * tau + Number(n[4]) * 0.7) * 0.06 };
        if (n === 'clawL' || n === 'clawR') return { ry: Math.sin(u * tau) * 0.08 * (n === 'clawL' ? 1 : -1) };
        return null;
      },
    },
    walk: { dur: 0.6, pose: (n, j, t, u) => (n.startsWith('leg') ? legSwing(n, u * tau, 0.34) : n === 'body' ? { dy: Math.abs(Math.sin(u * tau * 2)) * 0.015, rz: Math.sin(u * tau) * 0.03 } : null) },
    run: { dur: 0.36, pose: (n, j, t, u) => (n.startsWith('leg') ? legSwing(n, u * tau, 0.44) : n === 'body' ? { rz: Math.sin(u * tau) * 0.04 } : null) },
    chop: {
      dur: 0.6,
      pose: (n, j, t, u) => {
        const k = Math.sin(Math.min(1, u * 1.5) * Math.PI);
        if (n === 'body') return { rx: -k * 0.22, dz: k * 0.12 };
        if (n === 'clawL') return { ry: k * 0.5, rx: -k * 0.3 };
        if (n === 'clawR') return { ry: -k * 0.5, rx: -k * 0.3 };
        if (n.startsWith('tail')) return { rx: k * 0.3 };
        return null;
      },
    },
    hit: { dur: 0.3, pose: (n, j, t, u) => (n === 'body' ? { rx: Math.sin(u * Math.PI) * 0.2, dz: -Math.sin(u * Math.PI) * 0.06 } : null) },
    die: {
      dur: 0.7,
      pose: (n, j, t, u) => {
        const k = Math.min(1, u * 1.6);
        if (n === 'root') return { rz: k * Math.PI, dy: Math.sin(k * Math.PI) * 0.3 + k * o.h * 1.6 };
        if (n.startsWith('leg')) return { rz: (Number(n.slice(3)) % 2 ? 1 : -1) * k * 0.7 };
        return null;
      },
    },
  });
  pack.addMesh('body', b.done());
  pack.meshes.body.rig = id;
  return pack;
}

/**
 * A serpent: one length of skin over a chain of joints, the head held up off the ground on its neck, the body waving
 * along itself behind. A cobra's hood, a crest of spines, a wurm's ring of teeth, a drake's wings, as each has them.
 */
function serpentKit(id, o) {
  const pack = new Pack();
  const main = rgb(o.main);
  const dark = rgb(o.dark);
  const light = rgb(o.light);
  const pale = mixed(light, [1, 0.97, 0.88], 0.5);
  const black = [0.07, 0.05, 0.08];
  const N = o.n;
  const r = o.r;
  const seg = o.len / N;
  const up = o.up ?? r * 4;
  const neck = o.neck ?? 3;
  // the line down its middle: from the head, down the neck to the ground, and along it
  const P = [[0, up, o.len * 0.36]];
  for (let i = 1; i < N; i++) {
    const t = Math.min(1, i / neck);
    const y = r * 0.92 + (up - r * 0.92) * (1 - t * t * (3 - 2 * t));
    const dy = y - P[i - 1][1];
    const dz = Math.sqrt(Math.max(seg * seg - dy * dy, seg * seg * 0.2));
    P.push([0, y, P[i - 1][2] - dz]);
  }
  const joints = [['root', null, [0, 0, 0]]];
  for (let i = 0; i < N; i++) joints.push([`s${i}`, i ? `s${i - 1}` : 'root', i ? P[i].map((x, c) => x - P[i - 1][c]) : P[0]]);
  const b = new Builder();
  // how thick it is along its length: a slim neck, thickest a third of the way down, then away to nothing
  const thick = (t) => r * (t < 0.3 ? 0.72 + (t / 0.3) * 0.28 : 1 - Math.pow((t - 0.3) / 0.7, 1.5) * 0.9) * (o.maw ? 1.08 : 1);
  const rings = [];
  const skinOf = (i, half) => (half && i < N - 1 ? [i + 1, i + 2, 128] : [i + 1, i + 1, 255]);
  for (let i = 0; i < N; i++) {
    for (const half of [0, 1]) {
      if (half && i === N - 1) break;
      const p = half ? P[i].map((x, c) => (x + P[i + 1][c]) / 2) : P[i];
      const t = (i + half * 0.5) / (N - 0.5);
      const band = (i * 2 + half) % 4 < 2;
      const k = thick(t) * (o.maw && !half ? 1.08 : 1);
      rings.push({
        p,
        rx: k,
        ry: k * 0.9,
        skin: skinOf(i, half),
        color: (nx, ny) => {
          if (ny < -0.45) return pale;
          if (ny < -0.15) return mixed(pale, main, 0.5);
          if (o.maw) return half ? mixed(main, dark, 0.7) : ny > 0.6 ? mixed(main, light, 0.4) : main;
          // a row of dark saddles down the back, a spot between them on each flank
          if (ny > 0.5) return band ? mixed(dark, [0, 0, 0], 0.25) : mixed(main, light, 0.7);
          if (!band && ny > 0 && ny < 0.4) return mixed(main, dark, 0.7);
          return main;
        },
      });
    }
  }
  const end = P[N - 1].map((x, c) => x + (x - P[N - 2][c]) * 0.9);
  rings.push({ p: end, rx: 0.012, ry: 0.012, skin: [N, N, 255], color: () => dark });
  b.tube(rings, 9);
  // ---- the head, on the first joint
  b.at(P[0]);
  if (o.maw) {
    // a wurm has no face: a blunt end, a dark gullet, and a ring of teeth round it
    b.blob(1, [0, 0, r * 0.35], [r * 1.12, r * 1.05, r * 0.95], (n) => (n[2] > 0.72 ? [0.2, 0.06, 0.08] : n[1] < -0.4 ? pale : main), 10, 7);
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      const c = [Math.cos(a) * r * 0.74, Math.sin(a) * r * 0.7, r * 1.02];
      b.limb(1, c, [Math.cos(a) * r * 0.42, Math.sin(a) * r * 0.4, r * (k % 2 ? 1.75 : 1.5)], r * 0.17, 0.004, pale);
    }
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + 0.785;
      b.limb(1, [Math.cos(a) * r * 0.98, Math.sin(a) * r * 0.92, r * 0.5], [Math.cos(a) * r * 1.3, Math.sin(a) * r * 1.22, r * 1.55], r * 0.2, 0.004, dark);
    }
  } else {
    b.oval(1, [0, r * 0.08, r * 0.7], [r * 1.2, r * 0.76, r * 1.45], (n) => (n[1] < -0.2 ? pale : n[1] > 0.55 && n[2] < 0.3 ? dark : main), { x: 0.1 }, 10, 6);
    b.oval(1, [0, -r * 0.12, r * 1.85], [r * 0.8, r * 0.5, r * 0.85], (n) => (n[1] < -0.2 ? pale : mixed(main, light, 0.3)), { x: 0.1 }, 8, 5);
    for (const s of [-1, 1]) {
      const er = r * 0.27;
      const e = [s * r * 0.78, r * 0.36, r * 1.28];
      b.blob(1, e, [er, er, er], [0.99, 0.84, 0.2], 6, 4);
      b.blob(1, [e[0] + s * er * 0.6, e[1], e[2] + er * 0.52], [er * 0.42, er * 0.82, er * 0.42], black, 5, 3);
      // a heavy brow over each eye: what makes it a look
      b.limb(1, [s * r * 0.3, r * 0.56, r * 1.95], [s * r * 1.08, r * 0.78, r * 0.75], r * 0.15, r * 0.19, dark);
      b.limb(1, [s * r * 0.3, -r * 0.38, r * 2.3], [s * r * 0.3, -r * 0.95, r * 2.2], r * 0.1, 0.004, [1, 1, 0.95], 4);
      b.blob(1, [s * r * 0.26, -r * 0.02, r * 2.52], [r * 0.07, r * 0.05, r * 0.07], black, 4, 2);
    }
    if (o.tongue !== false) {
      const red = [0.86, 0.14, 0.2];
      b.limb(1, [0, -r * 0.42, r * 2.4], [0, -r * 0.62, r * 3.2], r * 0.07, r * 0.055, red, 4);
      for (const s of [-1, 1]) b.limb(1, [0, -r * 0.62, r * 3.2], [s * r * 0.26, -r * 0.56, r * 3.75], r * 0.055, 0.004, red, 4);
    }
    if (o.horns) for (const s of [-1, 1]) {
      const p = [s * r * 0.62, r * 0.6, r * 0.25];
      const q = [s * r * 0.95, r * 1.3, -r * 0.9 * o.horns];
      b.limb(1, p, q, r * 0.24, r * 0.15, mixed(dark, black, 0.3));
      b.limb(1, q, [s * r * 0.85, r * 1.45, -r * 1.9 * o.horns], r * 0.15, 0.004, pale);
    }
  }
  if (o.hood) {
    // a cobra's hood: spread flat behind the head, across the line of the neck
    const mid = P[1].map((x, c) => (x + P[0][c]) / 2);
    const d = [P[0][1] - P[1][1], P[0][2] - P[1][2]];
    b.at(mid);
    b.oval(2, [0, 0, 0], [r * 2.3 * o.hood, r * 1.9 * o.hood, r * 0.42], (n) => (n[2] > 0.25 ? (Math.hypot(n[0], n[1] - 0.1) < 0.42 && Math.hypot(n[0], n[1] - 0.1) > 0.22 ? dark : pale) : n[2] < -0.3 && Math.abs(n[0]) < 0.25 ? dark : main), { x: Math.atan2(d[1], d[0]) }, 12, 7);
  }
  if (o.crest) {
    // spines down the back, tallest behind the head
    for (let i = 0; i < Math.floor(N * 0.75); i++) {
      for (const half of [0, 1]) {
        const p = half ? P[i].map((x, c) => (x + P[i + 1][c]) / 2) : P[i];
        const t = (i + half * 0.5) / (N - 0.5);
        const h = o.crest * r * (1.5 - t * 1.3) * (half ? 0.7 : 1);
        b.at(p);
        b.limb(i + 1, [0, thick(t) * 0.6, 0], [0, thick(t) * 0.75 + h, -h * 0.75], r * 0.2, 0.004, half ? light : pale, 4);
      }
    }
  }
  if (o.wings) {
    const w = o.wings;
    for (const s of [-1, 1]) {
      const name = s < 0 ? 'wingL' : 'wingR';
      const at = [s * r * 0.7, r * 0.5, 0];
      joints.push([name, 's1', at]);
      const j = joints.length - 1;
      b.at(P[1].map((x, c) => x + at[c]));
      // an arm out to a wrist, three fingers from it, and the skin stretched between
      const wrist = [s * w * 0.42, w * 0.2, w * 0.1];
      b.limb(j, [0, 0, 0], wrist, r * 0.3, r * 0.2, main);
      const tips = [[s * w, w * 0.12, -w * 0.02], [s * w * 0.86, 0, -w * 0.42], [s * w * 0.52, -w * 0.06, -w * 0.62]];
      for (const tip of tips) b.limb(j, wrist, tip, r * 0.17, 0.006, mixed(main, dark, 0.5), 4);
      const webs = [[wrist, tips[0], tips[1]], [wrist, tips[1], tips[2]], [[0, 0, 0], wrist, tips[2]], [[0, 0, 0], tips[2], [s * w * 0.12, -w * 0.04, -w * 0.5]]];
      for (const [p0, p1, p2] of webs) b.sheet(j, p0, p1, p2, mixed(dark, main, 0.35), mixed(dark, black, 0.2));
    }
  }
  const tau = Math.PI * 2;
  const wave = (n, u, amp) => {
    if (n === 'wingL') return { rz: Math.sin(u * tau) * 0.5 };
    if (n === 'wingR') return { rz: -Math.sin(u * tau) * 0.5 };
    if (!n.startsWith('s')) return null;
    const i = Number(n.slice(1));
    // (the neck holds steadier than the body behind it)
    return { ry: Math.sin(u * tau - i * 0.95) * amp * (i === 0 ? 0.35 : i <= neck ? 0.55 : 1) };
  };
  /** The head put somewhere else, the neck taking it up so that the body stays where it lies. */
  const reach = (n, u, amp, dy, dz, rx = 0) => {
    const base = wave(n, u, amp) ?? {};
    if (!n.startsWith('s')) return base;
    const i = Number(n.slice(1));
    if (i === 0) return { ...base, dy, dz, rx };
    if (i <= neck) return { ...base, dy: -dy / neck, dz: -dz / neck };
    return base;
  };
  builtRig(pack, id, joints, {
    idle: { dur: 2, pose: (n, j, t, u) => reach(n, u, 0.2, Math.sin(u * tau) * r * 0.12, 0) },
    walk: { dur: 0.9, pose: (n, j, t, u) => wave(n, u, 0.34) },
    run: { dur: 0.5, pose: (n, j, t, u) => wave(n, u, 0.4) },
    chop: {
      dur: 0.6,
      pose: (n, j, t, u) => {
        const k = Math.sin(Math.min(1, u * 1.5) * Math.PI);
        return reach(n, u, 0.12, -k * (up - r) * 0.45, k * o.len * 0.2, k * 0.35);
      },
    },
    hit: { dur: 0.3, pose: (n, j, t, u) => reach(n, u, 0.1, 0, -Math.sin(u * Math.PI) * r * 0.8, -Math.sin(u * Math.PI) * 0.3) },
    die: {
      dur: 0.8,
      pose: (n, j, t, u) => {
        const k = Math.min(1, u * 1.5);
        return reach(n, u, 0.3 * (1 - u), -k * (up - r * 0.8), k * r * 0.5, k * 0.2);
      },
    },
  });
  pack.addMesh('body', b.done());
  pack.meshes.body.rig = id;
  return pack;
}

/**
 * A naga's coil: the tail a naga's body rises from (kits.ts sets the body on it). It lies wound on itself, the tip
 * out to one side, each turn inside and on top of the last, and its end stands up in the middle as the waist.
 */
function coilKit(id, o) {
  const pack = new Pack();
  const main = rgb(o.main);
  const dark = rgb(o.dark);
  const light = rgb(o.light);
  const pale = mixed(light, [1, 0.97, 0.88], 0.5);
  const r = o.r;
  const joints = [['root', null, [0, 0, 0]], ['body', 'root', [0, 0, 0]], ['tip', 'body', [r * 3.1, 0, -r * 0.6]]];
  const b = new Builder();
  const rings = [];
  const M = 46;
  for (let i = 0; i <= M; i++) {
    const t = i / M;
    // wound inward and upward; the last of it turns up to stand
    const wind = Math.min(1, t / 0.86);
    const a = wind * Math.PI * 2 * 1.85 - 0.2;
    const out = r * (3.3 - wind * 2.75) * (t > 0.86 ? 1 - (t - 0.86) / 0.14 : 1) * (t > 0.86 ? 0.55 / 0.55 : 1);
    const k = r * (t < 0.3 ? 0.14 + (t / 0.3) * 0.86 : 1);
    const y = t > 0.86 ? k * 0.9 + r * 0.95 + ((t - 0.86) / 0.14) * r * 1.5 : k * 0.9 + (wind > 0.52 ? ((wind - 0.52) / 0.48) * r * 0.95 : 0);
    const band = Math.floor(i / 2) % 2 === 0;
    rings.push({
      p: [Math.cos(a) * out, y, Math.sin(a) * out],
      rx: k,
      ry: k * 0.92,
      skin: t < 0.12 ? [2, 2, 255] : t < 0.2 ? [2, 1, 128] : [1, 1, 255],
      color: (nx, ny) => (ny < -0.4 ? pale : ny > 0.45 ? (band ? dark : mixed(main, light, 0.4)) : main),
    });
  }
  b.tube(rings, 9);
  const tau = Math.PI * 2;
  const sway = (n, u, amp) => (n === 'tip' ? { ry: Math.sin(u * tau) * amp * 3 } : n === 'body' ? { ry: Math.sin(u * tau) * amp * 0.4, dy: Math.sin(u * tau * 2) * 0.01 } : null);
  builtRig(pack, id, joints, {
    idle: { dur: 1.8, pose: (n, j, t, u) => sway(n, u, 0.08) },
    walk: { dur: 0.9, pose: (n, j, t, u) => sway(n, u, 0.2) },
    run: { dur: 0.5, pose: (n, j, t, u) => sway(n, u, 0.26) },
    chop: { dur: 0.6, pose: (n, j, t, u) => (n === 'body' ? { dz: Math.sin(Math.min(1, u * 1.5) * Math.PI) * 0.25 } : sway(n, u, 0.1)) },
    hit: { dur: 0.3, pose: (n, j, t, u) => (n === 'body' ? { dz: -Math.sin(u * Math.PI) * 0.1 } : null) },
    die: { dur: 0.8, pose: (n, j, t, u) => (n === 'body' ? { dy: -Math.min(1, u * 1.5) * r * 0.5 } : sway(n, u, 0.2 * (1 - u))) },
  });
  pack.addMesh('body', b.done());
  pack.meshes.body.rig = id;
  return pack;
}

/* ------------------------------------------------------------------ FBX animals */

async function fbxKit(id, path, picks) {
  const buf = readFileSync(path);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const object = new FBXLoader().parse(ab, '');
  object.updateMatrixWorld(true);
  const meshes = [];
  object.traverse((o) => {
    if (o.isSkinnedMesh) meshes.push(o);
  });
  if (!meshes.length) throw new Error(`${id}: no skinned mesh`);
  const skeleton = meshes[0].skeleton;
  const bones = skeleton.bones;
  const parents = bones.map((b) => bones.indexOf(b.parent));
  // parents before children
  const order = [];
  const seen = new Set();
  const visit = (i) => {
    if (seen.has(i)) return;
    seen.add(i);
    if (parents[i] >= 0) visit(parents[i]);
    order.push(i);
  };
  bones.forEach((_, i) => visit(i));
  const newIndex = new Map(order.map((o, n) => [o, n]));
  const pack = new Pack();
  const parts = [];
  for (const mesh of meshes) {
    const g = mesh.geometry;
    const pos = g.getAttribute('position');
    const nor = g.getAttribute('normal');
    const si = g.getAttribute('skinIndex');
    const sw = g.getAttribute('skinWeight');
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const colorOf = new Array(pos.count).fill(0);
    for (const gr of g.groups.length ? g.groups : [{ start: 0, count: pos.count, materialIndex: 0 }]) {
      for (let k = gr.start; k < gr.start + gr.count; k++) colorOf[g.index ? g.index.getX(k) : k] = gr.materialIndex ?? 0;
    }
    const bind = mesh.bindMatrix.toArray();
    const n = pos.count;
    const part = { n, pos: new Float32Array(n * 3), nor: new Float32Array(n * 3), col: new Uint8Array(n * 3), skin: new Uint8Array(n * 3), idx: g.index ? Array.from(g.index.array) : Array.from({ length: n }, (_, i) => i) };
    for (let v = 0; v < n; v++) {
      part.pos.set(point(bind, pos.getX(v), pos.getY(v), pos.getZ(v)), v * 3);
      part.nor.set(dirOf(bind, nor.getX(v), nor.getY(v), nor.getZ(v)), v * 3);
      const c = mats[colorOf[v]]?.color ?? new THREE.Color(1, 1, 1);
      part.col[v * 3] = toSrgb(c.r) * 255;
      part.col[v * 3 + 1] = toSrgb(c.g) * 255;
      part.col[v * 3 + 2] = toSrgb(c.b) * 255;
      const inf = [0, 1, 2, 3].map((k) => ({ j: si.getComponent(v, k), w: sw.getComponent(v, k) })).sort((a, b) => b.w - a.w);
      const sum = inf[0].w + inf[1].w || 1;
      part.skin[v * 3] = newIndex.get(inf[0].j);
      part.skin[v * 3 + 1] = newIndex.get(inf[1].j);
      part.skin[v * 3 + 2] = (inf[0].w / sum) * 255;
    }
    parts.push(part);
  }
  const joined = joinParts(parts);
  pack.addMesh('body', id === 'fbx_raptor' ? joined : grayed(joined, 120));
  pack.meshes.body.rig = id;
  const J = bones.length;
  const rest = [];
  const ibm = [];
  const names = [];
  const orderedParents = [];
  for (const o of order) {
    const b = bones[o];
    names.push(b.name);
    orderedParents.push(parents[o] >= 0 ? newIndex.get(parents[o]) : -1);
    rest.push(b.position.x, b.position.y, b.position.z, b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w, b.scale.x, b.scale.y, b.scale.z);
    ibm.push(...skeleton.boneInverses[o].toArray());
  }
  const root = bones[order[0]];
  const rig = { joints: names, parents: orderedParents, rest, ibm, base: root.parent ? root.parent.matrixWorld.toArray() : IDENT, clips: {} };
  const mixer = new THREE.AnimationMixer(object);
  const all = object.animations;
  for (const [want, re] of picks) {
    const clean = (a) => a.name.split('|').pop().replace(/^[A-Z][A-Za-z]+_(?=[A-Z])/, '');
    const clip = all.find((a) => re.test(clean(a)));
    if (!clip) {
      console.log(`  ${id}: no ${want} in ${all.map((a) => a.name.split('|').pop()).join(',')}`);
      continue;
    }
    const fps = 15;
    const n = Math.max(1, Math.round(clip.duration * fps));
    mixer.stopAllAction();
    const action = mixer.clipAction(clip);
    action.reset().play();
    const quats = new Int16Array(n * J * 4);
    const moves = new Float32Array(n * J * 3);
    for (let f = 0; f < n; f++) {
      mixer.setTime((f / n) * clip.duration);
      order.forEach((o, j) => {
        const b = bones[o];
        quats[(f * J + j) * 4] = b.quaternion.x * 32767;
        quats[(f * J + j) * 4 + 1] = b.quaternion.y * 32767;
        quats[(f * J + j) * 4 + 2] = b.quaternion.z * 32767;
        quats[(f * J + j) * 4 + 3] = b.quaternion.w * 32767;
        moves[(f * J + j) * 3] = b.position.x;
        moves[(f * J + j) * 3 + 1] = b.position.y;
        moves[(f * J + j) * 3 + 2] = b.position.z;
      });
    }
    action.stop();
    rig.clips[want] = { n, fps: n / clip.duration, q: pack.put(quats), tj: Array.from({ length: J }, (_, i) => i), t: pack.put(moves), sj: [], s: 0 };
  }
  pack.rigs[id] = rig;
  return pack;
}

/**
 * A blob of slime: it hops and quivers. Gray, for the game to color. A dome with a darker foot and a pale crown, a
 * shine on its shoulder, a clot at its heart, a wide-eyed face with a mouth, and drips round it on the ground (it was
 * one plain ball with two dots, the plainest thing in a land).
 */
function slimeKit(id) {
  const pack = new Pack();
  const c = [0.9, 0.9, 0.9];
  const deep = [0.56, 0.56, 0.6];
  const pale = [1, 1, 1];
  const b = new Builder();
  const joints = [['root', null, [0, 0, 0]], ['body', 'root', [0, 0.42, 0]]];
  // (shaped round the ground, as it always was: half of the ball is under it, and what shows is the dome)
  b.blob(1, [0, 0, 0], [0.62, 0.46, 0.62], (n) => (n[1] < 0.2 ? deep : n[1] > 0.8 ? pale : n[1] > 0.55 ? mixed(c, pale, 0.5) : c), 12, 9);
  // a skirt where it spreads on the ground, and drips beyond it
  b.blob(1, [0, 0.02, 0], [0.72, 0.1, 0.72], deep, 12, 4);
  for (const [x, z, r] of [[0.7, 0.3, 0.12], [-0.62, 0.42, 0.1], [0.2, -0.72, 0.11], [-0.5, -0.5, 0.08]]) b.blob(1, [x, 0.03, z], [r, r * 0.6, r], c, 6, 3);
  // the shine, and the clot it carries inside
  b.oval(1, [-0.24, 0.3, 0.26], [0.16, 0.07, 0.1], pale, { z: 0.5, x: -0.4 }, 6, 3);
  b.blob(1, [0.1, 0.38, -0.12], [0.2, 0.1, 0.2], mixed(c, pale, 0.7), 7, 3);
  for (const side of [-1, 1]) {
    b.blob(1, [side * 0.21, 0.2, 0.5], [0.13, 0.15, 0.1], [1, 1, 1], 7, 5);
    b.blob(1, [side * 0.2, 0.2, 0.58], [0.065, 0.085, 0.05], [0.04, 0.03, 0.06], 6, 4);
    b.blob(1, [side * 0.2 + 0.03, 0.25, 0.62], [0.025, 0.025, 0.02], [1, 1, 1], 4, 2);
  }
  b.oval(1, [0, 0.07, 0.6], [0.1, 0.035, 0.04], [0.1, 0.05, 0.08], null, 6, 3);
  builtRig(pack, id, joints, {
    idle: { dur: 1.2, pose: (n, j, t, u) => (n === 'body' ? { dy: Math.sin(u * 6.283) * 0.03 } : null) },
    walk: { dur: 0.7, pose: (n, j, t, u) => (n === 'root' ? { dy: Math.abs(Math.sin(u * 3.14)) * 0.34 } : null) },
    run: { dur: 0.45, pose: (n, j, t, u) => (n === 'root' ? { dy: Math.abs(Math.sin(u * 3.14)) * 0.38 } : null) },
    chop: { dur: 0.6, pose: (n, j, t, u) => (n === 'root' ? { dz: Math.sin(u * 3.14) * 0.5, dy: Math.sin(u * 3.14) * 0.3 } : null) },
    hit: { dur: 0.3, pose: (n, j, t, u) => (n === 'body' ? { dz: -Math.sin(u * 3.14) * 0.1 } : null) },
    die: { dur: 0.6, pose: (n, j, t, u) => (n === 'body' ? { dy: -Math.min(1, u * 1.4) * 0.38 } : null) },
  });
  pack.addMesh('body', b.done());
  pack.meshes.body.rig = id;
  return pack;
}

/**
 * A bear: a heavy body with a hump over the shoulders, a broad head with round ears and a pale muzzle, four thick
 * legs on their own joints and a stub of a tail. It walks on diagonal pairs, and rears to strike. (The game's bear
 * was a werewolf in brown: an upright wolf-man is not a bear.)
 */
function bearKit(id, o) {
  const pack = new Pack();
  const main = rgb(o.main);
  const dark = rgb(o.dark);
  const light = rgb(o.light);
  const black = [0.07, 0.05, 0.06];
  const joints = [['root', null, [0, 0, 0]], ['body', 'root', [0, 0.8, 0]]];
  const W = { root: [0, 0, 0], body: [0, 0.8, 0] };
  const b = new Builder();
  const joint = (name, parent, at) => {
    joints.push([name, parent, at]);
    W[name] = W[parent].map((x, i) => x + at[i]);
    b.at(W[name]);
    return joints.length - 1;
  };
  const coat = (n) => (n[1] < -0.45 ? mixed(main, light, 0.55) : n[1] > 0.6 ? mixed(main, dark, 0.45) : main);
  b.at(W.body);
  b.oval(1, [0, 0, 0], [0.5, 0.46, 0.82], coat, null, 11, 7);
  b.oval(1, [0, 0.2, 0.36], [0.44, 0.38, 0.42], coat, null, 10, 6);
  b.oval(1, [0, 0.0, -0.5], [0.48, 0.45, 0.44], coat, null, 10, 6);
  b.blob(1, [0, 0.12, -0.92], [0.1, 0.1, 0.1], dark, 6, 4);
  const hj = joint('head', 'body', [0, 0.14, 0.78]);
  b.oval(hj, [0, 0, 0.08], [0.31, 0.28, 0.31], (n) => (n[1] > 0.55 ? mixed(main, dark, 0.4) : main), null, 10, 7);
  b.oval(hj, [0, -0.09, 0.36], [0.17, 0.14, 0.2], (n) => (n[1] < -0.3 ? mixed(light, [1, 1, 1], 0.2) : light), null, 8, 5);
  b.blob(hj, [0, -0.04, 0.55], [0.07, 0.055, 0.05], black, 6, 4);
  for (const s of [-1, 1]) {
    b.blob(hj, [s * 0.21, 0.25, 0.0], [0.1, 0.1, 0.06], main, 7, 5);
    b.blob(hj, [s * 0.21, 0.25, 0.04], [0.055, 0.055, 0.035], mixed(dark, black, 0.3), 6, 4);
    b.blob(hj, [s * 0.14, 0.07, 0.34], [0.038, 0.042, 0.03], black, 6, 4);
    b.blob(hj, [s * 0.14 + 0.012, 0.085, 0.365], [0.012, 0.012, 0.01], [1, 1, 1], 4, 2);
  }
  for (const [name, x, z] of [['legFL', -0.3, 0.44], ['legFR', 0.3, 0.44], ['legBL', -0.32, -0.5], ['legBR', 0.32, -0.5]]) {
    const j = joint(name, 'body', [x, -0.18, z]);
    b.limb(j, [0, 0.06, 0], [0, -0.5, 0.02], 0.19, 0.16, mixed(main, dark, 0.25), 7);
    b.oval(j, [0, -0.55, 0.07], [0.17, 0.08, 0.22], dark, null, 8, 4);
    for (const k of [-1, 0, 1]) b.limb(j, [k * 0.08, -0.57, 0.24], [k * 0.09, -0.61, 0.33], 0.022, 0.004, [0.92, 0.9, 0.82], 3);
  }
  const tau = Math.PI * 2;
  const step = (n, u, amp) => {
    // diagonal pairs: the fore left with the hind right
    const lead = n === 'legFL' || n === 'legBR';
    const ph = u * tau + (lead ? 0 : Math.PI);
    return { rx: Math.sin(ph) * amp, dy: Math.max(0, Math.cos(ph)) * 0.05 };
  };
  builtRig(pack, id, joints, {
    idle: { dur: 2.2, pose: (n, j, t, u) => (n === 'body' ? { dy: Math.sin(u * tau) * 0.012 } : n === 'head' ? { rx: Math.sin(u * tau) * 0.06, ry: Math.sin(u * tau * 0.5) * 0.12 } : null) },
    walk: { dur: 0.9, pose: (n, j, t, u) => (n.startsWith('leg') ? step(n, u, 0.42) : n === 'body' ? { dy: Math.abs(Math.sin(u * tau)) * 0.03, rz: Math.sin(u * tau) * 0.04 } : n === 'head' ? { rx: Math.sin(u * tau * 2) * 0.05 } : null) },
    run: { dur: 0.5, pose: (n, j, t, u) => (n.startsWith('leg') ? step(n, u, 0.7) : n === 'body' ? { dy: Math.abs(Math.sin(u * tau)) * 0.07, rx: Math.sin(u * tau) * 0.08 } : null) },
    chop: {
      dur: 0.8,
      pose: (n, j, t, u) => {
        // up on its hind legs, then down with both paws
        const up = Math.sin(Math.min(1, u / 0.55) * Math.PI * 0.5) * (u < 0.55 ? 1 : Math.max(0, 1 - (u - 0.55) / 0.2));
        if (n === 'body') return { rx: -up * 0.75, dy: up * 0.28 };
        if (n === 'legFL' || n === 'legFR') return { rx: -up * 1.1 + (u > 0.55 ? Math.min(1, (u - 0.55) / 0.15) * 0.5 * up : 0) };
        if (n === 'legBL' || n === 'legBR') return { rx: up * 0.7 };
        if (n === 'head') return { rx: up * 0.4 };
        return null;
      },
    },
    hit: { dur: 0.3, pose: (n, j, t, u) => (n === 'body' ? { rx: Math.sin(u * Math.PI) * 0.12, dz: -Math.sin(u * Math.PI) * 0.08 } : n === 'head' ? { rx: -Math.sin(u * Math.PI) * 0.3 } : null) },
    die: {
      dur: 0.9,
      pose: (n, j, t, u) => {
        const k = Math.min(1, u * 1.5);
        if (n === 'root') return { rz: k * 1.5, dy: k * 0.42 - Math.sin(k * Math.PI) * -0.1 };
        if (n.startsWith('leg')) return { rx: k * 0.5 };
        if (n === 'head') return { rx: k * 0.4 };
        return null;
      },
    },
  });
  pack.addMesh('body', b.done());
  pack.meshes.body.rig = id;
  return pack;
}

/** A floating light with a pale heart and a flicker over it. */
function wispKit(id) {
  const pack = new Pack();
  const b = new Builder();
  const joints = [['root', null, [0, 0, 0]], ['body', 'root', [0, 0.55, 0]]];
  b.blob(1, [0, 0, 0], [0.34, 0.36, 0.34], [0.95, 0.95, 0.95], 8, 6);
  b.limb(1, [0, 0.26, 0], [0, 0.72, 0], 0.2, 0.02, [0.9, 0.9, 0.9], 6);
  for (const side of [-1, 1]) b.blob(1, [side * 0.12, 0.05, 0.29], [0.06, 0.08, 0.05], [0.05, 0.04, 0.08], 5, 3);
  const bob = (n, u) => (n === 'body' ? { dy: Math.sin(u * 6.283) * 0.08, ry: u * 6.283 * 0.15 } : null);
  builtRig(pack, id, joints, {
    idle: { dur: 1.2, pose: (n, j, t, u) => bob(n, u) },
    walk: { dur: 0.9, pose: (n, j, t, u) => bob(n, u) },
    chop: { dur: 0.5, pose: (n, j, t, u) => (n === 'body' ? { dz: Math.sin(u * 3.14) * 0.4 } : null) },
    die: { dur: 0.6, pose: (n, j, t, u) => (n === 'body' ? { dy: u * 0.7 } : null) },
  });
  pack.addMesh('body', b.done());
  pack.meshes.body.rig = id;
  return pack;
}

/** Anything that flaps: a body, a head and two wings. A bird has a beak, a fan of a tail and feathered wings; a moth
 * has feelers, a furred body and four wings with an eye painted on each. */
function flyerKit(id, o) {
  const pack = new Pack();
  const main = rgb(o.main);
  const dark = rgb(o.dark);
  const black = [0.07, 0.05, 0.08];
  const [bx, by, bz] = o.body;
  const [w, , wz] = o.wing;
  const b = new Builder();
  const up = 0.5;
  const joints = [['root', null, [0, 0, 0]], ['body', 'root', [0, up, 0]], ['wingL', 'body', [-bx * 0.8, 0.06, 0]], ['wingR', 'body', [bx * 0.8, 0.06, 0]]];
  b.at([0, up, 0]);
  const eye = (p, r) => {
    b.blob(1, p, [r, r, r], black, 6, 4);
    b.blob(1, [p[0] + r * 0.25, p[1] + r * 0.45, p[2] + r * 0.7], [r * 0.32, r * 0.32, r * 0.32], [1, 1, 1], 4, 2);
  };
  if (o.beak) {
    const beak = rgb(o.beak);
    const back = mixed(main, [0, 0, 0], 0.3);
    // a breast paler than the back, a round head, a beak in two halves
    b.oval(1, [0, 0, 0], o.body, (n) => (n[1] > 0.25 ? back : n[1] > -0.1 ? mixed(main, back, 0.5) : main), { x: -0.18 }, 10, 7);
    const hr = bx * 0.74;
    const h = [0, by * 0.72, bz * 0.82];
    b.blob(1, h, [hr, hr, hr], (n) => (n[1] > 0.35 && n[2] < 0.5 ? back : main), 9, 6);
    b.limb(1, [h[0], h[1] - hr * 0.05, h[2] + hr * 0.7], [0, h[1] - hr * 0.42, h[2] + hr * 2.05], hr * 0.4, 0.006, beak, 5);
    b.limb(1, [h[0], h[1] - hr * 0.3, h[2] + hr * 0.6], [0, h[1] - hr * 0.5, h[2] + hr * 1.55], hr * 0.26, 0.006, mixed(beak, [0, 0, 0], 0.25), 5);
    for (const s of [-1, 1]) {
      eye([s * hr * 0.72, h[1] + hr * 0.18, h[2] + hr * 0.52], hr * 0.2);
      // legs tucked under, toes forward
      b.limb(1, [s * bx * 0.4, -by * 0.7, -bz * 0.1], [s * bx * 0.42, -by * 1.35, bz * 0.05], 0.03, 0.022, beak, 4);
      b.limb(1, [s * bx * 0.42, -by * 1.35, bz * 0.05], [s * bx * 0.42, -by * 1.4, bz * 0.42], 0.024, 0.004, beak, 4);
    }
    if (o.comb) for (let k = 0; k < 3; k++) b.blob(1, [0, h[1] + hr * (0.95 - k * 0.12), h[2] + hr * (0.35 - k * 0.38)], [hr * 0.14, hr * 0.3, hr * 0.26], rgb(o.comb), 5, 3);
    // the tail: three long feathers, fanned
    for (let k = -1; k <= 1; k++) b.oval(1, [k * bx * 0.3, by * 0.05, -bz * 1.25], [bx * 0.3, 0.03, bz * 0.62], (n) => (n[2] < -0.3 ? mixed(dark, [0, 0, 0], 0.45) : dark), { y: -k * 0.32, x: 0.2 }, 6, 3);
    for (const s of [-1, 1]) {
      b.at([s * bx * 0.8, up + 0.06, 0]);
      const j = s < 0 ? 2 : 3;
      // the wing: its shoulder, then the long feathers one behind another, each swept further back, dark at the tip
      b.oval(j, [s * w * 0.26, 0.012, wz * 0.12], [w * 0.3, 0.05, wz * 0.8], main, {}, 7, 4);
      for (let k = 0; k < 5; k++) {
        const len = w * (0.4 - k * 0.035);
        const yaw = 0.1 + k * 0.2;
        const root = [s * w * (0.34 + k * 0.1), -0.004 * k, wz * (0.25 - k * 0.24)];
        b.oval(j, [root[0] + s * Math.cos(yaw) * len * 0.8, root[1], root[2] - Math.sin(yaw) * len * 0.8], [len, 0.022, wz * 0.34], (n) => (s * n[0] > 0.35 ? mixed(dark, [0, 0, 0], 0.5) : k % 2 ? dark : mixed(dark, main, 0.4)), { y: s * yaw }, 7, 3);
      }
    }
  } else {
    const fur = mixed(main, [0.35, 0.25, 0.18], 0.45);
    const spot = rgb(o.spot ?? '#d0703a');
    // a furred body in three parts, banded behind
    b.blob(1, [0, 0, bz * 0.3], [bx, by, bz * 0.5], fur, 8, 5);
    b.blob(1, [0, -by * 0.1, -bz * 0.55], [bx * 0.82, by * 0.82, bz * 0.75], (n) => (Math.sin(n[2] * 9) > 0.1 ? fur : mixed(fur, [0, 0, 0], 0.4)), 8, 6);
    const h = [0, by * 0.15, bz * 0.95];
    b.blob(1, h, [bx * 0.72, bx * 0.66, bx * 0.66], mixed(fur, [0, 0, 0], 0.25), 7, 5);
    for (const s of [-1, 1]) {
      eye([s * bx * 0.5, h[1] + bx * 0.18, h[2] + bx * 0.36], bx * 0.3);
      // feathered feelers
      const q = [s * bx * 1.3, h[1] + bx * 2.1, h[2] + bx * 1.3];
      b.limb(1, [s * bx * 0.25, h[1] + bx * 0.5, h[2] + bx * 0.2], q, 0.02, 0.014, black, 4);
      for (let k = 1; k <= 3; k++) {
        const p = [s * bx * (0.25 + 1.05 * k / 3), h[1] + bx * (0.5 + 1.6 * k / 3), h[2] + bx * (0.2 + 1.1 * k / 3)];
        b.limb(1, p, [p[0] + s * 0.08, p[1] + 0.02, p[2] + 0.07], 0.012, 0.003, black, 3);
      }
      b.at([s * bx * 0.8, up + 0.06, 0]);
      const j = s < 0 ? 2 : 3;
      // each wing: a dark edge, a paler field, and an eye on it to stare a bird down
      const wing = (cx, cz, r, yaw, big) =>
        b.oval(j, [cx, 0, cz], r, (n) => {
          const d = Math.hypot(n[0] - s * 0.3, n[2] + 0.05);
          if (Math.abs(n[1]) < 0.3) return mixed(dark, [0.2, 0.12, 0.08], 0.75);
          if (d < 0.17 * big) return black;
          if (d < 0.3 * big) return spot;
          if (d < 0.38 * big) return mixed(dark, [1, 1, 1], 0.5);
          return Math.sin(Math.hypot(n[0], n[2]) * 16) > 0.75 ? mixed(dark, main, 0.6) : dark;
        }, { y: yaw }, 14, 10);
      wing(s * w * 0.52, wz * 0.38, [w * 0.56, 0.028, wz * 0.9], s * -0.38, 1);
      wing(s * w * 0.36, -wz * 0.72, [w * 0.4, 0.024, wz * 0.72], s * 0.42, 0.8);
      b.at([0, up, 0]);
    }
  }
  const tau = Math.PI * 2;
  const flap = (n, u, amp) => (n === 'wingL' ? { rz: Math.sin(u * tau) * amp } : n === 'wingR' ? { rz: -Math.sin(u * tau) * amp } : n === 'body' ? { dy: Math.sin(u * tau + 1.4) * 0.03 } : null);
  builtRig(pack, id, joints, {
    idle: { dur: 0.5, pose: (n, j, t, u) => flap(n, u, 0.55) },
    walk: { dur: 0.32, pose: (n, j, t, u) => flap(n, u, 0.75) },
    run: { dur: 0.24, pose: (n, j, t, u) => flap(n, u, 0.85) },
    chop: { dur: 0.5, pose: (n, j, t, u) => (n === 'body' ? { rx: Math.sin(u * Math.PI) * 0.5, dz: Math.sin(u * Math.PI) * 0.3 } : flap(n, u, 0.5)) },
    hit: { dur: 0.3, pose: (n, j, t, u) => (n === 'body' ? { dz: -Math.sin(u * Math.PI) * 0.12 } : null) },
    die: { dur: 0.7, pose: (n, j, t, u) => (n === 'root' ? { dy: -u * 0.4, rz: u * 1.5 } : null) },
  });
  pack.addMesh('body', b.done());
  pack.meshes.body.rig = id;
  return pack;
}

const BUGS = {
  spider: { kind: 'spider', body: [0.27, 0.19, 0.27], head: [0.2, 0.15, 0.17], abdomen: [0.4, 0.33, 0.46], h: 0.36, legs: 8, reach: 0.82, knee: 0.4, leg: 0.045, fan: 1.3, spread: 1.5, jaws: 0.16, eye: '#e0483a', main: '#5b4a68', dark: '#34283f', light: '#c9b6e6' },
  crab: { kind: 'crab', body: [0.56, 0.24, 0.4], h: 0.3, legs: 6, reach: 0.74, knee: 0.26, leg: 0.055, fan: 0.7, legsAt: -0.1, claws: 0.2, arm: 0.3, main: '#e0633f', dark: '#a53c22', light: '#f48d63' },
  scorpion: { kind: 'scorpion', body: [0.3, 0.15, 0.44], head: [0.24, 0.12, 0.16], h: 0.22, legs: 8, reach: 0.56, knee: 0.2, leg: 0.04, fan: 0.9, legsAt: -0.12, claws: 0.15, arm: 0.3, tail: 1, jaws: 0.08, main: '#c79a58', dark: '#8a6431', light: '#e4c27f' },
  beetle: { body: [0.4, 0.25, 0.5], head: [0.24, 0.17, 0.2], h: 0.27, legs: 6, reach: 0.66, knee: 0.2, leg: 0.048, shell: true, horn: 0.5, feelers: 0.7, main: '#3f6b49', dark: '#22402b', light: '#6ea86f' },
  scarab: { body: [0.4, 0.23, 0.48], head: [0.26, 0.15, 0.18], h: 0.25, legs: 6, reach: 0.6, knee: 0.18, leg: 0.048, shell: true, feelers: 0.6, jaws: 0.1, main: '#a8862f', dark: '#5f4a17', light: '#e6c14f' },
  strider: { body: [0.18, 0.13, 0.36], head: [0.13, 0.1, 0.14], h: 0.8, legs: 6, reach: 1.1, knee: 0.28, leg: 0.028, fan: 1.2, pads: 0.09, feelers: 1, eyeSize: 0.05, main: '#5d7a54', dark: '#374c33', light: '#8aa77c' },
};
const SERPENTS = {
  viper: { n: 8, r: 0.2, len: 2.3, up: 0.95, hood: 1, main: '#4f8f4a', dark: '#2f5f33', light: '#79b862' },
  serpent: { n: 10, r: 0.3, len: 3.6, up: 1.35, crest: 1, main: '#3f8f94', dark: '#27616a', light: '#79c4bd' },
  wurm: { n: 9, r: 0.5, len: 3.6, up: 1.7, neck: 4, maw: true, main: '#c7a266', dark: '#8e6f3e', light: '#e6c98e' },
  wyrm: { n: 9, r: 0.36, len: 3.6, up: 0.8, neck: 2, wings: 1.7, horns: 1, crest: 0.8, tongue: false, main: '#d8d4cc', dark: '#a8a49c', light: '#f0ece4' },
};
const COILS = {
  naga_coil: { n: 9, r: 0.3, len: 2.6, rise: 0.5, main: '#3f8f6a', dark: '#27604a', light: '#6fbf94' },
};
const FARM = 'Farm Animals by @Quaternius/FBX/';
const DINO = 'Dinosaur Animated Pack - Dec 2018/FBX/';
const FBX_CLIPS = [
  ['idle', /^(Idle|Eating)$/i],
  ['walk', /^(Walk|Jump)/i],
  ['run', /^(Gallop|Run|Jump)/i],
  ['chop', /^(Attack|Bite|Headbutt|Jump)/i],
  ['hit', /^(HitReact|Hit)/i],
  ['die', /^Death/i],
];

/** Clip name in the packs, for each name the game uses. */
const MEDIUM_CLIPS = {
  idle: 'Idle_A', idle2: 'Idle_B', walk: 'Walking_A', run: 'Running_A', hit: 'Hit_A', die: 'Death_A', dead: 'Death_A_Pose',
  chop: 'Melee_1H_Attack_Chop', slice: 'Melee_1H_Attack_Slice_Horizontal', stab: 'Melee_1H_Attack_Stab', chop2: 'Melee_2H_Attack_Chop', spin: 'Melee_2H_Attack_Spin', block: 'Melee_Blocking', punch: 'Melee_Unarmed_Attack_Punch_A', bash: 'Melee_Block_Attack',
  bow: 'Ranged_Bow_Release', bowdraw: 'Ranged_Bow_Draw', cast: 'Ranged_Magic_Shoot', channel: 'Ranged_Magic_Spellcasting', summon: 'Ranged_Magic_Summon',
  sit: 'Sit_Chair_Idle', sitfloor: 'Sit_Floor_Idle', lie: 'Lie_Idle', cheer: 'Cheering', wave: 'Waving', interact: 'Interact', pickup: 'PickUp', use: 'Use_Item', throw: 'Throw',
  dodge: 'Dodge_Forward', spawn: 'Spawn_Ground', rise: 'Skeletons_Awaken_Floor', skelwalk: 'Skeletons_Walking', skelidle: 'Skeletons_Idle', taunt: 'Skeletons_Taunt', work: 'Working_A', hammer: 'Hammering', jump: 'Jump_Idle',
};
const LARGE_CLIPS = { idle: 'Idle_A', walk: 'Walking_A', run: 'Running_A', hit: 'Hit_A', die: 'Death_A', dead: 'Death_A_Pose', chop: 'Melee_1H_Slash', chop2: 'Melee_2H_Attack', spin: 'Melee_2H_Slam', punch: 'Melee_Unarmed_Punch', smash: 'Melee_Unarmed_Smash', cast: 'Melee_Unarmed_Smash', spawn: 'Spawn_Ground', cheer: 'Cheering' };

/** What the monsters' and animals' own clips are called, for each name the game uses. */
const OWN_CLIPS = [
  ['idle', /^(Idle|Flying_Idle|Idle_2)$/],
  ['walk', /^(Walk|Flying_Idle)$/],
  ['run', /^(Run|Gallop|Fast_Flying|Walk)$/],
  ['chop', /^(Attack|Punch|Bite_Front|Headbutt|Weapon|Bite|Attack_Headbutt|Headbutt)$/],
  ['hit', /^(HitReact|HitRecieve|HitReact_Front|Idle_HitReact1|Hit)$/],
  ['die', /^(Death|Dead)$/],
];

/**
 * The figures of the game: a character, what it leaves off, what it carries, and what else is tied to it. `gray` takes
 * its colors out, so the game can tint it anything (one golem makes fire, frost, coral and old wood).
 */
const SK = 'Skeleton_';
const KITS = {
  // the Ashen Host and the rest of the dead
  sk_warrior: { char: `${SK}Warrior`, right: `${SK}Blade`, left: `${SK}Shield_Small_A` },
  sk_guard: { char: `${SK}Warrior`, right: `${SK}Axe`, left: `${SK}Shield_Large_A` },
  sk_spear: { char: `${SK}Warrior`, right: `${SK}Scythe` },
  sk_banner: { char: `${SK}Warrior`, right: 'Orc_Banner' },
  sk_king: { char: `${SK}Warrior`, drop: /Helmet/, right: `${SK}Blade`, parts: [['Necromancer', 'Necromancer_Crown']] },
  sk_minion: { char: `${SK}Minion`, right: `${SK}Dagger` },
  sk_worker: { char: `${SK}Minion`, right: `${SK}Mace` },
  sk_archer: { char: `${SK}Rogue`, right: `${SK}Crossbow`, back: `${SK}Quiver` },
  sk_mage: { char: `${SK}Mage`, right: `${SK}Staff` },
  sk_necro: { char: 'Necromancer', right: `${SK}Staff` },
  sk_golem: { char: `${SK}Golem`, right: `${SK}Golem_Axe` },
  // people
  knight: { char: 'Knight', right: 'sword_1handed', left: 'shield_square' },
  barbarian: { char: 'Barbarian', right: 'axe_2handed' },
  mage: { char: 'Mage', right: 'staff' },
  rogue: { char: 'Rogue', right: 'dagger', left: 'dagger' },
  rogue_hooded: { char: 'Rogue_Hooded', right: 'dagger', left: 'dagger' },
  ranger: { char: 'Ranger', left: 'bow_withString', back: 'quiver' },
  druid: { char: 'Druid', right: 'druid_staff' },
  engineer: { char: 'Engineer', right: 'engineer_Wrench' },
  paladin: { char: 'Paladin', right: 'paladin_hammer', left: 'paladin_shield' },
  cleric: { char: 'Cleric', right: 'Cleric_Mace', left: 'Cleric_Shield' },
  witch: { char: 'Witch', right: 'Broom' },
  vampire: { char: 'Vampire', right: 'Vampire_Sword' },
  tiefling: { char: 'Tiefling', right: 'Tiefling_Sword' },
  caveman: { char: 'Caveman', right: 'Caveman_Club' },
  ninja: { char: 'Ninja', right: 'Ninja_Katana' },
  survivalist: { char: 'Survivalist', right: 'sword_1handed' },
  farmer_a: { char: 'Farmer_A', right: 'pitchfork' },
  farmer_b: { char: 'Farmer_B' },
  lorekeeper: { char: 'Lorekeeper', drop: /Backpack/, right: 'Lorekeeper_Staff' },
  // brutes
  orc_brute: { char: 'OrcBrute', right: 'Orc_Axe_Large' },
  black_knight: { char: 'BlackKnight', right: 'BlackKnight_Sword_Large', left: 'BlackKnight_Shield_Large' },
  vaelor: { char: 'BlackKnight', right: 'BlackKnight_Sword_Large', parts: [['Necromancer', 'Necromancer_Crown']] },
  golem: { char: 'FrostGolem', gray: true },
  treant: { char: 'FrostGolem', gray: true, ties: [['Tree_Bare_1_A', 'chest', [0, 0.1, -0.2], 1.15], ['Bush_2_C', 'upperarm.l', [0, 0.2, 0], 0.8], ['Bush_2_C', 'upperarm.r', [0, 0.2, 0], 0.8]] },
  monstrosity: { char: 'Monstrosity', right: 'Monstrosity_Pitchfork_Large' },
  barbarian_large: { char: 'Barbarian_Large', drop: /BearHat|BearPelt/, right: 'axe_2handed_Large' },
  werewolf: { char: 'Werewolf_Wolf' },
  monster: { char: 'Monster', right: `${SK}Dagger` },
  ghost: { char: `${SK}Minion`, gray: 150, right: null },
  sk_scythe: { char: `${SK}Mage`, right: `${SK}Scythe` },
  avian: { char: 'AvianSwordsman', right: 'AvianSwordsman_Sword' },
  plant_warrior: { char: 'PlantWarrior', right: 'PlantWarrior_Spear', left: 'PlantWarrior_Shield' },
  plant_archer: { char: 'PlantWarrior', left: 'PlantWarrior_Bow_withString' },
  // half a body, for what stands on a horse's back or a serpent's coils
  top_centaur: { char: 'Barbarian', drop: /Leg/, right: 'axe_2handed' },
  top_naga: { char: 'Tiefling', drop: /Leg|Tail/, right: 'Tiefling_Sword' },
};

/** Things that fight without a skeleton: bound to the root joint of the people's rig, they just stand. */
const STILL_KITS = {
  catapult: `${HEX}units/neutral/catapult.gltf`,
  siege_ram: 'kenney_castle-kit/Models/GLB format/siege-ram.glb',
  chain_post: `${GRAVE}border-pillar.glb`,
  mimic: `${DUN}chest_mimic.gltf`,
};

const ANIMALS = { a_horse: 'Horse', a_horse_white: 'Horse_White', a_stag: 'Stag', a_deer: 'Deer', a_cow: 'Cow', a_alpaca: 'Alpaca', a_shiba: 'ShibaInu', a_fox: 'Fox', a_bull: 'Bull', a_wolf: 'Wolf', a_donkey: 'Donkey', a_husky: 'Husky' };

const WEAPONS = ['sword_A', 'sword_B', 'sword_C', 'sword_D', 'sword_E', 'sword_F', 'sword_G', 'axe_A', 'axe_B', 'axe_C', 'axe_D', 'hammer_A', 'hammer_B', 'hammer_C', 'hammer_D', 'staff_A', 'staff_B', 'staff_C', 'staff_D', 'bow_A_withString', 'bow_B_withString', 'bow_C_withString', 'dagger_A', 'dagger_B', 'dagger_C', 'wand_A', 'wand_B', 'shield_A', 'shield_B', 'shield_C', 'shield_D', 'spear_A', 'halberd', 'scythe', 'arrow_A'];
const ADV_BITS = ['spellbook_open', 'spellbook_closed', 'quiver', 'shield_round', 'shield_square', 'shield_badge', 'shield_spikes', 'potion_small_red', 'potion_small_blue', 'potion_small_green', 'potion_medium_red', 'potion_medium_blue', 'potion_medium_green', 'potion_large_red', 'potion_large_blue'];

/** The hero's wardrobe: whole characters, cut into the parts a look wears. */
const WARDROBE = ['Knight', 'Barbarian', 'Mage', 'Rogue', 'Rogue_Hooded', 'Ranger', 'Druid', 'Engineer', 'Paladin', 'Paladin_with_Helmet', 'Cleric', 'Witch', 'Necromancer', 'BlackKnight', 'Skeleton_Warrior', 'Skeleton_Rogue', 'Skeleton_Mage', 'Survivalist', 'Farmer_A', 'Helper_A', 'Hiker', 'Tiefling', 'Vampire', 'Caveman', 'Ninja'];

const list = (dir, names, suffix = '.gltf') => Object.fromEntries(names.map((n) => [n, `${dir}${n}${suffix}`]));
const NATURE = {
  ...Object.fromEntries(['Tree_1_A', 'Tree_1_B', 'Tree_2_A', 'Tree_2_B', 'Tree_2_C', 'Tree_3_A', 'Tree_4_A', 'Tree_4_B', 'Tree_5_A', 'Tree_5_B', 'Tree_5_D', 'Tree_6_A', 'Tree_7_A', 'Tree_7_B', 'Tree_Bare_1_A', 'Tree_Bare_1_B', 'Tree_Bare_2_A', 'Tree_Bare_2_B', 'Bush_1_A', 'Bush_1_B', 'Bush_1_D', 'Bush_2_A', 'Bush_2_C', 'Bush_2_D', 'Bush_3_A', 'Bush_4_A', 'Bush_4_C', 'Bush_4_D', 'Rock_1_A', 'Rock_1_D', 'Rock_1_G', 'Rock_2_B', 'Rock_2_C', 'Rock_3_A', 'Rock_3_G', 'Rock_4_C', 'Rock_5_C', 'Rock_5_D', 'Rock_6_C', 'Rock_6_D', 'Grass_1_A', 'Grass_1_B', 'Grass_2_A', 'Grass_2_B'].map((n) => [n, `${FOREST}${n}_Color1.gltf`])),
  ...list(NAT, ['tree_palm', 'tree_palmBend', 'tree_palmTall', 'tree_palmDetailedShort', 'tree_pineDefaultA', 'tree_pineRoundA', 'tree_pineTallA', 'cactus_tall', 'cactus_short', 'mushroom_red', 'mushroom_redTall', 'mushroom_tanTall', 'mushroom_redGroup', 'flower_redA', 'flower_yellowA', 'flower_purpleA', 'lily_large', 'lily_small', 'log', 'log_stack', 'stump_round', 'fence_simple', 'fence_planks', 'fence_gate', 'campfire_stones', 'tent_detailedOpen', 'tent_smallOpen', 'bridge_wood', 'bridge_stone', 'sign', 'statue_column', 'statue_obelisk', 'statue_head', 'statue_block', 'rock_tallA', 'rock_tallE', 'stone_tallA', 'stone_tallE', 'crop_pumpkin', 'crops_wheatStageB', 'crops_cornStageD', 'hanging_moss'], '.glb'),
  ...list(HAL, ['tree_dead_large', 'tree_dead_medium', 'tree_pine_orange_large', 'tree_pine_yellow_large', 'gravestone', 'grave_A', 'gravemarker_A', 'coffin', 'skull', 'ribcage', 'bone_A', 'scarecrow', 'lantern_standing', 'post_lantern', 'post_skull', 'shrine', 'shrine_candles', 'crypt', 'arch', 'arch_gate', 'fence', 'fence_broken', 'fence_gate', 'wagon', 'wagon_hay', 'pumpkin_orange', 'sign_both', 'wooden_gate']),
};
const buildingFile = (n) => `${HEX}buildings/blue/building_${n}_blue.gltf`;
const KCASTLE = 'kenney_castle-kit/Models/GLB format/';
const TOWN = {
  ...list(KCASTLE, ['gate', 'door', 'metal-gate', 'tower-square-base'], '.glb'),
  ...list(GRAVE, ['crypt-door', 'crypt-large-door', 'crypt-small', 'crypt-a', 'grave', 'gravestone-round', 'gravestone-cross'], '.glb'),
  cave_rock: `${NAT}cliff_cave_rock.glb`,
  cave_stone: `${NAT}cliff_cave_stone.glb`,
  campfire_bricks: `${NAT}campfire_bricks.glb`,
  ...Object.fromEntries(['home_A', 'home_B', 'church', 'tavern', 'blacksmith', 'market', 'castle', 'tower_A', 'tower_B', 'tower_base', 'townhall', 'windmill', 'watermill', 'lumbermill', 'stables', 'barracks', 'watchtower', 'shrine', 'well', 'tent', 'mine', 'docks', 'workshop'].map((n) => [`b_${n}`, buildingFile(n)])),
  ...Object.fromEntries(['barrel', 'crate_A_big', 'crate_B_small', 'crate_long_A', 'crate_open', 'haybale', 'sack', 'tent', 'trough', 'weaponrack', 'wheelbarrow', 'target', 'flag_blue', 'flag_red', 'ladder', 'pallet', 'boat', 'anchor', 'bucket_water'].map((n) => [`p_${n}`, `${HEX}decoration/props/${n}.gltf`])),
  ...list(GRAVE, ['altar-stone', 'border-pillar', 'cross', 'debris', 'debris-wood', 'fire-basket', 'hay-bale', 'iron-fence', 'lantern-candle'], '.glb'),
  anvil: `${TOOL}anvil.gltf`, grindstone: `${TOOL}grindstone.gltf`,
  ...Object.fromEntries(['resource_lumber', 'resource_stone'].map((n) => [`p_${n}`, `${HEX}decoration/props/${n}.gltf`])),
  p_cart_merchant: `${HEX}units/neutral/cart_merchant.gltf`,
};
const INDOOR = {
  ...list(DUN, ['column', 'pillar', 'pillar_decorated', 'barrel_large', 'barrel_small', 'box_large', 'crate_large', 'crates_stacked', 'banner_blue', 'banner_red', 'banner_shield_red', 'banner_patternA_blue', 'banner_triple_red', 'banner_thin_yellow', 'bed_A_single', 'bed_decorated', 'bed_floor', 'bench', 'bookcase_double_decoratedA', 'bookcase_single_decoratedA', 'candle_lit', 'candle_triple', 'chair', 'chest', 'chest_gold', 'chest_large', 'chest_large_gold', 'chest_mimic', 'coin', 'coin_stack_medium', 'keg', 'rocks', 'rubble_half', 'rubble_large', 'shelf_small_books', 'shelves_decorated', 'stairs', 'stool', 'sword_shield', 'table_long', 'table_long_tablecloth_decorated_A', 'table_medium', 'table_round_medium', 'torch_lit', 'torch_mounted', 'trunk_large_A', 'bucket']),
  ...list(FUR, ['rug_rectangle_A', 'rug_oval_A', 'cabinet_medium_decorated', 'armchair']),
  ...list(DUN, ['bartop_A_large', 'banner_white', 'table_long_decorated_B', 'table_round_large', 'candle', 'torch']),
  // the dungeon pack's own walls, laid over a built place's walls (render3d/land.ts cladWalls), and more of what stands
  // and lies in its rooms
  ...list(DUN, ['wall', 'wall_half', 'wall_cracked', 'wall_arched', 'wall_archedwindow_gated', 'wall_gated', 'wall_pillar', 'wall_shelves', 'wall_window_closed', 'wall_broken', 'wall_endcap', 'wall_scaffold', 'wall_window_closed_scaffold', 'wall_window_open_scaffold']),
  ...list(DUN, ['barrel_large_decorated', 'barrel_small_stack', 'box_small', 'box_small_decorated', 'box_stacked', 'candle_melted', 'candle_thin_lit', 'coin_stack_large', 'coin_stack_small', 'keg_decorated', 'shelf_small_candles', 'shelf_large', 'sword_shield_gold', 'sword_shield_broken', 'table_long_broken', 'table_medium_broken', 'table_small', 'trunk_medium_B', 'trunk_small_C', 'bottle_A_green', 'bottle_B_brown', 'bottle_C_green', 'plate_stack', 'plate_food_A', 'keyring_hanging', 'key', 'barrier', 'barrier_column', 'bed_frame', 'floor_tile_big_grate', 'floor_tile_small_broken_A', 'floor_tile_small_broken_B', 'floor_tile_small_weeds_A', 'stairs_wide', 'banner_shield_blue', 'banner_shield_white', 'banner_shield_green', 'banner_shield_yellow', 'banner_patternB_red', 'banner_patternC_white', 'banner_triple_blue', 'banner_thin_white', 'banner_green', 'banner_yellow', 'banner_brown']),
};

/* ------------------------------------------------------------------ build */

/** The horses that are ridden (render3d/mountLook.ts says who is which), and the beast a drake is built on. */
const HORSES = ['02', '04', '05', '10', '11', '12', '13', '16', '17'];
const DRAKE_CLIPS = [
  ['idle', /^Idle/i],
  ['walk', /^Walk/i],
  ['run', /^Run/i],
  ['chop', /^(Attack|Bite)/i],
  ['die', /^Death/i],
];

async function mountKits(says) {
  const add = async (id, path) => {
    const doc = loadGltf(path);
    const rig = rigFrom(doc);
    const parts = await partsOf(doc, rig);
    const pack = new Pack();
    pack.addMesh('body', joinParts(Object.values(parts)));
    pack.meshes.body.rig = id;
    const names = (doc.g.animations ?? []).map((a) => a.name);
    for (const [want, re] of OWN_CLIPS) {
      const anim = (doc.g.animations ?? []).find((a) => re.test(a.name));
      if (anim) bakeClip(pack, id, rig, doc, anim, want, 15);
      else console.log(`  ${id}: no ${want} in ${names.join(',')}`);
    }
    pack.rigs[id] = cleanRig(rig);
    says(id, pack.write(`k/${id}.pack`));
  };
  for (const n of HORSES) await add(`m_horse_${n}`, join(SRC, `PLUS/GLB/horse-${n}.glb`));
  says('fbx_trex', (await fbxKit('fbx_trex', join(SRC, `${DINO}Trex.fbx`), DRAKE_CLIPS)).write('k/fbx_trex.pack'));
}

/** The creatures that are made here from nothing, with no art pack behind them. */
function builtKits(says) {
  for (const [id, o] of Object.entries(BUGS)) says(id, bugKit(id, o).write(`k/${id}.pack`));
  says('slime', slimeKit('slime').write('k/slime.pack'));
  says('wisp', wispKit('wisp').write('k/wisp.pack'));
  says('moth', flyerKit('moth', { body: [0.17, 0.15, 0.3], wing: [0.66, 0.05, 0.36], main: '#c8b890', dark: '#e4d8b8' }).write('k/moth.pack'));
  says('bird', flyerKit('bird', { body: [0.26, 0.25, 0.4], wing: [0.74, 0.05, 0.3], beak: '#e0a840', main: '#e8e4e0', dark: '#c8c4c0' }).write('k/bird.pack'));
  for (const [id, o] of Object.entries(SERPENTS)) says(id, serpentKit(id, o).write(`k/${id}.pack`));
  for (const [id, o] of Object.entries(COILS)) says(id, coilKit(id, o).write(`k/${id}.pack`));
  says('bear', bearKit('bear', { main: '#7a5234', dark: '#4a2e1c', light: '#b99468' }).write('k/bear.pack'));
}

/* ------------------------------------------------------------------ bosses of their own */

/**
 * A boss is a figure of its own (src/games/sigilfall/NINE_PLAN.md, piece 2): parts of several of the packs' characters
 * on one skeleton, some of them grown (a head, hands), and things from the packs tied to its bones. Its colors, what is
 * built onto it in the browser and how it moves are the game's (render3d/kits.ts, render3d/bossKit.ts). Each is a file
 * of its own, `k/boss_<id>.pack`: `SIGILFALL_ONLY=bosses` builds these alone and touches no other file.
 *
 * - `from`: the characters it is made of, and which of each one's parts (by name).
 * - `grow`: joints whose flesh is made bigger or smaller about the joint, with everything that hangs below it.
 * - `ties`: things tied to a joint: `at` from the joint (the figure's own right, up, forward), `size`, `turn` about
 *   x, y and z in degrees, and `tint` multiplied into its colors.
 */
const BOSS_KITS = {
  // The Coffin Matron, Mother of the Ossuary: an old woman of the dead in the Witch's long dress, with the dead's own
  // arms (the Skeleton Mage's), who carries the coffin she hides in on her back and a sexton's spade beside it.
  boss_matron: {
    rig: 'medium',
    from: [['Witch', /Body|Head|Leg/], [`${SK}Mage`, /Arm/]],
    grow: [['head', 1.12], ['hand.l', 1.45], ['hand.r', 1.45]],
    ties: [
      { bit: 'coffin', joint: 'chest', at: [0, -0.2, -0.62], size: 1.05, turn: [-96, 0, 0], tint: [0.62, 0.56, 0.6] },
      { bit: 'shovel', joint: 'chest', at: [0.78, 0.25, -0.5], size: 1.5, turn: [0, 0, 172], tint: [0.8, 0.78, 0.8] },
    ],
  },
};

// Warden Ossric, Keeper of the Crypt Gate: a warden of Aster three hundred years dead, still in his plate. The Knight's
// armor and cape with the Skeleton Warrior's bare skull, broad in the chest; a halberd, and the
// dead's own great shield. (His helm is long gone: the skull is bare.)
BOSS_KITS.boss_ossric = {
  rig: 'medium',
  from: [['Knight', /Body|Arm|Leg|Cape/], [`${SK}Warrior`, /Head|Jaw|Eyes/]],
  grow: [['chest', 1.18], ['upperarm.l', 1.15], ['upperarm.r', 1.15], ['head', 0.86]],
  ties: [
    { bit: 'halberd', joint: 'handslot.r', at: [0, 0, 0], size: 1.25 },
    { bit: `${SK}Shield_Large_B`, joint: 'handslot.l', at: [0, 0, 0], size: 1.2 },
  ],
};
// Morgrave, the Ash-Scholar: thrown out of the Crown City's college, sold to the Host. The Lorekeeper's head and
// spectacles and his pack of books on the Necromancer's robes; an open book in one hand, a staff in the other.
BOSS_KITS.boss_morgrave = {
  rig: 'medium',
  from: [['Necromancer', /Body|Arm|Leg/], ['Lorekeeper', /Head|Glasses|Backpack/]],
  grow: [['head', 1.1], ['hand.l', 1.3], ['hand.r', 1.3]],
  ties: [
    { bit: 'spellbook_open', joint: 'handslot.l', at: [0, 0.05, 0.05], size: 0.85 },
    { bit: 'staff_C', joint: 'handslot.r', at: [0, 0, 0], size: 1.2 },
  ],
};

const quatOf = (rx, ry, rz) => new THREE.Quaternion().setFromEuler(new THREE.Euler((rx * Math.PI) / 180, (ry * Math.PI) / 180, (rz * Math.PI) / 180, 'YXZ')).toArray();

/** The model with what hangs from one joint, and from every joint under it, made `k` times its size about that joint. */
function grown(m, rig, jointName, k) {
  const j = rig.joints.indexOf(jointName);
  if (j < 0) throw new Error(`no joint ${jointName}`);
  const under = new Uint8Array(rig.joints.length);
  under[j] = 1;
  for (let i = 0; i < rig.joints.length; i++) if (rig.parents[i] >= 0 && under[rig.parents[i]]) under[i] = 1;
  const world = invert(rig.ibm.slice(j * 16, j * 16 + 16));
  const c = [world[12], world[13], world[14]];
  const pos = new Float32Array(m.pos);
  for (let v = 0; v < m.n; v++) {
    // (a vertex shared with the joint above grows by its share, so the wrist stays joined to the arm)
    const w = (under[m.skin[v * 3]] ? m.skin[v * 3 + 2] / 255 : 0) + (under[m.skin[v * 3 + 1]] ? 1 - m.skin[v * 3 + 2] / 255 : 0);
    if (!w) continue;
    const f = 1 + (k - 1) * w;
    for (let a = 0; a < 3; a++) pos[v * 3 + a] = c[a] + (m.pos[v * 3 + a] - c[a]) * f;
  }
  return { ...m, pos };
}

/** A thing from the packs tied to a joint: turned and sized, then set `at` from where the joint is at rest. */
function tiedTo(m, rig, t) {
  const j = rig.joints.indexOf(t.joint);
  if (j < 0) throw new Error(`no joint ${t.joint}`);
  const k = t.size ?? 1;
  const world = mul(invert(rig.ibm.slice(j * 16, j * 16 + 16)), trs(t.at ?? [0, 0, 0], quatOf(...(t.turn ?? [0, 0, 0])), [k, k, k]));
  const pos = new Float32Array(m.n * 3);
  const nor = new Float32Array(m.n * 3);
  const skin = new Uint8Array(m.n * 3);
  const col = t.tint ? Uint8Array.from(m.col, (x, i) => Math.min(255, Math.round(x * t.tint[i % 3]))) : m.col;
  for (let v = 0; v < m.n; v++) {
    pos.set(point(world, m.pos[v * 3], m.pos[v * 3 + 1], m.pos[v * 3 + 2]), v * 3);
    const d = dirOf(world, m.nor[v * 3], m.nor[v * 3 + 1], m.nor[v * 3 + 2]);
    const l = Math.hypot(d[0], d[1], d[2]) || 1;
    nor.set([d[0] / l, d[1] / l, d[2] / l], v * 3);
    skin[v * 3] = j;
    skin[v * 3 + 1] = j;
    skin[v * 3 + 2] = 255;
  }
  return { n: m.n, pos, nor, col, skin, idx: m.idx };
}

async function bossKits(says, medium, large) {
  for (const [id, spec] of Object.entries(BOSS_KITS)) {
    const rig = spec.rig === 'large' ? large : medium;
    const list = [];
    for (const [char, which] of spec.from) {
      const doc = loadGltf(findChar(char));
      const own = whichRig(doc, medium, large).rig === 'medium' ? medium : large;
      for (const [name, part] of Object.entries(await partsOf(doc, own))) {
        if (!which.test(name)) continue;
        list.push(own === rig ? part : moveToRig(part, own, rig));
      }
    }
    let body = joinParts(list);
    for (const [joint, k] of spec.grow ?? []) body = grown(body, rig, joint, k);
    const all = [body];
    for (const t of spec.ties ?? []) all.push(tiedTo(await propOf(findBit(t.bit)), rig, t));
    const pack = new Pack();
    pack.addMesh('body', joinParts(all));
    pack.meshes.body.rig = spec.rig;
    const m = pack.meshes.body;
    says(`${id} (${Math.round(m.i / 3)} triangles, ${(m.max[0] - m.min[0]).toFixed(2)} wide, ${(m.max[1] - m.min[1]).toFixed(2)} tall, ${(m.max[2] - m.min[2]).toFixed(2)} deep)`, pack.write(`k/${id}.pack`));
  }
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const report = [];
  const says = (name, bytes) => report.push(`${name} ${(bytes / 1024).toFixed(0)}KB`);

  // (only what's made here from nothing: these need none of the art packs)
  if (process.env.SIGILFALL_ONLY === 'built') {
    builtKits(says);
    console.log(report.join('\n'));
    return;
  }

  // (only what's ridden, without rebuilding the whole world)
  if (process.env.SIGILFALL_ONLY === 'mounts') {
    await mountKits(says);
    console.log(report.join('\n'));
    return;
  }

  const knight = loadGltf(join(SRC, CHARS, 'Knight.glb'));
  const bigOne = loadGltf(join(SRC, CHARS, 'Barbarian_Large.glb'));

  // (only the bosses' own files: nothing else is written, so no other model changes)
  if (process.env.SIGILFALL_ONLY === 'bosses') {
    await bossKits(says, rigFrom(knight), rigFrom(bigOne));
    console.log(report.join('\n'));
    return;
  }

  // the two shared skeletons and their clips
  const rigPack = new Pack();
  const medium = rigFrom(knight);
  const large = rigFrom(bigOne);
  const animDir = join(SRC, K, 'KayKit Character Animations 1.1/Animations/gltf/');
  for (const [rigName, rig, table, folder] of [['medium', medium, MEDIUM_CLIPS, 'Rig_Medium'], ['large', large, LARGE_CLIPS, 'Rig_Large']]) {
    const docs = readdirSync(join(animDir, folder)).filter((f) => f.endsWith('.glb')).map((f) => loadGltf(join(animDir, folder, f)));
    for (const [id, name] of Object.entries(table)) {
      let found = false;
      for (const doc of docs) {
        const anim = doc.g.animations?.find((a) => a.name === name);
        if (anim) {
          bakeClip(rigPack, rigName, rig, doc, anim, id, 24);
          found = true;
          break;
        }
      }
      if (!found) console.log(`  no clip ${name} for ${rigName}`);
    }
    rigPack.rigs[rigName] = cleanRig(rig);
  }
  says('rigs', rigPack.write('rigs.pack'));

  // the hero's wardrobe, weapons and bits
  const heroPack = new Pack();
  for (const name of WARDROBE) {
    const doc = loadGltf(findChar(name));
    const { rig, err } = whichRig(doc, medium, large);
    if (rig !== 'medium' || err > 0.3) console.log(`  ${name}: bound to ${rig}, off by ${err.toFixed(3)}`);
    const parts = await partsOf(doc, rig === 'medium' ? medium : large);
    for (const [part, m] of Object.entries(parts)) {
      if (heroPack.meshes[part]) continue;
      heroPack.addMesh(part, m);
      heroPack.meshes[part].rig = rig;
    }
  }
  for (const w of WEAPONS) heroPack.addMesh(`w_${w}`, await propOf(join(SRC, FW, `${w}.gltf`)));
  for (const b of ADV_BITS) heroPack.addMesh(`w_${b}`, await propOf(join(SRC, ADV, `${b}.gltf`)));
  says('hero', heroPack.write('hero.pack'));

  // each crowd's model, joined whole, armed
  for (const [id, spec] of Object.entries(KITS)) {
    const doc = loadGltf(findChar(spec.char));
    const { rig: rigName, err } = whichRig(doc, medium, large);
    if (err > 0.3) console.log(`  ${spec.char}: ${rigName}, off by ${err.toFixed(3)}`);
    const rig = rigName === 'medium' ? medium : large;
    const parts = await partsOf(doc, rig);
    const list = Object.entries(parts).filter(([n]) => !spec.drop?.test(n)).map(([, m]) => m);
    for (const [bit, joint] of [[spec.right, 'handslot.r'], [spec.left, 'handslot.l']]) if (bit) list.push(tiePart(await propOf(findBit(bit)), rig, joint));
    if (spec.back) list.push(tiePart(await propOf(findBit(spec.back)), rig, 'chest', [0, 0.25, -0.42]));
    for (const [char, part] of spec.parts ?? []) {
      const d2 = loadGltf(findChar(char));
      const r2 = whichRig(d2, medium, large).rig === 'medium' ? medium : large;
      const p2 = (await partsOf(d2, r2))[part];
      if (!p2) throw new Error(`no part ${part}`);
      list.push(r2 === rig ? p2 : moveToRig(p2, r2, rig));
    }
    for (const [bit, joint, shift, scale] of spec.ties ?? []) {
      const raw = await propOf(findBit(`${bit}_Color1`).replace(/\\/g, '/'));
      list.push(tiePart(raw, rig, joint, shift, scale));
    }
    const pack = new Pack();
    const whole = joinParts(list);
    pack.addMesh('body', spec.gray ? grayed(whole, spec.gray === true ? 70 : spec.gray) : whole);
    pack.meshes.body.rig = rigName;
    says(id, pack.write(`k/${id}.pack`));
  }
  for (const [id, rel] of Object.entries(STILL_KITS)) {
    const m = await propOf(join(SRC, rel));
    const pack = new Pack();
    m.skin = new Uint8Array(m.n * 3);
    for (let v = 0; v < m.n; v++) m.skin[v * 3 + 2] = 255;
    pack.addMesh('body', m);
    pack.meshes.body.rig = 'medium';
    says(id, pack.write(`k/${id}.pack`));
  }
  builtKits(says);
  for (const [id, rel] of [['fbx_pig', `${FARM}Pig.fbx`], ['fbx_sheep', `${FARM}Sheep.fbx`], ['fbx_raptor', `${DINO}Velociraptor.fbx`]]) {
    says(id, (await fbxKit(id, join(SRC, rel), FBX_CLIPS)).write(`k/${id}.pack`));
  }
  const addOwn = async (id, path) => {
    const doc = loadGltf(path);
    const rig = rigFrom(doc);
    const parts = await partsOf(doc, rig);
    const pack = new Pack();
    const whole = joinParts(Object.values(parts));
    pack.addMesh('body', whole);
    pack.meshes.body.rig = id;
    const names = (doc.g.animations ?? []).map((a) => a.name);
    for (const [want, re] of OWN_CLIPS) {
      const anim = (doc.g.animations ?? []).find((a) => re.test(a.name));
      if (anim) bakeClip(pack, id, rig, doc, anim, want, 15);
      else console.log(`  ${id}: no ${want} in ${names.join(',')}`);
    }
    pack.rigs[id] = cleanRig(rig);
    says(id, pack.write(`k/${id}.pack`));
  };
  for (const [id, n] of Object.entries(ANIMALS)) await addOwn(id, join(SRC, 'Ultimate Animated Animals - July 2021/glTF', `${n}.gltf`));
  await mountKits(says);
  await bossKits(says, medium, large);

  // the land
  for (const [file, set] of [['nature', NATURE], ['town', TOWN], ['indoor', INDOOR]]) {
    const pack = new Pack();
    for (const [id, rel] of Object.entries(set)) {
      const p = join(SRC, rel);
      if (!existsSync(p)) {
        console.log(`  missing ${rel}`);
        continue;
      }
      pack.addMesh(id, await propOf(p));
    }
    says(file, pack.write(`${file}.pack`));
  }
  console.log(report.join('\n'));
}

await main();
