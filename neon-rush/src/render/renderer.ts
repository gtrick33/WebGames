import { Application, Container, Graphics, Sprite, Text, TilingSprite, Texture, UPDATE_PRIORITY } from 'pixi.js';
import { ArtLibrary, TRAFFIC_COLORS } from './art';
import { CarFxFilter } from './carfx';
import { ParticleSystem } from './particles';
import { APPROACH_FACTOR, LANE_WIDTH, PLAYER, ROAD_WIDTH, VIEW_MIN_HEIGHT, VIEW_MIN_WIDTH, type PowerUpKind } from '../game/config';
import type { World, WorldEvent } from '../game/world';
import { getSkin, type SkinDef } from '../cosmetics/skins';
import { clamp, damp, lerp } from '../core/math';

type Theme = 'city' | 'palms' | 'signs';

/** Colour zones that cycle as the run goes on, each with its own roadside scenery. */
const ZONES: { name: string; edgeA: number; edgeB: number; grid: number; sky: number; theme: Theme }[] = [
  { name: 'NEON CITY', edgeA: 0x22e4ff, edgeB: 0xff3fd2, grid: 0x8a3bff, sky: 0x0a0624, theme: 'city' },
  { name: 'SUNSET STRIP', edgeA: 0xff8a3d, edgeB: 0xff3fd2, grid: 0xff3f8a, sky: 0x1c0620, theme: 'palms' },
  { name: 'CYBER GRID', edgeA: 0x3dffa8, edgeB: 0x22e4ff, grid: 0x1fe0b8, sky: 0x02161c, theme: 'signs' },
  { name: 'AURORA DRIVE', edgeA: 0x8a5cff, edgeB: 0x3dffc4, grid: 0x5a6bff, sky: 0x060a26, theme: 'palms' },
  { name: 'ULTRAVIOLET', edgeA: 0xffe14a, edgeB: 0xc84dff, grid: 0xc84dff, sky: 0x14041f, theme: 'signs' },
];
/** Music tempo (matches the synth loop), used to pulse the lights on the beat. */
const BEAT = 60 / 112;
const ZONE_METERS = 1500;
/** Frame-rate guard: lowest resolution it may drop to, the slow-frame threshold (ms) and the time between decisions (ms). */
const MIN_RESOLUTION = 0.75;
const SLOW_FRAME_MS = 22;
const ADAPT_EVERY_MS = 2000;

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
  private flash: Sprite;
  private carFx: CarFxFilter | null = null;
  private lasers: Sprite[] = [];
  private laneGlow: TilingSprite;
  private motes: Sprite[] = [];
  private trafficGlows: Sprite[] = [];
  private trailAcc = 0;
  private boltTimer = 0;
  private lastZone = 0;

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
    this.laneGlow = new TilingSprite({ texture: art.laneGlow, width: ROAD_WIDTH, height: 100 });
    this.laneGlow.anchor.set(0.5, 0);
    this.laneGlow.blendMode = 'add';
    for (let i = 0; i < 2; i++) {
      const l = this.makeGlow(art.streak, 0xffffff);
      l.anchor.set(0.5, 0);
      this.lasers.push(l);
    }
    for (let i = 0; i < 26; i++) {
      const m = this.makeGlow(i % 3 === 0 ? art.star : art.spark, 0xffffff);
      m.position.set((Math.random() - 0.5) * VIEW_MIN_WIDTH * 1.6, Math.random() * VIEW_MIN_HEIGHT);
      m.scale.set(0.2 + Math.random() * 0.35);
      m.alpha = 0.25 + Math.random() * 0.4;
      this.motes.push(m);
    }
    // Animated paint shaders need WebGL; without it the car simply keeps its base paint.
    if (app.renderer.name === 'webgl') this.carFx = new CarFxFilter();

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

    this.particles = new ParticleSystem(art.spark, settings.lowQuality ? 160 : 400);
    this.flash = new Sprite(Texture.WHITE);
    this.flash.alpha = 0;

    this.buildScene();
  }

  static async create(parent: HTMLElement, settings: RenderSettings): Promise<GameRenderer> {
    const app = new Application();
    await app.init({
      resizeTo: parent,
      background: '#05020f',
      // No multisampling: everything with edges is a pre-drawn texture with its own soft border
      // (art.ts), and 4x samples per pixel were a large share of the cost at full screen.
      antialias: false,
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
    this.worldLayer.addChild(this.ground, ...this.motes, this.propLayer, this.road, this.laneGlow, this.edges, this.edgeGlowL, this.edgeGlowR);
    this.worldLayer.addChild(this.pickupLayer, this.lightLayer, this.hazardLayer, this.playerLayer, this.particles.container, this.fxLayer);
    this.playerLayer.addChild(...this.trail, ...this.lasers, this.underglow, this.headBeam, this.player, this.shieldRing, this.magnetRing);
    this.screenLayer.addChild(this.flash);

    // Scenery props on both sides: rooftops and light posts.
    const art = this.art;
    for (let i = 0; i < 16; i++) {
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
    this.particles.setBudget(settings.lowQuality ? 160 : 400);
    this.applyResolution();
  }

  private still = false;

  /**
   * A still scene (the pause screen) stops being redrawn: the last frame stays on the canvas, and
   * the blurred overlay on top doesn't have to be recomputed every frame either.
   */
  setStill(still: boolean): void {
    if (still === this.still) return;
    this.still = still;
    const app = this.app;
    if (still) app.ticker.remove(app.render, app);
    else app.ticker.add(app.render, app, UPDATE_PRIORITY.LOW);
  }

  /** Frame-rate guard state (see trackFrame). */
  private frameAvg = 16;
  private quality = 2;
  private qualityLocked = false;
  private adaptAt = performance.now();
  private lastStep: { avg: number; from: number } | null = null;

  /** Canvas pixels per CSS pixel: the screen's ratio, at most 2 (1 in low quality), lowered by the frame-rate guard. */
  private targetResolution(): number {
    return Math.min(window.devicePixelRatio || 1, this.settings.lowQuality ? 1 : 2, this.quality);
  }

  private applyResolution(): void {
    const r = this.targetResolution();
    if (Math.abs(this.app.renderer.resolution - r) > 1e-3) this.app.renderer.resolution = r;
  }

  /**
   * Frame-rate guard, fed every tick while the game is animating: if frames average over 22 ms
   * (below ~45 fps), draw fewer pixels, 0.25 at a time and at most every 2 s, down to 0.75. A step
   * that doesn't speed frames up (the browser caps the frame rate, e.g. battery saver) is undone
   * and the guard stops.
   */
  trackFrame(ms: number, active: boolean): void {
    const now = performance.now();
    if (!active || document.hidden || this.qualityLocked) {
      this.adaptAt = now;
      return;
    }
    this.frameAvg += (Math.min(100, ms) - this.frameAvg) * 0.05;
    if (now - this.adaptAt < ADAPT_EVERY_MS) return;
    this.adaptAt = now;
    const step = this.lastStep;
    this.lastStep = null;
    if (step && this.frameAvg > step.avg * 0.9) {
      this.quality = step.from;
      this.qualityLocked = true;
      this.applyResolution();
      return;
    }
    const res = this.targetResolution();
    if (this.frameAvg > SLOW_FRAME_MS && res > MIN_RESOLUTION) {
      this.lastStep = { avg: this.frameAvg, from: this.quality };
      this.quality = Math.max(MIN_RESOLUTION, res - 0.25);
      this.applyResolution();
    }
  }

  setSkin(skinId: string): void {
    this.skin = getSkin(skinId);
    this.player.texture = this.art.skinTexture(this.skin);
    this.underglow.tint = this.skin.glow;
    this.lasers[0]!.tint = this.skin.trail[0];
    this.lasers[1]!.tint = this.skin.trail[1];
    if (this.carFx && this.skin.shader !== 'none') {
      this.carFx.setFx(this.skin.shader, this.skin.glow);
      this.player.filters = [this.carFx];
    } else {
      this.player.filters = [];
    }
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
    this.laneGlow.height = this.viewHeight;
    this.drawEdges();

    this.flash.width = w;
    this.flash.height = h;
    let i = 0;
    for (const p of this.props) {
      p.sprite.y = (i * this.viewHeight) / 8;
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
  private lastWorld: World | null = null;
  private lastDist = 0;

  /**
   * Per-frame draw. `scrollSpeed` is 0 when the world is frozen (paused, crashed).
   * `lead` is simulation time not yet stepped (the fixed-step accumulator): everything is drawn that far
   * ahead so motion stays perfectly even even when a frame runs 1, 2 or 3 simulation steps.
   */
  render(world: World, dt: number, scrollSpeed: number, lead = 0): void {
    const moving = scrollSpeed > 0 && !world.crashed;
    const ahead = moving ? lead : 0;
    // Traffic/pickup offset for the not-yet-simulated time (they all share one traffic frame).
    const hazLead = world.speed * APPROACH_FACTOR * ahead;
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
    const edgeA = mix(za.edgeA, zb.edgeA, zt);
    const edgeB = mix(za.edgeB, zb.edgeB, zt);
    this.ground.tint = mix(za.grid, zb.grid, zt);
    this.edgeGlowL.tint = edgeA;
    this.edgeGlowR.tint = edgeB;
    this.laneGlow.tint = mix(edgeA, edgeB, 0.5);
    this.app.renderer.background.color = mix(za.sky, zb.sky, zt);
    // Lights pulse on the music's beat.
    const beat = Math.exp(-((this.time % BEAT) / 0.11));
    this.ground.alpha = 0.5 + beat * 0.15;
    this.road.tint = mix(0xffffff, mix(edgeA, edgeB, 0.5), 0.18);
    const zoneNow = Math.floor(zf);
    if (zoneNow !== this.lastZone) {
      this.lastZone = zoneNow;
      if (zoneNow > 0) this.popup(0, vh * 0.3, ZONES[zoneNow % ZONES.length]!.name, edgeA, 1.8);
    }
    const theme = za.theme;

    // --- scrolling
    // Scroll the road by the distance the simulation actually covered, so road and traffic move in lockstep.
    const simDist = world.distanceUnits + world.speed * ahead;
    let scroll = simDist - this.lastDist;
    if (this.lastWorld !== world || scroll < 0 || scroll > 4000) scroll = 0;
    this.lastWorld = world;
    this.lastDist = simDist;
    this.road.tilePosition.y += scroll;
    this.ground.tilePosition.y += scroll;
    this.laneGlow.tilePosition.y = this.road.tilePosition.y;
    this.laneGlow.alpha = 0.85 + beat * 0.15;
    const pulse = 0.7 + beat * 0.3;
    this.edgeGlowL.alpha = pulse;
    this.edgeGlowR.alpha = pulse;
    this.edgeGlowL.width = this.edgeGlowR.width = 46 + beat * 16;

    // Ambient light motes drift slower than the road (depth).
    const lq = this.settings.lowQuality;
    for (let i = 0; i < this.motes.length; i++) {
      const m = this.motes[i]!;
      m.visible = !lq;
      m.y += scroll * 0.35 + dt * 12;
      m.x += Math.sin(this.time * 0.7 + i) * dt * 8;
      if (m.y > vh + 20) {
        m.y = -20;
        m.x = (Math.random() - 0.5) * this.viewWidth;
      }
      m.tint = i % 2 ? edgeA : edgeB;
    }


    const half = ROAD_WIDTH / 2;
    const vw = this.viewWidth;
    for (const p of this.props) {
      p.sprite.y += scroll;
      const isPost = p.glow !== null;
      if (p.sprite.y > vh + 120) {
        p.sprite.y -= vh + 240 + Math.random() * 120;
        if (!isPost) {
          // Scenery follows the zone theme.
          const pickFrom = theme === 'city' ? art.buildings : theme === 'palms' ? art.palms : art.signs;
          p.sprite.texture = pickFrom[Math.floor(Math.random() * pickFrom.length)] ?? art.buildings[0]!;
          p.sprite.tint = theme === 'city' ? 0xffffff : Math.random() < 0.5 ? edgeA : edgeB;
          p.sprite.rotation = theme === 'palms' ? Math.random() * Math.PI * 2 : 0;
        }
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
      s.position.set(c.x, c.y + (c.magnetized ? 0 : hazLead));
      s.scale.x = Math.max(0.15, Math.abs(Math.cos(c.phase)));
      s.scale.y = 1;
      g.position.set(s.x, s.y);
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
      s.position.set(p.x, p.y + hazLead + Math.sin(p.phase * 4) * 4);
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
      const hy = h.y + hazLead;
      s.position.set(h.x, hy + bob);
      s.rotation = h.kind === 'drone' ? h.phase * 1.5 : h.changeTo >= 0 && h.telegraph <= 0 ? Math.sign(laneX(h.changeTo) - laneX(h.lane)) * 0.08 : 0;
      // Neon underglow on traffic (one slot per hazard keeps the pool aligned).
      const ug = this.poolSprite(this.trafficGlows, this.lightLayer, art.glow, hi, true);
      ug.visible = !lq && h.kind !== 'drone';
      ug.position.set(h.x, hy);
      ug.tint = TRAFFIC_COLORS[h.variant % TRAFFIC_COLORS.length] ?? 0xffffff;
      ug.scale.set(h.w / 70, h.h / 64);
      ug.alpha = 0.55;
      hi++;
      if (h.kind === 'drone') continue;
      // Tail lights glow toward the player.
      const tl = this.poolSprite(this.hazardLights, this.lightLayer, art.glow, li++, true);
      tl.position.set(h.x, hy + h.h / 2 - 2);
      tl.tint = 0xff2440;
      tl.scale.set(0.55, 0.25);
      tl.alpha = 0.8;
      tl.visible = true;
      if (h.changeTo >= 0) {
        // Blinker on the side it is moving to.
        const on = Math.floor(this.time * 7) % 2 === 0;
        const b = this.poolSprite(this.hazardLights, this.lightLayer, art.glow, li++, true);
        const dir = Math.sign(laneX(h.changeTo) - laneX(h.lane));
        b.position.set(h.x + dir * (h.w / 2 - 2), hy + h.h / 2 - 6);
        b.tint = 0xffa21a;
        b.scale.set(0.35);
        b.alpha = on ? 1 : 0.1;
        b.visible = true;
      }
    }
    hideFrom(this.hazardSprites, hi);
    hideFrom(this.hazardLights, li);
    hideFrom(this.trafficGlows, hi);

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

    if (this.carFx) this.carFx.tick(this.time);
    if (this.skin.shape === 'hover') {
      this.underglow.scale.set(1.2, 1.45);
      this.underglow.alpha = world.crashed ? 0 : 0.75 + Math.sin(this.time * 9) * 0.1;
    }
    this.updateTrail(world, dt, scrollSpeed);

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

  /** Per-skin trail: ribbon/rainbow sprites, twin lasers, or a particle emitter. */
  private updateTrail(world: World, dt: number, scrollSpeed: number): void {
    const p = world.player;
    const skin = this.skin;
    const style = skin.trailStyle;
    const running = !world.crashed && scrollSpeed > 0;
    const speedT = clamp((world.speed - 560) / 600, 0, 1);
    const rearY = p.y + PLAYER.height / 2 - 4;

    // Ribbon history (also used to bend lasers).
    this.trailX.unshift(p.x);
    this.trailX.length = this.trail.length;
    const ribbon = style === 'ribbon' || style === 'rainbow';
    for (let i = 0; i < this.trail.length; i++) {
      const s = this.trail[i]!;
      s.visible = ribbon && running;
      if (!s.visible) continue;
      const k = i / this.trail.length;
      s.position.set(this.trailX[i] ?? p.x, rearY + i * (6 + speedT * 4));
      s.tint = style === 'rainbow' ? hsv((this.time * 0.6 + i * 0.07) % 1, 0.85, 1) : i % 2 ? skin.trail[1] : skin.trail[0];
      s.scale.set(0.9 * (1 - k * 0.7), 1.4);
      s.alpha = (1 - k) * 0.6;
    }

    const lasers = style === 'laser' && running;
    for (let i = 0; i < this.lasers.length; i++) {
      const l = this.lasers[i]!;
      l.visible = lasers;
      if (!lasers) continue;
      const side = i === 0 ? -1 : 1;
      const lag = (this.trailX[6] ?? p.x) - p.x;
      l.position.set(p.x + side * 9 + lag * 0.3, rearY - 4);
      l.rotation = -lag * 0.004;
      l.width = 4;
      l.height = 90 + speedT * 110;
      l.alpha = 0.8 + Math.sin(this.time * 30 + i) * 0.15;
    }

    if (!running || ribbon || lasers) return;
    const rates: Record<string, number> = { flame: 70, spark: 45, smoke: 26, stardust: 30, pixel: 42, lightning: 30 };
    const rate = (rates[style] ?? 30) * (this.settings.lowQuality ? 0.5 : 1);
    this.trailAcc += dt * rate;
    const art = this.art;
    const drift = scrollSpeed * 0.45;
    while (this.trailAcc >= 1) {
      this.trailAcc -= 1;
      const x = p.x + (Math.random() - 0.5) * 16;
      const tint = Math.random() < 0.5 ? skin.trail[0] : skin.trail[1];
      switch (style) {
        case 'flame':
          this.particles.emit({ x, y: rearY, vx: (Math.random() - 0.5) * 40, vy: drift + 40 + Math.random() * 60, life: 0.32, size: 0.24 + Math.random() * 0.12, tint, tex: art.glow });
          break;
        case 'spark':
          this.particles.emit({ x, y: rearY, vx: (Math.random() - 0.5) * 140, vy: drift + Math.random() * 90, life: 0.4, size: 0.4, tint });
          break;
        case 'smoke':
          this.particles.emit({ x, y: rearY + 4, vx: (Math.random() - 0.5) * 30, vy: drift * 0.9, life: 0.9, size: 0.12, tint: shadeColor(tint, 0.6), tex: art.glow, additive: false, grow: 2.2, alpha: 0.4 });
          break;
        case 'stardust':
          this.particles.emit({ x, y: rearY, vx: (Math.random() - 0.5) * 60, vy: drift * 0.7 + Math.random() * 30, life: 1.0, size: 0.35 + Math.random() * 0.25, tint, tex: art.star, spin: 4 });
          break;
        case 'pixel':
          this.particles.emit({ x: Math.round(x / 5) * 5, y: rearY, vx: (Math.random() - 0.5) * 50, vy: drift, life: 0.55, size: 0.9, tint, tex: art.square });
          break;
        case 'lightning':
          this.particles.emit({ x, y: rearY, vx: (Math.random() - 0.5) * 220, vy: drift + Math.random() * 120, life: 0.22, size: 0.35, tint });
          break;
      }
    }
    if (style === 'lightning') {
      this.boltTimer -= dt;
      if (this.boltTimer <= 0) {
        this.boltTimer = 0.18 + Math.random() * 0.3;
        // A short jagged arc behind the car.
        let bx = p.x + (Math.random() - 0.5) * 10;
        for (let k = 0; k < 7; k++) {
          bx += (Math.random() - 0.5) * 18;
          this.particles.emit({ x: bx, y: rearY + 6 + k * 9, vx: 0, vy: drift, life: 0.14, size: 0.32, tint: k % 2 ? 0xffffff : skin.trail[0] });
        }
      }
    }
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

  private popup(x: number, y: number, text: string, color: number, life = 0.9): void {
    const p = this.popups.find((pp) => pp.life <= 0) ?? this.popups[0]!;
    p.text.text = text;
    p.text.style.fill = color;
    p.text.position.set(clamp(x, -ROAD_WIDTH / 2 + 80, ROAD_WIDTH / 2 - 80), y);
    p.text.alpha = 1;
    p.text.visible = true;
    p.life = life;
    p.vy = life > 1 ? -12 : -70;
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

function hsv(h: number, s: number, v: number): number {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const [r, g, b] = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6] as [number, number, number];
  return (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255);
}

function shadeColor(c: number, f: number): number {
  return (Math.round(((c >> 16) & 255) * f) << 16) | (Math.round(((c >> 8) & 255) * f) << 8) | Math.round((c & 255) * f);
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

