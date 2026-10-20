/**
 * The 3D side: a low-poly world per strip, cars built from their side profile (extruded and
 * bevelled, so they read as chunky toys), the six parts as real geometry, a chase camera for the
 * race and a turntable for the garage. Three.js loads with the game's chunk only.
 */
import * as THREE from 'three';
import type { BodyStyle, CarDef } from './cars';
import { getCosmetic } from './cosmetics';
import { ENV_DEFS, type EnvDef } from './envs';
import type { Levels } from './parts';
import { clamp, lerp, shade } from './util';

export interface CarLook {
  def: CarDef;
  levels: Levels;
  paint: string;
  livery: string;
  wheels: string;
  /** Helmet shell and stripe. */
  helmet: [string, string];
  suit: string;
}

export interface CarState {
  x: number;
  v: number;
  rpm: number;
  redline: number;
  spinning: boolean;
  dead: boolean;
  red: boolean;
}

export const DISTANCE_M = 402.336;
/** Lane centres: the player on the right (lane 0), the rival on the left. */
export const LANE_Z = [-2.7, 2.7] as const;
const LANE_W = 5.2;

// ---- body profiles: outline points (x 0 = rear, 1 = front; y 0 = ground, 1 = roof), glass polygon, wheels, seat
interface Profile {
  len: number;
  height: number;
  width: number;
  body: [number, number][];
  glass: [number, number][];
  /** Rear and front wheel centre x, and radius as a fraction of height. */
  wheels: [number, number, number];
  seat: [number, number];
  open?: boolean;
}

const P: Record<BodyStyle, Profile> = {
  bug: { len: 4.0, height: 1.5, width: 1.7, body: [[0.02, 0.18], [0, 0.45], [0.1, 0.72], [0.28, 0.95], [0.5, 1], [0.7, 0.9], [0.85, 0.6], [0.98, 0.38], [1, 0.18]], glass: [[0.2, 0.62], [0.3, 0.9], [0.5, 0.94], [0.66, 0.86], [0.74, 0.62]], wheels: [0.2, 0.8, 0.24], seat: [0.45, 0.72] },
  hatch: { len: 3.9, height: 1.5, width: 1.7, body: [[0, 0.18], [0, 0.6], [0.06, 0.95], [0.44, 1], [0.62, 0.98], [0.76, 0.62], [0.98, 0.56], [1, 0.18]], glass: [[0.09, 0.64], [0.13, 0.92], [0.44, 0.96], [0.6, 0.94], [0.7, 0.64]], wheels: [0.2, 0.8, 0.23], seat: [0.4, 0.7] },
  coupe: { len: 4.5, height: 1.3, width: 1.8, body: [[0, 0.2], [0.02, 0.55], [0.2, 0.62], [0.32, 0.98], [0.56, 1], [0.72, 0.68], [0.98, 0.5], [1, 0.2]], glass: [[0.22, 0.64], [0.33, 0.94], [0.55, 0.96], [0.68, 0.68]], wheels: [0.18, 0.82, 0.24], seat: [0.44, 0.7] },
  muscle: { len: 4.9, height: 1.35, width: 1.9, body: [[0, 0.22], [0, 0.62], [0.08, 0.66], [0.3, 0.7], [0.38, 0.98], [0.62, 1], [0.74, 0.7], [0.98, 0.64], [1, 0.22]], glass: [[0.3, 0.72], [0.39, 0.95], [0.61, 0.97], [0.7, 0.72]], wheels: [0.17, 0.8, 0.24], seat: [0.5, 0.72] },
  pickup: { len: 5.2, height: 1.75, width: 1.95, body: [[0, 0.25], [0, 0.68], [0.5, 0.68], [0.5, 0.95], [0.62, 1], [0.74, 0.98], [0.84, 0.66], [0.98, 0.6], [1, 0.25]], glass: [[0.52, 0.7], [0.53, 0.94], [0.73, 0.95], [0.8, 0.7]], wheels: [0.18, 0.82, 0.23], seat: [0.62, 0.74] },
  wagon: { len: 4.7, height: 1.5, width: 1.8, body: [[0, 0.2], [0, 0.95], [0.06, 1], [0.6, 1], [0.76, 0.62], [0.98, 0.56], [1, 0.2]], glass: [[0.05, 0.64], [0.07, 0.94], [0.6, 0.96], [0.7, 0.64]], wheels: [0.18, 0.82, 0.23], seat: [0.5, 0.72] },
  roadster: { len: 3.9, height: 1.1, width: 1.7, body: [[0, 0.25], [0.02, 0.75], [0.3, 0.8], [0.4, 0.95], [0.5, 1], [0.6, 0.95], [0.72, 0.75], [0.98, 0.62], [1, 0.25]], glass: [[0.52, 0.8], [0.6, 0.98], [0.66, 0.78]], wheels: [0.18, 0.82, 0.26], seat: [0.4, 0.9], open: true },
  sedan: { len: 4.8, height: 1.45, width: 1.85, body: [[0, 0.2], [0, 0.62], [0.16, 0.66], [0.3, 0.98], [0.62, 1], [0.76, 0.66], [0.98, 0.58], [1, 0.2]], glass: [[0.18, 0.68], [0.31, 0.95], [0.6, 0.96], [0.7, 0.68]], wheels: [0.17, 0.82, 0.22], seat: [0.48, 0.72] },
  buggy: { len: 3.2, height: 1.3, width: 1.6, body: [[0.05, 0.3], [0.05, 0.6], [0.3, 0.6], [0.4, 0.9], [0.5, 0.95], [0.6, 0.9], [0.7, 0.6], [0.98, 0.5], [1, 0.3]], glass: [[0.62, 0.62], [0.7, 0.9], [0.76, 0.62]], wheels: [0.2, 0.8, 0.3], seat: [0.5, 0.95], open: true },
  gt: { len: 4.7, height: 1.3, width: 1.85, body: [[0, 0.22], [0.02, 0.6], [0.14, 0.64], [0.26, 0.98], [0.48, 1], [0.6, 0.7], [0.98, 0.52], [1, 0.22]], glass: [[0.16, 0.66], [0.27, 0.95], [0.47, 0.96], [0.57, 0.7]], wheels: [0.17, 0.82, 0.24], seat: [0.4, 0.72] },
  super: { len: 4.5, height: 1.15, width: 1.95, body: [[0, 0.25], [0, 0.62], [0.2, 0.7], [0.36, 0.98], [0.56, 1], [0.7, 0.66], [0.98, 0.4], [1, 0.25]], glass: [[0.22, 0.72], [0.37, 0.95], [0.55, 0.96], [0.66, 0.68]], wheels: [0.18, 0.82, 0.25], seat: [0.48, 0.72] },
  hyper: { len: 4.6, height: 1.1, width: 2.0, body: [[0, 0.3], [0.02, 0.7], [0.26, 0.74], [0.4, 0.98], [0.58, 1], [0.7, 0.62], [0.98, 0.36], [1, 0.3]], glass: [[0.28, 0.76], [0.41, 0.95], [0.57, 0.96], [0.66, 0.64]], wheels: [0.18, 0.82, 0.25], seat: [0.5, 0.74] },
  suv: { len: 4.8, height: 1.8, width: 1.9, body: [[0, 0.25], [0, 0.95], [0.06, 1], [0.62, 1], [0.76, 0.66], [0.98, 0.6], [1, 0.25]], glass: [[0.05, 0.68], [0.07, 0.94], [0.62, 0.96], [0.7, 0.68]], wheels: [0.18, 0.82, 0.24], seat: [0.5, 0.74] },
  dragster: { len: 7.4, height: 0.9, width: 0.8, body: [[0, 0.5], [0.02, 0.95], [0.12, 1], [0.2, 0.7], [0.3, 0.6], [0.96, 0.45], [1, 0.3], [0.96, 0.28], [0.3, 0.4], [0.02, 0.35]], glass: [], wheels: [0.1, 0.92, 0.5], seat: [0.16, 0.95], open: true },
  van: { len: 5.6, height: 1.6, width: 2.0, body: [[0, 0.3], [0, 0.85], [0.1, 1], [0.6, 1], [0.8, 0.8], [0.98, 0.6], [1, 0.3]], glass: [[0.56, 0.72], [0.6, 0.96], [0.78, 0.8], [0.84, 0.66]], wheels: [0.14, 0.84, 0.3], seat: [0.5, 0.75] },
};

export const profileOf = (def: CarDef): Profile => P[def.style];

const matCache = new Map<string, THREE.MeshLambertMaterial>();
const mat = (color: string, extra?: Partial<THREE.MeshLambertMaterialParameters>): THREE.MeshLambertMaterial => {
  const key = color + JSON.stringify(extra ?? {});
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color, ...extra });
    matCache.set(key, m);
  }
  return m;
};
const box = (w: number, h: number, d: number, color: string, x = 0, y = 0, z = 0): THREE.Mesh => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  return m;
};

/** Deterministic pseudo-noise for scenery. */
const noise = (i: number, k = 1): number => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// ---- liveries as canvas textures: one for the sides (doors), one for the top (roof, hood, trunk)
function paintOf(look: CarLook): string {
  const c = getCosmetic(look.paint)?.colors[0];
  return look.paint === 'p-stock' || !c ? look.def.color : c;
}

function liveryTextures(look: CarLook): { side: THREE.CanvasTexture; top: THREE.CanvasTexture } {
  const paint = paintOf(look);
  const liv = getCosmetic(look.livery);
  const chrome = look.levels.looks >= 7;
  const make = (draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void): THREE.CanvasTexture => {
    const cv = document.createElement('canvas');
    cv.width = 256;
    cv.height = 128;
    const ctx = cv.getContext('2d')!;
    ctx.fillStyle = paint;
    ctx.fillRect(0, 0, 256, 128);
    draw(ctx, 256, 128);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.magFilter = THREE.LinearFilter;
    return t;
  };
  // Sides: u = rear→front, v = ground→roof.
  const side = make((ctx, w, h) => {
    ctx.fillStyle = shade(paint, -0.28);
    ctx.fillRect(0, h * 0.72, w, h * 0.28);
    if (chrome) {
      ctx.fillStyle = '#f4f4f4';
      ctx.fillRect(0, h * 0.7, w, h * 0.035);
    }
    if (!liv) return;
    switch (liv.id) {
      case 'l-roundel': {
        ctx.fillStyle = liv.colors[0]!;
        ctx.beginPath();
        ctx.arc(w * 0.5, h * 0.48, h * 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = liv.colors[1]!;
        ctx.font = `bold ${h * 0.3}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.save();
        ctx.translate(w * 0.5, h * 0.48);
        ctx.scale(1, -1);
        ctx.fillText('7', 0, 0);
        ctx.restore();
        break;
      }
      case 'l-swoosh':
        ctx.fillStyle = liv.colors[0]!;
        ctx.beginPath();
        ctx.moveTo(0, h * 0.3);
        ctx.lineTo(w * 0.7, h * 0.5);
        ctx.lineTo(w, h * 0.36);
        ctx.lineTo(w, h * 0.3);
        ctx.lineTo(w * 0.6, h * 0.42);
        ctx.lineTo(0, h * 0.22);
        ctx.closePath();
        ctx.fill();
        break;
      case 'l-flames':
        for (let i = 0; i < 2; i++) {
          ctx.fillStyle = liv.colors[i]!;
          const k = 1 - i * 0.35;
          ctx.beginPath();
          ctx.moveTo(w, h * 0.3);
          ctx.lineTo(w * (1 - 0.18 * k), h * 0.55);
          ctx.lineTo(w * (1 - 0.28 * k), h * 0.34);
          ctx.lineTo(w * (1 - 0.4 * k), h * 0.6);
          ctx.lineTo(w * (1 - 0.52 * k), h * 0.3);
          ctx.lineTo(w, h * 0.2);
          ctx.closePath();
          ctx.fill();
        }
        break;
      case 'l-checker': {
        const n = 4;
        const cw = (w * 0.22) / n;
        for (let i = 0; i < n; i++)
          for (let j = 0; j < 3; j++) {
            ctx.fillStyle = liv.colors[(i + j) % 2]!;
            ctx.fillRect(i * cw, h * 0.3 + j * cw, cw, cw);
          }
        break;
      }
      case 'l-camo':
        for (let i = 0; i < 9; i++) {
          ctx.fillStyle = liv.colors[i % 2]!;
          ctx.beginPath();
          ctx.ellipse(w * (0.05 + noise(i, 3) * 0.9), h * (0.25 + noise(i, 4) * 0.5), w * (0.05 + noise(i, 5) * 0.08), h * 0.12, noise(i, 6), 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      case 'l-rainbow':
        liv.colors.forEach((col, i) => {
          ctx.fillStyle = col;
          ctx.fillRect(0, h * 0.5 - i * h * 0.06, w, h * 0.06);
        });
        break;
    }
  });
  // Top: u = rear→front, v = across the width.
  const top = make((ctx, w, h) => {
    if (!liv) return;
    switch (liv.id) {
      case 'l-stripes':
        ctx.fillStyle = liv.colors[0]!;
        ctx.fillRect(0, h * 0.4, w, h * 0.07);
        ctx.fillRect(0, h * 0.53, w, h * 0.07);
        break;
      case 'l-rainbow':
        liv.colors.forEach((col, i) => {
          ctx.fillStyle = col;
          ctx.fillRect(0, h * (0.36 + i * 0.07), w, h * 0.07);
        });
        break;
      case 'l-flames':
        for (let i = 0; i < 2; i++) {
          ctx.fillStyle = liv.colors[i]!;
          const k = 1 - i * 0.35;
          ctx.beginPath();
          ctx.moveTo(w, h * 0.2);
          ctx.lineTo(w * (1 - 0.2 * k), h * 0.35);
          ctx.lineTo(w * (1 - 0.3 * k), h * 0.22);
          ctx.lineTo(w * (1 - 0.38 * k), h * 0.5);
          ctx.lineTo(w * (1 - 0.3 * k), h * 0.78);
          ctx.lineTo(w * (1 - 0.2 * k), h * 0.65);
          ctx.lineTo(w, h * 0.8);
          ctx.closePath();
          ctx.fill();
        }
        break;
      case 'l-checker': {
        const n = 6;
        const cw = h / n;
        for (let i = 0; i < 3; i++)
          for (let j = 0; j < n; j++) {
            ctx.fillStyle = liv.colors[(i + j) % 2]!;
            ctx.fillRect(i * cw, j * cw, cw, cw);
          }
        break;
      }
      case 'l-camo':
        for (let i = 0; i < 9; i++) {
          ctx.fillStyle = liv.colors[i % 2]!;
          ctx.beginPath();
          ctx.ellipse(w * (0.05 + noise(i, 7) * 0.9), h * (0.15 + noise(i, 8) * 0.7), w * (0.05 + noise(i, 9) * 0.08), h * 0.16, noise(i, 10), 0, Math.PI * 2);
          ctx.fill();
        }
        break;
    }
  });
  return { side, top };
}

export interface CarRig {
  group: THREE.Group;
  wheels: THREE.Object3D[];
  wheelR: number;
  flames: THREE.Object3D[];
  shiftLamp: THREE.MeshLambertMaterial | null;
  smoke: THREE.Mesh[];
  len: number;
  dispose(): void;
}

/** Builds a car from its look: origin on the ground under the car's centre, nose toward +x. */
export function buildCar(look: CarLook): CarRig {
  const p = P[look.def.style];
  const lv = look.levels;
  const L = p.len;
  const H = p.height;
  const W = p.width;
  const paint = paintOf(look);
  const g = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const bigRear = look.def.style === 'dragster' || look.def.style === 'van';
  const wr = (p.wheels[2] + lv.tyres * 0.012) * H;
  const lift = wr * 0.95 - lv.suspension * 0.02 * H;
  const bodyH = H - wr * 0.3;
  const X = (u: number): number => u * L - L / 2;
  const Y = (v: number): number => lift + v * bodyH;

  // body
  const shape = new THREE.Shape(p.body.map(([u, v]) => new THREE.Vector2(X(u), Y(v))));
  const bevel = Math.min(0.1, W * 0.06);
  const bodyGeo = new THREE.ExtrudeGeometry(shape, { depth: W - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, steps: 1 });
  bodyGeo.translate(0, 0, -(W - bevel * 2) / 2);
  const tex = liveryTextures(look);
  tex.side.repeat.set(1 / L, 1 / bodyH);
  tex.side.offset.set(0.5, -lift / bodyH);
  tex.top.repeat.set(1 / L, -1 / W);
  tex.top.offset.set(0.5, 1 / W + bevel / W);
  const sideMat = new THREE.MeshLambertMaterial({ map: tex.side });
  const topMat = new THREE.MeshLambertMaterial({ map: tex.top });
  const body = new THREE.Mesh(bodyGeo, [sideMat, topMat]);
  body.castShadow = true;
  g.add(body);
  disposables.push(bodyGeo, sideMat, topMat, tex.side, tex.top);

  // glass: pokes through both sides
  if (p.glass.length) {
    const gs = new THREE.Shape(p.glass.map(([u, v]) => new THREE.Vector2(X(u), Y(v))));
    const gg = new THREE.ExtrudeGeometry(gs, { depth: W + 0.04, bevelEnabled: false });
    gg.translate(0, 0, -(W + 0.04) / 2);
    const glass = new THREE.Mesh(gg, mat('#1d3557'));
    g.add(glass);
    disposables.push(gg);
  }

  // wheels
  const rim = getCosmetic(look.wheels)?.colors[0] ?? '#8a8a8a';
  const wheels: THREE.Object3D[] = [];
  const tw = 0.24 + lv.tyres * 0.02;
  const wheelAt = (u: number, r: number, width: number, side: 1 | -1): void => {
    const w = new THREE.Group();
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(r, r, width, 14), mat(lv.tyres >= 5 ? '#1a1820' : '#23212b'));
    tyre.rotation.x = Math.PI / 2;
    tyre.castShadow = true;
    w.add(tyre);
    const spokes = look.wheels === 'w-mesh' ? 10 : look.wheels === 'w-turbine' ? 6 : look.wheels === 'w-deep' ? 4 : look.wheels === 'w-steel' ? 12 : 5;
    const rimM = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, width + 0.02, spokes), mat(rim));
    rimM.rotation.x = Math.PI / 2;
    w.add(rimM);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.18, r * 0.18, width + 0.06, 6), mat(shade(rim, 0.35)));
    hub.rotation.x = Math.PI / 2;
    w.add(hub);
    w.position.set(X(u), r, side * (W / 2 + width / 2 - 0.1));
    g.add(w);
    wheels.push(w);
    disposables.push(tyre.geometry, rimM.geometry, hub.geometry);
  };
  const frontR = look.def.style === 'dragster' ? wr * 0.45 : wr;
  for (const s of [1, -1] as const) {
    wheelAt(p.wheels[0], wr, bigRear ? tw * 2 : tw, s);
    wheelAt(p.wheels[1], frontR, look.def.style === 'dragster' ? tw * 0.5 : tw, s);
  }

  // lights
  g.add(box(0.06, 0.14, W * 0.18, '#ffe66d', X(1) + 0.02, Y(0.4), W * 0.3));
  g.add(box(0.06, 0.14, W * 0.18, '#ffe66d', X(1) + 0.02, Y(0.4), -W * 0.3));
  g.add(box(0.06, 0.12, W * 0.2, '#e63946', X(0) - 0.02, Y(0.44), W * 0.3));
  g.add(box(0.06, 0.12, W * 0.2, '#e63946', X(0) - 0.02, Y(0.44), -W * 0.3));

  // --- visible parts
  // aero: splitter, spoiler, diffuser
  if (lv.aero >= 2) g.add(box(0.5, 0.05, W * 0.95, '#23212b', X(1) - 0.1, lift * 0.55, 0));
  if (lv.aero >= 1 && look.def.style !== 'dragster') {
    const wingH = lv.aero >= 7 ? 0.5 : lv.aero >= 4 ? 0.32 : 0.1;
    const top = Y(p.body[1]![1]) + 0.02;
    const wing = box(0.45, 0.06, W * 0.92, '#23212b', X(0.08), top + wingH, 0);
    g.add(wing);
    if (wingH > 0.15) {
      g.add(box(0.08, wingH, 0.08, '#23212b', X(0.08), top + wingH / 2, W * 0.35));
      g.add(box(0.08, wingH, 0.08, '#23212b', X(0.08), top + wingH / 2, -W * 0.35));
    }
  }
  if (lv.aero >= 5) g.add(box(0.5, 0.08, W * 0.8, '#23212b', X(0) + 0.1, lift * 0.5, 0));
  // engine: scoop and pipes with flames
  const flames: THREE.Object3D[] = [];
  if (lv.engine >= 3 && !p.open) {
    const hoodY = Y(p.body[p.body.length - 3]![1]);
    g.add(box(0.5, 0.14, W * 0.3, shade(paint, -0.5), X(0.84), hoodY + 0.05, 0));
  }
  if (lv.engine >= 6) {
    for (const z of [W * 0.25, -W * 0.25]) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.35, 8), mat('#c0c0c0'));
      pipe.rotation.z = Math.PI / 2;
      pipe.position.set(X(0) - 0.1, lift * 0.7, z);
      g.add(pipe);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.6, 6), mat('#ff8500', { emissive: '#ff5500', emissiveIntensity: 1 }));
      flame.rotation.z = Math.PI / 2;
      flame.position.set(X(0) - 0.55, lift * 0.7, z);
      flame.visible = false;
      g.add(flame);
      flames.push(flame);
      disposables.push(pipe.geometry, flame.geometry);
    }
  }
  // transmission: shift light on the roof
  let shiftLamp: THREE.MeshLambertMaterial | null = null;
  if (lv.transmission >= 2 && !p.open) {
    shiftLamp = new THREE.MeshLambertMaterial({ color: '#3a3845', emissive: '#000000' });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), shiftLamp);
    lamp.position.set(X(0.45), Y(1) + 0.04, 0);
    g.add(lamp);
    disposables.push(lamp.geometry, shiftLamp);
  }
  // looks: underglow
  if (lv.looks >= 4) {
    const glowColor = lv.looks >= 7 ? '#ff5fa2' : '#c4f034';
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(L * 0.85, W * 1.25), new THREE.MeshBasicMaterial({ color: glowColor, transparent: true, opacity: 0.28, depthWrite: false }));
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.02;
    g.add(glow);
    disposables.push(glow.geometry, glow.material);
  }
  // the driver: a helmet in open cars
  if (p.open) {
    const hr = H * 0.17;
    const head = new THREE.Mesh(new THREE.SphereGeometry(hr, 10, 8), mat(look.helmet[0]));
    head.position.set(X(p.seat[0]), Y(p.seat[1]) + hr * 0.2, 0);
    g.add(head);
    const visor = new THREE.Mesh(new THREE.SphereGeometry(hr * 0.75, 8, 6), mat('#1d1238'));
    visor.position.set(X(p.seat[0]) + hr * 0.45, Y(p.seat[1]) + hr * 0.15, 0);
    g.add(visor);
    const stripe = box(hr * 1.6, hr * 0.5, hr * 0.3, look.helmet[1], X(p.seat[0]), Y(p.seat[1]) + hr * 0.9, 0);
    g.add(stripe);
    const body2 = box(hr * 1.4, hr * 1.2, hr * 1.6, look.suit, X(p.seat[0]), Y(p.seat[1]) - hr * 0.9, 0);
    g.add(body2);
    disposables.push(head.geometry, visor.geometry);
  }

  // smoke pool
  const smoke: THREE.Mesh[] = [];
  const smokeGeo = new THREE.SphereGeometry(0.4, 6, 5);
  disposables.push(smokeGeo);
  for (let i = 0; i < 10; i++) {
    const m = new THREE.Mesh(smokeGeo, new THREE.MeshBasicMaterial({ color: '#f4f4f4', transparent: true, opacity: 0.6, depthWrite: false }));
    m.visible = false;
    g.add(m);
    smoke.push(m);
    disposables.push(m.material);
  }

  return {
    group: g,
    wheels,
    wheelR: wr,
    flames,
    shiftLamp,
    smoke,
    len: L,
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}

// ---- the world
interface World {
  group: THREE.Group;
  lamps: THREE.MeshLambertMaterial[];
  clouds: THREE.Object3D[];
  dispose(): void;
}

function textTexture(text: string, bg: string, fg: string, w = 256, h = 128, size = 72): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = fg;
  ctx.font = `900 ${size}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2 + 4);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function checkerTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 64;
  cv.height = 64;
  const ctx = cv.getContext('2d')!;
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) {
      ctx.fillStyle = (i + j) % 2 ? '#1d1238' : '#ffffff';
      ctx.fillRect(i * 16, j * 16, 16, 16);
    }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.NearestFilter;
  return t;
}

function buildWorld(env: EnvDef): World {
  const g = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const lamps: THREE.MeshLambertMaterial[] = [];
  const clouds: THREE.Object3D[] = [];
  const add = (m: THREE.Mesh, receive = false): THREE.Mesh => {
    m.receiveShadow = receive;
    g.add(m);
    disposables.push(m.geometry);
    return m;
  };

  // sky dome with a vertical gradient
  const skyGeo = new THREE.SphereGeometry(900, 16, 10);
  const pos = skyGeo.attributes.position!;
  const colors = new Float32Array(pos.count * 3);
  const top = new THREE.Color(env.sky[0]);
  const bottom = new THREE.Color(env.sky[1]);
  for (let i = 0; i < pos.count; i++) {
    const t = clamp(pos.getY(i) / 900, -0.05, 1);
    const c = bottom.clone().lerp(top, Math.pow(Math.max(0, t), 0.6));
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  skyGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }));
  sky.position.set(200, -20, 0);
  g.add(sky);
  disposables.push(skyGeo, sky.material);
  if (env.sun) {
    const sun = new THREE.Mesh(new THREE.SphereGeometry(env.sun.r, 12, 8), new THREE.MeshBasicMaterial({ color: env.sun.color, fog: false }));
    sun.position.set(env.sun.x + 200, env.sun.y, env.sun.z);
    g.add(sun);
    disposables.push(sun.geometry, sun.material);
  }
  // clouds
  const cloudMat = new THREE.MeshLambertMaterial({ color: '#ffffff', fog: false });
  for (let i = 0; i < 9; i++) {
    const c = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const s = 6 + noise(i * 3 + k, 11) * 6;
      const puff = new THREE.Mesh(new THREE.SphereGeometry(s, 7, 5), cloudMat);
      puff.scale.y = 0.45;
      puff.position.set(k * s * 0.9 - s, 0, 0);
      c.add(puff);
      disposables.push(puff.geometry);
    }
    c.position.set(-100 + noise(i, 12) * 700, 70 + noise(i, 13) * 40, (noise(i, 14) - 0.5) * 500);
    g.add(c);
    clouds.push(c);
  }
  disposables.push(cloudMat);

  // ground and verge
  add(new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), mat(env.ground)).rotateX(-Math.PI / 2), true).position.set(200, -0.02, 0);
  add(new THREE.Mesh(new THREE.PlaneGeometry(620, 46), mat(env.verge)).rotateX(-Math.PI / 2), true).position.set(200, -0.01, 0);
  // the strip: two lanes
  add(new THREE.Mesh(new THREE.PlaneGeometry(620, LANE_W * 2 + 1), mat(env.track)).rotateX(-Math.PI / 2), true).position.set(200, 0, 0);
  const lineGeo = new THREE.PlaneGeometry(620, 0.18);
  for (const z of [-(LANE_W + 0.4), 0, LANE_W + 0.4]) {
    const l = new THREE.Mesh(lineGeo, mat(env.line));
    l.rotation.x = -Math.PI / 2;
    l.position.set(200, 0.005, z);
    g.add(l);
  }
  disposables.push(lineGeo);
  // start line and distance marks
  add(new THREE.Mesh(new THREE.PlaneGeometry(0.4, LANE_W * 2 + 1), mat('#ffffff')).rotateX(-Math.PI / 2)).position.set(0, 0.006, 0);
  const markGeo = new THREE.PlaneGeometry(0.6, 1.2);
  for (let m = 20; m < DISTANCE_M; m += 20) {
    for (const z of [-(LANE_W + 0.8), LANE_W + 0.8]) {
      const k = new THREE.Mesh(markGeo, mat('#ffffff'));
      k.rotation.x = -Math.PI / 2;
      k.position.set(m, 0.006, z);
      g.add(k);
    }
    if (m % 100 === 0) {
      const t = textTexture(`${m}`, '#ffd23f', '#1d1238', 128, 64, 40);
      const sign = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.8, 1.6), [mat('#1d1238'), mat('#1d1238'), mat('#1d1238'), mat('#1d1238'), new THREE.MeshLambertMaterial({ map: t }), new THREE.MeshLambertMaterial({ map: t })]);
      sign.position.set(m, 1.6, -(LANE_W + 2.2));
      sign.rotation.y = Math.PI / 2;
      g.add(sign);
      g.add(box(0.12, 1.2, 0.12, '#1d1238', m, 0.6, -(LANE_W + 2.2)));
      disposables.push(sign.geometry, t);
    }
  }
  disposables.push(markGeo);
  // finish: checker band and the arch
  const chk = checkerTexture();
  chk.repeat.set(2, 12);
  const finish = new THREE.Mesh(new THREE.PlaneGeometry(2, LANE_W * 2 + 1), new THREE.MeshLambertMaterial({ map: chk }));
  finish.rotation.x = -Math.PI / 2;
  finish.position.set(DISTANCE_M + 1, 0.007, 0);
  g.add(finish);
  disposables.push(finish.geometry, finish.material, chk);
  for (const z of [-(LANE_W + 1.5), LANE_W + 1.5]) g.add(box(0.4, 7, 0.4, '#1d1238', DISTANCE_M, 3.5, z));
  const ft = textTexture('FINISH', '#e63946', '#ffffff', 512, 96, 64);
  const bannerMesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.6, LANE_W * 2 + 3.4), [new THREE.MeshLambertMaterial({ map: ft }), new THREE.MeshLambertMaterial({ map: ft }), mat('#e63946'), mat('#e63946'), mat('#e63946'), mat('#e63946')]);
  bannerMesh.position.set(DISTANCE_M, 7, 0);
  g.add(bannerMesh);
  disposables.push(bannerMesh.geometry, ft);
  // the tree
  const tree = new THREE.Group();
  tree.add(box(0.14, 5.2, 0.14, '#1d1238', 0, 2.6, 0));
  tree.add(box(0.5, 3.4, 0.9, '#1d1238', 0, 3.6, 0));
  const lampGeo = new THREE.SphereGeometry(0.2, 10, 8);
  const lampColors = ['#ffb703', '#ffb703', '#ffb703', '#06d6a0', '#e63946'];
  lampColors.forEach((c, i) => {
    const m = new THREE.MeshLambertMaterial({ color: '#3a3845', emissive: '#000000' });
    m.userData = { on: c };
    for (const side of [0.5, -0.5]) {
      const l = new THREE.Mesh(lampGeo, m);
      l.position.set(side * 0.3, 5 - i * 0.62, side * 0.6);
      tree.add(l);
    }
    lamps.push(m);
    disposables.push(m);
  });
  // Ahead of the noses, between the lanes, like a real tree: both drivers see it from the chase camera.
  tree.position.set(6, 0, 0);
  g.add(tree);
  disposables.push(lampGeo);

  // grandstands with a crowd
  const standGeo = new THREE.BoxGeometry(18, 1, 2.4);
  const crowdGeo = new THREE.SphereGeometry(0.28, 6, 5);
  const crowdCount = 24 * 2 * 3 * 10;
  const crowd = new THREE.InstancedMesh(crowdGeo, new THREE.MeshLambertMaterial({ color: '#ffffff' }), crowdCount);
  const dummy = new THREE.Object3D();
  const palette = ['#1d1238', '#ffffff', '#ffd23f', '#5ad1ff', '#ff6b9d', '#c4f034'];
  let ci = 0;
  for (let seg = 0; seg < 24; seg++) {
    const x = -30 + seg * 20;
    for (const side of [1, -1]) {
      for (let row = 0; row < 3; row++) {
        const s = new THREE.Mesh(standGeo, mat(seg % 3 === 0 ? env.stand : shade(env.stand, 0.25)));
        s.position.set(x, 0.5 + row, side * (LANE_W + 7 + row * 2.4));
        g.add(s);
        for (let k = 0; k < 10; k++) {
          dummy.position.set(x - 8 + k * 1.75, 1.3 + row, side * (LANE_W + 7 + row * 2.4) + (noise(ci, 15) - 0.5));
          dummy.scale.setScalar(0.8 + noise(ci, 16) * 0.5);
          dummy.updateMatrix();
          crowd.setMatrixAt(ci, dummy.matrix);
          crowd.setColorAt(ci, new THREE.Color(palette[(ci * 7 + seg) % palette.length]!));
          ci++;
        }
      }
    }
  }
  crowd.count = ci;
  g.add(crowd);
  disposables.push(standGeo, crowdGeo, crowd.material, crowd);

  // props beside the strip
  const prop = (i: number): THREE.Group => {
    const pg = new THREE.Group();
    const s = 0.8 + noise(i, 20) * 0.7;
    if (env.mid === 'cactus') {
      const c = '#2d6a4f';
      pg.add(box(0.5 * s, 3 * s, 0.5 * s, c, 0, 1.5 * s, 0));
      pg.add(box(0.35 * s, 1.2 * s, 0.35 * s, c, 0.9 * s, 1.6 * s, 0));
      pg.add(box(1.0 * s, 0.35 * s, 0.35 * s, c, 0.5 * s, 1.1 * s, 0));
      pg.add(box(0.35 * s, 1.4 * s, 0.35 * s, c, -0.9 * s, 2.1 * s, 0));
      pg.add(box(1.0 * s, 0.35 * s, 0.35 * s, c, -0.5 * s, 1.5 * s, 0));
    } else if (env.mid === 'palm') {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * s, 0.3 * s, 6 * s, 6), mat('#9c6644'));
      trunk.position.y = 3 * s;
      pg.add(trunk);
      disposables.push(trunk.geometry);
      for (let k = 0; k < 6; k++) {
        const leaf = box(3 * s, 0.12 * s, 0.6 * s, '#40916c', 1.3 * s, 6 * s, 0);
        leaf.rotation.z = -0.5;
        const holder = new THREE.Group();
        holder.add(leaf);
        holder.rotation.y = (k / 6) * Math.PI * 2;
        holder.position.y = 0;
        pg.add(holder);
      }
    } else if (env.mid === 'pine') {
      pg.add(box(0.4 * s, 1.2 * s, 0.4 * s, '#6f4e37', 0, 0.6 * s, 0));
      for (let k = 0; k < 3; k++) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry((2.2 - k * 0.5) * s, 2.4 * s, 6), mat(k % 2 ? '#40916c' : '#2d6a4f'));
        cone.position.y = (1.6 + k * 1.5) * s;
        pg.add(cone);
        disposables.push(cone.geometry);
      }
    } else {
      pg.add(box(0.2, 6, 0.2, '#3c2a4d', 0, 3, 0));
      const lanternColors = ['#ffd23f', '#ff6b9d', '#5ad1ff', '#c4f034'];
      for (let k = 0; k < 5; k++) {
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), mat(lanternColors[(k + i) % 4]!, { emissive: lanternColors[(k + i) % 4], emissiveIntensity: 0.6 }));
        lamp.position.set(k * 2.8 - 5.6, 5.4 - Math.abs(k - 2) * 0.35, 0);
        pg.add(lamp);
        disposables.push(lamp.geometry);
      }
    }
    return pg;
  };
  for (let i = 0; i < 34; i++) {
    for (const side of [1, -1]) {
      const pg = prop(i * 2 + (side > 0 ? 0 : 1));
      pg.position.set(-40 + i * 14 + noise(i, 21) * 6, 0, side * (LANE_W + 16 + noise(i, 22) * 6));
      g.add(pg);
    }
  }

  // far scenery
  for (let i = 0; i < 44; i++) {
    const side = i % 2 ? 1 : -1;
    const x = -300 + (i >> 1) * 42;
    const z = side * (220 + noise(i, 30) * 90);
    if (env.far === 'mountains' || env.far === 'peaks') {
      const h = 40 + noise(i, 31) * 70;
      const m = new THREE.Mesh(new THREE.ConeGeometry(50 + noise(i, 32) * 40, h, 5), mat(i % 3 ? env.farColor : env.farColor2));
      m.position.set(x, h / 2 - 2, z);
      m.rotation.y = noise(i, 33) * 3;
      g.add(m);
      disposables.push(m.geometry);
      if (env.far === 'peaks') {
        const cap = new THREE.Mesh(new THREE.ConeGeometry(16, h * 0.32, 5), mat('#ffffff'));
        cap.position.set(x, h - h * 0.16 - 2, z);
        cap.rotation.y = m.rotation.y;
        g.add(cap);
        disposables.push(cap.geometry);
      }
    } else if (env.far === 'skyline') {
      for (let k = 0; k < 3; k++) {
        const h = 20 + noise(i * 3 + k, 34) * 60;
        g.add(box(14 + noise(i * 3 + k, 35) * 10, h, 14, k % 2 ? env.farColor : env.farColor2, x + k * 18, h / 2, z));
      }
    } else {
      const h = 18 + noise(i, 36) * 14;
      const t = new THREE.Mesh(new THREE.ConeGeometry(16, h, 8), mat(i % 2 ? env.farColor : env.farColor2));
      t.position.set(x, h / 2, z);
      g.add(t);
      disposables.push(t.geometry);
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(22, 1.2, 6, 14), mat('#ffd23f', { emissive: '#ffd23f', emissiveIntensity: 0.4 }));
      if (i === 5) {
        wheel.position.set(x, 26, z);
        g.add(wheel);
        disposables.push(wheel.geometry);
      }
    }
  }

  return {
    group: g,
    lamps,
    clouds,
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}

// ---- the stage
export class Stage3D {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(58, 1, 0.1, 1600);
  private sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private world: World | null = null;
  private envId = '';
  private cars: (CarRig | null)[] = [null, null];
  private camPos = new THREE.Vector3(-9, 3.4, 0);
  private camAim = new THREE.Vector3(8, 1, 0);
  private w = 1;
  private h = 1;
  private smokeT = 0;

  constructor(canvas?: HTMLCanvasElement, shadows = true) {
    this.canvas = canvas ?? document.createElement('canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.shadowMap.enabled = shadows;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.hemi = new THREE.HemisphereLight('#ffffff', '#888888', 1.1);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff4d6', 1.6);
    this.sun.castShadow = shadows;
    this.sun.shadow.mapSize.set(1024, 1024);
    const sc = this.sun.shadow.camera;
    sc.left = -16;
    sc.right = 16;
    sc.top = 16;
    sc.bottom = -16;
    sc.near = 1;
    sc.far = 120;
    this.sun.shadow.bias = -0.002;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
  }

  setEnv(id: string): void {
    if (id === this.envId && this.world) return;
    const env = ENV_DEFS[id] ?? ENV_DEFS['e-desert']!;
    if (this.world) {
      this.scene.remove(this.world.group);
      this.world.dispose();
    }
    this.world = buildWorld(env);
    this.scene.add(this.world.group);
    this.envId = env.id;
    this.scene.fog = new THREE.Fog(env.sky[1], 80, 520);
    this.hemi.color.set(env.light[0]);
    this.hemi.groundColor.set(env.light[1]);
  }

  setCar(i: 0 | 1, look: CarLook | null): void {
    const old = this.cars[i];
    if (old) {
      this.scene.remove(old.group);
      old.dispose();
      this.cars[i] = null;
    }
    if (!look) return;
    const rig = buildCar(look);
    rig.group.position.set(0, 0, LANE_Z[i]);
    this.scene.add(rig.group);
    this.cars[i] = rig;
  }

  resize(w: number, h: number, dpr: number): void {
    this.w = Math.max(1, Math.floor(w));
    this.h = Math.max(1, Math.floor(h));
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(this.w, this.h, false);
    this.camera.aspect = this.w / this.h;
    this.camera.updateProjectionMatrix();
  }

  private placeCar(i: 0 | 1, s: CarState, dt: number, t: number): void {
    const rig = this.cars[i];
    if (!rig) return;
    rig.group.position.x = s.x;
    const spin = s.spinning ? s.v + 18 : s.v;
    for (const w of rig.wheels) w.rotation.z -= (spin * dt) / rig.wheelR;
    // a touch of squat under power
    rig.group.rotation.z = lerp(rig.group.rotation.z, s.v > 0 && s.rpm / s.redline > 0.6 ? -0.025 : 0, 0.1);
    const frac = s.rpm / s.redline;
    for (const f of rig.flames) f.visible = frac > 0.86 && !s.dead && Math.sin(t * 60) > -0.3;
    if (rig.shiftLamp) rig.shiftLamp.emissive.set(frac > 0.9 && Math.sin(t * 40) > 0 ? '#ff2a1a' : '#000000');
    // smoke
    for (let k = 0; k < rig.smoke.length; k++) {
      const m = rig.smoke[k]!;
      const mt = m.material as THREE.MeshBasicMaterial;
      if (m.visible) {
        m.position.x -= (s.v * 0.3 + 2) * dt;
        m.position.y += 1.0 * dt;
        m.scale.addScalar(1.1 * dt);
        mt.opacity -= 0.8 * dt;
        if (mt.opacity <= 0) m.visible = false;
      }
    }
    if ((s.spinning || s.dead) && t - this.smokeT > 0.06) {
      this.smokeT = t;
      const m = rig.smoke.find((x) => !x.visible);
      if (m) {
        const mt = m.material as THREE.MeshBasicMaterial;
        mt.color.set(s.dead ? '#444444' : '#f4f4f4');
        mt.opacity = 0.5;
        m.scale.setScalar(0.5);
        m.visible = true;
        m.position.set(s.dead ? rig.len * 0.3 : -rig.len * 0.3, s.dead ? 1.2 : 0.3, (Math.random() - 0.5) * 1.6);
      }
    }
  }

  /** Draws one race frame from behind the player's car (or from a fixed camera, for pictures). */
  renderRace(cars: [CarState, CarState], ambers: number, green: boolean, t: number, dt: number, fixed?: { pos: [number, number, number]; aim: [number, number, number]; fov?: number }): void {
    if (!this.world) this.setEnv('e-desert');
    this.placeCar(0, cars[0], dt, t);
    this.placeCar(1, cars[1], dt, t);
    const me = cars[0];
    const lamps = this.world!.lamps;
    lamps.forEach((m, i) => {
      const on = i < 3 ? ambers > i && !green : i === 3 ? green : cars.some((c) => c.red);
      m.emissive.set(on ? (m.userData.on as string) : '#000000');
      m.color.set(on ? (m.userData.on as string) : '#3a3845');
    });
    for (const c of this.world!.clouds) c.position.x += dt * 1.5;
    const back = 8.5 + Math.min(4, me.v * 0.04);
    const target = new THREE.Vector3(me.x - back, 3.2 + Math.min(1, me.v * 0.01), LANE_Z[0] * 0.35);
    const aim = new THREE.Vector3(me.x + 10, 0.8, LANE_Z[0] * 0.15);
    const k = Math.min(1, dt * 6);
    this.camPos.lerp(target, k);
    this.camAim.lerp(aim, k);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camAim);
    this.camera.fov = 58 + Math.min(16, me.v * 0.14);
    if (fixed) {
      this.camera.position.set(...fixed.pos);
      this.camera.lookAt(...fixed.aim);
      this.camera.fov = fixed.fov ?? 50;
    }
    this.camera.updateProjectionMatrix();
    this.sun.position.set(me.x - 14, 36, 18);
    this.sun.target.position.set(me.x + 6, 0, 0);
    this.renderer.render(this.scene, this.camera);
  }

  /** The garage turntable: the player's car on the strip, camera circling slowly. */
  renderShowcase(t: number, angle = t * 0.35, close = false): void {
    if (!this.world) this.setEnv('e-desert');
    const rig = this.cars[0];
    if (rig) rig.group.position.set(6, 0, LANE_Z[0]);
    const r = close ? 5.2 + (rig?.len ?? 4.5) * 0.35 : 7.5;
    const cx = 6;
    const cz = LANE_Z[0];
    // Garage: the car sits in the upper half of the frame, the sheet covers the lower half. Thumbnails: filled.
    this.camera.position.set(cx + Math.cos(angle) * r, close ? 1.9 : 2.1, cz + Math.sin(angle) * r);
    this.camera.lookAt(cx, close ? 0.45 : -1.1, cz);
    this.camera.fov = close ? 36 : 50;
    this.camera.updateProjectionMatrix();
    this.sun.position.set(cx - 14, 36, 18);
    this.sun.target.position.set(cx, 0, cz);
    for (const c of this.world!.clouds) c.position.x += 0.02;
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    for (const i of [0, 1] as const) this.setCar(i, null);
    if (this.world) {
      this.scene.remove(this.world.group);
      this.world.dispose();
      this.world = null;
    }
    this.renderer.dispose();
  }
}

// ---- thumbnails: one shared offscreen stage renders cars to images
let thumbStage: Stage3D | null = null;
const thumbCache = new Map<string, string>();
export const lookKey = (look: CarLook): string => `${look.def.id}|${JSON.stringify(look.levels)}|${look.paint}|${look.livery}|${look.wheels}|${look.helmet.join()}|${look.suit}`;

/** A 3/4-front picture of a car as a data URL (cached). Returns '' when WebGL is unavailable. */
export function thumbnail(look: CarLook, env = 'e-desert'): string {
  const key = `${env}|${lookKey(look)}`;
  const hit = thumbCache.get(key);
  if (hit) return hit;
  try {
    if (!thumbStage) {
      thumbStage = new Stage3D(undefined, false);
      thumbStage.resize(240, 110, 1);
    }
    thumbStage.setEnv(env);
    thumbStage.setCar(0, look);
    thumbStage.renderShowcase(0, -0.75, true);
    const url = thumbStage.canvas.toDataURL('image/png');
    thumbCache.set(key, url);
    if (thumbCache.size > 200) thumbCache.delete(thumbCache.keys().next().value!);
    return url;
  } catch {
    return '';
  }
}
