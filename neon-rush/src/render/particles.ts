import { Container, Sprite, type Texture } from 'pixi.js';

interface Particle {
  sprite: Sprite;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  ring: boolean;
  gravity: number;
  /** Scale multiplier reached at the end of life (smoke grows, sparks shrink). */
  grow: number;
  spin: number;
}

export interface EmitOptions {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  tint: number;
  tex?: Texture;
  additive?: boolean;
  gravity?: number;
  grow?: number;
  spin?: number;
  alpha?: number;
}

/** Fixed-size particle pool: no allocations during gameplay. */
export class ParticleSystem {
  readonly container = new Container();
  private pool: Particle[] = [];
  private budget: number;
  private cursor = 0;

  constructor(private readonly tex: Texture, budget: number) {
    this.budget = budget;
    for (let i = 0; i < 420; i++) {
      const sprite = new Sprite(tex);
      sprite.anchor.set(0.5);
      sprite.blendMode = 'add';
      sprite.visible = false;
      this.container.addChild(sprite);
      this.pool.push({ sprite, vx: 0, vy: 0, life: 0, maxLife: 1, size: 1, ring: false, gravity: 120, grow: 0, spin: 0 });
    }
  }

  setBudget(n: number): void {
    this.budget = Math.min(n, this.pool.length);
    this.cursor %= this.budget;
  }

  private next(): Particle {
    // Prefer a dead particle; otherwise recycle round-robin.
    for (let tries = 0; tries < this.budget; tries++) {
      this.cursor = (this.cursor + 1) % this.budget;
      const p = this.pool[this.cursor]!;
      if (p.life <= 0) return p;
    }
    this.cursor = (this.cursor + 1) % this.budget;
    return this.pool[this.cursor]!;
  }

  burst(x: number, y: number, count: number, tint: number, speed: number, life: number, size: number): void {
    for (let i = 0; i < count; i++) {
      const p = this.next();
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random() * 0.7);
      p.vx = Math.cos(a) * v;
      p.vy = Math.sin(a) * v;
      p.maxLife = p.life = life * (0.6 + Math.random() * 0.4);
      p.size = size * (0.5 + Math.random() * 0.8);
      p.ring = false;
      p.gravity = 120;
      p.grow = 0;
      p.spin = 0;
      p.sprite.blendMode = 'add';
      p.sprite.rotation = 0;
      p.sprite.texture = this.tex;
      p.sprite.position.set(x, y);
      p.sprite.tint = tint;
      p.sprite.visible = true;
    }
  }

  ring(x: number, y: number, tint: number, tex: Texture, life: number): void {
    const p = this.next();
    p.vx = 0;
    p.vy = 0;
    p.maxLife = p.life = life;
    p.size = 0.2;
    p.ring = true;
    p.sprite.blendMode = 'add';
    p.sprite.texture = tex;
    p.sprite.position.set(x, y);
    p.sprite.tint = tint;
    p.sprite.visible = true;
  }

  /** Emit one configured particle (trails, exhaust, ambient effects). */
  emit(o: EmitOptions): void {
    const p = this.next();
    p.vx = o.vx;
    p.vy = o.vy;
    p.maxLife = p.life = o.life;
    p.size = o.size;
    p.ring = false;
    p.gravity = o.gravity ?? 0;
    p.grow = o.grow ?? 0;
    p.spin = o.spin ?? 0;
    p.sprite.texture = o.tex ?? this.tex;
    p.sprite.blendMode = o.additive === false ? 'normal' : 'add';
    p.sprite.position.set(o.x, o.y);
    p.sprite.rotation = 0;
    p.sprite.tint = o.tint;
    p.sprite.alpha = o.alpha ?? 1;
    p.sprite.visible = true;
  }

  update(dt: number): void {
    const drag = Math.exp(-dt * 3);
    for (const p of this.pool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.sprite.visible = false;
        continue;
      }
      const t = p.life / p.maxLife;
      if (p.ring) {
        p.sprite.scale.set(0.2 + (1 - t) * 0.9);
        p.sprite.alpha = t;
      } else {
        p.vx *= drag;
        p.vy *= drag;
        p.sprite.x += p.vx * dt;
        p.vy += p.gravity * dt;
        p.sprite.y += p.vy * dt;
        p.sprite.rotation += p.spin * dt;
        p.sprite.scale.set(p.size * (p.grow > 0 ? 1 + (1 - t) * p.grow : t));
        p.sprite.alpha = Math.min(1, t * 1.5);
      }
    }
  }

  clear(): void {
    for (const p of this.pool) {
      p.life = 0;
      p.sprite.visible = false;
    }
  }
}
