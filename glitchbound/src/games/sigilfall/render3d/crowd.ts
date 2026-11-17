import * as THREE from 'three';
import type { MeshData } from './pack';
import { toGeometry } from './pack';
import { thinMesh } from './thin';
import { animMaterial, colossusMaterial, inkMaterial, staticMaterial, sunkMaterial, xrayMaterial, type RigAnim } from './toon';

/** The reused materials of each skeleton (a program is costly; the driver shares them by source). */
const fills = new WeakMap<RigAnim, THREE.ShaderMaterial>();
const inks = new WeakMap<RigAnim, Map<number, THREE.ShaderMaterial>>();
const xrays = new WeakMap<RigAnim, THREE.ShaderMaterial>();
function xrayOf(a: RigAnim): THREE.ShaderMaterial {
  let m = xrays.get(a);
  if (!m) {
    m = xrayMaterial(a);
    xrays.set(a, m);
  }
  return m;
}
const stones = new WeakMap<RigAnim, THREE.ShaderMaterial>();
function fillOf(a: RigAnim, colossus = false): THREE.ShaderMaterial {
  const table = colossus ? stones : fills;
  let m = table.get(a);
  if (!m) {
    m = colossus ? colossusMaterial(a) : animMaterial(a);
    table.set(a, m);
  }
  return m;
}
function inkOf(a: RigAnim, w: number): THREE.ShaderMaterial {
  let map = inks.get(a);
  if (!map) {
    map = new Map();
    inks.set(a, map);
  }
  let m = map.get(w);
  if (!m) {
    m = inkMaterial(a, w);
    map.set(w, m);
  }
  return m;
}

/**
 * The finest thing a figure in the world is drawn with may be this many of the picture's pixels across: under it,
 * shape that the screen can't show is left out of what goes to the graphics card (render3d/thin.ts). At one and a
 * half, the Vigil's host went to it with a quarter to a half fewer triangles and was the same picture: under two
 * pixels in a thousand differed. Where the figures stand larger (the world on a phone, the Ring) there is nothing
 * that small in them to leave out, and they are drawn whole.
 */
export const THIN_PX = 1.5;
/** Frames a figure is drawn with more shape than it needs, or with all of it, before a model is made to suit. */
const THIN_SETTLE = 90;

/** How many models may still be made in this frame: making one takes a few milliseconds (Cast.end). */
export interface ThinBudget {
  left: number;
}

const dummy = new THREE.Matrix4();
const q = new THREE.Quaternion();
const turn = new THREE.Euler(0, 0, 0, 'YXZ');
const up = new THREE.Vector3(0, 1, 0);
const pos = new THREE.Vector3();
const size = new THREE.Vector3();

/**
 * Any number of one figure, drawn in one or two draw calls (the fill, and its ink): each frame says where each one
 * stands and which frame of which clip it is on. Everything that walks in the game is one of these.
 */
export class Crowd {
  readonly fill: THREE.InstancedMesh;
  readonly ink: THREE.InstancedMesh | null;
  /** Their shape behind what stands in front of them (heroes only). */
  xray: THREE.InstancedMesh | null = null;
  private readonly geo: THREE.BufferGeometry;
  /** The model as it came, to make a lighter one from (none if it was handed over already built). */
  private readonly data: MeshData | null;
  /** The lighter model in use, and the size of the least thing left in it (the full model's own geometry if thinning it took too little away). */
  private thin: { cell: number; geo: THREE.BufferGeometry } | null = null;
  private unsuited = THIN_SETTLE;
  /** The largest any of them is drawn this frame, against the model's own size. */
  private big = 0;
  private tint: THREE.InstancedBufferAttribute;
  private anim: THREE.InstancedBufferAttribute;
  private cap: number;
  private n = 0;

  constructor(
    mesh: MeshData | THREE.BufferGeometry,
    readonly rig: RigAnim,
    private readonly parent: THREE.Object3D,
    cap = 8,
    inkWidth = 0.022,
    colossus = false,
  ) {
    this.cap = cap;
    this.data = mesh instanceof THREE.BufferGeometry ? null : mesh;
    this.geo = mesh instanceof THREE.BufferGeometry ? mesh : toGeometry(mesh);
    this.tint = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.anim = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('iTint', this.tint);
    this.geo.setAttribute('iAnim', this.anim);
    this.fill = new THREE.InstancedMesh(this.geo, fillOf(rig, colossus), cap);
    this.fill.frustumCulled = false;
    this.fill.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.fill.count = 0;
    // (after everything still, so that a hero's shape can be drawn behind what's there before the hero is)
    this.fill.renderOrder = 2;
    parent.add(this.fill);
    if (inkWidth > 0) {
      this.ink = new THREE.InstancedMesh(this.geo, inkOf(rig, inkWidth), cap);
      this.ink.frustumCulled = false;
      this.ink.instanceMatrix = this.fill.instanceMatrix;
      this.ink.count = 0;
      this.ink.renderOrder = 2;
      parent.add(this.ink);
    } else this.ink = null;
  }

  /** Shows their shape when something stands in front of them. */
  seeThrough(): void {
    if (this.xray) return;
    this.xray = new THREE.InstancedMesh(this.fill.geometry, xrayOf(this.rig), this.cap);
    this.xray.frustumCulled = false;
    this.xray.instanceMatrix = this.fill.instanceMatrix;
    this.xray.renderOrder = 1;
    this.xray.count = 0;
    this.parent.add(this.xray);
  }

  begin(): void {
    this.n = 0;
    this.big = 0;
  }

  /** One figure: `rot` turns it about the vertical (0 faces +z, toward the camera). */
  put(x: number, y: number, z: number, rot: number, sx: number, sy: number, frameA: number, frameB = 0, blend = 0, alpha = 1, r = 1, g = 1, b = 1, flash = 0, tipX = 0, tipZ = 0): void {
    if (this.n >= this.cap) this.grow();
    const i = this.n++;
    if (sx > this.big) this.big = sx;
    if (sy > this.big) this.big = sy;
    if (tipX || tipZ) q.setFromEuler(turn.set(tipX, rot, tipZ, 'YXZ'));
    else q.setFromAxisAngle(up, rot);
    pos.set(x, y, z);
    size.set(sx, sy, sx);
    dummy.compose(pos, q, size);
    dummy.toArray(this.fill.instanceMatrix.array as Float32Array, i * 16);
    const t = this.tint.array as Float32Array;
    t[i * 4] = r;
    t[i * 4 + 1] = g;
    t[i * 4 + 2] = b;
    t[i * 4 + 3] = flash;
    const a = this.anim.array as Float32Array;
    a[i * 4] = frameA;
    a[i * 4 + 1] = frameB;
    a[i * 4 + 2] = blend;
    a[i * 4 + 3] = alpha;
  }

  /**
   * `px`: how many of the picture's pixels one unit of the world spans where these stand (0: not said, and they are
   * drawn with all their shape: a portrait, the hall of heroes). Given it, they are drawn with a model that has
   * nothing finer than THIN_PX pixels in it, made once and kept; `budget` says whether one may be made this frame.
   */
  end(px = 0, budget?: ThinBudget): void {
    if (this.n && this.data) this.suit(px, budget);
    this.fill.count = this.n;
    if (this.ink) this.ink.count = this.n;
    if (this.xray) this.xray.count = this.n;
    if (this.n) {
      this.fill.instanceMatrix.needsUpdate = true;
      this.tint.needsUpdate = true;
      this.anim.needsUpdate = true;
    }
  }

  /** Chooses the model these are drawn with this frame. */
  private suit(px: number, budget?: ThinBudget): void {
    let geo = this.geo;
    if (px > 0 && this.big > 0) {
      // the least thing that may be left in the model, in its own units
      const want = THIN_PX / (px * this.big);
      const t = this.thin;
      // (never coarser than the screen can show: a camera drawn in on them shows the whole model at once, and a
      // finer one is made only if it stays there)
      const serves = !!t && t.cell <= want * 1.02;
      if (serves) geo = t!.geo;
      const suits = serves && t!.cell >= want * 0.75;
      this.unsuited = suits ? 0 : this.unsuited + 1;
      if (this.unsuited >= THIN_SETTLE && budget && budget.left > 0) {
        budget.left--;
        this.unsuited = 0;
        const made = thinMesh(this.data!, want);
        const next = made === this.data ? this.geo : toGeometry(made);
        if (next !== this.geo) {
          next.setAttribute('iTint', this.tint);
          next.setAttribute('iAnim', this.anim);
        }
        if (t && t.geo !== this.geo) t.geo.dispose();
        this.thin = { cell: want, geo: next };
        geo = next;
      }
    }
    if (this.fill.geometry === geo) return;
    this.fill.geometry = geo;
    if (this.ink) this.ink.geometry = geo;
    if (this.xray) this.xray.geometry = geo;
  }

  private grow(): void {
    this.cap *= 2;
    const matrix = new THREE.InstancedBufferAttribute(new Float32Array(this.cap * 16), 16).setUsage(THREE.DynamicDrawUsage);
    matrix.array.set(this.fill.instanceMatrix.array);
    this.fill.instanceMatrix = matrix;
    if (this.ink) this.ink.instanceMatrix = matrix;
    if (this.xray) this.xray.instanceMatrix = matrix;
    const t = new THREE.InstancedBufferAttribute(new Float32Array(this.cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
    t.array.set(this.tint.array);
    const a = new THREE.InstancedBufferAttribute(new Float32Array(this.cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
    a.array.set(this.anim.array);
    this.tint = t;
    this.anim = a;
    this.geo.setAttribute('iTint', t);
    this.geo.setAttribute('iAnim', a);
    if (this.thin && this.thin.geo !== this.geo) {
      this.thin.geo.setAttribute('iTint', t);
      this.thin.geo.setAttribute('iAnim', a);
    }
  }

  dispose(): void {
    this.parent.remove(this.fill);
    if (this.ink) this.parent.remove(this.ink);
    if (this.xray) this.parent.remove(this.xray);
    this.xray?.dispose();
    this.geo.dispose();
    if (this.thin && this.thin.geo !== this.geo) this.thin.geo.dispose();
    this.fill.dispose();
    this.ink?.dispose();
  }
}

/** Tiles a still thing may move from where it stands: leaves in the wind, a watcher's bob and jump (toon.ts). */
const STIR = 0.5;

/** Any number of one still thing (a kind of tree), placed by a list. */
export class Stand {
  readonly mesh: THREE.InstancedMesh;
  private readonly tint: THREE.InstancedBufferAttribute;
  private readonly geo: THREE.BufferGeometry;
  private n = 0;
  /** The model's own middle and how far it reaches from there. */
  private readonly mid: [number, number, number];
  private readonly reach: number;
  /** Everything placed, kept by `keep`: where each is, a ball round each, and which of them the last picture showed. */
  private kept: { n: number; at: Float32Array; tint: Float32Array; ball: Float32Array; on: Uint8Array; shown: number } | null = null;

  constructor(
    mesh: MeshData,
    parent: THREE.Object3D,
    private readonly cap: number,
    col?: Uint8Array,
    sunk = false,
  ) {
    this.mid = [(mesh.min[0]! + mesh.max[0]!) / 2, (mesh.min[1]! + mesh.max[1]!) / 2, (mesh.min[2]! + mesh.max[2]!) / 2];
    this.reach = Math.hypot(mesh.max[0]! - mesh.min[0]!, mesh.max[1]! - mesh.min[1]!, mesh.max[2]! - mesh.min[2]!) / 2;
    this.geo = toGeometry(mesh, col);
    this.tint = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('iTint', this.tint);
    this.mesh = new THREE.InstancedMesh(this.geo, sunk ? sunkMaterial : staticMaterial, cap);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    parent.add(this.mesh);
  }

  begin(): void {
    this.n = 0;
  }

  get room(): boolean {
    return this.n < this.cap;
  }

  put(x: number, y: number, z: number, rot: number, sx: number, sy: number, sz: number, r: number, g: number, b: number, sway: number, tipX = 0, tipZ = 0): void {
    if (this.n >= this.cap) return;
    const i = this.n++;
    if (tipX || tipZ) q.setFromEuler(turn.set(tipX, rot, tipZ, 'YXZ'));
    else q.setFromAxisAngle(up, rot);
    pos.set(x, y, z);
    size.set(sx, sy, sz);
    dummy.compose(pos, q, size);
    dummy.toArray(this.mesh.instanceMatrix.array as Float32Array, i * 16);
    const t = this.tint.array as Float32Array;
    t[i * 4] = r;
    t[i * 4 + 1] = g;
    t[i * 4 + 2] = b;
    t[i * 4 + 3] = sway;
  }

  end(): void {
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.tint.needsUpdate = true;
  }

  /**
   * For things placed once and left (the people round a ring, its walls and flags): after `end`, keeps where each
   * was put, so that `show` can hand the graphics card only those a picture can see. A ring's nine hundred watchers
   * all went to it in every frame, 68,000 triangles, with forty of them in the picture.
   */
  keep(): void {
    const n = this.n;
    const at = (this.mesh.instanceMatrix.array as Float32Array).slice(0, n * 16);
    const ball = new Float32Array(n * 4);
    const [mx, my, mz] = this.mid;
    for (let i = 0; i < n; i++) {
      const o = i * 16;
      ball[i * 4] = at[o]! * mx + at[o + 4]! * my + at[o + 8]! * mz + at[o + 12]!;
      ball[i * 4 + 1] = at[o + 1]! * mx + at[o + 5]! * my + at[o + 9]! * mz + at[o + 13]!;
      ball[i * 4 + 2] = at[o + 2]! * mx + at[o + 6]! * my + at[o + 10]! * mz + at[o + 14]!;
      const size = Math.max(Math.hypot(at[o]!, at[o + 1]!, at[o + 2]!), Math.hypot(at[o + 4]!, at[o + 5]!, at[o + 6]!), Math.hypot(at[o + 8]!, at[o + 9]!, at[o + 10]!));
      // (and as far again as anything sways, bobs or jumps where it stands: toon.ts staticMaterial, crowdMaterial)
      ball[i * 4 + 3] = this.reach * size + STIR;
    }
    this.kept = { n, at, tint: (this.tint.array as Float32Array).slice(0, n * 4), ball, on: new Uint8Array(n), shown: -1 };
  }

  /**
   * Draws only those of what was kept that this picture can see: `vp` is the camera's view (world to the picture,
   * −1 to 1 each way), `kx` and `ky` how much of the picture one tile can span across and up at its nearest. Each is
   * judged by a ball that holds all of it, so nothing that shows any part of itself is left out. Nothing is sent
   * again unless who is in the picture has changed. (Their own places are the world's: what holds them isn't moved.)
   */
  show(vp: THREE.Matrix4, kx: number, ky: number): void {
    const k = this.kept;
    if (!k) return;
    const e = vp.elements;
    const { ball, on } = k;
    let changed = k.shown < 0;
    for (let i = 0; i < k.n; i++) {
      const x = ball[i * 4]!;
      const y = ball[i * 4 + 1]!;
      const z = ball[i * 4 + 2]!;
      const r = ball[i * 4 + 3]!;
      const w = e[3]! * x + e[7]! * y + e[11]! * z + e[15]!;
      let seen = 0;
      if (w > 0) {
        const nx = (e[0]! * x + e[4]! * y + e[8]! * z + e[12]!) / w;
        const ny = (e[1]! * x + e[5]! * y + e[9]! * z + e[13]!) / w;
        if (Math.abs(nx) <= 1 + r * kx && Math.abs(ny) <= 1 + r * ky) seen = 1;
      }
      if (on[i] !== seen) {
        on[i] = seen;
        changed = true;
      }
    }
    if (!changed) return;
    const at = this.mesh.instanceMatrix.array as Float32Array;
    const tint = this.tint.array as Float32Array;
    let n = 0;
    for (let i = 0; i < k.n; i++) {
      if (!on[i]) continue;
      at.set(k.at.subarray(i * 16, i * 16 + 16), n * 16);
      tint.set(k.tint.subarray(i * 4, i * 4 + 4), n * 4);
      n++;
    }
    k.shown = n;
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.tint.needsUpdate = true;
  }

  /** How many of what was kept the last picture showed, of how many (a test's and a tool's measure). */
  get showing(): { shown: number; of: number } | null {
    return this.kept ? { shown: this.kept.shown, of: this.kept.n } : null;
  }

  dispose(): void {
    this.mesh.parent?.remove(this.mesh);
    this.geo.dispose();
    this.mesh.dispose();
  }
}
