import * as THREE from 'three';
import { TILE } from '../sim/map';
import { Cast } from './cast';
import { Fx3D } from './fx3d';
import { loadWardrobe } from './dress';
import { loadLand, PITCH, type Land3D, type LandPacks } from './land';
import { LIGHT } from './toon';
import { heldElsewhere, Pacer, QUALITY_FLOOR } from './pace';

/**
 * The 3D view, four layers deep under the player's touches:
 *
 *   ground (WebGL)      the land's floor and the soft shadows on it
 *   decals (2D)         what's drawn on the ground for the player: an aim, a way through a door
 *   what stands (WebGL) walls, trees, houses, people, and every spell and warning (fx3d.ts): it covers the layers below
 *                       where it stands, so a warning on the far side of a wall is behind the wall
 *   the game's canvas   numbers and names
 *
 * The camera looks down from the south at a steep angle.
 */

const FOV = 28;
/** Never renders more pixels than this per CSS pixel. */
const MAX_DPR = 2;
/**
 * On a phone, a little less: the screen is small enough that nobody sees the difference, and every pixel is drawn on
 * two canvases, which is most of what warms it.
 */
const MAX_DPR_TOUCH = 1.7;
/**
 * However slow a phone is, never fewer pixels drawn than the page has CSS pixels: under it the picture is a blur
 * under a sharp HUD (a 3x iPhone at the old floor drew 0.77 of a pixel for every CSS pixel).
 */
export const MIN_DPR_TOUCH = 1;

function layer(className: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.className = className;
  const st = c.style;
  st.position = 'absolute';
  st.left = '0';
  st.top = '0';
  st.width = '100%';
  st.height = '100%';
  st.pointerEvents = 'none';
  return c;
}

export class Stage {
  readonly gl: THREE.WebGLRenderer;
  readonly groundGl: THREE.WebGLRenderer;
  /** What stands. */
  readonly scene = new THREE.Scene();
  /** The floor and its shadows. */
  readonly groundScene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 1, 200);
  readonly glCanvas: HTMLCanvasElement;
  readonly groundCanvas: HTMLCanvasElement;
  readonly decalCanvas: HTMLCanvasElement;
  readonly decals: CanvasRenderingContext2D;
  readonly cast: Cast;
  /** Everything that glows, flows or burns. */
  readonly fx: Fx3D;
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
  /** Half the land in view, in tiles: what the land keeps standing. */
  spanX = 12;
  spanZ = 9;
  /** Rendering scale, lowered if the device struggles. */
  private readonly pacer = new Pacer();
  private maxDpr = MAX_DPR;
  private lastDpr = 1;
  private lastFrame = 0;

  constructor(overlay: HTMLCanvasElement) {
    this.groundCanvas = layer('rb-gl-ground');
    this.decalCanvas = layer('rb-gl-decals');
    this.glCanvas = layer('rb-gl-canvas');
    const host = overlay.parentElement;
    if (host) {
      host.insertBefore(this.groundCanvas, overlay);
      host.insertBefore(this.decalCanvas, overlay);
      host.insertBefore(this.glCanvas, overlay);
    }
    overlay.style.position = overlay.style.position || 'absolute';
    overlay.style.left = '0';
    overlay.style.top = '0';
    this.decals = this.decalCanvas.getContext('2d')!;
    this.groundGl = new THREE.WebGLRenderer({ canvas: this.groundCanvas, antialias: true, alpha: false, powerPreference: 'high-performance', stencil: false });
    this.gl = new THREE.WebGLRenderer({ canvas: this.glCanvas, antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance', stencil: false });
    for (const r of [this.gl, this.groundGl]) {
      r.outputColorSpace = THREE.LinearSRGBColorSpace;
      r.toneMapping = THREE.NoToneMapping;
    }
    this.gl.setClearColor(0x000000, 0);
    this.groundGl.setClearColor(0x07050d, 1);
    this.cast = new Cast(this.groundScene);
    this.scene.add(this.cast.root);
    this.fx = new Fx3D(this.scene);
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

  /** How near the camera stands, as a share of its usual distance: under 1 it has drawn in, over 1 stepped back. */
  push = 1;

  /** `tilePx`: device pixels a tile spans at the middle of the view. */
  setSize(cssW: number, cssH: number, dpr: number, tilePx: number, touch = false): void {
    this.cssW = cssW;
    this.cssH = cssH;
    this.lastDpr = dpr;
    this.maxDpr = touch ? MAX_DPR_TOUCH : MAX_DPR;
    const d = Math.min(dpr, this.maxDpr);
    const pacer = this.pacer;
    pacer.floor = touch ? Math.min(1, Math.max(QUALITY_FLOOR, MIN_DPR_TOUCH / d)) : QUALITY_FLOOR;
    pacer.quality = Math.max(pacer.quality, pacer.floor);
    for (const r of [this.gl, this.groundGl]) {
      r.setPixelRatio(d * pacer.quality);
      r.setSize(cssW, cssH, false);
    }
    // (the decals are drawn at the 2D renderer's scale, its own dpr up to 2: render/renderer.ts `k`. A touch screen's
    // lower cap here made every mark on the ground land ~18% too far from the corner: the aim, the rings, the doors)
    const dk = Math.min(dpr, 2);
    this.decalCanvas.width = Math.round(cssW * dk);
    this.decalCanvas.height = Math.round(cssH * dk);
    this.camera.aspect = cssW / Math.max(1, cssH);
    // distance at which a tile at the view's middle spans tilePx device pixels
    const devH = cssH * dpr;
    this.dist = devH / (2 * Math.tan((FOV * Math.PI) / 360) * tilePx);
    this.camera.near = Math.max(1, this.dist * 0.2);
    this.camera.far = this.dist * 4 + 60;
    this.camera.updateProjectionMatrix();
    this.spanZ = (devH / tilePx) / Math.sin(PITCH) / 2;
    this.spanX = (cssW * dpr) / tilePx / 2;
  }

  /** Points the camera at a spot on the ground (tiles), from as near as `push` says (a scene drawing in on a face). */
  look(cx: number, cz: number): void {
    const d = this.dist * this.push;
    this.camera.position.set(cx, d * Math.sin(PITCH), cz + d * Math.cos(PITCH));
    this.camera.lookAt(cx, 0, cz);
    this.camera.updateMatrixWorld(true);
    this.syncCamera();
  }

  /** Picks up a camera someone placed by hand (the hall). */
  syncCamera(): void {
    this.vp.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    this.inv.copy(this.vp).invert();
  }

  /** World pixels on the ground (lifted `h` world pixels) to CSS pixels on the screen. */
  project(x: number, y: number, h = 0): { x: number; y: number; front?: boolean } {
    const e = this.vp.elements;
    const px = x / TILE;
    const py = h / TILE;
    const pz = y / TILE;
    const w = e[3]! * px + e[7]! * py + e[11]! * pz + e[15]!;
    const nx = (e[0]! * px + e[4]! * py + e[8]! * pz + e[12]!) / w;
    const ny = (e[1]! * px + e[5]! * py + e[9]! * pz + e[13]!) / w;
    // (`front`: false for what is behind the camera, whose place on the screen comes out mirrored and means nothing)
    return { x: ((nx + 1) / 2) * this.cssW, y: ((1 - ny) / 2) * this.cssH, front: w > 0 };
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

  /** Where the hero stands, for the pool of light round them in a dark place. */
  heroAt(x: number, y: number): void {
    LIGHT.uSee.value.set(x / TILE, 0.6, y / TILE, 1);
  }

  /** Clears the ground's drawing layer for this frame and hands it over. */
  beginDecals(): CanvasRenderingContext2D {
    const g = this.decals;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.decalCanvas.width, this.decalCanvas.height);
    return g;
  }

  render(_dt: number): void {
    // (the step in quality is taken before the frame is drawn, never after it: changing a canvas's size empties it,
    // and a step taken after the drawing left that frame with nothing on it, the land and everyone on it gone dark
    // for a blink under the HUD)
    this.pace();
    this.groundGl.render(this.groundScene, this.camera);
    this.gl.render(this.scene, this.camera);
  }

  /** A machine that can't keep up draws fewer pixels rather than stutter (render3d/pace.ts). */
  private pace(): void {
    const now = performance.now();
    const dt = (now - this.lastFrame) / 1000;
    this.lastFrame = now;
    // (a menu's pictures being drawn: pace.ts busyElsewhere)
    if (heldElsewhere(now)) return;
    if (this.pacer.tick(dt)) this.applyQuality();
  }

  /** The player's graphics choice (Settings.graphics): applied on the next frame. */
  setGraphics(mode: 'auto' | 'high' | 'low'): void {
    this.pacer.mode = mode;
  }

  private applyQuality(): void {
    const d = Math.min(this.lastDpr, this.maxDpr) * this.pacer.quality;
    this.gl.setPixelRatio(d);
    this.groundGl.setPixelRatio(d);
  }

  dispose(): void {
    this.land?.dispose();
    this.cast.dispose();
    this.fx.dispose();
    for (const r of [this.gl, this.groundGl]) {
      r.dispose();
      r.forceContextLoss();
    }
    this.glCanvas.remove();
    this.groundCanvas.remove();
    this.decalCanvas.remove();
  }
}
