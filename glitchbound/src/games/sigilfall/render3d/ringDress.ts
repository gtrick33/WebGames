import * as THREE from 'three';
import { ARENA_H, ARENA_W, ENTRY_Y0, ENTRY_Y1, type Pillar, type RingMap } from '../arena/maps';
import { TILE } from '../sim/map';
import { Build, mul, pick, type C } from './build';
import { Stand } from './crowd';
import { hexRgb } from './kits';
import type { LandPacks } from './land';
import type { MeshData } from './pack';
import { seeded, tilesOf } from './ringFloor';
import { crowdMaterial, LIGHT } from './toon';

/**
 * What stands round the ground of a ring and on it: each is a place, with its own people come to watch. Nothing here
 * changes where anyone can walk or see (the map's pillars and walls say that, and everything here that stands on the
 * ground stands inside them, or is lower than an ankle).
 */

export interface RingAir {
  /** Fires in their bowls and sconces (world pixels). */
  flames: { x: number; y: number; h: number; size?: number }[];
  /** Chimneys and stacks. */
  smokes: { x: number; y: number; h: number; tone: string; size?: number }[];
  /** Where the light catches something now and then. */
  glints: { x: number; y: number; h: number }[];
  /** Runs of hot iron: what sparks come up from. */
  embers: { x: number; y: number }[];
}

const AW = ARENA_W / TILE;
const AH = ARENA_H / TILE;
/** The north wall: taller than a person, not so tall it takes the screen from the crowd above it. */
const NORTH = 1.7;
const SIDE = 1.7;
const SOUTH = 0.5;
const STEP_D = 0.86;
const STEP_H = 0.42;

const rgb = hexRgb;

/* ------------------------------------------------------------------ what a pack has */

interface Placing {
  x: number;
  y: number;
  z: number;
  rot: number;
  k: number;
  tint: C;
  sway: number;
}

class Placer {
  private readonly rows = new Map<string, Placing[]>();

  /** One of a pack's models, its foot at (x, y, z) and `h` tiles tall. */
  put(id: string, x: number, z: number, y: number, h: number, o: { rot?: number; tint?: C; sway?: number } = {}): void {
    let list = this.rows.get(id);
    if (!list) {
      list = [];
      this.rows.set(id, list);
    }
    list.push({ x, y, z, rot: o.rot ?? 0, k: h, tint: o.tint ?? [1, 1, 1], sway: o.sway ?? 0 });
  }

  build(packs: LandPacks, parent: THREE.Object3D): Stand[] {
    const out: Stand[] = [];
    for (const [id, list] of this.rows) {
      const mesh = packs.town.meshes[id] ?? packs.indoor.meshes[id] ?? packs.nature.meshes[id];
      if (!mesh) continue;
      const s = new Stand(mesh, parent, list.length);
      const tall = Math.max(0.01, mesh.max[1] - mesh.min[1]);
      s.begin();
      for (const p of list) {
        const k = p.k / tall;
        s.put(p.x, p.y - mesh.min[1] * k, p.z, p.rot, k, k, k, p.tint[0]!, p.tint[1]!, p.tint[2]!, p.sway);
      }
      s.end();
      out.push(s);
    }
    return out;
  }
}

/* ------------------------------------------------------------------ the people who came to watch */

interface Watcher {
  x: number;
  y: number;
  z: number;
  k: number;
  rot: number;
  shirt: C;
  head: C;
  up: boolean;
}

/** A body in the crowd: small, round and easily excited. */
function bodyMesh(up: boolean): MeshData {
  const b = new Build();
  const w: C = [1, 1, 1];
  const d = mul(w, 0.74);
  b.post(0, 0, 0.27, 0.16, 0, 0.6, 5, d, w);
  for (const s of [-1, 1]) {
    if (up) b.post(s * 0.17, 0, 0.07, 0.05, 0.46, 0.92, 3, w, w, s * 0.13, 0);
    else b.post(s * 0.2, 0, 0.06, 0.07, 0.2, 0.52, 3, d, w, s * -0.04, 0);
  }
  return b.m.data();
}

function headMesh(): MeshData {
  const b = new Build();
  const w: C = [1, 1, 1];
  b.post(0, 0, 0.09, 0.2, 0.56, 0.7, 7, mul(w, 0.78), w);
  b.post(0, 0, 0.2, 0.17, 0.7, 0.82, 7, w, w);
  b.post(0, 0, 0.17, 0.05, 0.82, 0.92, 7, w, w);
  return b.m.data();
}

function crowdStands(people: Watcher[], parent: THREE.Object3D): Stand[] {
  const out: Stand[] = [];
  const add = (mesh: MeshData, list: Watcher[], tint: (p: Watcher) => C): void => {
    if (!list.length) return;
    const s = new Stand(mesh, parent, list.length);
    s.mesh.material = crowdMaterial;
    s.begin();
    for (const p of list) {
      const c = tint(p);
      s.put(p.x, p.y, p.z, p.rot, p.k, p.k, p.k, c[0]!, c[1]!, c[2]!, 0);
    }
    s.end();
    out.push(s);
  };
  add(bodyMesh(false), people.filter((p) => !p.up), (p) => p.shirt);
  add(bodyMesh(true), people.filter((p) => p.up), (p) => p.shirt);
  add(headMesh(), people, (p) => p.head);
  return out;
}

interface Folk {
  shirts: readonly C[];
  heads: readonly C[];
}

interface Terrace {
  side: C;
  foot: C;
  top: C;
  aisle: C;
  bench?: C;
}

/** Rows of seats going up from the top of the north wall, and away down both sides, with people in them. */
function stands(b: Build, people: Watcher[], t: Terrace, folk: Folk, rand: () => number, gaps: (x: number, z: number) => boolean, rows = 5): void {
  const person = (x: number, y: number, z: number, faceX: number, faceZ: number): void => {
    if (gaps(x, z)) return;
    if (rand() < 0.1) return;
    people.push({ x, y, z, k: 0.94 + rand() * 0.2, rot: Math.atan2(faceX, faceZ), shirt: pick(folk.shirts, rand), head: pick(folk.heads, rand), up: rand() < 0.3 });
  };
  const ROWS_X0 = -12 - rows * STEP_D;
  const ROWS_X1 = AW + 12 + rows * STEP_D;
  // the north rows
  for (let r = 0; r < rows; r++) {
    const z1 = -0.34 - r * STEP_D;
    const z0 = z1 - STEP_D;
    const y = NORTH + r * STEP_H;
    b.box(ROWS_X0, z0, ROWS_X1, z1, 0, y, t.side, t.foot, t.top);
    if (t.bench) b.flat(ROWS_X0, z0 + 0.2, ROWS_X1, z0 + 0.5, y + 0.01, t.bench);
    for (let x = -11; x < AW + 11; x += 0.76) {
      const onAisle = ((x + 40) % 6.2) < 0.86;
      if (onAisle) continue;
      person(x + (rand() - 0.5) * 0.12, y, z0 + 0.42 + (rand() - 0.5) * 0.08, 0, 1);
    }
    // steps up the aisles
    for (let a = -37.2; a < AW + 11; a += 6.2) b.flat(a, z0, a + 0.78, z1, y + 0.015, t.aisle);
  }
  // behind them the back of the place, high enough to end the view
  const backZ = -0.34 - rows * STEP_D;
  const backY = NORTH + rows * STEP_H + 0.5;
  b.box(ROWS_X0, backZ - 14, ROWS_X1, backZ, 0, backY, t.side, t.foot, t.top);
  // down each side, inside the same back wall
  for (const dir of [-1, 1]) {
    const edge = dir < 0 ? 0 : AW;
    for (let r = 0; r < 3; r++) {
      const inner = edge + dir * (0.34 + r * STEP_D);
      const outer = inner + dir * STEP_D;
      const y = SIDE + r * STEP_H;
      const x0 = Math.min(inner, outer);
      const x1 = Math.max(inner, outer);
      b.box(x0, -0.34, x1, AH + 1.1, 0, y, t.side, t.foot, t.top);
      if (r === 2) b.box(dir < 0 ? x0 - 20 : x1, -0.34, dir < 0 ? x0 : x1 + 20, AH + 1.1, 0, y + STEP_H, t.side, t.foot, t.top);
      for (let z = 0; z < AH + 0.7; z += 0.76) person(x0 + (dir < 0 ? 0.44 : 0.42), y, z + (rand() - 0.5) * 0.12, -dir, 0);
    }
  }
}

/* ------------------------------------------------------------------ the walls */

interface Masonry {
  blocks: readonly C[];
  joint: C;
  top: C;
  edge: C;
  dark: C;
}

/** A wall's faces, in courses, with a plinth and a coping. */
function northWall(b: Build, s: Masonry, rand: () => number): void {
  b.courses('s', -3, AW + 3, 0, 0.16, NORTH - 0.14, 0.4, 1.15, s.blocks, s.joint, rand);
  b.box(-3, 0, AW + 3, 0.08, 0, 0.18, s.dark, mul(s.dark, 0.7), s.edge);
  b.box(-3, -0.34, AW + 3, 0.1, NORTH - 0.14, NORTH, s.edge, s.dark, s.top);
}

function sideWalls(b: Build, s: Masonry, rand: () => number): void {
  // (seen edge on, and past an entry's block: plain courses are plenty)
  b.courses('e', -0.34, AH + 0.2, 0, 0.16, SIDE - 0.14, 0.4, 1.15, s.blocks, s.joint, rand);
  b.courses('w', -0.34, AH + 0.2, AW, 0.16, SIDE - 0.14, 0.4, 1.15, s.blocks, s.joint, rand);
  b.box(-0.34, -0.34, 0.08, AH + 0.2, SIDE - 0.14, SIDE, s.edge, s.dark, s.top);
  b.box(AW - 0.08, -0.34, AW + 0.34, AH + 0.2, SIDE - 0.14, SIDE, s.edge, s.dark, s.top);
}

/** The parapet along the south, low enough never to hide a fighter, and the walk behind it. */
function southWalk(b: Build, s: Masonry, palette: readonly C[], rand: () => number): void {
  b.box(-14, AH, AW + 14, AH + 12, 0, SOUTH, s.dark, mul(s.dark, 0.7), s.dark);
  b.box(-14, AH, AW + 14, AH + 0.34, SOUTH - 0.1, SOUTH, s.edge, s.dark, s.top);
  b.flags(-14, AH + 0.34, AW + 14, AH + 7, SOUTH + 0.005, 1.1, 0.62, palette, s.joint, rand);
}

function southFolk(people: Watcher[], folk: Folk, rand: () => number, gaps: (x: number, z: number) => boolean): void {
  // close to the camera and seen from behind; far enough back not to stand in anyone's way
  for (let row = 0; row < 3; row++) {
    for (let x = -11; x < AW + 11; x += 0.74) {
      const z = AH + 1.7 + row * 0.86 + (rand() - 0.5) * 0.12;
      if (rand() < 0.16 || gaps(x, z)) continue;
      people.push({ x: x + (rand() - 0.5) * 0.14, y: SOUTH, z, k: 1 + rand() * 0.2, rot: Math.PI, shirt: pick(folk.shirts, rand), head: pick(folk.heads, rand), up: rand() < 0.4 });
    }
  }
}

/** An entry's flanking block, in courses, with what stands on it left to each ground. */
function entryBlock(b: Build, p: Pillar, s: Masonry, h: number, rand: () => number): void {
  const t = tilesOf(p);
  b.box(t.x0, t.z0, t.x1, t.z1, 0, h, s.dark, mul(s.dark, 0.7), s.top);
  const right = t.x0 < AW / 2;
  if (right) b.courses('e', t.z0, t.z1, t.x1, 0.12, h - 0.1, 0.34, 0.9, s.blocks, s.joint, rand);
  else b.courses('w', t.z0, t.z1, t.x0, 0.12, h - 0.1, 0.34, 0.9, s.blocks, s.joint, rand);
  b.courses('s', t.x0, t.x1, t.z1, 0.12, h - 0.1, 0.34, 0.9, s.blocks, s.joint, rand);
  // a coping that stands proud of it
  b.box(t.x0 - 0.05, t.z0 - 0.05, t.x1 + 0.05, t.z1 + 0.05, h - 0.1, h, s.edge, s.dark, s.top);
}

/** The way in at the back of an entry: a dark passage in the end wall, framed, with its team's color over it. */
function entryDoors(b: Build, s: Masonry, blue: C, red: C, top = 1.42): void {
  const z0 = ENTRY_Y0 / TILE;
  const z1 = ENTRY_Y1 / TILE;
  const inset = 0.42;
  for (const left of [true, false]) {
    const x = left ? 0 : AW;
    const dir = left ? 1 : -1;
    const face = (a0: number, a1: number, off: number, y0: number, y1: number, c0: C, c1: C = c0): void => {
      if (left) b.faceE(a0, a1, x + off, y0, y1, c0, c1);
      else b.faceW(a0, a1, x - off, y0, y1, c0, c1);
    };
    // the passage going back into the dark
    face(z0 + inset, z1 - inset, 0.02, 0, top - 0.24, rgb('#08050a'), rgb('#1a1216'));
    // its frame
    b.box(x + dir * 0 - (left ? 0 : 0.12), z0 + inset - 0.2, x + (left ? 0.12 : 0), z0 + inset, 0, top, s.edge, s.dark, s.top);
    b.box(x + dir * 0 - (left ? 0 : 0.12), z1 - inset, x + (left ? 0.12 : 0), z1 - inset + 0.2, 0, top, s.edge, s.dark, s.top);
    b.box(x + dir * 0 - (left ? 0 : 0.16), z0 + inset - 0.26, x + (left ? 0.16 : 0), z1 - inset + 0.26, top - 0.24, top + 0.08, s.top, s.edge, s.top);
    // the bars, drawn up, and its side's shield over the door
    for (let i = 0; i < 6; i++) {
      const z = z0 + inset + ((i + 0.5) / 6) * (z1 - z0 - inset * 2);
      face(z - 0.025, z + 0.025, 0.05, top - 0.72, top - 0.24, rgb('#3c3c46'), rgb('#6a6a78'));
    }
    const zm = (z0 + z1) / 2;
    const c = left ? blue : red;
    face(zm - 0.26, zm + 0.26, 0.17, top - 0.22, top + 0.06, c);
  }
}

/** The team's flag, its colors on the wall, and a little fire to wait by. */
function entryColors(b: Build, air: RingAir, p: Pillar, cloth: C, wood: C, device: C): void {
  const t = tilesOf(p);
  const left = t.x0 < AW / 2;
  const mx = (t.x0 + t.x1) / 2;
  const north = t.z0 < AH / 2;
  const edge = left ? t.x1 : t.x0;
  // the banner, on the wall that looks at the ground
  const zm = (t.z0 + t.z1) / 2;
  const cy1 = 1.0;
  const cy0 = 0.12;
  const hw = 0.42;
  const dir = left ? 1 : -1;
  if (left) {
    b.faceE(zm - hw, zm + hw, edge + 0.03, cy0, cy1, mul(cloth, 0.8), cloth);
    b.faceE(zm - 0.14, zm + 0.14, edge + 0.04, 0.42, 0.72, device);
  } else {
    b.faceW(zm - hw, zm + hw, edge - 0.03, cy0, cy1, mul(cloth, 0.8), cloth);
    b.faceW(zm - 0.14, zm + 0.14, edge - 0.04, 0.42, 0.72, device);
  }
  // a runner of its color along the top, and its flag at the corner by the gate
  b.flat(mx - 0.26, t.z0 + 0.14, mx + 0.26, t.z1 - 0.14, 1.11, rgb('#e8c15a'));
  b.flat(mx - 0.22, t.z0 + 0.14, mx + 0.22, t.z1 - 0.14, 1.115, mul(cloth, 0.86));
  const fx = edge - dir * 0.24;
  const fz = north ? t.z1 - 0.26 : t.z0 + 0.26;
  b.flag(fx, fz, 1.1, 1.5, cloth, wood, (left ? 1 : -1) as 1 | -1);
  // a brazier at the corner away from the gate
  const bz = north ? t.z0 + 0.42 : t.z1 - 0.42;
  b.brazier(edge - dir * 0.3, bz, 1.1, 1);
  air.flames.push({ x: (edge - dir * 0.3) * TILE, y: bz * TILE, h: 1.52 * TILE, size: 0.75 });
}

/* ------------------------------------------------------------------ the proving sands */

function provingSands(b: Build, place: Placer, people: Watcher[], air: RingAir, map: RingMap): void {
  const rand = seeded(11);
  const stone = rgb('#c9ab7f');
  const s: Masonry = {
    blocks: [rgb('#cdb086'), rgb('#c2a478'), rgb('#d6bb90'), rgb('#bb9d70'), rgb('#c8aa7d')],
    joint: rgb('#6a4f35'),
    top: rgb('#e5cda4'),
    edge: rgb('#d8bf95'),
    dark: rgb('#7c6246'),
  };
  const wood = rgb('#6d4a2d');
  const gold = rgb('#e8b94a');
  const blue = rgb('#3f7fe0');
  const red = rgb('#d8443e');
  const purple = rgb('#6b3a8e');
  northWall(b, s, rand);
  sideWalls(b, s, rand);
  southWalk(b, s, [rgb('#c8ad85'), rgb('#bea27a'), rgb('#d2b891'), rgb('#b59a72')], rand);

  const box = { x0: AW / 2 - 2.5, x1: AW / 2 + 2.5 };
  const folk: Folk = {
    shirts: ['#c94f3a', '#e8c15a', '#f0e4c8', '#3f8fa8', '#8e5aa8', '#d97b35', '#5a9a5a', '#e08aa0', '#4a6fb5', '#b5482f'].map(rgb),
    heads: ['#e0b48a', '#c98f62', '#8f5e3c', '#f0e4c8', '#d9a57a', '#b57a50', '#e8c15a', '#7a4a30'].map(rgb),
  };
  stands(b, people, { side: rgb('#a58a63'), foot: rgb('#6f5639'), top: rgb('#d8bf94'), aisle: rgb('#ecd9b4'), bench: rgb('#b99a6c') }, folk, rand, (x, z) => x > box.x0 - 0.2 && x < box.x1 + 0.2 && z < 0 && z > -2.3);
  southFolk(people, folk, rand, () => false);

  // pilasters along the north wall, a banner of each side between them and a fire on every other one
  const NUM = 7;
  for (let i = 0; i <= NUM; i++) {
    const x = (i / NUM) * AW;
    b.box(x - 0.24, 0, x + 0.24, 0.13, 0.18, NORTH - 0.14, s.edge, s.joint, s.top);
    b.box(x - 0.31, 0, x + 0.31, 0.17, NORTH - 0.42, NORTH - 0.14, s.top, s.edge, s.top);
    b.box(x - 0.3, 0, x + 0.3, 0.17, 0.05, 0.28, s.edge, s.dark, s.top);
    if (i % 2 === 1) {
      place.put('torch_mounted', x, 0.14, 0.66, 0.62);
      air.flames.push({ x: x * TILE, y: 0.26 * TILE, h: 1.24 * TILE, size: 0.5 });
    }
  }
  for (let i = 0; i < NUM; i++) {
    const cx = ((i + 0.5) / NUM) * AW;
    const mid = i === 3;
    if (mid) continue;
    // a recess behind each, so the wall has some depth to it
    b.faceS(cx - 0.72, cx + 0.72, 0.02, 0.3, NORTH - 0.32, s.joint, mul(s.joint, 0.85));
    b.banner(cx, 0.05, NORTH - 0.26, 0.82, 1.06, i < 3 ? blue : red, gold, rgb('#fff3cf'));
  }
  // the lord's box, over the middle of the wall, under its own roof
  const X0 = box.x0;
  const X1 = box.x1;
  const purpleDim = mul(purple, 0.72);
  b.box(X0, -2.2, X1, 0.32, 0, NORTH + 0.2, s.edge, s.dark, s.top);
  b.flags(X0 + 0.1, -2.1, X1 - 0.1, 0.22, NORTH + 0.21, 0.7, 0.5, [rgb('#7b4a9a'), rgb('#6b3a8e')], rgb('#3f2452'), rand);
  b.courses('s', X0, X1, 0.32, 0.18, NORTH + 0.08, 0.4, 1, s.blocks, s.joint, rand);
  b.box(X0 - 0.06, 0.1, X1 + 0.06, 0.42, NORTH + 0.08, NORTH + 0.26, s.top, s.edge, s.top);
  b.banner(AW / 2, 0.34, NORTH + 0.04, 1.2, 1.3, purple, gold, gold);
  b.banner(AW / 2 - 1.6, 0.34, NORTH + 0.04, 0.6, 0.92, gold, purple, purple);
  b.banner(AW / 2 + 1.6, 0.34, NORTH + 0.04, 0.6, 0.92, gold, purple, purple);
  for (const [x, z] of [[X0 + 0.2, 0.16], [X1 - 0.2, 0.16], [X0 + 0.2, -1.95], [X1 - 0.2, -1.95]] as const) {
    b.post(x, z, 0.12, 0.09, NORTH + 0.2, NORTH + 2.1, 8, s.edge, s.top);
    b.post(x, z, 0.17, 0.12, NORTH + 2.04, NORTH + 2.18, 8, gold, gold);
  }
  // its roof: two slopes of striped cloth
  const ridge = NORTH + 2.92;
  const eave = NORTH + 2.16;
  const zF = 0.34;
  const zB = -2.15;
  const zM = (zF + zB) / 2;
  const n = 10;
  for (let i = 0; i < n; i++) {
    const a = X0 - 0.3 + ((X1 - X0 + 0.6) * i) / n;
    const c = X0 - 0.3 + ((X1 - X0 + 0.6) * (i + 1)) / n;
    const col = i % 2 ? gold : purple;
    b.m.quad([a, eave, zF], [c, eave, zF], [c, ridge, zM], [a, ridge, zM], [0, 0.8, 0.6], col, mul(col, 1.1));
    b.m.quad([c, eave, zB], [a, eave, zB], [a, ridge, zM], [c, ridge, zM], [0, 0.8, -0.6], mul(col, 0.8), col);
    // a scalloped hem
    b.m.quad([a, eave - 0.2, zF + 0.01], [c, eave - 0.2, zF + 0.01], [c, eave, zF + 0.01], [a, eave, zF + 0.01], [0, 0, 1], mul(col, 0.74), mul(col, 0.9));
  }
  b.faceE(zB, zF, X1 + 0.3, eave - 0.2, eave, purpleDim);
  b.faceW(zB, zF, X0 - 0.3, eave - 0.2, eave, purpleDim);
  // who it's for
  const royal = (x: number, z: number, shirt: C, up = false): void => {
    people.push({ x, y: NORTH + 0.2, z, k: 1.16, rot: 0, shirt, head: rgb('#e0b48a'), up });
  };
  royal(AW / 2, -0.52, gold);
  royal(AW / 2 - 0.8, -0.3, rgb('#f0e4c8'), true);
  royal(AW / 2 + 0.8, -0.3, rgb('#b5482f'));
  royal(AW / 2 - 1.5, -0.75, purple);
  royal(AW / 2 + 1.5, -0.75, purple);
  b.box(AW / 2 - 0.34, -1.36, AW / 2 + 0.34, -0.72, NORTH + 0.2, NORTH + 1.3, gold, mul(gold, 0.6), mul(gold, 1.1));

  // masts with long pennants along the top rows
  const backZ = -0.34 - 5 * STEP_D;
  for (let x = -6; x < AW + 7; x += 3.1) {
    if (x > X0 - 0.5 && x < X1 + 0.5) continue;
    b.flag(x, backZ - 0.1, NORTH + 5 * STEP_H + 0.5, 2.6, x < AW / 2 ? blue : red, wood, 1);
  }

  entryDoors(b, s, blue, red);
  // the blocks either side of the gates: a place for each side to wait
  for (const p of map.pillars) {
    if (!p.wall) continue;
    entryBlock(b, p, s, 1.1, rand);
    const left = p.x < AW * 13;
    entryColors(b, air, p, left ? blue : red, wood, rgb('#fff3cf'));
    const t = tilesOf(p);
    const edge = left ? t.x1 : t.x0;
    const dir = left ? 1 : -1;
    b.merlons(edge - dir * 0.14, t.z0, edge + dir * 0.0, t.z1, 1.1, 0.22, 0.3, s.top, s.edge, s.top);
    // spears in a rack, amphorae and a crate of what they'll need
    const north = t.z0 < AH / 2;
    const z = north ? (t.z0 + t.z1) / 2 : (t.z0 + t.z1) / 2 + 0.3;
    const far = left ? t.x0 + 0.42 : t.x1 - 0.42;
    place.put('p_weaponrack', far, z - 0.7, 1.1, 0.72, { rot: left ? Math.PI / 2 : -Math.PI / 2 });
    place.put('barrel_small', far + 0.02, z + 0.5, 1.1, 0.46);
    place.put('p_crate_A_big', far + dir * 0.06, z + 0.98, 1.1, 0.42);
  }

  // the four old pillars, carved, each with its fire and its cloth
  map.pillars.filter((p) => !p.wall).forEach((p, i) => {
    const t = tilesOf(p);
    const top = 2.3;
    b.box(t.x0 - 0.13, t.z0 - 0.13, t.x1 + 0.13, t.z1 + 0.13, 0, 0.14, s.dark, mul(s.dark, 0.7), s.edge);
    b.box(t.x0 - 0.06, t.z0 - 0.06, t.x1 + 0.06, t.z1 + 0.06, 0.14, 0.34, s.edge, s.dark, s.top);
    b.box(t.x0, t.z0, t.x1, t.z1, 0.34, top - 0.34, stone, mul(stone, 0.72), s.top);
    b.courses('s', t.x0, t.x1, t.z1, 0.34, top - 0.34, 0.42, 0.62, s.blocks, s.joint, rand);
    b.courses('e', t.z0, t.z1, t.x1, 0.34, top - 0.34, 0.42, 0.62, s.blocks, s.joint, rand);
    b.courses('w', t.z0, t.z1, t.x0, 0.34, top - 0.34, 0.42, 0.62, s.blocks, s.joint, rand);
    // a band of old red stone, with a row of signs cut in it
    b.box(t.x0 - 0.025, t.z0 - 0.025, t.x1 + 0.025, t.z1 + 0.025, 1.08, 1.34, rgb('#a5684a'), rgb('#7d4f35'), rgb('#a5684a'));
    const w = (t.x1 - t.x0) / 5;
    for (let k = 0; k < 4; k++) b.faceS(t.x0 + w * (k + 0.6), t.x0 + w * (k + 1.1), t.z1 + 0.03, 1.14, 1.28, rgb('#f0c87a'));
    // capital
    b.box(t.x0 - 0.05, t.z0 - 0.05, t.x1 + 0.05, t.z1 + 0.05, top - 0.34, top - 0.2, s.edge, s.dark, s.top);
    b.box(t.x0 - 0.14, t.z0 - 0.14, t.x1 + 0.14, t.z1 + 0.14, top - 0.2, top, s.top, s.edge, s.top);
    // a fire on top, in a bowl
    const cx = (t.x0 + t.x1) / 2;
    const cz = (t.z0 + t.z1) / 2;
    b.post(cx, cz, 0.22, 0.42, top, top + 0.26, 8, rgb('#4a3626'), rgb('#6d4a2d'));
    b.flat(cx - 0.3, cz - 0.3, cx + 0.3, cz + 0.3, top + 0.25, rgb('#2a1408'));
    air.flames.push({ x: cx * TILE, y: cz * TILE, h: (top + 0.26) * TILE, size: 1.05 });
    // and a cloth down its south face, one each way
    b.banner(cx, t.z1 + 0.05, top - 0.42, 0.6, 0.72, i % 2 ? red : blue, gold, rgb('#fff3cf'));
  });

  // old bones and lost arms at the wall's foot: small enough to walk over
  const bits: [string, number, number, number, number][] = [
    ['skull', 3.1, 0.52, 0.24, 0.8],
    ['bone_A', 3.7, 0.62, 0.1, 2.2],
    ['ribcage', 15.2, 0.58, 0.26, 0.5],
    ['bone_A', 14.3, 0.74, 0.1, 0.4],
    ['skull', 6.5, 9.12, 0.24, 3.4],
    ['bone_A', 16.7, 9.2, 0.1, 1.2],
    ['bone_A', 12.2, 0.42, 0.1, 2.9],
  ];
  for (const [id, x, z, h, rot] of bits) place.put(id, x, z, 0, h, { rot, tint: rgb('#efe2c4') });
}

/* ------------------------------------------------------------------ the frozen mere */

/** A wall of ice: a block true to its footprint, broken along the top into great shards of itself. */
function iceWall(b: Build, air: RingAir, p: Pillar, rand: () => number): void {
  const t = tilesOf(p);
  const deep = rgb('#4f93c8');
  const mid = rgb('#7fc2e8');
  const pale = rgb('#d6f2ff');
  const white = rgb('#ffffff');
  const w = t.x1 - t.x0;
  const d = t.z1 - t.z0;
  const along = d > w;
  const len = Math.max(w, d);
  const across = Math.min(w, d);
  const ax = (k: number, off: number): [number, number] => (along ? [(t.x0 + t.x1) / 2 + off, t.z0 + k * d] : [t.x0 + k * w, (t.z0 + t.z1) / 2 + off]);
  b.box(t.x0, t.z0, t.x1, t.z1, 0, 0.7, mid, deep, pale);
  // a course of cut faces round the foot
  const facets = Math.ceil((w + d) / 0.3);
  for (let i = 0; i < facets; i++) {
    const k = i / facets;
    const x0 = t.x0 + k * w;
    const x1 = x0 + w / facets;
    b.faceS(x0 + 0.01, x1 - 0.01, t.z1 + 0.01, 0.04, 0.3 + rand() * 0.34, mul(deep, 1.1), mul(mid, 1.1));
    const z0 = t.z0 + k * d;
    const z1 = z0 + d / facets;
    b.faceE(z0 + 0.01, z1 - 0.01, t.x1 + 0.01, 0.04, 0.3 + rand() * 0.34, deep, mid);
    b.faceW(z0 + 0.01, z1 - 0.01, t.x0 - 0.01, 0.04, 0.3 + rand() * 0.34, deep, mid);
  }
  // great shards shouldering up out of it, two rows of them
  const n = Math.max(2, Math.round(len / 0.5));
  for (let i = 0; i < n; i++) {
    const k = (i + 0.5) / n;
    for (const row of [-1, 1]) {
      const off = row * across * (0.14 + rand() * 0.1);
      const [cx, cz] = ax(k + (rand() - 0.5) * 0.08, off);
      const r = across * (0.34 + rand() * 0.12);
      const h = 1.5 + rand() * 1.15;
      const lean = (rand() - 0.5) * 0.24;
      b.post(cx, cz, r, r * 0.24, 0.5, h, 5, mul(mid, 0.82), pale, along ? lean : lean * 0.5, along ? lean * 0.5 : lean, rand() * 6.3);
      b.post(cx + (along ? lean : lean * 0.5), cz + (along ? lean * 0.5 : lean), r * 0.24, 0, h, h + 0.2 + rand() * 0.3, 5, pale, white);
      if (row > 0) air.glints.push({ x: cx * TILE, y: cz * TILE, h: h * TILE });
    }
  }
  // snow lying against its south foot
  for (let x = t.x0 + 0.06; x < t.x1; x += 0.2) b.post(x, t.z1 - 0.02, 0.11, 0.05, 0, 0.12 + rand() * 0.07, 5, white, white);
}

/** The boulder in the middle: one broad broken lump of dark rock, the ice climbing it and the snow lying on it. */
function iceBoulder(b: Build, p: Pillar, rand: () => number): void {
  const t = tilesOf(p);
  const cx = (t.x0 + t.x1) / 2;
  const cz = (t.z0 + t.z1) / 2;
  const white = rgb('#ffffff');
  const mid = rgb('#7fc2e8');
  const rock = rgb('#5f7288');
  const rockHi = rgb('#8ea3b9');
  const rockD = rgb('#435266');
  const rx = (t.x1 - t.x0) / 2;
  const rz = (t.z1 - t.z0) / 2;
  b.box(t.x0, t.z0, t.x1, t.z1, 0, 0.42, mid, rgb('#4f93c8'), rgb('#d6f2ff'));
  // the rock, wider than it is tall, in slabs that don't quite line up
  const r = Math.min(rx, rz) * 1.02;
  b.post(cx, cz, r, r * 0.94, 0.3, 1.0, 7, rockD, rock, 0.03, -0.02, 0.2);
  b.post(cx + 0.03, cz - 0.02, r * 0.94, r * 0.66, 1.0, 1.52, 7, rock, rockHi, -0.05, 0.03, 0.7);
  b.post(cx - 0.02, cz + 0.01, r * 0.66, r * 0.3, 1.52, 1.78, 7, rockHi, rockHi, 0.02, 0, 1.2);
  // a cap of snow that slumps down the side it blew from
  b.post(cx - 0.02, cz + 0.01, r * 0.56, r * 0.14, 1.6, 1.88, 7, white, white, 0.02, 0, 1.2);
  b.post(cx - r * 0.42, cz + r * 0.1, r * 0.42, r * 0.1, 1.16, 1.5, 6, white, white, 0.05, 0, 0.3);
  // the ice that has climbed it, on the corners of the block
  for (const [dx, dz] of [[-0.82, 0.86], [0.84, 0.82], [0.8, -0.78], [-0.84, -0.8]] as const) {
    const x = cx + dx * rx;
    const z = cz + dz * rz;
    b.post(x, z, 0.16 + rand() * 0.06, 0.0, 0.34, 0.86 + rand() * 0.44, 4, mid, white, 0, 0, rand() * 6);
  }
}

function frozenMere(b: Build, place: Placer, people: Watcher[], air: RingAir, map: RingMap): void {
  const rand = seeded(23);
  const white = rgb('#ffffff');
  const snow = rgb('#f2faff');
  const s: Masonry = {
    blocks: [rgb('#a9d4ec'), rgb('#98c8e6'), rgb('#bcdff2'), rgb('#8fc0e0'), rgb('#b2d9ef')],
    joint: rgb('#4d82ad'),
    top: snow,
    edge: rgb('#d8eefa'),
    dark: rgb('#5a8fb8'),
  };
  const wood = rgb('#5e4331');
  const blue = rgb('#3f7fe0');
  const red = rgb('#d8443e');
  const fur = rgb('#e9e2d2');
  northWall(b, s, rand);
  sideWalls(b, s, rand);
  southWalk(b, s, [rgb('#f4fbff'), rgb('#e6f3fb'), rgb('#ffffff'), rgb('#dcecf6')], rand);

  const shipX0 = 2.4;
  const shipX1 = 7.4;
  const fallX0 = AW / 2 - 2.6;
  const fallX1 = AW / 2 + 2.6;
  const folk: Folk = {
    shirts: ['#7a4f33', '#5a6f8a', '#8e3f35', '#3f6a5a', '#b08a58', '#46505e', '#a85a3a', '#6b4a7a', '#d8d0c0', '#34506e'].map(rgb),
    heads: ['#e8ddc8', '#f4efe2', '#8a6a4a', '#5e4331', '#e0b48a', '#c98f62', '#bfc8d2', '#a06a48'].map(rgb),
  };
  stands(b, people, { side: rgb('#a6c8df'), foot: rgb('#6c9abf'), top: snow, aisle: rgb('#d7e9f5'), bench: rgb('#8a6a4c') }, folk, rand, (x, z) => (x > shipX0 && x < shipX1 && z > -3.6 && z < 0) || (x > fallX0 && x < fallX1 && z < 0));
  southFolk(people, folk, rand, () => false);

  // snow lying along the top of the wall, in lumps, and icicles hanging off it
  for (let x = -3; x < AW + 3; x += 0.58) {
    const w = 0.26 + rand() * 0.2;
    b.post(x, 0.02, w, w * 0.4, NORTH - 0.04, NORTH + 0.1 + rand() * 0.07, 5, snow, white);
    const icicles = 1 + Math.floor(rand() * 3);
    for (let i = 0; i < icicles; i++) {
      const ix = x + (rand() - 0.5) * 0.5;
      const len = 0.22 + rand() * 0.5;
      b.post(ix, 0.1, 0.0, 0.05, NORTH - 0.14 - len, NORTH - 0.14, 4, white, rgb('#bfe6f8'));
    }
  }
  // the falls in the middle of the wall, stopped as they came down
  for (let x = fallX0; x <= fallX1; x += 0.34) {
    const k = 1 - Math.abs((x - AW / 2) / 2.6);
    const h = 2.0 + k * 2.9 + rand() * 0.7;
    const r = 0.2 + rand() * 0.18;
    const z = 0.05 + rand() * 0.06;
    b.post(x, z, r * 1.25, r * 0.8, 0, h, 6, rgb('#7fc0e6'), rgb('#e6f7ff'), 0, -0.16, rand());
    air.glints.push({ x: x * TILE, y: z * TILE, h: (0.5 + rand() * (h - 0.6)) * TILE });
  }
  // (its overhang, where the water was coming over)
  for (let x = fallX0 - 0.3; x <= fallX1 + 0.3; x += 0.42) {
    const k = 1 - Math.abs((x - AW / 2) / 3);
    const h = 2.4 + k * 3.4;
    b.post(x, -0.55, 0.48, 0.2, 0, h, 6, s.edge, white, 0, -0.1, rand());
  }

  // a ship the winter caught, up on the bank: its hull, its mast and what's left of its sail
  const shipY = NORTH + 0.1;
  const hull = rgb('#5e4331');
  const hullD = rgb('#3d2a1f');
  const shipZ = -1.75;
  const n = 10;
  for (let i = 0; i < n; i++) {
    const a = i / n;
    const c = (i + 1) / n;
    const X = (k: number): number => shipX0 + 0.2 + k * (shipX1 - shipX0 - 0.4);
    const W = (k: number): number => 1.02 * Math.sin(Math.PI * Math.min(1, 0.08 + k * 0.84));
    const Y = (k: number): number => shipY + 0.86 + Math.pow(Math.abs(k - 0.5) * 2, 2.6) * 1.0;
    const col = i % 2 ? hull : mul(hull, 0.88);
    // its side toward us, and the deck in it
    b.m.quad([X(a), shipY, shipZ + W(a) * 0.7], [X(c), shipY, shipZ + W(c) * 0.7], [X(c), Y(c), shipZ + W(c)], [X(a), Y(a), shipZ + W(a)], [0, 0.3, 0.95], hullD, col);
    b.m.quad([X(a), shipY + 0.56, shipZ + W(a) * 0.9], [X(c), shipY + 0.56, shipZ + W(c) * 0.9], [X(c), shipY + 0.56, shipZ - W(c) * 0.9], [X(a), shipY + 0.56, shipZ - W(a) * 0.9], [0, 1, 0], snow);
    b.m.quad([X(c), shipY + 0.56, shipZ - W(c) * 0.8], [X(a), shipY + 0.56, shipZ - W(a) * 0.8], [X(a), Y(a), shipZ - W(a) * 0.86], [X(c), Y(c), shipZ - W(c) * 0.86], [0, 0.3, 0.95], rgb('#7a5a42'));
    // a white strake, and snow along the gunwale
    b.m.quad([X(a), Y(a) - 0.1, shipZ + W(a) + 0.01], [X(c), Y(c) - 0.1, shipZ + W(c) + 0.01], [X(c), Y(c), shipZ + W(c) + 0.01], [X(a), Y(a), shipZ + W(a) + 0.01], [0, 0, 1], snow);
  }
  // shields hung along its side
  for (let i = 1; i < 7; i++) {
    const k = i / 7;
    const x = shipX0 + 0.2 + k * (shipX1 - shipX0 - 0.4);
    const z = shipZ + 1.02 * Math.sin(Math.PI * (0.08 + k * 0.84)) + 0.03;
    const col = i % 2 ? red : rgb('#e8c15a');
    const y = shipY + 0.62;
    for (let t = 0; t < 8; t++) {
      const a0 = (t / 8) * Math.PI * 2;
      const a1 = ((t + 1) / 8) * Math.PI * 2;
      b.m.quad([x, y, z], [x + Math.cos(a0) * 0.2, y + Math.sin(a0) * 0.2, z], [x + Math.cos(a1) * 0.2, y + Math.sin(a1) * 0.2, z], [x + Math.cos(a1) * 0.2, y + Math.sin(a1) * 0.2, z], [0, 0, 1], t % 2 ? col : mul(col, 0.75));
    }
  }
  const mastX = (shipX0 + shipX1) / 2;
  b.post(mastX, shipZ, 0.1, 0.07, shipY + 0.5, shipY + 4, 6, hullD, hull);
  b.box(mastX - 1.5, shipZ - 0.04, mastX + 1.5, shipZ + 0.04, shipY + 3.5, shipY + 3.6, hull, hullD, snow);
  // the rags of the sail
  for (let i = 0; i < 6; i++) {
    const x0 = mastX - 1.4 + i * 0.47;
    const x1 = x0 + 0.42;
    const len = 0.7 + rand() * 1.2;
    const c = i % 2 ? rgb('#c9543f') : rgb('#e8ddc8');
    b.m.quad([x0 + 0.04, shipY + 3.5 - len, shipZ + 0.1], [x1 - 0.04, shipY + 3.5 - len * (0.7 + rand() * 0.3), shipZ + 0.1], [x1, shipY + 3.5, shipZ + 0.05], [x0, shipY + 3.5, shipZ + 0.05], [0, 0, 1], mul(c, 0.8), c);
  }

  // pines along the top of the bank, thick with snow, and rock coming through
  for (let i = 0; i < 26; i++) {
    const x = -10 + i * 1.65 + rand() * 0.9;
    if (x > fallX0 - 1 && x < fallX1 + 1) continue;
    const z = -0.34 - 5 * STEP_D - 0.5 - rand() * 1.2;
    const y = NORTH + 5 * STEP_H + 0.5;
    const h = 2.8 + rand() * 1.8;
    place.put(rand() < 0.5 ? 'tree_pineDefaultA' : 'tree_pineRoundA', x, z, y, h, { tint: rgb('#d2e8e2'), sway: 0.5 });
  }

  entryDoors(b, s, blue, red);
  // the blocks either side of the gates: snowed over, with the side's own camp on top
  for (const p of map.pillars) {
    if (!p.wall) continue;
    entryBlock(b, p, s, 1.1, rand);
    const t = tilesOf(p);
    const left = p.x < AW * 13;
    entryColors(b, air, p, left ? blue : red, wood, fur);
    const edge = left ? t.x1 : t.x0;
    const dir = left ? 1 : -1;
    // the snow on it, in lumps, spilling over the edge
    const zc = (t.z0 + t.z1) / 2;
    for (let z = t.z0 + 0.14; z < t.z1 - 0.1; z += 0.34) {
      const r = 0.16 + rand() * 0.12;
      b.post(edge - dir * 0.08, z, r, r * 0.3, 1.04, 1.2 + rand() * 0.1, 5, white, white);
      const len = 0.16 + rand() * 0.4;
      b.post(edge + dir * 0.07, z + 0.1, 0.0, 0.05, 1.0 - len, 1.0, 4, white, rgb('#bfe6f8'));
    }
    const far = left ? t.x0 + 0.6 : t.x1 - 0.6;
    const zf = zc + (t.z0 < AH / 2 ? -0.1 : 0.3);
    // a lean-to of hides on poles, and split logs for the fire
    const hide = rgb('#8a6a4c');
    const lo = far - dir * 0.3;
    const hi = far + dir * 0.28;
    b.m.quad([lo, 1.14, zf + 0.5], [hi, 1.88, zf + 0.5], [hi, 1.88, zf - 0.5], [lo, 1.14, zf - 0.5], left ? [-0.6, 0.8, 0] : [0.6, 0.8, 0], snow, white);
    b.m.quad([hi, 1.88, zf + 0.5], [lo, 1.14, zf + 0.5], [lo, 1.14, zf - 0.5], [hi, 1.88, zf - 0.5], left ? [0.6, -0.8, 0] : [-0.6, -0.8, 0], hide);
    for (const z of [zf - 0.46, zf + 0.46]) {
      b.post(hi, z, 0.035, 0.03, 1.1, 1.9, 4, wood, wood);
      b.faceS(lo, hi, z + 0.01, 1.12, 1.15, wood);
    }
    for (let i = 0; i < 5; i++) {
      const row = i < 3 ? 0 : 1;
      const lx = far - 0.2 + (row ? 0.11 : 0) + (i % 3) * 0.2;
      b.post(lx, zf + 0.92, 0.1, 0.1, 1.1 + row * 0.18, 1.1 + row * 0.18 + 0.02, 6, wood, wood);
      b.box(lx - 0.09, zf + 0.72, lx + 0.09, zf + 1.12, 1.1 + row * 0.17, 1.27 + row * 0.17, mul(wood, 1.2), wood, i % 2 ? snow : mul(wood, 1.3));
    }
  }
  map.pillars
    .filter((p) => !p.wall)
    .forEach((p) => {
      if (p.w < 28 && p.h < 40 && p.w > 24) iceBoulder(b, p, rand);
      else iceWall(b, air, p, rand);
    });
  // what the ice has kept at the edges: nothing a boot would notice
  const bits: [string, number, number, number, number, C?][] = [
    ['skull', 5.2, 0.5, 0.24, 2.2, rgb('#e4f2fa')],
    ['bone_A', 18.2, 0.46, 0.1, 0.6, rgb('#e4f2fa')],
    ['Rock_1_A', 9.1, 9.2, 0.22, 0, rgb('#c4dcec')],
    ['Rock_2_B', 13.4, 9.2, 0.22, 1, rgb('#c4dcec')],
    ['Rock_1_A', 2.4, 9.26, 0.22, 2, rgb('#c4dcec')],
  ];
  for (const [id, x, z, h, rot, tint] of bits) place.put(id, x, z, 0, h, { rot, tint });
}

/* ------------------------------------------------------------------ the cinder forge */

/** What's hot enough to light itself: a flat ribbon that flows, going down a wall. */
const flowMaterial = new THREE.ShaderMaterial({
  uniforms: { uTime: LIGHT.uTime },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform float uTime;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
    }
    void main() {
      vec2 p = vec2(vUv.x * 3.0, vUv.y * 1.1 + uTime * 0.85);
      float n = noise(p * 2.2) * 0.6 + noise(p * 5.0 + 4.0) * 0.4;
      float edge = abs(vUv.x - 0.5) * 2.0;
      float hot = smoothstep(0.32, 0.72, n) * (1.0 - edge * 0.7);
      vec3 c = mix(vec3(0.72, 0.13, 0.02), vec3(1.0, 0.56, 0.1), smoothstep(0.1, 0.5, hot));
      c = mix(c, vec3(1.0, 0.92, 0.55), smoothstep(0.52, 0.85, hot));
      gl_FragColor = vec4(c, 1.0);
    }`,
});

function flows(list: [number, number, number, number, number][], parent: THREE.Object3D): THREE.Mesh {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (const [x0, x1, z, y0, y1] of list) {
    const v = pos.length / 3;
    pos.push(x0, y0, z, x1, y0, z, x1, y1, z, x0, y1, z);
    const tall = (y1 - y0) * 0.55;
    uv.push(0, tall, 1, tall, 1, 0, 0, 0);
    idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  const mesh = new THREE.Mesh(g, flowMaterial);
  mesh.frustumCulled = false;
  parent.add(mesh);
  return mesh;
}

/** A toothed wheel looking south, to be turned by a Stand. */
function gearMesh(): MeshData {
  const b = new Build();
  const iron = rgb('#7a7a88');
  const dim = rgb('#4c4c58');
  const brass = rgb('#d8a84a');
  const n = 12;
  const R = 1;
  const r = 0.8;
  const ring = 0.56;
  const nz = [0, 0, 1];
  const m = b.m;
  const P = (a: number, rad: number, z = 0): number[] => [Math.cos(a) * rad, Math.sin(a) * rad, z];
  const seg = 24;
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2;
    const a1 = ((i + 1) / seg) * Math.PI * 2;
    m.quad(P(a0, ring, 0.1), P(a0, r, 0.1), P(a1, r, 0.1), P(a1, ring, 0.1), nz, iron, mul(iron, 1.15));
  }
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const w = (Math.PI / n) * 0.5;
    m.quad(P(a - w, r, 0.1), P(a - w * 0.7, R, 0.1), P(a + w * 0.7, R, 0.1), P(a + w, r, 0.1), nz, dim, iron);
  }
  // spokes and a brass boss
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const w = 0.08;
    m.quad([-s * w, c * w, 0.09], [c * ring - s * w, s * ring + c * w, 0.09], [c * ring + s * w, s * ring - c * w, 0.09], [s * w, -c * w, 0.09], nz, mul(iron, 0.9));
  }
  for (let i = 0; i < 10; i++) {
    const a0 = (i / 10) * Math.PI * 2;
    const a1 = ((i + 1) / 10) * Math.PI * 2;
    m.quad([0, 0, 0.13], P(a0, 0.17, 0.13), P(a1, 0.17, 0.13), P(a1, 0.17, 0.13), nz, brass);
  }
  return m.data();
}

export interface RingGear {
  x: number;
  y: number;
  z: number;
  r: number;
  speed: number;
}

/** The great anvil, on its stepped plinth, inside the pillar's footprint up to well over a fighter's head. */
function greatAnvil(b: Build, air: RingAir, p: Pillar): void {
  const t = tilesOf(p);
  const stone = rgb('#5a4a4a');
  const stoneD = rgb('#2e2124');
  const top = rgb('#7d6660');
  const iron = rgb('#4a4a55');
  const ironHi = rgb('#7c7c8c');
  const ironD = rgb('#26262e');
  const brass = rgb('#b98a3a');
  const cx = (t.x0 + t.x1) / 2;
  const cz = (t.z0 + t.z1) / 2;
  // the steps
  b.box(t.x0, t.z0, t.x1, t.z1, 0, 0.3, stone, stoneD, top);
  b.box(t.x0 + 0.12, t.z0 + 0.12, t.x1 - 0.12, t.z1 - 0.12, 0.3, 0.6, stone, stoneD, top);
  // bound in iron at the corners
  for (const [x, z] of [[t.x0, t.z1], [t.x1, t.z1]] as const) b.box(x - 0.05, z - 0.14, x + 0.05, z + 0.02, 0, 0.32, iron, ironD, ironHi);
  for (let i = 0; i < 5; i++) {
    const x = t.x0 + 0.2 + (i / 4) * (t.x1 - t.x0 - 0.4);
    b.post(x, t.z1 + 0.01, 0.03, 0.03, 0.14, 0.16, 5, brass, brass);
  }
  // the anvil's foot, waist and face
  const w = 0.82;
  const d = 0.62;
  b.box(cx - w, cz - d, cx + w, cz + d, 0.6, 0.86, iron, ironD, ironHi);
  b.box(cx - w * 0.5, cz - d * 0.5, cx + w * 0.5, cz + d * 0.5, 0.86, 1.46, iron, ironD, ironHi);
  b.box(cx - w * 1.04, cz - d * 0.78, cx + w * 0.82, cz + d * 0.78, 1.46, 1.9, iron, ironD, ironHi);
  b.flat(cx - w * 1.04 + 0.05, cz - d * 0.7, cx + w * 0.82 - 0.05, cz + d * 0.7, 1.905, rgb('#a4a4b4'));
  // its horn, pointing east past the block (above any head)
  const hx0 = cx + w * 0.82;
  const hx1 = cx + w * 1.62;
  const hy0 = 1.5;
  const hy1 = 1.9;
  const hz = d * 0.5;
  const m = b.m;
  m.quad([hx0, hy1, cz + hz], [hx1, 1.82, cz], [hx1, 1.82, cz], [hx0, hy1, cz - hz], [0, 1, 0], ironHi);
  m.quad([hx0, hy0, cz + hz], [hx1, 1.78, cz], [hx1, 1.82, cz], [hx0, hy1, cz + hz], [0.2, 0, 0.98], iron);
  m.quad([hx0, hy0, cz - hz], [hx1, 1.78, cz], [hx0, hy0, cz + hz], [hx0, hy0, cz + hz], [0, -1, 0], ironD);
  // a bar left on it, still white, and the hammer that was working it
  b.box(cx - 0.56, cz - 0.1, cx + 0.3, cz + 0.1, 1.905, 2.0, rgb('#ffb34a'), rgb('#ff6a1a'), rgb('#ffe9a8'));
  air.flames.push({ x: (cx - 0.1) * TILE, y: cz * TILE, h: 2.0 * TILE, size: 0.55 });
  air.embers.push({ x: cx * TILE, y: cz * TILE });
  b.box(cx + 0.36, cz + 0.08, cx + 0.8, cz + 0.32, 1.905, 2.14, ironD, ironD, iron);
  b.post(cx + 0.58, cz + 0.2, 0.04, 0.04, 2.14, 2.86, 5, rgb('#6d4a2d'), rgb('#8a6340'), 0.25, 0);
}

/** A furnace: brick to its footprint, its mouth lit, a stack smoking over it. */
function furnace(b: Build, air: RingAir, p: Pillar, rand: () => number): void {
  const t = tilesOf(p);
  const brick = [rgb('#7a3c30'), rgb('#6a3128'), rgb('#853f30'), rgb('#5e2c26')];
  const joint = rgb('#20100e');
  const iron = rgb('#3c3c46');
  const ironHi = rgb('#6a6a78');
  const ironD = rgb('#1c1c22');
  const cx = (t.x0 + t.x1) / 2;
  const cz = (t.z0 + t.z1) / 2;
  const top = 1.55;
  b.box(t.x0, t.z0, t.x1, t.z1, 0, top, brick[0]!, joint, rgb('#3a2626'));
  b.courses('s', t.x0, t.x1, t.z1, 0.02, top, 0.2, 0.34, brick, joint, rand);
  b.courses('e', t.z0, t.z1, t.x1, 0.02, top, 0.2, 0.34, brick, joint, rand);
  b.courses('w', t.z0, t.z1, t.x0, 0.02, top, 0.2, 0.34, brick, joint, rand);
  // its mouth: an arch of fire with an iron door swung up over it
  const hw = (t.x1 - t.x0) * 0.33;
  const y1 = 0.92;
  b.faceS(cx - hw - 0.06, cx + hw + 0.06, t.z1 + 0.02, 0.06, y1 + 0.08, ironD);
  b.faceS(cx - hw, cx + hw, t.z1 + 0.03, 0.1, y1, rgb('#ff9a2a'), rgb('#ffe28a'));
  for (let i = 0; i < 4; i++) {
    const x = cx - hw + ((i + 0.5) / 4) * hw * 2;
    b.faceS(x - 0.018, x + 0.018, t.z1 + 0.04, 0.1, y1, ironD);
  }
  b.box(cx - hw - 0.1, t.z1 - 0.02, cx + hw + 0.1, t.z1 + 0.12, y1 + 0.06, y1 + 0.2, iron, ironD, ironHi);
  air.flames.push({ x: cx * TILE, y: (t.z1 + 0.1) * TILE, h: 0.2 * TILE, size: 1 });
  air.embers.push({ x: cx * TILE, y: (t.z1 + 0.2) * TILE });
  // bands, and the stack
  b.box(t.x0 - 0.03, t.z0 - 0.03, t.x1 + 0.03, t.z1 + 0.03, top - 0.12, top, iron, ironD, ironHi);
  b.post(cx, cz, 0.42, 0.28, top, 2.5, 8, rgb('#5e2c26'), rgb('#7a3c30'));
  b.post(cx, cz, 0.33, 0.33, 2.5, 2.66, 8, iron, ironHi);
  air.smokes.push({ x: cx * TILE, y: cz * TILE, h: 2.66 * TILE, tone: '#2b2428' });
}

function cinderForge(b: Build, place: Placer, people: Watcher[], air: RingAir, map: RingMap, parent: THREE.Object3D, gears: RingGear[]): void {
  const rand = seeded(37);
  const s: Masonry = {
    blocks: [rgb('#51433f'), rgb('#473a38'), rgb('#5c4c46'), rgb('#3f3331'), rgb('#4e403c')],
    joint: rgb('#150f10'),
    top: rgb('#6f5a52'),
    edge: rgb('#5f4d47'),
    dark: rgb('#2a2022'),
  };
  const iron = rgb('#3c3c46');
  const ironHi = rgb('#6a6a78');
  const ironD = rgb('#1c1c22');
  const brass = rgb('#b98a3a');
  const wood = rgb('#4a3424');
  const blue = rgb('#3f7fe0');
  const red = rgb('#d8443e');
  northWall(b, s, rand);
  sideWalls(b, s, rand);
  southWalk(b, s, [rgb('#3e3234'), rgb('#352b2d'), rgb('#463938'), rgb('#2f2729')], rand);
  const folk: Folk = {
    shirts: ['#5a4030', '#7a3c2a', '#3c3c46', '#4a5a50', '#8a6030', '#2e2e38', '#6a2c26', '#70604e'].map(rgb),
    heads: ['#c98f62', '#8f5e3c', '#e0b48a', '#6a6a78', '#3c3c46', '#b98a3a', '#a57050', '#5e4331'].map(rgb),
  };
  const mouth0 = AW / 2 - 3.2;
  const mouth1 = AW / 2 + 3.2;
  stands(b, people, { side: rgb('#3a2f2e'), foot: rgb('#1a1314'), top: rgb('#5a4944'), aisle: rgb('#6a5a50'), bench: rgb('#2e2e38') }, folk, rand, (x, z) => x > mouth0 - 0.2 && x < mouth1 + 0.2 && z < 0 && z > -3.4);
  southFolk(people, folk, rand, () => false);

  // an iron rail in front of the first row
  for (let x = -3; x < AW + 3; x += 0.9) b.box(x, -0.16, x + 0.05, -0.1, NORTH, NORTH + 0.36, iron, ironD, ironHi);
  b.box(-3, -0.18, AW + 3, -0.08, NORTH + 0.34, NORTH + 0.4, ironHi, iron, ironHi);

  // ribs of iron up the wall, a wheel turning in every other bay and a run of hot iron coming down the rest
  const NUM = 8;
  const fall: [number, number, number, number, number][] = [];
  for (let i = 0; i <= NUM; i++) {
    const x = (i / NUM) * AW;
    if (x > mouth0 && x < mouth1) continue;
    b.box(x - 0.17, 0, x + 0.17, 0.12, 0, NORTH - 0.1, iron, ironD, ironHi);
    for (const y of [0.3, 0.75, 1.2]) for (const dx of [-0.1, 0.1]) b.post(x + dx, 0.125, 0.025, 0.025, y - 0.012, y + 0.012, 5, brass, brass);
    if (i % 2) {
      place.put('torch_mounted', x, 0.12, 0.66, 0.56);
      air.flames.push({ x: x * TILE, y: 0.22 * TILE, h: 1.2 * TILE, size: 0.5 });
    }
  }
  for (let i = 0; i < NUM; i++) {
    const cx = ((i + 0.5) / NUM) * AW;
    if (cx > mouth0 - 0.5 && cx < mouth1 + 0.5) continue;
    const near = Math.min(i, NUM - 1 - i);
    if (near % 2 === 0) {
      gears.push({ x: cx, y: 0.84, z: 0.04, r: 0.74, speed: (i % 4 ? 1 : -1) * 0.34 });
      b.post(cx, 0.1, 0.05, 0.05, 0.82, 0.86, 6, brass, brass);
    } else {
      // a spout, and iron pouring from it into a slot in the floor
      fall.push([cx - 0.14, cx + 0.14, 0.05, 0.02, NORTH - 0.44]);
      b.box(cx - 0.3, 0, cx + 0.3, 0.2, NORTH - 0.52, NORTH - 0.34, iron, ironD, ironHi);
      b.box(cx - 0.44, 0.0, cx + 0.44, 0.1, 0, 0.1, ironD, ironD, rgb('#ff8a2a'));
      air.embers.push({ x: cx * TILE, y: 0.2 * TILE });
    }
    for (const dx of [-1, 1]) {
      const links = 5;
      for (let k = 0; k < links; k++) b.box(cx + dx * 0.62 - 0.018, 0.03, cx + dx * 0.62 + 0.018, 0.05, NORTH - 0.2 - (k + 1) * 0.16, NORTH - 0.2 - k * 0.16 - 0.03, ironHi, iron, ironHi);
    }
  }
  // the great furnace in the middle of the north wall, its mouth as wide as a house
  const Y = NORTH + 2.6;
  const brick = [rgb('#7a3c30'), rgb('#6a3128'), rgb('#853f30'), rgb('#5e2c26')];
  const joint = rgb('#20100e');
  b.box(mouth0, -3.4, mouth1, 0.3, 0, Y, brick[0]!, joint, rgb('#3a2626'));
  b.courses('s', mouth0, mouth1, 0.3, 0, Y - 0.16, 0.34, 0.74, brick, joint, rand);
  const mx0 = AW / 2 - 2.3;
  const mx1 = AW / 2 + 2.3;
  b.faceS(mx0 - 0.1, mx1 + 0.1, 0.32, 0.02, 2.35, ironD);
  b.faceS(mx0, mx1, 0.33, 0.04, 2.25, rgb('#ff8a22'), rgb('#ffdf7c'));
  fall.push([AW / 2 - 0.5, AW / 2 + 0.5, 0.345, 0.02, 1.2]);
  // bars across it, and its lintel
  for (let i = 0; i <= 10; i++) {
    const x = mx0 + (i / 10) * (mx1 - mx0);
    b.box(x - 0.035, 0.34, x + 0.035, 0.39, 0.04, 2.25, iron, ironD, ironHi);
  }
  b.box(mx0 - 0.3, 0.24, mx1 + 0.3, 0.46, 2.25, 2.62, iron, ironD, ironHi);
  for (let i = 0; i < 9; i++) b.post(mx0 + (i + 0.5) * ((mx1 - mx0) / 9), 0.465, 0.04, 0.04, 2.42, 2.45, 6, brass, brass);
  // and its door-posts
  for (const x of [mx0 - 0.2, mx1 + 0.2]) b.box(x - 0.14, 0.24, x + 0.14, 0.46, 0, 2.3, iron, ironD, ironHi);
  for (const [k, size] of [[0.2, 3], [0.5, 4.2], [0.8, 3.2]] as const) {
    const x = mx0 + k * (mx1 - mx0);
    air.flames.push({ x: x * TILE, y: 0.2 * TILE, h: 0.1 * TILE, size });
    air.embers.push({ x: x * TILE, y: 0.5 * TILE });
  }
  // two stacks over the place
  for (const x of [mouth0 + 1, mouth1 - 1]) {
    b.post(x, -1.5, 0.9, 0.62, Y, Y + 3.2, 10, rgb('#5e2c26'), rgb('#7a3c30'));
    b.post(x, -1.5, 0.74, 0.74, Y + 3.2, Y + 3.5, 10, iron, ironHi);
    air.smokes.push({ x: x * TILE, y: -1.5 * TILE, h: (Y + 3.5) * TILE, tone: '#1c1719', size: 2.4 });
  }
  flows(fall, parent);

  entryDoors(b, s, blue, red);
  // the blocks either side of the gates: iron-bound, stacked with the smiths' stock
  for (const p of map.pillars) {
    if (!p.wall) continue;
    entryBlock(b, p, s, 1.1, rand);
    const t = tilesOf(p);
    const left = p.x < AW * 13;
    entryColors(b, air, p, left ? blue : red, wood, rgb('#ffcf7a'));
    const edge = left ? t.x1 : t.x0;
    const far = left ? t.x0 + 0.5 : t.x1 - 0.5;
    const zc = (t.z0 + t.z1) / 2;
    // straps round its corner
    for (const z of [t.z0 + 0.5, t.z1 - 0.5]) b.box(edge - 0.02, z - 0.06, edge + 0.02, z + 0.06, 0, 1.1, iron, ironD, ironHi);
    place.put('anvil', far, zc - 0.7, 1.1, 0.42, { rot: Math.PI / 2 });
    place.put('barrel_small', far, zc + 0.1, 1.1, 0.5);
    place.put('barrel_small', far + (left ? 0.1 : -0.1), zc + 0.62, 1.1, 0.42);
    place.put('grindstone', far, zc + 1.1, 1.1, 0.6);
  }
  for (const p of map.pillars) {
    if (p.wall) continue;
    if (p.w > 40) greatAnvil(b, air, p);
    else furnace(b, air, p, rand);
  }
}

/* ------------------------------------------------------------------ the lot */

export interface RingDress {
  air: RingAir;
  gears: RingGear[];
  gearStand: Stand | null;
  stands: Stand[];
}

export function dressRing(map: RingMap, packs: LandPacks, parent: THREE.Object3D): RingDress {
  const b = new Build();
  const place = new Placer();
  const people: Watcher[] = [];
  const air: RingAir = { flames: [], smokes: [], glints: [], embers: [] };
  const gears: RingGear[] = [];
  if (map.theme === 'sands') provingSands(b, place, people, air, map);
  else if (map.theme === 'frost') frozenMere(b, place, people, air, map);
  else cinderForge(b, place, people, air, map, parent, gears);
  parent.add(b.m.build());
  const stands = [...place.build(packs, parent), ...crowdStands(people, parent)];
  const gearStand = gears.length ? new Stand(gearMesh(), parent, gears.length) : null;
  return { air, gears, gearStand, stands };
}
