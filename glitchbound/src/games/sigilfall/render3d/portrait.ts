import * as THREE from 'three';
import type { HeroLook } from '../render/art/hero';
import { Crowd } from './crowd';
import { dressedOf, loadWardrobe, type Held, type Wardrobe } from './dress';
import { hexRgb, kitOf } from './kits';
import { loadPack, type MeshData, type Pack } from './pack';
import { LIGHT, rigAnimOf } from './toon';

/**
 * Pictures of heroes for the menus: the same models as the game, posed and photographed once on a canvas of their
 * own. A page keeps the pictures as plain images, so a roster of them costs no more than any other images.
 */

export type DollView = 'down' | 'side' | 'up' | 'left';
const TURN: Record<DollView, number> = { down: 0.32, side: Math.PI / 2 - 0.1, up: Math.PI, left: -Math.PI / 2 + 0.1 };

let renderer: THREE.WebGLRenderer | null = null;
let failed = false;
let wardrobe: Wardrobe | null = null;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(22, 1, 0.5, 60);

let starting: Promise<unknown> | null = null;

/** Starts bringing in what a picture needs; the screen gate waits for it. */
export function warmPortraits(): Promise<unknown> {
  if (!starting) {
    starting = loadWardrobe().then((w) => {
      wardrobe = w;
      // the mounts' pictures are on the first panels anyone opens
      for (const s of ['mount-horse', 'mount-deer', 'mount-boar', 'mount-drake']) kitPack(s);
    });
    starting.catch(() => {
      starting = null;
    });
  }
  return starting;
}

function ensure(): boolean {
  if (renderer) return true;
  if (failed || typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
  } catch {
    failed = true;
    return false;
  }
  return true;
}

function shoot(look: HeroLook, held: Held | null, shield: boolean, turn: number, w: number, h: number, clip: string, t: number, framing: 'full' | 'bust'): string | null {
  if (!wardrobe || !ensure()) return null;
  const { mesh } = dressedOf(wardrobe, look, held, shield);
  const r = renderer!;
  r.setPixelRatio(1);
  r.setSize(w, h, false);
  const crowd = new Crowd(mesh, wardrobe.medium, scene, 1, 0.022);
  crowd.begin();
  crowd.put(0, 0, 0, turn, 1, 1, wardrobe.medium.frame(clip, t));
  crowd.end();
  LIGHT.uSee.value.set(0, 0, 0, 0);
  LIGHT.uDark.value.set(0, 8, 0, 0);
  LIGHT.uGrade.value.set(0, 0, 0, 0);
  camera.aspect = w / h;
  if (framing === 'bust') {
    camera.position.set(0, 2.05, 3.9);
    camera.lookAt(0, 1.72, 0);
  } else {
    camera.position.set(0, 1.7, 7.4);
    camera.lookAt(0, 1.16, 0);
  }
  camera.updateProjectionMatrix();
  r.render(scene, camera);
  const url = r.domElement.toDataURL('image/png');
  crowd.dispose();
  return url;
}

/** A hero, whole. Null until the models are in (or where there's no WebGL): the caller keeps its stand-in. */
export function dollPicture(look: HeroLook, view: DollView, size: number, held: Held | null = null, shield = false): string | null {
  return shoot(look, held, shield, TURN[view] ?? 0.32, size, Math.round(size * 1.35), 'idle', 0.3, 'full');
}

/** A hero's head and shoulders. */
export function bustPicture(look: HeroLook, size: number, held: Held | null = null): string | null {
  return shoot(look, held, false, 0.3, size, size, 'idle', 0.3, 'bust');
}

/* ------------------------------------------------------------------ creatures */

const kitPacks = new Map<string, Pack | 'loading'>();
function kitPack(sprite: string): Pack | null {
  const id = kitOf(sprite).k;
  const hit = kitPacks.get(id);
  if (hit === 'loading') return null;
  if (hit) return hit;
  kitPacks.set(id, 'loading');
  loadPack(`k/${id}`).then(
    (p) => kitPacks.set(id, p),
    () => kitPacks.delete(id),
  );
  return null;
}

function shootCreature(sprite: string, w: number, h: number, turn: number, tint: readonly [number, number, number] | null, rider: { look: HeroLook; seat: number; held: Held | null; shield: boolean } | null): string | null {
  if (!wardrobe || !ensure()) return null;
  const pack = kitPack(sprite);
  if (!pack) return null;
  const mesh: MeshData = pack.meshes.body!;
  const rig = mesh.rig === 'medium' ? wardrobe.medium : mesh.rig === 'large' ? wardrobe.large : rigAnimOf(pack, mesh.rig!);
  const kit = kitOf(sprite);
  const r = renderer!;
  r.setPixelRatio(1);
  r.setSize(w, h, false);
  const crowd = new Crowd(mesh, rig, scene, 1, 0.02);
  const tall = Math.max(0.1, mesh.max[1] - mesh.min[1]);
  const long = Math.max(mesh.max[0] - mesh.min[0], mesh.max[2] - mesh.min[2]);
  const size = Math.max(tall, long * 0.8);
  const k = 2.1 / size;
  const c = kit.tint ? hexRgb(kit.tint) : ([1, 1, 1] as const);
  crowd.begin();
  crowd.put(0, 0, 0, turn, k, k, rig.frame('idle', 0.3), 0, 0, 1, c[0] * (tint?.[0] ?? 1), c[1] * (tint?.[1] ?? 1), c[2] * (tint?.[2] ?? 1));
  crowd.end();
  let top: Crowd | null = null;
  if (rider) {
    const { mesh: body } = dressedOf(wardrobe, rider.look, rider.held, rider.shield);
    top = new Crowd(body, wardrobe.medium, scene, 1, 0.02);
    top.begin();
    top.put(0, rider.seat * k, 0, turn, 0.8, 0.8, wardrobe.medium.frame('sit', 0.3));
    top.end();
  }
  LIGHT.uSee.value.set(0, 0, 0, 0);
  LIGHT.uDark.value.set(0, 8, 0, 0);
  LIGHT.uGrade.value.set(0, 0, 0, 0);
  camera.aspect = w / h;
  camera.position.set(0, tall * k * 0.72 + (rider ? 1 : 0.6), 7.6);
  camera.lookAt(0, tall * k * 0.46 + (rider ? 0.32 : 0), 0);
  camera.updateProjectionMatrix();
  r.render(scene, camera);
  const url = r.domElement.toDataURL('image/png');
  crowd.dispose();
  top?.dispose();
  return url;
}

/** A creature standing. Null until its model is in (it is on its way). */
export function creaturePicture(sprite: string, size: number): string | null {
  return shootCreature(sprite, size, size, 0.45, null, null);
}

/** A mount, seen from the side, with its rider if there is one. */
export function mountPicture(sprite: string, coat: readonly [number, number, number], seat: number, size: number, rider: { look: HeroLook; held: Held | null; shield: boolean } | null): string | null {
  return shootCreature(sprite, size, Math.round(size * 0.85), Math.PI / 2 - 0.35, coat, rider ? { ...rider, seat } : null);
}
