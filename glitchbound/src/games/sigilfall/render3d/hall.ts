import type { HeroLook } from '../render/art/hero';
import { TILE } from '../sim/map';
import { Motion } from './cast';
import { Stand } from './crowd';
import type { Held } from './dress';
import { hexRgb } from './kits';
import { Mesher, type LandPacks } from './land';
import { Stage } from './stage';
import { LIGHT } from './toon';

/**
 * The Wardens' Sanctum in 3D, where a hero waits: a hall of columns and banners under a great round window, the chosen
 * hero alive on the dais and the others standing either side, ready to step up.
 */

export interface HallHero {
  look: HeroLook;
  held: Held | null;
  shield: boolean;
}

/** A slot's place in the hall, for how many steps it is from the chosen one. */
function placeOf(off: number): { x: number; z: number; turn: number } {
  if (off === 0) return { x: 0, z: 0, turn: 0 };
  const side = Math.sign(off);
  const n = Math.abs(off);
  return { x: side * (2.5 + (n - 1) * 1.7), z: -1.5 - (n - 1) * 1.5, turn: -side * 0.45 };
}

export class Hall3D {
  readonly stage: Stage;
  private built = false;
  private readonly motions: Motion[] = [];
  private turn = 0.2;
  private readonly places: { x: number; z: number }[] = [];
  private readonly flames: { x: number; y: number; z: number }[] = [];
  private k = 1;
  private cssW = 1;
  private cssH = 1;
  private readonly g: CanvasRenderingContext2D;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.g = canvas.getContext('2d')!;
    this.stage = new Stage(canvas);
    canvas.style.position = 'absolute';
  }

  fit(w: number, h: number, dpr: number): void {
    this.cssW = Math.max(1, w);
    this.cssH = Math.max(1, h);
    this.k = Math.min(dpr, 2);
    this.canvas.width = Math.round(this.cssW * this.k);
    this.canvas.height = Math.round(this.cssH * this.k);
    this.canvas.style.width = `${this.cssW}px`;
    this.canvas.style.height = `${this.cssH}px`;
    this.stage.setSize(this.cssW, this.cssH, dpr, 60);
    // the hero the same share of the view on any screen, a little closer on a narrow one
    const c = this.stage.camera;
    c.fov = 26;
    c.near = 0.5;
    c.far = 90;
    c.aspect = this.cssW / this.cssH;
    c.updateProjectionMatrix();
  }

  private build(packs: LandPacks): void {
    this.built = true;
    const scene = this.stage.scene;
    const m = new Mesher();
    const slab = hexRgb('#57506f');
    const slab2 = hexRgb('#4a4463');
    const line = hexRgb('#2f2a45');
    // the floor, in worn slabs
    for (let z = -16; z < 8; z++) {
      for (let x = -16; x < 16; x++) {
        const c = (x + z) & 1 ? slab : slab2;
        const j = 0.93 + (((x * 73856093) ^ (z * 19349663)) & 15) * 0.012;
        const col = [c[0] * j, c[1] * j, c[2] * j];
        m.quad([x + 0.02, 0, z + 0.98], [x + 0.98, 0, z + 0.98], [x + 0.98, 0, z + 0.02], [x + 0.02, 0, z + 0.02], [0, 1, 0], col);
      }
    }
    m.quad([-16, -0.02, 8], [16, -0.02, 8], [16, -0.02, -16], [-16, -0.02, -16], [0, 1, 0], line);
    // the back wall and the side walls
    const wall = hexRgb('#3a3454');
    const wallHi = hexRgb('#544c78');
    const H = 11;
    m.quad([-16, 0, -9], [16, 0, -9], [16, H, -9], [-16, H, -9], [0, 0, 1], wallHi, wall);
    m.quad([-11, 0, 8], [-11, 0, -9], [-11, H, -9], [-11, H, 8], [1, 0, 0], wallHi, wall);
    m.quad([11, 0, -9], [11, 0, 8], [11, H, 8], [11, H, -9], [-1, 0, 0], wallHi, wall);
    // the dais: three steps of a round stone
    const ring = (r: number, y0: number, y1: number, top: readonly number[], side: readonly number[]): void => {
      const N = 28;
      for (let i = 0; i < N; i++) {
        const a0 = (i / N) * Math.PI * 2;
        const a1 = ((i + 1) / N) * Math.PI * 2;
        const x0 = Math.cos(a0) * r;
        const z0 = Math.sin(a0) * r;
        const x1 = Math.cos(a1) * r;
        const z1 = Math.sin(a1) * r;
        m.quad([x1, y1, z1], [x0, y1, z0], [0, y1, 0], [0, y1, 0], [0, 1, 0], top);
        m.quad([x1, y0, z1], [x0, y0, z0], [x0, y1, z0], [x1, y1, z1], [Math.cos((a0 + a1) / 2), 0, Math.sin((a0 + a1) / 2)], side);
      }
    };
    ring(2.05, 0, 0.14, hexRgb('#6d6690'), hexRgb('#37314f'));
    ring(1.62, 0.14, 0.28, hexRgb('#8179a8'), hexRgb('#463f62'));
    // the great round window: wedges of colored glass round a pale heart
    const glass = ['#7fb8ff', '#c58bff', '#ff8ac4', '#ffd36b', '#8ae0ff', '#a48bdc'].map(hexRgb);
    const cx = 0;
    const cy = 5.15;
    const wz = -8.96;
    const N = 18;
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * Math.PI * 2;
      const a1 = ((i + 0.92) / N) * Math.PI * 2;
      const pt = (a: number, r: number): number[] => [cx + Math.cos(a) * r, cy + Math.sin(a) * r, wz];
      const c = glass[i % glass.length]!;
      const bright = [Math.min(1.6, c[0] * 1.5), Math.min(1.6, c[1] * 1.5), Math.min(1.6, c[2] * 1.5)];
      m.quad(pt(a1, 0.95), pt(a0, 0.95), pt(a0, 2.1), pt(a1, 2.1), [0, 0.6, 0.8], bright);
      m.quad(pt(a1, 0.16), pt(a0, 0.16), pt(a0, 0.86), pt(a1, 0.86), [0, 0.6, 0.8], [1.5, 1.5, 1.35]);
    }
    const rim = hexRgb('#2a2540');
    for (let i = 0; i < 48; i++) {
      const a0 = (i / 48) * Math.PI * 2;
      const a1 = ((i + 1) / 48) * Math.PI * 2;
      const pt = (a: number, r: number): number[] => [cx + Math.cos(a) * r, cy + Math.sin(a) * r, wz - 0.01];
      m.quad(pt(a1, 0), pt(a0, 0), pt(a0, 2.26), pt(a1, 2.26), [0, 0, 1], rim);
    }
    scene.add(m.build());

    // columns marching back, banners between them, a fire in a bowl by each
    const put = (id: string, x: number, z: number, h: number, rot = 0): void => {
      const mesh = packs.indoor.meshes[id] ?? packs.town.meshes[id] ?? packs.nature.meshes[id];
      if (!mesh) return;
      const s = new Stand(mesh, scene, 1);
      const k = h / Math.max(0.01, mesh.max[1] - mesh.min[1]);
      s.begin();
      s.put(x, 0, z, rot, k, k, k, 1, 1, 1, 0);
      s.end();
    };
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const z = 1.5 - i * 3.6;
        put('pillar', side * (7 - i * 0.3), z, 7.4);
        put('torch_lit', side * (5.5 - i * 0.2), z + 1.1, 2.3);
        this.flames.push({ x: side * (5.5 - i * 0.2), y: 1.42, z: z + 1.1 });
      }
      put('banner_red', side * 6.3, -8.75, 5.4);
    }
    put('rug_rectangle_A', 0, 4.5, 0.05);
  }

  /** One frame: `at` is the chosen slot, `turn` how far the player has spun the hero (radians). */
  frame(heroes: (HallHero | null)[], at: number, turn: number, dt: number, time: number): void {
    const st = this.stage;
    if (!st.ready) return;
    if (!this.built) this.build(st.landPacks!);
    LIGHT.uTime.value = time;
    LIGHT.uDark.value.set(0, 8, 0, 0);
    LIGHT.uGrade.value.set(0, 0, 0, 0);
    for (const f of LIGHT.uFlames.value) f.set(0, 0, 0);
    const c = st.camera;
    const wide = this.cssW / this.cssH;
    const back = wide > 1.2 ? 13.5 : 17;
    c.position.set(0, 3.1, back);
    c.lookAt(0, 2.5, 0);
    c.updateMatrixWorld(true);
    st.syncCamera();
    this.turn += (turn - this.turn) * Math.min(1, dt * 12);
    const n = heroes.length;
    const half = Math.floor(n / 2);
    st.cast.begin();
    heroes.forEach((h, i) => {
      const off = ((i - at + n + half) % n) - half;
      if (Math.abs(off) > 2) return;
      const p = placeOf(off);
      const pl = this.places[i] ?? (this.places[i] = { x: p.x, z: p.z });
      const ease = Math.min(1, dt * 7);
      pl.x += (p.x - pl.x) * ease;
      pl.z += (p.z - pl.z) * ease;
      const m = this.motions[i] ?? (this.motions[i] = new Motion());
      m.set(off === 0 ? 'idle' : 'idle2');
      m.advance(dt);
      const onDais = off === 0 ? 0.28 : Math.max(0, 0.28 * (1 - Math.hypot(pl.x, pl.z) / 2));
      if (h) {
        st.cast.shadow(pl.x * TILE, pl.z * TILE, off === 0 ? 11 : 9);
        st.cast.person(h.look, h.held, h.shield, pl.x * TILE, pl.z * TILE, off === 0 ? this.turn : p.turn, m, { h: (off === 0 ? 2.5 : 2.12) * TILE, lift: onDais });
      } else {
        // an empty place: the shape of someone who could stand there
        st.cast.shadow(pl.x * TILE, pl.z * TILE, 9);
      }
    });
    st.cast.end();
    st.render(dt);

    // the fires, the moonbeam and the motes
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    g.setTransform(this.k, 0, 0, this.k, 0, 0);
    const s = (x: number, y: number, z: number): { x: number; y: number } => st.project(x * TILE, z * TILE, y * TILE);
    const top = s(0, 5.15, -8.9);
    const foot = s(0, 0, 0);
    const spread = Math.abs(s(2, 0, 0).x - foot.x);
    const beam = g.createLinearGradient(0, top.y, 0, foot.y);
    beam.addColorStop(0, 'rgba(190,210,255,0.28)');
    beam.addColorStop(1, 'rgba(190,210,255,0.06)');
    g.fillStyle = beam;
    g.beginPath();
    g.moveTo(top.x - spread * 0.5, top.y);
    g.lineTo(top.x + spread * 0.5, top.y);
    g.lineTo(foot.x + spread, foot.y);
    g.lineTo(foot.x - spread, foot.y);
    g.closePath();
    g.fill();
    for (const f of this.flames) {
      const at2 = s(f.x, f.y, f.z);
      const size = Math.abs(s(f.x + 1, f.y, f.z).x - at2.x);
      const fl = 1 + Math.sin(time * 9 + f.x * 3 + f.z) * 0.14;
      const glow = g.createRadialGradient(at2.x, at2.y - size * 0.2, 0, at2.x, at2.y - size * 0.2, size * 1.1 * fl);
      glow.addColorStop(0, 'rgba(255,190,90,0.6)');
      glow.addColorStop(1, 'rgba(255,110,30,0)');
      g.fillStyle = glow;
      g.beginPath();
      g.arc(at2.x, at2.y - size * 0.2, size * 1.1 * fl, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#ffb347';
      g.beginPath();
      g.ellipse(at2.x, at2.y - size * 0.22 * fl, size * 0.15, size * 0.3 * fl, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#fff2c0';
      g.beginPath();
      g.ellipse(at2.x, at2.y - size * 0.15, size * 0.07, size * 0.15 * fl, 0, 0, Math.PI * 2);
      g.fill();
    }
    for (let i = 0; i < 26; i++) {
      const u = (time * 0.06 + i * 0.137) % 1;
      const x = Math.sin(i * 12.9) * spread * 0.9 * (0.3 + u * 0.7);
      const y = top.y + (foot.y - top.y) * u;
      g.fillStyle = `rgba(230,235,255,${0.45 * Math.sin(u * Math.PI)})`;
      g.beginPath();
      g.arc(foot.x + x, y, 1.2 + (i % 3) * 0.5, 0, Math.PI * 2);
      g.fill();
    }
  }

  dispose(): void {
    this.stage.dispose();
  }
}
