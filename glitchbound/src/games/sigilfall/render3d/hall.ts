import type { HeroLook } from '../render/art/hero';
import { TILE } from '../sim/map';
import { Motion } from './cast';
import type { Held } from './dress';
import { FX } from './fx3d';
import { dressHall, type HallDress } from './hallDress';
import { hexRgb } from './kits';
import { Stage } from './stage';
import { LIGHT } from './toon';

/**
 * The Wardens' Sanctum, where a hero waits (hallDress.ts builds it): the chosen hero alive on the dais under the great
 * round window, the others standing either side, ready to step up.
 */

export interface HallHero {
  look: HeroLook;
  held: Held | null;
  shield: boolean;
  /** Their class's color, for the banners and the dais. */
  color?: string;
  /** Which of the seven Crown Sigils they've won, in order. */
  sigils?: boolean[];
}

/** Each Crown Sigil's own light, once it's been won: embers, tides, stone, the sun, frost, thorns, the veil. */
const SIGIL_LIGHT = ['#ff8a3a', '#4aa8ff', '#d8c8a0', '#ffd24a', '#a8e8ff', '#7fd86a', '#b47aff'];
const IRON = [0.3, 0.33, 0.48] as const;

/** Those not on the dais stand back in the dark. */
const AWAY: [number, number, number] = [0.5, 0.5, 0.62];
/** The hall's light comes from in front and above, wherever the world's sun is. */
const SUN = [0, 0.55, 0.83] as const;
const WORLD_SUN = [-0.42, 0.78, 0.46] as const;
/** The banners when nobody stands on the dais. */
const NO_ONE = hexRgb('#a02434');

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
  private dress: HallDress | null = null;
  /** The color the hall is in, on its way to the hero's. */
  private readonly tint: [number, number, number] = [NO_ONE[0], NO_ONE[1], NO_ONE[2]];
  private tinted = false;
  private readonly crownAt: { x: number; y: number; z: number; won: boolean }[] = [];
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
    // the dark closing in round the edge of the picture: painted once, over everything
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const W = this.canvas.width;
    const H = this.canvas.height;
    const edge = g.createRadialGradient(W / 2, H * 0.44, Math.min(W, H) * 0.34, W / 2, H * 0.44, Math.hypot(W, H) * 0.56);
    edge.addColorStop(0, 'rgba(3,2,10,0)');
    edge.addColorStop(0.55, 'rgba(3,2,10,0.34)');
    edge.addColorStop(1, 'rgba(3,2,10,0.86)');
    g.fillStyle = edge;
    g.fillRect(0, 0, W, H);
    // the hero the same share of the view on any screen, a little closer on a narrow one
    const c = this.stage.camera;
    c.fov = 26;
    c.near = 0.5;
    c.far = 90;
    c.aspect = this.cssW / this.cssH;
    c.updateProjectionMatrix();
  }

  /** One frame: `at` is the chosen slot, `turn` how far the player has spun the hero (radians). */
  frame(heroes: (HallHero | null)[], at: number, turn: number, dt: number, time: number): void {
    const st = this.stage;
    if (!st.ready) return;
    if (!this.built) {
      this.built = true;
      this.dress = dressHall(st, st.landPacks!);
    }
    LIGHT.uTime.value = time;
    LIGHT.uSun.value.set(SUN[0], SUN[1], SUN[2]).normalize();
    LIGHT.uDark.value.set(0, 8, 0, 0);
    LIGHT.uNight.value.set(1, 1, 1, 0);
    LIGHT.uGrade.value.set(0, 0, 0, 0);
    for (const f of LIGHT.uFlames.value) f.set(0, 0, 0);
    const c = st.camera;
    const wide = this.cssW / this.cssH;
    // (a short screen on its side has bars over its top and foot: the hero stands further back, between them)
    const short = wide > 1.2 && this.cssH < 480;
    const back = short ? 15 : wide > 1.2 ? 13.5 : 17;
    // low, and looking a little down: the hero between the title over them and the buttons under them
    c.position.set(0, 2.3, back);
    c.lookAt(0, wide > 1.2 ? 1.16 : 1.5, 0);
    c.updateMatrixWorld(true);
    st.syncCamera();
    this.turn += (turn - this.turn) * Math.min(1, dt * 12);
    const n = heroes.length;
    const half = Math.floor(n / 2);
    // the banners go over slowly to the color of the one on the dais
    const here = heroes[at];
    const want = here?.color ? hexRgb(here.color) : NO_ONE;
    const moved = Math.abs(want[0] - this.tint[0]) + Math.abs(want[1] - this.tint[1]) + Math.abs(want[2] - this.tint[2]) > 0.004;
    if ((moved || !this.tinted) && this.dress) {
      const k = this.tinted ? Math.min(1, dt * 3.2) : 1;
      for (let i = 0; i < 3; i++) this.tint[i] = this.tint[i]! + (want[i]! - this.tint[i]!) * k;
      this.tinted = true;
      for (const s of this.dress.colors) {
        s.begin();
        // (the banners in shadow, not in full color; the ring's the color itself)
        s.put(0, 0, 0, 0, 1, 1, 1, this.tint[0], this.tint[1], this.tint[2], 0);
        s.end();
      }
    }
    this.crown(here, time);
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
      const onDais = off === 0 ? 0.3 : Math.max(0, 0.3 * (1 - Math.hypot(pl.x, pl.z) / 2.2));
      if (h) {
        st.cast.shadow(pl.x * TILE, pl.z * TILE, off === 0 ? 11 : 9);
        st.cast.person(h.look, h.held, h.shield, pl.x * TILE, pl.z * TILE, off === 0 ? this.turn : p.turn, m, { tint: off === 0 ? undefined : AWAY, h: (off === 0 ? 2.5 : 2.12) * TILE, lift: onDais });
      } else {
        // an empty place: the shape of someone who could stand there
        st.cast.shadow(pl.x * TILE, pl.z * TILE, 9);
      }
    });
    st.cast.end();
    this.air(time);
    st.render(dt);
  }

  /** The broken crown, turning slowly over the head of whoever's on the dais, each sigil they've won alight. */
  private crown(here: HallHero | null | undefined, time: number): void {
    const s = this.dress?.sigils;
    if (!s) return;
    s.begin();
    for (let i = 0; i < 7; i++) {
      const a = time * 0.16 + (i / 7) * Math.PI * 2;
      const x = Math.cos(a) * 1.3;
      const z = Math.sin(a) * 1.3;
      const y = 3.2 + Math.sin(time * 0.7 + i * 1.7) * 0.05;
      const won = here?.sigils?.[i];
      const c = won ? hexRgb(SIGIL_LIGHT[i]!) : IRON;
      const k = won ? 1.35 : 1;
      s.put(x, y, z, time * 0.12 + i, 0.46, 0.46, 0.46, c[0] * k, c[1] * k, c[2] * k, 0);
      this.crownAt[i] = { x, y, z, won: !!won };
    }
    s.end();
  }

  /** The fires, the candles, the crown's light, and the ash coming down through the cold light. */
  private air(time: number): void {
    const q = this.stage.fx;
    const d = this.dress;
    q.begin();
    if (d) {
      for (let i = 0; i < 7; i++) {
        const c = this.crownAt[i];
        if (!c) continue;
        q.put({ kind: FX.glow, x: c.x * TILE, y: c.z * TILE, up: c.y * TILE, w: c.won ? 34 : 13, a: c.won ? SIGIL_LIGHT[i]! : '#8a9cff', alpha: c.won ? 0.8 : 0.5 });
      }
      for (const e of d.eyes) q.put({ kind: FX.glow, x: e.x * TILE, y: e.z * TILE, up: e.y * TILE, w: 14 + Math.sin(time * 0.7 + e.x) * 2, a: '#9ad8ff', alpha: 0.55 });
      for (const f of d.fires) {
        const flick = 1 + Math.sin(time * 7 + f.x * 3 + f.z) * 0.06;
        const x = f.x * TILE;
        const y = f.z * TILE;
        const up = f.y * TILE;
        q.put({ kind: FX.glow, x, y, up: up + 8 * f.size, w: 64 * f.size * flick, a: '#d8501c', alpha: 0.32 });
        q.put({ kind: FX.flame, x, y, up: up - 3, base: true, w: 26 * f.size, h: 38 * f.size, a: '#c8401a', b: '#ff9a2e', seed: f.x * 0.37 + f.z });
      }
      for (const f of d.candles) {
        const x = f.x * TILE;
        const y = f.z * TILE;
        const up = f.y * TILE;
        q.put({ kind: FX.glow, x, y, up: up + 2, w: 16, a: '#ff9a50', alpha: 0.35 });
        q.put({ kind: FX.flame, x, y, up: up - 1, base: true, w: 4, h: 7, a: '#ff7a2a', b: '#ffd08a', seed: f.x + f.z });
      }
      // sparks going up from the bowls
      for (let i = 0; i < 16; i++) {
        const f = d.fires[i % d.fires.length]!;
        const u = (time * (0.2 + (i % 5) * 0.04) + i * 0.137) % 1;
        q.put({ kind: FX.spark, x: (f.x + Math.sin(time * 0.9 + i) * (0.1 + u * 0.5)) * TILE, y: f.z * TILE, up: (f.y + 0.4 + u * 2.6) * TILE, w: 3.2 - u * 1.8, a: u < 0.5 ? '#ffd27a' : '#ff6a2a', t: 0.2, alpha: 1 - u });
      }
    }
    // ash, coming down all through the hall, catching the light where it crosses the fall from the window
    for (let i = 0; i < 46; i++) {
      const u = (time * (0.022 + (i % 7) * 0.004) + i * 0.137) % 1;
      const x = Math.sin(i * 12.9) * 6.6 + Math.sin(time * 0.17 + i) * 0.5;
      const z = -8 + ((i * 0.73) % 1) * 10;
      const y = 6.2 * (1 - u);
      const lit = Math.abs(x) < 1.6 + (z + 8) * 0.2;
      q.put({ kind: FX.spark, x: x * TILE, y: z * TILE, up: y * TILE, w: 1.8 + (i % 3) * 0.9, a: lit ? '#dfe6ff' : '#8a8498', t: 0.2, alpha: (lit ? 0.7 : 0.34) * Math.sin(u * Math.PI) });
    }
    q.end();
  }

  dispose(): void {
    // (the world has its own sun)
    LIGHT.uSun.value.set(WORLD_SUN[0], WORLD_SUN[1], WORLD_SUN[2]).normalize();
    this.dress?.dispose();
    this.stage.dispose();
  }
}
