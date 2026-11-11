/**
 * Builds Sigilfall's 3D game files from the downloaded low-poly packs (the packs stay out of the repository;
 * only the files this writes to public/games/sigilfall/3d/ ship). Run by hand when the model list changes:
 *
 *   node scripts/sigilfall-3d-assets.mjs            (reads the packs from ~/Downloads)
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

/** Low-poly shapes, skinned whole to one joint each. */
class Builder {
  constructor() {
    this.parts = [];
  }
  blob(joint, c, r, color, seg = 7, rings = 5) {
    const pos = [];
    const nor = [];
    const col = [];
    const skin = [];
    const idx = [];
    for (let i = 0; i <= rings; i++) {
      const a = (i / rings) * Math.PI;
      for (let j = 0; j <= seg; j++) {
        const b = (j / seg) * Math.PI * 2;
        const n = [Math.sin(a) * Math.cos(b), Math.cos(a), Math.sin(a) * Math.sin(b)];
        pos.push(c[0] + n[0] * r[0], c[1] + n[1] * r[1], c[2] + n[2] * r[2]);
        nor.push(n[0], n[1], n[2]);
        const shade = 0.85 + 0.15 * n[1];
        col.push(color[0] * shade, color[1] * shade, color[2] * shade);
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
    this.parts.push({ n: pos.length / 3, pos: Float32Array.from(pos), nor: Float32Array.from(nor), col: Uint8Array.from(col, (c) => Math.min(255, c * 255)), skin: Uint8Array.from(skin), idx });
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

/** Crawling things: a body, a ring of legs, and claws, a tail or horn as they have them. */
function bugKit(id, o) {
  const pack = new Pack();
  const body = o.body;
  const legs = o.legs;
  const joints = [['root', null, [0, 0, 0]], ['body', 'root', [0, o.h, 0]]];
  const dark = rgb(o.dark);
  const main = rgb(o.main);
  const light = rgb(o.light);
  const b = new Builder();
  const J = (n) => joints.findIndex((j) => j[0] === n);
  b.blob(1, [0, 0, 0], body, main);
  if (o.abdomen) b.blob(1, [0, 0.02, -body[2] - o.abdomen[2] * 0.7], o.abdomen, dark);
  if (o.shell) b.blob(1, [0, body[1] * 0.35, -0.04], [body[0] * 1.02, body[1] * 0.85, body[2] * 1.02], light);
  // eyes
  b.blob(1, [body[0] * 0.42, body[1] * 0.35, body[2] * 0.88], [0.07, 0.07, 0.07], [0.95, 0.95, 0.9], 5, 3);
  b.blob(1, [-body[0] * 0.42, body[1] * 0.35, body[2] * 0.88], [0.07, 0.07, 0.07], [0.95, 0.95, 0.9], 5, 3);
  b.blob(1, [body[0] * 0.42, body[1] * 0.36, body[2] * 0.95], [0.035, 0.035, 0.035], [0.05, 0.04, 0.06], 4, 2);
  b.blob(1, [-body[0] * 0.42, body[1] * 0.36, body[2] * 0.95], [0.035, 0.035, 0.035], [0.05, 0.04, 0.06], 4, 2);
  for (let i = 0; i < legs; i++) {
    const side = i % 2 ? 1 : -1;
    const row = Math.floor(i / 2) / Math.max(1, Math.floor(legs / 2) - 1) - 0.5;
    const name = `leg${i}`;
    const at = [side * body[0] * 0.8, 0, row * body[2] * 1.4];
    joints.push([name, 'body', at]);
    const j = J(name);
    const knee = [side * o.reach * 0.55, o.knee, row * 0.25];
    const foot = [side * o.reach, -o.h + 0.03, row * 0.45];
    b.limb(j, [0, 0, 0], knee, o.leg, o.leg * 0.8, dark);
    b.limb(j, knee, foot, o.leg * 0.8, o.leg * 0.35, dark);
  }
  if (o.claws) {
    for (const side of [-1, 1]) {
      const name = side < 0 ? 'clawL' : 'clawR';
      joints.push([name, 'body', [side * body[0] * 0.8, 0.02, body[2] * 0.75]]);
      const j = J(name);
      b.limb(j, [0, 0, 0], [side * 0.28, 0.06, 0.26], 0.07, 0.09, main);
      b.blob(j, [side * 0.36, 0.08, 0.42], [o.claws, o.claws * 0.62, o.claws * 1.15], light, 6, 4);
    }
  }
  if (o.tail) {
    let last = 'body';
    let at = [0, 0.06, -body[2] * 0.95];
    for (let i = 0; i < 4; i++) {
      const name = `tail${i}`;
      joints.push([name, last, at]);
      const j = J(name);
      const step = [0, 0.14 + i * 0.02, -0.14 + i * 0.07];
      b.blob(j, [0, 0, 0], [0.11 - i * 0.01, 0.11 - i * 0.01, 0.13], i % 2 ? main : dark, 6, 4);
      if (i === 3) b.limb(j, [0, 0, 0], [0, 0.04, 0.24], 0.06, 0.005, light);
      at = step;
      last = name;
    }
  }
  if (o.horn) b.limb(1, [0, body[1] * 0.3, body[2] * 0.8], [0, body[1] * 1.15, body[2] * 1.2], 0.08, 0.01, light);
  const legSwing = (name, t, speed, amp) => {
    const n = Number(name.slice(3));
    const ph = (n % 2 === Math.floor(n / 2) % 2 ? 0 : Math.PI) + t * speed;
    return { rx: Math.sin(ph) * amp, dy: Math.max(0, Math.cos(ph)) * 0.03 };
  };
  builtRig(pack, id, joints, {
    idle: { dur: 1.4, pose: (n, j, t, u) => (n === 'body' ? { dy: Math.sin(u * 6.283) * 0.012 } : n.startsWith('tail') ? { rx: Math.sin(u * 6.283 + Number(n[4])) * 0.05 } : null) },
    walk: { dur: 0.6, pose: (n, j, t, u) => (n.startsWith('leg') ? legSwing(n, u * 6.283, 1, 0.42) : n === 'body' ? { dy: Math.abs(Math.sin(u * 12.57)) * 0.015 } : null) },
    run: { dur: 0.36, pose: (n, j, t, u) => (n.startsWith('leg') ? legSwing(n, u * 6.283, 1, 0.55) : null) },
    chop: {
      dur: 0.6,
      pose: (n, j, t, u) => {
        const k = Math.sin(Math.min(1, u * 1.5) * Math.PI);
        if (n === 'body') return { rx: -k * 0.28, dz: k * 0.1 };
        if (n === 'clawL' || n === 'clawR') return { rx: -k * 0.9 };
        if (n.startsWith('tail')) return { rx: k * 0.55 };
        return null;
      },
    },
    hit: { dur: 0.3, pose: (n, j, t, u) => (n === 'body' ? { rx: Math.sin(u * 3.14) * 0.2, dz: -Math.sin(u * 3.14) * 0.06 } : null) },
    die: { dur: 0.7, pose: (n, j, t, u) => (n === 'root' ? { rz: Math.min(1, u * 1.6) * 3.14, dy: Math.sin(Math.min(1, u * 1.6) * 3.14) * 0.3 + Math.min(1, u * 1.6) * o.h * 1.6 } : n.startsWith('leg') ? { rx: Math.min(1, u * 2) * 0.6 } : null) },
  });
  const m = b.done();
  pack.addMesh('body', m);
  pack.meshes.body.rig = id;
  return pack;
}

/** A serpent: a chain of joints that waves along itself, its head held up. */
function serpentKit(id, o) {
  const pack = new Pack();
  const wings = !!o.wings;
  const main = rgb(o.main);
  const dark = rgb(o.dark);
  const light = rgb(o.light);
  const N = o.n;
  const joints = [['root', null, [0, 0, 0]]];
  const b = new Builder();
  const seg = o.len / N;
  let prev = 'root';
  for (let i = 0; i < N; i++) {
    const name = `s${i}`;
    const y = i === 0 ? o.r * 1 + (o.rise ?? 0) : i < 3 ? -(o.rise ?? 0) / 2 : 0;
    joints.push([name, prev, [0, y, i === 0 ? 0.2 : -seg]]);
    const r = o.r * (i < 2 ? 0.8 : 1 - ((i - 2) / (N - 2)) * 0.78);
    b.blob(i + 1, [0, 0, 0], [r, r * 0.9, seg * 0.85], i % 2 ? main : dark, 7, 4);
    prev = name;
  }
  // the head
  b.blob(1, [0, o.r * 0.15, o.r * 0.9], [o.r * 1.05, o.r * 0.72, o.r * 1.25], light, 7, 5);
  b.blob(1, [o.r * 0.5, o.r * 0.55, o.r * 1.4], [0.05 + o.r * 0.14, 0.05 + o.r * 0.14, 0.05 + o.r * 0.14], [0.95, 0.9, 0.5], 5, 3);
  b.blob(1, [-o.r * 0.5, o.r * 0.55, o.r * 1.4], [0.05 + o.r * 0.14, 0.05 + o.r * 0.14, 0.05 + o.r * 0.14], [0.95, 0.9, 0.5], 5, 3);
  if (wings) {
    joints.push(['wingL', 's1', [-o.r * 0.7, o.r * 0.5, 0]], ['wingR', 's1', [o.r * 0.7, o.r * 0.5, 0]]);
    const lj = joints.findIndex((j) => j[0] === 'wingL');
    const rj = joints.findIndex((j) => j[0] === 'wingR');
    b.blob(lj, [-o.wings * 0.5, 0, -0.1], [o.wings * 0.55, 0.05, o.wings * 0.36], dark, 8, 5);
    b.blob(rj, [o.wings * 0.5, 0, -0.1], [o.wings * 0.55, 0.05, o.wings * 0.36], dark, 8, 5);
  }
  const wave = (n, u, amp, cycles) => {
    if (n === 'wingL') return { rz: Math.sin(u * 6.283 * 2) * 0.5 };
    if (n === 'wingR') return { rz: -Math.sin(u * 6.283 * 2) * 0.5 };
    if (!n.startsWith('s')) return null;
    const i = Number(n.slice(1));
    return { ry: Math.sin(u * 6.283 * cycles - i * 0.9) * amp * (i === 0 ? 0.4 : 1) };
  };
  builtRig(pack, id, joints, {
    idle: { dur: 1.6, pose: (n, j, t, u) => wave(n, u, 0.08, 1) },
    walk: { dur: 0.9, pose: (n, j, t, u) => wave(n, u, 0.3, 1) },
    run: { dur: 0.5, pose: (n, j, t, u) => wave(n, u, 0.38, 1) },
    chop: { dur: 0.6, pose: (n, j, t, u) => (n === 's0' ? { rx: -Math.sin(Math.min(1, u * 1.5) * 3.14) * 0.7, dz: Math.sin(Math.min(1, u * 1.5) * 3.14) * 0.3 } : wave(n, u, 0.08, 1)) },
    hit: { dur: 0.3, pose: (n, j, t, u) => (n === 's0' ? { rx: Math.sin(u * 3.14) * 0.4 } : null) },
    die: { dur: 0.8, pose: (n, j, t, u) => (n === 's0' ? { dy: -Math.min(1, u * 1.5) * o.r * 0.9, rx: Math.min(1, u * 1.5) * 0.5 } : wave(n, u, 0.3 * (1 - u), 1)) },
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

/** A blob of slime: it hops and quivers. Gray, for the game to color. */
function slimeKit(id) {
  const pack = new Pack();
  const c = [0.92, 0.92, 0.92];
  const b = new Builder();
  const joints = [['root', null, [0, 0, 0]], ['body', 'root', [0, 0.42, 0]]];
  b.blob(1, [0, 0, 0], [0.62, 0.44, 0.62], c, 10, 7);
  b.blob(1, [0, 0.22, 0], [0.34, 0.3, 0.34], [c[0] * 1.05, c[1] * 1.05, c[2] * 1.05], 8, 5);
  for (const side of [-1, 1]) {
    b.blob(1, [side * 0.2, 0.14, 0.52], [0.12, 0.14, 0.09], [1, 1, 1], 6, 4);
    b.blob(1, [side * 0.2, 0.14, 0.59], [0.06, 0.08, 0.05], [0.04, 0.03, 0.06], 5, 3);
  }
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

/** Anything that flaps: a body, a head and two wings. `beak` makes it a bird. */
function flyerKit(id, o) {
  const pack = new Pack();
  const main = rgb(o.main);
  const dark = rgb(o.dark);
  const b = new Builder();
  const joints = [['root', null, [0, 0, 0]], ['body', 'root', [0, 0.5, 0]], ['wingL', 'body', [-o.body[0] * 0.8, 0.06, 0]], ['wingR', 'body', [o.body[0] * 0.8, 0.06, 0]]];
  b.blob(1, [0, 0, 0], o.body, main, 8, 6);
  b.blob(1, [0, o.body[1] * 0.55, o.body[2] * 0.85], [o.body[0] * 0.72, o.body[0] * 0.72, o.body[0] * 0.72], main, 7, 5);
  if (o.beak) b.limb(1, [0, o.body[1] * 0.5, o.body[2] * 1.3], [0, o.body[1] * 0.38, o.body[2] * 1.9], 0.07, 0.01, rgb(o.beak), 5);
  if (o.tail) b.blob(1, [0, 0, -o.body[2] * 1.1], [o.body[0] * 0.5, o.body[1] * 0.25, o.body[2] * 0.6], dark, 6, 4);
  for (const side of [-1, 1]) {
    b.blob(1, [side * o.body[0] * 0.38, o.body[1] * 0.72, o.body[2] * 1.2], [0.055, 0.06, 0.04], [0.95, 0.95, 0.85], 5, 3);
    b.blob(side < 0 ? 2 : 3, [side * o.wing[0] * 0.5, 0, 0], [o.wing[0] * 0.55, o.wing[1], o.wing[2]], dark, 8, 5);
  }
  const flap = (n, u, amp) => (n === 'wingL' ? { rz: Math.sin(u * 6.283) * amp } : n === 'wingR' ? { rz: -Math.sin(u * 6.283) * amp } : n === 'body' ? { dy: Math.sin(u * 6.283 + 1.4) * 0.03 } : null);
  builtRig(pack, id, joints, {
    idle: { dur: 0.5, pose: (n, j, t, u) => flap(n, u, 0.55) },
    walk: { dur: 0.32, pose: (n, j, t, u) => flap(n, u, 0.75) },
    run: { dur: 0.24, pose: (n, j, t, u) => flap(n, u, 0.85) },
    chop: { dur: 0.5, pose: (n, j, t, u) => (n === 'body' ? { rx: Math.sin(u * 3.14) * 0.5, dz: Math.sin(u * 3.14) * 0.3 } : flap(n, u, 0.5)) },
    hit: { dur: 0.3, pose: (n, j, t, u) => (n === 'body' ? { dz: -Math.sin(u * 3.14) * 0.12 } : null) },
    die: { dur: 0.7, pose: (n, j, t, u) => (n === 'root' ? { dy: -u * 0.4, rz: u * 1.5 } : null) },
  });
  pack.addMesh('body', b.done());
  pack.meshes.body.rig = id;
  return pack;
}

const BUGS = {
  spider: { body: [0.3, 0.2, 0.3], abdomen: [0.42, 0.34, 0.46], h: 0.42, legs: 8, reach: 0.95, knee: 0.34, leg: 0.05, main: '#5b4a68', dark: '#34283f', light: '#8a78a0' },
  crab: { body: [0.55, 0.26, 0.42], h: 0.34, legs: 6, reach: 0.9, knee: 0.2, leg: 0.06, claws: 0.2, main: '#e0633f', dark: '#a53c22', light: '#f48d63' },
  scorpion: { body: [0.3, 0.16, 0.46], h: 0.26, legs: 6, reach: 0.7, knee: 0.16, leg: 0.045, claws: 0.17, tail: true, main: '#c79a58', dark: '#8a6431', light: '#e4c27f' },
  beetle: { body: [0.42, 0.26, 0.52], h: 0.28, legs: 6, reach: 0.68, knee: 0.14, leg: 0.05, shell: true, horn: true, main: '#3f6b49', dark: '#22402b', light: '#6ea86f' },
  scarab: { body: [0.42, 0.24, 0.5], h: 0.26, legs: 6, reach: 0.62, knee: 0.12, leg: 0.05, shell: true, main: '#a8862f', dark: '#5f4a17', light: '#e6c14f' },
  strider: { body: [0.2, 0.14, 0.34], h: 0.8, legs: 6, reach: 1.15, knee: 0.5, leg: 0.03, main: '#5d7a54', dark: '#374c33', light: '#8aa77c' },
};
const SERPENTS = {
  viper: { n: 8, r: 0.2, len: 2, main: '#4f8f4a', dark: '#2f5f33', light: '#79b862' },
  serpent: { n: 10, r: 0.32, len: 3.4, main: '#3f8f94', dark: '#27616a', light: '#79c4bd' },
  wurm: { n: 9, r: 0.52, len: 3.4, main: '#c7a266', dark: '#8e6f3e', light: '#e6c98e' },
  naga_coil: { n: 9, r: 0.3, len: 2.6, rise: 0.5, main: '#3f8f6a', dark: '#27604a', light: '#6fbf94' },
  wyrm: { n: 9, r: 0.42, len: 3.6, rise: 0.25, wings: 1.7, main: '#d8d4cc', dark: '#a8a49c', light: '#f0ece4' },
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

async function main() {
  mkdirSync(OUT, { recursive: true });
  const report = [];
  const says = (name, bytes) => report.push(`${name} ${(bytes / 1024).toFixed(0)}KB`);

  // (only what's ridden, without rebuilding the whole world)
  if (process.env.SIGILFALL_ONLY === 'mounts') {
    await mountKits(says);
    console.log(report.join('\n'));
    return;
  }

  const knight = loadGltf(join(SRC, CHARS, 'Knight.glb'));
  const bigOne = loadGltf(join(SRC, CHARS, 'Barbarian_Large.glb'));

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
  for (const [id, o] of Object.entries(BUGS)) says(id, bugKit(id, o).write(`k/${id}.pack`));
  says('slime', slimeKit('slime').write('k/slime.pack'));
  says('wisp', wispKit('wisp').write('k/wisp.pack'));
  says('moth', flyerKit('moth', { body: [0.18, 0.16, 0.3], wing: [0.62, 0.05, 0.36], main: '#c8b890', dark: '#e4d8b8' }).write('k/moth.pack'));
  says('bird', flyerKit('bird', { body: [0.26, 0.26, 0.42], wing: [0.72, 0.05, 0.3], beak: '#e0a840', tail: true, main: '#e8e4e0', dark: '#c8c4c0' }).write('k/bird.pack'));
  for (const [id, o] of Object.entries(SERPENTS)) says(id, serpentKit(id, o).write(`k/${id}.pack`));
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
