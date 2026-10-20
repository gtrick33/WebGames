/**
 * The 3D side. Cars are built from their shape recipe (cars.ts): a side outline with real wheel
 * wells, extruded with rounded edges and smooth normals, a tapered glass cabin with pillars and a
 * roof skin, lamps, grille, mirrors, exhausts and arch lips, under clearcoat paint that reflects a
 * studio environment. The world is a drag strip under a blue sky with grandstands, crowds and
 * scenery per strip. Three.js loads with the game's chunk only.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { CarDef, Feature } from './cars';
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
}

export const DISTANCE_M = 402.336;
/** Five lanes: the player in the middle (lane 0), then alternating right and left. */
export const LANES = 5;
const LANE_PITCH = 4.6;
export const LANE_Z = [0, -LANE_PITCH, LANE_PITCH, -2 * LANE_PITCH, 2 * LANE_PITCH] as const;
/** Half the track width. */
const LANE_W = (LANE_PITCH * LANES) / 2;

type Pt = [number, number];

/** Chaikin corner cutting: rounds a polyline, keeping its ends. */
function chaikin(pts: Pt[], iterations: number): Pt[] {
  let out = pts;
  for (let k = 0; k < iterations; k++) {
    const next: Pt[] = [out[0]!];
    for (let i = 0; i < out.length - 1; i++) {
      const a = out[i]!;
      const b = out[i + 1]!;
      next.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    next.push(out[out.length - 1]!);
    out = next;
  }
  return out;
}

/** Smooth shading across a non-indexed geometry: normals averaged by position. */
function smoothNormals(geo: THREE.BufferGeometry): void {
  geo.computeVertexNormals();
  const pos = geo.attributes.position!;
  const nor = geo.attributes.normal!;
  const sums = new Map<string, [number, number, number]>();
  const key = (i: number): string => `${Math.round(pos.getX(i) * 500)}|${Math.round(pos.getY(i) * 500)}|${Math.round(pos.getZ(i) * 500)}`;
  for (let i = 0; i < pos.count; i++) {
    const k = key(i);
    const s = sums.get(k) ?? [0, 0, 0];
    s[0] += nor.getX(i);
    s[1] += nor.getY(i);
    s[2] += nor.getZ(i);
    sums.set(k, s);
  }
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const s = sums.get(key(i))!;
    v.set(s[0], s[1], s[2]).normalize();
    nor.setXYZ(i, v.x, v.y, v.z);
  }
  nor.needsUpdate = true;
}

// ---- materials
const stdCache = new Map<string, THREE.Material>();
const std = (color: string, opts: { metalness?: number; roughness?: number; emissive?: string; emissiveIntensity?: number } = {}): THREE.MeshStandardMaterial => {
  const key = `${color}|${JSON.stringify(opts)}`;
  let m = stdCache.get(key) as THREE.MeshStandardMaterial | undefined;
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, metalness: opts.metalness ?? 0, roughness: opts.roughness ?? 0.8, emissive: opts.emissive ?? '#000000', emissiveIntensity: opts.emissiveIntensity ?? 1 });
    stdCache.set(key, m);
  }
  return m;
};
const CHROME = (): THREE.MeshStandardMaterial => std('#e9e9ee', { metalness: 1, roughness: 0.18 });
const RUBBER = (): THREE.MeshStandardMaterial => std('#17171c', { roughness: 0.95 });
const DARK = (): THREE.MeshStandardMaterial => std('#1c1b23', { roughness: 0.65 });
const LAMP = (): THREE.MeshStandardMaterial => std('#fffbe8', { emissive: '#fff3c4', emissiveIntensity: 1.3, roughness: 0.1 });
const TAIL = (): THREE.MeshStandardMaterial => std('#ff2b3a', { emissive: '#ff1f30', emissiveIntensity: 1.0, roughness: 0.2 });
const GLASS = (): THREE.MeshPhysicalMaterial => {
  const key = 'glass';
  let m = stdCache.get(key) as THREE.MeshPhysicalMaterial | undefined;
  if (!m) {
    m = new THREE.MeshPhysicalMaterial({ color: '#0e1a2b', metalness: 0.25, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.3 });
    stdCache.set(key, m);
  }
  return m;
};

const box = (w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  return mesh;
};
const cyl = (r: number, len: number, m: THREE.Material, seg = 16): THREE.Mesh => new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), m);

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

function liveryTextures(look: CarLook, seams: number[]): { side: THREE.CanvasTexture; top: THREE.CanvasTexture } {
  const paint = paintOf(look);
  const liv = getCosmetic(look.livery);
  const sh = look.def.shape;
  const chrome = look.levels.looks >= 7;
  const make = (w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void): THREE.CanvasTexture => {
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext('2d')!;
    ctx.fillStyle = paint;
    ctx.fillRect(0, 0, w, h);
    draw(ctx, w, h);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.anisotropy = 4;
    return t;
  };
  // Sides: u = rear→front (0..1 of the length), v = ground→top (0..1 of the body height).
  const side = make(512, 192, (ctx, w, h) => {
    const bodyTop = sh.belt;
    const yOf = (m: number): number => h - (m / bodyTop) * h * 0.92;
    // sill and bumper band
    ctx.fillStyle = shade(paint, -0.35);
    ctx.fillRect(0, yOf(sh.clear + 0.12), w, h);
    // door seams and handles
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    for (const s of seams) ctx.fillRect(s * w - 1, yOf(bodyTop - 0.05), 2, yOf(sh.clear + 0.14) - yOf(bodyTop - 0.05));
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    for (let i = 0; i < seams.length - 1; i++) ctx.fillRect((seams[i]! + 0.02) * w, yOf(bodyTop - 0.2), w * 0.035, 5);
    if (chrome) {
      ctx.fillStyle = '#f2f2f2';
      ctx.fillRect(0, yOf(sh.clear + 0.12) - 3, w, 4);
    }
    if (!liv) return;
    switch (liv.id) {
      case 'l-roundel': {
        ctx.fillStyle = liv.colors[0]!;
        ctx.beginPath();
        ctx.arc(w * 0.5, h * 0.5, h * 0.24, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = liv.colors[1]!;
        ctx.font = `bold ${h * 0.34}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.save();
        ctx.translate(w * 0.5, h * 0.5);
        ctx.scale(1, -1);
        ctx.fillText('7', 0, 0);
        ctx.restore();
        break;
      }
      case 'l-swoosh':
        ctx.fillStyle = liv.colors[0]!;
        ctx.beginPath();
        ctx.moveTo(0, h * 0.4);
        ctx.lineTo(w * 0.7, h * 0.56);
        ctx.lineTo(w, h * 0.44);
        ctx.lineTo(w, h * 0.38);
        ctx.lineTo(w * 0.6, h * 0.48);
        ctx.lineTo(0, h * 0.32);
        ctx.closePath();
        ctx.fill();
        break;
      case 'l-flames':
        for (let i = 0; i < 2; i++) {
          ctx.fillStyle = liv.colors[i]!;
          const k = 1 - i * 0.35;
          ctx.beginPath();
          ctx.moveTo(w, h * 0.38);
          ctx.lineTo(w * (1 - 0.18 * k), h * 0.6);
          ctx.lineTo(w * (1 - 0.28 * k), h * 0.42);
          ctx.lineTo(w * (1 - 0.4 * k), h * 0.64);
          ctx.lineTo(w * (1 - 0.52 * k), h * 0.38);
          ctx.lineTo(w, h * 0.3);
          ctx.closePath();
          ctx.fill();
        }
        break;
      case 'l-checker': {
        const n = 4;
        const cw = (w * 0.2) / n;
        for (let i = 0; i < n; i++)
          for (let j = 0; j < 3; j++) {
            ctx.fillStyle = liv.colors[(i + j) % 2]!;
            ctx.fillRect(i * cw, h * 0.34 + j * cw, cw, cw);
          }
        break;
      }
      case 'l-camo':
        for (let i = 0; i < 11; i++) {
          ctx.fillStyle = liv.colors[i % 2]!;
          ctx.beginPath();
          ctx.ellipse(w * (0.05 + noise(i, 3) * 0.9), h * (0.3 + noise(i, 4) * 0.45), w * (0.05 + noise(i, 5) * 0.08), h * 0.13, noise(i, 6), 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      case 'l-rainbow':
        liv.colors.forEach((col, i) => {
          ctx.fillStyle = col;
          ctx.fillRect(0, h * 0.56 - i * h * 0.07, w, h * 0.07);
        });
        break;
      case 'l-stripes':
        break;
    }
  });
  // Top: u = rear→front, v = across the width.
  const top = make(512, 128, (ctx, w, h) => {
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
        for (let i = 0; i < 11; i++) {
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
  shiftLamp: THREE.MeshStandardMaterial | null;
  smoke: THREE.Mesh[];
  len: number;
  dispose(): void;
}

/** A box between two points (pillars, struts). */
function strut(a: THREE.Vector3, b: THREE.Vector3, w: number, d: number, m: THREE.Material): THREE.Mesh {
  const dir = b.clone().sub(a);
  const len = dir.length();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, len, d), m);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return mesh;
}

/** Builds a car from its look: origin on the ground under the car's centre, nose toward +x. */
export function buildCar(look: CarLook): CarRig {
  const def = look.def;
  const sh = def.shape;
  const lv = look.levels;
  const L = sh.len;
  const W = sh.width;
  const g = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(d: T): T => {
    disposables.push(d);
    return d;
  };
  const add = (m: THREE.Mesh, shadow = true): THREE.Mesh => {
    m.castShadow = shadow;
    g.add(m);
    keep(m.geometry);
    return m;
  };
  const X = (u: number): number => u * L - L / 2;
  const drop = Math.min(lv.suspension * 0.016, sh.clear - 0.08);
  const Y = (m: number): number => m - drop;
  const wr = sh.wheels.r + lv.tyres * 0.008;
  const rearR = (sh.wheels.rearR ?? sh.wheels.r) + lv.tyres * 0.008;
  const tw = sh.wheels.w + lv.tyres * 0.02;
  const fwx = X(sh.wheels.front);
  const rwx = X(sh.wheels.rear);
  const paint = paintOf(look);
  const isRail = def.shape.cabin.kind === 'none';

  // ---- the body outline: top line rear→front, then the bottom with wheel wells
  const c = sh.cabin;
  const topLine: Pt[] = [
    [X(0), Y(sh.tail)],
    [X(0.035), Y(sh.deck)],
    [X(c.from) - 0.12, Y(sh.deck)],
    [X(c.from), Y(sh.belt)],
    [X(c.to), Y(sh.belt)],
    [X(c.to) + 0.14, Y(sh.cowl)],
    [X(0.94), Y(sh.nose)],
    [X(1), Y(sh.nose - 0.14)],
  ];
  const rounded = chaikin(topLine, c.kind === 'bug' ? 3 : 2);
  const clear = Y(sh.clear);
  const well = (cx: number, r: number, reverse: boolean): Pt[] => {
    const R = r * 1.14 + 0.03;
    const pts: Pt[] = [];
    const a0 = Math.asin(clamp((clear - r) / R, -1, 1));
    const n = 10;
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((Math.PI - 2 * a0) * i) / n;
      pts.push([cx + Math.cos(a) * R, r + Math.sin(a) * R]);
    }
    return reverse ? pts : pts.reverse();
  };
  const outline: Pt[] = [...rounded, [X(1), clear + 0.05], [X(0.975), clear]];
  if (!isRail) {
    outline.push(...well(fwx, wr, false));
    outline.push(...well(rwx, rearR, false));
  }
  outline.push([X(0.025), clear], [X(0), clear + 0.05]);
  const bodyShape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
  const b = Math.min(0.1, W * 0.055);
  const bodyGeo = keep(new THREE.ExtrudeGeometry(bodyShape, { depth: W - b * 2, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3, steps: 1, curveSegments: 4 }));
  bodyGeo.translate(0, 0, -(W - b * 2) / 2);
  // taper: the top narrows toward the belt line, the sill tucks in
  {
    const p = bodyGeo.attributes.position!;
    const belt = Y(sh.belt);
    const topY = Y(Math.max(sh.nose, sh.deck, sh.belt)) + b;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      const z = p.getZ(i);
      let k = 1;
      if (y > belt - 0.1 && topY > belt) k = 1 - 0.1 * clamp((y - (belt - 0.1)) / (topY - belt + 0.1), 0, 1);
      else if (y < clear + 0.22) k = 1 - 0.05 * clamp((clear + 0.22 - y) / 0.22, 0, 1);
      p.setZ(i, z * k);
    }
    smoothNormals(bodyGeo);
  }
  const seams: number[] = c.kind === 'open' || c.kind === 'none' ? [c.from + 0.02, c.to] : sh.doors === 2 ? [c.from + 0.03, (c.from + c.to) / 2 + 0.02, c.to + 0.01] : [c.from + 0.05, c.to + 0.01];
  const tex = liveryTextures(look, seams);
  keep(tex.side);
  keep(tex.top);
  const bodyH = Y(sh.belt) - clear;
  tex.side.repeat.set(1 / L, 1 / (bodyH * 1.08));
  tex.side.offset.set(0.5, -clear / (bodyH * 1.08));
  tex.top.repeat.set(1 / L, -1 / W);
  tex.top.offset.set(0.5, 1 / W + b / W);
  const paintOpts = { metalness: 0.12, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 1 };
  const sideMat = keep(new THREE.MeshPhysicalMaterial({ map: tex.side, ...paintOpts }));
  const topMat = keep(new THREE.MeshPhysicalMaterial({ map: tex.top, ...paintOpts }));
  const paintMat = keep(new THREE.MeshPhysicalMaterial({ color: paint, ...paintOpts }));
  const body = new THREE.Mesh(bodyGeo, [sideMat, topMat]);
  body.castShadow = true;
  g.add(body);

  // ---- cabin: glass block, roof skin, pillars
  const cabinW = W * 0.9;
  if (c.kind !== 'none' && c.kind !== 'open') {
    const belt = Y(sh.belt);
    const roof = Y(c.roof);
    let prof: Pt[] = [
      [X(c.from), belt - 0.06],
      [X(c.roofFrom), roof],
      [X(c.roofTo), roof],
      [X(c.to), belt - 0.06],
    ];
    prof = chaikin(prof, c.kind === 'bug' ? 3 : 1);
    const cs = new THREE.Shape(prof.map(([x, y]) => new THREE.Vector2(x, y)));
    const cb = 0.05;
    const cg = keep(new THREE.ExtrudeGeometry(cs, { depth: cabinW - cb * 2, bevelEnabled: true, bevelThickness: cb, bevelSize: cb, bevelSegments: 2, curveSegments: 3 }));
    cg.translate(0, 0, -(cabinW - cb * 2) / 2);
    const p = cg.attributes.position!;
    for (let i = 0; i < p.count; i++) {
      const t = clamp((p.getY(i) - belt) / (roof - belt), 0, 1);
      p.setZ(i, p.getZ(i) * (1 - c.taper * t));
    }
    smoothNormals(cg);
    const glass = new THREE.Mesh(cg, GLASS());
    glass.castShadow = true;
    g.add(glass);
    // roof skin
    const roofW = cabinW * (1 - c.taper) + 0.02;
    const roofLen = X(c.roofTo) - X(c.roofFrom) + 0.08;
    const roofGeo = keep(new THREE.BoxGeometry(roofLen, 0.07, roofW));
    const roofMesh = new THREE.Mesh(roofGeo, paintMat);
    roofMesh.position.set((X(c.roofTo) + X(c.roofFrom)) / 2, roof + 0.01, 0);
    roofMesh.castShadow = true;
    g.add(roofMesh);
    // pillars
    const zTop = (cabinW / 2) * (1 - c.taper) - 0.03;
    const zBot = cabinW / 2 - 0.03;
    for (const s of [1, -1]) {
      add(strut(new THREE.Vector3(X(c.to), belt - 0.02, s * zBot), new THREE.Vector3(X(c.roofTo) - 0.02, roof - 0.02, s * zTop), 0.09, 0.1, paintMat));
      add(strut(new THREE.Vector3(X(c.from), belt - 0.02, s * zBot), new THREE.Vector3(X(c.roofFrom) + 0.02, roof - 0.02, s * zTop), 0.1, 0.1, paintMat));
      if (sh.doors === 2) {
        const xm = (X(c.from) + X(c.to)) / 2 + 0.05;
        add(strut(new THREE.Vector3(xm, belt - 0.02, s * zBot), new THREE.Vector3(xm, roof - 0.02, s * zTop), 0.06, 0.08, DARK()));
      }
    }
  } else if (c.kind === 'open') {
    // a windscreen, a roll hoop and the driver
    const belt = Y(sh.belt);
    const ws = add(box(0.05, 0.42, cabinW * 0.86, GLASS(), X(c.to) - 0.12, belt + 0.16, 0));
    ws.rotation.z = -0.4;
    add(box(0.07, 0.3, 0.07, DARK(), X(c.from) + 0.25, belt + 0.14, 0));
    const hr = 0.17;
    const hx = X((c.from + c.to) / 2) - 0.05;
    add(new THREE.Mesh(new THREE.SphereGeometry(hr, 12, 10), std(look.helmet[0], { roughness: 0.3 }))).position.set(hx, belt + 0.12, -0.3);
    add(new THREE.Mesh(new THREE.SphereGeometry(hr * 0.8, 10, 8), DARK())).position.set(hx + hr * 0.45, belt + 0.12, -0.3);
    add(box(hr * 1.5, hr * 0.4, hr * 0.3, std(look.helmet[1]), hx, belt + 0.12 + hr * 0.9, -0.3));
    add(box(hr * 1.6, hr * 1.2, hr * 2, std(look.suit, { roughness: 0.9 }), hx - 0.05, belt - 0.12, -0.3));
  }

  // ---- wheels with arches
  const rim = getCosmetic(look.wheels)?.colors[0] ?? '#cfcfcf';
  const rimMat = std(rim, { metalness: 0.9, roughness: 0.25 });
  const wheels: THREE.Object3D[] = [];
  const tyreMat = lv.tyres >= 5 ? std('#101014', { roughness: 0.75 }) : RUBBER();
  const wheelAt = (x: number, r: number, width: number, side: 1 | -1): void => {
    const w = new THREE.Group();
    const tyre = cyl(r, width, tyreMat, 28);
    tyre.rotation.x = Math.PI / 2;
    tyre.castShadow = true;
    w.add(tyre);
    keep(tyre.geometry);
    const rimR = r * (lv.tyres >= 5 ? 0.62 : 0.66);
    const dish = cyl(rimR, width * 0.3, DARK(), 24);
    dish.rotation.x = Math.PI / 2;
    dish.position.z = side * width * 0.3;
    w.add(dish);
    keep(dish.geometry);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(rimR, 0.03, 8, 28), rimMat);
    ring.position.z = side * width * 0.45;
    w.add(ring);
    keep(ring.geometry);
    const spokes = look.wheels === 'w-mesh' ? 10 : look.wheels === 'w-turbine' ? 7 : look.wheels === 'w-deep' ? 5 : look.wheels === 'w-steel' ? 4 : 5;
    for (let i = 0; i < spokes; i++) {
      const sp = box(rimR * 1.8, 0.055, width * 0.12, rimMat);
      sp.rotation.z = (i / spokes) * Math.PI + (look.wheels === 'w-star' ? 0.2 : 0);
      sp.position.z = side * width * 0.46;
      w.add(sp);
      keep(sp.geometry);
    }
    const hub = cyl(rimR * 0.22, width * 0.2, CHROME(), 12);
    hub.rotation.x = Math.PI / 2;
    hub.position.z = side * width * 0.5;
    w.add(hub);
    keep(hub.geometry);
    w.position.set(x, r, side * (W / 2 + width / 2 - 0.12));
    g.add(w);
    wheels.push(w);
    // arch lip
    if (!isRail) {
      const lip = new THREE.Mesh(new THREE.TorusGeometry(r * 1.14 + 0.03, 0.045, 6, 18, Math.PI + 0.3), DARK());
      lip.rotation.z = -0.15;
      lip.position.set(x, r, side * (W / 2 - 0.01));
      g.add(lip);
      keep(lip.geometry);
    }
  };
  for (const s of [1, -1] as const) {
    wheelAt(rwx, rearR, isRail || def.shape.cabin.kind === 'fast' && sh.wheels.rearR ? tw : tw, s);
    wheelAt(fwx, isRail ? wr : wr, isRail ? tw * 0.5 : tw, s);
  }

  // ---- face: lights, grille, bumpers
  const noseX = X(1);
  const tailX = X(0);
  const lampY = Y(sh.nose) - 0.17;
  const zL = W * 0.33;
  switch (sh.lights) {
    case 'slim':
      for (const s of [1, -1]) {
        const housing = add(box(0.1, 0.12, W * 0.3, DARK(), noseX - 0.1, lampY, s * zL), false);
        housing.rotation.y = s * 0.35;
        const l = add(box(0.1, 0.075, W * 0.26, LAMP(), noseX - 0.07, lampY, s * zL), false);
        l.rotation.y = s * 0.35;
        add(box(0.05, 0.025, W * 0.22, std('#9ff3ff', { emissive: '#7fe8ff', emissiveIntensity: 1.2 }), noseX - 0.02, lampY + 0.07, s * zL), false).rotation.y = s * 0.35;
      }
      break;
    case 'rect':
      for (const s of [1, -1]) {
        add(box(0.08, 0.2, W * 0.26, DARK(), noseX - 0.06, lampY, s * zL), false);
        add(box(0.08, 0.16, W * 0.22, LAMP(), noseX - 0.03, lampY, s * zL), false);
      }
      break;
    case 'bar':
      add(box(0.05, 0.06, W * 0.84, LAMP(), noseX - 0.03, lampY, 0), false);
      break;
    case 'round':
      for (const s of [1, -1]) {
        const l = add(cyl(0.14, 0.06, LAMP(), 18), false);
        l.rotation.z = Math.PI / 2;
        l.position.set(noseX - 0.03, lampY, s * zL);
        const ring = add(new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.02, 6, 18), CHROME()), false);
        ring.rotation.y = Math.PI / 2;
        ring.position.set(noseX, lampY, s * zL);
      }
      break;
    case 'quad':
      for (const s of [1, -1])
        for (const k of [0.25, 0.4]) {
          const l = add(cyl(0.09, 0.06, LAMP(), 14), false);
          l.rotation.z = Math.PI / 2;
          l.position.set(noseX - 0.03, lampY, s * W * k);
        }
      break;
    case 'popup':
      for (const s of [1, -1]) {
        add(box(0.34, 0.06, W * 0.22, paintMat, noseX - 0.34, Y(sh.nose) + 0.03, s * zL));
        add(box(0.04, 0.1, W * 0.2, LAMP(), noseX - 0.17, Y(sh.nose) - 0.02, s * zL), false);
      }
      break;
  }
  // grille
  const grY = Y(sh.nose) - 0.42;
  switch (sh.grille) {
    case 'wide':
      add(box(0.06, 0.16, W * 0.5, DARK(), noseX - 0.02, grY, 0), false);
      for (let i = 0; i < 3; i++) add(box(0.07, 0.015, W * 0.46, std('#6b6b75'), noseX, grY - 0.05 + i * 0.05, 0), false);
      break;
    case 'slim':
      add(box(0.06, 0.08, W * 0.46, DARK(), noseX - 0.02, grY + 0.06, 0), false);
      break;
    case 'oval': {
      const o = add(cyl(0.11, 0.06, DARK(), 16), false);
      o.rotation.z = Math.PI / 2;
      o.scale.set(1, 1, W * 2.2);
      o.position.set(noseX - 0.02, grY + 0.02, 0);
      break;
    }
    case 'twin':
      for (const s of [1, -1]) add(box(0.06, 0.12, W * 0.16, DARK(), noseX - 0.02, grY + 0.04, s * W * 0.1), false);
      break;
    case 'mesh':
      add(box(0.06, 0.2, W * 0.56, std('#2a2a33', { roughness: 0.5 }), noseX - 0.02, grY, 0), false);
      break;
    case 'upright':
      add(box(0.08, 0.3, W * 0.48, CHROME(), noseX - 0.02, Y(sh.nose) - 0.3, 0), false);
      add(box(0.1, 0.24, W * 0.42, DARK(), noseX - 0.02, Y(sh.nose) - 0.3, 0), false);
      for (let i = 0; i < 4; i++) add(box(0.11, 0.015, W * 0.4, CHROME(), noseX, Y(sh.nose) - 0.4 + i * 0.06, 0), false);
      break;
    case 'none':
      break;
  }
  // bumpers and splitter / diffuser
  const chromeBumpers = sh.features.includes('chrome');
  add(box(0.22, 0.09, W * 0.96, chromeBumpers ? CHROME() : DARK(), noseX - 0.1, clear + 0.1, 0));
  add(box(0.22, 0.09, W * 0.96, chromeBumpers ? CHROME() : DARK(), tailX + 0.1, clear + 0.1, 0));
  if (lv.aero >= 2 || sh.features.includes('lip')) add(box(0.4, 0.04, W * 1.0, DARK(), noseX - 0.14, clear + 0.03, 0));
  if (lv.aero >= 5) add(box(0.45, 0.07, W * 0.9, DARK(), tailX + 0.15, clear + 0.03, 0));
  // tail lamps and plate
  const tlY = Y(sh.tail) - 0.14;
  switch (sh.tails) {
    case 'bar':
      add(box(0.05, 0.09, W * 0.82, TAIL(), tailX + 0.02, tlY, 0), false);
      break;
    case 'strip':
      add(box(0.05, 0.05, W * 0.86, TAIL(), tailX + 0.02, tlY + 0.04, 0), false);
      break;
    case 'rect':
      for (const s of [1, -1]) add(box(0.05, 0.14, W * 0.22, TAIL(), tailX + 0.02, tlY, s * W * 0.33), false);
      break;
    case 'round':
      for (const s of [1, -1])
        for (const k of [0.3, 0.4]) {
          const l = add(cyl(0.08, 0.05, TAIL(), 14), false);
          l.rotation.z = Math.PI / 2;
          l.position.set(tailX + 0.02, tlY, s * W * k);
        }
      break;
    case 'split':
      for (const s of [1, -1]) for (let k = 0; k < 3; k++) add(box(0.05, 0.16, 0.06, TAIL(), tailX + 0.02, tlY, s * (W * 0.28 + k * 0.09)), false);
      break;
  }
  add(box(0.02, 0.11, 0.42, std('#f4f4f4'), tailX + 0.01, clear + 0.22, 0), false);
  // mirrors
  if (c.kind !== 'none') {
    for (const s of [1, -1]) {
      add(box(0.09, 0.07, 0.17, paintMat, X(c.to) + 0.08, Y(sh.belt) + 0.1, s * (W / 2 + 0.1)));
      add(box(0.03, 0.03, 0.1, DARK(), X(c.to) + 0.08, Y(sh.belt) + 0.06, s * (W / 2 + 0.03)), false);
    }
  }
  // exhausts
  const pipes = def.hp > 300 || lv.engine >= 6 ? 2 : 1;
  for (let i = 0; i < pipes; i++) {
    const e = add(cyl(0.045, 0.18, CHROME(), 10), false);
    e.rotation.z = Math.PI / 2;
    e.position.set(tailX - 0.02, clear + 0.08, pipes === 2 ? (i ? -1 : 1) * W * 0.3 : -W * 0.3);
  }

  // ---- features and parts
  const has = (f: Feature): boolean => sh.features.includes(f);
  const flames: THREE.Object3D[] = [];
  const wingLevel = lv.aero >= 7 || has('bigwing') ? 2 : lv.aero >= 4 || has('wing') ? 1 : 0;
  if (wingLevel && !isRail) {
    const wh = wingLevel === 2 ? 0.42 : 0.2;
    const top = Y(sh.deck) + 0.02;
    const wing = add(box(0.42, 0.05, W * (wingLevel === 2 ? 1.02 : 0.9), DARK(), X(0.06), top + wh, 0));
    wing.rotation.z = -0.12;
    for (const s of [1, -1]) add(box(0.1, wh, 0.06, DARK(), X(0.07), top + wh / 2, s * W * (wingLevel === 2 ? 0.4 : 0.32)));
    if (wingLevel === 2) for (const s of [1, -1]) add(box(0.4, 0.22, 0.03, DARK(), X(0.06), top + wh + 0.08, s * W * 0.5));
  } else if (lv.aero >= 1 && !isRail) add(box(0.22, 0.05, W * 0.7, DARK(), X(0.03), Y(sh.deck) + 0.03, 0));
  if ((lv.engine >= 3 || has('scoop')) && c.kind !== 'open' && !isRail) {
    const sc = add(box(0.55, 0.11, W * 0.3, lv.engine >= 3 ? DARK() : paintMat, X(0.8), Y(sh.cowl) + 0.03, 0));
    sc.rotation.z = 0.08;
  }
  if (has('vents')) for (let i = 0; i < 4; i++) add(box(0.05, 0.02, W * 0.6, DARK(), X(0.12) + i * 0.16, Y(sh.deck) + 0.015, 0), false);
  if (has('roofscoop') && c.kind !== 'open') add(box(0.3, 0.14, 0.26, DARK(), X(c.roofFrom) - 0.1, Y(c.roof) + 0.08, 0));
  if (has('sidepipes'))
    for (const s of [1, -1]) {
      const pipe = add(cyl(0.05, L * 0.4, CHROME(), 10));
      pipe.rotation.z = Math.PI / 2;
      pipe.position.set(X(0.5), clear + 0.1, s * (W / 2 + 0.02));
    }
  if (has('bed')) {
    add(box(L * (c.from - 0.03), 0.04, W * 0.84, DARK(), X(c.from / 2 - 0.0), Y(sh.deck) - 0.04, 0), false);
    add(box(0.05, 0.3, W * 0.84, DARK(), X(c.from) - 0.02, Y(sh.deck) - 0.15, 0), false);
  }
  if (has('bullbar')) {
    add(box(0.08, 0.5, W * 0.7, CHROME(), noseX + 0.08, clear + 0.4, 0));
    add(box(0.12, 0.06, W * 0.75, CHROME(), noseX + 0.08, clear + 0.62, 0));
  }
  if (has('fins')) for (const s of [1, -1]) add(box(1.2, 0.2, 0.05, paintMat, X(0.12), Y(sh.deck) + 0.1, s * (W / 2 - 0.05)));
  if (has('hump')) add(box(1.2, 0.3, W * 0.5, DARK(), X(0.72), Y(sh.cowl) + 0.1, 0));
  if (has('rails')) {
    for (const s of [1, -1]) add(box(L * 0.8, 0.06, 0.06, CHROME(), X(0.5), clear + 0.2, s * 0.32));
    add(box(0.6, 0.5, 0.6, DARK(), X(0.2), Y(sh.deck) + 0.2, 0));
    add(box(0.5, 0.3, 0.5, GLASS(), X(0.12), Y(sh.deck) + 0.5, 0));
  }
  if (has('canopy') && isRail) {
    const wingY = Y(sh.deck) + 1.2;
    add(box(0.8, 0.06, 1.6, DARK(), X(0.06), wingY, 0));
    for (const s of [1, -1]) add(box(0.06, 1.0, 0.06, DARK(), X(0.07), wingY - 0.5, s * 0.6));
  }
  if (lv.engine >= 6) {
    for (const z of [W * 0.3, -W * 0.3]) {
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.6, 7), std('#ff8500', { emissive: '#ff5500', emissiveIntensity: 1.2 }));
      flame.rotation.z = Math.PI / 2;
      flame.position.set(tailX - 0.45, clear + 0.08, z);
      flame.visible = false;
      g.add(flame);
      flames.push(flame);
      keep(flame.geometry);
    }
  }
  let shiftLamp: THREE.MeshStandardMaterial | null = null;
  if (lv.transmission >= 2 && c.kind !== 'none' && c.kind !== 'open') {
    shiftLamp = keep(new THREE.MeshStandardMaterial({ color: '#3a3845', emissive: '#000000' }));
    add(new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), shiftLamp), false).position.set(X(c.roofTo) - 0.1, Y(c.roof) + 0.06, 0);
  }
  if (lv.looks >= 4) {
    const glowColor = lv.looks >= 7 ? '#ff5fa2' : '#c4f034';
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(L * 0.8, W * 1.2), new THREE.MeshBasicMaterial({ color: glowColor, transparent: true, opacity: 0.3, depthWrite: false }));
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.015;
    g.add(glow);
    keep(glow.geometry);
    keep(glow.material);
  }

  // smoke pool
  const smoke: THREE.Mesh[] = [];
  const smokeGeo = keep(new THREE.SphereGeometry(0.4, 7, 6));
  for (let i = 0; i < 12; i++) {
    const m = new THREE.Mesh(smokeGeo, keep(new THREE.MeshBasicMaterial({ color: '#f4f4f4', transparent: true, opacity: 0.5, depthWrite: false })));
    m.visible = false;
    g.add(m);
    smoke.push(m);
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
  lamps: THREE.MeshStandardMaterial[];
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

function windowsTexture(base: string): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 64;
  cv.height = 128;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 64, 128);
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 10; j++) {
      ctx.fillStyle = (i * 7 + j * 3) % 5 === 0 ? '#fff6c8' : '#7cc7ff';
      ctx.fillRect(6 + i * 14, 6 + j * 12, 9, 7);
    }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function buildWorld(env: EnvDef): World {
  const g = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const lamps: THREE.MeshStandardMaterial[] = [];
  const clouds: THREE.Object3D[] = [];
  const keep = <T extends { dispose(): void }>(d: T): T => {
    disposables.push(d);
    return d;
  };
  const add = (m: THREE.Mesh, receive = false): THREE.Mesh => {
    m.receiveShadow = receive;
    g.add(m);
    keep(m.geometry);
    return m;
  };
  const lam = (color: string): THREE.MeshLambertMaterial => keep(new THREE.MeshLambertMaterial({ color }));

  // sky dome with a vertical gradient
  const skyGeo = keep(new THREE.SphereGeometry(950, 24, 12));
  const pos = skyGeo.attributes.position!;
  const colors = new Float32Array(pos.count * 3);
  const top = new THREE.Color(env.sky[0]);
  const bottom = new THREE.Color(env.sky[1]);
  for (let i = 0; i < pos.count; i++) {
    const t = clamp(pos.getY(i) / 950, -0.05, 1);
    const cc = bottom.clone().lerp(top, Math.pow(Math.max(0, t), 0.55));
    colors[i * 3] = cc.r;
    colors[i * 3 + 1] = cc.g;
    colors[i * 3 + 2] = cc.b;
  }
  skyGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const sky = new THREE.Mesh(skyGeo, keep(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false })));
  sky.position.set(200, -30, 0);
  g.add(sky);
  const sun = new THREE.Mesh(keep(new THREE.SphereGeometry(18, 14, 10)), keep(new THREE.MeshBasicMaterial({ color: '#fffbe6', fog: false })));
  sun.position.set(env.sun.x + 200, env.sun.y, env.sun.z);
  g.add(sun);
  const halo = new THREE.Mesh(keep(new THREE.SphereGeometry(34, 14, 10)), keep(new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.18, fog: false })));
  halo.position.copy(sun.position);
  g.add(halo);
  // clouds
  const cloudMat = lam('#ffffff');
  for (let i = 0; i < 12; i++) {
    const cl = new THREE.Group();
    for (let k = 0; k < 4; k++) {
      const s = 7 + noise(i * 4 + k, 11) * 8;
      const puff = new THREE.Mesh(keep(new THREE.SphereGeometry(s, 9, 7)), cloudMat);
      puff.scale.y = 0.5;
      puff.position.set(k * s * 0.9 - s * 1.5, noise(i * 4 + k, 12) * 3, (noise(i * 4 + k, 13) - 0.5) * s);
      cl.add(puff);
    }
    cl.position.set(-150 + noise(i, 12) * 800, 85 + noise(i, 13) * 50, (noise(i, 14) - 0.5) * 700);
    g.add(cl);
    clouds.push(cl);
  }

  // ground, verge, strip
  add(new THREE.Mesh(new THREE.PlaneGeometry(2600, 2600), lam(env.ground)).rotateX(-Math.PI / 2), true).position.set(200, -0.03, 0);
  add(new THREE.Mesh(new THREE.PlaneGeometry(640, 44), lam(env.verge)).rotateX(-Math.PI / 2), true).position.set(200, -0.015, 0);
  const asphalt = keep(new THREE.MeshStandardMaterial({ color: env.track, roughness: 0.95 }));
  add(new THREE.Mesh(new THREE.PlaneGeometry(640, LANE_W * 2 + 1.6), asphalt).rotateX(-Math.PI / 2), true).position.set(200, 0, 0);
  // the groove: darker rubbered lane centres
  const grooveMat = keep(new THREE.MeshStandardMaterial({ color: shade(env.track, -0.25), roughness: 1 }));
  for (const z of LANE_Z) add(new THREE.Mesh(new THREE.PlaneGeometry(420, 1.6), grooveMat).rotateX(-Math.PI / 2), true).position.set(200, 0.004, z);
  const lineGeo = keep(new THREE.PlaneGeometry(640, 0.18));
  for (let k = 0; k <= LANES; k++) {
    const l = new THREE.Mesh(lineGeo, lam(env.line));
    l.rotation.x = -Math.PI / 2;
    l.position.set(200, 0.006, -LANE_W + k * LANE_PITCH);
    g.add(l);
  }
  // start line, distance marks and boards
  add(new THREE.Mesh(new THREE.PlaneGeometry(0.5, LANE_W * 2 + 1.6), lam('#ffffff')).rotateX(-Math.PI / 2)).position.set(0, 0.007, 0);
  const markGeo = keep(new THREE.PlaneGeometry(0.7, 1.4));
  for (let m = 20; m < DISTANCE_M; m += 20) {
    for (const z of [-(LANE_W + 1.0), LANE_W + 1.0]) {
      const k = new THREE.Mesh(markGeo, lam('#ffffff'));
      k.rotation.x = -Math.PI / 2;
      k.position.set(m, 0.007, z);
      g.add(k);
    }
    if (m % 100 === 0) {
      const t = keep(textTexture(`${m}`, '#ffd12e', '#1d1238', 128, 64, 40));
      const sign = new THREE.Mesh(keep(new THREE.BoxGeometry(0.15, 0.8, 1.6)), [DARK(), DARK(), DARK(), DARK(), keep(new THREE.MeshLambertMaterial({ map: t })), keep(new THREE.MeshLambertMaterial({ map: t }))]);
      sign.position.set(m, 1.7, -(LANE_W + 2.6));
      sign.rotation.y = Math.PI / 2;
      g.add(sign);
      g.add(box(0.12, 1.3, 0.12, DARK(), m, 0.65, -(LANE_W + 2.6)));
    }
  }
  // tyre-wall barriers along both edges
  const tyreGeo = keep(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10));
  const red = lam('#ff3b4e');
  const white = lam('#ffffff');
  for (let x = -40; x < 460; x += 0.9) {
    const i = Math.round(x / 0.9);
    for (const z of [-(LANE_W + 1.9), LANE_W + 1.9]) {
      const t = new THREE.Mesh(tyreGeo, (i >> 2) % 2 ? red : white);
      t.position.set(x, 0.15 + (i % 2) * 0.3, z);
      g.add(t);
    }
  }
  // finish: checker band and the arch
  const chk = keep(checkerTexture());
  chk.repeat.set(2, 12);
  const finish = new THREE.Mesh(keep(new THREE.PlaneGeometry(2.2, LANE_W * 2 + 1.6)), keep(new THREE.MeshLambertMaterial({ map: chk })));
  finish.rotation.x = -Math.PI / 2;
  finish.position.set(DISTANCE_M + 1, 0.008, 0);
  g.add(finish);
  for (const z of [-(LANE_W + 2.4), LANE_W + 2.4]) g.add(box(0.5, 8, 0.5, DARK(), DISTANCE_M, 4, z));
  const ft = keep(textTexture('FINISH', '#ff3b4e', '#ffffff', 512, 96, 64));
  const bannerMesh = new THREE.Mesh(keep(new THREE.BoxGeometry(0.3, 1.8, LANE_W * 2 + 5.3)), [keep(new THREE.MeshLambertMaterial({ map: ft })), keep(new THREE.MeshLambertMaterial({ map: ft })), red, red, red, red]);
  bannerMesh.position.set(DISTANCE_M, 8, 0);
  g.add(bannerMesh);
  // a sponsor gantry over the start with the game's name
  const gt = keep(textTexture('LAUNCH CONTROL', '#ffd12e', '#1d1238', 1024, 128, 86));
  const gantry = new THREE.Mesh(keep(new THREE.BoxGeometry(0.4, 1.6, LANE_W * 2 + 5.3)), [keep(new THREE.MeshLambertMaterial({ map: gt })), keep(new THREE.MeshLambertMaterial({ map: gt })), lam('#ffd12e'), lam('#ffd12e'), lam('#ffd12e'), lam('#ffd12e')]);
  gantry.position.set(-14, 7.5, 0);
  g.add(gantry);
  for (const z of [-(LANE_W + 2.4), LANE_W + 2.4]) g.add(box(0.4, 7.5, 0.4, DARK(), -14, 3.75, z));
  // the tree: a gantry over the strip ahead of the cars, a light cluster above every lane
  const tree = new THREE.Group();
  for (const z of [-(LANE_W + 1.6), LANE_W + 1.6]) tree.add(box(0.3, 6.5, 0.3, DARK(), 0, 3.25, z));
  tree.add(box(0.35, 0.35, LANE_W * 2 + 3.5, DARK(), 0, 6.5, 0));
  const lampGeo = keep(new THREE.SphereGeometry(0.19, 12, 10));
  const lampColors = ['#ffb703', '#ffb703', '#ffb703', '#06d6a0', '#e63946'];
  lampColors.forEach((col, i) => {
    const m = keep(new THREE.MeshStandardMaterial({ color: '#3a3845', emissive: '#000000', roughness: 0.3 }));
    m.userData = { on: col };
    for (const z of LANE_Z) {
      if (i === 0) tree.add(box(0.5, 2.6, 0.7, DARK(), 0, 5.0, z));
      const l = new THREE.Mesh(lampGeo, m);
      l.position.set(-0.3, 6.0 - i * 0.5, z);
      tree.add(l);
    }
    lamps.push(m);
  });
  tree.position.set(9, 0, 0);
  g.add(tree);

  // grandstands with a crowd and bunting
  const standGeo = keep(new THREE.BoxGeometry(19, 1, 2.6));
  const crowdGeo = keep(new THREE.SphereGeometry(0.26, 7, 6));
  const crowd = new THREE.InstancedMesh(crowdGeo, keep(new THREE.MeshLambertMaterial({ color: '#ffffff' })), 24 * 2 * 3 * 11);
  const dummy = new THREE.Object3D();
  const palette = ['#1d1238', '#ffffff', '#ffd12e', '#22e4ff', '#ff4fc8', '#c4f034', '#ff6a1a'];
  let ci = 0;
  for (let seg = 0; seg < 24; seg++) {
    const x = -30 + seg * 20;
    for (const side of [1, -1]) {
      for (let row = 0; row < 3; row++) {
        const s = new THREE.Mesh(standGeo, lam(seg % 2 ? env.stands[0] : env.stands[1]));
        s.position.set(x, 0.5 + row, side * (LANE_W + 7.5 + row * 2.6));
        g.add(s);
        for (let k = 0; k < 11; k++) {
          dummy.position.set(x - 8.5 + k * 1.7, 1.3 + row, side * (LANE_W + 7.5 + row * 2.6) + (noise(ci, 15) - 0.5));
          dummy.scale.setScalar(0.8 + noise(ci, 16) * 0.5);
          dummy.updateMatrix();
          crowd.setMatrixAt(ci, dummy.matrix);
          crowd.setColorAt(ci, new THREE.Color(palette[(ci * 7 + seg) % palette.length]!));
          ci++;
        }
      }
      // a roof over the back row
      const roof = new THREE.Mesh(keep(new THREE.BoxGeometry(19, 0.2, 4)), lam(seg % 2 ? env.stands[1] : env.stands[0]));
      roof.position.set(x, 5.4, side * (LANE_W + 7.5 + 2 * 2.6 + 0.4));
      g.add(roof);
      for (const dx of [-8, 8]) g.add(box(0.2, 2.4, 0.2, DARK(), x + dx, 4.2, side * (LANE_W + 7.5 + 2 * 2.6 + 1.8)));
    }
  }
  crowd.count = ci;
  g.add(crowd);
  keep(crowd);
  // bunting line along the front of the stands
  const flagGeo = keep(new THREE.PlaneGeometry(0.5, 0.4));
  for (let x = -30; x < 450; x += 1.6) {
    for (const side of [1, -1]) {
      const f = new THREE.Mesh(flagGeo, lam(palette[Math.abs(Math.round(x / 1.6)) % palette.length]!));
      f.position.set(x, 3.9, side * (LANE_W + 6.2));
      f.rotation.y = side > 0 ? 0 : Math.PI;
      g.add(f);
    }
  }

  // ---- scenery per strip
  const palm = (i: number): THREE.Group => {
    const pg = new THREE.Group();
    const s = 0.8 + noise(i, 20) * 0.6;
    const trunk = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.16 * s, 0.3 * s, 7 * s, 7)), lam('#9c6644'));
    trunk.position.y = 3.5 * s;
    trunk.rotation.z = (noise(i, 21) - 0.5) * 0.2;
    pg.add(trunk);
    for (let k = 0; k < 7; k++) {
      const leaf = box(3.2 * s, 0.1 * s, 0.7 * s, lam(k % 2 ? '#40916c' : '#2d6a4f'), 1.4 * s, 7 * s, 0);
      leaf.rotation.z = -0.55;
      const holder = new THREE.Group();
      holder.add(leaf);
      holder.rotation.y = (k / 7) * Math.PI * 2;
      pg.add(holder);
    }
    return pg;
  };
  const pine = (i: number): THREE.Group => {
    const pg = new THREE.Group();
    const s = 0.9 + noise(i, 22) * 0.8;
    pg.add(box(0.4 * s, 1.4 * s, 0.4 * s, lam('#6f4e37'), 0, 0.7 * s, 0));
    for (let k = 0; k < 3; k++) {
      const cone = new THREE.Mesh(keep(new THREE.ConeGeometry((2.4 - k * 0.55) * s, 2.6 * s, 7)), lam(k % 2 ? '#40916c' : '#2d6a4f'));
      cone.position.y = (1.8 + k * 1.6) * s;
      pg.add(cone);
    }
    return pg;
  };
  const cactus = (i: number): THREE.Group => {
    const pg = new THREE.Group();
    const s = 0.8 + noise(i, 23) * 0.7;
    const cm = lam('#2d6a4f');
    pg.add(box(0.5 * s, 3 * s, 0.5 * s, cm, 0, 1.5 * s, 0));
    pg.add(box(0.35 * s, 1.2 * s, 0.35 * s, cm, 0.9 * s, 1.6 * s, 0));
    pg.add(box(1.0 * s, 0.35 * s, 0.35 * s, cm, 0.5 * s, 1.1 * s, 0));
    pg.add(box(0.35 * s, 1.4 * s, 0.35 * s, cm, -0.9 * s, 2.1 * s, 0));
    pg.add(box(1.0 * s, 0.35 * s, 0.35 * s, cm, -0.5 * s, 1.5 * s, 0));
    return pg;
  };
  const building = (i: number, pastel: boolean): THREE.Mesh => {
    const h = 10 + noise(i, 24) * (pastel ? 24 : 50);
    const w = 10 + noise(i, 25) * 10;
    const cols = pastel ? ['#ffb4a2', '#ffd6a5', '#caffbf', '#9bf6ff', '#bdb2ff', '#ffc6ff', '#fdffb6'] : ['#5a6c9e', '#7d8fc0', '#8ea4d2', '#6b7fb3', '#9fb3dd'];
    const base = cols[i % cols.length]!;
    const wt = keep(windowsTexture(base));
    wt.repeat.set(Math.max(1, Math.round(w / 8)), Math.max(1, Math.round(h / 12)));
    const m = new THREE.Mesh(keep(new THREE.BoxGeometry(w, h, w)), [keep(new THREE.MeshLambertMaterial({ map: wt })), keep(new THREE.MeshLambertMaterial({ map: wt })), lam(base), lam(base), keep(new THREE.MeshLambertMaterial({ map: wt })), keep(new THREE.MeshLambertMaterial({ map: wt }))]);
    m.position.y = h / 2;
    return m;
  };
  const mountain = (i: number, x: number, z: number, snow: boolean): void => {
    const h = 50 + noise(i, 31) * 80;
    const m = new THREE.Mesh(keep(new THREE.ConeGeometry(60 + noise(i, 32) * 50, h, 6)), lam(i % 3 ? env.far : env.far2));
    m.position.set(x, h / 2 - 4, z);
    m.rotation.y = noise(i, 33) * 3;
    g.add(m);
    if (snow) {
      const cap = new THREE.Mesh(keep(new THREE.ConeGeometry(18, h * 0.3, 6)), lam('#ffffff'));
      cap.position.set(x, h - h * 0.15 - 4, z);
      cap.rotation.y = m.rotation.y;
      g.add(cap);
    }
  };
  const mesa = (i: number, x: number, z: number): void => {
    const h = 20 + noise(i, 34) * 40;
    const w = 30 + noise(i, 35) * 50;
    g.add(box(w, h, w * 0.7, lam(i % 2 ? env.far : env.far2), x, h / 2 - 2, z));
    g.add(box(w * 0.6, h * 0.35, w * 0.4, lam(env.far2), x, h + h * 0.17 - 2, z));
  };

  const sc = env.scenery;
  if (sc === 'bay') {
    // the sea on the player's right, a city on the left
    add(new THREE.Mesh(new THREE.PlaneGeometry(1600, 700), lam('#2ec4f0')).rotateX(-Math.PI / 2)).position.set(200, -0.5, -400);
    add(new THREE.Mesh(new THREE.PlaneGeometry(1600, 24), lam('#f6e3b4')).rotateX(-Math.PI / 2)).position.set(200, -0.2, -48);
    for (let i = 0; i < 32; i++) {
      const p = palm(i);
      p.position.set(-60 + i * 16 + noise(i, 26) * 8, 0, -(LANE_W + 22 + noise(i, 27) * 10));
      g.add(p);
      const q = palm(i + 50);
      q.position.set(-50 + i * 16 + noise(i, 28) * 8, 0, LANE_W + 20 + noise(i, 29) * 6);
      g.add(q);
    }
    for (let i = 0; i < 26; i++) {
      const bld = building(i, true);
      bld.position.x = -80 + i * 24 + noise(i, 30) * 10;
      bld.position.z = LANE_W + 44 + noise(i, 31) * 30;
      g.add(bld);
    }
    for (let i = 0; i < 14; i++) mountain(i, -200 + i * 60, 330 + noise(i, 36) * 80, false);
  } else if (sc === 'canyon') {
    for (let i = 0; i < 22; i++) {
      const side = i % 2 ? 1 : -1;
      mesa(i, -220 + (i >> 1) * 60 + noise(i, 37) * 30, side * (150 + noise(i, 38) * 120));
    }
    for (let i = 0; i < 40; i++) {
      const cc = cactus(i);
      cc.position.set(-50 + i * 13 + noise(i, 39) * 6, 0, (i % 2 ? 1 : -1) * (LANE_W + 20 + noise(i, 40) * 14));
      g.add(cc);
    }
    for (let i = 0; i < 10; i++) mountain(i + 40, -200 + i * 80, (i % 2 ? 1 : -1) * 420, false);
  } else if (sc === 'alpine') {
    for (let i = 0; i < 70; i++) {
      const p = pine(i);
      p.position.set(-60 + (i >> 1) * 15 + noise(i, 41) * 8, 0, (i % 2 ? 1 : -1) * (LANE_W + 20 + noise(i, 42) * 30));
      g.add(p);
    }
    for (let i = 0; i < 22; i++) mountain(i, -260 + (i >> 1) * 60, (i % 2 ? 1 : -1) * (240 + noise(i, 43) * 120), true);
    // chalets
    for (let i = 0; i < 8; i++) {
      const x = -20 + i * 60;
      const z = (i % 2 ? 1 : -1) * (LANE_W + 60 + noise(i, 44) * 20);
      g.add(box(8, 5, 8, lam('#f4e1c1'), x, 2.5, z));
      const roof = new THREE.Mesh(keep(new THREE.ConeGeometry(7.5, 4, 4)), lam('#9a3b3b'));
      roof.position.set(x, 7, z);
      roof.rotation.y = Math.PI / 4;
      g.add(roof);
    }
  } else {
    for (let i = 0; i < 44; i++) {
      const bld = building(i, i % 3 === 0);
      const side = i % 2 ? 1 : -1;
      bld.position.x = -80 + (i >> 1) * 28 + noise(i, 45) * 10;
      bld.position.z = side * (LANE_W + 36 + noise(i, 46) * 50);
      g.add(bld);
    }
    for (let i = 0; i < 20; i++) {
      const p = palm(i + 80);
      p.position.set(-40 + i * 24 + noise(i, 47) * 8, 0, (i % 2 ? 1 : -1) * (LANE_W + 21 + noise(i, 48) * 4));
      g.add(p);
    }
    for (let i = 0; i < 12; i++) mountain(i + 60, -200 + i * 70, (i % 2 ? 1 : -1) * 460, false);
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
export interface FixedCamera {
  pos: [number, number, number];
  aim: [number, number, number];
  fov?: number;
}

export class Stage3D {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(56, 1, 0.1, 1800);
  private sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private world: World | null = null;
  private envId = '';
  private cars: (CarRig | null)[] = Array.from({ length: LANES }, () => null);
  private camPos = new THREE.Vector3(-9, 3.2, 0);
  private camAim = new THREE.Vector3(8, 1, 0);
  private w = 1;
  private h = 1;
  private smokeT = 0;
  private pmrem: THREE.PMREMGenerator;

  constructor(canvas?: HTMLCanvasElement, shadows = true) {
    this.canvas = canvas ?? document.createElement('canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = this.pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.hemi = new THREE.HemisphereLight('#ffffff', '#88aa88', 0.9);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff7e6', 2.2);
    this.sun.castShadow = shadows;
    this.sun.shadow.mapSize.set(shadows ? 2048 : 256, shadows ? 2048 : 256);
    const sc = this.sun.shadow.camera;
    sc.left = -18;
    sc.right = 18;
    sc.top = 18;
    sc.bottom = -18;
    sc.near = 1;
    sc.far = 140;
    this.sun.shadow.bias = -0.0015;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
  }

  setEnv(id: string): void {
    if (id === this.envId && this.world) return;
    const env = ENV_DEFS[id] ?? ENV_DEFS['e-bay']!;
    if (this.world) {
      this.scene.remove(this.world.group);
      this.world.dispose();
    }
    this.world = buildWorld(env);
    this.scene.add(this.world.group);
    this.envId = env.id;
    this.scene.fog = new THREE.Fog(env.fog, 120, 700);
    this.hemi.color.set(env.light[0]);
    this.hemi.groundColor.set(env.light[1]);
  }

  setCar(i: number, look: CarLook | null): void {
    if (i < 0 || i >= LANES) return;
    const old = this.cars[i];
    if (old) {
      this.scene.remove(old.group);
      old.dispose();
      this.cars[i] = null;
    }
    if (!look) return;
    const rig = buildCar(look);
    rig.group.position.set(0, 0, LANE_Z[i]!);
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

  private placeCar(i: number, s: CarState, dt: number, t: number): void {
    const rig = this.cars[i];
    if (!rig) return;
    rig.group.position.x = s.x;
    const spin = s.spinning ? s.v + 18 : s.v;
    for (const w of rig.wheels) w.rotation.z -= (spin * dt) / rig.wheelR;
    rig.group.rotation.z = lerp(rig.group.rotation.z, s.v > 0 && s.rpm / s.redline > 0.6 ? -0.02 : 0, 0.1);
    const frac = s.rpm / s.redline;
    for (const f of rig.flames) f.visible = frac > 0.86 && !s.dead && Math.sin(t * 60) > -0.3;
    if (rig.shiftLamp) rig.shiftLamp.emissive.set(frac > 0.9 && Math.sin(t * 40) > 0 ? '#ff2a1a' : '#000000');
    for (const m of rig.smoke) {
      const mt = m.material as THREE.MeshBasicMaterial;
      if (!m.visible) continue;
      m.position.x -= (s.v * 0.3 + 2) * dt;
      m.position.y += 1.0 * dt;
      m.scale.addScalar(1.1 * dt);
      mt.opacity -= 0.8 * dt;
      if (mt.opacity <= 0) m.visible = false;
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
  renderRace(cars: CarState[], ambers: number, green: boolean, t: number, dt: number, fixed?: FixedCamera): void {
    if (!this.world) this.setEnv('e-bay');
    cars.forEach((c, i) => this.placeCar(i, c, dt, t));
    const me = cars[0]!;
    this.world!.lamps.forEach((m, i) => {
      const on = i < 3 ? ambers > i && !green : i === 3 ? green : false;
      m.emissive.set(on ? (m.userData.on as string) : '#000000');
      m.color.set(on ? (m.userData.on as string) : '#3a3845');
    });
    for (const c of this.world!.clouds) c.position.x += dt * 1.5;
    const back = 9 + Math.min(4, me.v * 0.04);
    const target = new THREE.Vector3(me.x - back, 3.4 + Math.min(1, me.v * 0.01), 0);
    const aim = new THREE.Vector3(me.x + 10, 0.8, 0);
    const k = Math.min(1, dt * 6);
    this.camPos.lerp(target, k);
    this.camAim.lerp(aim, k);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camAim);
    this.camera.fov = 56 + Math.min(16, me.v * 0.14);
    this.camera.clearViewOffset();
    if (fixed) {
      this.camera.position.set(...fixed.pos);
      this.camera.lookAt(...fixed.aim);
      this.camera.fov = fixed.fov ?? 50;
    }
    this.camera.updateProjectionMatrix();
    this.sun.position.set(me.x - 10, 40, 22);
    this.sun.target.position.set(me.x + 6, 0, 0);
    this.renderer.render(this.scene, this.camera);
  }

  /** The garage turntable (or a thumbnail): the player's car on the strip. */
  renderShowcase(t: number, angle = t * 0.35, mode: 'garage' | 'thumb' = 'garage', frame: 'portrait' | 'landscape' | 'center' = 'center'): void {
    if (!this.world) this.setEnv('e-bay');
    const rig = this.cars[0];
    if (rig) rig.group.position.set(6, 0, 0);
    const len = rig?.len ?? 4.5;
    // A narrow (portrait) view needs more distance for the whole car to fit.
    const fit = Math.max(1, 1.3 / this.camera.aspect);
    const r = (mode === 'thumb' ? 4.6 + len * 0.42 : 5.2 + len * 0.5) * (mode === 'thumb' ? 1 : fit);
    const cx = 6;
    const cz = 0;
    this.camera.position.set(cx + Math.cos(angle) * r, mode === 'thumb' ? 1.9 : 1.8, cz + Math.sin(angle) * r);
    this.camera.lookAt(cx, mode === 'thumb' ? 0.5 : 0.55, cz);
    this.camera.fov = mode === 'thumb' ? 34 : 40;
    // The menus cover part of the stage: keep the car in the free part (top in portrait, right in landscape).
    if (frame === 'portrait') this.camera.setViewOffset(this.w, this.h * 1.7, 0, this.h * 0.7, this.w, this.h);
    else if (frame === 'landscape') this.camera.setViewOffset(this.w * 1.5, this.h, 0, 0, this.w, this.h);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
    this.sun.position.set(cx - 10, 40, 22);
    this.sun.target.position.set(cx, 0, cz);
    if (this.world) for (const c of this.world.clouds) c.position.x += 0.02;
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    for (let i = 0; i < LANES; i++) this.setCar(i, null);
    if (this.world) {
      this.scene.remove(this.world.group);
      this.world.dispose();
      this.world = null;
    }
    this.pmrem.dispose();
    this.renderer.dispose();
  }
}

// ---- thumbnails: one shared offscreen stage renders cars to images
let thumbStage: Stage3D | null = null;
const thumbCache = new Map<string, string>();
export const lookKey = (look: CarLook): string => `${look.def.id}|${JSON.stringify(look.levels)}|${look.paint}|${look.livery}|${look.wheels}|${look.helmet.join()}|${look.suit}`;

/** A 3/4-front picture of a car as a data URL (cached). Returns '' when WebGL is unavailable. */
export function thumbnail(look: CarLook, env = 'e-bay'): string {
  const key = `${env}|${lookKey(look)}`;
  const hit = thumbCache.get(key);
  if (hit) return hit;
  try {
    if (!thumbStage) {
      thumbStage = new Stage3D(undefined, true);
      thumbStage.resize(320, 180, 1);
    }
    thumbStage.setEnv(env);
    thumbStage.setCar(0, look);
    thumbStage.renderShowcase(0, -0.72, 'thumb');
    const url = thumbStage.canvas.toDataURL('image/png');
    thumbCache.set(key, url);
    if (thumbCache.size > 200) thumbCache.delete(thumbCache.keys().next().value!);
    return url;
  } catch {
    return '';
  }
}
