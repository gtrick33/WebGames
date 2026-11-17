import * as THREE from 'three';

/**
 * The ground near the camera, painted once and kept (render3d/land.ts groundFrag says what is painted and why).
 *
 * What lies on the ground never moves, and working it out is most of what the picture costs: so it is painted into a
 * picture of its own, a little finer than the screen shows it, and a frame only reads that picture. The picture is
 * laid in squares of ground, CELL tiles a side, each at the place its own tiles give it (a square's column and row,
 * wrapped round the picture's width and height): as the camera moves, the squares newly come into view are painted
 * over the ones left behind, and nothing else is touched. A walk across a land paints each square of it once.
 *
 * It is painted again from nothing only when the picture stops suiting the view: the camera draws well in (a scene's
 * close-up) or back (a wider shot, a window made larger), or the picture is drawn with more pixels. Where it can't be
 * made at all (no ground under a corner of the view, a view too wide to keep, no room for it), the ground is drawn
 * as it always was, worked out whole in every frame.
 */

/** A square of ground, in tiles a side. */
const CELL = 2;
/** Ground kept painted past the edge of what is seen, in tiles. */
const PAD = 0.3;
/** Painted this much finer than the screen shows it where the ground is nearest: read back, it loses nothing. */
const SHARP = 1.15;
/** Painted again once the screen shows the ground this much finer than it was painted for (a close-up). */
const SOFT = 0.8;
/** The widest view kept, in tiles: past it (a camera near level with the ground) nothing is. */
const MAX_SPAN = 96;
/** The most the kept picture may hold, in pixels, and along a side. */
const MAX_PIXELS = 16e6;
const MAX_SIDE = 8192;
/** Frames a picture that still serves, but no longer suits the view, is kept before it is painted again to suit. */
const SETTLE = 120;
/** Frames before trying again after a picture couldn't be made to suit. */
const REST = 90;
const NONE = 0x7fffffff;

const bakeVert = /* glsl */ `
  attribute vec4 iSlot;
  attribute vec4 iWorld;
  varying vec3 vW;
  void main() {
    vW = vec3(iWorld.x + position.x * iWorld.z, 0.0, iWorld.y + position.y * iWorld.w);
    gl_Position = vec4(iSlot.xy + position.xy * iSlot.zw, 0.0, 1.0);
  }`;

/** Every kept picture is empty after the browser took the drawing context back and returned it. */
let epoch = 0;
export function groundLost(): void {
  epoch++;
}

const CORNERS: readonly [number, number][] = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
];

export class GroundBake {
  private rt: THREE.WebGLRenderTarget | null = null;
  private gl: THREE.WebGLRenderer | null = null;
  private epoch = -1;
  /** Squares across and down the kept picture, and the pixels a side of one. */
  private nx = 0;
  private nz = 0;
  private cellPx = 0;
  /** Which square of the land each place in the picture holds. */
  private atX = new Int32Array(0);
  private atZ = new Int32Array(0);
  /** The screen's pixels to a tile the picture was painted for. */
  private madeFor = 0;
  private unsuited = 0;
  private rest = 0;
  private failed = false;
  private readonly scene = new THREE.Scene();
  private readonly cam = new THREE.Camera();
  private readonly brush: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>;
  private slots = new Float32Array(0);
  private worlds = new Float32Array(0);
  private readonly near = new THREE.Vector3();
  private readonly far = new THREE.Vector3();
  private readonly size = new THREE.Vector2();
  private readonly hit = new Float32Array(8);
  /** How many squares were painted, ever: a test's and a tool's measure. */
  painted = 0;
  /** How many times the whole picture was begun again. */
  begun = 0;

  /**
   * `whole` draws the ground worked out in full; `bakeFrag` paints the land alone (its uniforms are `whole`'s);
   * `frame` reads the kept picture through `uBake` and `uBakeScale`.
   */
  constructor(
    private readonly mesh: THREE.Mesh,
    private readonly whole: THREE.ShaderMaterial,
    bakeFrag: string,
    private readonly frame: THREE.ShaderMaterial,
  ) {
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]), 3));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    geo.instanceCount = 0;
    const mat = new THREE.ShaderMaterial({
      defines: whole.defines,
      uniforms: whole.uniforms,
      vertexShader: bakeVert,
      fragmentShader: bakeFrag,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NoBlending,
      side: THREE.DoubleSide,
    });
    this.brush = new THREE.Mesh(geo, mat);
    this.brush.frustumCulled = false;
    this.scene.add(this.brush);
  }

  /** The ground's own two materials: worked out whole, and read from the kept picture. */
  get materials(): { whole: THREE.ShaderMaterial; frame: THREE.ShaderMaterial } {
    return { whole: this.whole, frame: this.frame };
  }

  /** Whether the ground is being read from its kept picture (false: worked out whole). */
  get kept(): boolean {
    return this.mesh.material === this.frame;
  }

  /** Before the ground is drawn with `camera`: paints what has come into view, and says how the ground is to be drawn. */
  update(gl: THREE.WebGLRenderer, camera: THREE.Camera): void {
    if (this.failed) return;
    try {
      this.mesh.material = this.fit(gl, camera) ? this.frame : this.whole;
    } catch {
      // (a machine that can't keep the picture draws the ground as it always did)
      this.failed = true;
      this.mesh.material = this.whole;
      this.drop();
    }
  }

  private fit(gl: THREE.WebGLRenderer, camera: THREE.Camera): boolean {
    if (gl.getContext().isContextLost()) return false;
    // where the corners of the view fall on the ground
    const hit = this.hit;
    for (let i = 0; i < 4; i++) {
      const [x, y] = CORNERS[i]!;
      const a = this.near.set(x, y, -1).unproject(camera);
      const b = this.far.set(x, y, 1).unproject(camera);
      if (!(a.y - b.y > 1e-6) || !(a.y > 0)) return false;
      const t = a.y / (a.y - b.y);
      hit[i * 2] = a.x + (b.x - a.x) * t;
      hit[i * 2 + 1] = a.z + (b.z - a.z) * t;
    }
    const minX = Math.min(hit[0]!, hit[2]!, hit[4]!, hit[6]!);
    const maxX = Math.max(hit[0]!, hit[2]!, hit[4]!, hit[6]!);
    const minZ = Math.min(hit[1]!, hit[3]!, hit[5]!, hit[7]!);
    const maxZ = Math.max(hit[1]!, hit[3]!, hit[5]!, hit[7]!);
    if (!(maxX - minX < MAX_SPAN && maxZ - minZ < MAX_SPAN)) return false;
    // how fine the screen shows the ground where it shows it finest: its pixels to a tile along the nearer edge
    const buf = gl.getDrawingBufferSize(this.size);
    const low = Math.hypot(hit[2]! - hit[0]!, hit[3]! - hit[1]!);
    const high = Math.hypot(hit[6]! - hit[4]!, hit[7]! - hit[5]!);
    const need = buf.x / Math.max(0.01, Math.min(low, high));
    const i0 = Math.floor((minX - PAD) / CELL);
    const i1 = Math.floor((maxX + PAD) / CELL);
    const j0 = Math.floor((minZ - PAD) / CELL);
    const j1 = Math.floor((maxZ + PAD) / CELL);
    const wantX = i1 - i0 + 1;
    const wantZ = j1 - j0 + 1;
    const serves = !!this.rt && this.gl === gl && this.epoch === epoch && wantX <= this.nx && wantZ <= this.nz && this.cellPx / CELL >= need * SOFT;
    if (serves) {
      // (it serves, but was painted for another view: finer or coarser than this one wants, or far wider)
      const k = need / this.madeFor;
      const suits = k > 0.75 && k < 1.1 && this.nx * this.nz <= wantX * wantZ * 2.2;
      this.unsuited = suits ? 0 : this.unsuited + 1;
    }
    if (!serves || this.unsuited > SETTLE) {
      if (this.rest > 0) {
        this.rest--;
        if (!serves) return false;
      } else if (!this.begin(gl, need, wantX, wantZ) && !serves) return false;
    }
    this.paint(gl, i0, i1, j0, j1);
    return true;
  }

  /** A new picture, empty, to suit this view. False if none can be made fine enough for it. */
  private begin(gl: THREE.WebGLRenderer, need: number, wantX: number, wantZ: number): boolean {
    // (room to move in: a camera drawing back a little, a window pulled wider, don't begin it again at once)
    const nx = wantX + Math.max(1, Math.ceil(wantX * 0.12));
    const nz = wantZ + Math.max(1, Math.ceil(wantZ * 0.12));
    const side = Math.min(MAX_SIDE, gl.capabilities.maxTextureSize);
    const cellPx = Math.floor(Math.min(Math.round(CELL * need * SHARP), side / nx, side / nz, Math.sqrt(MAX_PIXELS / (nx * nz))));
    this.unsuited = 0;
    if (cellPx / CELL < need * SOFT) {
      this.rest = REST;
      return false;
    }
    this.drop();
    this.rt = new THREE.WebGLRenderTarget(nx * cellPx, nz * cellPx, {
      depthBuffer: false,
      stencilBuffer: false,
      generateMipmaps: false,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.RepeatWrapping,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      colorSpace: THREE.NoColorSpace,
    });
    this.gl = gl;
    this.epoch = epoch;
    this.nx = nx;
    this.nz = nz;
    this.cellPx = cellPx;
    this.madeFor = need;
    this.atX = new Int32Array(nx * nz).fill(NONE);
    this.atZ = new Int32Array(nx * nz).fill(NONE);
    if (this.slots.length < nx * nz * 4) {
      this.slots = new Float32Array(nx * nz * 4);
      this.worlds = new Float32Array(nx * nz * 4);
      const geo = this.brush.geometry;
      // (a geometry's attributes can't grow in place: the old ones are let go with it)
      const next = new THREE.InstancedBufferGeometry();
      next.setAttribute('position', geo.getAttribute('position'));
      next.setIndex(geo.getIndex());
      next.setAttribute('iSlot', new THREE.InstancedBufferAttribute(this.slots, 4).setUsage(THREE.DynamicDrawUsage));
      next.setAttribute('iWorld', new THREE.InstancedBufferAttribute(this.worlds, 4).setUsage(THREE.DynamicDrawUsage));
      next.instanceCount = 0;
      this.brush.geometry = next;
      geo.dispose();
    }
    this.frame.uniforms.uBake!.value = this.rt.texture;
    (this.frame.uniforms.uBakeScale!.value as THREE.Vector2).set(1 / (CELL * nx), 1 / (CELL * nz));
    this.begun++;
    return true;
  }

  /** Paints the squares of this stretch of land that the picture doesn't hold yet, all in one go. */
  private paint(gl: THREE.WebGLRenderer, i0: number, i1: number, j0: number, j1: number): void {
    const { nx, nz, atX, atZ, slots, worlds } = this;
    let n = 0;
    for (let j = j0; j <= j1; j++) {
      const sj = ((j % nz) + nz) % nz;
      for (let i = i0; i <= i1; i++) {
        const si = ((i % nx) + nx) % nx;
        const s = sj * nx + si;
        if (atX[s] === i && atZ[s] === j) continue;
        atX[s] = i;
        atZ[s] = j;
        slots[n * 4] = (si / nx) * 2 - 1;
        slots[n * 4 + 1] = (sj / nz) * 2 - 1;
        slots[n * 4 + 2] = 2 / nx;
        slots[n * 4 + 3] = 2 / nz;
        worlds[n * 4] = i * CELL;
        worlds[n * 4 + 1] = j * CELL;
        worlds[n * 4 + 2] = CELL;
        worlds[n * 4 + 3] = CELL;
        n++;
      }
    }
    if (!n) return;
    const geo = this.brush.geometry;
    geo.instanceCount = n;
    (geo.getAttribute('iSlot') as THREE.InstancedBufferAttribute).needsUpdate = true;
    (geo.getAttribute('iWorld') as THREE.InstancedBufferAttribute).needsUpdate = true;
    const target = gl.getRenderTarget();
    const clears = gl.autoClear;
    gl.autoClear = false;
    gl.setRenderTarget(this.rt);
    gl.render(this.scene, this.cam);
    gl.setRenderTarget(target);
    gl.autoClear = clears;
    this.painted += n;
  }

  private drop(): void {
    this.rt?.dispose();
    this.rt = null;
  }

  /** Lets go of the kept picture and what paints it (not the ground's own materials: land.ts disposeGround). */
  dispose(): void {
    this.drop();
    this.brush.geometry.dispose();
    this.brush.material.dispose();
  }
}

/** Before a scene's ground is drawn: every ground in it paints what has come into view (render3d/stage.ts). */
export function paintGround(scene: THREE.Object3D, gl: THREE.WebGLRenderer, camera: THREE.Camera): void {
  scene.traverseVisible((o) => {
    const bake = o.userData.groundBake as GroundBake | undefined;
    if (bake) bake.update(gl, camera);
  });
}
