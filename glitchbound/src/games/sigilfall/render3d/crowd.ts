import * as THREE from 'three';
import type { MeshData } from './pack';
import { toGeometry } from './pack';
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
    this.xray = new THREE.InstancedMesh(this.geo, xrayOf(this.rig), this.cap);
    this.xray.frustumCulled = false;
    this.xray.instanceMatrix = this.fill.instanceMatrix;
    this.xray.renderOrder = 1;
    this.xray.count = 0;
    this.parent.add(this.xray);
  }

  begin(): void {
    this.n = 0;
  }

  /** One figure: `rot` turns it about the vertical (0 faces +z, toward the camera). */
  put(x: number, y: number, z: number, rot: number, sx: number, sy: number, frameA: number, frameB = 0, blend = 0, alpha = 1, r = 1, g = 1, b = 1, flash = 0, tipX = 0, tipZ = 0): void {
    if (this.n >= this.cap) this.grow();
    const i = this.n++;
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

  end(): void {
    this.fill.count = this.n;
    if (this.ink) this.ink.count = this.n;
    if (this.xray) this.xray.count = this.n;
    if (this.n) {
      this.fill.instanceMatrix.needsUpdate = true;
      this.tint.needsUpdate = true;
      this.anim.needsUpdate = true;
    }
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
  }

  dispose(): void {
    this.parent.remove(this.fill);
    if (this.ink) this.parent.remove(this.ink);
    if (this.xray) this.parent.remove(this.xray);
    this.xray?.dispose();
    this.geo.dispose();
    this.fill.dispose();
    this.ink?.dispose();
  }
}

/** Any number of one still thing (a kind of tree), placed by a list. */
export class Stand {
  readonly mesh: THREE.InstancedMesh;
  private readonly tint: THREE.InstancedBufferAttribute;
  private readonly geo: THREE.BufferGeometry;
  private n = 0;

  constructor(
    mesh: MeshData,
    parent: THREE.Object3D,
    private readonly cap: number,
    col?: Uint8Array,
    sunk = false,
  ) {
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

  dispose(): void {
    this.mesh.parent?.remove(this.mesh);
    this.geo.dispose();
    this.mesh.dispose();
  }
}
