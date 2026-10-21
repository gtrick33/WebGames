/**
 * Builds a race car from a loaded model (models.ts): the body is repainted (the factory scheme, a
 * new colour over the atlas's own shading, or a livery mapped onto its sides and top), the wheels
 * become spinning parts, and the upgrades show: the aero kit (aero.ts) is snapped onto the body's
 * real surface by casting rays at it, the suspension drops the body toward the ground a step per
 * level, the tyres get coloured sidewall bands and lettering, and the looks add underglow and a
 * pinstripe. The engine and the transmission don't change the outside.
 */
import * as THREE from 'three';
import { buildAero, type BodySurface } from './aero';
import { getCosmetic } from './cosmetics';
import { blobTexture, mergeStatic, mesh, std } from './mats';
import { PACKS, type LoadedModel, type ModelPart, type Role } from './models';
import { MAX_LEVEL } from './parts';
import type { CarLook, CarRig } from './scene3d';
import { clamp, shade } from './util';

export function paintOf(look: CarLook): string {
  const c = getCosmetic(look.paint)?.colors[0];
  return look.paint === 'p-stock' || !c ? look.def.color : c;
}

// ---------------------------------------------------------------- livery mapping
/** Texture atlas: right side v 0..0.4, left side 0.4..0.8, top 0.8..1. u runs tail (0) to nose (1). */
const SIDE_R = 0;
const SIDE_L = 0.4;
const TOP = 0.8;
const uvCache = new Map<string, THREE.BufferGeometry>();

/** The paint geometry with atlas UVs (per face: tops from above, the rest from its side). */
function withLiveryUv(g: THREE.BufferGeometry, key: string, box: THREE.Box3): THREE.BufferGeometry {
  const hit = uvCache.get(key);
  if (hit) return hit;
  const out = g.index ? g.toNonIndexed() : g.clone();
  const p = out.attributes.position!;
  const uv = new Float32Array(p.count * 2);
  const L = box.max.x - box.min.x;
  const H = box.max.y;
  const W = box.max.z - box.min.z;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i);
    b.fromBufferAttribute(p, i + 1);
    c.fromBufferAttribute(p, i + 2);
    n.subVectors(c, b).cross(b.clone().sub(a)).normalize();
    // the winding gives an outward normal for front faces; either way "up" is what matters
    const up = Math.abs(n.y) > 0.62 && (a.y + b.y + c.y) / 3 > H * 0.35;
    const zc = (a.z + b.z + c.z) / 3;
    for (let k = 0; k < 3; k++) {
      const v = k === 0 ? a : k === 1 ? b : c;
      const u = (v.x - box.min.x) / L;
      uv[(i + k) * 2] = u;
      uv[(i + k) * 2 + 1] = up ? TOP + 0.2 * clamp((v.z - box.min.z) / W, 0, 1) : (zc >= 0 ? SIDE_R : SIDE_L) + 0.4 * clamp(v.y / H, 0, 1);
    }
  }
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.computeVertexNormals();
  uvCache.set(key, out);
  return out;
}

const noise = (i: number, k = 1): number => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Paints the atlas: base colour, the livery, the pinstripe from the looks upgrade. */
function liveryTexture(look: CarLook, paint: string): THREE.CanvasTexture | null {
  const liv = getCosmetic(look.livery);
  const pin = look.levels.looks >= 7;
  if (!liv && !pin) return null;
  const S = 512;
  const cv = document.createElement('canvas');
  cv.width = S;
  cv.height = S;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = paint;
  ctx.fillRect(0, 0, S, S);
  // the sides catch the light at the top and darken toward the sills, like the atlas's gradients
  for (const base of [SIDE_R, SIDE_L]) {
    const g = ctx.createLinearGradient(0, (1 - base - 0.4) * S, 0, (1 - base) * S);
    g.addColorStop(0, shade(paint, 0.14));
    g.addColorStop(1, shade(paint, -0.22));
    ctx.fillStyle = g;
    ctx.fillRect(0, (1 - base - 0.4) * S, S, 0.4 * S);
  }
  const X = (u: number): number => u * S;
  const Y = (v: number): number => (1 - v) * S;
  /** A polygon on both sides: points are [u, height fraction 0..1]. */
  const side = (pts: [number, number][], color: string): void => {
    ctx.fillStyle = color;
    for (const base of [SIDE_R, SIDE_L]) {
      ctx.beginPath();
      pts.forEach(([u, f], i) => (i ? ctx.lineTo(X(u), Y(base + 0.4 * f)) : ctx.moveTo(X(u), Y(base + 0.4 * f))));
      ctx.closePath();
      ctx.fill();
    }
  };
  const sideBand = (u0: number, u1: number, f0: number, f1: number, color: string): void => side([[u0, f0], [u1, f0], [u1, f1], [u0, f1]], color);
  /** A band on top: zs from -1 (left edge) to 1 (right edge). */
  const top = (u0: number, u1: number, z0: number, z1: number, color: string): void => {
    ctx.fillStyle = color;
    const v0 = TOP + 0.2 * ((z0 + 1) / 2);
    const v1 = TOP + 0.2 * ((z1 + 1) / 2);
    ctx.fillRect(X(u0), Y(Math.max(v0, v1)), X(u1) - X(u0), Math.max(2, Math.abs(Y(v0) - Y(v1))));
  };
  if (liv) {
    const [c0 = '#ffffff', c1 = '#1d1238'] = liv.colors;
    switch (liv.id) {
      case 'l-stripes':
        for (const s of [1, -1]) top(0, 1, s * 0.1, s * 0.3, c0);
        sideBand(0, 1, 0.3, 0.35, c0);
        break;
      case 'l-roundel':
        for (const base of [SIDE_R, SIDE_L]) {
          const cx = X(0.47);
          const cy = Y(base + 0.4 * 0.4);
          ctx.fillStyle = c0;
          ctx.beginPath();
          ctx.ellipse(cx, cy, S * 0.065, S * 0.052, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.save();
          ctx.translate(cx, cy);
          if (base === SIDE_L) ctx.scale(-1, 1);
          ctx.fillStyle = c1;
          ctx.font = `900 ${S * 0.075}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('7', 0, S * 0.004);
          ctx.restore();
        }
        top(0, 1, -0.08, 0.08, c0);
        break;
      case 'l-swoosh':
        side([[0.04, 0.2], [0.55, 0.42], [0.97, 0.3], [0.97, 0.22], [0.55, 0.33], [0.04, 0.12]], c0);
        break;
      case 'l-flames':
        for (let i = 0; i < 2; i++) {
          const k = 1 - i * 0.3;
          side([[1, 0.18], [1 - 0.16 * k, 0.52], [1 - 0.24 * k, 0.3], [1 - 0.34 * k, 0.56], [1 - 0.46 * k, 0.24], [1 - 0.55 * k, 0.42], [1 - 0.62 * k, 0.16], [1, 0.1]], liv.colors[i] ?? c0);
          top(0.8 + i * 0.06, 1, -0.6 + i * 0.25, 0.6 - i * 0.25, liv.colors[i] ?? c0);
        }
        break;
      case 'l-checker': {
        const n = 6;
        for (let i = 0; i < n; i++)
          for (let j = 0; j < 4; j++) sideBand(0.04 + i * 0.03, 0.04 + (i + 1) * 0.03, 0.14 + j * 0.09, 0.23 + j * 0.09, (i + j) % 2 ? c1 : c0);
        break;
      }
      case 'l-camo':
        for (let i = 0; i < 40; i++) {
          ctx.fillStyle = i % 2 ? c0 : c1;
          ctx.beginPath();
          ctx.ellipse(noise(i, 3) * S, noise(i, 4) * S, S * (0.03 + noise(i, 5) * 0.05), S * (0.02 + noise(i, 6) * 0.03), noise(i, 7) * 3, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      case 'l-rainbow':
        liv.colors.forEach((col, i) => sideBand(0, 1, 0.16 + i * 0.05, 0.21 + i * 0.05, col));
        liv.colors.forEach((col, i) => top(0, 1, -0.3 + i * 0.12, -0.18 + i * 0.12, col));
        break;
    }
  }
  if (pin) sideBand(0.05, 0.95, 0.5, 0.52, '#f4f4f4');
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// ---------------------------------------------------------------- materials
/** The pack's own materials and the repainted paint, shared by every car (never disposed). */
const shared = new Map<string, THREE.MeshStandardMaterial>();
function sharedMat(key: string, make: () => THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  let m = shared.get(key);
  if (!m) {
    m = make();
    shared.set(key, m);
  }
  return m;
}

function roleMat(role: Exclude<Role, 'paint'>, model: LoadedModel): THREE.MeshStandardMaterial {
  const t = model.tex;
  const cosmo = model.pack === 'cosmo';
  return sharedMat(`${model.pack}|${role}`, () => {
    switch (role) {
      case 'glass':
        return new THREE.MeshStandardMaterial({ map: t.glass, metalness: cosmo ? 0.7 : 0.55, roughness: cosmo ? 0.08 : 0.22, envMapIntensity: 1.3 });
      case 'metal':
        return new THREE.MeshStandardMaterial({ map: t.atlas, metalness: 0.75, roughness: 0.28 });
      case 'trim':
        return new THREE.MeshStandardMaterial({ map: t.atlas, metalness: 0, roughness: 0.55 });
      case 'lamp':
        // the palette is the lamps' glow: white at the front, red at the back
        return new THREE.MeshStandardMaterial({ color: '#000000', emissiveMap: t.atlas, emissive: '#ffffff', emissiveIntensity: 1.6 });
      default:
        return new THREE.MeshStandardMaterial({ map: t.atlas, metalness: cosmo ? 0.45 : 0.32, roughness: cosmo ? 0.2 : 0.42 });
    }
  });
}

/** A new colour over the palette's shading: brightness under the paint becomes `ref`, so the factory spot shows exactly `paint`. */
function paintMat(paint: string, model: LoadedModel): THREE.MeshStandardMaterial {
  const key = `paint|${model.pack}|${paint}|${model.paintRef.toFixed(3)}`;
  const cosmo = model.pack === 'cosmo';
  return sharedMat(key, () => new THREE.MeshStandardMaterial({ map: model.tex.luma, color: new THREE.Color(paint).multiplyScalar(1 / model.paintRef), metalness: cosmo ? 0.45 : 0.32, roughness: cosmo ? 0.22 : 0.36 }));
}

// ---------------------------------------------------------------- tyre sidewalls
/** Each tyre level's sidewall: a coloured band near the tread, the compound's name, thin pinlines at the top levels. */
const SIDEWALL: { band: string; w: number; text: string; ink: string; line?: string }[] = [
  { band: '#f2f2f2', w: 0.03, text: '', ink: '#f2f2f2' },
  { band: '#f2f2f2', w: 0.045, text: 'STREET', ink: '#f2f2f2' },
  { band: '#ffd21f', w: 0.05, text: 'SPORT', ink: '#f2f2f2' },
  { band: '#ffd21f', w: 0.07, text: 'SPORT+', ink: '#ffd21f' },
  { band: '#ff2d2d', w: 0.06, text: 'TRACK', ink: '#f2f2f2' },
  { band: '#ff2d2d', w: 0.075, text: 'TRACK R', ink: '#f2f2f2', line: '#f2f2f2' },
  { band: '#b44dff', w: 0.075, text: 'SLICK', ink: '#f2f2f2', line: '#f2f2f2' },
  { band: '#ffc93a', w: 0.085, text: 'DRAG KING', ink: '#ffc93a', line: '#ffc93a' },
];

/** Where the sidewall art sits, as fractions of the decal's outer radius (the tyre's edge). */
const BAND_OUT = 0.91;
const TEXT_R = 0.76;
/** Space the lettering needs inside the band; a big rim pushes it out and shrinks it. */
const textFit = (inner: number, w: number): { r: number; size: number } => {
  const room = BAND_OUT - w - 0.015 - inner;
  return room >= 0.22 ? { r: TEXT_R, size: 0.1 } : { r: inner + room / 2, size: Math.max(0.05, room * 0.62) };
};
/** Bought rims cover the inner part of the sidewall, out to this fraction of the tyre's radius. */
const RIM_R = 0.62;

const sidewallTex = new Map<string, THREE.CanvasTexture>();
/** `inner`: where the sidewall starts (rim's edge), as a fraction of the decal's radius. */
function sidewallTexture(level: number, inner: number): THREE.CanvasTexture {
  const key = `${level}|${inner}`;
  const hit = sidewallTex.get(key);
  if (hit) return hit;
  const spec = SIDEWALL[clamp(level, 1, SIDEWALL.length) - 1]!;
  const S = 512;
  const R = S / 2;
  const cv = document.createElement('canvas');
  cv.width = S;
  cv.height = S;
  const ctx = cv.getContext('2d')!;
  const ring = (r0: number, r1: number, color: string): void => {
    ctx.beginPath();
    ctx.arc(R, R, r1 * R, 0, Math.PI * 2);
    ctx.arc(R, R, r0 * R, 0, Math.PI * 2, true);
    ctx.fillStyle = color;
    ctx.fill();
  };
  ring(BAND_OUT - spec.w, BAND_OUT, spec.band);
  if (spec.line) ring(BAND_OUT + 0.025, BAND_OUT + 0.037, spec.line);
  if (spec.text) {
    const fit = textFit(inner, spec.w);
    const size = R * fit.size;
    ctx.font = `900 ${size}px "Arial Black", "Helvetica Neue", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = spec.ink;
    const words = [`LC ${spec.text}`, spec.text];
    words.forEach((word, k) => {
      const chars = [...word];
      const widths = chars.map((ch) => ctx.measureText(ch).width * 1.1);
      const total = widths.reduce((a, b) => a + b, 0);
      const rr = fit.r * R;
      let ang = -Math.PI / 2 + k * Math.PI - total / rr / 2;
      chars.forEach((ch, i) => {
        ang += widths[i]! / 2 / rr;
        ctx.save();
        ctx.translate(R + rr * Math.cos(ang), R + rr * Math.sin(ang));
        ctx.rotate(ang + Math.PI / 2);
        ctx.fillText(ch, 0, 0);
        ctx.restore();
        ang += widths[i]! / 2 / rr;
      });
      // a small diamond either side of the name
      for (const side of [-1, 1]) {
        const a = -Math.PI / 2 + k * Math.PI + side * (total / rr / 2 + 0.12);
        ctx.save();
        ctx.translate(R + rr * Math.cos(a), R + rr * Math.sin(a));
        ctx.rotate(a + Math.PI / 4);
        ctx.fillStyle = spec.band;
        ctx.fillRect(-size * 0.17, -size * 0.17, size * 0.34, size * 0.34);
        ctx.restore();
        ctx.fillStyle = spec.ink;
      }
    });
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  sidewallTex.set(key, t);
  return t;
}

const sidewallMat = new Map<string, THREE.MeshStandardMaterial>();
function sidewallMaterial(level: number, innerFrac: number): THREE.MeshStandardMaterial {
  // a few rim sizes are plenty: the art is the same, only the lettering moves out of the way
  const inner = Math.round(innerFrac * 20) / 20;
  const key = `${level}|${inner}`;
  let m = sidewallMat.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ map: sidewallTexture(level, inner), transparent: true, alphaTest: 0.35, roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    sidewallMat.set(key, m);
  }
  return m;
}

// ---------------------------------------------------------------- rims
/** The wheel cosmetics as a rim face: lip, spokes over a dark barrel, centre cap. Spins with the wheel. */
const rimTex = new Map<string, THREE.CanvasTexture>();
function rimTexture(style: string, color: string): THREE.CanvasTexture {
  const key = `${style}|${color}`;
  const hit = rimTex.get(key);
  if (hit) return hit;
  const S = 256;
  const R = S / 2;
  const cv = document.createElement('canvas');
  cv.width = S;
  cv.height = S;
  const ctx = cv.getContext('2d')!;
  const disc = (r: number, fill: string | CanvasGradient): void => {
    ctx.beginPath();
    ctx.arc(R, R, r * R, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
  };
  // the barrel and the brake behind the spokes
  const barrel = ctx.createRadialGradient(R, R, R * 0.2, R, R, R);
  barrel.addColorStop(0, '#2a2a30');
  barrel.addColorStop(1, '#0c0c0f');
  disc(1, barrel);
  disc(0.74, '#3b3b42');
  disc(0.6, '#1a1a1f');
  const metal = ctx.createLinearGradient(0, 0, S, S);
  metal.addColorStop(0, shade(color, 0.35));
  metal.addColorStop(0.5, color);
  metal.addColorStop(1, shade(color, -0.3));
  ctx.fillStyle = metal;
  ctx.strokeStyle = metal;
  const spokes = (n: number, w: number, r0: number, r1: number, twist = 0): void => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      ctx.save();
      ctx.translate(R, R);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(r0 * R, -w * R * 0.6);
      ctx.lineTo(r1 * R, -w * R + twist * R);
      ctx.lineTo(r1 * R, w * R + twist * R);
      ctx.lineTo(r0 * R, w * R * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  };
  switch (style) {
    case 'w-classic':
      spokes(5, 0.14, 0.15, 0.92);
      break;
    case 'w-mesh':
      ctx.lineWidth = R * 0.035;
      for (let i = 0; i < 16; i++)
        for (const k of [-1, 1]) {
          ctx.save();
          ctx.translate(R, R);
          ctx.rotate((i / 16) * Math.PI * 2);
          ctx.beginPath();
          ctx.moveTo(R * 0.2, 0);
          ctx.quadraticCurveTo(R * 0.55, k * R * 0.22, R * 0.92, k * R * 0.32);
          ctx.stroke();
          ctx.restore();
        }
      break;
    case 'w-star':
      spokes(10, 0.07, 0.15, 0.92);
      break;
    case 'w-turbine':
      spokes(12, 0.08, 0.2, 0.92, 0.12);
      break;
    case 'w-deep':
      disc(0.94, metal);
      disc(0.72, '#141418');
      spokes(6, 0.12, 0.15, 0.74);
      break;
    default:
      spokes(8, 0.1, 0.15, 0.92);
  }
  // the lip, the cap and its bolts
  ctx.lineWidth = R * 0.07;
  ctx.beginPath();
  ctx.arc(R, R, R * 0.95, 0, Math.PI * 2);
  ctx.stroke();
  disc(0.2, metal);
  ctx.fillStyle = '#16161a';
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(R + Math.cos(a) * R * 0.12, R + Math.sin(a) * R * 0.12, R * 0.025, 0, Math.PI * 2);
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  rimTex.set(key, t);
  return t;
}

const rimMat = new Map<string, THREE.MeshStandardMaterial>();
function rimMaterial(style: string, color: string): THREE.MeshStandardMaterial {
  const key = `${style}|${color}`;
  let m = rimMat.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ map: rimTexture(style, color), metalness: 0.6, roughness: 0.3, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    rimMat.set(key, m);
  }
  return m;
}

// ---------------------------------------------------------------- underglow
let glowTex: THREE.CanvasTexture | null = null;
function glowTexture(): THREE.CanvasTexture {
  if (glowTex) return glowTex;
  const cv = document.createElement('canvas');
  cv.width = 128;
  cv.height = 128;
  const ctx = cv.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(cv);
  return glowTex;
}

// ---------------------------------------------------------------- the build
const ray = new THREE.Raycaster();
const DOWN = new THREE.Vector3(0, -1, 0);
const UP = new THREE.Vector3(0, 1, 0);
const BACK = new THREE.Vector3(-1, 0, 0);
const FWD = new THREE.Vector3(1, 0, 0);
const IN = new THREE.Vector3(0, 0, -1);

/** Deepest drop at full suspension, metres (less when the wheel arches are tight). */
const MAX_DROP = 0.17;
/** How far a tyre may tuck up past the arch's lip into the wing at full drop, metres. */
const TUCK = 0.075;

export function buildModelCar(look: CarLook, model: LoadedModel): CarRig {
  const def = look.def;
  const lv = look.levels;
  const disposables: { dispose(): void }[] = [];
  const keepD = <T extends { dispose(): void }>(d: T): T => {
    disposables.push(d);
    return d;
  };
  // the stock paint: RG cars keep their factory scheme; Cosmo cars wear their roster colour
  const stock = look.paint === 'p-stock' || !getCosmetic(look.paint);
  const factory = stock && model.pack === 'rg';
  const paint = stock ? (factory ? model.factory : def.color) : paintOf(look);
  const s = model.scale;
  const mb = model.box;
  const cx = (mb.min.x + mb.max.x) / 2;

  const root = new THREE.Group();
  const bodyG = new THREE.Group();
  root.add(bodyG);
  const shell = new THREE.Group();
  shell.scale.setScalar(s);
  shell.position.x = -cx * s;
  bodyG.add(shell);

  // body: the paint (factory, a new colour, or a livery), the rest in the pack's own materials
  const tex = liveryTexture(look, paint);
  if (tex) keepD(tex);
  const liveryMat = tex ? keepD(new THREE.MeshStandardMaterial({ map: tex, metalness: 0.32, roughness: 0.36 })) : null;
  const bodyMeshes: THREE.Mesh[] = [];
  const addPart = (p: ModelPart, i: number, into: THREE.Object3D): THREE.Mesh => {
    let geo = p.geo;
    let mat: THREE.Material;
    if (p.role === 'paint') {
      if (liveryMat) {
        geo = withLiveryUv(p.geo, `${model.file}|${i}`, mb);
        mat = liveryMat;
      } else mat = factory ? roleMat('body', model) : paintMat(paint, model);
    } else mat = roleMat(p.role, model);
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.userData.shared = true;
    into.add(m);
    return m;
  };
  model.body.forEach((p, i) => bodyMeshes.push(addPart(p, i, shell)));
  // the factory wing stays until the aero kit brings its own
  if (lv.aero < 3) model.wing.forEach((p, i) => addPart(p, 1000 + i, shell));

  // wheels: pivots that spin; the tyres get their sidewall art
  const wheels: THREE.Object3D[] = [];
  const tyreMat = std('#19181d', { rough: 0.86 });
  const rimCol = look.wheels === 'w-steel' ? null : getCosmetic(look.wheels)?.colors[0];
  const rimFace = PACKS[model.pack].rimFace;
  let wheelR = 0.3;
  for (const w of model.wheels) {
    const pivot = new THREE.Group();
    pivot.position.set((w.pos.x - cx) * s, w.r * s, w.pos.z * s);
    pivot.userData.r = w.r * s;
    wheelR = w.r * s;
    const inner = new THREE.Group();
    inner.scale.setScalar(s);
    for (const g of w.tyre) {
      const m = new THREE.Mesh(g, tyreMat);
      m.castShadow = true;
      m.userData.shared = true;
      inner.add(m);
    }
    for (const h of w.hub) {
      // RG hubs are tiny: bought rims are painted over the sidewall below; Cosmo rims take the colour
      const m = new THREE.Mesh(h.geo, rimCol ? std(rimCol, { metal: 0.65, rough: 0.28 }) : roleMat(h.role === 'paint' ? 'metal' : h.role, model));
      m.castShadow = true;
      m.userData.shared = true;
      inner.add(m);
    }
    const side = Math.sign(w.pos.z) || 1;
    const outer = w.r * 0.985;
    if (rimCol && rimFace) {
      const rimGeo = keepD(new THREE.CircleGeometry(w.r * RIM_R, 40));
      if (side < 0) rimGeo.rotateY(Math.PI);
      const rim = new THREE.Mesh(rimGeo, rimMaterial(look.wheels, rimCol));
      rim.position.z = side * (w.halfW + 0.003);
      inner.add(rim);
    }
    if (lv.tyres >= 1) {
      const inR = rimCol && rimFace ? w.r * RIM_R : Math.min(w.hubR * 1.03, outer * 0.78);
      const ringGeo = keepD(new THREE.RingGeometry(inR, outer, 48, 1));
      // planar UVs over the decal's full square, so the art lines up with the radius
      const p = ringGeo.attributes.position!;
      const uv = ringGeo.attributes.uv!;
      for (let k = 0; k < p.count; k++) uv.setXY(k, p.getX(k) / outer / 2 + 0.5, p.getY(k) / outer / 2 + 0.5);
      if (side < 0) ringGeo.rotateY(Math.PI);
      const decal = new THREE.Mesh(ringGeo, sidewallMaterial(lv.tyres, inR / outer));
      decal.position.z = side * (w.halfW + 0.002);
      inner.add(decal);
    }
    pivot.add(inner);
    root.add(pivot);
    wheels.push(pivot);
  }

  // the body's real surface, for placing parts (car space, before the suspension drop)
  root.updateMatrixWorld(true);
  const cast = (from: THREE.Vector3, dir: THREE.Vector3): THREE.Vector3 | null => {
    ray.set(from, dir);
    ray.far = 50;
    return ray.intersectObjects(bodyMeshes, false)[0]?.point ?? null;
  };
  const bb = new THREE.Box3().setFromObject(shell);
  const surface: BodySurface = {
    topAt: (x, z = 0) => cast(new THREE.Vector3(x, 20, z), DOWN)?.y ?? null,
    backAt: (y, z = 0) => cast(new THREE.Vector3(-20, y, z), FWD)?.x ?? null,
    frontAt: (y, z = 0) => cast(new THREE.Vector3(20, y, z), BACK)?.x ?? null,
    sideAt: (x, y) => cast(new THREE.Vector3(x, y, 20), IN)?.z ?? null,
    xMin: bb.min.x,
    xMax: bb.max.x,
    bottom: bb.min.y,
    top: bb.max.y,
    halfW: (bb.max.z - bb.min.z) / 2,
    frontAxle: Math.max(...wheels.map((w) => w.position.x)),
    rearAxle: Math.min(...wheels.map((w) => w.position.x)),
    wheelR,
  };
  const L = bb.max.x - bb.min.x;
  const W = bb.max.z - bb.min.z;
  const H = bb.max.y;
  const bottom = bb.min.y;
  const xAt = (u: number): number => bb.min.x + u * L;

  // suspension: each level drops the body a step, tucking the tyres up into the arches, and never
  // closer than a few centimetres to the strip
  let room = MAX_DROP;
  for (const w of wheels) {
    const r = (w.userData.r as number) ?? wheelR;
    for (const dz of [-0.12, 0, 0.12]) {
      const hit = cast(new THREE.Vector3(w.position.x, w.position.y + r * 0.2, w.position.z * 0.85 + dz), UP);
      if (hit) room = Math.min(room, hit.y - (w.position.y + r) + TUCK);
    }
  }
  room = clamp(Math.min(room, bb.min.y - 0.05), 0.06, MAX_DROP);
  const drop = (room * clamp(lv.suspension, 0, MAX_LEVEL)) / MAX_LEVEL;

  // the aero kit, in body colour and carbon
  const parts = buildAero(surface, { level: lv.aero, paint: std(paint, { metal: 0.32, rough: 0.36 }) });
  bodyG.add(parts);

  // exhaust pops on a shift, for every car, at the back of the body
  const pops: THREE.Object3D[] = [];
  const popMat = std('#ffb03a', { emissive: '#ff7a00', ei: 2.4 });
  const popY = bottom + 0.07;
  for (const z of def.hp > 300 ? [W * 0.28, -W * 0.28] : [-W * 0.28]) {
    const px = (surface.backAt(popY, z) ?? bb.min.x) - 0.02;
    const pop = mesh(keepD(new THREE.ConeGeometry(0.06, 0.32, 7).rotateZ(Math.PI / 2)), popMat, px - 0.16, popY, z);
    pop.visible = false;
    pop.name = 'pop';
    parts.add(pop);
    pops.push(pop);
  }

  // looks: underglow
  if (lv.looks >= 4) {
    const glow = new THREE.Mesh(keepD(new THREE.PlaneGeometry(L * 1.05, W * 1.7)), keepD(new THREE.MeshBasicMaterial({ color: lv.looks >= 7 ? '#ff4f9a' : '#b8f02a', map: glowTexture(), transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending })));
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.022;
    glow.name = 'glow';
    root.add(glow);
  }

  // blob shadow
  const blob = new THREE.Mesh(keepD(new THREE.PlaneGeometry(L * 1.18, W * 1.45)), keepD(new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false })));
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.012;
  blob.name = 'blob';
  root.add(blob);

  // smoke pool: enough puffs for a burnout cloud
  const smoke: THREE.Mesh[] = [];
  const smokeGeo = keepD(new THREE.SphereGeometry(0.4, 8, 6));
  for (let i = 0; i < 40; i++) {
    const m = new THREE.Mesh(smokeGeo, keepD(new THREE.MeshBasicMaterial({ color: '#f4f4f4', transparent: true, opacity: 0.5, depthWrite: false })));
    m.visible = false;
    m.name = 'smoke';
    root.add(m);
    smoke.push(m);
  }

  // the kit merges per material; the body and wheels share the model's geometry and stay as they are
  disposables.push(...mergeStatic(parts, (o) => o.name === 'pop', { cast: true, receive: false }));
  bodyG.position.y = -drop;

  // where each part shows on the car, for the inspect marker (the showcase camera works on the -z side)
  const near = wheels.filter((w) => w.position.z < 0);
  const front = near.reduce<THREE.Object3D | undefined>((a, w) => (!a || w.position.x > a.position.x ? w : a), undefined);
  const back = near.reduce<THREE.Object3D | undefined>((a, w) => (!a || w.position.x < a.position.x ? w : a), undefined);
  const hoodX = xAt(0.8);
  const deckX = xAt(0.07);
  const aeroBox = new THREE.Box3().setFromObject(parts);
  const anchors: CarRig['anchors'] = {
    engine: new THREE.Vector3(hoodX, (surface.topAt(hoodX) ?? H * 0.6) + 0.12 - drop, 0),
    transmission: new THREE.Vector3(0, bottom + 0.05 - drop, -W / 2 - 0.05),
    aero: aeroBox.isEmpty() || lv.aero < 3 ? new THREE.Vector3(deckX, (surface.topAt(deckX) ?? H * 0.6) + 0.2 - drop, 0) : new THREE.Vector3(aeroBox.min.x + 0.15, aeroBox.max.y + 0.06 - drop, 0),
    looks: new THREE.Vector3(0, bottom + (H - bottom) * 0.45 - drop, -W / 2 - 0.03),
  };
  if (front) anchors.tyres = new THREE.Vector3(front.position.x, front.position.y, front.position.z - 0.2);
  if (back) anchors.suspension = new THREE.Vector3(back.position.x, back.position.y * 2 + 0.04 - drop, back.position.z - 0.05);

  return {
    group: root,
    wheels,
    wheelR,
    anchors,
    flames: [],
    pops,
    shiftLamp: null,
    smoke,
    len: L,
    dispose() {
      for (const d of new Set(disposables)) d.dispose();
    },
  };
}
