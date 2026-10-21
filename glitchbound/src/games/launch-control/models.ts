/**
 * Real car models from two CC0 low-poly packs (credits in CREDITS.md in this folder): RG Poly's
 * city cars for the street, club and pro tiers (each car one of the pack's bodies in one of its
 * factory paint schemes, sharing one palette atlas of colour gradients and one window texture),
 * and Cosmo's sports cars, supercars and hypercars up top (sharing one flat palette). Loading
 * turns a file into a ready body: nose toward +x, wheels on the ground at y 0 and centred on their
 * own axles, the factory rear wing (when there is one) as its own part so the aero kit can replace
 * it, and the triangles that carry the paint split out with how bright the palette is under them,
 * so any colour can replace the factory one.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { CarDef } from './cars';

/** Every car's body: pack folder and file. RG cars keep their factory scheme; Cosmo cars are painted their `color`. */
export const MODEL_FILE: Record<string, string> = {
  // street
  bumble: 'rg/Car_17_A',
  'pico-pop': 'rg/Car_4_1_C',
  'pico-dot': 'rg/Car_4_1_A',
  griffon: 'rg/Car_8_A',
  kestrel: 'rg/Car_7_R',
  astro: 'rg/Car_5_I',
  rustler: 'rg/Car_12_B',
  longroof: 'rg/Car_3_2_G',
  'dune-bug': 'rg/Car_17_I',
  cabbie: 'rg/Taxi_3',
  // club
  'vossberg-gti': 'rg/Car_6_B',
  lazzaro: 'rg/Car_17_G',
  tsubasa: 'rg/Car_9_B',
  stallion: 'rg/Car_11_A',
  'kurogane-gt': 'rg/Car_6_F',
  kaiser: 'rg/Car_5_S',
  'bayou-boss': 'rg/Car_12_T',
  interceptor: 'rg/Car_Police_1_A_1',
  // pro
  'rotary-rebel': 'rg/Car_9_L',
  brickhouse: 'rg/Car_4_1_P',
  'comet-ss': 'rg/Car_11_B',
  gullwing: 'rg/Car_7_A',
  panther: 'rg/Car_11_K',
  sakura: 'rg/Car_6_G',
  marlin: 'rg/Car_9_S',
  'night-patrol': 'rg/Car_Police_4_B_1',
  // elite: the sportiest city bodies, a fifties cruiser and a sports sedan
  ironhide: 'rg/Car_10_A',
  falkon: 'rg/Car_2_F',
  vortex: 'rg/Car_1_D',
  sterling: 'rg/Car_18_N',
  widowmaker: 'rg/Car_6_V',
  ragazzo: 'rg/Car_2_B',
  monarch: 'cosmo/mobil',
  longbow: 'rg/Car_10_V',
  'blue-thunder': 'rg/Car_2_E',
  // legend: supercars and muscle
  toro: 'cosmo/lamb',
  'stallone-812': 'cosmo/italia',
  peregrine: 'cosmo/ghini',
  wraith: 'rg/Car_9_W',
  hellion: 'cosmo/kamaro',
  elektra: 'cosmo/coupe',
  valkyr: 'cosmo/fenyr',
  redline: 'rg/Car_18_F',
  // kings: the wildest, the hypercar last
  'royal-flush': 'rg/Car_18_ZZ',
  goldrush: 'cosmo/kamaro',
  nova: 'cosmo/coupe',
  zephyr: 'cosmo/italia',
  veyr: 'cosmo/ghini',
  'nitro-funny': 'cosmo/lamb',
  rail: 'cosmo/fenyr',
};

export const fileFor = (def: CarDef): string => MODEL_FILE[def.id] ?? 'rg/Car_17_A';

const DIR = '/games/launch-control/';
export const MODEL_URL = (file: string): string => `${DIR}${file}.gltf`;

export type Pack = 'rg' | 'cosmo';

/** What differs between the packs. */
interface PackDef {
  /** The shared palette, and the window texture when the glass has its own. */
  atlas: string;
  glass?: string;
  /** Turn about y that puts the nose on +x. */
  turn: number;
  /** RG models small (every body grows by the same factor, so a pickup stays bigger than a city car); Cosmo models at real size. */
  scale: number;
  roles: Record<string, Role>;
  /** How the palette is laid out: RG's grid of gradients, or Cosmo's flat swatches (told apart by colour). */
  cells: 'grid' | 'colour';
  /** RG wheels have a tiny hub, so bought rims are painted over the sidewall; Cosmo wheels have real rims, which take the colour. */
  rimFace: boolean;
}

export const PACKS: Record<Pack, PackDef> = {
  rg: { atlas: 'rg/atlas.webp', glass: 'rg/windows.webp', turn: Math.PI, scale: 1.22, roles: { 'City Car': 'body', 'City Metal': 'metal', 'City Atlas': 'trim', Windows: 'glass' }, cells: 'grid', rimFace: true },
  cosmo: { atlas: 'cosmo/palette.png', turn: Math.PI / 2, scale: 1, roles: { metallic: 'body', texture: 'trim', glass: 'glass', light: 'lamp' }, cells: 'colour', rimFace: false },
};

export const packOf = (file: string): Pack => (file.startsWith('cosmo/') ? 'cosmo' : 'rg');

/** What a piece of the model is made of (the pack's materials, plus the paint split out of them). */
export type Role = 'paint' | 'body' | 'metal' | 'trim' | 'glass' | 'lamp';

export interface ModelPart {
  geo: THREE.BufferGeometry;
  role: Role;
}

export interface ModelWheel {
  /** Axle centre, model space (y is the radius: the wheels stand on y 0). */
  pos: THREE.Vector3;
  r: number;
  /** Half the tyre's width, and the hub's radius (where the sidewall starts). */
  halfW: number;
  hubR: number;
  tyre: THREE.BufferGeometry[];
  hub: ModelPart[];
}

export interface LoadedModel {
  file: string;
  pack: Pack;
  /** Metres per model unit. */
  scale: number;
  tex: Atlas;
  body: ModelPart[];
  /** The factory rear wing (empty when it has none). */
  wing: ModelPart[];
  wheels: ModelWheel[];
  /** Body bounds, model space. */
  box: THREE.Box3;
  /** Linear brightness of the atlas where the paint is sampled, and the factory colour there. */
  paintRef: number;
  factory: string;
}

// ---------------------------------------------------------------- the shared textures
/** RG's atlas: five rows of 36 vertical gradients, then a row of six big swatches. */
const COLS = 36;
const ROWS = 6;
const SWATCHES = 6;

export interface Atlas {
  atlas: THREE.Texture;
  /** The atlas in grey: the paint's shading, to multiply with a new colour. */
  luma: THREE.Texture;
  glass: THREE.Texture;
  px: Uint8ClampedArray;
  w: number;
  h: number;
}

const sharedP = new Map<Pack, Promise<Atlas | null>>();

const image = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });

function tex(src: TexImageSource | OffscreenCanvas | HTMLCanvasElement | HTMLImageElement): THREE.Texture {
  const t = src instanceof HTMLCanvasElement ? new THREE.CanvasTexture(src) : new THREE.Texture(src as HTMLImageElement);
  t.flipY = false;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

function loadShared(pack: Pack): Promise<Atlas | null> {
  const def = PACKS[pack];
  let p = sharedP.get(pack);
  if (!p) {
    p = Promise.all([image(`${DIR}${def.atlas}`), def.glass ? image(`${DIR}${def.glass}`) : null])
      .then(([a, g]) => {
        const cv = document.createElement('canvas');
        cv.width = a.width;
        cv.height = a.height;
        const ctx = cv.getContext('2d', { willReadFrequently: true });
        if (!ctx) return null;
        ctx.drawImage(a, 0, 0);
        const data = ctx.getImageData(0, 0, a.width, a.height);
        const px = new Uint8ClampedArray(data.data);
        const d = data.data;
        for (let i = 0; i < d.length; i += 4) {
          const l = 0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!;
          d[i] = d[i + 1] = d[i + 2] = l;
        }
        ctx.putImageData(data, 0, 0);
        const atlas = tex(a);
        return { atlas, luma: tex(cv), glass: g ? tex(g) : atlas, px, w: a.width, h: a.height };
      })
      .catch(() => null);
    sharedP.set(pack, p);
  }
  return p;
}

const srgbToLinear = (c: number): number => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

// ---------------------------------------------------------------- loading
const WHEEL = /^(RL|FL|RR|FR)$/;

/** A copy of `g` that keeps only the listed triangles (it shares the vertex data). */
function subset(g: THREE.BufferGeometry, tris: number[]): THREE.BufferGeometry {
  const out = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(g.attributes)) out.setAttribute(name, attr);
  const idx = g.index!;
  const ix = new (idx.count > 65535 ? Uint32Array : Uint16Array)(tris.length * 3);
  tris.forEach((t, i) => {
    ix[i * 3] = idx.getX(t * 3);
    ix[i * 3 + 1] = idx.getX(t * 3 + 1);
    ix[i * 3 + 2] = idx.getX(t * 3 + 2);
  });
  out.setIndex(new THREE.BufferAttribute(ix, 1));
  out.computeBoundingBox();
  out.computeBoundingSphere();
  return out;
}

function build(file: string, scene: THREE.Group, at: Atlas): LoadedModel {
  const pack = packOf(file);
  const def = PACKS[pack];
  scene.updateMatrixWorld(true);
  const flip = new THREE.Matrix4().makeRotationY(def.turn);
  const raw: { node: string; role: Role; geo: THREE.BufferGeometry }[] = [];
  scene.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const node = WHEEL.test(o.parent?.name ?? '') || o.parent?.name === 'Wing' ? o.parent!.name : /^(RL|FL|RR|FR|Wing)$/.test(o.name) ? o.name : 'body';
    const geo = (o.geometry as THREE.BufferGeometry).clone();
    geo.applyMatrix4(o.matrixWorld);
    geo.applyMatrix4(flip);
    if (!geo.index) geo.setIndex([...Array(geo.attributes.position!.count).keys()]);
    raw.push({ node, role: def.roles[(o.material as THREE.Material).name] ?? 'trim', geo });
  });

  // wheels: the lowest point of the tyres is the ground
  const wheelBox = new THREE.Box3();
  for (const r of raw) if (WHEEL.test(r.node)) wheelBox.union((r.geo.computeBoundingBox(), r.geo.boundingBox!));
  const ground = wheelBox.isEmpty() ? 0 : wheelBox.min.y;
  for (const r of raw) r.geo.translate(0, -ground, 0);

  const wheels: ModelWheel[] = [];
  for (const name of ['FL', 'FR', 'RL', 'RR']) {
    const parts = raw.filter((r) => r.node === name);
    if (!parts.length) continue;
    const b = new THREE.Box3();
    for (const p of parts) b.union((p.geo.computeBoundingBox(), p.geo.boundingBox!));
    const c = b.getCenter(new THREE.Vector3());
    const r = (b.max.y - b.min.y) / 2;
    // the tyre is the taller piece; the rest is the hub
    const tall = (g: THREE.BufferGeometry): number => g.boundingBox!.max.y - g.boundingBox!.min.y;
    const top = Math.max(...parts.map((p) => tall(p.geo)));
    const tyre: THREE.BufferGeometry[] = [];
    const hub: ModelPart[] = [];
    let hubR = 0;
    for (const p of parts) {
      p.geo.translate(-c.x, -c.y, -c.z);
      if (tall(p.geo) > top * 0.97) tyre.push(p.geo);
      else {
        hub.push({ geo: p.geo, role: p.role });
        hubR = Math.max(hubR, tall(p.geo) / 2);
      }
    }
    wheels.push({ pos: new THREE.Vector3(c.x, r, c.z), r, halfW: (b.max.z - b.min.z) / 2, hubR: hubR || r * 0.5, tyre, hub });
  }

  // the paint: the palette cell the outside of the body shows most, found by looking at it from
  // both sides and from above (the floor and the seats would win a count by area)
  const bodyRaw = raw.filter((r) => r.node === 'body');
  const cellOf = (u: number, v: number): number => {
    if (def.cells === 'colour') {
      // a flat swatch: its colour, a little coarsened
      const k = (Math.min(at.h - 1, Math.max(0, Math.floor(v * at.h))) * at.w + Math.min(at.w - 1, Math.max(0, Math.floor(u * at.w)))) * 4;
      return ((at.px[k]! >> 3) << 10) | ((at.px[k + 1]! >> 3) << 5) | (at.px[k + 2]! >> 3);
    }
    const row = Math.min(ROWS - 1, Math.max(0, Math.floor(v * ROWS)));
    const n = row === ROWS - 1 ? SWATCHES : COLS;
    return row * COLS + Math.min(n - 1, Math.max(0, Math.floor(u * n)));
  };
  const triUv = (g: THREE.BufferGeometry, t: number): { cell: number; u: number; v: number } => {
    const idx = g.index!;
    const uv = g.attributes.uv;
    if (!uv) return { cell: -1, u: 0, v: 0 };
    const i0 = idx.getX(t * 3);
    const i1 = idx.getX(t * 3 + 1);
    const i2 = idx.getX(t * 3 + 2);
    const u = (uv.getX(i0) + uv.getX(i1) + uv.getX(i2)) / 3;
    const v = (uv.getY(i0) + uv.getY(i1) + uv.getY(i2)) / 3;
    return { cell: cellOf(u, v), u, v };
  };
  const probes = bodyRaw.map((r) => Object.assign(new THREE.Mesh(r.geo), { userData: { role: r.role } }));
  const bb = new THREE.Box3();
  for (const r of bodyRaw) bb.union((r.geo.computeBoundingBox(), r.geo.boundingBox!));
  const seen = new Map<number, { n: number; u: number; v: number }>();
  const probe = new THREE.Raycaster();
  const look = (from: THREE.Vector3, dir: THREE.Vector3): void => {
    probe.set(from, dir);
    const hit = probe.intersectObjects(probes, false)[0];
    if (!hit || hit.object.userData.role !== 'body' || hit.faceIndex == null) return;
    const { cell, u, v } = triUv((hit.object as THREE.Mesh).geometry, hit.faceIndex);
    if (cell < 0) return;
    const e = seen.get(cell) ?? { n: 0, u: 0, v: 0 };
    e.n++;
    e.u += u;
    e.v += v;
    seen.set(cell, e);
  };
  const size = bb.getSize(new THREE.Vector3());
  for (let i = 0; i < 18; i++) {
    const x = bb.min.x + ((i + 0.5) / 18) * size.x;
    for (let j = 0; j < 7; j++) {
      const y = bb.min.y + (0.15 + (j / 6) * 0.7) * size.y;
      look(new THREE.Vector3(x, y, bb.max.z + 1), new THREE.Vector3(0, 0, -1));
      look(new THREE.Vector3(x, y, bb.min.z - 1), new THREE.Vector3(0, 0, 1));
    }
    for (let k = 0; k < 5; k++) look(new THREE.Vector3(x, bb.max.y + 1, bb.min.z + ((k + 0.5) / 5) * size.z), new THREE.Vector3(0, -1, 0));
  }
  let paintCell = -1;
  let most = 0;
  for (const [cell, e] of seen) if (e.n > most) [paintCell, most] = [cell, e.n];
  const ref = paintCell >= 0 ? seen.get(paintCell)! : null;

  // the triangles in the paint's cell become their own parts, on the body and on the factory wing
  const split = (list: typeof raw): ModelPart[] => {
    const out: ModelPart[] = [];
    for (const r of list) {
      if (r.role === 'glass' || r.role === 'trim' || r.role === 'lamp' || paintCell < 0) {
        out.push({ geo: r.geo, role: r.role });
        continue;
      }
      const paint: number[] = [];
      const rest: number[] = [];
      for (let t = 0; t < r.geo.index!.count / 3; t++) (triUv(r.geo, t).cell === paintCell ? paint : rest).push(t);
      if (paint.length) out.push({ geo: subset(r.geo, paint), role: 'paint' });
      if (rest.length) out.push({ geo: rest.length === r.geo.index!.count / 3 ? r.geo : subset(r.geo, rest), role: r.role });
    }
    return out;
  };
  const body = split(bodyRaw);
  const wing = split(raw.filter((r) => r.node === 'Wing'));

  // the paint's reference spot: where on the atlas the outside of the body is sampled, on average
  let paintRef = 0.5;
  let factory = '#888888';
  if (ref) {
    const x = Math.min(at.w - 1, Math.floor((ref.u / ref.n) * at.w));
    const y = Math.min(at.h - 1, Math.floor((ref.v / ref.n) * at.h));
    const k = (y * at.w + x) * 4;
    const [r, g, bl] = [at.px[k]!, at.px[k + 1]!, at.px[k + 2]!];
    paintRef = Math.max(0.02, srgbToLinear((0.299 * r + 0.587 * g + 0.114 * bl) / 255));
    factory = `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
  }

  const box = new THREE.Box3();
  for (const p of body) box.union((p.geo.computeBoundingBox(), p.geo.boundingBox!));
  return { file, pack, scale: def.scale, tex: at, body, wing, wheels, box, paintRef, factory };
}

const loaded = new Map<string, LoadedModel | null>();
const pending = new Map<string, Promise<LoadedModel | null>>();

export const getModel = (file: string): LoadedModel | null | undefined => loaded.get(file);

/** Loads a car file (once). Resolves null when it can't be loaded (offline, tests): callers fall back. */
export function loadModel(file: string): Promise<LoadedModel | null> {
  const hit = loaded.get(file);
  if (hit !== undefined) return Promise.resolve(hit);
  let p = pending.get(file);
  if (!p) {
    p = loadShared(packOf(file)).then(
      (at) =>
        new Promise<LoadedModel | null>((resolve) => {
          const fail = (): void => {
            loaded.set(file, null);
            resolve(null);
          };
          if (!at) return fail();
          try {
            new GLTFLoader().load(
              MODEL_URL(file),
              (g) => {
                const m = build(file, g.scene, at);
                loaded.set(file, m);
                resolve(m);
              },
              undefined,
              fail,
            );
          } catch {
            fail();
          }
        }),
    );
    pending.set(file, p);
  }
  return p;
}

/** Loads the bodies a set of cars needs (never rejects). */
export async function preloadCars(defs: CarDef[]): Promise<void> {
  await Promise.all([...new Set(defs.map(fileFor))].map(loadModel));
}
