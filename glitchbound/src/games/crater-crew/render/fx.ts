/**
 * Sparks and smoke: fireballs, flying dirt in the ground's colors, smoke puffs, splashes, the
 * Zapper's beam, shell trails, "BONK!" and the floating damage numbers. Purely visual (Math.random
 * is fine here: nothing in the battle depends on it). World space.
 */
type Ctx = CanvasRenderingContext2D;

interface Particle {
  kind: 'fire' | 'smoke' | 'chip' | 'drop' | 'spark' | 'ring' | 'flash';
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
}

interface Floater {
  text: string;
  x: number;
  y: number;
  life: number;
  max: number;
  color: string;
  size: number;
}

export class Fx {
  private ps: Particle[] = [];
  private texts: Floater[] = [];
  private beams: { x0: number; y0: number; x1: number; y1: number; life: number }[] = [];
  /** Screen shake left (px). */
  shake = 0;

  constructor(
    private dirt: string[],
    private liquid: string,
  ) {}

  private add(p: Omit<Particle, 'max'>): void {
    if (this.ps.length > 900) this.ps.shift();
    this.ps.push({ ...p, max: p.life });
  }

  boom(x: number, y: number, r: number): void {
    this.shake = Math.min(14, this.shake + r * 0.22);
    this.add({ kind: 'flash', x, y, vx: 0, vy: 0, life: 0.14, size: r * 1.6, color: '#fffbe6' });
    this.add({ kind: 'ring', x, y, vx: 0, vy: 0, life: 0.35, size: r * 1.5, color: 'rgba(255,255,255,0.7)' });
    const n = Math.min(40, 8 + r * 0.6);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = (0.25 + Math.random() * 0.75) * r * 4;
      this.add({ kind: 'fire', x, y, vx: Math.cos(a) * s * 0.5, vy: Math.sin(a) * s * 0.5 - 20, life: 0.35 + Math.random() * 0.35, size: r * (0.18 + Math.random() * 0.25), color: '' });
    }
    for (let i = 0; i < n * 0.6; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = Math.random() * r * 1.5;
      this.add({ kind: 'smoke', x: x + Math.cos(a) * r * 0.4, y: y + Math.sin(a) * r * 0.4, vx: Math.cos(a) * s * 0.4, vy: -15 - Math.random() * 25, life: 1 + Math.random() * 1.2, size: r * (0.2 + Math.random() * 0.25), color: '' });
    }
    for (let i = 0; i < n; i++) {
      const a = -Math.PI * Math.random();
      const s = 120 + Math.random() * 260;
      this.add({ kind: 'chip', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.8 + Math.random() * 0.8, size: 1.5 + Math.random() * 2.5, color: this.dirt[i % this.dirt.length]! });
    }
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 200 + Math.random() * 300;
      this.add({ kind: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.25 + Math.random() * 0.3, size: 1.2, color: '#ffe680' });
    }
  }

  splash(x: number, y: number, big: boolean): void {
    for (let i = 0; i < (big ? 26 : 12); i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.4;
      const s = (big ? 160 : 100) + Math.random() * 160;
      this.add({ kind: 'drop', x: x + (Math.random() - 0.5) * 10, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.7 + Math.random() * 0.5, size: 1.6 + Math.random() * 2, color: this.liquid });
    }
    this.add({ kind: 'ring', x, y, vx: 0, vy: 0, life: 0.6, size: big ? 40 : 22, color: 'rgba(255,255,255,0.6)' });
  }

  trail(x: number, y: number, hot: boolean): void {
    this.add({ kind: 'smoke', x, y, vx: (Math.random() - 0.5) * 10, vy: -8, life: 0.5 + Math.random() * 0.4, size: 3 + Math.random() * 2, color: '' });
    if (hot) this.add({ kind: 'fire', x, y, vx: 0, vy: 0, life: 0.12, size: 3, color: '' });
  }

  dust(x: number, y: number): void {
    for (let i = 0; i < 6; i++) this.add({ kind: 'smoke', x: x + (Math.random() - 0.5) * 10, y, vx: (Math.random() - 0.5) * 40, vy: -10 - Math.random() * 10, life: 0.4 + Math.random() * 0.3, size: 2 + Math.random() * 2, color: '' });
  }

  zap(x0: number, y0: number, x1: number, y1: number): void {
    this.beams.push({ x0, y0, x1, y1, life: 0.35 });
    for (let i = 0; i < 8; i++) this.add({ kind: 'spark', x: x1, y: y1, vx: (Math.random() - 0.5) * 300, vy: (Math.random() - 0.5) * 300, life: 0.3, size: 1.4, color: '#a5f3fc' });
  }

  text(text: string, x: number, y: number, color: string, size = 15, life = 1.6): void {
    this.texts.push({ text, x, y, life, max: life, color, size });
  }

  get busy(): boolean {
    return this.ps.length > 0 || this.texts.length > 0;
  }

  step(dt: number, gravity: number): void {
    for (const p of this.ps) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'chip' || p.kind === 'drop' || p.kind === 'spark') p.vy += gravity * dt;
      if (p.kind === 'fire') {
        p.vx *= 0.9;
        p.vy = p.vy * 0.9 - 30 * dt;
      }
      if (p.kind === 'smoke') {
        p.vx *= 0.97;
        p.size += dt * 6;
      }
    }
    this.ps = this.ps.filter((p) => p.life > 0);
    for (const f of this.texts) {
      f.life -= dt;
      f.y -= dt * 22;
    }
    this.texts = this.texts.filter((f) => f.life > 0);
    for (const b of this.beams) b.life -= dt;
    this.beams = this.beams.filter((b) => b.life > 0);
    this.shake = Math.max(0, this.shake - dt * 30);
  }

  /** Smoke and fire behind the units. */
  drawBack(c: Ctx): void {
    for (const p of this.ps) {
      const k = p.life / p.max;
      if (p.kind === 'smoke') {
        c.fillStyle = `rgba(70,64,70,${0.45 * k})`;
        c.beginPath();
        c.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        c.fill();
      }
    }
  }

  /** Fireballs, chips, drops, beams and texts in front. */
  drawFront(c: Ctx): void {
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (const p of this.ps) {
      const k = p.life / p.max;
      if (p.kind === 'fire') {
        const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        g.addColorStop(0, `rgba(255,240,180,${k})`);
        g.addColorStop(0.4, `rgba(255,150,40,${k * 0.9})`);
        g.addColorStop(1, 'rgba(200,40,10,0)');
        c.fillStyle = g;
        c.beginPath();
        c.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        c.fill();
      } else if (p.kind === 'flash') {
        const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        g.addColorStop(0, `rgba(255,255,240,${k})`);
        g.addColorStop(1, 'rgba(255,200,120,0)');
        c.fillStyle = g;
        c.beginPath();
        c.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        c.fill();
      } else if (p.kind === 'spark') {
        c.fillStyle = p.color;
        c.globalAlpha = k;
        c.fillRect(p.x - 1, p.y - 1, p.size * 2, p.size * 2);
        c.globalAlpha = 1;
      }
    }
    for (const b of this.beams) {
      const k = b.life / 0.35;
      c.strokeStyle = `rgba(103,232,249,${k})`;
      c.lineWidth = 5 * k;
      c.beginPath();
      c.moveTo(b.x0, b.y0);
      c.lineTo(b.x1, b.y1);
      c.stroke();
      c.strokeStyle = `rgba(255,255,255,${k})`;
      c.lineWidth = 1.5;
      c.stroke();
    }
    c.restore();
    for (const p of this.ps) {
      const k = p.life / p.max;
      if (p.kind === 'chip' || p.kind === 'drop') {
        c.globalAlpha = Math.min(1, k * 2);
        c.fillStyle = p.color;
        if (p.kind === 'drop') {
          c.beginPath();
          c.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          c.fill();
        } else c.fillRect(p.x, p.y, p.size, p.size);
        c.globalAlpha = 1;
      } else if (p.kind === 'ring') {
        c.strokeStyle = p.color;
        c.globalAlpha = k;
        c.lineWidth = 2;
        c.beginPath();
        c.arc(p.x, p.y, p.size * (1 - k * 0.7), 0, Math.PI * 2);
        c.stroke();
        c.globalAlpha = 1;
      }
    }
  }

  /** Floating texts, in screen space so they stay readable at any zoom. */
  drawTexts(c: Ctx, toScreen: (x: number, y: number) => [number, number]): void {
    for (const f of this.texts) {
      const k = f.life / f.max;
      const [sx, sy] = toScreen(f.x, f.y);
      const pop = k > 0.85 ? 1 + (k - 0.85) * 3 : 1;
      c.font = `900 ${Math.round(f.size * pop)}px var(--cc-font, system-ui), system-ui, sans-serif`;
      c.textAlign = 'center';
      c.globalAlpha = Math.min(1, k * 2.5);
      c.lineWidth = 4;
      c.strokeStyle = 'rgba(10,8,20,0.85)';
      c.strokeText(f.text, sx, sy);
      c.fillStyle = f.color;
      c.fillText(f.text, sx, sy);
      c.globalAlpha = 1;
    }
  }
}
