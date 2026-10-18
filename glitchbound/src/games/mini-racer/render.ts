import { leftOf, pointAt, type Path, type Vec } from './geometry';
import type { Pose } from './ghost';
import { localVelocity, speedOf } from './physics';
import { COUNTDOWN, DRIFT_SECONDS, HOTLAP_LAPS, RACE_LAPS, type RaceSim } from './sim';
import { KERB, type Obstacle, type Surface, type ThemeId, type Track } from './track';

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
};

const SURFACE_FILL: Record<Surface, string> = {
  asphalt: '#5b5a8f',
  boost: '#ffd12e',
  dirt: '#c88a50',
  ice: '#c4ecff',
  grass: '#8fd46b',
  sand: '#f0c77a',
  snow: '#ffffff',
  mud: '#7b5233',
};

export const PAINTS = [
  { name: 'Coral', body: '#ff5a6c' },
  { name: 'Sky', body: '#2eb8ff' },
  { name: 'Lime', body: '#b8e82a' },
  { name: 'Sunny', body: '#ffc51f' },
  { name: 'Violet', body: '#9a6bff' },
  { name: 'Mint', body: '#22d3b4' },
];

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

/** Sub-path of a closed path between two lap fractions. */
function slice(path: Path, from: number, to: number): Path2D {
  const L = path.length;
  const a = from * L;
  let b = to * L;
  if (b <= a) b += L;
  const pts: Vec[] = [];
  for (let s = a; s <= b; s += 10) pts.push(pointAt(path, s).p);
  pts.push(pointAt(path, b).p);
  return pathFrom(pts, false);
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
  /** Last lap delta vs best, seconds (negative = faster). */
  delta: { value: number; until: number } | null;
  attract: boolean;
  touch: boolean;
}

export function fmtTime(t: number | null): string {
  if (t === null || !Number.isFinite(t)) return '--:--.--';
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`;
}

const SKID_MAX = 700;
const PART_MAX = 140;

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  w = 1;
  h = 1;
  dpr = 1;
  private track: Track | null = null;
  private theme: Theme = THEMES.bay;
  private road: Path2D | null = null;
  private kerbs: Path2D | null = null;
  private zones: { p: Path2D; surface: Surface }[] = [];
  private shortcut: Path2D | null = null;
  private mini: { path: Path2D; scale: number; ox: number; oy: number; w: number; h: number } | null = null;
  private pattern: CanvasPattern | null = null;
  private skids: Skid[] = [];
  private skidHead = 0;
  private parts: Particle[] = [];
  private cam = { x: 0, y: 0, z: 1 };
  private camInit = false;
  private wheelPrev: Vec[] | null = null;
  paint = PAINTS[0]!.body;
  private time = 0;

  /** Seconds of drawing so far (banner timers use it). */
  get now(): number {
    return this.time;
  }

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
  }

  resize(w: number, h: number, dpr: number): void {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.dpr = dpr;
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
  }

  setTrack(track: Track): void {
    if (this.track === track) return;
    this.track = track;
    this.theme = THEMES[track.def.theme];
    this.road = pathFrom(track.path.pts, true);
    this.zones = track.zones.map((z) => ({ p: slice(track.path, z.from, z.to), surface: z.surface }));
    this.shortcut = track.shortcut ? pathFrom(track.shortcut.path.pts, false) : null;
    this.kerbs = this.buildKerbs(track.path);
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

  /** Kerbs only where the road bends, like a real circuit. */
  private buildKerbs(path: Path): Path2D {
    const p = new Path2D();
    const n = path.pts.length;
    const curv = path.tan.map((_, i) => {
      const u = path.tan[(i + 3) % n]!;
      const v = path.tan[(i - 3 + n) % n]!;
      return Math.abs(v.x * u.y - v.y * u.x);
    });
    let open = false;
    for (let i = 0; i <= n; i++) {
      const bend = curv[i % n]! > 0.22;
      const pt = path.pts[i % n]!;
      if (bend && !open) {
        p.moveTo(pt.x, pt.y);
        open = true;
      } else if (bend) p.lineTo(pt.x, pt.y);
      else open = false;
    }
    return p;
  }

  private buildPattern(): CanvasPattern | null {
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
    if (!track) return;
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
    // Touch: sit the car a bit higher, above the thumbs. Menu: keep it in the top third, above the sheet.
    const ly = pose.y + car.vy * 0.32 + (hud.attract ? (this.h * 0.3) / zTarget : hud.touch ? 40 : 0);
    if (!this.camInit) {
      this.cam = { x: lx, y: ly, z: zTarget };
      this.camInit = true;
    }
    const k = 1 - Math.exp(-dt * 6);
    this.cam.x += (lx - this.cam.x) * k;
    this.cam.y += (ly - this.cam.y) * k;
    this.cam.z += (zTarget - this.cam.z) * (1 - Math.exp(-dt * 2));
    const z = this.cam.z;
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
    // World edge fence
    const b = track.bounds;
    ctx.lineWidth = 10;
    ctx.strokeStyle = this.theme.edge;
    ctx.strokeRect(b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY);

    this.drawRoad(track, sim);
    this.updateSkids(sim, pose);
    this.drawSkids(view);
    this.drawObstacles(track.obstacles, view);
    this.drawDecor(track, view);

    // Ghost, then player.
    const gp = sim.ghostPose();
    if (gp) this.drawCar(gp, '#ffffff', 0, 0.42, true);
    this.updateParticles(sim, pose, dt);
    this.drawParticles();
    const steerVis = Math.max(-1, Math.min(1, car.av / 3));
    this.drawCar(pose, this.paint, steerVis, 1, false, car.boost > 0);

    ctx.setTransform(d, 0, 0, d, 0, 0);
    if (!hud.attract) this.drawHud(sim, hud);
  }

  private drawRoad(track: Track, sim: RaceSim): void {
    const ctx = this.ctx;
    const t = this.theme;
    const W = track.def.width;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // Shortcut under the main road so the join looks tidy.
    if (this.shortcut && track.shortcut) {
      ctx.strokeStyle = 'rgba(60,40,70,0.25)';
      ctx.lineWidth = track.shortcut.half * 2 + 14;
      ctx.stroke(this.shortcut);
      ctx.strokeStyle = SURFACE_FILL[track.shortcut.surface];
      ctx.lineWidth = track.shortcut.half * 2;
      ctx.stroke(this.shortcut);
      ctx.setLineDash([6, 22]);
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 3;
      ctx.stroke(this.shortcut);
      ctx.setLineDash([]);
    }
    const road = this.road!;
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
    ctx.strokeStyle = t.kerbA;
    ctx.stroke(this.kerbs!);
    ctx.setLineDash([22, 22]);
    ctx.strokeStyle = t.kerbB;
    ctx.stroke(this.kerbs!);
    ctx.setLineDash([]);
    ctx.lineCap = 'round';
    ctx.strokeStyle = t.road;
    ctx.lineWidth = W;
    ctx.stroke(road);
    for (const z of this.zones) {
      ctx.strokeStyle = SURFACE_FILL[z.surface];
      ctx.lineWidth = W;
      ctx.lineCap = 'butt';
      ctx.stroke(z.p);
      if (z.surface === 'ice') {
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = W * 0.5;
        ctx.setLineDash([60, 90]);
        ctx.stroke(z.p);
        ctx.setLineDash([]);
      }
    }
    ctx.lineCap = 'round';
    // Centre dashes
    ctx.setLineDash([26, 38]);
    ctx.strokeStyle = 'rgba(255,255,255,0.32)';
    ctx.lineWidth = 3;
    ctx.stroke(road);
    ctx.setLineDash([]);

    // Patches
    for (const p of track.patches) {
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
    for (const p of this.parts) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.r += dt * 10;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
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
      if (dcr.kind === 0) {
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

  /** A cute low-poly car: faceted body, glass cabin, chunky wheels, ink outline. */
  drawCar(p: Pose, color: string, steer: number, alpha: number, ghost: boolean, boosting = false): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.a);
    ctx.scale(1.25, 1.25);
    ctx.globalAlpha = alpha;
    if (!ghost) {
      ctx.fillStyle = 'rgba(30,15,50,0.3)';
      ctx.beginPath();
      roundRect(ctx, -16, -8, 36, 22, 7);
      ctx.fill();
    }
    // wheels
    ctx.fillStyle = '#1b1035';
    for (const [x, y, front] of [
      [10, -10, true],
      [10, 10, true],
      [-10, -10, false],
      [-10, 10, false],
    ] as const) {
      ctx.save();
      ctx.translate(x, y);
      if (front) ctx.rotate(steer * 0.45);
      roundRect(ctx, -5, -3, 10, 6, 2);
      ctx.fill();
      ctx.restore();
    }
    const dark = shade(color, -0.32);
    const light = shade(color, 0.35);
    // body base (sides)
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(18, -6);
    ctx.lineTo(15, -10);
    ctx.lineTo(-14, -10);
    ctx.lineTo(-18, -7);
    ctx.lineTo(-18, 7);
    ctx.lineTo(-14, 10);
    ctx.lineTo(15, 10);
    ctx.lineTo(18, 6);
    ctx.closePath();
    ctx.fill();
    if (!ghost) {
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = '#1b1035';
      ctx.stroke();
    }
    // top facets
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(16, -5.5);
    ctx.lineTo(13.5, -8);
    ctx.lineTo(-13, -8);
    ctx.lineTo(-16, -5.5);
    ctx.lineTo(-16, 5.5);
    ctx.lineTo(-13, 8);
    ctx.lineTo(13.5, 8);
    ctx.lineTo(16, 5.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.moveTo(16, -5.5);
    ctx.lineTo(13.5, -8);
    ctx.lineTo(-13, -8);
    ctx.lineTo(-4, 0);
    ctx.closePath();
    ctx.fill();
    // cabin
    ctx.fillStyle = ghost ? 'rgba(40,30,80,0.6)' : '#2b2257';
    ctx.beginPath();
    ctx.moveTo(7, -6);
    ctx.lineTo(-6, -6.5);
    ctx.lineTo(-9, -4.5);
    ctx.lineTo(-9, 4.5);
    ctx.lineTo(-6, 6.5);
    ctx.lineTo(7, 6);
    ctx.lineTo(9, 0);
    ctx.closePath();
    ctx.fill();
    // windscreen glint + roof
    ctx.fillStyle = '#8ff0ff';
    ctx.beginPath();
    ctx.moveTo(7, -5.5);
    ctx.lineTo(9, 0);
    ctx.lineTo(7, 5.5);
    ctx.lineTo(4.5, 4.5);
    ctx.lineTo(4.5, -4.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.moveTo(3, -4.5);
    ctx.lineTo(-5, -4.8);
    ctx.lineTo(-5, 4.8);
    ctx.lineTo(3, 4.5);
    ctx.closePath();
    ctx.fill();
    // lights and spoiler
    ctx.fillStyle = '#fff3b0';
    ctx.fillRect(15.5, -7, 2.5, 3);
    ctx.fillRect(15.5, 4, 2.5, 3);
    ctx.fillStyle = '#ff3d6e';
    ctx.fillRect(-18, -7, 2, 3);
    ctx.fillRect(-18, 4, 2, 3);
    ctx.fillStyle = dark;
    ctx.fillRect(-20, -9, 3, 18);
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

    // Top-left: lap counter / drift timer
    const lap = sim.lap;
    let label: string;
    let value: string;
    if (sim.mode === 'drift') {
      label = 'TIME LEFT';
      value = `${Math.max(0, Math.ceil(DRIFT_SECONDS - Math.max(0, sim.time)))}s`;
    } else {
      const total = sim.mode === 'race' ? RACE_LAPS : HOTLAP_LAPS;
      label = 'LAP';
      value = `${Math.min(total, lap.laps.length + 1)}/${total}`;
    }
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
    ctx.fillText(sim.mode === 'drift' ? 'DRIFT POINTS' : 'LAP TIME', cx, pad + 7);
    ctx.fillStyle = '#ffffff';
    ctx.font = mono(small ? 19 : 24);
    const lastLap = lap.laps[lap.laps.length - 1];
    const shown = sim.finished && lastLap ? lastLap.time : sim.time < 0 ? 0 : sim.lapTime;
    ctx.fillText(sim.mode === 'drift' ? String(Math.round(sim.drift.total)) : fmtTime(shown), cx, pad + (small ? 19 : 21));

    // Top-right: best lap + minimap
    if (sim.mode !== 'drift') {
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

    // Delta vs best after a lap
    if (hud.delta && this.time < hud.delta.until) {
      const v = hud.delta.value;
      const txt = `${v <= 0 ? '−' : '+'}${Math.abs(v).toFixed(2)}`;
      pill(ctx, cx - 50, pad + (small ? 52 : 62), 100, 28, '#ffffff');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.font = mono(small ? 15 : 18);
      ctx.fillStyle = v <= 0 ? '#1aa35a' : '#e8344e';
      ctx.fillText(txt, cx, pad + (small ? 57 : 67));
    }

    // Drift chain
    const d = sim.drift;
    if (d.chain > 1) {
      const mult = 1 + Math.min(3, Math.floor(d.chainTime / 1.5));
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const y = H * (hud.touch ? 0.3 : 0.24);
      ctx.font = font(small ? 26 : 34);
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#1b1035';
      const txt = `DRIFT ${Math.round(d.chain)}`;
      ctx.strokeText(txt, cx, y);
      ctx.fillStyle = '#ffd12e';
      ctx.fillText(txt, cx, y);
      if (mult > 1) {
        ctx.font = font(small ? 16 : 20);
        ctx.strokeText(`x${mult}`, cx, y + (small ? 24 : 30));
        ctx.fillStyle = '#ff5fa2';
        ctx.fillText(`x${mult}`, cx, y + (small ? 24 : 30));
      }
      ctx.textBaseline = 'top';
    } else if (hud.popup && this.time < hud.popup.until) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const y = H * (hud.touch ? 0.3 : 0.24);
      ctx.font = font(small ? 22 : 28);
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#1b1035';
      ctx.strokeText(hud.popup.text, cx, y);
      ctx.fillStyle = '#c4f034';
      ctx.fillText(hud.popup.text, cx, y);
      ctx.textBaseline = 'top';
    }

    // Countdown
    if (sim.time < 0.6) {
      const left = -sim.time;
      const step = COUNTDOWN / 3;
      const txt = sim.time >= 0 ? 'GO!' : String(Math.ceil(left / step));
      const frac = sim.time >= 0 ? sim.time / 0.6 : 1 - ((left / step) % 1);
      ctx.save();
      ctx.translate(cx, H * 0.42);
      const s = 1 + 0.4 * (1 - Math.min(1, frac * 3));
      ctx.scale(s, s);
      ctx.globalAlpha = sim.time >= 0 ? 1 - frac : 1;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = font(small ? 72 : 96);
      ctx.lineWidth = 10;
      ctx.strokeStyle = '#1b1035';
      ctx.strokeText(txt, 0, 0);
      ctx.fillStyle = sim.time >= 0 ? '#c4f034' : '#ffffff';
      ctx.fillText(txt, 0, 0);
      ctx.restore();
    }

    // Banners (missed checkpoint, wrong way, new best...)
    const banner = sim.finished
      ? { text: 'FINISH!', color: '#c4f034', until: Infinity }
      : sim.wrongWay > 0.8
        ? { text: 'WRONG WAY', sub: 'Turn around', color: '#ff5a6c', until: Infinity }
        : hud.banner;
    if (banner && this.time < banner.until) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const y = H * (hud.touch ? 0.42 : 0.36);
      const bw2 = small ? 230 : 300;
      pill(ctx, cx - bw2 / 2, y - 26, bw2, banner.sub ? 62 : 48, banner.color);
      ctx.fillStyle = '#1b1035';
      ctx.font = font(small ? 20 : 24);
      ctx.fillText(banner.text, cx, y - 2);
      if (banner.sub) {
        ctx.font = font(small ? 12 : 13, 600);
        ctx.fillText(banner.sub, cx, y + 21);
      }
      ctx.textBaseline = 'top';
    }
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
      ctx.stroke(this.shortcut);
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
    ctx.fillStyle = this.paint;
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
