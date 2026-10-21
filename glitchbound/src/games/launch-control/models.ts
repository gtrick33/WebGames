/**
 * Real car models (CC0, see CREDITS.md in this folder): rgsdev's Free Low Poly Vehicles Pack and
 * two race cars from Kenney's Car Kit, converted to GLB with their parts named by role (paint,
 * trim, chrome, accent, glass, lamp, tail, tire, rim; wheels as their own nodes). Each car in the
 * roster picks a base body plus its own size and shape tweaks, so cars that share a body still
 * look like different cars. Loaded on demand from /games/launch-control/models/.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { CarDef } from './cars';

export type BaseModel = 'sports' | 'roadster' | 'muscle' | 'muscle2' | 'sedan' | 'hatch' | 'pickup' | 'suv' | 'van' | 'limo' | 'coupe' | 'coupe2' | 'suv2' | 'monster' | 'rail' | 'funny';

/** Shape tweaks applied to a base body. */
export type Warp = 'none' | 'chop' | 'super' | 'hyper' | 'gt' | 'boxy' | 'tall';

export interface ModelSpec {
  base: BaseModel;
  /** Target length, metres. */
  len: number;
  /** Width and height relative to a uniform scale to that length. */
  w?: number;
  h?: number;
  warp?: Warp;
  /** Wheel size relative to the model's own (all four; front and rear multiply on top). */
  wheel?: number;
  front?: number;
  rear?: number;
}

/** Every car's body. Shared bodies get different proportions, tweaks, kits and paint. */
export const MODEL_SPECS: Record<string, ModelSpec> = {
  // street
  bumble: { base: 'hatch', len: 3.75, h: 1.02, w: 0.97, warp: 'tall' },
  'pico-pop': { base: 'hatch', len: 3.85, w: 0.96 },
  'pico-dot': { base: 'hatch', len: 3.7, h: 1.08, warp: 'boxy' },
  griffon: { base: 'hatch', len: 3.9, h: 0.94, warp: 'chop' },
  kestrel: { base: 'coupe2', len: 4.3, h: 0.95 },
  astro: { base: 'hatch', len: 4.25 },
  rustler: { base: 'pickup', len: 5.1, warp: 'boxy' },
  longroof: { base: 'suv', len: 4.75, h: 0.86, warp: 'boxy' },
  'dune-bug': { base: 'roadster', len: 3.6, h: 1.05, wheel: 1.12 },
  // club
  'vossberg-gti': { base: 'hatch', len: 4.2, h: 0.96, warp: 'chop' },
  lazzaro: { base: 'roadster', len: 4.0 },
  tsubasa: { base: 'sedan', len: 4.45, h: 0.95 },
  stallion: { base: 'muscle', len: 4.75 },
  'kurogane-gt': { base: 'coupe2', len: 4.5, warp: 'gt' },
  kaiser: { base: 'sedan', len: 4.35, warp: 'boxy' },
  'bayou-boss': { base: 'monster', len: 5.3, w: 0.62, h: 0.62 },
  // pro
  'rotary-rebel': { base: 'coupe', len: 4.3, warp: 'chop' },
  brickhouse: { base: 'suv2', len: 4.8, h: 0.88 },
  'comet-ss': { base: 'muscle2', len: 4.8 },
  gullwing: { base: 'roadster', len: 4.5, h: 0.98, warp: 'gt' },
  panther: { base: 'muscle', len: 4.8, warp: 'gt' },
  sakura: { base: 'hatch', len: 4.5, h: 0.94, warp: 'chop' },
  marlin: { base: 'sports', len: 4.2 },
  // elite
  ironhide: { base: 'coupe', len: 4.4 },
  falkon: { base: 'coupe', len: 4.5, h: 0.98, warp: 'gt' },
  vortex: { base: 'coupe2', len: 4.7, w: 1.04 },
  sterling: { base: 'coupe', len: 4.55, warp: 'gt' },
  widowmaker: { base: 'muscle2', len: 4.5, warp: 'super' },
  ragazzo: { base: 'coupe', len: 4.55, warp: 'super' },
  monarch: { base: 'limo', len: 5.5, h: 1.04 },
  longbow: { base: 'suv2', len: 4.95, h: 0.82, warp: 'chop' },
  // legend
  toro: { base: 'coupe', len: 4.8, w: 1.06, warp: 'super' },
  'stallone-812': { base: 'coupe2', len: 4.7, warp: 'gt' },
  peregrine: { base: 'sports', len: 4.55, warp: 'super' },
  wraith: { base: 'coupe', len: 4.57, warp: 'chop' },
  hellion: { base: 'muscle2', len: 5.0, w: 1.05 },
  elektra: { base: 'sedan', len: 4.98, warp: 'chop' },
  valkyr: { base: 'coupe', len: 4.7, w: 1.06, warp: 'hyper' },
  // kings
  veyr: { base: 'coupe2', len: 4.55, w: 1.08, warp: 'super' },
  zephyr: { base: 'sports', len: 4.6, w: 1.05, warp: 'hyper' },
  nova: { base: 'coupe2', len: 4.75, w: 1.05, warp: 'hyper' },
  'nitro-funny': { base: 'funny', len: 5.6, w: 0.8, h: 0.62, rear: 1.2 },
  rail: { base: 'rail', len: 7.4, w: 0.62, h: 0.5, front: 0.62, rear: 1.35 },
};

export const specFor = (def: CarDef): ModelSpec => MODEL_SPECS[def.id] ?? { base: 'sedan', len: def.shape.len };

export const MODEL_URL = (base: BaseModel): string => `/games/launch-control/models/${base}.glb`;

export interface LoadedModel {
  scene: THREE.Group;
  /** Model-space bounds (metres, nose toward +x, ground at y 0). */
  box: THREE.Box3;
  /** The body part with paint (null for the Kenney race cars, which keep their texture). */
  hasPaint: boolean;
}

/** The three ex-police bodies keep their light bar's mount on the roof: flatten it to the roof line. */
const ROOF_CLAMP: Partial<Record<BaseModel, number>> = { coupe: 1.845, coupe2: 1.87, suv2: 2.1 };

function clampRoof(g: THREE.BufferGeometry, top: number): void {
  const p = g.attributes.position!;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > top) p.setY(i, top);
  p.needsUpdate = true;
  g.computeBoundingBox();
  g.computeBoundingSphere();
}

const loaded = new Map<BaseModel, LoadedModel | null>();
const pending = new Map<BaseModel, Promise<LoadedModel | null>>();

export const getModel = (base: BaseModel): LoadedModel | null | undefined => loaded.get(base);

/** Loads a base body (once). Resolves null when it can't be loaded (offline, tests): callers fall back. */
export function loadModel(base: BaseModel): Promise<LoadedModel | null> {
  const hit = loaded.get(base);
  if (hit !== undefined) return Promise.resolve(hit);
  let p = pending.get(base);
  if (!p) {
    p = new Promise<LoadedModel | null>((resolve) => {
      try {
        new GLTFLoader().load(
          MODEL_URL(base),
          (g) => {
            const scene = g.scene;
            let hasPaint = false;
            const cut = ROOF_CLAMP[base];
            scene.traverse((o) => {
              if (!(o instanceof THREE.Mesh)) return;
              const role = (o.material as THREE.Material).name;
              if (role === 'paint') hasPaint = true;
              if (cut && role === 'paint') clampRoof(o.geometry, cut);
            });
            const m = { scene, box: new THREE.Box3().setFromObject(scene), hasPaint };
            loaded.set(base, m);
            resolve(m);
          },
          undefined,
          () => {
            loaded.set(base, null);
            resolve(null);
          },
        );
      } catch {
        loaded.set(base, null);
        resolve(null);
      }
    });
    pending.set(base, p);
  }
  return p;
}

/** Loads the bodies a set of cars needs (never rejects). */
export async function preloadCars(defs: CarDef[]): Promise<void> {
  await Promise.all([...new Set(defs.map((d) => specFor(d).base))].map(loadModel));
}

const warpCache = new Map<string, THREE.BufferGeometry>();

/**
 * A shape tweak on a point of a body (model space). `chop` lowers the roof, `super` lowers it
 * more and widens the hips, `hyper` goes further and stretches the nose, `gt` lengthens the hood,
 * `boxy` squares the roof up, `tall` raises it.
 */
export function warpPoint(x: number, y: number, z: number, warp: Warp, box: THREE.Box3): [number, number, number] {
  if (warp === 'none') return [x, y, z];
  const belt = box.max.y * 0.56;
  const roof = warp === 'chop' ? 0.8 : warp === 'super' ? 0.7 : warp === 'hyper' ? 0.6 : warp === 'boxy' ? 1.06 : warp === 'tall' ? 1.12 : 1;
  const hips = warp === 'super' ? 1.07 : warp === 'hyper' ? 1.1 : 1;
  const noseStretch = warp === 'gt' ? 0.14 : warp === 'hyper' ? 0.08 : 0;
  if (y > belt) y = belt + (y - belt) * roof;
  const u = (x - box.min.x) / (box.max.x - box.min.x);
  if (hips !== 1 && y < belt) z *= 1 + (hips - 1) * Math.max(0, 1 - Math.abs(u - 0.3) * 2.2);
  if (noseStretch && x > 0) x *= 1 + noseStretch;
  return [x, y, z];
}

/** A body part's geometry with its car's shape tweak (cached; wheels are never warped). */
export function warpGeometry(g: THREE.BufferGeometry, key: string, warp: Warp, box: THREE.Box3): THREE.BufferGeometry {
  if (warp === 'none') return g;
  const ck = `${key}|${warp}`;
  const hit = warpCache.get(ck);
  if (hit) return hit;
  const out = g.clone();
  const p = out.attributes.position!;
  for (let i = 0; i < p.count; i++) {
    const [x, y, z] = warpPoint(p.getX(i), p.getY(i), p.getZ(i), warp, box);
    p.setXYZ(i, x, y, z);
  }
  out.computeVertexNormals();
  out.computeBoundingBox();
  warpCache.set(ck, out);
  return out;
}
