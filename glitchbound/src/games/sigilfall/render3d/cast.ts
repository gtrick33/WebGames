import * as THREE from 'three';
import { ART_TILE, TILE } from '../sim/map';
import { Crowd, Stand } from './crowd';
import { dressedOf, type Held, type Wardrobe } from './dress';
import { hexRgb, kitOf, type Kit } from './kits';
import { UNIT } from './land';
import { loadPack, type MeshData, type Pack } from './pack';
import { ringMaterial, rigAnimOf, shadowMaterial, type RigAnim } from './toon';
import type { HeroLook } from '../render/art/hero';
import { npcLookOf } from '../render/sprites';

/**
 * Everyone on the land right now. Each frame the game says who stands where and what they are doing; those who
 * share a model share a draw call, so a screen full of the same skeleton costs no more than one.
 */

/** A figure's height in world pixels, from how wide the rules say it is. */
export const heightFromRadius = (r: number, size = 1): number => (r * 2.5 + 16) * size;
/** A person's height in world pixels. */
export const PERSON_H = 36;

interface KitEntry {
  crowd: Crowd | null;
  rig: RigAnim | null;
  mesh: MeshData | null;
  kit: Kit;
  loading: boolean;
}

/** A clip fading into another, for anyone whose moves must read clearly (heroes, bosses, Ring fighters). */
export class Motion {
  clip = 'idle';
  t = 0;
  private from = 'idle';
  private fromT = 0;
  private fade = 0;
  private loop = true;
  private fromLoop = true;

  set(clip: string, loop = true, blend = 0.14, restart = false): void {
    if (clip === this.clip && !restart) return;
    this.from = this.clip;
    this.fromT = this.t;
    this.fromLoop = this.loop;
    this.clip = clip;
    this.loop = loop;
    this.t = 0;
    this.fade = blend;
  }

  advance(dt: number): void {
    this.t += dt;
    if (this.fade > 0) {
      this.fromT += dt;
      this.fade = Math.max(0, this.fade - dt);
    }
  }

  /** The two rows to show and how far along from the first to the second. */
  frames(rig: RigAnim, out: { a: number; b: number; k: number }): void {
    const now = rig.frame(rig.has(this.clip) ? this.clip : 'idle', this.t, this.loop);
    if (this.fade > 0) {
      out.a = now;
      out.b = rig.frame(rig.has(this.from) ? this.from : 'idle', this.fromT, this.fromLoop);
      out.k = Math.min(1, this.fade / 0.14);
    } else {
      out.a = now;
      out.b = 0;
      out.k = 0;
    }
  }
}

const frames = { a: 0, b: 0, k: 0 };

/** A figure from the creature files, frozen and huge (tiles; `h` how tall it would stand, `lift` below 0 is sunk). */
export interface Colossus {
  kit: string;
  x: number;
  z: number;
  lift: number;
  rot: number;
  h: number;
  clip: string;
  t: number;
  tint: readonly [number, number, number];
  tipX: number;
  tipZ: number;
  /** How far its own colors are washed toward plain stone (0 to 1). */
  stone: number;
}

export class Cast {
  readonly root = new THREE.Group();
  wardrobe: Wardrobe | null = null;
  private readonly kits = new Map<string, KitEntry>();
  private readonly people = new Map<string, Crowd>();
  private readonly props = new Map<string, Stand>();
  private readonly colossi = new Map<string, Crowd>();
  private readonly used = new Set<Crowd | Stand>();
  private readonly shadowMesh: THREE.InstancedMesh;
  private shadowN = 0;
  private readonly rings: THREE.InstancedMesh;
  private readonly ringTint: THREE.InstancedBufferAttribute;
  private ringN = 0;
  private readonly m4 = new THREE.Matrix4();
  /** Where to look for still things (a chest, a potion). */
  packs: Pack[] = [];

  constructor(ground: THREE.Object3D) {
    const quad = new THREE.PlaneGeometry(1, 1);
    quad.rotateX(-Math.PI / 2);
    this.shadowMesh = new THREE.InstancedMesh(quad, shadowMaterial, 512);
    this.shadowMesh.frustumCulled = false;
    this.shadowMesh.position.y = 0.05;
    this.shadowMesh.count = 0;
    ground.add(this.shadowMesh);
    const ringQuad = new THREE.PlaneGeometry(1, 1);
    ringQuad.rotateX(-Math.PI / 2);
    this.ringTint = new THREE.InstancedBufferAttribute(new Float32Array(64 * 4), 4).setUsage(THREE.DynamicDrawUsage);
    ringQuad.setAttribute('iRing', this.ringTint);
    this.rings = new THREE.InstancedMesh(ringQuad, ringMaterial, 64);
    this.rings.frustumCulled = false;
    this.rings.position.y = 0.06;
    this.rings.count = 0;
    ground.add(this.rings);
  }

  begin(): void {
    for (const c of this.used) c.begin();
    this.used.clear();
    this.shadowN = 0;
    this.ringN = 0;
  }

  end(): void {
    const empty = (c: Crowd | Stand): void => {
      if (this.used.has(c)) return;
      c.begin();
      c.end();
    };
    for (const c of this.kits.values()) if (c.crowd) empty(c.crowd);
    for (const c of this.people.values()) empty(c);
    for (const c of this.props.values()) empty(c);
    for (const c of this.colossi.values()) empty(c);
    for (const c of this.used) c.end();
    this.shadowMesh.count = this.shadowN;
    this.shadowMesh.instanceMatrix.needsUpdate = true;
    this.rings.count = this.ringN;
    this.rings.instanceMatrix.needsUpdate = true;
    this.ringTint.needsUpdate = true;
  }

  /** A ring on the ground round someone, `r` world pixels out. */
  ring(x: number, y: number, r: number, color: string, alpha = 0.7): void {
    if (this.ringN >= 64) return;
    const i = this.ringN++;
    const s = r * UNIT * 2;
    this.m4.makeScale(s, 1, s);
    this.m4.setPosition(x * UNIT, 0, y * UNIT);
    this.rings.setMatrixAt(i, this.m4);
    const [cr, cg, cb] = hexRgb(color);
    this.ringTint.setXYZW(i, cr, cg, cb, alpha);
  }

  /** A soft round shadow, `r` world pixels across. */
  shadow(x: number, y: number, r: number): void {
    if (this.shadowN >= 512) return;
    const s = r * UNIT * 2;
    this.m4.makeScale(s, 1, s);
    this.m4.setPosition(x * UNIT, 0, y * UNIT);
    this.shadowMesh.setMatrixAt(this.shadowN++, this.m4);
  }

  private entry(id: string, kit: Kit): KitEntry {
    let e = this.kits.get(id);
    if (!e) {
      e = { crowd: null, rig: null, mesh: null, kit, loading: true };
      this.kits.set(id, e);
      const entry = e;
      void loadPack(`k/${id}`)
        .then((pack) => {
          const mesh = pack.meshes.body!;
          const w = this.wardrobe;
          if (!w) {
            entry.loading = false;
            this.kits.delete(id);
            return;
          }
          const rig = mesh.rig === 'medium' ? w.medium : mesh.rig === 'large' ? w.large : rigAnimOf(pack, mesh.rig!);
          entry.rig = rig;
          entry.mesh = mesh;
          entry.crowd = new Crowd(mesh, rig, this.root, 16, 0.022);
          entry.loading = false;
        })
        .catch(() => {
          entry.loading = false;
        });
    }
    return e;
  }

  /**
   * A figure from the creature files, huge and frozen in a pose (a stone king, a titan's bones): `h` is how tall it
   * would stand, in tiles. Its own crowd, with no ink line (at this size the line would be as thick as a person) and,
   * if it stands in the ground, stopping there.
   */
  colossus(c: Colossus): void {
    const e = this.entry(c.kit, { k: c.kit });
    const { mesh, rig } = e;
    if (!mesh || !rig) return;
    let crowd = this.colossi.get(c.kit);
    if (!crowd) {
      crowd = new Crowd(mesh, rig, this.root, 4, 0, true);
      this.colossi.set(c.kit, crowd);
    }
    const tall = Math.max(0.05, mesh.max[1] - mesh.min[1]);
    const s = c.h / tall;
    const frame = rig.frame(rig.has(c.clip) ? c.clip : 'idle', c.t, false);
    crowd.put(c.x, c.lift, c.z, c.rot, s, s, frame, 0, 0, 1, c.tint[0], c.tint[1], c.tint[2], c.stone, c.tipX, c.tipZ);
    this.used.add(crowd);
  }

  /** Whether a model is in yet (a land waits for its first few before fading up). */
  ready(sprite: string): boolean {
    return !!this.entry(kitOf(sprite).k, kitOf(sprite)).crowd;
  }

  /** A creature's clip, by the name its kit walks with. */
  walkOf(sprite: string, enemy?: string): string {
    return kitOf(sprite, enemy).walk ?? 'walk';
  }

  /** Starts fetching models ahead of need. */
  preload(sprites: Iterable<string>): void {
    for (const s of sprites) {
      const k = kitOf(s);
      this.entry(k.k, k);
      if (k.top) this.entry(k.top.k, { k: k.top.k });
    }
  }

  /**
   * One creature, by the game's name for it. `h` is its height in world pixels, `rot` its facing about the
   * vertical. Returns the kit, so the caller can read how high its head is.
   */
  creature(sprite: string, x: number, y: number, rot: number, h: number, clip: string, t: number, loop: boolean, opts?: { alpha?: number; flash?: number; rise?: number; tint?: readonly [number, number, number]; sx?: number; sy?: number; motion?: Motion; lift?: number; enemy?: string }): Kit {
    const kit = kitOf(sprite, opts?.enemy);
    if (kit.look) {
      const look = npcLookOf(kit.look);
      if (look) {
        this.person(look, null, false, x, y, rot, { clip: clip === 'chop' ? 'cast' : clip, t, loop }, { alpha: opts?.alpha, flash: opts?.flash, h });
        return kit;
      }
    }
    const e = this.entry(kit.k, kit);
    const crowd = e.crowd;
    const rig = e.rig;
    const mesh = e.mesh;
    if (!crowd || !rig || !mesh) return kit;
    // (a wide thing is sized by its width, or a dragon's wings would fill the screen)
    const tall = Math.max(0.05, mesh.max[1] - mesh.min[1], (mesh.max[0] - mesh.min[0]) * 0.72);
    const s = ((h * (kit.size ?? 1)) / TILE) / tall;
    const motion = opts?.motion;
    if (motion) motion.frames(rig, frames);
    else {
      frames.a = rig.frame(rig.has(clip) ? clip : 'idle', t, loop);
      frames.b = 0;
      frames.k = 0;
    }
    let r = 1;
    let g = 1;
    let b = 1;
    if (kit.tint) {
      const c = hexRgb(kit.tint);
      r = c[0];
      g = c[1];
      b = c[2];
    }
    if (kit.gain) {
      r *= kit.gain;
      g *= kit.gain;
      b *= kit.gain;
    }
    if (opts?.tint) {
      r *= opts.tint[0];
      g *= opts.tint[1];
      b *= opts.tint[2];
    }
    const lift = (kit.float ?? 0) * (ART_TILE / TILE) + (opts?.lift ?? 0);
    // (a beast's own middle stands on its spot: some are modeled with their hips at the origin)
    const mx = ((mesh.min[0] + mesh.max[0]) / 2) * s;
    const mz = ((mesh.min[2] + mesh.max[2]) / 2) * s;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    crowd.put(x * UNIT - (mx * cos + mz * sin), lift - (opts?.rise ?? 0) * (h / TILE), y * UNIT - (mz * cos - mx * sin), rot, s * (opts?.sx ?? 1), s * (opts?.sy ?? 1), frames.a, frames.b, frames.k, Math.min(opts?.alpha ?? 1, kit.ghost ?? 1), r, g, b, opts?.flash ?? 0);
    this.used.add(crowd);
    if (kit.top) {
      const e2 = this.entry(kit.top.k, { k: kit.top.k });
      if (e2.crowd && e2.rig && e2.mesh) {
        const c = kit.top.tint ? hexRgb(kit.top.tint) : ([1, 1, 1] as const);
        const topTall = Math.max(0.05, e2.mesh.max[1] - e2.mesh.min[1]);
        const ks = ((h * kit.top.size) / TILE) / topTall;
        const riding = e2.rig.has(kit.top.clip) ? kit.top.clip : 'idle';
        e2.crowd.put(x * UNIT, lift + (kit.top.y * h) / TILE, y * UNIT, rot, ks, ks, e2.rig.frame(riding, t, true), 0, 0, Math.min(opts?.alpha ?? 1, kit.ghost ?? 1), c[0], c[1], c[2], opts?.flash ?? 0);
        this.used.add(e2.crowd);
      }
    }
    return kit;
  }

  /** The rig a creature's clips belong to (null until it has loaded). */
  rigOf(sprite: string): RigAnim | null {
    const kit = kitOf(sprite);
    return this.entry(kit.k, kit).rig;
  }

  /** One person in a look: a hero, a villager, anyone who wears the wardrobe. */
  person(look: HeroLook, held: Held | null, shield: boolean, x: number, y: number, rot: number, motion: Motion | { clip: string; t: number; loop: boolean }, opts?: { alpha?: number; flash?: number; h?: number; lift?: number; tint?: readonly [number, number, number]; xray?: boolean }): void {
    const w = this.wardrobe;
    if (!w) return;
    const { key, mesh } = dressedOf(w, look, held, shield);
    let c = this.people.get(key);
    if (!c) {
      c = new Crowd(mesh, w.medium, this.root, 2, 0.024);
      this.people.set(key, c);
      if (opts?.xray) c.seeThrough();
      if (this.people.size > 48) this.trimPeople();
    }
    const tall = mesh.max[1] - mesh.min[1] || 2.3;
    const clamped = Math.min(tall, 2.6);
    const s = ((opts?.h ?? PERSON_H) / TILE) / clamped;
    if (motion instanceof Motion) motion.frames(w.medium, frames);
    else {
      frames.a = w.medium.frame(motion.clip, motion.t, motion.loop);
      frames.b = 0;
      frames.k = 0;
    }
    c.put(x * UNIT, opts?.lift ?? 0, y * UNIT, rot, s, s, frames.a, frames.b, frames.k, opts?.alpha ?? 1, opts?.tint?.[0] ?? 1, opts?.tint?.[1] ?? 1, opts?.tint?.[2] ?? 1, opts?.flash ?? 0);
    this.used.add(c);
  }

  private trimPeople(): void {
    for (const [key, c] of this.people) {
      if (this.people.size <= 32) break;
      if (!this.used.has(c)) {
        c.dispose();
        this.people.delete(key);
      }
    }
  }

  /** One still thing that comes and goes (a chest, a coin, a potion). */
  prop(id: string, x: number, y: number, h: number, rot = 0, lift = 0, tint?: readonly [number, number, number]): void {
    let s = this.props.get(id);
    if (!s) {
      let mesh: MeshData | undefined;
      for (const p of this.packs) {
        mesh = p.meshes[id];
        if (mesh) break;
      }
      if (!mesh) return;
      s = new Stand(mesh, this.root, 64);
      this.props.set(id, s);
    }
    const mesh = (s.mesh.geometry as THREE.BufferGeometry & { _tall?: number })._tall;
    let tall = mesh;
    if (tall === undefined) {
      s.mesh.geometry.computeBoundingBox();
      const box = s.mesh.geometry.boundingBox!;
      tall = Math.max(0.01, box.max.y - box.min.y);
      (s.mesh.geometry as THREE.BufferGeometry & { _tall?: number })._tall = tall;
    }
    const k = (h / TILE) / tall;
    if (!this.used.has(s)) {
      s.begin();
      this.used.add(s);
    }
    s.put(x * UNIT, lift, y * UNIT, rot, k, k, k, tint?.[0] ?? 1, tint?.[1] ?? 1, tint?.[2] ?? 1, 0);
  }

  dispose(): void {
    for (const e of this.kits.values()) e.crowd?.dispose();
    for (const c of this.people.values()) c.dispose();
    for (const c of this.props.values()) c.dispose();
    for (const c of this.colossi.values()) c.dispose();
    this.colossi.clear();
    this.kits.clear();
    this.people.clear();
    this.props.clear();
    this.shadowMesh.parent?.remove(this.shadowMesh);
    this.shadowMesh.geometry.dispose();
    this.shadowMesh.dispose();
    this.rings.parent?.remove(this.rings);
    this.rings.geometry.dispose();
    this.rings.dispose();
    this.root.clear();
  }
}

export type { Held };
