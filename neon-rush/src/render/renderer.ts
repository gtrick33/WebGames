import { Application, Container, Graphics, Sprite, Text, TilingSprite, Texture } from 'pixi.js';
import { ArtLibrary } from './art';
import { ParticleSystem } from './particles';
import { LANE_WIDTH, PLAYER, ROAD_WIDTH, VIEW_MIN_HEIGHT, VIEW_MIN_WIDTH, type PowerUpKind } from '../game/config';
import type { World, WorldEvent } from '../game/world';
import { getSkin, type SkinDef } from '../cosmetics/skins';
import { clamp, damp, lerp } from '../core/math';

/** Colour zones that cycle as the run goes on. */
const ZONES: { edgeA: number; edgeB: number; grid: number; sky: number }[] = [
  { edgeA: 0x22e4ff, edgeB: 0xff3fd2, grid: 0x7a2bff, sky: 0x07041a },
  { edgeA: 0xff3fd2, edgeB: 0xffb020, grid: 0xff2f7d, sky: 0x12041a },
  { edgeA: 0x3dffc4, edgeB: 0x2a8cff, grid: 0x1fb8a8, sky: 0x02121a },
  { edgeA: 0xffe14a, edgeB: 0xff4ad8, grid: 0xb84aff, sky: 0x0e0620 },
];
const ZONE_METERS = 1500;

const POWERUP_TINT: Record<PowerUpKind, number> = { magnet: 0xff3fd2, shield: 0x22e4ff, double: 0xffc21a };

interface Prop {
  sprite: Sprite;
  glow: Sprite | null;
  side: -1 | 1;
}

interface Popup {
  text: Text;
  life: number;
  vy: number;
}

export interface RenderSettings {
  lowQuality: boolean;
  screenShake: boolean;
}

export class GameRenderer {
  readonly app: Application;
  readonly art: ArtLibrary;
  private root = new Container();
  private worldLayer = new Container();
  private ground: TilingSprite;
  private road: TilingSprite;
  private edges = new Graphics();
  private edgeGlowL: Sprite;
  private edgeGlowR: Sprite;
  private propLayer = new Container();
  private props: Prop[] = [];
  private pickupLayer = new Container();
  private hazardLayer = new Container();
  private lightLayer = new Container();
  private playerLayer = new Container();
  private fxLayer = new Container();
  private screenLayer = new Container();
  private coinSprites: Sprite[] = [];
  private coinGlows: Sprite[] = [];
  private powerSprites: Sprite[] = [];
  private hazardSprites: Sprite[] = [];
  private hazardLights: Sprite[] = [];
  private trail: Sprite[] = [];
  private trailX: number[] = [];
  private player: Sprite;
  private underglow: Sprite;
  private headBeam: Sprite;
  private shieldRing: Sprite;
  private magnetRing: Sprite;
  private particles: ParticleSystem;
  private popups: Popup[] = [];
  private streaks: Sprite[] = [];
  private flash: Sprite;

  private skin: SkinDef = getSkin('neon_cyan');
  private scale = 1;
  viewWidth = VIEW_MIN_WIDTH;
  viewHeight = VIEW_MIN_HEIGHT;
  private shakeAmt = 0;
  private time = 0;
  private zoneT = 0;
  private settings: RenderSettings;

  private constructor(app: Application, settings: RenderSettings) {
    this.app = app;
    this.settings = settings;
    this.art = new ArtLibrary(app.renderer);
    const art = this.art;

    this.ground = new TilingSprite({ texture: art.grid, width: 100, height: 100 });
    this.road = new TilingSprite({ texture: art.road, width: ROAD_WIDTH, height: 100 });
    this.road.anchor.set(0.5, 0);
    this.edgeGlowL = this.makeGlow(art.streak, 0x22e4ff);
    this.edgeGlowR = this.makeGlow(art.streak, 0xff3fd2);

    this.player = new Sprite(art.skinTexture(this.skin));
    this.player.anchor.set(0.5);
    this.underglow = this.makeGlow(art.glow, this.skin.glow);
    this.headBeam = this.makeGlow(art.glow, 0xdff8ff);
    this.shieldRing = this.makeGlow(art.ring, 0x22e4ff);
    this.magnetRing = this.makeGlow(art.ring, 0xff3fd2);
    for (let i = 0; i < 16; i++) {
      const s = this.makeGlow(art.spark, this.skin.trail[0]);
      this.trail.push(s);
      this.trailX.push(0);
    }

    this.particles = new ParticleSystem(art.spark, settings.lowQuality ? 120 : 260);
    this.flash = new Sprite(Texture.WHITE);
    this.flash.alpha = 0;
    for (let i = 0; i < 14; i++) {
      const s = this.makeGlow(art.streak, 0xffffff);
      s.alpha = 0;
      this.streaks.push(s);
    }

    this.buildScene();
  }

  static async create(parent: HTMLElement, settings: RenderSettings): Promise<GameRenderer> {
    const app = new Application();
    await app.init({
      resizeTo: parent,
      background: '#05020f',
      antialias: !settings.lowQuality,
      resolution: Math.min(window.devicePixelRatio || 1, settings.lowQuality ? 1 : 2),
      autoDensity: true,
      preference: 'webgl',
      powerPreference: 'high-performance',
    });
    app.canvas.setAttribute('aria-label', 'Game view');
    parent.appendChild(app.canvas);
    const r = new GameRenderer(app, settings);
    r.resize();
    return r;
  }

  private makeGlow(tex: Texture, tint: number): Sprite {
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    s.tint = tint;
    s.blendMode = 'add';
    return s;
  }

  private buildScene(): void {
    const stage = this.app.stage;
    stage.addChild(this.root);
    this.root.addChild(this.worldLayer, this.screenLayer);
    this.worldLayer.addChild(this.ground, this.propLayer, this.road, this.edges, this.edgeGlowL, this.edgeGlowR);
    this.worldLayer.addChild(this.pickupLayer, this.lightLayer, this.hazardLayer, this.playerLayer, this.particles.container, this.fxLayer);
    this.playerLayer.addChild(...this.trail, this.underglow, this.headBeam, this.player, this.shieldRing, this.magnetRing);
    this.screenLayer.addChild(...this.streaks, this.flash);

    // Scenery props on both sides: rooftops and light posts.
    const art = this.art;
    for (let i = 0; i < 14; i++) {
      const side: -1 | 1 = i % 2 === 0 ? -1 : 1;
      const isPost = i < 8;
      const sprite = new Sprite(isPost ? art.post : art.buildings[i % art.buildings.length]);
      sprite.anchor.set(0.5);
      if (isPost && side === -1) sprite.scale.x = -1;
      const glow = isPost ? this.makeGlow(art.glow, 0xffffff) : null;
      if (glow) {
        glow.scale.set(0.9);
        glow.alpha = 0.45;
        this.lightLayer.addChild(glow);
      }
      this.propLayer.addChild(sprite);
      this.props.push({ sprite, glow, side });
    }
    for (let i = 0; i < 6; i++) {
      const t = new Text({
        text: '',
        style: { fontFamily: 'Orbitron, system-ui, sans-serif', fontWeight: '900', fontSize: 22, fill: 0xffffff, stroke: { color: 0x14062b, width: 4 }, align: 'center' },
        resolution: 2,
      });
      t.anchor.set(0.5);
      t.visible = false;
      this.fxLayer.addChild(t);
      this.popups.push({ text: t, life: 0, vy: 0 });
    }
  }

  setSettings(settings: RenderSettings): void {
    this.settings = settings;
    this.particles.setBudget(settings.lowQuality ? 120 : 260);
  }

  setSkin(skinId: string): void {
    this.skin = getSkin(skinId);
    this.player.texture = this.art.skinTexture(this.skin);
    this.underglow.tint = this.skin.glow;
  }

  /** Fit the logical view into the canvas. Returns the logical view height for the simulation. */
  resize(): number {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    this.scale = Math.min(w / VIEW_MIN_WIDTH, h / VIEW_MIN_HEIGHT);
    this.viewWidth = w / this.scale;
    this.viewHeight = h / this.scale;
    this.worldLayer.scale.set(this.scale);
    this.worldLayer.position.set(w / 2, 0);

    this.ground.width = this.viewWidth + 128;
    this.ground.height = this.viewHeight + 128;
    this.ground.position.set(-this.viewWidth / 2 - 64, -64);
    this.road.height = this.viewHeight;
    this.road.position.set(0, 0);
    this.drawEdges();

    this.flash.width = w;
    this.flash.height = h;
    let i = 0;
    for (const p of this.props) {
      p.sprite.y = (i * this.viewHeight) / 7;
      i++;
    }
    return this.viewHeight;
  }

  private lastW = 0;
  private lastH = 0;

  /** Re-layout if the canvas size changed (Pixi resizes the canvas itself). */
  checkResize(): boolean {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    if (w === this.lastW && h === this.lastH) return false;
    this.lastW = w;
    this.lastH = h;
    this.resize();
    return true;
  }

  private drawEdges(): void {
    const half = ROAD_WIDTH / 2;
    const h = this.viewHeight;
    this.edges.clear();
    this.edges.rect(-half - 10, 0, 10, h).fill({ color: 0x0a0716 });
    this.edges.rect(half, 0, 10, h).fill({ color: 0x0a0716 });
    this.edges.rect(-half - 3, 0, 3, h).fill({ color: 0xffffff });
    this.edges.rect(half, 0, 3, h).fill({ color: 0xffffff });
    for (const [g, x] of [[this.edgeGlowL, -half - 1.5], [this.edgeGlowR, half + 1.5]] as const) {
      g.position.set(x, h / 2);
      g.width = 26;
      g.height = h * 1.4;
      g.alpha = 0.75;
    }
  }

  get pixelScale(): number {
    return this.scale;
  }

  /** Convert a client X coordinate to a side of the road: -1 left, 1 right. */
  sideOfScreen(clientX: number): -1 | 1 {
    const rect = this.app.canvas.getBoundingClientRect();
    return clientX < rect.left + rect.width / 2 ? -1 : 1;
  }

  shake(amount: number): void {
    if (this.settings.screenShake) this.shakeAmt = Math.max(this.shakeAmt, amount);
  }

  flashScreen(alpha = 0.6): void {
    this.flash.alpha = Math.max(this.flash.alpha, alpha);
  }

  /** Per-frame draw. `scrollSpeed` is the road speed in units/s (0 when paused). */
  render(world: World, dt: number, scrollSpeed: number): void {
    this.time += dt;
    const art = this.art;
    const vh = this.viewHeight;

    // --- zone colours
    const zf = world.meters / ZONE_METERS;
    this.zoneT = lerp(this.zoneT, zf, damp(2, dt));
    const zi = Math.floor(this.zoneT);
    const zt = clamp((this.zoneT - zi) * 4 - 3, 0, 1); // blend in the last quarter of a zone
    const za = ZONES[zi % ZONES.length] ?? ZONES[0]!;
    const zb = ZONES[(zi + 1) % ZONES.length] ?? ZONES[0]!;
    this.ground.tint = mix(za.grid, zb.grid, zt);
    this.edgeGlowL.tint = mix(za.edgeA, zb.edgeA, zt);
    this.edgeGlowR.tint = mix(za.edgeB, zb.edgeB, zt);
    this.app.renderer.background.color = mix(za.sky, zb.sky, zt);
    this.ground.alpha = 0.32;

    // --- scrolling
    const scroll = scrollSpeed * dt;
    this.road.tilePosition.y += scroll;
    this.ground.tilePosition.y += scroll;
    const pulse = 0.65 + Math.sin(this.time * 3) * 0.1;
    this.edgeGlowL.alpha = pulse;
    this.edgeGlowR.alpha = pulse;

    const half = ROAD_WIDTH / 2;
    const vw = this.viewWidth;
    for (const p of this.props) {
      p.sprite.y += scroll;
      const isPost = p.glow !== null;
      if (p.sprite.y > vh + 120) {
        p.sprite.y -= vh + 240 + Math.random() * 120;
        if (!isPost) p.sprite.texture = art.buildings[Math.floor(Math.random() * art.buildings.length)] ?? art.buildings[0]!;
      }
      if (isPost) {
        p.sprite.x = p.side * (half + 22);
      } else {
        const extra = Math.max(0, vw / 2 - half - 40);
        p.sprite.x = p.side * (half + 70 + Math.min(extra, 140) * 0.5);
        p.sprite.visible = vw / 2 > half + 30;
      }
      if (p.glow) {
        p.glow.position.set(p.sprite.x - p.side * 14, p.sprite.y + 1.5);
        p.glow.tint = p.side < 0 ? this.edgeGlowL.tint : this.edgeGlowR.tint;
        p.glow.visible = !this.settings.lowQuality;
      }
    }

    // --- coins
    let ci = 0;
    for (const c of world.coins) {
      if (!c.active) continue;
      const s = this.poolSprite(this.coinSprites, this.pickupLayer, art.coin, ci);
      const g = this.poolSprite(this.coinGlows, this.lightLayer, art.glow, ci, true);
      s.position.set(c.x, c.y);
      s.scale.x = Math.max(0.15, Math.abs(Math.cos(c.phase)));
      s.scale.y = 1;
      g.position.set(c.x, c.y);
      g.tint = 0xffc21a;
      g.scale.set(0.55);
      g.alpha = 0.55;
      g.visible = !this.settings.lowQuality;
      ci++;
    }
    hideFrom(this.coinSprites, ci);
    hideFrom(this.coinGlows, ci);

    // --- power ups
    let pi = 0;
    for (const p of world.powerups) {
      if (!p.active) continue;
      const s = this.poolSprite(this.powerSprites, this.pickupLayer, art.powerups[p.kind], pi);
      s.texture = art.powerups[p.kind];
      s.position.set(p.x, p.y + Math.sin(p.phase * 4) * 4);
      s.scale.set(1 + Math.sin(p.phase * 6) * 0.06);
      pi++;
    }
    hideFrom(this.powerSprites, pi);

    // --- hazards
    let hi = 0;
    let li = 0;
    for (const h of world.hazards) {
      if (!h.active) continue;
      const tex = h.kind === 'drone' ? art.drone : art.traffic[h.kind][h.variant % art.traffic[h.kind].length] ?? art.drone;
      const s = this.poolSprite(this.hazardSprites, this.hazardLayer, tex, hi);
      s.texture = tex;
      const bob = h.kind === 'drone' ? Math.sin(h.phase * 5) * 3 : 0;
      s.position.set(h.x, h.y + bob);
      s.rotation = h.kind === 'drone' ? h.phase * 1.5 : h.changeTo >= 0 && h.telegraph <= 0 ? Math.sign(laneX(h.changeTo) - laneX(h.lane)) * 0.08 : 0;
      hi++;
      if (h.kind === 'drone') continue;
      // Tail lights glow toward the player.
      const tl = this.poolSprite(this.hazardLights, this.lightLayer, art.glow, li++, true);
      tl.position.set(h.x, h.y + h.h / 2 - 2);
      tl.tint = 0xff2440;
      tl.scale.set(0.55, 0.25);
      tl.alpha = 0.8;
      tl.visible = true;
      if (h.changeTo >= 0) {
        // Blinker on the side it is moving to.
        const on = Math.floor(this.time * 7) % 2 === 0;
        const b = this.poolSprite(this.hazardLights, this.lightLayer, art.glow, li++, true);
        const dir = Math.sign(laneX(h.changeTo) - laneX(h.lane));
        b.position.set(h.x + dir * (h.w / 2 - 2), h.y + h.h / 2 - 6);
        b.tint = 0xffa21a;
        b.scale.set(0.35);
        b.alpha = on ? 1 : 0.1;
        b.visible = true;
      }
    }
    hideFrom(this.hazardSprites, hi);
    hideFrom(this.hazardLights, li);

    // --- player
    const p = world.player;
    this.player.visible = !world.crashed;
    this.player.position.set(p.x, p.y);
    this.player.rotation = p.tilt;
    this.player.alpha = p.invuln > 0 ? (Math.floor(this.time * 16) % 2 ? 0.45 : 1) : 1;
    this.underglow.position.set(p.x, p.y + 4);
    this.underglow.scale.set(0.95, 1.25);
    this.underglow.alpha = world.crashed ? 0 : 0.55 + Math.sin(this.time * 6) * 0.08;
    this.headBeam.position.set(p.x, p.y - PLAYER.height / 2 - 34);
    this.headBeam.scale.set(0.7, 0.9);
    this.headBeam.alpha = world.crashed ? 0 : 0.22;

    // Trail: history of x positions, drawn behind the car moving with the road.
    this.trailX.unshift(p.x);
    this.trailX.length = this.trail.length;
    const speedT = clamp((world.speed - 560) / 600, 0, 1);
    for (let i = 0; i < this.trail.length; i++) {
      const s = this.trail[i]!;
      const x = this.trailX[i] ?? p.x;
      s.visible = !world.crashed && scrollSpeed > 0;
      const k = i / this.trail.length;
      s.position.set(x, p.y + PLAYER.height / 2 - 4 + i * (6 + speedT * 4));
      s.tint = i % 2 ? this.skin.trail[1] : this.skin.trail[0];
      s.scale.set(0.9 * (1 - k * 0.7), 1.4);
      s.alpha = (1 - k) * 0.55;
    }

    const shieldOn = world.active.shield > 0;
    this.shieldRing.visible = shieldOn && !world.crashed;
    if (shieldOn) {
      this.shieldRing.position.set(p.x, p.y);
      const blink = world.active.shield < 2 ? (Math.floor(this.time * 10) % 2 ? 0.3 : 0.9) : 0.8;
      this.shieldRing.scale.set(0.95 + Math.sin(this.time * 5) * 0.03, 1.05);
      this.shieldRing.alpha = blink;
    }
    const magnetOn = world.active.magnet > 0;
    this.magnetRing.visible = magnetOn && !world.crashed;
    if (magnetOn) {
      this.magnetRing.position.set(p.x, p.y);
      const t = (this.time * 1.4) % 1;
      this.magnetRing.scale.set(1.4 + t * 2.2);
      this.magnetRing.alpha = (1 - t) * 0.5;
    }

    // --- speed streaks (screen space)
    const sw = this.app.screen.width;
    const sh = this.app.screen.height;
    const streakOn = scrollSpeed > 0 ? speedT : 0;
    for (const s of this.streaks) {
      if (s.alpha <= 0.01 && Math.random() < 0.05 * streakOn) {
        const side = Math.random() < 0.5 ? -1 : 1;
        s.x = sw / 2 + side * (sw * 0.3 + Math.random() * sw * 0.2);
        s.y = -60;
        s.alpha = 0.25 + streakOn * 0.35;
        s.height = 120 + streakOn * 160;
        s.width = 3;
      }
      if (s.alpha > 0.01) {
        s.y += (scrollSpeed * 1.6 + 400) * this.scale * dt;
        if (s.y > sh + 200) s.alpha = 0;
      }
    }

    // --- particles & popups
    this.particles.update(dt);
    for (const pp of this.popups) {
      if (pp.life <= 0) continue;
      pp.life -= dt;
      pp.text.y += pp.vy * dt;
      pp.text.alpha = clamp(pp.life / 0.35, 0, 1);
      pp.text.visible = pp.life > 0;
    }

    // --- screen fx
    if (this.shakeAmt > 0.05) {
      this.root.position.set((Math.random() - 0.5) * this.shakeAmt, (Math.random() - 0.5) * this.shakeAmt);
      this.shakeAmt *= Math.exp(-dt * 9);
    } else {
      this.root.position.set(0, 0);
      this.shakeAmt = 0;
    }
    if (this.flash.alpha > 0) this.flash.alpha = Math.max(0, this.flash.alpha - dt * 2.8);
  }

  /** React to simulation events with particles, popups and shakes. */
  handleEvents(events: readonly WorldEvent[], world: World): void {
    const lq = this.settings.lowQuality;
    for (const e of events) {
      switch (e.type) {
        case 'coin':
          this.particles.burst(e.x, e.y, lq ? 4 : 9, 0xffd23d, 160, 0.4, 0.5);
          this.particles.ring(e.x, e.y, 0xffd23d, this.art.ring, 0.35);
          break;
        case 'nearMiss':
          this.particles.burst(e.x, e.y, lq ? 6 : 14, 0x7ff6ff, 260, 0.45, 0.6);
          this.popup(e.x, e.y - 70, world.combo > 1 ? `NEAR MISS x${world.combo}` : 'NEAR MISS', world.combo > 2 ? 0xff7ad9 : 0x7ff6ff);
          this.shake(3);
          break;
        case 'powerup':
          this.particles.burst(e.x, e.y, lq ? 8 : 20, POWERUP_TINT[e.kind ?? 'magnet'], 240, 0.6, 0.7);
          this.particles.ring(e.x, e.y, POWERUP_TINT[e.kind ?? 'magnet'], this.art.ring, 0.5);
          this.popup(e.x, e.y - 50, e.kind === 'magnet' ? 'MAGNET' : e.kind === 'shield' ? 'SHIELD' : 'DOUBLE COINS', POWERUP_TINT[e.kind ?? 'magnet']);
          break;
        case 'shieldHit':
          this.particles.burst(e.x, e.y, lq ? 14 : 34, 0x22e4ff, 380, 0.7, 0.9);
          this.particles.ring(e.x, e.y, 0x22e4ff, this.art.ring, 0.6);
          this.shake(10);
          this.flashScreen(0.25);
          break;
        case 'crash':
          this.particles.burst(e.x, e.y, lq ? 24 : 60, 0xffa24a, 460, 0.9, 1.2);
          this.particles.burst(e.x, e.y, lq ? 10 : 24, this.skin.glow, 300, 0.8, 1);
          this.particles.ring(e.x, e.y, 0xffffff, this.art.ring, 0.7);
          this.shake(22);
          this.flashScreen(0.7);
          break;
        case 'laneChange':
          if (!lq) this.particles.burst(e.x, e.y + PLAYER.height / 2, 3, this.skin.trail[0], 90, 0.25, 0.35);
          break;
        case 'blinker':
          break;
      }
    }
  }

  private popup(x: number, y: number, text: string, color: number): void {
    const p = this.popups.find((pp) => pp.life <= 0) ?? this.popups[0]!;
    p.text.text = text;
    p.text.style.fill = color;
    p.text.position.set(clamp(x, -ROAD_WIDTH / 2 + 80, ROAD_WIDTH / 2 - 80), y);
    p.text.alpha = 1;
    p.text.visible = true;
    p.life = 0.9;
    p.vy = -70;
  }

  private poolSprite(pool: Sprite[], layer: Container, tex: Texture, i: number, additive = false): Sprite {
    let s = pool[i];
    if (!s) {
      s = new Sprite(tex);
      s.anchor.set(0.5);
      if (additive) s.blendMode = 'add';
      layer.addChild(s);
      pool.push(s);
    }
    s.visible = true;
    return s;
  }

  clearTransient(): void {
    this.particles.clear();
    for (const p of this.popups) {
      p.life = 0;
      p.text.visible = false;
    }
    this.trailX.fill(0);
    this.shakeAmt = 0;
    this.flash.alpha = 0;
  }

  destroy(): void {
    this.app.destroy(true, { children: true, texture: true });
  }
}

function hideFrom(pool: Sprite[], from: number): void {
  for (let i = from; i < pool.length; i++) {
    const s = pool[i];
    if (s) s.visible = false;
  }
}

function laneX(lane: number): number {
  return lane * LANE_WIDTH;
}

function mix(a: number, b: number, t: number): number {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const r = lerp((a >> 16) & 255, (b >> 16) & 255, t);
  const g = lerp((a >> 8) & 255, (b >> 8) & 255, t);
  const bl = lerp(a & 255, b & 255, t);
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
}

