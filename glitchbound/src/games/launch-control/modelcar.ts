/**
 * Builds a race car from a loaded base model (models.ts): the body is scaled and reshaped to the
 * car's own proportions, repainted (with the livery mapped onto its sides and top), the wheels
 * become spinning parts sized by the tyre upgrade, and the visible upgrades (wings, splitter,
 * diffuser, scoop or blower, exhausts and flames, shift light, underglow) are snapped onto the
 * body's real surface by casting rays at it.
 */
import * as THREE from 'three';
import type { Feature } from './cars';
import { getCosmetic } from './cosmetics';
import { CHROME, GLASS, LAMP, RUBBER, TAIL, TRIM, blobTexture, box, mergeStatic, mesh, pillow, std } from './mats';
import { specFor, warpGeometry, warpPoint, type LoadedModel } from './models';
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

// ---------------------------------------------------------------- Kenney palette recolour
/** The palette cell (32 x 128 px column, row) each Kenney body is painted with. */
const KENNEY_PAINT: Record<string, [number, number]> = { rail: [13, 1], funny: [15, 1] };
const kenneyTex = new Map<string, THREE.Texture>();

function kenneyTexture(base: string, src: THREE.Texture, paint: string): THREE.Texture {
  const key = `${base}|${paint}`;
  const hit = kenneyTex.get(key);
  if (hit) return hit;
  const img = src.image as CanvasImageSource & { width: number; height: number };
  const cell = KENNEY_PAINT[base];
  if (!img || !cell) return src;
  const cv = document.createElement('canvas');
  cv.width = img.width;
  cv.height = img.height;
  const ctx = cv.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const cw = img.width / 16;
  const ch = img.height / 4;
  const g = ctx.createLinearGradient(0, cell[1] * ch, 0, (cell[1] + 1) * ch);
  g.addColorStop(0, shade(paint, 0.12));
  g.addColorStop(1, shade(paint, -0.18));
  ctx.fillStyle = g;
  ctx.fillRect(cell[0] * cw, cell[1] * ch, cw, ch);
  const t = new THREE.CanvasTexture(cv);
  t.flipY = src.flipY;
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = src.magFilter;
  t.minFilter = src.minFilter;
  t.anisotropy = 4;
  kenneyTex.set(key, t);
  return t;
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
const BACK = new THREE.Vector3(-1, 0, 0);
const FWD = new THREE.Vector3(1, 0, 0);

/** Where the driver's head sits in open bodies (model space, left seat). */
const SEAT: Partial<Record<string, [number, number, number]>> = { roadster: [-0.5, 1.5, -0.42] };

/** Default width relative to a uniform scale: the source bodies are chunkier than real cars. */
const DEFAULT_W = 0.86;

export function buildModelCar(look: CarLook, model: LoadedModel): CarRig {
  const def = look.def;
  const spec = specFor(def);
  const lv = look.levels;
  const kenney = !model.hasPaint;
  const warp = spec.warp ?? 'none';
  const has = (f: Feature): boolean => def.shape.features.includes(f);
  const disposables: { dispose(): void }[] = [];
  const keepD = <T extends { dispose(): void }>(d: T): T => {
    disposables.push(d);
    return d;
  };
  const paint = paintOf(look);

  // size: the warped body's length becomes the car's length
  const mb = model.box;
  const nose = warpPoint(mb.max.x, mb.max.y * 0.3, 0, warp, mb)[0];
  const modelLen = nose - mb.min.x;
  const s = spec.len / modelLen;
  const hK = spec.h ?? 1;
  const sx = s;
  const sy = s * hK;
  const sz = s * (spec.w ?? (kenney ? 1 : DEFAULT_W));
  const cx = (nose + mb.min.x) / 2;

  const root = new THREE.Group();
  const bodyG = new THREE.Group();
  root.add(bodyG);
  const shell = new THREE.Group();
  shell.scale.set(sx, sy, sz);
  shell.position.x = -cx * sx;
  bodyG.add(shell);

  // body parts, by role
  const paintOpts = { metalness: 0.18, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.15 };
  const tex = kenney ? null : liveryTexture(look, paint);
  if (tex) keepD(tex);
  const paintMat = keepD(new THREE.MeshPhysicalMaterial(tex ? { map: tex, ...paintOpts } : { color: paint, ...paintOpts }));
  const bodyMeshes: THREE.Mesh[] = [];
  const wheelSrc: THREE.Object3D[] = [];
  const baseKey = `${spec.base}|${warp}`;
  model.scene.children.forEach((o) => {
    if (/^wheel_(fl|fr|rl|rr)$/.test(o.name)) {
      wheelSrc.push(o);
      return;
    }
    if (!(o instanceof THREE.Mesh)) return;
    const src = o.material as THREE.MeshStandardMaterial;
    const role = src.name;
    let geo = warpGeometry(o.geometry, `${baseKey}|${o.name}`, warp, mb);
    let mat: THREE.Material;
    switch (role) {
      case 'paint':
        if (tex) geo = withLiveryUv(geo, `${baseKey}|${o.name}|uv`, mb);
        mat = paintMat;
        break;
      case 'glass':
        mat = GLASS();
        break;
      case 'lamp':
        mat = LAMP();
        break;
      case 'tail':
        mat = TAIL();
        break;
      case 'chrome':
        mat = CHROME();
        break;
      case 'trim':
        mat = TRIM();
        break;
      case 'kbody':
        mat = keepD(new THREE.MeshStandardMaterial({ map: src.map ? kenneyTexture(spec.base, src.map, paint) : null, roughness: 0.42, metalness: 0.15, side: THREE.DoubleSide }));
        break;
      default:
        mat = std(`#${src.color.getHexString()}`, { rough: 0.45, metal: 0.2 });
    }
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.userData.shared = true;
    shell.add(m);
    bodyMeshes.push(m);
  });

  // wheels: pivots that spin, holding a copy of the model's wheel scaled to the tyre upgrade
  const wheels: THREE.Object3D[] = [];
  const srcR = wheelSrc[0] ? wheelSrc[0].position.y : 0.4;
  const wheelK = spec.wheel ?? 1;
  const wScale = s * Math.min(1, hK) * wheelK * (1 + lv.tyres * 0.012);
  const wheelR = srcR * wScale;
  const lift = wheelR - srcR * sy;
  const rimCol = getCosmetic(look.wheels)?.colors[0] ?? '#cfcfcf';
  const rimMat = std(rimCol, { metal: 0.6, rough: 0.28 });
  const tyreMat = lv.tyres >= 5 ? std('#141418', { rough: 0.55 }) : RUBBER();
  for (const w of wheelSrc) {
    const [wx, , wz] = warpPoint(w.position.x, w.position.y, w.position.z, warp, mb);
    const rear = wx < 0;
    const axleK = (rear ? spec.rear : spec.front) ?? 1;
    const r = wheelR * axleK;
    const pivot = new THREE.Group();
    pivot.position.set((wx - cx) * sx, r, wz * sz);
    pivot.userData.r = r;
    const inner = w.clone();
    inner.position.set(0, 0, 0);
    const widthK = 1 + lv.tyres * (rear ? 0.06 : 0.03) + (def.drive === 'fwd' || !rear ? 0 : 0.08);
    inner.scale.set(wScale * axleK, wScale * axleK, wScale * widthK * Math.sqrt(axleK));
    inner.traverse((c) => {
      if (!(c instanceof THREE.Mesh)) return;
      const role = (c.material as THREE.Material).name;
      if (role === 'tire') c.material = tyreMat;
      else if (role === 'rim') c.material = rimMat;
      c.castShadow = true;
      c.userData.shared = true;
    });
    // keep the tyre's outer face inside the body's width as it widens
    pivot.position.z -= Math.sign(wz) * (widthK - 1) * 0.15 * wScale;
    pivot.add(inner);
    root.add(pivot);
    wheels.push(pivot);
  }

  // stance: big wheels lift the body, the suspension upgrade drops it
  const clearance = mb.min.y * sy + lift;
  bodyG.position.y = lift - Math.min(lv.suspension * 0.013, Math.max(0, clearance - 0.06));

  // the body's real surface, for placing parts (in root space)
  root.updateMatrixWorld(true);
  const cast = (from: THREE.Vector3, dir: THREE.Vector3): THREE.Vector3 | null => {
    ray.set(from, dir);
    ray.far = 200;
    const hits = ray.intersectObjects(bodyMeshes, false);
    return hits[0]?.point ?? null;
  };
  const L = spec.len;
  const bb = new THREE.Box3().setFromObject(shell);
  const W = bb.max.z - bb.min.z;
  const H = bb.max.y;
  const bottom = bb.min.y;
  const xAt = (u: number): number => -L / 2 + u * L;
  const topAt = (x: number, z = 0): number => cast(new THREE.Vector3(x, 20, z), DOWN)?.y ?? H * 0.6;
  const frontAt = (y: number, z = 0): number => cast(new THREE.Vector3(50, y, z), BACK)?.x ?? L / 2;
  const backAt = (y: number, z = 0): number => cast(new THREE.Vector3(-50, y, z), FWD)?.x ?? -L / 2;

  const parts = new THREE.Group();
  bodyG.parent!.add(parts);
  const dark = std('#1d1c24', { rough: 0.35, metal: 0.2 });
  const carbon = std('#16161b', { rough: 0.3, metal: 0.35 });

  // aero
  if (!kenney) {
    const wingLevel = lv.aero >= 7 || has('bigwing') ? 2 : lv.aero >= 4 || has('wing') ? 1 : 0;
    const wx = xAt(0.07);
    const deckY = topAt(wx);
    if (wingLevel) {
      const wh = wingLevel === 2 ? 0.34 : 0.17;
      const span = W * (wingLevel === 2 ? 0.98 : 0.86);
      const wing = pillow(0.36, 0.05, span, wingLevel === 2 ? carbon : dark, wx, deckY + wh, 0);
      wing.rotation.z = -0.1;
      parts.add(wing);
      for (const z of [1, -1]) parts.add(box(0.11, wh + 0.02, 0.035, TRIM(), wx + 0.02, deckY + wh / 2, z * span * 0.32));
      if (wingLevel === 2) for (const z of [1, -1]) parts.add(box(0.44, 0.2, 0.025, carbon, wx, deckY + wh + 0.05, z * span * 0.5));
    } else if (lv.aero >= 1) {
      const lip = pillow(0.18, 0.05, W * 0.72, paintMat, xAt(0.035), topAt(xAt(0.035)) + 0.015, 0);
      lip.rotation.z = -0.15;
      parts.add(lip);
    }
    if (lv.aero >= 2 || has('lip')) {
      const y = bottom + 0.03;
      parts.add(pillow(0.24, 0.035, W * 0.86, carbon, frontAt(y + 0.1) - 0.07, y, 0));
    }
    if (lv.aero >= 6) for (const z of [1, -1]) {
      const y = bottom + 0.22;
      const fin = box(0.22, 0.02, 0.16, carbon, frontAt(y, z * W * 0.38) - 0.02, y, z * W * 0.44);
      fin.rotation.z = 0.25;
      parts.add(fin);
    }
    if (lv.aero >= 5) {
      const y = bottom + 0.05;
      const x = backAt(y + 0.08) + 0.12;
      for (let i = -2; i <= 2; i++) parts.add(box(0.34, 0.12, 0.022, carbon, x, y, i * W * 0.11));
    }
  }

  // engine: scoop, then a blower through the hood
  if (!kenney) {
    const hx = xAt(0.76);
    const hy = topAt(hx);
    if (lv.engine >= 8 || has('hump')) {
      parts.add(pillow(0.5, 0.26, 0.42, CHROME(), hx, hy + 0.1, 0));
      parts.add(pillow(0.3, 0.2, 0.36, dark, hx + 0.08, hy + 0.3, 0));
      for (const z of [-0.09, 0.09]) parts.add(mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.18, 12), CHROME(), hx + 0.08, hy + 0.45, z));
    } else if (lv.engine >= 3 || has('scoop')) {
      const scoop = pillow(0.5, 0.11, W * 0.26, lv.engine >= 3 ? dark : paintMat, hx, hy + 0.035, 0);
      scoop.rotation.z = 0.05;
      parts.add(scoop);
      parts.add(box(0.03, 0.055, W * 0.2, std('#08080a'), hx + 0.24, hy + 0.06, 0));
    }
    if (has('roofscoop')) {
      const rx = xAt(0.5);
      parts.add(pillow(0.34, 0.14, 0.26, dark, rx, topAt(rx) + 0.05, 0));
    }
    if (has('sidepipes')) for (const z of [1, -1]) parts.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, L * 0.34, 12).rotateZ(Math.PI / 2), CHROME(), 0, bottom + 0.1, z * (W / 2 + 0.01)));
    if (has('bullbar')) {
      const bx = frontAt(bottom + 0.35) + 0.08;
      for (const y of [bottom + 0.2, bottom + 0.5]) parts.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, W * 0.74, 10).rotateX(Math.PI / 2), CHROME(), bx, y, 0));
      for (const z of [-0.28, 0.28]) parts.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.42, 10), CHROME(), bx, bottom + 0.35, z));
    }
    if (has('wide'))
      for (const w of wheels) {
        const flare = mesh(new THREE.TorusGeometry(wheelR * 1.12, 0.05, 8, 20, Math.PI), TRIM(), w.position.x, wheelR, Math.sign(w.position.z) * (W / 2 - 0.03));
        parts.add(flare);
      }
  }

  // exhausts and flames
  const flames: THREE.Object3D[] = [];
  const pipes = def.hp > 300 || lv.engine >= 6 ? 2 : 1;
  const pipeZ = pipes === 2 ? [W * 0.3, -W * 0.3] : [-W * 0.28];
  for (const z of pipeZ) {
    const py = bottom + (kenney ? 0.25 : 0.14);
    const px = backAt(py + 0.05, z) - 0.02;
    parts.add(mesh(new THREE.CylinderGeometry(0.045 + lv.engine * 0.003, 0.05 + lv.engine * 0.003, 0.2, 12).rotateZ(Math.PI / 2), CHROME(), px + 0.04, py, z));
    if (lv.engine >= 6) {
      const flame = mesh(keepD(new THREE.ConeGeometry(0.075, 0.62, 8).rotateZ(Math.PI / 2)), std('#ff8a1f', { emissive: '#ff5a00', ei: 2 }), px - 0.36, py, z);
      flame.visible = false;
      flame.name = 'flame';
      parts.add(flame);
      flames.push(flame);
    }
  }

  // transmission: a shift light along the top of the rear window
  let shiftLamp: THREE.MeshStandardMaterial | null = null;
  if (lv.transmission >= 2 && !kenney) {
    let best = { x: 0, y: 0 };
    for (let u = 0.2; u <= 0.7; u += 0.025) {
      const x = xAt(u);
      const y = topAt(x);
      if (y > best.y + 0.01 || (y > best.y - 0.02 && x < best.x)) best = { x, y };
    }
    shiftLamp = keepD(new THREE.MeshStandardMaterial({ color: '#3a3845', emissive: '#000000' }));
    const lamp = pillow(0.06, 0.035, W * 0.32, shiftLamp, best.x - 0.02, best.y + 0.02, 0);
    lamp.name = 'shiftlamp';
    parts.add(lamp);
  }

  // open cars show their driver, in the player's helmet and suit
  const seat = SEAT[spec.base];
  if (seat) {
    const [x, y, z] = warpPoint(seat[0], seat[1], seat[2], warp, mb);
    const hx = (x - cx) * sx;
    const hy = y * sy + bodyG.position.y;
    const hz = z * sz;
    const r = 0.15;
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), std(look.helmet[0], { rough: 0.25, metal: 0.1 }));
    helmet.position.set(hx, hy, hz);
    parts.add(helmet);
    const visor = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), std('#111118', { rough: 0.08, metal: 0.3 }));
    visor.scale.set(r * 0.55, r * 0.5, r * 0.82);
    visor.position.set(hx + r * 0.55, hy + 0.01, hz);
    parts.add(visor);
    parts.add(box(r * 1.7, r * 0.28, r * 0.34, std(look.helmet[1]), hx, hy + r * 0.84, hz));
    parts.add(pillow(0.3, 0.32, 0.38, std(look.suit, { rough: 0.9 }), hx - 0.04, hy - 0.3, hz));
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

  // smoke pool
  const smoke: THREE.Mesh[] = [];
  const smokeGeo = keepD(new THREE.SphereGeometry(0.4, 8, 6));
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(smokeGeo, keepD(new THREE.MeshBasicMaterial({ color: '#f4f4f4', transparent: true, opacity: 0.5, depthWrite: false })));
    m.visible = false;
    m.name = 'smoke';
    root.add(m);
    smoke.push(m);
  }

  // parts merge per material; the body and wheels share the model's geometry and stay as they are
  disposables.push(...mergeStatic(parts, (o) => o.name === 'flame' || o.name === 'shiftlamp', { cast: true, receive: false }));
  parts.traverse((o) => {
    if (o instanceof THREE.Mesh && o.geometry && !o.userData.shared && !disposables.includes(o.geometry)) disposables.push(o.geometry);
  });
  root.traverse((o) => {
    if (o instanceof THREE.Mesh && o.geometry && !o.userData.shared && !disposables.includes(o.geometry)) disposables.push(o.geometry);
  });

  return {
    group: root,
    wheels,
    wheelR,
    flames,
    shiftLamp,
    smoke,
    len: L,
    dispose() {
      for (const d of new Set(disposables)) d.dispose();
    },
  };
}
