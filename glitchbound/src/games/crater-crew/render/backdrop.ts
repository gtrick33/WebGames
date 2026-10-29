/**
 * Everything behind and around the ground: the sky, the sun (or moon, or planet), two parallax layers
 * of distant scenery in the terrain's style, clouds blown by the wind, weather (leaves, snow, embers,
 * stars, fireflies…) and the deadly liquid with its waves. Screen-space layers take the camera;
 * world-space ones are drawn inside its transform.
 */
import { hash01 } from '../math';
import { W } from '../terrain';
import { TERRAINS, type TerrainDef, type TerrainId } from '../terrains';

type Ctx = CanvasRenderingContext2D;

export interface Cam {
  x: number;
  y: number;
  z: number;
  /** Viewport in CSS pixels. */
  vw: number;
  vh: number;
}

interface Layer {
  /** Parallax factor: how much of the camera's movement the layer follows. */
  k: number;
  color: string;
  /** Silhouette heights above the layer's base, one every 8 px across its width. */
  pts: number[];
  base: number;
  extra: { x: number; h: number; w: number }[];
}

export class Backdrop {
  readonly def: TerrainDef;
  private layers: Layer[];
  private clouds: { x: number; y: number; s: number; v: number }[];
  private motes: { x: number; y: number; v: number; ph: number; s: number }[];

  constructor(terrain: TerrainId, seed: number) {
    const def = (this.def = TERRAINS[terrain]);
    const r = (k: number): number => hash01(seed ^ 0xbacd, k);
    const layer = (k: number, color: string, base: number, amp: number, salt: number): Layer => {
      const pts: number[] = [];
      const n = 260;
      const kind = def.far.kind;
      for (let i = 0; i < n; i++) {
        const x = i / n;
        let h: number;
        const f = (a: number, b: number): number => Math.sin(x * Math.PI * 2 * a + salt * b);
        if (kind === 'peaks' || kind === 'stalactites') h = Math.abs(f(5, 1.3)) * 0.6 + Math.abs(f(11, 2.1)) * 0.3 + Math.abs(f(23, 0.7)) * 0.1;
        else if (kind === 'mesas') h = Math.min(0.7, Math.max(0.15, f(4, 1) * 0.9 + f(9, 2) * 0.3));
        else if (kind === 'sea') h = Math.max(0, f(3, 1.7) * 0.5 + f(7, 0.4) * 0.3 - 0.35) * 2;
        else if (kind === 'stacks' || kind === 'cakes') h = 0.25 + Math.floor((f(3, 1) * 0.5 + 0.5) * 4) * 0.12;
        else h = f(3, 1.1) * 0.35 + f(7, 2.3) * 0.2 + f(13, 0.9) * 0.08 + 0.5;
        pts.push(h * amp);
      }
      const extra: Layer['extra'] = [];
      for (let i = 0; i < 7; i++) extra.push({ x: r(salt * 10 + i), h: 0.5 + r(salt * 20 + i) * 0.8, w: 0.6 + r(salt * 30 + i) * 0.8 });
      return { k, color, pts, base, extra };
    };
    this.layers = [layer(0.18, def.far.far, 0.62, 170, 1), layer(0.36, def.far.near, 0.74, 150, 2)];
    this.clouds = Array.from({ length: def.clouds ? 9 : 0 }, (_, i) => ({ x: r(100 + i), y: 0.06 + r(200 + i) * 0.32, s: 0.6 + r(300 + i) * 0.9, v: 0.5 + r(400 + i) }));
    this.motes = Array.from({ length: def.ambient ? 46 : 0 }, (_, i) => ({ x: r(500 + i), y: r(600 + i), v: 0.4 + r(700 + i), ph: r(800 + i) * 6.28, s: 0.6 + r(900 + i) }));
  }

  /** The sky, the sun and the distant layers (screen space). */
  sky(c: Ctx, cam: Cam, t: number): void {
    const { vw, vh } = cam;
    const d = this.def;
    const g = c.createLinearGradient(0, 0, 0, vh);
    g.addColorStop(0, d.sky[0]);
    g.addColorStop(0.55, d.sky[1]);
    g.addColorStop(1, d.sky[2]);
    c.fillStyle = g;
    c.fillRect(0, 0, vw, vh);
    if (d.ambient === 'stars' || d.sky[0].startsWith('#0') || d.sky[0].startsWith('#1') || d.sky[0].startsWith('#2')) this.stars(c, cam, t);
    this.sun(c, cam, t);
    for (const cl of this.clouds.slice(0, 4)) this.cloud(c, cam, cl, t, 0.5);
    for (const l of this.layers) this.layer(c, cam, l, t);
    for (const cl of this.clouds.slice(4)) this.cloud(c, cam, cl, t, 0.8);
  }

  private stars(c: Ctx, cam: Cam, t: number): void {
    for (let i = 0; i < 90; i++) {
      const x = ((hash01(77, i) * 1.4 - cam.x * 0.00003) % 1) * cam.vw;
      const y = hash01(78, i) * cam.vh * 0.7;
      const tw = 0.5 + 0.5 * Math.sin(t * (1 + hash01(79, i) * 2) + i);
      c.fillStyle = `rgba(255,255,255,${0.25 + tw * 0.6})`;
      const s = hash01(80, i) < 0.1 ? 2 : 1.2;
      c.fillRect((x + cam.vw) % cam.vw, y, s, s);
    }
  }

  private sun(c: Ctx, cam: Cam, t: number): void {
    const s = this.def.sun;
    if (s.kind === 'none') return;
    const x = s.x * cam.vw - (cam.x - W / 2) * 0.03;
    const y = s.y * cam.vh;
    const r = s.r * Math.min(1, cam.vh / 700) + 10;
    if (s.kind === 'glow') {
      const g = c.createRadialGradient(x, y, 0, x, y, r * 1.8);
      g.addColorStop(0, s.color + 'aa');
      g.addColorStop(1, s.color + '00');
      c.fillStyle = g;
      c.fillRect(0, 0, cam.vw, cam.vh);
      return;
    }
    const halo = c.createRadialGradient(x, y, r * 0.6, x, y, r * 3);
    halo.addColorStop(0, s.kind === 'sun' ? 'rgba(255,250,210,0.55)' : 'rgba(200,210,255,0.25)');
    halo.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = halo;
    c.beginPath();
    c.arc(x, y, r * 3, 0, Math.PI * 2);
    c.fill();
    if (s.kind === 'planet') {
      const g = c.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.1, x, y, r);
      g.addColorStop(0, '#9cc8ff');
      g.addColorStop(0.6, s.color);
      g.addColorStop(1, '#16306b');
      c.fillStyle = g;
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = 'rgba(255,220,170,0.75)';
      c.lineWidth = r * 0.09;
      c.beginPath();
      c.ellipse(x, y, r * 1.7, r * 0.42, -0.35, 0.15 * Math.PI, 1.85 * Math.PI, true);
      c.stroke();
      return;
    }
    c.fillStyle = s.color;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
    if (s.kind === 'moon') {
      c.fillStyle = 'rgba(0,0,0,0.08)';
      for (const [dx, dy, rr] of [
        [-0.3, -0.2, 0.22],
        [0.25, 0.15, 0.16],
        [-0.05, 0.35, 0.12],
      ]) {
        c.beginPath();
        c.arc(x + dx! * r, y + dy! * r, rr! * r, 0, Math.PI * 2);
        c.fill();
      }
    }
    void t;
  }

  private cloud(c: Ctx, cam: Cam, cl: { x: number; y: number; s: number; v: number }, t: number, k: number): void {
    const span = cam.vw + 400;
    const x = ((((cl.x * span + t * cl.v * 8 - cam.x * k * 0.15) % span) + span) % span) - 200;
    const y = cl.y * cam.vh - (cam.y - 450) * k * 0.08;
    const s = cl.s * (40 + cam.vh * 0.04);
    c.fillStyle = this.def.clouds!;
    c.globalAlpha = 0.55 + k * 0.3;
    for (const [dx, dy, r] of [
      [0, 0, 0.55],
      [0.5, 0.1, 0.42],
      [-0.5, 0.12, 0.4],
      [0.2, -0.22, 0.4],
      [-0.25, -0.12, 0.35],
    ]) {
      c.beginPath();
      c.ellipse(x + dx! * s, y + dy! * s, r! * s, r! * s * 0.75, 0, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
  }

  private layer(c: Ctx, cam: Cam, l: Layer, t: number): void {
    const { vw, vh } = cam;
    const span = Math.max(vw * 1.6, 1400);
    const off = cam.x * l.k * cam.z * 0.6;
    const base = vh * l.base - (cam.y - 500) * l.k * cam.z * 0.25;
    const scale = Math.min(1.4, vh / 620);
    const kind = this.def.far.kind;
    c.fillStyle = l.color;
    c.beginPath();
    c.moveTo(0, vh);
    const n = l.pts.length;
    for (let sx = 0; sx <= vw + 8; sx += 8) {
      const u = ((((sx + off) / span) % 1) + 1) % 1;
      const i = Math.floor(u * n);
      const h = l.pts[i]! * scale;
      let y = base - h;
      if (kind === 'stalactites') y = base - h * 0.4;
      c.lineTo(sx, y);
    }
    c.lineTo(vw, vh);
    c.closePath();
    c.fill();
    // a few landmarks in the layer's style
    for (const e of l.extra) {
      const x = ((((e.x * span - off) % span) + span) % span) - 60;
      if (x < -80 || x > vw + 80) continue;
      const u = ((((x + off) / span) % 1) + 1) % 1;
      const ground = base - l.pts[Math.floor(u * n)]! * scale;
      this.landmark(c, kind, x, ground, e.h * scale, e.w * scale, l.color, t);
    }
    if (kind === 'stalactites') {
      c.fillStyle = l.color;
      for (let i = 0; i < 18; i++) {
        const x = ((((hash01(91, i) * span - off) % span) + span) % span) - 40;
        const h = (40 + hash01(92, i) * 120) * scale * (l.k > 0.3 ? 1 : 0.7);
        c.beginPath();
        c.moveTo(x - 14 * scale, 0);
        c.lineTo(x, h);
        c.lineTo(x + 14 * scale, 0);
        c.fill();
      }
    }
  }

  private landmark(c: Ctx, kind: TerrainDef['far']['kind'], x: number, y: number, h: number, w: number, color: string, t: number): void {
    c.fillStyle = color;
    switch (kind) {
      case 'hills':
        // a round tree on the hill
        c.fillRect(x - 2 * w, y - 22 * h, 4 * w, 24 * h);
        c.beginPath();
        c.arc(x, y - 28 * h, 14 * w, 0, Math.PI * 2);
        c.fill();
        break;
      case 'volcano': {
        c.beginPath();
        c.moveTo(x - 90 * w, y + 4);
        c.lineTo(x - 18 * w, y - 110 * h);
        c.lineTo(x + 18 * w, y - 110 * h);
        c.lineTo(x + 90 * w, y + 4);
        c.fill();
        const g = c.createRadialGradient(x, y - 110 * h, 0, x, y - 110 * h, 40 * w);
        g.addColorStop(0, 'rgba(255,140,40,0.75)');
        g.addColorStop(1, 'rgba(255,80,20,0)');
        c.fillStyle = g;
        c.fillRect(x - 40 * w, y - 150 * h, 80 * w, 80 * h);
        c.fillStyle = 'rgba(60,40,45,0.5)';
        for (let i = 0; i < 4; i++) {
          c.beginPath();
          c.arc(x + Math.sin(t * 0.3 + i) * 10 + i * 6, y - 125 * h - i * 18 - ((t * 6) % 18), 12 + i * 5, 0, Math.PI * 2);
          c.fill();
        }
        break;
      }
      case 'stacks':
        c.fillRect(x - 6 * w, y - 120 * h, 12 * w, 124 * h);
        c.fillStyle = 'rgba(160,150,140,0.35)';
        for (let i = 0; i < 4; i++) {
          c.beginPath();
          c.arc(x + i * 9 + Math.sin(t * 0.5 + i) * 4, y - 130 * h - i * 16 - ((t * 5) % 16), 9 + i * 4, 0, Math.PI * 2);
          c.fill();
        }
        break;
      case 'spires':
        c.fillRect(x - 10 * w, y - 70 * h, 20 * w, 74 * h);
        c.beginPath();
        c.moveTo(x - 13 * w, y - 70 * h);
        c.lineTo(x, y - 110 * h);
        c.lineTo(x + 13 * w, y - 70 * h);
        c.fill();
        c.fillStyle = 'rgba(255,214,102,0.7)';
        c.fillRect(x - 2.5 * w, y - 52 * h, 5 * w, 8 * h);
        break;
      case 'cakes':
        for (let k = 0; k < 3; k++) {
          c.fillRect(x - (34 - k * 9) * w, y - (k + 1) * 22 * h, (68 - k * 18) * w, 23 * h);
        }
        c.fillStyle = '#e11d48';
        c.beginPath();
        c.arc(x, y - 70 * h, 6 * w, 0, Math.PI * 2);
        c.fill();
        break;
      case 'planet':
        c.beginPath();
        c.arc(x, y, 26 * w, Math.PI, 0);
        c.fill();
        c.fillStyle = 'rgba(160,220,255,0.6)';
        c.fillRect(x - 3 * w, y - 14 * w, 6 * w, 4 * w);
        break;
      case 'sea':
        c.beginPath();
        c.moveTo(x - 6 * w, y);
        c.quadraticCurveTo(x - 2, y - 30 * h, x + 8 * w, y - 46 * h);
        c.lineTo(x + 10 * w, y - 45 * h);
        c.quadraticCurveTo(x + 2, y - 30 * h, x + 3 * w, y);
        c.fill();
        break;
      default:
        break;
    }
  }

  /** Weather drifting with the wind (screen space, over everything). */
  weather(c: Ctx, cam: Cam, t: number, wind: number): void {
    const a = this.def.ambient;
    if (!a) return;
    const { vw, vh } = cam;
    for (const m of this.motes) {
      const fall = a === 'snow' ? 30 : a === 'leaves' ? 24 : a === 'embers' ? -26 : a === 'sprinkles' ? 22 : a === 'dust' ? 4 : 0;
      const drift = wind * 9 + (a === 'gulls' ? 30 : 0);
      let x = (m.x * vw + t * (drift * m.v + Math.sin(t + m.ph) * 6)) % (vw + 40);
      if (x < -20) x += vw + 40;
      let y = (m.y * vh + t * fall * m.v) % (vh + 40);
      if (y < -20) y += vh + 40;
      c.save();
      c.translate(x, y);
      switch (a) {
        case 'snow':
          c.fillStyle = 'rgba(255,255,255,0.85)';
          c.beginPath();
          c.arc(0, 0, 1.6 * m.s, 0, Math.PI * 2);
          c.fill();
          break;
        case 'leaves':
          if (m.s > 1.1) break;
          c.rotate(t * 2 * m.v + m.ph);
          c.fillStyle = m.ph > 3 ? '#e9a23b' : '#7fc24a';
          c.beginPath();
          c.ellipse(0, 0, 3.2, 1.6, 0, 0, Math.PI * 2);
          c.fill();
          break;
        case 'embers':
          c.fillStyle = `rgba(255,${120 + Math.floor(m.s * 60)},40,${0.5 + 0.5 * Math.sin(t * 4 + m.ph)})`;
          c.fillRect(0, 0, 2 * m.s, 2 * m.s);
          break;
        case 'dust':
          c.fillStyle = 'rgba(255,230,180,0.35)';
          c.fillRect(0, 0, 2.4 * m.s, 1.2);
          break;
        case 'gulls':
          if (m.s < 1.25) break;
          c.strokeStyle = 'rgba(40,60,80,0.6)';
          c.lineWidth = 1.4;
          c.beginPath();
          c.moveTo(-6, 0);
          c.quadraticCurveTo(-3, -4 - Math.sin(t * 6 + m.ph) * 2, 0, 0);
          c.quadraticCurveTo(3, -4 - Math.sin(t * 6 + m.ph) * 2, 6, 0);
          c.stroke();
          break;
        case 'sprinkles':
          c.rotate(m.ph + t);
          c.fillStyle = ['#ff4d8d', '#4dd2ff', '#ffe14d', '#7cff6b'][Math.floor(m.ph) % 4]!;
          c.fillRect(-2, -0.7, 4, 1.4);
          break;
        case 'motes':
        case 'fireflies': {
          const glow = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.5 + m.ph));
          c.fillStyle = a === 'fireflies' ? `rgba(220,255,120,${glow})` : `rgba(140,240,255,${glow * 0.8})`;
          c.shadowColor = c.fillStyle;
          c.shadowBlur = 6;
          c.beginPath();
          c.arc(0, 0, 1.5 * m.s, 0, Math.PI * 2);
          c.fill();
          c.shadowBlur = 0;
          break;
        }
        case 'smog':
          c.fillStyle = 'rgba(120,110,100,0.08)';
          c.beginPath();
          c.arc(0, 0, 30 * m.s, 0, Math.PI * 2);
          c.fill();
          break;
        case 'stars':
          break;
      }
      c.restore();
    }
  }

  /** The liquid's body (world space, drawn before the units). */
  liquidBack(c: Ctx, cam: Cam, y: number, t: number): void {
    this.liquid(c, cam, y, t, true);
  }

  /** A see-through front wave over anything sinking (world space, after the units). */
  liquidFront(c: Ctx, cam: Cam, y: number, t: number): void {
    this.liquid(c, cam, y, t, false);
  }

  private liquid(c: Ctx, cam: Cam, ly: number, t: number, back: boolean): void {
    const L = this.def.liquid;
    const half = cam.vw / 2 / cam.z;
    const x0 = cam.x - half - 20;
    const x1 = cam.x + half + 20;
    const bottom = cam.y + cam.vh / 2 / cam.z + 40;
    if (bottom < ly - 20) return;
    const amp = L.kind === 'lava' ? 3 : L.kind === 'void' ? 1.5 : 4;
    const wave = (x: number, ph: number): number => Math.sin(x * 0.02 + t * 1.6 + ph) * amp + Math.sin(x * 0.051 - t * 2.3 + ph) * amp * 0.5;
    c.beginPath();
    c.moveTo(x0, bottom);
    for (let x = x0; x <= x1; x += 12) c.lineTo(x, ly + wave(x, back ? 0 : 2.1) - (back ? 4 : 0));
    c.lineTo(x1, bottom);
    c.closePath();
    if (back) {
      const g = c.createLinearGradient(0, ly - 6, 0, ly + 140);
      g.addColorStop(0, L.top);
      g.addColorStop(1, L.deep);
      c.fillStyle = g;
      if (L.kind === 'lava') {
        c.shadowColor = '#ff7a1a';
        c.shadowBlur = 18;
      }
      c.fill();
      c.shadowBlur = 0;
      // sparkle lines / lava crust
      c.strokeStyle = L.kind === 'lava' ? 'rgba(255,240,150,0.6)' : L.kind === 'void' ? 'rgba(160,140,255,0.5)' : 'rgba(255,255,255,0.45)';
      c.lineWidth = 2;
      c.beginPath();
      for (let x = x0; x <= x1; x += 12) c.lineTo(x, ly + wave(x, 0) - 4);
      c.stroke();
    } else {
      c.fillStyle = L.kind === 'void' ? 'rgba(20,10,60,0.35)' : L.kind === 'lava' ? 'rgba(255,90,20,0.45)' : 'rgba(255,255,255,0.0)';
      const g = c.createLinearGradient(0, ly, 0, ly + 60);
      g.addColorStop(0, L.kind === 'lava' ? 'rgba(255,140,40,0.55)' : L.kind === 'void' ? 'rgba(40,20,110,0.45)' : this.hexA(L.top, 0.55));
      g.addColorStop(1, this.hexA(L.deep, 0.9));
      c.fillStyle = g;
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.35)';
      c.lineWidth = 1.2;
      c.beginPath();
      for (let x = x0; x <= x1; x += 12) c.lineTo(x, ly + wave(x, 2.1));
      c.stroke();
    }
  }

  private hexA(h: string, a: number): string {
    return `rgba(${parseInt(h.slice(1, 3), 16)},${parseInt(h.slice(3, 5), 16)},${parseInt(h.slice(5, 7), 16)},${a})`;
  }
}
