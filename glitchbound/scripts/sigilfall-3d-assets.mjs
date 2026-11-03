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

/** A character's whole body is one model for a crowd; these are its pieces to leave off. */
const KITS = {
  // the undead
  skeleton_warrior: 'Skeleton_Warrior', skeleton_minion: 'Skeleton_Minion', skeleton_rogue: 'Skeleton_Rogue', skeleton_mage: 'Skeleton_Mage', necromancer: 'Necromancer', skeleton_golem: 'Skeleton_Golem',
  // people and other two-legged folk
  knight: 'Knight', barbarian: 'Barbarian', mage: 'Mage', rogue: 'Rogue', rogue_hooded: 'Rogue_Hooded', ranger: 'Ranger', druid: 'Druid', engineer: 'Engineer',
  paladin: 'Paladin', cleric: 'Cleric', witch: 'Witch', vampire: 'Vampire', tiefling: 'Tiefling', caveman: 'Caveman', ninja: 'Ninja', survivalist: 'Survivalist',
  farmer_a: 'Farmer_A', farmer_b: 'Farmer_B', hiker: 'Hiker', lorekeeper: 'Lorekeeper', helper_a: 'Helper_A', helper_b: 'Helper_B', protagonist_a: 'Protagonist_A', protagonist_b: 'Protagonist_B', marksman: 'Marksman', magical_girl: 'MagicalGirl', toy_soldier: 'ToySoldier',
  // brutes
  orc_raider: 'OrcRaider', orc_brute: 'OrcBrute', black_knight: 'BlackKnight', frost_golem: 'FrostGolem', monstrosity: 'Monstrosity', barbarian_large: 'Barbarian_Large', werewolf: 'Werewolf_Wolf', wolfman: 'Werewolf_Man', monster: 'Monster', avian: 'AvianSwordsman', plant_warrior: 'PlantWarrior',
};

const MONSTERS = 'Ultimate Monsters/';
const CREATURES = {
  // big, flying and blob monsters, each with their own skeleton and clips
  m_alien: 'Big/glTF/Alien', m_birb: 'Big/glTF/Birb', m_bluedemon: 'Big/glTF/BlueDemon', m_bunny: 'Big/glTF/Bunny', m_cactoro: 'Big/glTF/Cactoro', m_demon: 'Big/glTF/Demon', m_dino: 'Big/glTF/Dino', m_fish: 'Big/glTF/Fish', m_frog: 'Big/glTF/Frog', m_monkroose: 'Big/glTF/Monkroose', m_mushking: 'Big/glTF/MushroomKing', m_ninja: 'Big/glTF/Ninja', m_orc: 'Big/glTF/Orc', m_orcskull: 'Big/glTF/Orc_Skull', m_tribal: 'Big/glTF/Tribal', m_yeti: 'Big/glTF/Yeti',
  f_alpaking: 'Flying/glTF/Alpaking', f_alpaking2: 'Flying/glTF/Alpaking_Evolved', f_armabee: 'Flying/glTF/Armabee', f_armabee2: 'Flying/glTF/Armabee_Evolved', f_demon: 'Flying/glTF/Demon', f_dragon: 'Flying/glTF/Dragon', f_dragon2: 'Flying/glTF/Dragon_Evolved', f_ghost: 'Flying/glTF/Ghost', f_ghostskull: 'Flying/glTF/Ghost_Skull', f_glub: 'Flying/glTF/Glub', f_glub2: 'Flying/glTF/Glub_Evolved', f_goleling: 'Flying/glTF/Goleling', f_goleling2: 'Flying/glTF/Goleling_Evolved', f_hywirl: 'Flying/glTF/Hywirl', f_pigeon: 'Flying/glTF/Pigeon', f_squidle: 'Flying/glTF/Squidle', f_tribal: 'Flying/glTF/Tribal',
  b_alien: 'Blob/glTF/Alien', b_birb: 'Blob/glTF/Birb', b_cactoro: 'Blob/glTF/Cactoro', b_cat: 'Blob/glTF/Cat', b_chicken: 'Blob/glTF/Chicken', b_dog: 'Blob/glTF/Dog', b_fish: 'Blob/glTF/Fish', b_green: 'Blob/glTF/GreenBlob', b_spiky: 'Blob/glTF/GreenSpikyBlob', b_mushnub: 'Blob/glTF/Mushnub', b_mushnub2: 'Blob/glTF/Mushnub_Evolved', b_ninja: 'Blob/glTF/Ninja', b_orc: 'Blob/glTF/Orc', b_pigeon: 'Blob/glTF/Pigeon', b_pink: 'Blob/glTF/PinkBlob', b_wizard: 'Blob/glTF/Wizard', b_yeti: 'Blob/glTF/Yeti',
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
const TOWN = {
  ...Object.fromEntries(['home_A', 'home_B', 'church', 'tavern', 'blacksmith', 'market', 'castle', 'tower_A', 'tower_B', 'tower_base', 'townhall', 'windmill', 'watermill', 'lumbermill', 'stables', 'barracks', 'watchtower', 'shrine', 'well', 'tent', 'mine', 'docks', 'workshop'].map((n) => [`b_${n}`, buildingFile(n)])),
  ...Object.fromEntries(['barrel', 'crate_A_big', 'crate_B_small', 'crate_long_A', 'crate_open', 'haybale', 'sack', 'tent', 'trough', 'weaponrack', 'wheelbarrow', 'target', 'flag_blue', 'flag_red', 'ladder', 'pallet', 'boat', 'anchor', 'bucket_water'].map((n) => [`p_${n}`, `${HEX}decoration/props/${n}.gltf`])),
  ...list(GRAVE, ['altar-stone', 'border-pillar', 'cross', 'debris', 'debris-wood', 'fire-basket', 'hay-bale', 'iron-fence', 'lantern-candle'], '.glb'),
  anvil: `${TOOL}anvil.gltf`, grindstone: `${TOOL}grindstone.gltf`,
};
const INDOOR = {
  ...list(DUN, ['column', 'pillar', 'pillar_decorated', 'barrel_large', 'barrel_small', 'box_large', 'crate_large', 'crates_stacked', 'banner_blue', 'banner_red', 'banner_shield_red', 'banner_patternA_blue', 'banner_triple_red', 'banner_thin_yellow', 'bed_A_single', 'bed_decorated', 'bed_floor', 'bench', 'bookcase_double_decoratedA', 'bookcase_single_decoratedA', 'candle_lit', 'candle_triple', 'chair', 'chest', 'chest_gold', 'chest_large', 'chest_large_gold', 'chest_mimic', 'coin', 'coin_stack_medium', 'keg', 'rocks', 'rubble_half', 'rubble_large', 'shelf_small_books', 'shelves_decorated', 'stairs', 'stool', 'sword_shield', 'table_long', 'table_long_tablecloth_decorated_A', 'table_medium', 'table_round_medium', 'torch_lit', 'torch_mounted', 'trunk_large_A', 'bucket']),
  ...list(FUR, ['rug_rectangle_A', 'rug_oval_A', 'cabinet_medium_decorated', 'armchair']),
};

/* ------------------------------------------------------------------ build */

async function main() {
  mkdirSync(OUT, { recursive: true });
  const report = [];
  const says = (name, bytes) => report.push(`${name} ${(bytes / 1024).toFixed(0)}KB`);

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

  // each crowd's model, joined whole
  for (const [id, char] of Object.entries(KITS)) {
    const doc = loadGltf(findChar(char));
    const { rig, err } = whichRig(doc, medium, large);
    if (err > 0.3) console.log(`  ${char}: ${rig}, off by ${err.toFixed(3)}`);
    const parts = await partsOf(doc, rig === 'medium' ? medium : large);
    const pack = new Pack();
    pack.addMesh('body', joinParts(Object.values(parts)));
    pack.meshes.body.rig = rig;
    says(id, pack.write(`k/${id}.pack`));
  }
  const addOwn = async (id, path) => {
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
  for (const [id, rel] of Object.entries(CREATURES)) await addOwn(id, join(SRC, MONSTERS, `${rel}.gltf`));
  for (const [id, n] of Object.entries(ANIMALS)) await addOwn(id, join(SRC, 'Ultimate Animated Animals - July 2021/glTF', `${n}.gltf`));

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
