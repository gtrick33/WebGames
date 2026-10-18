import { bboxOf, overlaps, PolyCull, type Rect } from './cull';
import { leftOf, pointAt, type Path, type Vec } from './geometry';
import type { Pose } from './ghost';
import { CAR, localVelocity, speedOf } from './physics';
import type { CarDef, CarShape } from './cars';
import { COUNTDOWN, RACE_LAPS, type RaceSim } from './sim';
import { KERB, WALL_HALF, type Obstacle, type Surface, type ThemeId, type Track } from './track';

/** Canvas 2D drawing for the racer: road from cached Path2Ds, low-poly cars, skids, particles, HUD. */

interface Theme {
  ground: string;
  speck: string[];
  road: string;
  edge: string;
  kerbA: string;
  kerbB: string;
  decor: string[][];
}

export const THEMES: Record<ThemeId, Theme> = {
  bay: {
    ground: '#f6d896',
    speck: ['#efc97c', '#fbe6b4', '#e9bd6c'],
    road: '#5b5a8f',
    edge: '#3c3a6b',
    kerbA: '#ff5a6c',
    kerbB: '#fff6e6',
    // palm, beach umbrella, bush
    decor: [
      ['#2fbf71', '#1e9a5a', '#7a5230'],
      ['#ff5a6c', '#fff6e6', '#ffd12e'],
      ['#56cf7e', '#33a862', '#2a8a50'],
    ],
  },
  frost: {
    ground: '#eef6ff',
    speck: ['#dce9fb', '#ffffff', '#d2e2f7'],
    road: '#6f78b3',
    edge: '#4a518a',
    kerbA: '#ff4f9a',
    kerbB: '#ffffff',
    // pine, snowy rock, pink crystal
    decor: [
      ['#1aa39a', '#0f7d78', '#ffffff'],
      ['#b9c6e6', '#8f9cc4', '#ffffff'],
      ['#ff8fc4', '#ff5fa2', '#ffd6ea'],
    ],
  },
  canyon: {
    ground: '#f4ad6c',
    speck: ['#e99a58', '#f9c48f', '#de8c4c'],
    road: '#6a5878',
    edge: '#4a3b58',
    kerbA: '#ffd12e',
    kerbB: '#3d2a4a',
    // cactus, red rock, dry bush
    decor: [
      ['#4fb86a', '#2f9150', '#e8ffd8'],
      ['#d9653e', '#b44a2a', '#f08a5e'],
      ['#c9b25c', '#a8923e', '#e3cf7c'],
    ],
  },
  park: {
    ground: '#8fd46b',
    speck: ['#7cc65a', '#a5e083', '#6fb84e'],
    road: '#5d5f88',
    edge: '#3d3f66',
    kerbA: '#ff5a6c',
    kerbB: '#ffffff',
    // round tree, flower bed, hedge
    decor: [
      ['#2fa35a', '#1e8a48', '#7a5230'],
      ['#ff8fc4', '#ffd12e', '#ffffff'],
      ['#3cb36a', '#2a9555', '#5fcf86'],
    ],
  },
  candy: {
    ground: '#c9f2e3',
    speck: ['#ffd6ea', '#fff3b0', '#b8e9ff'],
    road: '#7a63b8',
    edge: '#563f94',
    kerbA: '#ff5fa2',
    kerbB: '#ffffff',
    // lollipop, gumdrop, candy rock
    decor: [
      ['#ff5fa2', '#ffffff', '#ffd12e'],
      ['#ff8a3d', '#ffd12e', '#ffffff'],
      ['#9a6bff', '#7a4fe0', '#c9b3ff'],
    ],
  },
};

const SURFACE_FILL: Record<Surface, string> = {
  asphalt: '#5b5a8f',
  boost: '#ffd12e',
  dirt: '#c88a50',
  gravel: '#b9b2a8',
  ice: '#c4ecff',
  grass: '#8fd46b',
  sand: '#f0c77a',
  snow: '#ffffff',
  mud: '#7b5233',
};


function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number): number => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

function pathFrom(pts: Vec[], closed: boolean): Path2D {
  const p = new Path2D();
  p.moveTo(pts[0]!.x, pts[0]!.y);
  for (let i = 1; i < pts.length; i++) p.lineTo(pts[i]!.x, pts[i]!.y);
  if (closed) p.closePath();
  return p;
}

/** Sub-path of a closed path between two lap fractions, with its bounding box. */
function slice(path: Path, from: number, to: number): { p: Path2D; box: Rect } {
  const L = path.length;
  const a = from * L;
  let b = to * L;
  if (b <= a) b += L;
  const pts: Vec[] = [];
  for (let s = a; s <= b; s += 10) pts.push(pointAt(path, s).p);
  pts.push(pointAt(path, b).p);
  return { p: pathFrom(pts, false), box: bboxOf(pts) };
}

interface Skid {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  a: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  r: number;
  color: string;
}

export interface Banner {
  /** Shown until renderer time `until`. */
  text: string;
  sub?: string;
  color: string;
  until: number;
}

export interface HudState {
  banner: Banner | null;
  /** Lap points popup etc. */
  popup: { text: string; until: number } | null;
  /** Previous best lap (for the HUD), seconds. */
  best: number | null;
  /** The latest sector split vs the reference (negative = faster), or a sector time with no reference. */
  split: { sector: number; delta: number | null; time: number; until: number } | null;
  /** Colour of each sector this lap: 'green' faster than the reference, 'red' slower, 'done' no reference. */
  sectors: ('green' | 'red' | 'done' | null)[];
  attract: boolean;
  touch: boolean;
}

export function fmtTime(t: number | null): string {
  if (t === null || !Number.isFinite(t)) return '--:--.--';
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`;
}

/** World units per second to km/h for the speedometer (toy scale: top speed ~160 km/h). */
export const KMH = 160 / CAR.maxSpeed;

const SKID_MAX = 700;

/** Pop-up rows in the HUD lane. */
const TOAST_H = 28;
const TOAST_GAP = 6;

/**
 * The fixed HUD lane for pop-ups (just below the lap timer and sector chips), and the band the car
 * must stay inside so neither the lane nor the speedometer ever covers it.
 */
export function hudLane(w: number, h: number): { top: number; height: number; carMinY: number; carMaxY: number } {
  const small = w < 520;
  const pad = small ? 10 : 16;
  const top = pad + (small ? 52 : 62) + 22;
  const height = TOAST_H * 2 + TOAST_GAP;
  const carHalf = 30; // half the car's on-screen size plus a margin
  const speedo = (small ? 44 : 54) + 8 + pad;
  return { top, height, carMinY: top + height + carHalf, carMaxY: h - speedo - carHalf };
}
const PART_MAX = 140;

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  w = 1;
  h = 1;
  dpr = 1;
  private track: Track | null = null;
  private theme: Theme = THEMES.bay;
  /** The road and walls are cut into chunks; only the stretches near the camera are stroked. */
  private road: PolyCull | null = null;
  private kerbs: { p: Path2D; box: Rect }[] = [];
  private walls: PolyCull[] = [];
  private zones: { p: Path2D; box: Rect; surface: Surface }[] = [];
  private shortcut: { p: Path2D; box: Rect } | null = null;
  private mini: { path: Path2D; scale: number; ox: number; oy: number; w: number; h: number } | null = null;
  private pattern: CanvasPattern | null = null;
  private skids: Skid[] = [];
  private skidHead = 0;
  private parts: Particle[] = [];
  private cam = { x: 0, y: 0, z: 1 };
  private camInit = false;
  private wheelPrev: Vec[] | null = null;
  /** The player's car (shape and colours). */
  car: Pick<CarDef, 'shape' | 'body' | 'accent'> = { shape: 'coupe', body: '#ff5a6c', accent: '#fff6e6' };
  private surfacePatterns = new Map<Surface, CanvasPattern | string>();
  private time = 0;

  /** Seconds of drawing so far (banner timers use it). */
  get now(): number {
    return this.time;
  }

  /** False when the browser gives no 2D context (then nothing is drawn, but the game still runs). */
  private readonly ok: boolean;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    this.ok = ctx !== null;
    this.ctx = ctx as CanvasRenderingContext2D;
  }

  resize(w: number, h: number, dpr: number): void {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.dpr = dpr;
    // Assigning a canvas size reallocates and clears it even when it doesn't change, so skip no-ops
    // (iOS fires resize observers as the toolbar slides).
    const cw = Math.round(this.w * dpr);
    const ch = Math.round(this.h * dpr);
    if (this.canvas.width !== cw) this.canvas.width = cw;
    if (this.canvas.height !== ch) this.canvas.height = ch;
  }

  setTrack(track: Track): void {
    if (this.track === track) return;
    this.track = track;
    this.theme = THEMES[track.def.theme];
    if (!this.ok) return;
    this.road = new PolyCull(track.path.pts, true);
    this.zones = track.zones.map((z) => ({ ...slice(track.path, z.from, z.to), surface: z.surface }));
    this.shortcut = track.shortcut ? { p: pathFrom(track.shortcut.path.pts, false), box: bboxOf(track.shortcut.path.pts) } : null;
    this.kerbs = this.buildKerbs(track.path);
    this.walls = track.walls.filter((run) => run.length > 1).map((run) => new PolyCull(run, false));
    this.pattern = this.buildPattern();
    this.skids = [];
    this.skidHead = 0;
    this.parts = [];
    this.camInit = false;
    this.wheelPrev = null;
    // Minimap
    const { minX, minY, maxX, maxY } = track.bounds;
    const bw = maxX - minX;
    const bh = maxY - minY;
    const scale = 96 / Math.max(bw, bh);
    this.mini = { path: pathFrom(track.path.pts, true), scale, ox: minX, oy: minY, w: bw * scale, h: bh * scale };
  }

  /** Kerbs only where the road bends, like a real circuit: one path per bend, so each can be culled. */
  private buildKerbs(path: Path): { p: Path2D; box: Rect }[] {
    const n = path.pts.length;
    const curv = path.tan.map((_, i) => {
      const u = path.tan[(i + 3) % n]!;
      const v = path.tan[(i - 3 + n) % n]!;
      return Math.abs(v.x * u.y - v.y * u.x);
    });
    const out: { p: Path2D; box: Rect }[] = [];
    let run: Vec[] = [];
    const flush = (): void => {
      if (run.length > 1) out.push({ p: pathFrom(run, false), box: bboxOf(run) });
      run = [];
    };
    for (let i = 0; i <= n; i++) {
      if (curv[i % n]! > 0.22) run.push(path.pts[i % n]!);
      else flush();
    }
    flush();
    return out;
  }

  private buildPattern(): CanvasPattern | null {
    if (!this.ok) return null;
    const c = document.createElement('canvas');
    c.width = c.height = 160;
    const g = c.getContext('2d');
    if (!g) return null;
    g.fillStyle = this.theme.ground;
    g.fillRect(0, 0, 160, 160);
    let seed = 7;
    const r = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 70; i++) {
      g.fillStyle = this.theme.speck[i % this.theme.speck.length]!;
      const x = r() * 160;
      const y = r() * 160;
      const s = 2 + r() * 5;
      g.beginPath();
      // little low-poly triangles
      g.moveTo(x, y - s);
      g.lineTo(x + s, y + s * 0.7);
      g.lineTo(x - s, y + s * 0.7);
      g.closePath();
      g.fill();
    }
    return this.ctx.createPattern(c, 'repeat');
  }

  /** Draws a frame. `alpha` interpolates between the last two physics steps. */
  draw(sim: RaceSim, alpha: number, dt: number, hud: HudState): void {
    const ctx = this.ctx;
    const track = this.track;
    if (!track || !this.ok) return;
    this.time += dt;
    const car = sim.car;
    const pose: Pose = {
      x: sim.prev.x + (car.x - sim.prev.x) * alpha,
      y: sim.prev.y + (car.y - sim.prev.y) * alpha,
      a: sim.prev.a + (car.a - sim.prev.a) * alpha,
    };
    const speed = speedOf(car);

    // Camera: lead the car a little, zoom out with speed; the attract mode shows more of the track.
    const minDim = Math.min(this.w, this.h);
    const base = Math.max(0.5, Math.min(1.35, minDim / (hud.attract ? 760 : 520)));
    const zTarget = base * (1 - Math.min(0.14, speed / 3200));
    const lx = pose.x + car.vx * 0.32;
    // Menu: keep the car in the top third, above the sheet.
    const ly = pose.y + car.vy * 0.32 + (hud.attract ? (this.h * 0.3) / zTarget : 0);
    if (!this.camInit) {
      this.cam = { x: lx, y: ly, z: zTarget };
      this.camInit = true;
    }
    const k = 1 - Math.exp(-dt * 6);
    this.cam.x += (lx - this.cam.x) * k;
    this.cam.y += (ly - this.cam.y) * k;
    this.cam.z += (zTarget - this.cam.z) * (1 - Math.exp(-dt * 2));
    const z = this.cam.z;
    if (!hud.attract) {
      // Keep the car between the pop-up lane and the speedometer, whatever the camera lead does.
      const band = hudLane(this.w, this.h);
      const carY = this.h / 2 + (pose.y - this.cam.y) * z;
      if (band.carMaxY > band.carMinY) {
        if (carY < band.carMinY) this.cam.y = pose.y - (band.carMinY - this.h / 2) / z;
        else if (carY > band.carMaxY) this.cam.y = pose.y - (band.carMaxY - this.h / 2) / z;
      }
    }
    const d = this.dpr;
    ctx.setTransform(d * z, 0, 0, d * z, d * (this.w / 2 - this.cam.x * z), d * (this.h / 2 - this.cam.y * z));
    const view = {
      minX: this.cam.x - this.w / 2 / z - 80,
      maxX: this.cam.x + this.w / 2 / z + 80,
      minY: this.cam.y - this.h / 2 / z - 80,
      maxY: this.cam.y + this.h / 2 / z + 80,
    };

    // Ground
    ctx.fillStyle = this.pattern ?? this.theme.ground;
    ctx.fillRect(view.minX, view.minY, view.maxX - view.minX, view.maxY - view.minY);
    this.drawRoad(track, sim, view);
    this.updateSkids(sim, pose);
    this.drawSkids(view);
    this.drawWalls(view);
    this.drawObstacles(track.obstacles, view);
    this.drawDecor(track, view);

    // Ghost, rivals, then player.
    const gp = sim.ghostPose();
    if (gp) this.drawCar(gp, { shape: this.car.shape, body: '#ffffff', accent: '#ffffff' }, 0, 0.42, true);
    for (const rv of sim.rivals) {
      const c = rv.car;
      if (c.x < view.minX || c.x > view.maxX || c.y < view.minY || c.y > view.maxY) continue;
      const rp = { x: rv.prev.x + (c.x - rv.prev.x) * alpha, y: rv.prev.y + (c.y - rv.prev.y) * alpha, a: rv.prev.a + (c.a - rv.prev.a) * alpha };
      this.drawCar(rp, rv.look, Math.max(-1, Math.min(1, c.av / 3)), 1, false, c.boost > 0);
    }
    this.updateParticles(sim, pose, dt);
    this.drawParticles();
    const steerVis = Math.max(-1, Math.min(1, car.av / 3));
    this.drawCar(pose, this.car, steerVis, 1, false, car.boost > 0);

    ctx.setTransform(d, 0, 0, d, 0, 0);
    if (!hud.attract) this.drawHud(sim, hud);
  }

  /** Tyre walls: a shadow, a dark base and alternating coloured tyre stacks. */
  private drawWalls(view: Rect): void {
    const ctx = this.ctx;
    const t = this.theme;
    const pad = WALL_HALF + 8;
    const vis = this.walls.map((w) => w.visible(view, pad)).filter((v) => !v.empty);
    if (!vis.length) return;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.save();
    ctx.translate(3, 4);
    ctx.strokeStyle = 'rgba(30,15,50,0.22)';
    ctx.lineWidth = WALL_HALF * 2 + 2;
    for (const v of vis) ctx.stroke(v.union);
    ctx.restore();
    ctx.strokeStyle = '#1b1035';
    ctx.lineWidth = WALL_HALF * 2 + 2;
    for (const v of vis) ctx.stroke(v.union);
    ctx.lineCap = 'butt';
    ctx.strokeStyle = t.kerbB;
    ctx.lineWidth = WALL_HALF * 2 - 3;
    for (const v of vis) ctx.stroke(v.union);
    ctx.setLineDash([14, 14]);
    ctx.strokeStyle = t.kerbA;
    for (const v of vis)
      for (const part of v.parts) {
        ctx.lineDashOffset = part.offset;
        ctx.stroke(part.path);
      }
    ctx.lineDashOffset = 0;
    ctx.setLineDash([]);
    ctx.lineCap = 'round';
  }

  /** A textured fill per surface so each one reads at a glance (pebbles, ripples, glaze...). */
  private surfaceStyle(s: Surface): CanvasPattern | string {
    const cached = this.surfacePatterns.get(s);
    if (cached) return cached;
    const base = SURFACE_FILL[s];
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    let style: CanvasPattern | string = base;
    if (g) {
      g.fillStyle = base;
      g.fillRect(0, 0, 64, 64);
      let seed = s.length * 977;
      const r = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      if (s === 'gravel' || s === 'dirt') {
        // pebbles
        for (let i = 0; i < (s === 'gravel' ? 46 : 22); i++) {
          g.fillStyle = r() < 0.5 ? shade(base, -0.22) : shade(base, 0.25);
          g.beginPath();
          g.arc(r() * 64, r() * 64, s === 'gravel' ? 1.4 + r() * 2.2 : 1 + r() * 1.5, 0, Math.PI * 2);
          g.fill();
        }
      } else if (s === 'sand' || s === 'snow') {
        // wind ripples
        g.strokeStyle = shade(base, s === 'snow' ? -0.06 : -0.12);
        g.lineWidth = 2;
        for (let y = 6; y < 64; y += 12) {
          g.beginPath();
          g.moveTo(0, y);
          g.quadraticCurveTo(16, y - 4, 32, y);
          g.quadraticCurveTo(48, y + 4, 64, y);
          g.stroke();
        }
      } else if (s === 'mud') {
        for (let i = 0; i < 8; i++) {
          g.fillStyle = shade(base, -0.2);
          g.beginPath();
          g.ellipse(r() * 64, r() * 64, 4 + r() * 5, 2 + r() * 3, r() * 3, 0, Math.PI * 2);
          g.fill();
        }
      } else if (s === 'grass') {
        g.strokeStyle = shade(base, -0.18);
        g.lineWidth = 1.5;
        for (let i = 0; i < 30; i++) {
          const x = r() * 64;
          const y = r() * 64;
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x + 1.5, y - 4);
          g.stroke();
        }
      } else if (s === 'ice') {
        g.strokeStyle = 'rgba(255,255,255,0.75)';
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(-10, 54);
        g.lineTo(54, -10);
        g.moveTo(22, 74);
        g.lineTo(74, 22);
        g.stroke();
      }
      style = this.ctx.createPattern(c, 'repeat') ?? base;
    }
    this.surfacePatterns.set(s, style);
    return style;
  }

  private drawRoad(track: Track, sim: RaceSim, view: Rect): void {
    const ctx = this.ctx;
    const t = this.theme;
    const W = track.def.width;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // Shortcut under the main road so the join looks tidy.
    if (this.shortcut && track.shortcut && overlaps(this.shortcut.box, view, track.shortcut.half + 20)) {
      const sc = this.shortcut.p;
      ctx.strokeStyle = 'rgba(60,40,70,0.25)';
      ctx.lineWidth = track.shortcut.half * 2 + 14;
      ctx.stroke(sc);
      ctx.strokeStyle = this.surfaceStyle(track.shortcut.surface);
      ctx.lineWidth = track.shortcut.half * 2;
      ctx.stroke(sc);
      ctx.setLineDash([6, 22]);
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 3;
      ctx.stroke(sc);
      ctx.setLineDash([]);
    }
    const vis = this.road!.visible(view, W / 2 + KERB + 16);
    if (!vis.empty) {
      const road = vis.union;
      // Soft shadow + dark edge
      ctx.strokeStyle = 'rgba(40,20,60,0.18)';
      ctx.lineWidth = W + KERB * 2 + 26;
      ctx.stroke(road);
      ctx.strokeStyle = t.edge;
      ctx.lineWidth = W + KERB * 2 + 4;
      ctx.stroke(road);
      // White edge line, kerbs on bends
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = W + KERB * 2;
      ctx.stroke(road);
      ctx.lineCap = 'butt';
      const kerbPad = W / 2 + KERB + 8;
      for (const k of this.kerbs) {
        if (!overlaps(k.box, view, kerbPad)) continue;
        ctx.strokeStyle = t.kerbA;
        ctx.stroke(k.p);
        ctx.setLineDash([22, 22]);
        ctx.strokeStyle = t.kerbB;
        ctx.stroke(k.p);
        ctx.setLineDash([]);
      }
      ctx.lineCap = 'round';
      ctx.strokeStyle = t.road;
      ctx.lineWidth = W;
      ctx.stroke(road);
      ctx.lineCap = 'butt';
      for (const z of this.zones) {
        if (!overlaps(z.box, view, W / 2 + 8)) continue;
        ctx.strokeStyle = this.surfaceStyle(z.surface);
        ctx.stroke(z.p);
      }
      ctx.lineCap = 'round';
      // Centre dashes (each stretch keeps its place in the dash pattern).
      ctx.setLineDash([26, 38]);
      ctx.strokeStyle = 'rgba(255,255,255,0.32)';
      ctx.lineWidth = 3;
      for (const part of vis.parts) {
        ctx.lineDashOffset = part.offset;
        ctx.stroke(part.path);
      }
      ctx.lineDashOffset = 0;
      ctx.setLineDash([]);
    }

    // Patches
    for (const p of track.patches) {
      if (p.c.x < view.minX - p.len || p.c.x > view.maxX + p.len || p.c.y < view.minY - p.len || p.c.y > view.maxY + p.len) continue;
      ctx.save();
      ctx.translate(p.c.x, p.c.y);
      ctx.rotate(Math.atan2(p.t.y, p.t.x));
      if (p.surface === 'boost') {
        ctx.fillStyle = '#ffd12e';
        roundRect(ctx, -p.len / 2, -p.wide / 2, p.len, p.wide, 8);
        ctx.fill();
        ctx.fillStyle = '#ff6a1a';
        const pulse = (this.time * 2) % 1;
        for (let i = 0; i < 3; i++) {
          const x = -p.len / 2 + 10 + i * 18 + pulse * 6;
          ctx.beginPath();
          ctx.moveTo(x, -p.wide / 2 + 8);
          ctx.lineTo(x + 12, 0);
          ctx.lineTo(x, p.wide / 2 - 8);
          ctx.lineTo(x + 6, 0);
          ctx.closePath();
          ctx.fill();
        }
      } else {
        ctx.fillStyle = SURFACE_FILL[p.surface];
        ctx.beginPath();
        ctx.ellipse(0, 0, p.len / 2, p.wide / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.beginPath();
        ctx.ellipse(-p.len * 0.12, -p.wide * 0.12, p.len * 0.22, p.wide * 0.16, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Start line (checkered) and checkpoint posts.
    const sl = pointAt(track.path, 0);
    const n = leftOf(sl.t);
    ctx.save();
    ctx.translate(sl.p.x, sl.p.y);
    ctx.rotate(Math.atan2(n.y, n.x));
    const cells = 10;
    const cw = W / cells;
    for (let i = 0; i < cells; i++) {
      for (let j = 0; j < 2; j++) {
        ctx.fillStyle = (i + j) % 2 ? '#1b1035' : '#ffffff';
        ctx.fillRect(-W / 2 + i * cw, -cw + j * cw, cw, cw);
      }
    }
    ctx.restore();
    const lap = sim.lap;
    track.checkpoints.forEach((cp, k) => {
      if (k === 0) return;
      const passed = lap.started && k < lap.next;
      for (const g of cp.gates) {
        for (const e of [g.a, g.b]) {
          if (e.x < view.minX || e.x > view.maxX || e.y < view.minY || e.y > view.maxY) continue;
          ctx.fillStyle = 'rgba(30,15,50,0.25)';
          ctx.beginPath();
          ctx.arc(e.x + 3, e.y + 4, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = passed ? '#c4f034' : k === lap.next ? '#ffffff' : '#ffd12e';
          ctx.beginPath();
          ctx.arc(e.x, e.y, 6.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#1b1035';
          ctx.stroke();
        }
      }
    });
  }

  private updateSkids(sim: RaceSim, pose: Pose): void {
    const car = sim.car;
    const { fwd, side } = localVelocity(car);
    const c = Math.cos(pose.a);
    const s = Math.sin(pose.a);
    const wheels = [-1, 1].map((sd) => ({ x: pose.x - c * 11 - s * 8 * sd, y: pose.y - s * 11 + c * 8 * sd }));
    const sliding = (Math.abs(side) > 45 && Math.abs(fwd) > 60) || (sim.ground.surface === 'ice' && Math.abs(side) > 25);
    if (sliding && this.wheelPrev && sim.ground.onRoad) {
      const strength = Math.min(1, Math.abs(side) / 160);
      for (let i = 0; i < 2; i++) {
        const p = this.wheelPrev[i]!;
        const q = wheels[i]!;
        if (Math.hypot(q.x - p.x, q.y - p.y) < 0.5) continue;
        const skid: Skid = { x1: p.x, y1: p.y, x2: q.x, y2: q.y, a: 0.12 + strength * 0.22 };
        if (this.skids.length < SKID_MAX) this.skids.push(skid);
        else {
          this.skids[this.skidHead] = skid;
          this.skidHead = (this.skidHead + 1) % SKID_MAX;
        }
      }
    }
    this.wheelPrev = wheels;
  }

  private drawSkids(view: { minX: number; maxX: number; minY: number; maxY: number }): void {
    const ctx = this.ctx;
    ctx.lineCap = 'round';
    ctx.lineWidth = 4.5;
    ctx.strokeStyle = this.track?.def.theme === 'frost' ? 'rgba(70,90,150,0.5)' : 'rgba(35,20,45,0.55)';
    ctx.beginPath();
    for (const s of this.skids) {
      if (s.x1 < view.minX || s.x1 > view.maxX || s.y1 < view.minY || s.y1 > view.maxY) continue;
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
    }
    ctx.globalAlpha = 0.5;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  private updateParticles(sim: RaceSim, pose: Pose, dt: number): void {
    const car = sim.car;
    const sp = speedOf(car);
    const { side } = localVelocity(car);
    const c = Math.cos(pose.a);
    const s = Math.sin(pose.a);
    const offroad = !sim.ground.onRoad || sim.ground.surface === 'dirt' || sim.ground.surface === 'mud' || sim.ground.surface === 'snow' || sim.ground.surface === 'sand';
    const emit = (color: string, r: number, life: number, spread: number): void => {
      const p: Particle = {
        x: pose.x - c * 16 + (Math.random() - 0.5) * 12,
        y: pose.y - s * 16 + (Math.random() - 0.5) * 12,
        vx: -car.vx * 0.15 + (Math.random() - 0.5) * spread,
        vy: -car.vy * 0.15 + (Math.random() - 0.5) * spread,
        life,
        max: life,
        r,
        color,
      };
      if (this.parts.length < PART_MAX) this.parts.push(p);
    };
    if (sp > 80 && (offroad || Math.abs(side) > 70) && Math.random() < dt * 40) {
      const color = sim.ground.surface === 'snow' || sim.ground.surface === 'ice' ? '#ffffff' : offroad ? '#e8c48a' : '#e9e4f5';
      emit(color, 6 + Math.random() * 6, 0.6, 60);
    }
    if (car.boost > 0 && Math.random() < dt * 50) emit(Math.random() < 0.5 ? '#ffd12e' : '#ff6a1a', 4 + Math.random() * 3, 0.3, 30);
    // Update and drop dead puffs in place (no new array every frame).
    let keep = 0;
    for (const p of this.parts) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.r += dt * 10;
      if (p.life > 0) this.parts[keep++] = p;
    }
    this.parts.length = keep;
  }

  private drawParticles(): void {
    const ctx = this.ctx;
    for (const p of this.parts) {
      ctx.globalAlpha = Math.max(0, p.life / p.max) * 0.7;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      // hexagon puffs keep the low-poly feel
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const x = p.x + Math.cos(a) * p.r;
        const y = p.y + Math.sin(a) * p.r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawObstacles(list: Obstacle[], view: { minX: number; maxX: number; minY: number; maxY: number }): void {
    const ctx = this.ctx;
    for (const o of list) {
      if (o.x < view.minX || o.x > view.maxX || o.y < view.minY || o.y > view.maxY) continue;
      ctx.save();
      ctx.translate(o.x, o.y);
      ctx.fillStyle = 'rgba(30,15,50,0.25)';
      ctx.beginPath();
      ctx.arc(4, 5, o.r, 0, Math.PI * 2);
      ctx.fill();
      if (o.kind === 'tires') {
        for (const [dx, dy, col] of [
          [-o.r * 0.45, -o.r * 0.3, '#2a2340'],
          [o.r * 0.45, -o.r * 0.3, '#2a2340'],
          [0, o.r * 0.45, '#2a2340'],
        ] as const) {
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.arc(dx, dy, o.r * 0.62, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ff5a6c';
          ctx.beginPath();
          ctx.arc(dx, dy, o.r * 0.34, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#1b1035';
          ctx.beginPath();
          ctx.arc(dx, dy, o.r * 0.18, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (o.kind === 'rock') {
        lowPolyBlob(ctx, o.r, o.x * 7 + o.y, ['#9a8aa8', '#7c6c8c', '#c2b5cc']);
      } else if (o.kind === 'crate') {
        ctx.rotate(o.x * 0.01);
        ctx.fillStyle = '#c9843e';
        ctx.fillRect(-o.r, -o.r, o.r * 2, o.r * 2);
        ctx.fillStyle = '#e3a35e';
        ctx.beginPath();
        ctx.moveTo(-o.r, -o.r);
        ctx.lineTo(o.r, -o.r);
        ctx.lineTo(-o.r, o.r);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#7a4a22';
        ctx.lineWidth = 3;
        ctx.strokeRect(-o.r, -o.r, o.r * 2, o.r * 2);
      } else {
        // cone
        ctx.fillStyle = '#ff6a1a';
        ctx.beginPath();
        ctx.arc(0, 0, o.r * 0.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, o.r * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ff6a1a';
        ctx.beginPath();
        ctx.arc(0, 0, o.r * 0.28, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private drawDecor(track: Track, view: { minX: number; maxX: number; minY: number; maxY: number }): void {
    const ctx = this.ctx;
    const theme = track.def.theme;
    for (const dcr of track.decor) {
      if (dcr.x < view.minX || dcr.x > view.maxX || dcr.y < view.minY || dcr.y > view.maxY) continue;
      const pal = this.theme.decor[dcr.kind]!;
      const r = 26 * dcr.s;
      ctx.save();
      ctx.translate(dcr.x, dcr.y);
      ctx.fillStyle = 'rgba(30,15,50,0.18)';
      ctx.beginPath();
      ctx.ellipse(r * 0.35, r * 0.45, r, r * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.rotate(dcr.rot);
      if (dcr.kind === 0 && theme === 'park') {
        // round, faceted tree canopy
        for (const [dx, dy, rr, col] of [
          [r * 0.25, r * 0.2, r * 0.75, pal[1]!],
          [-r * 0.2, r * 0.1, r * 0.7, pal[1]!],
          [0, -r * 0.15, r * 0.72, pal[0]!],
        ] as const) {
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.arc(dx, dy, rr, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.beginPath();
        ctx.arc(-r * 0.2, -r * 0.35, r * 0.3, 0, Math.PI * 2);
        ctx.fill();
      } else if (dcr.kind === 0 && theme === 'candy') {
        // lollipop swirl
        ctx.fillStyle = pal[1]!;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = pal[0]!;
        ctx.lineWidth = r * 0.16;
        ctx.beginPath();
        for (let k = 0; k < 40; k++) {
          const ang = k * 0.45;
          const rr = (k / 40) * r * 0.72;
          if (k === 0) ctx.moveTo(0, 0);
          else ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
        }
        ctx.stroke();
      } else if (dcr.kind === 0) {
        // star-shaped canopy (palm / pine / cactus)
        const spikes = theme === 'canyon' ? 4 : theme === 'frost' ? 7 : 6;
        ctx.fillStyle = pal[1]!;
        star(ctx, r, r * (theme === 'frost' ? 0.6 : 0.38), spikes);
        ctx.fill();
        ctx.fillStyle = pal[0]!;
        star(ctx, r * 0.8, r * 0.3, spikes);
        ctx.fill();
        ctx.fillStyle = pal[2]!;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.16, 0, Math.PI * 2);
        ctx.fill();
      } else if (dcr.kind === 1 && theme === 'bay') {
        // beach umbrella
        for (let i = 0; i < 8; i++) {
          ctx.fillStyle = i % 2 ? pal[0]! : pal[1]!;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, r * 0.8, (i / 8) * Math.PI * 2, ((i + 1) / 8) * Math.PI * 2);
          ctx.closePath();
          ctx.fill();
        }
        ctx.fillStyle = pal[2]!;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.12, 0, Math.PI * 2);
        ctx.fill();
      } else {
        lowPolyBlob(ctx, r * 0.75, dcr.x + dcr.y * 3, pal);
      }
      ctx.restore();
    }
  }

  /** A cute low-poly car: faceted body, glass, chunky wheels, ink outline. Five body shapes. */
  drawCar(p: Pose, look: Pick<CarDef, 'shape' | 'body' | 'accent'>, steer: number, alpha: number, ghost: boolean, boosting = false): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.a);
    ctx.scale(1.25, 1.25);
    ctx.globalAlpha = alpha;
    drawCarBody(ctx, look.shape, look.body, look.accent, steer, ghost);
    if (boosting) {
      ctx.fillStyle = '#ffd12e';
      ctx.beginPath();
      ctx.moveTo(-20, -4);
      ctx.lineTo(-30 - Math.random() * 6, 0);
      ctx.lineTo(-20, 4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  private drawHud(sim: RaceSim, hud: HudState): void {
    const ctx = this.ctx;
    const W = this.w;
    const H = this.h;
    const small = W < 520;
    const pad = small ? 10 : 16;
    const font = (size: number, weight = 800): string => `${weight} ${size}px Bricolage, "Avenir Next", system-ui, sans-serif`;
    const mono = (size: number): string => `700 ${size}px "Space Mono", ui-monospace, monospace`;

    // Top-left: lap counter
    const lap = sim.lap;
    const lapText = `${Math.min(RACE_LAPS, lap.laps.length + 1)}/${RACE_LAPS}`;
    const race = sim.mode === 'race';
    const label = race ? `LAP ${lapText}` : 'LAP';
    const value = race ? `P${sim.position}/${sim.racers.length}` : lapText;
    pill(ctx, pad, pad, small ? 78 : 96, small ? 46 : 54, '#ffffff');
    ctx.fillStyle = '#6b5b95';
    ctx.font = mono(small ? 9 : 10);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(label, pad + 10, pad + 7);
    ctx.fillStyle = '#1b1035';
    ctx.font = font(small ? 22 : 26);
    ctx.fillText(value, pad + 10, pad + (small ? 18 : 20));

    // Top-centre: current lap time (or drift total)
    const cx = W / 2;
    const bw = small ? 128 : 168;
    pill(ctx, cx - bw / 2, pad, bw, small ? 46 : 54, '#1b1035');
    ctx.textAlign = 'center';
    ctx.fillStyle = '#c4f034';
    ctx.font = mono(small ? 9 : 10);
    ctx.fillText('LAP TIME', cx, pad + 7);
    ctx.fillStyle = '#ffffff';
    ctx.font = mono(small ? 19 : 24);
    const lastLap = lap.laps[lap.laps.length - 1];
    const shown = sim.finished && lastLap ? lastLap.time : sim.time < 0 ? 0 : sim.lapTime;
    ctx.fillText(fmtTime(shown), cx, pad + (small ? 19 : 21));

    // Top-right: best lap + minimap
    {
      const rw = small ? 86 : 108;
      pill(ctx, W - pad - rw, pad, rw, small ? 46 : 54, '#ffffff');
      ctx.textAlign = 'right';
      ctx.fillStyle = '#6b5b95';
      ctx.font = mono(small ? 9 : 10);
      ctx.fillText('BEST', W - pad - 10, pad + 7);
      ctx.fillStyle = '#1b1035';
      ctx.font = mono(small ? 13 : 16);
      ctx.fillText(fmtTime(hud.best), W - pad - 10, pad + (small ? 22 : 25));
    }
    this.drawMinimap(sim, W - pad - (this.mini?.w ?? 0), pad + (small ? 54 : 64));

    this.drawSpeedo(sim, cx, H - pad);

    // How to steer, shown through the countdown and the first moments of the race.
    if (sim.time < 2.5) {
      const fade = sim.time < 1.5 ? 1 : Math.max(0, (2.5 - sim.time) / 1);
      ctx.globalAlpha = fade;
      const bw3 = small ? 104 : 124;
      const y = H - pad - 40;
      const [l, rt] = hud.touch ? ['◀  HOLD', 'HOLD  ▶'] : ['◀  A', 'D  ▶'];
      pill(ctx, pad, y, bw3, 34, '#ffffff');
      pill(ctx, W - pad - bw3, y, bw3, 34, '#ffffff');
      ctx.fillStyle = '#1b1035';
      ctx.font = font(small ? 14 : 16);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(l, pad + bw3 / 2, y + 17);
      ctx.fillText(rt, W - pad - bw3 / 2, y + 17);
      ctx.textBaseline = 'top';
      ctx.globalAlpha = 1;
    }

    // Sector chips under the timer.
    const sy = pad + (small ? 52 : 62);
    const cw = small ? 36 : 44;
    for (let i = 0; i < 3; i++) {
      const st = hud.sectors[i];
      const x = cx - (cw * 3 + 8) / 2 + i * (cw + 4);
      ctx.fillStyle = st === 'green' ? '#2fcf72' : st === 'red' ? '#ff5a6c' : st === 'done' ? '#ffffff' : 'rgba(255,255,255,0.55)';
      roundRect(ctx, x, sy, cw, 16, 6);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#1b1035';
      ctx.stroke();
      ctx.fillStyle = '#1b1035';
      ctx.font = mono(9);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`S${i + 1}`, x + cw / 2, sy + 8.5);
    }

    // The pop-up lane: a fixed spot under the sector chips, centred, two rows. Nothing pops up over
    // the car (the camera keeps the car below this lane and above the speedometer).
    const lane = hudLane(this.w, this.h);
    const now = this.time;
    const fade = (until: number): number => (until === Infinity ? 1 : Math.max(0, Math.min(1, (until - now) / 0.2)));
    const toast = (row: number, text: string, fill: string, alpha: number, sub?: string, useMono = false): void => {
      if (alpha <= 0) return;
      const y = lane.top + row * (TOAST_H + TOAST_GAP);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = useMono ? mono(small ? 13 : 15) : font(small ? 14 : 16);
      const main = ctx.measureText(text).width;
      ctx.font = font(small ? 10 : 11, 600);
      const extra = sub ? ctx.measureText(sub).width + 10 : 0;
      const w = Math.min(this.w - pad * 2, Math.max(small ? 110 : 130, main + extra + 28));
      pill(ctx, cx - w / 2, y, w, TOAST_H, fill);
      ctx.fillStyle = '#1b1035';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      let x = cx - (main + extra) / 2;
      ctx.font = useMono ? mono(small ? 13 : 15) : font(small ? 14 : 16);
      ctx.fillText(text, x, y + TOAST_H / 2 + 1);
      if (sub) {
        x += main + 10;
        ctx.font = font(small ? 10 : 11, 600);
        ctx.fillText(sub, x, y + TOAST_H / 2 + 1);
      }
      ctx.restore();
    };

    // Row 0: banners (finish, wrong way, missed checkpoint, best lap...) win over the sector split.
    const banner = sim.finished
      ? { text: 'FINISH!', color: '#c4f034', until: Infinity }
      : sim.wrongWay > 0.8
        ? { text: 'WRONG WAY', sub: 'Turn around', color: '#ff5a6c', until: Infinity }
        : hud.banner;
    const sp = hud.split;
    if (banner && now < banner.until) toast(0, banner.text, banner.color, fade(banner.until), banner.sub);
    else if (sp && now < sp.until) {
      const txt = sp.delta === null ? `S${sp.sector + 1} ${sp.time.toFixed(2)}` : `S${sp.sector + 1} ${sp.delta <= 0 ? '−' : '+'}${Math.abs(sp.delta).toFixed(2)}`;
      toast(0, txt, sp.delta === null ? '#ffffff' : sp.delta <= 0 ? '#2fcf72' : '#ff5a6c', fade(sp.until), undefined, true);
    }

    // Row 1: the live drift chain, else the latest pop-up (lap time, drift banked, turbo...).
    const d = sim.drift;
    if (d.chain > 1) {
      const mult = 1 + Math.min(3, Math.floor(d.chainTime / 1.5));
      toast(1, `DRIFT ${Math.round(d.chain)}`, '#ffd12e', 1, mult > 1 ? `x${mult}` : undefined);
    } else if (hud.popup && now < hud.popup.until) toast(1, hud.popup.text, '#c4f034', fade(hud.popup.until));

    // Countdown, in the lane too (small and short, so the grid stays visible).
    if (sim.time < 0.6) {
      const left = -sim.time;
      const step = COUNTDOWN / 3;
      const txt = sim.time >= 0 ? 'GO!' : String(Math.ceil(left / step));
      const frac = sim.time >= 0 ? sim.time / 0.6 : 1 - ((left / step) % 1);
      ctx.save();
      ctx.translate(cx, lane.top + lane.height / 2);
      const s = 1 + 0.25 * (1 - Math.min(1, frac * 4));
      ctx.scale(s, s);
      ctx.globalAlpha = sim.time >= 0 ? 1 - frac : 1;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = font(small ? 44 : 56);
      ctx.lineWidth = 8;
      ctx.strokeStyle = '#1b1035';
      ctx.strokeText(txt, 0, 0);
      ctx.fillStyle = sim.time >= 0 ? '#c4f034' : '#ffffff';
      ctx.fillText(txt, 0, 0);
      ctx.restore();
    }
    ctx.textBaseline = 'top';
  }

  /** km/h gauge at the bottom centre. Top speed on asphalt reads about 160 km/h. */
  private drawSpeedo(sim: RaceSim, cx: number, bottom: number): void {
    const ctx = this.ctx;
    const kmh = Math.round(speedOf(sim.car) * KMH);
    const max = Math.round(CAR.maxSpeed * 1.4 * KMH);
    const r = this.w < 520 ? 44 : 54;
    const cy = bottom - r * 0.32;
    const a0 = Math.PI * 1.08;
    const a1 = Math.PI * 1.92;
    // dial
    ctx.fillStyle = '#1b1035';
    ctx.beginPath();
    ctx.arc(cx + 3, cy + 3, r + 8, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy, r + 8, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#1b1035';
    ctx.stroke();
    ctx.lineCap = 'round';
    ctx.lineWidth = 7;
    ctx.strokeStyle = '#e9e1ff';
    ctx.beginPath();
    ctx.arc(cx, cy, r - 4, a0, a1);
    ctx.stroke();
    const f = Math.min(1, kmh / max);
    ctx.strokeStyle = sim.car.boost > 0 ? '#ffd12e' : f > 0.8 ? '#ff5a6c' : '#c4f034';
    ctx.beginPath();
    ctx.arc(cx, cy, r - 4, a0, a0 + (a1 - a0) * Math.max(0.001, f));
    ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.fillStyle = '#1b1035';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `700 ${this.w < 520 ? 20 : 24}px "Space Mono", ui-monospace, monospace`;
    ctx.fillText(String(kmh), cx, cy - 13);
    ctx.font = '700 9px "Space Mono", ui-monospace, monospace';
    ctx.fillStyle = '#6b5b95';
    ctx.fillText('KM/H', cx, cy - 2);
    ctx.textBaseline = 'top';
  }

  private drawMinimap(sim: RaceSim, x: number, y: number): void {
    const m = this.mini;
    if (!m) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    roundRect(ctx, x - 6, y - 6, m.w + 12, m.h + 12, 10);
    ctx.fill();
    ctx.translate(x - m.ox * m.scale, y - m.oy * m.scale);
    ctx.scale(m.scale, m.scale);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1b1035';
    ctx.lineWidth = 5 / m.scale;
    ctx.stroke(m.path);
    if (this.shortcut) {
      ctx.lineWidth = 2.5 / m.scale;
      ctx.strokeStyle = '#c88a50';
      ctx.stroke(this.shortcut.p);
    }
    const g = sim.ghostPose();
    if (g) {
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath();
      ctx.arc(g.x, g.y, 4.5 / m.scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 1.5 / m.scale;
      ctx.strokeStyle = '#1b1035';
      ctx.stroke();
    }
    for (const rv of sim.rivals) {
      ctx.fillStyle = rv.look.body;
      ctx.beginPath();
      ctx.arc(rv.car.x, rv.car.y, 4 / m.scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 1.2 / m.scale;
      ctx.strokeStyle = '#1b1035';
      ctx.stroke();
    }
    ctx.fillStyle = this.car.body;
    ctx.beginPath();
    ctx.arc(sim.car.x, sim.car.y, 5.5 / m.scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2 / m.scale;
    ctx.strokeStyle = '#1b1035';
    ctx.stroke();
    ctx.restore();
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Brand-style chip: ink outline with a hard offset shadow. */
function pill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string): void {
  ctx.fillStyle = '#1b1035';
  roundRect(ctx, x + 3, y + 3, w, h, 12);
  ctx.fill();
  ctx.fillStyle = fill;
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#1b1035';
  ctx.stroke();
}

function star(ctx: CanvasRenderingContext2D, outer: number, inner: number, spikes: number): void {
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = (i / (spikes * 2)) * Math.PI * 2;
    if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
}

/** Irregular faceted blob (rocks, bushes): a polygon split into light and dark facets. */
function lowPolyBlob(ctx: CanvasRenderingContext2D, r: number, seed: number, pal: string[]): void {
  const n = 7;
  const pts: Vec[] = [];
  let s = Math.abs(Math.floor(seed)) % 997;
  for (let i = 0; i < n; i++) {
    s = (s * 131 + 71) % 997;
    const rr = r * (0.78 + (s / 997) * 0.32);
    const a = (i / n) * Math.PI * 2;
    pts.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr });
  }
  for (let i = 0; i < n; i++) {
    const p = pts[i]!;
    const q = pts[(i + 1) % n]!;
    const mid = (Math.atan2(p.y + q.y, p.x + q.x) + Math.PI * 2) % (Math.PI * 2);
    // light from the top-left
    ctx.fillStyle = mid > Math.PI * 0.9 && mid < Math.PI * 1.8 ? (pal[2] ?? pal[0]!) : mid < Math.PI * 0.6 ? pal[1]! : pal[0]!;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
    ctx.closePath();
    ctx.fill();
  }
}

/** Draws a car into a small canvas for the garage (facing up-right, slightly angled). */
export function drawCarPreview(canvas: HTMLCanvasElement, car: Pick<CarDef, 'shape' | 'body' | 'accent'>): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth || 96;
  const h = canvas.clientHeight || 64;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-0.5);
  const s = Math.min(w / 48, h / 30);
  ctx.scale(s, s);
  drawCarBody(ctx, car.shape, car.body, car.accent, 0.4, false);
}

/** Draws a car body facing +x in local units (about 40 x 22). */
function drawCarBody(ctx: CanvasRenderingContext2D, shape: CarShape, color: string, accent: string, steer: number, ghost: boolean): void {
  const dark = shade(color, -0.32);
  const light = shade(color, 0.35);
  const ink = '#1b1035';
  const poly = (pts: number[], fill: string, stroke = false): void => {
    ctx.beginPath();
    ctx.moveTo(pts[0]!, pts[1]!);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i]!, pts[i + 1]!);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke && !ghost) {
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = ink;
      ctx.stroke();
    }
  };
  const wheels = (xs: [number, number], y: number, w: number, h: number): void => {
    ctx.fillStyle = ink;
    for (const [x, front] of [
      [xs[0], true],
      [xs[1], false],
    ] as const) {
      for (const sy of [-1, 1]) {
        ctx.save();
        ctx.translate(x, y * sy);
        if (front) ctx.rotate(steer * 0.45);
        roundRect(ctx, -w / 2, -h / 2, w, h, 2);
        ctx.fill();
        ctx.restore();
      }
    }
  };
  if (!ghost) {
    ctx.fillStyle = 'rgba(30,15,50,0.3)';
    roundRect(ctx, -17, -8, 38, 22, 8);
    ctx.fill();
  }
  const glass = ghost ? 'rgba(40,30,80,0.6)' : '#2b2257';
  switch (shape) {
    case 'buggy': {
      wheels([11, -11], 11, 12, 7);
      poly([15, -6, 12, -8, -12, -8, -16, -5, -16, 5, -12, 8, 12, 8, 15, 6], dark, true);
      poly([13, -5, -12, -6, -14, -3, -14, 3, -12, 6, 13, 5], color);
      poly([13, -5, -12, -6, -3, 0], light);
      // roll cage and driver
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2;
      ctx.strokeRect(-7, -6, 10, 12);
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(-2, 0, 3.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#8ff0ff';
      ctx.fillRect(0, -2, 2, 4);
      break;
    }
    case 'formula': {
      wheels([12, -12], 10, 9, 6);
      // wings
      poly([22, -11, 18, -11, 18, 11, 22, 11], accent, true);
      poly([-17, -10, -21, -10, -21, 10, -17, 10], dark, true);
      // body: long nose
      poly([22, -2.5, 6, -5, -8, -7, -17, -5, -17, 5, -8, 7, 6, 5, 22, 2.5], dark, true);
      poly([20, -1.8, 6, -3.8, -8, -5.5, -15, -4, -15, 4, -8, 5.5, 6, 3.8, 20, 1.8], color);
      poly([20, -1.8, 6, -3.8, -8, -5.5, 0, 0], light);
      ctx.fillStyle = glass;
      ctx.beginPath();
      ctx.ellipse(-2, 0, 5, 3.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(-3, 0, 2.4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'van': {
      wheels([11, -11], 10, 10, 6);
      poly([19, -8, 17, -11, -18, -11, -19, -9, -19, 9, -18, 11, 17, 11, 19, 8], dark, true);
      poly([17, -7.5, 15.5, -9, -17, -9, -17, 9, 15.5, 9, 17, 7.5], color);
      poly([17, -7.5, 15.5, -9, -17, -9, -6, 0], light);
      // windscreen at the front, roof rack
      poly([17, -7, 13, -8, 13, 8, 17, 7], '#8ff0ff');
      ctx.strokeStyle = shade(color, -0.45);
      ctx.lineWidth = 1.4;
      for (const x of [-12, -6, 0, 6]) {
        ctx.beginPath();
        ctx.moveTo(x, -6.5);
        ctx.lineTo(x, 6.5);
        ctx.stroke();
      }
      ctx.fillStyle = accent;
      ctx.fillRect(-17, -9, 30, 2.2);
      break;
    }
    case 'bubble': {
      wheels([9, -9], 9.5, 8, 5);
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.ellipse(0, 0, 16, 11.5, 0, 0, Math.PI * 2);
      ctx.fill();
      if (!ghost) {
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = ink;
        ctx.stroke();
      }
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 9.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = light;
      ctx.beginPath();
      ctx.ellipse(-2, -4, 9, 3.6, -0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = glass;
      ctx.beginPath();
      ctx.ellipse(1, 0, 7, 6.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#8ff0ff';
      ctx.beginPath();
      ctx.ellipse(4.5, 0, 2.6, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = accent;
      ctx.fillRect(12.5, -5, 2, 2.5);
      ctx.fillRect(12.5, 2.5, 2, 2.5);
      break;
    }
    default: {
      // coupe
      wheels([10, -10], 10, 10, 6);
      poly([18, -6, 15, -10, -14, -10, -18, -7, -18, 7, -14, 10, 15, 10, 18, 6], dark, true);
      poly([16, -5.5, 13.5, -8, -13, -8, -16, -5.5, -16, 5.5, -13, 8, 13.5, 8, 16, 5.5], color);
      poly([16, -5.5, 13.5, -8, -13, -8, -4, 0], light);
      // racing stripe
      ctx.fillStyle = accent;
      ctx.globalAlpha *= 0.85;
      ctx.fillRect(-16, -1.6, 32, 3.2);
      ctx.globalAlpha /= 0.85;
      poly([7, -6, -6, -6.5, -9, -4.5, -9, 4.5, -6, 6.5, 7, 6, 9, 0], glass);
      poly([7, -5.5, 9, 0, 7, 5.5, 4.5, 4.5, 4.5, -4.5], '#8ff0ff');
      poly([3, -4.5, -5, -4.8, -5, 4.8, 3, 4.5], light);
      ctx.fillStyle = '#fff3b0';
      ctx.fillRect(15.5, -7, 2.5, 3);
      ctx.fillRect(15.5, 4, 2.5, 3);
      ctx.fillStyle = '#ff3d6e';
      ctx.fillRect(-18, -7, 2, 3);
      ctx.fillRect(-18, 4, 2, 3);
      ctx.fillStyle = dark;
      ctx.fillRect(-20, -9, 3, 18);
    }
  }
}
