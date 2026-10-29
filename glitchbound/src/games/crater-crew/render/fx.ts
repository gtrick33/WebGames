/**
 * Cartoon sparks and smoke: ink-outlined fireballs that bloom and burn out, puffy smoke clouds, a
 * star-burst flash and shock ring, tumbling chunks of the ground, speed streaks, splashes, the
 * Zapper's crackling bolt, comic-book words ("KA-BOOM!") and the bouncing damage numbers. Purely
 * visual (Math.random is fine here: nothing in the battle depends on it). World space, except the
 * words and numbers, which stay crisp in screen space.
 */
import { FONT, INK, star } from './paint';

type Ctx = CanvasRenderingContext2D;

interface Particle {
  kind: 'ball' | 'puff' | 'chip' | 'drop' | 'spark' | 'streak' | 'ring' | 'flash';
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  /** Turning (chips, sparks). */
  spin: number;
}

interface Floater {
  text: string;
  x: number;
  y: number;
  life: number;
  max: number;
  color: string;
  size: number;
  /** Comic lettering: tilted, yellow, with a drop shadow. */
  comic: boolean;
  tilt: number;
}

interface Bolt {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  life: number;
}

const MAX_PARTICLES = 700;
const BOOM_WORDS = ['BOOM!', 'KA-BOOM!', 'BLAM!', 'POW!', 'WHAM!', 'KABLOOEY!'];
/** A fireball blob's color as it cools: white-hot, yellow, orange, red, then a sooty puff. */
const BALL_COLORS = ['#8a7f9e', '#f0462e', '#ff8a1f', '#ffd23f', '#fff6c2'];

export class Fx {
  private ps: Particle[] = [];
  private texts: Floater[] = [];
  private bolts: Bolt[] = [];
  /** Screen shake left (px). */
  shake = 0;

  constructor(
    private dirt: string[],
    private liquid: string,
  ) {}

  private add(p: Omit<Particle, 'max' | 'spin'> & { spin?: number }): void {
    if (this.ps.length >= MAX_PARTICLES) this.ps.splice(0, this.ps.length - MAX_PARTICLES + 1);
    this.ps.push({ spin: 0, ...p, max: p.life });
  }

  boom(x: number, y: number, r: number): void {
    this.shake = Math.min(16, this.shake + r * 0.25);
    this.add({ kind: 'flash', x, y, vx: 0, vy: 0, life: 0.16, size: r * 1.7, color: '#fffbe0', spin: Math.random() * Math.PI });
    this.add({ kind: 'ring', x, y, vx: 0, vy: 0, life: 0.38, size: r * 1.6, color: '#ffffff' });
    // the fireball: overlapping blobs that bloom, cool from white-hot to red and shrink away
    const balls = Math.min(18, 5 + Math.round(r * 0.18));
    for (let i = 0; i < balls; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * r * 0.55;
      const s = 20 + Math.random() * r * 1.4;
      this.add({ kind: 'ball', x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30, life: 0.45 + Math.random() * 0.35, size: r * (0.28 + Math.random() * 0.22), color: '' });
    }
    // smoke that rolls up after it
    for (let i = 0; i < Math.min(12, 3 + r * 0.12); i++) {
      const a = Math.random() * Math.PI * 2;
      this.add({ kind: 'puff', x: x + Math.cos(a) * r * 0.45, y: y + Math.sin(a) * r * 0.35, vx: Math.cos(a) * 18, vy: -22 - Math.random() * 30, life: 1.1 + Math.random() * 0.9, size: r * (0.2 + Math.random() * 0.16), color: '#ebe6f2' });
    }
    // chunks of the ground
    for (let i = 0; i < Math.min(26, 6 + r * 0.4); i++) {
      const a = -Math.PI * (0.08 + Math.random() * 0.84);
      const s = 140 + Math.random() * 280;
      this.add({ kind: 'chip', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.9 + Math.random() * 0.8, size: 1.6 + Math.random() * 2.6, color: this.dirt[i % this.dirt.length]!, spin: (Math.random() - 0.5) * 18 });
    }
    // speed streaks and sparkles
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + Math.random() * 0.4;
      const s = 260 + Math.random() * 220;
      this.add({ kind: 'streak', x: x + Math.cos(a) * r * 0.4, y: y + Math.sin(a) * r * 0.4, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.18 + Math.random() * 0.12, size: 1.6, color: '#fff3b0' });
    }
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 120 + Math.random() * 200;
      this.add({ kind: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, life: 0.5 + Math.random() * 0.4, size: 2.2 + Math.random() * 1.4, color: i % 2 ? '#ffd23f' : '#ffffff', spin: Math.random() * 6 });
    }
    if (r >= 38) this.comic(BOOM_WORDS[Math.floor(Math.random() * BOOM_WORDS.length)]!, x, y - r * 0.9, 24 + r * 0.18);
  }

  splash(x: number, y: number, big: boolean): void {
    for (let i = 0; i < (big ? 26 : 12); i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.4;
      const s = (big ? 170 : 110) + Math.random() * 160;
      this.add({ kind: 'drop', x: x + (Math.random() - 0.5) * 10, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.7 + Math.random() * 0.5, size: 1.8 + Math.random() * 2.2, color: this.liquid });
    }
    for (let i = 0; i < (big ? 5 : 2); i++) this.add({ kind: 'puff', x: x + (Math.random() - 0.5) * 16, y: y - 2, vx: (Math.random() - 0.5) * 30, vy: -20, life: 0.6, size: big ? 7 : 4, color: '#ffffff' });
    this.add({ kind: 'ring', x, y, vx: 0, vy: 0, life: 0.6, size: big ? 42 : 24, color: '#ffffff' });
  }

  /** What a shell leaves behind in the air: puffs, and sparks off the hot ones. */
  trail(x: number, y: number, hot: boolean): void {
    this.add({ kind: 'puff', x, y, vx: (Math.random() - 0.5) * 12, vy: -10, life: 0.55 + Math.random() * 0.35, size: 2.2 + Math.random() * 1.6, color: '#f4f1f8' });
    if (hot && Math.random() < 0.5) this.add({ kind: 'ball', x, y, vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30, life: 0.22, size: 2.6, color: '' });
  }

  dust(x: number, y: number): void {
    for (let i = 0; i < 6; i++) this.add({ kind: 'puff', x: x + (Math.random() - 0.5) * 12, y: y - 1, vx: (Math.random() - 0.5) * 50, vy: -8 - Math.random() * 12, life: 0.45 + Math.random() * 0.3, size: 2.2 + Math.random() * 2, color: '#efe6da' });
  }

  zap(x0: number, y0: number, x1: number, y1: number): void {
    this.bolts.push({ x0, y0, x1, y1, life: 0.42 });
    for (let i = 0; i < 9; i++) this.add({ kind: 'spark', x: x1, y: y1, vx: (Math.random() - 0.5) * 320, vy: (Math.random() - 0.5) * 320, life: 0.35, size: 2, color: i % 2 ? '#a5f3fc' : '#ffffff', spin: Math.random() * 6 });
    this.comic('ZAP!', x1, y1 - 18, 18, '#a5f3fc');
  }

  text(text: string, x: number, y: number, color: string, size = 15, life = 1.6): void {
    this.texts.push({ text, x, y, life, max: life, color, size, comic: false, tilt: 0 });
  }

  /** Comic-book lettering that pops in tilted and drifts up. */
  comic(text: string, x: number, y: number, size = 22, color = '#ffd23f'): void {
    this.texts.push({ text, x, y, life: 1.1, max: 1.1, color, size, comic: true, tilt: (Math.random() - 0.5) * 0.35 });
  }

  get busy(): boolean {
    return this.ps.length > 0 || this.texts.length > 0;
  }

  step(dt: number, gravity: number): void {
    for (const p of this.ps) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      switch (p.kind) {
        case 'chip':
        case 'drop':
          p.vy += gravity * dt;
          break;
        case 'spark':
          p.vy += gravity * 0.5 * dt;
          p.vx *= 0.97;
          break;
        case 'ball':
          p.vx *= 0.88;
          p.vy = p.vy * 0.88 - 40 * dt;
          break;
        case 'puff':
          p.vx *= 0.96;
          p.size += dt * 5;
          break;
        case 'streak':
          p.vx *= 0.9;
          p.vy *= 0.9;
          break;
      }
    }
    this.ps = this.ps.filter((p) => p.life > 0);
    for (const f of this.texts) {
      f.life -= dt;
      f.y -= dt * (f.comic ? 14 : 24);
    }
    this.texts = this.texts.filter((f) => f.life > 0);
    for (const b of this.bolts) b.life -= dt;
    this.bolts = this.bolts.filter((b) => b.life > 0);
    this.shake = Math.max(0, this.shake - dt * 32);
  }

  /** Smoke behind the units: one outlined cloud from many puffs (outlines first, then the fills). */
  drawBack(c: Ctx): void {
    const puffs = this.ps.filter((p) => p.kind === 'puff');
    if (!puffs.length) return;
    for (const pass of [0, 1]) {
      for (const p of puffs) {
        const k = p.life / p.max;
        c.globalAlpha = Math.min(1, k * 1.6) * 0.9;
        c.fillStyle = pass === 0 ? 'rgba(70,60,95,0.55)' : p.color;
        c.beginPath();
        c.arc(p.x, p.y, p.size + (pass === 0 ? 0.9 : 0), 0, Math.PI * 2);
        c.fill();
      }
    }
    c.globalAlpha = 1;
  }

  /** Fireballs, the flash and ring, chunks, drops, sparks and the Zapper's bolt, in front. */
  drawFront(c: Ctx): void {
    for (const p of this.ps) {
      if (p.kind !== 'flash') continue;
      const k = p.life / p.max;
      c.globalAlpha = k;
      star(c, p.x, p.y, p.size * (1.15 - k * 0.4), p.size * 0.45, 9, p.spin);
      c.fillStyle = p.color;
      c.fill();
      c.globalAlpha = 1;
    }
    const balls = this.ps.filter((p) => p.kind === 'ball');
    if (balls.length) {
      // one ink outline around the whole fireball, then the colors (hottest last, on top)
      const size = (p: Particle): number => {
        const age = 1 - p.life / p.max;
        return p.size * (age < 0.2 ? 0.55 + age * 2.6 : 1.07 - (age - 0.2) * 0.9);
      };
      c.fillStyle = INK;
      for (const p of balls) {
        // trail embers stay bare: an outline would turn them into soot
        if (p.size < 4) continue;
        c.beginPath();
        c.arc(p.x, p.y, size(p) + 2.2, 0, Math.PI * 2);
        c.fill();
      }
      const sorted = balls.slice().sort((a, b) => a.life / a.max - b.life / b.max);
      for (const p of sorted) {
        const k = p.life / p.max;
        c.fillStyle = BALL_COLORS[Math.min(4, Math.floor(k * 5.5))]!;
        c.beginPath();
        c.arc(p.x, p.y, size(p), 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = 'rgba(255,255,255,0.35)';
      for (const p of sorted) {
        if (p.life / p.max < 0.55) continue;
        const s = size(p);
        c.beginPath();
        c.arc(p.x - s * 0.3, p.y - s * 0.3, s * 0.35, 0, Math.PI * 2);
        c.fill();
      }
    }
    for (const p of this.ps) {
      const k = p.life / p.max;
      switch (p.kind) {
        case 'chip':
          c.save();
          c.translate(p.x, p.y);
          c.rotate(p.spin * (p.max - p.life));
          c.globalAlpha = Math.min(1, k * 3);
          c.fillStyle = p.color;
          c.strokeStyle = INK;
          c.lineWidth = 0.7;
          c.beginPath();
          c.moveTo(-p.size, -p.size * 0.6);
          c.lineTo(p.size * 0.8, -p.size);
          c.lineTo(p.size, p.size * 0.7);
          c.lineTo(-p.size * 0.5, p.size);
          c.closePath();
          c.fill();
          c.stroke();
          c.restore();
          break;
        case 'drop':
          c.globalAlpha = Math.min(1, k * 2);
          c.fillStyle = p.color;
          c.beginPath();
          c.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          c.fill();
          c.fillStyle = 'rgba(255,255,255,0.7)';
          c.beginPath();
          c.arc(p.x - p.size * 0.3, p.y - p.size * 0.3, p.size * 0.35, 0, Math.PI * 2);
          c.fill();
          break;
        case 'spark':
          c.globalAlpha = Math.min(1, k * 2);
          star(c, p.x, p.y, p.size * 1.6, p.size * 0.5, 4, p.spin + (p.max - p.life) * 8);
          c.fillStyle = p.color;
          c.fill();
          break;
        case 'streak': {
          c.globalAlpha = k;
          c.strokeStyle = p.color;
          c.lineWidth = p.size * 1.6;
          c.lineCap = 'round';
          c.beginPath();
          c.moveTo(p.x, p.y);
          c.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04);
          c.stroke();
          c.lineCap = 'butt';
          break;
        }
        case 'ring':
          c.globalAlpha = k;
          c.strokeStyle = p.color;
          c.lineWidth = 1 + k * 4;
          c.beginPath();
          c.arc(p.x, p.y, p.size * (1 - k * 0.75), 0, Math.PI * 2);
          c.stroke();
          break;
      }
    }
    c.globalAlpha = 1;
    for (const b of this.bolts) this.drawBolt(c, b);
  }

  /** A jagged bolt that crackles (new kinks every frame). */
  private drawBolt(c: Ctx, b: Bolt): void {
    const k = b.life / 0.42;
    const dx = b.x1 - b.x0;
    const dy = b.y1 - b.y0;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const n = Math.max(4, Math.round(len / 14));
    const pts: [number, number][] = [[b.x0, b.y0]];
    for (let i = 1; i < n; i++) {
      const j = (Math.random() - 0.5) * 9;
      pts.push([b.x0 + (dx * i) / n + nx * j, b.y0 + (dy * i) / n + ny * j]);
    }
    pts.push([b.x1, b.y1]);
    const line = (): void => {
      c.beginPath();
      pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.stroke();
    };
    c.lineJoin = 'round';
    c.lineCap = 'round';
    c.globalAlpha = k;
    c.strokeStyle = INK;
    c.lineWidth = 6.5;
    line();
    c.strokeStyle = '#22d3ee';
    c.lineWidth = 4.5;
    line();
    c.strokeStyle = '#ffffff';
    c.lineWidth = 1.6;
    line();
    c.globalAlpha = 1;
    c.lineJoin = 'miter';
    c.lineCap = 'butt';
  }

  /** Floating words and numbers, in screen space so they stay readable at any zoom. */
  drawTexts(c: Ctx, toScreen: (x: number, y: number) => [number, number]): void {
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineJoin = 'round';
    for (const f of this.texts) {
      const k = f.life / f.max;
      const age = f.max - f.life;
      const [sx, sy] = toScreen(f.x, f.y);
      // pop in with an overshoot
      const pop = age < 0.18 ? 0.4 + (age / 0.18) * 0.85 : age < 0.3 ? 1.25 - ((age - 0.18) / 0.12) * 0.25 : 1;
      const size = Math.round(f.size * pop);
      c.font = `800 ${size}px ${FONT}`;
      c.globalAlpha = Math.min(1, k * 3);
      c.save();
      c.translate(sx, sy);
      c.rotate(f.tilt);
      if (f.comic) {
        c.lineWidth = Math.max(4, size * 0.22);
        c.strokeStyle = INK;
        c.fillStyle = '#ff4d2e';
        c.strokeText(f.text, 2, 3);
        c.fillText(f.text, 2, 3);
        c.strokeText(f.text, 0, 0);
      } else {
        c.lineWidth = 4.5;
        c.strokeStyle = 'rgba(16,10,30,0.92)';
        c.strokeText(f.text, 0, 0);
      }
      c.fillStyle = f.color;
      c.fillText(f.text, 0, 0);
      c.restore();
      c.globalAlpha = 1;
    }
    c.lineJoin = 'miter';
    c.textBaseline = 'alphabetic';
  }
}
