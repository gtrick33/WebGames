import { Graphics, Texture, type Renderer } from 'pixi.js';
import type { SkinDef } from '../cosmetics/skins';
import { drawCar, drawSportsCar, linear, shade } from './cars';

export { shade };
import { LANES, LANE_WIDTH, ROAD_WIDTH, type HazardKind, type PowerUpKind } from '../game/config';

/**
 * Procedural, original vector art. Everything is drawn once into textures and reused,
 * so the game ships without any image downloads.
 */

const TEX_RES = 2;
/**
 * Transparent border (world units) around generated textures. The screen is drawn without
 * multisampling (cheaper at full screen), so tilted and spinning sprites get their smooth edges
 * from this border instead: the texture filtering fades the shape out before the sprite's own edge.
 */
const TEX_PAD = 2;

function drawSedan(g: Graphics, body: number, w: number, h: number): void {
  const hw = w / 2;
  const hh = h / 2;
  g.roundRect(-hw - 1, -hh + 2, w + 2, h + 2, 10).fill({ color: 0x000000, alpha: 0.35 });
  for (const [x, y] of [[-hw + 1, -hh * 0.55], [hw - 1, -hh * 0.55], [-hw + 1, hh * 0.6], [hw - 1, hh * 0.6]] as const) {
    g.roundRect(x - 4, y - 8, 8, 16, 2).fill({ color: 0x07070c });
  }
  g.roundRect(-hw + 2, -hh, w - 4, h, 9).fill(linear(shade(body, 1.1), shade(body, 0.7)));
  g.roundRect(-hw + 6, -hh * 0.45, w - 12, h * 0.62, 5).fill({ color: shade(body, 0.55) });
  g.poly([-hw + 6, -hh * 0.45, hw - 6, -hh * 0.45, hw - 9, -hh * 0.2, -hw + 9, -hh * 0.2]).fill({ color: 0x0a0d1a });
  g.poly([-hw + 7, hh * 0.38, hw - 7, hh * 0.38, hw - 5, hh * 0.58, -hw + 5, hh * 0.58]).fill({ color: 0x0a0d1a });
  g.roundRect(-hw + 4, -hh, 8, 3, 1).fill({ color: 0xfff6d8 });
  g.roundRect(hw - 12, -hh, 8, 3, 1).fill({ color: 0xfff6d8 });
  g.roundRect(-hw + 3, hh - 4, 11, 3.5, 1).fill({ color: 0xff2440 });
  g.roundRect(hw - 14, hh - 4, 11, 3.5, 1).fill({ color: 0xff2440 });
  g.roundRect(-hw + 2, -hh, w - 4, h, 9).stroke({ width: 1, color: 0xffffff, alpha: 0.12 });
}

function drawTruck(g: Graphics, body: number, w: number, h: number): void {
  const hw = w / 2;
  const hh = h / 2;
  g.roundRect(-hw - 1, -hh + 3, w + 2, h + 2, 6).fill({ color: 0x000000, alpha: 0.35 });
  for (const y of [-hh + 18, hh - 40, hh - 20]) {
    g.roundRect(-hw - 2, y - 7, 7, 14, 2).fill({ color: 0x07070c });
    g.roundRect(hw - 5, y - 7, 7, 14, 2).fill({ color: 0x07070c });
  }
  // Cab.
  g.roundRect(-hw + 3, -hh, w - 6, 34, 7).fill(linear(shade(body, 1.15), shade(body, 0.8)));
  g.poly([-hw + 6, -hh + 10, hw - 6, -hh + 10, hw - 8, -hh + 19, -hw + 8, -hh + 19]).fill({ color: 0x0a0d1a });
  g.roundRect(-hw + 5, -hh, 8, 3, 1).fill({ color: 0xfff6d8 });
  g.roundRect(hw - 13, -hh, 8, 3, 1).fill({ color: 0xfff6d8 });
  // Trailer.
  g.roundRect(-hw, -hh + 37, w, h - 37, 4).fill(linear(0x2a2d3d, 0x161826));
  for (let y = -hh + 46; y < hh - 8; y += 12) g.rect(-hw + 4, y, w - 8, 1.5).fill({ color: 0xffffff, alpha: 0.06 });
  g.rect(-hw + 2, -hh + 37, 3, h - 40).fill({ color: body, alpha: 0.9 });
  g.rect(hw - 5, -hh + 37, 3, h - 40).fill({ color: body, alpha: 0.9 });
  g.roundRect(-hw + 3, hh - 5, 10, 3.5, 1).fill({ color: 0xff2440 });
  g.roundRect(hw - 13, hh - 5, 10, 3.5, 1).fill({ color: 0xff2440 });
  g.rect(-6, hh - 5, 12, 2).fill({ color: 0xffb020 });
}

function drawDrone(g: Graphics, w: number): void {
  const r = w / 2;
  g.circle(0, 4, r * 0.95).fill({ color: 0x000000, alpha: 0.35 });
  const hex: number[] = [];
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * Math.PI) / 3;
    hex.push(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.poly(hex).fill(linear(0x3a3550, 0x1a1726));
  g.poly(hex).stroke({ width: 2, color: 0xff9a1a, alpha: 0.9 });
  // Warning chevrons.
  for (let i = -1; i <= 1; i++) {
    g.moveTo(-9 + i * 6, -6).lineTo(-3 + i * 6, 0).lineTo(-9 + i * 6, 6).stroke({ width: 2.4, color: 0xffb020 });
  }
  g.circle(0, 0, 4.5).fill({ color: 0xff3048 });
  g.circle(0, 0, 2).fill({ color: 0xffd1d6 });
}

export const TRAFFIC_COLORS = [0x4b5cff, 0x2fc6a8, 0xd94dff, 0xf2f2ff, 0xff8a3d, 0x5a6378] as const;

// ------------------------------------------------------------------ canvas helpers

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void, res = 2): Texture {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * res);
  c.height = Math.ceil(h * res);
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.scale(res, res);
    draw(ctx);
  }
  const tex = Texture.from(c);
  tex.source.resolution = res;
  tex.source.updateMipmaps?.();
  return tex;
}

function radialTexture(size: number, stops: [number, string][]): Texture {
  return canvasTexture(size, size, (ctx) => {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const [o, c] of stops) g.addColorStop(o, c);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }, 1);
}

// ------------------------------------------------------------------ texture library

export class ArtLibrary {
  readonly glow: Texture;
  readonly spark: Texture;
  readonly ring: Texture;
  readonly streak: Texture;
  readonly road: Texture;
  readonly grid: Texture;
  readonly coin: Texture;
  readonly traffic: Record<Exclude<HazardKind, 'drone'>, Texture[]>;
  readonly drone: Texture;
  readonly powerups: Record<PowerUpKind, Texture>;
  readonly buildings: Texture[];
  readonly post: Texture;
  readonly star: Texture;
  readonly square: Texture;
  readonly palms: Texture[];
  readonly signs: Texture[];
  readonly laneGlow: Texture;
  private readonly skinCache = new Map<string, Texture>();

  constructor(private readonly renderer: Renderer) {
    this.glow = radialTexture(128, [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,0.55)'], [0.6, 'rgba(255,255,255,0.12)'], [1, 'rgba(255,255,255,0)']]);
    this.spark = radialTexture(32, [[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,0.8)'], [1, 'rgba(255,255,255,0)']]);
    this.ring = canvasTexture(128, 128, (ctx) => {
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 6;
      ctx.shadowColor = 'white';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(64, 64, 52, 0, Math.PI * 2);
      ctx.stroke();
    }, 1);
    this.streak = canvasTexture(8, 128, (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 0, 128);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.9)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(2, 0, 4, 128);
    }, 1);
    this.road = this.makeRoad();
    this.grid = this.makeGrid();
    this.coin = this.gen((g) => {
      g.circle(0, 0, 15).fill(linear(0xfff3a6, 0xf0a000));
      g.circle(0, 0, 15).stroke({ width: 2, color: 0xffe066 });
      g.circle(0, 0, 10.5).stroke({ width: 1.6, color: 0xb36b00, alpha: 0.8 });
      g.poly([0, -7, 5, 0, 0, 7, -5, 0]).fill({ color: 0xfff8d6 });
      g.ellipse(-5, -6, 3, 5).fill({ color: 0xffffff, alpha: 0.5 });
    });
    this.traffic = {
      car: TRAFFIC_COLORS.map((c) => this.gen((g) => drawSedan(g, c, 48, 88))),
      sport: TRAFFIC_COLORS.map((c) =>
        this.gen((g) =>
          drawSportsCar(g, { body: [shade(c, 1.1), shade(c, 0.6)], accent: 0xffffff, glass: 0x0a0d1a, stripe: 'none', stripeColor: 0, finish: 'gloss', tail: 0xff2440, head: 0xfff6d8 }, 46, 82),
        ),
      ),
      truck: TRAFFIC_COLORS.map((c) => this.gen((g) => drawTruck(g, c, 56, 150))),
    };
    this.drone = this.gen((g) => drawDrone(g, 44));
    this.powerups = {
      magnet: this.gen((g) => {
        badge(g, 0xff3fd2);
        g.arc(0, 2, 8, Math.PI, 0, false).stroke({ width: 5, color: 0xffffff, cap: 'butt' });
        g.rect(-10.5, 1.5, 5, 7).fill({ color: 0xffffff });
        g.rect(5.5, 1.5, 5, 7).fill({ color: 0xffffff });
        g.rect(-10.5, 6, 5, 3).fill({ color: 0xff3fd2 });
        g.rect(5.5, 6, 5, 3).fill({ color: 0xff3fd2 });
      }),
      shield: this.gen((g) => {
        badge(g, 0x22e4ff);
        g.poly([0, -11, 10, -7, 9, 3, 0, 11, -9, 3, -10, -7]).fill({ color: 0xffffff });
        g.poly([0, -7, 6, -4.5, 5.5, 2, 0, 7, 0, -7]).fill({ color: 0x22e4ff, alpha: 0.6 });
      }),
      double: this.gen((g) => {
        badge(g, 0xffc21a);
        g.circle(-4, 2, 7).fill({ color: 0xffffff });
        g.circle(4, -2, 7).fill({ color: 0xfff1b0 });
        g.circle(4, -2, 7).stroke({ width: 1.5, color: 0xc88400 });
      }),
    };
    this.buildings = [0, 1, 2, 3].map((i) => this.makeBuilding(i));
    this.post = this.gen((g) => {
      g.circle(0, 0, 5).fill({ color: 0x1b1730 });
      g.rect(-2, 0, 16, 3).fill({ color: 0x2b2545 });
      g.circle(14, 1.5, 3).fill({ color: 0xffffff });
    });
    this.star = canvasTexture(32, 32, (ctx) => {
      const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.3, 'rgba(255,255,255,0.5)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.moveTo(16, 1); ctx.lineTo(18, 14); ctx.lineTo(31, 16); ctx.lineTo(18, 18);
      ctx.lineTo(16, 31); ctx.lineTo(14, 18); ctx.lineTo(1, 16); ctx.lineTo(14, 14);
      ctx.closePath();
      ctx.fill();
    }, 1);
    this.square = canvasTexture(10, 10, (ctx) => {
      ctx.fillStyle = 'white';
      ctx.fillRect(1, 1, 8, 8);
    }, 1);
    this.palms = [0, 1].map((v) => this.gen((g) => drawPalm(g, v)));
    this.signs = [0, 1, 2, 3].map((v) => this.gen((g) => drawSign(g, v)));
    this.laneGlow = canvasTexture(ROAD_WIDTH, 128, (ctx) => {
      ctx.filter = 'blur(4px)';
      for (let l = 1; l < LANES; l++) {
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillRect(l * LANE_WIDTH - 3, 22, 6, 60);
      }
      ctx.filter = 'none';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(1, 0, 4, 128);
      ctx.fillRect(ROAD_WIDTH - 5, 0, 4, 128);
    }, 1);
  }

  private gen(draw: (g: Graphics) => void, res = TEX_RES, pad = TEX_PAD): Texture {
    const g = new Graphics();
    draw(g);
    const frame = pad > 0 ? g.getLocalBounds().rectangle.clone().pad(pad) : undefined;
    const tex = this.renderer.generateTexture({ target: g, resolution: res, antialias: true, frame });
    g.destroy();
    return tex;
  }

  /** Lazily build (and cache) the player car texture for a skin. */
  skinTexture(skin: SkinDef, res = TEX_RES, pad = TEX_PAD): Texture {
    const key = `${skin.id}@${res}+${pad}`;
    const cached = this.skinCache.get(key);
    if (cached) return cached;
    const tex = this.gen(
      (g) =>
        drawCar(g, skin.shape, {
          body: skin.body, accent: skin.accent, glass: skin.glass, stripe: skin.stripe, stripeColor: skin.stripeColor,
          finish: skin.finish, tail: 0xff2a4a, head: 0xf4fdff, glow: skin.glow, number: skin.number,
        }),
      res,
      pad,
    );
    this.skinCache.set(key, tex);
    return tex;
  }

  private makeRoad(): Texture {
    const w = ROAD_WIDTH;
    const h = 128;
    return canvasTexture(w, h, (ctx) => {
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, '#1d1438');
      grad.addColorStop(0.5, '#151030');
      grad.addColorStop(1, '#1d1438');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      // Subtle asphalt speckle (deterministic).
      let s = 7;
      const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 260; i++) {
        ctx.fillStyle = `rgba(160,140,255,${0.03 + rnd() * 0.05})`;
        ctx.fillRect(rnd() * w, rnd() * h, 1.2, 1.2);
      }
      // Lane dashes.
      for (let l = 1; l < LANES; l++) {
        const x = l * LANE_WIDTH;
        ctx.fillStyle = 'rgba(150,130,255,0.18)';
        ctx.fillRect(x - 4, 20, 8, 64);
        ctx.fillStyle = 'rgba(205,195,255,0.75)';
        ctx.fillRect(x - 2, 24, 4, 56);
      }
      // Tyre wear lines inside lanes.
      for (let l = 0; l < LANES; l++) {
        const cx = l * LANE_WIDTH + LANE_WIDTH / 2;
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(cx - 17, 0, 8, h);
        ctx.fillRect(cx + 9, 0, 8, h);
      }
    }, 2);
  }

  private makeGrid(): Texture {
    const s = 64;
    return canvasTexture(s, s, (ctx) => {
      ctx.fillStyle = '#07041a';
      ctx.fillRect(0, 0, s, s);
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(0.75, 0.75, s, s);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillRect(0, 0, 3, 3);
    }, 2);
  }

  private makeBuilding(i: number): Texture {
    const sizes: [number, number][] = [[90, 120], [70, 160], [110, 90], [80, 110]];
    const [w, h] = sizes[i] as [number, number];
    const hues = [0xff3fd2, 0x22e4ff, 0xffb020, 0x8a5cff];
    const trim = hues[i] as number;
    return this.gen((g) => {
      g.rect(-w / 2 + 6, -h / 2 + 8, w, h).fill({ color: 0x000000, alpha: 0.45 });
      g.rect(-w / 2, -h / 2, w, h).fill(linear(0x1c1638, 0x110d24));
      g.rect(-w / 2, -h / 2, w, h).stroke({ width: 2, color: trim, alpha: 0.8 });
      // Rooftop units and windows of light.
      g.rect(-w / 2 + 10, -h / 2 + 12, w * 0.3, h * 0.22).fill({ color: 0x2a2350 });
      g.rect(w / 2 - 10 - w * 0.25, h / 2 - 12 - h * 0.18, w * 0.25, h * 0.18).fill({ color: 0x2a2350 });
      for (let y = -h / 2 + 14; y < h / 2 - 10; y += 14) {
        g.rect(w / 2 - 14, y, 6, 6).fill({ color: trim, alpha: 0.55 });
      }
      g.circle(-w / 2 + 16 + w * 0.15, -h / 2 + 18, 3).fill({ color: 0xff3048 });
    });
  }

  private previewCache = new Map<string, HTMLCanvasElement>();

  /** A canvas snapshot of a car for the garage (synchronous, no PNG encoding). Cached per car. */
  skinPreview(skin: SkinDef): HTMLCanvasElement {
    let c = this.previewCache.get(skin.id);
    if (!c) {
      // No border: the garage frames the car tightly.
      c = this.renderer.extract.canvas({ target: this.skinTexture(skin, 3, 0) }) as HTMLCanvasElement;
      this.previewCache.set(skin.id, c);
    }
    return c;
  }
}

/** Top-down palm tree, drawn in white so zones can tint it. */
function drawPalm(g: Graphics, variant: number): void {
  g.ellipse(6, 8, 30, 26).fill({ color: 0x000000, alpha: 0.35 });
  const fronds = variant === 0 ? 7 : 9;
  for (let i = 0; i < fronds; i++) {
    const a = (i / fronds) * Math.PI * 2 + variant * 0.3;
    const len = 30 + ((i * 7) % 5) * 2;
    const tipX = Math.cos(a) * len;
    const tipY = Math.sin(a) * len;
    const nx = -Math.sin(a) * 6;
    const ny = Math.cos(a) * 6;
    g.moveTo(0, 0).quadraticCurveTo(tipX * 0.5 + nx, tipY * 0.5 + ny, tipX, tipY).quadraticCurveTo(tipX * 0.5 - nx * 0.3, tipY * 0.5 - ny * 0.3, 0, 0).fill({ color: 0xffffff, alpha: 0.85 });
    g.moveTo(0, 0).lineTo(tipX * 0.92, tipY * 0.92).stroke({ width: 1, color: 0x000000, alpha: 0.35 });
  }
  g.circle(0, 0, 5).fill({ color: 0x3a2a1a });
  g.circle(0, 0, 3).fill({ color: 0xffffff, alpha: 0.6 });
}

/** Original neon sign shapes (white, tinted per zone). */
function drawSign(g: Graphics, variant: number): void {
  const w = 54;
  const h = 86;
  g.roundRect(-w / 2 + 4, -h / 2 + 5, w, h, 8).fill({ color: 0x000000, alpha: 0.4 });
  g.roundRect(-w / 2, -h / 2, w, h, 8).fill({ color: 0x120c26 });
  g.roundRect(-w / 2, -h / 2, w, h, 8).stroke({ width: 2.5, color: 0xffffff, alpha: 0.9 });
  const s = { width: 3.5, color: 0xffffff };
  switch (variant) {
    case 0: // chevrons
      for (let i = 0; i < 3; i++) g.moveTo(-14, -18 + i * 14).lineTo(0, -28 + i * 14).lineTo(14, -18 + i * 14).stroke(s);
      break;
    case 1: // ringed planet
      g.circle(0, 0, 13).stroke(s);
      g.ellipse(0, 0, 22, 6).stroke({ width: 2.5, color: 0xffffff });
      break;
    case 2: // lightning bolt
      g.poly([4, -30, -12, 4, -1, 4, -6, 30, 12, -6, 1, -6]).stroke(s);
      break;
    default: // seven-segment "88"
      for (const y of [-22, 6]) {
        g.rect(-12, y, 24, 3).fill({ color: 0xffffff });
        g.rect(-12, y + 14, 24, 3).fill({ color: 0xffffff });
        g.rect(-12, y, 3, 17).fill({ color: 0xffffff });
        g.rect(9, y, 3, 17).fill({ color: 0xffffff });
      }
  }
}

function badge(g: Graphics, color: number): void {
  g.circle(0, 0, 19).fill({ color: 0x0a0716, alpha: 0.85 });
  g.circle(0, 0, 19).stroke({ width: 3, color });
  g.circle(0, 0, 15).fill({ color, alpha: 0.35 });
}
