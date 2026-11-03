import * as THREE from 'three';
import { TILE } from '../sim/map';
import { Cast } from './cast';
import { loadWardrobe } from './dress';
import { loadLand, type Land3D, type LandPacks } from './land';
import { LIGHT } from './toon';

/**
 * The 3D view: a WebGL canvas under the game's own canvas, which stays on top for spells, numbers, names and
 * markers (it is also what the player's touches land on). The camera looks down from the south at a steep angle.
 */

/** How far the camera looks down from level. */
const PITCH = (50 * Math.PI) / 180;
const FOV = 28;
/** Never renders more pixels than this per CSS pixel. */
const MAX_DPR = 2;

export class Stage {
  readonly gl: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 1, 200);
  readonly glCanvas: HTMLCanvasElement;
  readonly cast = new Cast();
  land: Land3D | null = null;
  landPacks: LandPacks | null = null;
  /** The models everyone needs have arrived. */
  ready = false;
  failed = false;
  private cssW = 1;
  private cssH = 1;
  private dist = 18;
  private readonly vp = new THREE.Matrix4();
  private readonly inv = new THREE.Matrix4();
  private readonly v = new THREE.Vector3();
  private readonly camPos = new THREE.Vector3();
  /** Half the land in view, in tiles: what the land keeps standing. */
  spanX = 12;
  spanZ = 9;
  /** Rendering scale, lowered if the device struggles. */
  private quality = 1;
  private slow = 0;
  private fast = 0;
  private lastDpr = 1;
  private lastFrame = 0;

  constructor(overlay: HTMLCanvasElement) {
    this.glCanvas = document.createElement('canvas');
    this.glCanvas.className = 'rb-gl-canvas';
    const st = this.glCanvas.style;
    st.position = 'absolute';
    st.left = '0';
    st.top = '0';
    st.width = '100%';
    st.height = '100%';
    st.pointerEvents = 'none';
    overlay.parentElement?.insertBefore(this.glCanvas, overlay);
    overlay.style.position = overlay.style.position || 'absolute';
    overlay.style.left = '0';
    overlay.style.top = '0';
    this.gl = new THREE.WebGLRenderer({ canvas: this.glCanvas, antialias: true, alpha: false, powerPreference: 'high-performance', stencil: false });
    this.gl.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.gl.toneMapping = THREE.NoToneMapping;
    this.gl.autoClear = true;
    this.scene.add(this.cast.root);
    void Promise.all([loadWardrobe(), loadLand()])
      .then(([w, l]) => {
        this.cast.wardrobe = w;
        this.landPacks = l;
        this.cast.packs = [l.indoor, l.town, l.nature, w.hero];
        this.ready = true;
      })
      .catch(() => {
        this.failed = true;
      });
  }

  /** `tilePx`: device pixels a tile spans at the middle of the view. */
  setSize(cssW: number, cssH: number, dpr: number, tilePx: number): void {
    this.cssW = cssW;
    this.cssH = cssH;
    const d = Math.min(dpr, MAX_DPR) * this.quality;
    this.lastDpr = dpr;
    this.gl.setPixelRatio(d);
    this.gl.setSize(cssW, cssH, false);
    this.camera.aspect = cssW / Math.max(1, cssH);
    // distance at which a tile at the view's middle spans tilePx device pixels
    const devH = cssH * dpr;
    this.dist = devH / (2 * Math.tan((FOV * Math.PI) / 360) * tilePx);
    this.camera.near = Math.max(1, this.dist * 0.2);
    this.camera.far = this.dist * 4 + 60;
    this.camera.updateProjectionMatrix();
    const hz = (devH / tilePx) / Math.sin(PITCH) / 2;
    this.spanZ = hz;
    this.spanX = (cssW * dpr) / tilePx / 2;
  }

  /** Points the camera at a spot on the ground (tiles). */
  look(cx: number, cz: number): void {
    const cos = Math.cos(PITCH);
    const sin = Math.sin(PITCH);
    this.camPos.set(cx, this.dist * sin, cz + this.dist * cos);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(cx, 0, cz);
    this.camera.updateMatrixWorld(true);
    this.vp.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    this.inv.copy(this.vp).invert();
  }

  /** Picks up a camera someone placed by hand (the hall). */
  syncCamera(): void {
    this.camPos.copy(this.camera.position);
    this.vp.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    this.inv.copy(this.vp).invert();
  }

  /** World pixels on the ground (lifted `h` world pixels) to CSS pixels on the screen. */
  project(x: number, y: number, h = 0): { x: number; y: number } {
    const e = this.vp.elements;
    const px = x / TILE;
    const py = h / TILE;
    const pz = y / TILE;
    const w = e[3]! * px + e[7]! * py + e[11]! * pz + e[15]!;
    const nx = (e[0]! * px + e[4]! * py + e[8]! * pz + e[12]!) / w;
    const ny = (e[1]! * px + e[5]! * py + e[9]! * pz + e[13]!) / w;
    return { x: ((nx + 1) / 2) * this.cssW, y: ((1 - ny) / 2) * this.cssH };
  }

  /** A point on the screen (CSS pixels) to where it falls on the ground, in world pixels. */
  unproject(cx: number, cy: number): { x: number; y: number } {
    const nx = (cx / this.cssW) * 2 - 1;
    const ny = 1 - (cy / this.cssH) * 2;
    const near = this.v.set(nx, ny, -1).applyMatrix4(this.inv);
    const ax = near.x;
    const ay = near.y;
    const az = near.z;
    const far = this.v.set(nx, ny, 1).applyMatrix4(this.inv);
    const k = ay / (ay - far.y || 1e-6);
    return { x: (ax + (far.x - ax) * k) * TILE, y: (az + (far.z - az) * k) * TILE };
  }

  /** How far the player sees from the hero's spot toward the camera (for thinning what stands in between). */
  seeThrough(x: number, y: number, radius: number): void {
    const px = x / TILE;
    const pz = y / TILE;
    LIGHT.uSee.value.set(px, 0.6, pz, radius);
    LIGHT.uSeeDir.value.copy(this.camPos).sub(new THREE.Vector3(px, 0.6, pz)).normalize();
  }

  render(_dt: number): void {
    this.gl.render(this.scene, this.camera);
    // a phone that can't keep up draws fewer pixels rather than stutter (real time between frames; a tab left in the
    // background isn't a slow phone)
    const now = performance.now();
    const dt = (now - this.lastFrame) / 1000;
    this.lastFrame = now;
    if (dt > 0 && dt < 0.25) {
      if (dt > 1 / 40) this.slow++;
      else this.slow = Math.max(0, this.slow - 1);
      if (dt < 1 / 55) this.fast++;
      else this.fast = 0;
      if (this.slow > 90 && this.quality > 0.6) {
        this.quality = Math.max(0.6, this.quality - 0.15);
        this.slow = 0;
        this.fast = 0;
        this.gl.setPixelRatio(Math.min(this.lastDpr, MAX_DPR) * this.quality);
      } else if (this.fast > 1200 && this.quality < 1) {
        this.quality = Math.min(1, this.quality + 0.1);
        this.fast = 0;
        this.gl.setPixelRatio(Math.min(this.lastDpr, MAX_DPR) * this.quality);
      }
    }
  }

  dispose(): void {
    this.land?.dispose();
    this.cast.dispose();
    this.gl.dispose();
    this.gl.forceContextLoss();
    this.glCanvas.remove();
  }
}
