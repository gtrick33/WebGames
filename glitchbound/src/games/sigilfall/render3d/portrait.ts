import * as THREE from 'three';
import type { MountDef } from '../data/mounts';
import type { HeroLook } from '../render/art/hero';
import { heroLook, npcLookOf } from '../render/sprites';
import { Crowd } from './crowd';
import { carriedModel, dressedOf, loadWardrobe, type Held, type Wardrobe } from './dress';
import { hexRgb, kitOf } from './kits';
import { mountModel } from './mountKit';
import { shapeOf } from './mountLook';
import { loadPack, toGeometry, type MeshData, type Pack } from './pack';
import { busyElsewhere } from './pace';
import { copyLight, daylight, putLight, rigAnimOf, staticMaterial, type RigAnim } from './toon';
import type { Item, ItemIcon, Material, Rarity, SlotId } from '../data/types';
import { itemIcon, itemMat, itemTint } from '../progress/items';

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

/**
 * The picture, taken in the same light every time, or null when it couldn't be (the caller keeps its stand-in, and asks
 * again later). The lights are the game's own, shared by every model: a picture taken after a dark room, a night or
 * a fire came out as dark as the place the game was last drawn in; and a canvas whose drawing context the browser has
 * taken back (it keeps only so many, and the Vigil and the Ring each open one of their own) draws nothing at all, an
 * empty picture that was kept for the rest of the visit: the Vigil's hero was missing from their stand (the owner:
 * "in the vigil, the character is missing completely"). The lights are put back as they were afterwards.
 */
function photograph(w: number, h: number, cam: THREE.Camera = camera): string | null {
  const r = renderer!;
  const gl = r.getContext();
  if (gl.isContextLost()) {
    dropRenderer();
    return null;
  }
  const was = copyLight();
  daylight();
  try {
    r.render(scene, cam);
    // (anything drawn at all: a column down the middle and a row across it, where every subject stands)
    const down = new Uint8Array(4 * h);
    const across = new Uint8Array(4 * w);
    gl.readPixels(Math.floor(w / 2), 0, 1, h, gl.RGBA, gl.UNSIGNED_BYTE, down);
    gl.readPixels(0, Math.floor(h * 0.55), w, 1, gl.RGBA, gl.UNSIGNED_BYTE, across);
    const drawn = down.some((v, i) => i % 4 === 3 && v > 0) || across.some((v, i) => i % 4 === 3 && v > 0);
    if (!drawn || gl.isContextLost()) {
      if (gl.isContextLost()) dropRenderer();
      return null;
    }
    return r.domElement.toDataURL('image/png');
  } finally {
    putLight(was);
    // (the game waited on this picture: not the world's slowness, render3d/pace.ts)
    busyElsewhere();
  }
}

/** A renderer whose context is gone: let go of it, so the next picture makes a new one. */
function dropRenderer(): void {
  try {
    renderer?.dispose();
  } catch {
    /* (already gone) */
  }
  renderer = null;
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
  camera.aspect = w / h;
  if (framing === 'bust') {
    camera.position.set(0, 2.05, 3.9);
    camera.lookAt(0, 1.72, 0);
  } else {
    camera.position.set(0, 1.7, 7.4);
    camera.lookAt(0, 1.16, 0);
  }
  camera.updateProjectionMatrix();
  const url = photograph(w, h);
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
  camera.aspect = w / h;
  camera.position.set(0, tall * k * 0.72 + (rider ? 1 : 0.6), 7.6);
  camera.lookAt(0, tall * k * 0.46 + (rider ? 0.32 : 0), 0);
  camera.updateProjectionMatrix();
  const url = photograph(w, h);
  crowd.dispose();
  top?.dispose();
  return url;
}

/** A creature standing. Null until its model is in (it is on its way). */
export function creaturePicture(sprite: string, size: number): string | null {
  // (someone dressed from the wardrobe is pictured so, with what they hold, not as the set's figure underneath)
  const kit = kitOf(sprite);
  const look = kit.look ? npcLookOf(kit.look) : null;
  if (look) return shoot(look, (kit.held as Held | undefined) ?? null, !!kit.shield, 0.45, size, size, 'idle', 0.3, 'full');
  return shootCreature(sprite, size, size, 0.45, null, null);
}

const kitFiles = new Map<string, Pack | 'loading'>();
function kitFile(id: string): Pack | null {
  const hit = kitFiles.get(id);
  if (hit === 'loading') return null;
  if (hit) return hit;
  kitFiles.set(id, 'loading');
  loadPack(`k/${id}`).then(
    (p) => kitFiles.set(id, p),
    () => kitFiles.delete(id),
  );
  return null;
}

const standing = { x: 0, y: 0, z: 0 };

/** A mount, seen from the side and a little ahead, with its rider if there is one. */
export function mountPicture(def: MountDef, size: number, rider: { look: HeroLook; held: Held | null; shield: boolean } | null): string | null {
  if (!wardrobe || !ensure()) return null;
  const pack = kitFile(shapeOf(def).kit);
  if (!pack) return null;
  const { mesh, rig, shape, joint } = mountModel(def, pack);
  const w = size;
  const h = Math.round(size * 0.85);
  const r = renderer!;
  r.setPixelRatio(1);
  r.setSize(w, h, false);
  const turn = Math.PI / 2 - 0.42;
  const long = Math.max(mesh.max[2] - mesh.min[2], mesh.max[1] - mesh.min[1]);
  const k = (def.body === 'drake' ? 3.4 : 3.1) / long;
  const midZ = (mesh.min[2] + mesh.max[2]) / 2;
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  const crowd = new Crowd(mesh, rig, scene, 1, 0.012 / k);
  crowd.begin();
  // (a drake is shown with its wings up)
  const idle = def.body === 'drake' ? rig.frame('run', 0.2) : rig.frame('idle', 0.3);
  crowd.put(-midZ * k * sin, 0, -midZ * k * cos, turn, k, k, idle);
  crowd.end();
  let top: Crowd | null = null;
  if (rider) {
    const { mesh: body } = dressedOf(wardrobe, rider.look, rider.held, rider.shield);
    top = new Crowd(body, wardrobe.medium, scene, 1, 0.02);
    rig.pointAt(idle, 0, 0, joint, 0, shape.seatY, shape.seatZ, standing);
    // (a person's as big to the animal as they are in the world)
    const scale = (k / shape.px) * ((36 * shape.rider) / Math.min(2.6, body.max[1] - body.min[1] || 2.3));
    const dz = (standing.z - midZ) * k;
    top.begin();
    top.put(dz * sin, standing.y * k - 0.406 * scale, dz * cos, turn, scale, scale, wardrobe.medium.frame('ride', 0.3));
    top.end();
  }
  camera.aspect = w / h;
  const tall = (mesh.max[1] - mesh.min[1]) * k;
  camera.position.set(0, tall * 0.72 + (rider ? 1 : 0.6), 7.6);
  camera.lookAt(0, tall * 0.46 + (rider ? 0.32 : 0), 0);
  camera.updateProjectionMatrix();
  const url = photograph(w, h);
  crowd.dispose();
  top?.dispose();
  return url;
}

/* ------------------------------------------------------------------ the shop's pictures */

const posed = { x: 0, y: 0, z: 0 };

/**
 * A model posed on a frame of a clip and turned, photographed whole: the camera finds the box it fills (or the part of
 * it above `fromY`, for a head and shoulders) and frames that, with a margin.
 */
function framed(mesh: MeshData, rig: RigAnim, frame: number, turn: number, w: number, h: number, ink: number, fromY = -Infinity, spin = false): string | null {
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (let v = 0; v < mesh.n; v++) {
    rig.pointAt(frame, frame, 0, mesh.skin?.[v * 3] ?? 0, mesh.pos[v * 3]!, mesh.pos[v * 3 + 1]!, mesh.pos[v * 3 + 2]!, posed);
    if (posed.y < fromY) continue;
    // (turning on a stand: framed for the widest it gets, so it holds still in the picture as it turns)
    const x = spin ? Math.hypot(posed.x, posed.z) : posed.x * cos + posed.z * sin;
    x0 = Math.min(x0, spin ? -x : x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, posed.y);
    y1 = Math.max(y1, posed.y);
  }
  if (!(x1 > x0) || !(y1 > y0)) return null;
  const r = renderer!;
  r.setPixelRatio(1);
  r.setSize(w, h, false);
  // (a few units across, whatever its own units are)
  const k = 3 / Math.max(x1 - x0, y1 - y0);
  const crowd = new Crowd(mesh, rig, scene, 1, ink / k);
  crowd.begin();
  crowd.put(0, 0, 0, turn, k, k, frame);
  crowd.end();
  camera.aspect = w / h;
  const half = Math.tan((camera.fov * Math.PI) / 360);
  const cx = ((x0 + x1) / 2) * k;
  const cy = ((y0 + y1) / 2) * k;
  const dist = Math.max(((y1 - y0) * k * 0.54) / half, ((x1 - x0) * k * 0.54) / (half * camera.aspect)) + 0.6;
  camera.position.set(cx, cy + dist * 0.1, dist);
  camera.lookAt(cx, cy, 0);
  camera.updateProjectionMatrix();
  const url = photograph(w, h);
  crowd.dispose();
  return url;
}

/** A mount for the shop: all of it, a drake with its wings up, seen from the side and a little ahead. Null until its model is in. */
export function shopMountPicture(def: MountDef, w: number, h: number, turn?: number): string | null {
  if (!wardrobe || !ensure()) return null;
  const pack = kitFile(shapeOf(def).kit);
  if (!pack) return null;
  const { mesh, rig } = mountModel(def, pack);
  const frame = def.body === 'drake' ? rig.frame('run', 0.2) : rig.frame('idle', 0.3);
  return framed(mesh, rig, frame, turn ?? Math.PI / 2 - 0.62, w, h, 0.012, -Infinity, turn !== undefined);
}

/** A look for the shop on a hero: a helmet as head and shoulders, a chest piece the whole figure. */
export function shopLookPicture(look: HeroLook, bust: boolean, w: number, h: number, turn?: number): string | null {
  if (!wardrobe || !ensure()) return null;
  const { mesh } = dressedOf(wardrobe, look, null, false);
  return framed(mesh, wardrobe.medium, wardrobe.medium.frame('idle', 0.3), turn ?? (bust ? 0.42 : 0.62), w, h, 0.022, bust ? 0.95 : -Infinity, turn !== undefined);
}

/* ------------------------------------------------------------------ gear */

/**
 * An item's picture, from the model the hero carries or wears (POLISH_PLAN.md piece 11): the icons were painted pixel
 * art beside a world of low-poly models, and now they are the models themselves, in the same light. A weapon, a shield
 * or a quiver is pictured alone, lying across the picture; what is worn on the body is pictured on a figure, close on
 * where it is worn (a helm on a head, boots on feet). Null for what has no model (a ring, an amulet, a relic, a
 * potion): the painted icon stays for those. Null too until the models are in (the screen gate brings them in).
 */
export function gearPicture(item: Item, size: number): string | null {
  return shownPicture({ icon: itemIcon(item), tint: itemTint(item), mat: itemMat(item), r: item.r }, size, (slot) => heroLook('warrior', { [slot]: item }));
}

/** What shows of a Wardrobe look (progress/wardrobe.ts Look): what an item shows, and a set's own models (the shop's, the Ring's). */
export interface LookShown {
  icon: ItemIcon;
  tint: string;
  mat: Material;
  r: Rarity;
  set?: string;
  colors?: string[];
}

/**
 * A Wardrobe look's picture, made as an item's is: in the Wardrobe the equipped piece showed its model and every look
 * beside it its old painted icon (the owner: "some of the items have 2d icons some of them 3d icons"). A look worn on
 * the body is pictured on a figure wearing it as the Wardrobe puts it on (a shop or Ring set in its own models).
 */
export function lookPicture(look: LookShown, size: number): string | null {
  return shownPicture(look, size, (slot) => (slot === 'head' || slot === 'chest' ? heroLook('warrior', {}, { [slot]: look }) : null));
}

/** A piece's picture from what shows of it; `dressed` puts a piece worn on the body on a figure (null: it can't be). */
function shownPicture(it: { icon: ItemIcon; tint: string; mat: Material; r: Rarity }, size: number, dressed: (slot: SlotId) => HeroLook | null): string | null {
  if (!wardrobe || !ensure()) return null;
  const kind = CARRIED[it.icon];
  if (kind) {
    const m = carriedModel(wardrobe, kind, { tint: it.tint, mat: it.mat, r: it.r });
    return m ? shootThing(m, size, kind) : null;
  }
  const worn = WORN[it.icon];
  const look = worn ? dressed(worn.slot) : null;
  return worn && look ? shootWorn(wardrobe, look, worn, size) : null;
}

/** What is carried, by its icon: the kind of model it is. */
const CARRIED: Partial<Record<ItemIcon, string>> = { sword: 'sword', axe: 'axe', hammer: 'hammer', staff: 'staff', wand: 'wand', bow: 'bow', shield: 'shield', quiver: 'quiver' };

/** What is worn, by its icon: where, and where the camera stands to see it there (x, y, z, then where it looks). */
interface Worn {
  slot: SlotId;
  eye: readonly [number, number, number];
  at: readonly [number, number, number];
  turn: number;
}
const HEAD: Worn = { slot: 'head', eye: [0, 1.98, 2.5], at: [0, 1.8, 0], turn: 0.42 };
const CHEST: Worn = { slot: 'chest', eye: [0, 1.3, 3.0], at: [0, 1.12, 0], turn: 0.36 };
const WORN: Partial<Record<ItemIcon, Worn>> = {
  helm: HEAD,
  hood: HEAD,
  cap: HEAD,
  crown: HEAD,
  robe: CHEST,
  plate: CHEST,
  jerkin: CHEST,
  legs: { slot: 'legs', eye: [0, 0.62, 2.9], at: [0, 0.48, 0], turn: 0.36 },
  gloves: { slot: 'hands', eye: [0, 1.05, 3.4], at: [0, 0.95, 0], turn: 0.2 },
  boots: { slot: 'feet', eye: [0, 0.34, 2.1], at: [0, 0.12, 0], turn: 0.55 },
};

/** Whether an item of this icon is pictured from a model (else its painted icon stays). */
export const hasGearModel = (icon: ItemIcon): boolean => !!CARRIED[icon] || !!WORN[icon];

const flatCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 60);

/** A thing on its own, lying across the picture, its business end up and to the right, turned a little to show its depth. */
function shootThing(m: MeshData, size: number, kind: string): string | null {
  const r = renderer!;
  r.setPixelRatio(1);
  r.setSize(size, size, false);
  const geo = toGeometry(m);
  geo.setAttribute('iTint', new THREE.InstancedBufferAttribute(new Float32Array([1, 1, 1, 0]), 4));
  const thing = new THREE.InstancedMesh(geo, staticMaterial, 1);
  const lean = kind === 'shield' || kind === 'quiver' ? 0.12 : -Math.PI / 4;
  const pose = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.18, kind === 'shield' ? 0.55 : 0.5, lean, 'XYZ'));
  thing.setMatrixAt(0, pose);
  thing.frustumCulled = false;
  scene.add(thing);
  // (framed on the model as it lies: its corners, turned)
  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  for (let i = 0; i < m.n; i++) box.expandByPoint(v.set(m.pos[i * 3]!, m.pos[i * 3 + 1]!, m.pos[i * 3 + 2]!).applyMatrix4(pose));
  const c = box.getCenter(new THREE.Vector3());
  const half = Math.max(box.max.x - box.min.x, box.max.y - box.min.y) * 0.56 || 1;
  flatCam.left = c.x - half;
  flatCam.right = c.x + half;
  flatCam.top = c.y + half;
  flatCam.bottom = c.y - half;
  flatCam.position.set(c.x, c.y, c.z + 20);
  flatCam.lookAt(c.x, c.y, c.z);
  flatCam.updateProjectionMatrix();
  try {
    return photograph(size, size, flatCam);
  } finally {
    scene.remove(thing);
    geo.dispose();
    thing.dispose();
  }
}

/** Something worn, on a figure wearing it and nothing else of note, close on where it is worn. */
function shootWorn(w: Wardrobe, look: HeroLook, worn: Worn, size: number): string | null {
  const { mesh } = dressedOf(w, look, null, false);
  const r = renderer!;
  r.setPixelRatio(1);
  r.setSize(size, size, false);
  const crowd = new Crowd(mesh, w.medium, scene, 1, 0.022);
  crowd.begin();
  crowd.put(0, 0, 0, worn.turn, 1, 1, w.medium.frame('idle', 0.3));
  crowd.end();
  camera.aspect = 1;
  camera.position.set(worn.eye[0], worn.eye[1], worn.eye[2]);
  camera.lookAt(worn.at[0], worn.at[1], worn.at[2]);
  camera.updateProjectionMatrix();
  try {
    return photograph(size, size);
  } finally {
    crowd.dispose();
  }
}
