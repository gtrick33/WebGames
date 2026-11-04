import { clamp, damp, hash2, TAU } from '../core/math';
import { currentObjective } from '../progress/character';
import { drawMapIcon, type MapIcon } from '../ui/mapIcons';
import { isMainQuest, turnInNpc } from '../progress/handin';
import { LEAD, leanTarget, LIFT } from './camera';
import { drawBolt, drawVfx } from './art/vfx';
import { THEMES } from '../data/themes';
import type { ClassId } from '../data/types';
import { hasStatus } from '../sim/combat';
import { TILE } from '../sim/map';
import type { Enemy, Fx, NpcActor, Pet, Projectile, Telegraph } from '../sim/types';
import type { World } from '../sim/world';
import { ctx2d, rgba } from './pixel';
import { glowDisc, heldWeapon, itemIconCanvas, heroLook, vendorSign, weaponSprite } from './sprites';
import type { HeroLook } from './art/hero';
import { wornLooks } from '../progress/wardrobe';
import { objectiveTarget } from '../sim/objective';
import { aimReach, autoTarget, tapAutoAims } from '../sim/cast';
import { heightFromRadius, PERSON_H, type Cast } from '../render3d/cast';
import { hexRgb, kitOf } from '../render3d/kits';
import { Land3D, type LandObject } from '../render3d/land';
import { Stage } from '../render3d/stage';
import { LIGHT } from '../render3d/toon';
import { WorldCast } from '../render3d/worldCast';

/**
 * Draws the world: the land and everyone on it in 3D (render3d/) on a canvas underneath, then this canvas on top
 * for what the rules want read clearly: warnings on the ground, spells in flight, names, bars and numbers.
 */

/** The part of the land in view, for whatever draws into it. */
export interface LandView {
  g: CanvasRenderingContext2D;
  x: number;
  y: number;
  w: number;
  h: number;
  time: number;
  /** Draws from here on in world pixels flat on the ground at (x, y). */
  flat(x: number, y: number): void;
  /** Draws from here on in world pixels facing the camera, `h` world pixels over (x, y). */
  up(x: number, y: number, h?: number): void;
  /** World pixels to the screen, in CSS pixels. */
  project(x: number, y: number, h?: number): { x: number; y: number };
  /** Plain words on the screen. */
  label(text: string, x: number, y: number, size: number, color: string, alpha?: number): void;
  /** A small bar on the screen. */
  bar(x: number, y: number, wide: number, k: number, color: string): void;
}

/** Another game's crowd, drawn into the land at the right depths (render/vigil.ts). */
export interface LandLayer {
  /** On the ground, under everyone (drawn on the top canvas, in world pixels). */
  under(g: CanvasRenderingContext2D, time: number, view: LandView): void;
  /** Who stands on the land. */
  cast?(cast: Cast, dt: number, time: number): void;
  /** Over everyone (drawn on the top canvas, in world pixels). */
  over(g: CanvasRenderingContext2D, time: number, view: LandView): void;
}

/** Aim preview the touch controls ask for while a skill button is dragged. */
export interface AimPreview {
  shape: 'line' | 'circle' | 'cone' | 'ring';
  angle: number;
  /** Line length / circle distance from the hero. */
  dist: number;
  /** Line width / circle radius / cone reach. */
  size: number;
  cancel: boolean;
}

const PROJECTILE_COLORS: Record<string, [string, string]> = {
  'arcane-bolt': ['#d2a8ff', '#ffffff'],
  lightning: ['#9ad8ff', '#ffffff'],
  fireball: ['#ff7a3d', '#ffe07a'],
  ember: ['#ff9a4d', '#ffe07a'],
  spark: ['#bfe9ff', '#ffffff'],
  shard: ['#bdf1ff', '#ffffff'],
  needle: ['#8be36b', '#e8ffd8'],
  quake: ['#c9a06a', '#f2dcb0'],
  firebolt: ['#ff7a3d', '#ffe07a'],
  icelance: ['#9be7ff', '#ffffff'],
  ball: ['#7fc8ff', '#ffffff'],
  comet: ['#9be7ff', '#ffffff'],
  smite: ['#ffd84d', '#fffbe0'],
  'holy-shock': ['#ffe066', '#ffffff'],
  holyfire: ['#ff9a3d', '#fff2a0'],
  judgment: ['#ffd84d', '#fff6c8'],
  shield: ['#ffd84d', '#ffffff'],
  shadowbolt: ['#7a3ad0', '#e0c8ff'],
  chaosbolt: ['#5ad03a', '#eaffa0'],
  wrath: ['#7bd65a', '#f0ffe0'],
  vines: ['#4a9a3a', '#9cf07a'],
  starfire: ['#c9a8ff', '#fff6d0'],
  starsurge: ['#ff8ad8', '#ffffff'],
};

/** The beam over an item on the ground. */
const RARITY_BEAM: Record<string, string> = { common: '#e8e4d8', uncommon: '#7fe06a', rare: '#6fb4ff', epic: '#c58bff', legendary: '#ffae42' };

/** Ground effects by look. */
const FIELD_COLORS: Record<string, string> = {
  fire: '#ff7a3d',
  poison: '#8be36b',
  frost: '#9be7ff',
  arrows: '#f5e6c8',
  lightning: '#9ad8ff',
  rift: '#ff3fd2',
  holy: '#ffe066',
  shadow: '#9a5aff',
  nature: '#9cf07a',
};

/** Bolts without their own colors take their damage type's. */
const TYPE_COLORS: Record<string, [string, string]> = {
  fire: PROJECTILE_COLORS.fireball!,
  lightning: PROJECTILE_COLORS.lightning!,
  poison: PROJECTILE_COLORS.needle!,
  frost: PROJECTILE_COLORS.shard!,
  arcane: PROJECTILE_COLORS['arcane-bolt']!,
  holy: PROJECTILE_COLORS.smite!,
  shadow: PROJECTILE_COLORS.shadowbolt!,
  nature: PROJECTILE_COLORS.wrath!,
};

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  /** The view in world pixels. */
  vw = 320;
  vh = 180;
  camX = 0;
  camY = 0;
  /** The 3D view under this canvas, once it exists (never in a test without WebGL). */
  private stage: Stage | null = null;
  private stageFailed = false;
  private readonly people = new WorldCast();
  private landFor: World | null = null;
  /** The story state the land was built for (World.stateVersion). */
  private landVersion = -1;
  /** How much the townsfolk are out (they go indoors while the story fights in the streets). */
  private folkK = 1;
  /** When the last hold for models ended (the land fades up from dark after it). */
  private heldTill = -Infinity;
  /** Held dark while the models load: the engine holds the world still meanwhile. */
  waiting = false;
  aim: AimPreview | null = null;
  /** Touch controls: show the facing marker (where a tapped spell goes). */
  touchMode = false;
  /** The enemy a tapped skill would turn at, picked again every 0.1 s (not every frame). */
  private tapPick: { at: number; e: Enemy | null } = { at: -1, e: null };
  /** The hero's held weapon changes with gear. */
  private weapon: { kind: string; tint?: string } = { kind: 'staff' };
  reducedMotion = false;
  private cssW = 1;
  private cssH = 1;
  /** Canvas pixels per CSS pixel of this top canvas. */
  private k = 1;

  constructor(target: HTMLCanvasElement) {
    this.canvas = target;
    this.g = ctx2d(target);
  }

  /**
   * Fits the view to the element: about 168 world pixels tall on phones (bigger figures) and 214 on
   * desktops, never less than 150 across the short side.
   */
  resize(cssW: number, cssH: number, dpr: number, touch: boolean): void {
    const devW = Math.max(1, Math.round(cssW * dpr));
    const devH = Math.max(1, Math.round(cssH * dpr));
    const landscape = devW >= devH;
    let total = (landscape ? devH : devW * 1.25) / (touch ? 168 : 214);
    total = Math.min(total, Math.min(devW, devH) / 150);
    total = Math.max(0.5, total);
    this.cssW = Math.max(1, cssW);
    this.cssH = Math.max(1, cssH);
    this.vw = devW / total;
    this.vh = devH / total;
    this.k = Math.min(dpr, 2);
    const aw = Math.round(this.cssW * this.k);
    const ah = Math.round(this.cssH * this.k);
    if (this.canvas.width !== aw || this.canvas.height !== ah) {
      this.canvas.width = aw;
      this.canvas.height = ah;
      this.g = ctx2d(this.canvas);
    }
    this.canvas.style.width = `${this.cssW}px`;
    this.canvas.style.height = `${this.cssH}px`;
    this.canvas.style.transform = '';
    this.canvas.style.imageRendering = 'auto';
    this.stageNow()?.setSize(this.cssW, this.cssH, dpr, total * TILE);
  }

  private stageNow(): Stage | null {
    if (this.stage || this.stageFailed) return this.stage;
    try {
      this.stage = new Stage(this.canvas);
    } catch {
      this.stageFailed = true;
    }
    return this.stage;
  }

  /** The land and the hero only, no bars or markers: The Vigil draws its own over it. */
  landOnly = false;
  /** What else stands on the land. */
  layer: LandLayer | null = null;
  /** Which of the land's scenery stays. */
  keepObject: ((o: LandObject) => boolean) | null = null;
  /** The land's scenery, once it's built. */
  get objects(): LandObject[] {
    return this.stage?.land?.objects ?? [];
  }
  /** The land is really there: its models are in and its scenery built. */
  get landReady(): boolean {
    return !this.waiting && !!this.stage?.land;
  }

  /** Screen (CSS px relative to the canvas) to world coordinates, on the ground. */
  toWorld(cx: number, cy: number, _dpr: number): { x: number; y: number } {
    return this.stage ? this.stage.unproject(cx, cy) : { x: this.camX + cx, y: this.camY + cy };
  }

  /** World coordinates to the screen (CSS px relative to the canvas): where to pin a button to the hero. */
  toScreen(x: number, y: number): { x: number; y: number } {
    return this.stage ? this.stage.project(x, y, 12) : { x: x - this.camX, y: y - this.camY };
  }

  /**
   * On touch screens the hero stands left of the middle (right of it, left-handed), as many phone games
   * frame them: the thumb buttons and the menus on that side cover open ground instead of the fight.
   * A share of the view's width.
   */
  frameShift = 0;

  private look: HeroLook | null = null;

  /** Picks up the hero's gear: the weapon in hand and the look of everything worn. */
  setHeroWeapon(cls: ClassId, w: World): void {
    const worn = wornLooks(w.hero);
    this.weapon = heldWeapon(cls, w.hero.equip.weapon, worn.weapon);
    this.look = heroLook(cls, w.hero.equip, worn, w.hero.body, w.hero.face);
  }

  /** The camera's lean toward the aim (and a boss), smoothed (see camera.ts). */
  private leanX = 0;
  private leanY = LIFT;
  /** The mouse on the view, -0.5 to 0.5 from its center on each axis (null: no mouse in use). */
  pointer: { x: number; y: number } | null = null;
  private shakeX = 0;
  private shakeY = 0;

  /** Puts the camera on the hero at once (after loading a region or respawning). */
  snap(w: World): void {
    this.leanX = 0;
    this.leanY = LIFT;
    this.placeCamera(w);
  }

  private placeCamera(w: World): void {
    // only on a wide view: upright, the thumbs are below the hero, not beside them
    const shift = this.vw > this.vh * 1.2 ? this.frameShift * this.vw : 0;
    const mapW = w.map.w * TILE;
    const mapH = w.map.h * TILE;
    const x = w.player.x + this.leanX + shift - this.vw / 2;
    const y = w.player.y + this.leanY - this.vh / 2;
    this.camX = mapW <= this.vw ? (mapW - this.vw) / 2 : clamp(x, 0, mapW - this.vw);
    this.camY = mapH <= this.vh ? (mapH - this.vh) / 2 : clamp(y, 0, mapH - this.vh);
  }

  /** Lets go of the 3D view. */
  dispose(): void {
    this.stage?.dispose();
    this.stage = null;
  }

  /** Draws from here on in world pixels laid flat on the ground at (x, y): rings, warnings, fields. */
  private flat(x: number, y: number): void {
    const st = this.stage;
    if (!st) {
      this.g.setTransform(this.k, 0, 0, this.k, -this.camX * this.k, -this.camY * this.k);
      return;
    }
    const a = st.project(x, y);
    const b = st.project(x + TILE, y);
    const c = st.project(x, y + TILE);
    const k = this.k / TILE;
    const ax = (b.x - a.x) * k;
    const ay = (b.y - a.y) * k;
    const cx = (c.x - a.x) * k;
    const cy = (c.y - a.y) * k;
    this.g.setTransform(ax, ay, cx, cy, a.x * this.k - ax * x - cx * y, a.y * this.k - ay * x - cy * y);
  }

  /** Draws from here on in world pixels facing the camera, with (x, y) `h` world pixels up in the air. */
  private upright(x: number, y: number, h = 0): void {
    const st = this.stage;
    if (!st) {
      this.g.setTransform(this.k, 0, 0, this.k, -this.camX * this.k, -this.camY * this.k);
      return;
    }
    const a = st.project(x, y, h);
    const b = st.project(x + TILE, y, h);
    const s = ((b.x - a.x) / TILE) * this.k;
    this.g.setTransform(s, 0, 0, s, a.x * this.k - s * x, a.y * this.k - s * y);
  }

  /** A line of plain words on the screen, ringed in dark so it reads on anything. */
  private label(text: string, x: number, y: number, size: number, color: string, alpha = 1): void {
    const g = this.g;
    g.setTransform(this.k, 0, 0, this.k, 0, 0);
    g.globalAlpha = alpha;
    g.font = `800 ${size}px "Bricolage Grotesque Variable", system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.lineWidth = Math.max(2.5, size * 0.24);
    g.strokeStyle = 'rgba(20,12,32,0.92)';
    g.strokeText(text, x, y);
    g.fillStyle = color;
    g.fillText(text, x, y);
    g.globalAlpha = 1;
  }

  /** A little health bar on the screen. */
  private bar(x: number, y: number, wide: number, k: number, color: string, shield = 0): void {
    const g = this.g;
    g.setTransform(this.k, 0, 0, this.k, 0, 0);
    const h = 5;
    g.fillStyle = 'rgba(20,12,32,0.9)';
    g.beginPath();
    g.roundRect(x - wide / 2 - 1.5, y - h / 2 - 1.5, wide + 3, h + 3, 3);
    g.fill();
    g.fillStyle = 'rgba(92,30,48,0.95)';
    g.beginPath();
    g.roundRect(x - wide / 2, y - h / 2, wide, h, 2);
    g.fill();
    if (k > 0) {
      g.fillStyle = color;
      g.beginPath();
      g.roundRect(x - wide / 2, y - h / 2, Math.max(1.5, wide * clamp(k, 0, 1)), h, 2);
      g.fill();
    }
    if (shield > 0) {
      g.fillStyle = '#7fd8ff';
      g.fillRect(x - wide / 2, y - h / 2 - 1, wide * clamp(shield, 0, 1), 2);
    }
  }

  draw(w: World, dt: number, time: number): void {
    const g = this.g;
    const st = this.stageNow();
    // the models arrive before anything is shown (a moment on a first visit); the engine holds the world still
    if (st && !st.ready && !st.failed) {
      this.waiting = true;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = '#07050d';
      g.fillRect(0, 0, this.canvas.width, this.canvas.height);
      return;
    }
    if (this.waiting) this.heldTill = time;
    this.waiting = false;
    if (st && st.ready && (this.landFor !== w || this.landVersion !== w.stateVersion)) {
      const fresh = this.landFor !== w;
      this.landVersion = w.stateVersion;
      if (st.land) {
        st.scene.remove(st.land.group);
        st.groundScene.remove(st.land.under);
        st.land.dispose();
      }
      st.land = new Land3D(w.map, w.region, st.landPacks!, (pm) => w.isShown(pm), this.keepObject);
      st.scene.add(st.land.group);
      st.groundScene.add(st.land.under);
      this.landFor = w;
      if (fresh) {
        this.setHeroWeapon(w.hero.cls, w);
        this.snap(w);
        this.people.reset();
        st.cast.preload(this.expected(w));
      }
    }
    const p = w.player;
    // camera: on the hero, leaning a little toward where they aim (and toward a boss)
    const lead = p.dead ? 0 : LEAD;
    let { x: lx, y: ly } = leanTarget(this.touchMode ? null : this.pointer, p.aim, lead);
    const boss = w.boss();
    if (boss && !boss.dead) {
      lx = lx * 0.8 + (boss.x - p.x) * 0.2;
      ly = ly * 0.8 + (boss.y - p.y) * 0.2;
    }
    // a scene looks where it says (a person, a place), easing there and back
    const focus = w.scene?.focus;
    if (focus) {
      lx = focus.x - p.x;
      ly = focus.y - p.y + LIFT;
    }
    // someone telling the hero their part: the two of them framed above the words
    const talk = !focus && w.talkTo;
    if (talk) {
      lx = (talk.x - p.x) / 2;
      ly = (talk.y - p.y) / 2 + this.vh * 0.14;
    }
    // slow motion: drawn toward what is falling
    if (!focus && !talk && w.slowT > 0 && w.slowAt) {
      lx = lx * 0.4 + (w.slowAt.x - p.x) * 0.6;
      ly = ly * 0.4 + (w.slowAt.y - p.y) * 0.6;
    }
    const rate = w.scene || talk ? 2.6 : 4;
    this.leanX = damp(this.leanX, lx, rate, dt);
    this.leanY = damp(this.leanY, ly, rate, dt);
    this.placeCamera(w);
    const shake = this.reducedMotion ? 0 : w.shakeAmt;
    this.shakeX = shake ? (Math.random() - 0.5) * shake : 0;
    this.shakeY = shake ? (Math.random() - 0.5) * shake : 0;
    const cx = this.camX + this.vw / 2 + this.shakeX;
    const cy = this.camY + this.vh / 2 + this.shakeY;

    if (st?.ready) {
      st.look(cx / TILE, cy / TILE);
      LIGHT.uTime.value = time;
      this.setMood(w, st);
      st.heroAt(p.x, p.y);
      st.land?.update(cx / TILE, cy / TILE, st.spanX, st.spanZ);
      st.land?.lightFlames(cx / TILE, cy / TILE);
      st.land?.updateDoors(dt);
      this.folkK = damp(this.folkK, w.story.fighting ? 0 : 1, 3, dt);
      st.cast.begin();
      this.people.sync(st.cast, w, dt, time, { look: this.look ?? heroLook(w.hero.cls), weapon: this.weapon, folk: this.folkK, statues: st.land?.statues, colossi: st.land?.colossi, landOnly: this.landOnly });
      this.layer?.cast?.(st.cast, dt, time);
      st.cast.end();
      st.render(dt);
    }
    const view: LandView = {
      g,
      x: this.camX,
      y: this.camY,
      w: this.vw,
      h: this.vh,
      time,
      flat: (x, y) => this.flat(x, y),
      up: (x, y, h = 0) => this.upright(x, y, h),
      project: (x, y, h = 0) => st?.project(x, y, h) ?? { x, y },
      label: (text, x, y, size, color, alpha) => this.label(text, x, y, size, color, alpha),
      bar: (x, y, wide, k, color) => this.bar(x, y, wide, k, color),
    };

    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // ---- what lies on the ground: on its own layer, under whatever stands
    const near0 = (x: number, y: number): boolean => Math.abs(x - cx) < this.vw * 0.7 && Math.abs(y - cy) < this.vh * 0.9;
    if (st) this.g = st.beginDecals();
    const dg = this.g;
    for (const f of w.fields) {
      this.flat(f.x, f.y);
      this.drawField(f, time);
    }
    for (const t of w.telegraphs) {
      this.flat(t.x, t.y);
      this.drawTelegraph(t);
    }
    for (const wv of w.waves) {
      this.flat(wv.x, wv.y);
      this.drawWave(wv);
    }
    this.flat(p.x, p.y);
    this.drawEnemyWarnings(w);
    for (const tr of w.traps) {
      this.flat(tr.x, tr.y);
      this.drawTrap(tr.x, tr.y, tr.arm > 0, time);
    }
    this.flat(p.x, p.y);
    if (!w.scene) this.drawAim(w);
    this.drawFacing(w, time);
    if (!this.landOnly) this.drawEntrances(w, time);
    for (const e of w.enemies) {
      if (e.dead || !hasStatus(e, 'root') || !near0(e.x, e.y)) continue;
      this.flat(e.x, e.y);
      dg.strokeStyle = '#6fb04f';
      dg.lineWidth = 1.2;
      dg.beginPath();
      dg.arc(e.x, e.y, e.r + 2, 0, TAU);
      dg.stroke();
    }
    if (p.channel) {
      this.flat(p.x, p.y);
      for (let i = 0; i < 3; i++) {
        const a = time * 18 + (i * TAU) / 3;
        dg.fillStyle = 'rgba(255,255,255,0.6)';
        dg.fillRect(p.x + Math.cos(a) * 16, p.y + Math.sin(a) * 16, 3, 1.5);
      }
    }
    const bz = w.boss();
    if (bz?.boss && bz.boss.collapse > 0) {
      this.flat(bz.boss.cx, bz.boss.cy);
      this.drawCollapse(bz.boss.cx, bz.boss.cy, bz.boss.collapse, time);
    }
    for (const f of w.fx) {
      if (f.kind !== 'ring' || !near0(f.x, f.y)) continue;
      this.flat(f.x, f.y);
      this.drawFx(f, w);
    }
    this.flat(cx, cy);
    this.layer?.under(dg, time, view);
    this.g = g;

    // ---- fires, what floats and what flies
    const near = near0;
    // (what a wall stands in front of isn't shown over the wall)
    const seen = (x: number, y: number, h: number): boolean => near0(x, y) && !st?.land?.hidden(x, y, h);
    this.fireColors = FIRE[w.region.theme] ?? FIRE.default!;
    if (st?.land) {
      for (const f of st.land.flames) {
        const x = f.x * TILE;
        const y = f.z * TILE;
        if (!near(x, y)) continue;
        this.upright(x, y, f.y * TILE);
        this.drawFlame(x, y, time, f.size);
      }
    }
    if (st?.land) {
      for (const f of st.land.glows) {
        const x = f.x * TILE;
        const y = f.z * TILE;
        if (!near(x, y)) continue;
        this.upright(x, y, f.y * TILE);
        const r = f.size * (0.92 + Math.sin(time * 1.8 + x) * 0.08);
        g.save();
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = 0.55;
        g.drawImage(glowDisc(f.color, Math.ceil(r)), x - r, y - r, r * 2, r * 2);
        g.restore();
      }
    }
    for (const f of w.fires) {
      const lit = w.fireLit(f);
      if (!lit || !near(f.x, f.y)) continue;
      this.upright(f.x, f.y, TILE * 2.2);
      g.globalAlpha = Math.min(1, lit * 1.5);
      this.drawFlame(f.x, f.y, time, f.size * lit * 0.2);
      g.globalAlpha = 1;
    }
    for (const d of w.drops) if (d.kind === 'item' && near(d.x, d.y)) this.drawItemDrop(d, time);
    for (const e of w.enemies) if (!e.dead && seen(e.x, e.y, 24)) this.drawEnemyMarks(e, time);
    if (!p.dead) this.drawHeroMarks(w, time);
    for (const pr of w.projectiles) {
      if (!seen(pr.x, pr.y, 11)) continue;
      this.upright(pr.x, pr.y, 13);
      // (drawn for the old scale of things: half as big again reads against a hero of today's size)
      g.save();
      g.translate(pr.x, pr.y);
      g.scale(SHOT_SCALE, SHOT_SCALE);
      g.translate(-pr.x, -pr.y);
      this.drawProjectile(pr, time);
      g.restore();
    }
    for (const f of w.fx) {
      if (f.kind === 'ring' || !seen(f.x, f.y, 10)) continue;
      this.flat(f.x, f.y);
      this.drawFx(f, w);
    }
    for (const gh of w.coop?.ghosts ?? []) {
      for (const sh of gh.shots) {
        this.upright(sh.x, sh.y, 11);
        g.fillStyle = sh.color;
        g.beginPath();
        g.arc(sh.x, sh.y, Math.max(1.5, sh.r), 0, TAU);
        g.fill();
      }
    }
    this.flat(cx, cy);
    this.layer?.over(g, time, view);
    if (w.portal) {
      this.upright(w.portal.x, w.portal.y, 14);
      this.drawPortal(w.portal.x, w.portal.y, time);
    }

    // ---- names, bars and numbers, sized for the screen
    // (a scene is a clean picture: no bars, markers or arrows over it)
    const ui = !w.scene && !this.landOnly;
    if (ui && st) {
      for (const e of w.enemies) if (seen(e.x, e.y, 24)) this.drawEnemyBar(e, st);
      for (const pet of w.pets) if (near(pet.x, pet.y)) this.drawPetBar(pet, st);
      for (const gh of w.coop?.ghosts ?? []) {
        if (gh.seen <= 0 || !near(gh.x, gh.y)) continue;
        const s = st.project(gh.x, gh.y, PERSON_H + 2);
        this.label(gh.name, s.x, s.y - 12, 11, '#bfe8ff');
        this.bar(s.x, s.y, 34, gh.hp / gh.maxHp, '#6ad06a');
      }
      for (const n of w.npcs) if (near(n.x, n.y)) this.drawNpcSigns(w, n, st);
    }
    if (st) {
      for (const t of w.texts) {
        const a = clamp(1.6 - t.t / (t.big ? 0.75 : 0.55), 0, 1);
        const s = st.project(t.x, t.y, 18);
        const pop = t.big && t.t < 0.12 ? 1.7 : 1;
        this.label(t.text, s.x, s.y, (t.big ? 17 : 13) * pop, t.color, a);
      }
    }
    this.upright(p.x, p.y);
    this.drawSpeech(w);
    if (ui && st) {
      this.drawInteractMarker(w, time, st);
      this.drawObjectiveArrow(w, time, st);
    }
    g.setTransform(this.k, 0, 0, this.k, 0, 0);
    const W = this.cssW;
    const H = this.cssH;
    // hurt vignette
    if (!p.dead && p.hp < p.maxHp * 0.3) {
      const a = 0.25 + Math.sin(time * 6) * 0.08;
      const grd = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.85);
      grd.addColorStop(0, 'rgba(120,0,20,0)');
      grd.addColorStop(1, `rgba(150,0,30,${a})`);
      g.fillStyle = grd;
      g.fillRect(0, 0, W, H);
    }
    if (p.dead) {
      g.fillStyle = `rgba(20,0,10,${clamp(p.deadT * 0.5, 0, 0.55)})`;
      g.fillRect(0, 0, W, H);
    }
    const up = (time - this.heldTill) / 0.6;
    if (up < 1) {
      g.globalAlpha = 1 - clamp(up, 0, 1);
      g.fillStyle = '#07050d';
      g.fillRect(0, 0, W, H);
      g.globalAlpha = 1;
    }
  }

  /** The creatures a land will want, so they are on their way before the first one shows. */
  private expected(w: World): string[] {
    const out: string[] = [];
    for (const e of w.enemies) out.push(e.def.sprite);
    return out;
  }

  /** The light of the land and the moment: a land's own veil, a dusk that never lifts, the dark of a crypt. */
  private setMood(w: World, st: Stage): void {
    const look = THEMES[w.region.theme];
    const grade = LIGHT.uGrade.value;
    const dark = LIGHT.uDark.value;
    const dread = look.dread;
    grade.set(0, 0, 0, 0);
    dark.set(0, 8, 0, 0);
    const paint = (hex: string, a: number): void => {
      const [r, gg, b] = hexRgb(hex);
      grade.set(r, gg, b, a);
    };
    if (look.tint) paint(look.tint, 0.14);
    if (w.storyState?.dusk) paint('#ff8a4a', 0.14);
    if (w.storyState?.gloom) paint('#3a4468', 0.16);
    if (dread && dread.dark > 0) {
      paint(dread.shade, 0.16);
      dark.set(dread.dark * 0.2, 16, 0, 0);
    }
    // a night or a crypt sets a mood, never hides the game: the far edge of the view is dim, everything can be seen
    if (w.storyState?.night) paint('#2f3f70', 0.18);
    if (w.dark) dark.set(w.region.dark ? 0.36 : 0.26, w.region.dark ? 11 : 15, 0, 0);
    void st;
  }

  /* ---------------------------------------------------------------- names and marks */

  private headOf(e: Enemy): number {
    const kit = kitOf(e.def.sprite, e.def.id);
    return heightFromRadius(e.r, kit.size ?? 1) * 0.92 + (kit.float ?? 0) * 16 + 4;
  }

  private drawEnemyBar(e: Enemy, st: Stage): void {
    if (e.dead || e.boss || e.dummy || e.state === 'spawn') return;
    const named = !!e.def.named;
    if (e.hp >= e.maxHp && !e.elite.length && !named && e.shield <= 0) return;
    const s = st.project(e.x, e.y, this.headOf(e));
    const wide = e.elite.length || named ? 46 : 30;
    this.bar(s.x, s.y, wide, e.hp / e.maxHp, named ? '#d8b0ff' : e.elite.length ? '#ffcf5a' : '#ff4a5a', e.shield > 0 ? e.shield / (e.maxHp * 0.4) : 0);
    if (named) this.label(`${e.name} ${e.level}`, s.x, s.y - 11, 11, '#e8d0ff');
    else if (e.elite.length) this.label(e.name.split(' ')[0]!, s.x, s.y - 11, 11, '#ffd36b');
  }

  private drawPetBar(pet: Pet, st: Stage): void {
    if (pet.dead || pet.life !== Infinity || pet.hp >= pet.maxHp) return;
    const s = st.project(pet.x, pet.y, PERSON_H);
    this.bar(s.x, s.y, 28, pet.hp / pet.maxHp, '#6ad06a');
  }

  /** What a person sells, and "!" or "?" for a quest, over their head. */
  private drawNpcSigns(w: World, n: NpcActor, st: Stage): void {
    const def = NPCS[n.id];
    if (!def || def.down) return;
    const mark = npcMark(w, n.id);
    const sign = vendorSign(def.shop ?? (def.service === 'respec' ? 'respec' : ''));
    if (!mark && !sign) return;
    const bob = Math.sin(n.bob * 3) * 1.5;
    const s = st.project(n.x, n.y, PERSON_H + 3);
    const g = this.g;
    let top = s.y;
    const size = (st.project(n.x + TILE, n.y).x - st.project(n.x, n.y).x) / TILE;
    if (sign) {
      g.setTransform(this.k, 0, 0, this.k, 0, 0);
      const bw = (sign.width / sign.k) * size;
      const bh = (sign.height / sign.k) * size;
      g.fillStyle = 'rgba(27,20,40,0.78)';
      g.beginPath();
      g.roundRect(s.x - bw / 2 - 3, top - bh - 6, bw + 6, bh + 6, 4);
      g.fill();
      g.imageSmoothingEnabled = true;
      g.drawImage(sign.c, s.x - bw / 2, top - bh - 3, bw, bh);
      top -= bh + 8;
    }
    if (mark) {
      g.setTransform(this.k * size, 0, 0, this.k * size, 0, 0);
      drawMapIcon(g, mark, s.x / size, (top + bob) / size - 8, 1);
    }
  }

  /** What is afoot on a foe: frost, flames, stars, a mark. */
  private drawEnemyMarks(e: Enemy, time: number): void {
    const g = this.g;
    const h = this.headOf(e);
    this.upright(e.x, e.y, h * 0.5);
    if (hasStatus(e, 'burn') && Math.floor(time * 8 + e.id) % 2 === 0) this.drawFlame(e.x + Math.sin(time * 7 + e.id) * e.r * 0.5, e.y, time, 0.55);
    if (e.statuses.some((s) => s.id === 'poison')) {
      const ph = (time * 1.5 + e.id * 0.3) % 1;
      g.fillStyle = `rgba(139,227,107,${1 - ph})`;
      g.beginPath();
      g.arc(e.x - 3 + (e.id % 5), e.y - e.r - ph * 8, 1.4, 0, TAU);
      g.fill();
    }
    if (hasStatus(e, 'shock') && Math.floor(time * 12) % 3 === 0) {
      g.fillStyle = '#bfe9ff';
      g.fillRect(e.x + (Math.random() - 0.5) * e.r * 2, e.y - Math.random() * e.r * 2, 1, 2);
    }
    if (e.shield > 0) {
      g.strokeStyle = `rgba(127,216,255,${0.6 + Math.sin(time * 6) * 0.2})`;
      g.lineWidth = 1;
      g.beginPath();
      g.ellipse(e.x, e.y, e.r + 4, e.r + 6, 0, 0, TAU);
      g.stroke();
    }
    this.upright(e.x, e.y, h);
    if (hasStatus(e, 'stun') || hasStatus(e, 'freeze') || e.boss?.dazed) this.drawStars(e.x, e.y, time);
    if (hasStatus(e, 'mark')) {
      const yy = e.y - 6 + Math.sin(time * 4);
      g.strokeStyle = '#ffe066';
      g.lineWidth = 1;
      g.strokeRect(e.x - 3.5, yy - 3.5, 7, 7);
      g.fillStyle = '#ff4a4a';
      g.fillRect(e.x - 1, yy - 1, 2, 2);
    }
  }

  private drawHeroMarks(w: World, time: number): void {
    const g = this.g;
    const p = w.player;
    if (p.shield > 0) {
      this.upright(p.x, p.y, 13);
      g.strokeStyle = `rgba(127,216,255,${0.55 + Math.sin(time * 8) * 0.2})`;
      g.lineWidth = 1.2;
      g.beginPath();
      g.ellipse(p.x, p.y, 13, 15, 0, 0, TAU);
      g.stroke();
    }
    this.upright(p.x, p.y, 2);
    if (p.buffs.length) this.drawBuffs(w, time);
    this.upright(p.x, p.y, PERSON_H);
    if (hasStatus(p, 'stun')) this.drawStars(p.x, p.y, time);
  }

  /** An item on the ground: its icon over a beam in its rarity's color. */
  private drawItemDrop(d: World['drops'][number], time: number): void {
    const g = this.g;
    const item = d.item;
    if (!item) return;
    this.upright(d.x, d.y, 10 + d.z + Math.sin(time * 3 + d.x) * 1.5);
    const color = RARITY_BEAM[item.r] ?? '#ffffff';
    g.fillStyle = color;
    g.globalAlpha = 0.22;
    g.fillRect(d.x - 1.5, d.y - 16, 3, 26);
    g.globalAlpha = 1;
    const icon = itemIconCanvas(item);
    g.imageSmoothingEnabled = true;
    g.drawImage(icon, d.x - 7, d.y - 7, 14, 14);
  }

  private drawInteractMarker(w: World, time: number, st: Stage): void {
    const it = w.interactable;
    // on touch the Talk button itself stands beside the hero (ui/Touch.tsx)
    if (!it || this.touchMode) return;
    const word = it.kind === 'npc' ? 'TALK' : it.kind === 'waystone' ? 'TRAVEL' : it.kind === 'exit' && it.door ? 'ENTER' : 'E';
    const s = st.project(it.x, it.y, PERSON_H + 8);
    this.label(word, s.x, s.y + Math.sin(time * 4) * 1.5, 13, '#ffe066');
  }

  /** An arrow at the edge of the view toward the current objective. */
  private drawObjectiveArrow(w: World, time: number, st: Stage): void {
    const target = objectiveTarget(w);
    // enemies to hunt show on the minimap; the edge arrow is for places
    if (!target || target.soft) return;
    const g = this.g;
    const s = st.project(target.x, target.y, PERSON_H);
    const W = this.cssW;
    const H = this.cssH;
    const m = 28;
    if (s.x > m && s.x < W - m && s.y > m && s.y < H - m) {
      this.label('▼', s.x, s.y + Math.sin(time * 5) * 3, 15, '#ffe066');
      return;
    }
    const a = Math.atan2(s.y - H / 2, s.x - W / 2);
    const mx = W / 2 - m;
    const my = H / 2 - m;
    const t = Math.min(Math.abs(mx / (Math.cos(a) || 1e-6)), Math.abs(my / (Math.sin(a) || 1e-6)));
    g.setTransform(this.k, 0, 0, this.k, 0, 0);
    g.translate(W / 2 + Math.cos(a) * t, H / 2 + Math.sin(a) * t);
    g.rotate(a);
    g.globalAlpha = 0.85 + Math.sin(time * 5) * 0.15;
    g.fillStyle = '#1b1428';
    g.beginPath();
    g.moveTo(15, 0);
    g.lineTo(-11, -13);
    g.lineTo(-5, 0);
    g.lineTo(-11, 13);
    g.closePath();
    g.fill();
    g.fillStyle = '#ffe066';
    g.beginPath();
    g.moveTo(11, 0);
    g.lineTo(-8, -9);
    g.lineTo(-2.5, 0);
    g.lineTo(-8, 9);
    g.closePath();
    g.fill();
    g.globalAlpha = 1;
  }

  /* ---------------------------------------------------------------- ground */

  /** What fire looks like here: most places burn orange, a deep place its own color (its mood is in its light). */
  private fireColors: readonly [string, string, string] = FIRE.default!;

  private drawFlame(x: number, y: number, time: number, k: number): void {
    const g = this.g;
    // a tongue of fire that leans and licks, three shades from its edge to its white-hot heart, in its own glow
    const s = 0.8 + Math.min(2, k) * 0.75;
    const t = time * 8 + x * 0.73;
    const lean = (Math.sin(t) * 1.1 + Math.sin(t * 2.3) * 0.6) * s;
    const tall = (9 + Math.sin(t * 1.7) * 1.6) * s;
    const wide = 3.6 * s;
    const glow = Math.ceil(tall * 1.15);
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.34 + Math.sin(t * 1.3) * 0.05;
    g.drawImage(glowDisc(this.fireColors[0], glow), x - glow, y - tall * 0.45 - glow);
    g.restore();
    const tongue = (w: number, h: number, color: string): void => {
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(x - w, y);
      g.quadraticCurveTo(x - w * 0.95, y - h * 0.5, x + lean * (h / tall), y - h);
      g.quadraticCurveTo(x + w * 0.95, y - h * 0.5, x + w, y);
      g.quadraticCurveTo(x, y + w * 0.9, x - w, y);
      g.fill();
    };
    const [outer, middle, heart] = this.fireColors;
    tongue(wide, tall, outer);
    tongue(wide * 0.66, tall * 0.7, middle);
    tongue(wide * 0.34, tall * 0.42, heart);
  }

  private drawField(f: World['fields'][number], time: number): void {
    const g = this.g;
    const life = f.t / f.dur;
    const fade = clamp(life * 3, 0, 1);
    const color = FIELD_COLORS[f.look] ?? '#ff3fd2';
    if (f.look === 'arrows') {
      g.strokeStyle = rgba('#f5e6c8', 0.5 * fade);
      g.lineWidth = 1;
      g.beginPath();
      g.ellipse(Math.round(f.x) + 0.5, Math.round(f.y) + 0.5, f.r, f.r, 0, 0, TAU);
      g.stroke();
      g.fillStyle = rgba('#000000', 0.12 * fade);
      g.beginPath();
      g.ellipse(f.x, f.y, f.r, f.r, 0, 0, TAU);
      g.fill();
      return;
    }
    g.fillStyle = rgba(color, (f.hostile ? 0.32 : 0.22) * fade);
    g.beginPath();
    g.ellipse(f.x, f.y, f.r, f.r, 0, 0, TAU);
    g.fill();
    if (f.hostile) {
      g.strokeStyle = rgba('#ff4a4a', 0.55 * fade);
      g.lineWidth = 1;
      g.stroke();
    }
    // bubbles / flames rising in it
    const n = Math.max(2, Math.round(f.r / 5));
    for (let i = 0; i < n; i++) {
      const ph = (time * 1.4 + i * 0.37 + f.id * 0.11) % 1;
      const a = hash2(i, f.id, 3) * TAU;
      const r = Math.sqrt(hash2(i, f.id, 4)) * f.r * 0.9;
      g.fillStyle = rgba(f.look === 'fire' ? (ph < 0.5 ? '#ffd86b' : '#ff7a3d') : color, (1 - ph) * fade);
      g.fillRect(Math.round(f.x + Math.cos(a) * r), Math.round(f.y + Math.sin(a) * r * 0.75 - ph * 6), 1, f.look === 'fire' || f.look === 'holy' ? 2 : 1);
    }
    if (f.look === 'holy' || f.look === 'shadow' || f.look === 'nature') {
      // a consecrated ring, a pool of shadow, a ring of leaves: the edge turns slowly
      const k = f.look === 'shadow' ? -0.6 : 0.6;
      g.fillStyle = rgba(f.look === 'nature' ? '#4a9a3a' : color, 0.6 * fade);
      const m = Math.max(6, Math.round(f.r / 2.5));
      for (let i = 0; i < m; i++) {
        const a = time * k + (i * TAU) / m;
        g.fillRect(Math.round(f.x + Math.cos(a) * f.r * 0.92), Math.round(f.y + Math.sin(a) * f.r * 0.69), 2, 1);
      }
    }
  }

  /** Enemy warnings: red shapes that fill up as the attack is about to land. */
  private drawTelegraph(t: Telegraph): void {
    const g = this.g;
    if (t.t >= t.dur && t.linger <= 0) return;
    const k = clamp(t.t / t.dur, 0, 1);
    const color = t.tone === 'rift' ? '#ff3fd2' : t.tone === 'player' ? '#ffb04d' : '#ff3b3b';
    const lingering = t.t >= t.dur;
    g.save();
    switch (t.shape) {
      case 'circle':
      case 'ring':
      case 'donut': {
        const ry = 1;
        if (t.shape === 'circle') {
          g.fillStyle = rgba(color, lingering ? 0.6 : 0.18);
          g.beginPath();
          g.ellipse(t.x, t.y, t.r, t.r * ry, 0, 0, TAU);
          g.fill();
          g.fillStyle = rgba(color, 0.35);
          g.beginPath();
          g.ellipse(t.x, t.y, t.r * k, t.r * k * ry, 0, 0, TAU);
          g.fill();
        } else {
          g.fillStyle = rgba(color, 0.18 + k * 0.2);
          g.beginPath();
          g.ellipse(t.x, t.y, t.r, t.r * ry, 0, 0, TAU);
          g.ellipse(t.x, t.y, t.r2, t.r2 * ry, 0, 0, TAU, true);
          g.fill('evenodd');
          g.strokeStyle = rgba('#ffffff', 0.7);
          g.lineWidth = 1;
          g.beginPath();
          g.ellipse(t.x, t.y, t.r2, t.r2 * ry, 0, 0, TAU);
          g.stroke();
        }
        g.strokeStyle = rgba(color, 0.9);
        g.lineWidth = 1;
        g.beginPath();
        g.ellipse(Math.round(t.x) + 0.5, Math.round(t.y) + 0.5, t.r, t.r * ry, 0, 0, TAU);
        g.stroke();
        break;
      }
      case 'line': {
        g.translate(t.x, t.y);
        g.rotate(t.angle);
        if (lingering) {
          g.fillStyle = rgba('#ffffff', 0.9);
          g.fillRect(0, -t.r2 / 4, t.len, t.r2 / 2);
          g.fillStyle = rgba(color, 0.8);
          g.fillRect(0, -t.r2 / 2, t.len, t.r2);
        } else {
          g.fillStyle = rgba(color, t.dmg > 0 ? 0.18 : 0.14);
          g.fillRect(0, -t.r2 / 2, t.len, t.r2);
          g.fillStyle = rgba(color, 0.32);
          g.fillRect(0, -t.r2 / 2, t.len * k, t.r2);
          g.strokeStyle = rgba(color, 0.8);
          g.lineWidth = 1;
          g.strokeRect(0, -t.r2 / 2, t.len, t.r2);
        }
        break;
      }
      case 'cone': {
        g.fillStyle = rgba(color, 0.2);
        g.beginPath();
        g.moveTo(t.x, t.y);
        g.arc(t.x, t.y, t.r, t.angle - t.r2, t.angle + t.r2);
        g.closePath();
        g.fill();
        g.fillStyle = rgba(color, 0.35);
        g.beginPath();
        g.moveTo(t.x, t.y);
        g.arc(t.x, t.y, t.r * k, t.angle - t.r2, t.angle + t.r2);
        g.closePath();
        g.fill();
        break;
      }
    }
    g.restore();
  }

  private drawWave(wv: World['waves'][number]): void {
    const g = this.g;
    g.strokeStyle = rgba('#ffb07a', 0.85);
    g.lineWidth = wv.width * 0.5;
    g.beginPath();
    g.ellipse(wv.x, wv.y, wv.r, wv.r, 0, 0, TAU);
    g.stroke();
    g.strokeStyle = rgba('#ffffff', 0.6);
    g.lineWidth = 1;
    g.stroke();
  }

  /** Wind-ups drawn from enemy state: arcs, slam circles, aim lines, charge lanes. */
  private drawEnemyWarnings(w: World): void {
    const g = this.g;
    for (const e of w.enemies) {
      if (e.dead || e.state !== 'windup' || e.boss) continue;
      const k = clamp(1 - e.t / e.def.windup, 0, 1);
      const red = '#ff3b3b';
      if (e.mend) {
        // a healer gathering a heal: a green thread to its friend (stun or kill it to stop it)
        const ally = w.enemyById(e.mend);
        if (ally) {
          g.strokeStyle = rgba('#7bff9a', 0.35 + k * 0.5);
          g.lineWidth = 1;
          g.setLineDash([2, 2]);
          g.beginPath();
          g.moveTo(e.x, e.y - 4);
          g.lineTo(ally.x, ally.y - 4);
          g.stroke();
          g.setLineDash([]);
        }
        continue;
      }
      g.save();
      switch (e.def.ai) {
        case 'melee':
        case 'hopper': {
          const r = e.def.reach + e.r + 4;
          g.fillStyle = rgba(red, 0.12 + k * 0.2);
          g.beginPath();
          g.moveTo(e.x, e.y);
          g.arc(e.x, e.y, e.def.ai === 'hopper' ? r + 18 : r, e.aimA - 0.9, e.aimA + 0.9);
          g.closePath();
          g.fill();
          break;
        }
        case 'armored': {
          const r = e.def.slam?.radius ?? 30;
          g.fillStyle = rgba(red, 0.14);
          g.beginPath();
          g.ellipse(e.x, e.y, r, r, 0, 0, TAU);
          g.fill();
          g.fillStyle = rgba(red, 0.3);
          g.beginPath();
          g.ellipse(e.x, e.y, r * k, r * k, 0, 0, TAU);
          g.fill();
          g.strokeStyle = rgba(red, 0.8);
          g.lineWidth = 1;
          g.beginPath();
          g.ellipse(e.x, e.y, r, r, 0, 0, TAU);
          g.stroke();
          break;
        }
        case 'ranged':
        case 'caster': {
          if (e.aimX === -1) break; // casters with a ground circle: the telegraph shows it
          g.translate(e.x, e.y - 3);
          g.rotate(e.aimA);
          g.fillStyle = rgba(red, 0.15 + k * 0.25);
          g.fillRect(4, -1, 120, 2);
          g.fillStyle = rgba('#ffffff', k * 0.6);
          g.fillRect(4, 0, 120 * k, 1);
          break;
        }
        case 'charger': {
          g.translate(e.x, e.y);
          g.rotate(e.aimA);
          const wdt = e.r * 2 + 4;
          g.fillStyle = rgba(red, 0.12);
          g.fillRect(0, -wdt / 2, e.rushLeft, wdt);
          g.fillStyle = rgba(red, 0.3);
          g.fillRect(0, -wdt / 2, e.rushLeft * k, wdt);
          g.strokeStyle = rgba(red, 0.75);
          g.lineWidth = 1;
          g.strokeRect(0, -wdt / 2, e.rushLeft, wdt);
          break;
        }
      }
      g.restore();
    }
  }

  private drawTrap(x: number, y: number, arming: boolean, time: number): void {
    const g = this.g;
    g.fillStyle = '#5a5a6a';
    g.fillRect(x - 5, y - 1, 10, 3);
    g.fillStyle = '#9aa0b0';
    for (let i = -4; i <= 4; i += 2) g.fillRect(x + i, y - 3, 1, 2);
    g.fillStyle = arming ? '#8a8a8a' : Math.floor(time * 3) % 2 ? '#8be36b' : '#4aa83a';
    g.fillRect(x - 1, y - 1, 2, 2);
  }

  /** The touch aim preview: where the dragged skill will go. */
  private drawAim(w: World): void {
    const a = this.aim;
    const p = w.player;
    if (!a || p.dead) return;
    const g = this.g;
    const color = a.cancel ? '#ff5a5a' : '#ffffff';
    g.save();
    g.globalAlpha = 0.45;
    g.fillStyle = color;
    g.strokeStyle = color;
    g.lineWidth = 1;
    if (a.shape === 'line') {
      g.translate(p.x, p.y);
      g.rotate(a.angle);
      g.fillRect(6, -a.size / 2, a.dist, a.size);
      g.globalAlpha = 0.8;
      g.fillRect(a.dist + 4, -2, 3, 4);
    } else if (a.shape === 'circle') {
      const x = p.x + Math.cos(a.angle) * a.dist;
      const y = p.y + Math.sin(a.angle) * a.dist;
      g.beginPath();
      g.ellipse(x, y, a.size, a.size, 0, 0, TAU);
      g.fill();
      g.globalAlpha = 0.8;
      g.stroke();
      g.globalAlpha = 0.3;
      g.beginPath();
      g.moveTo(p.x, p.y);
      g.lineTo(x, y);
      g.stroke();
    } else if (a.shape === 'cone') {
      g.beginPath();
      g.moveTo(p.x, p.y);
      g.arc(p.x, p.y, a.size, a.angle - a.dist / 2, a.angle + a.dist / 2);
      g.closePath();
      g.fill();
    } else {
      g.beginPath();
      g.ellipse(p.x, p.y, a.size, a.size, 0, 0, TAU);
      g.fill();
      g.globalAlpha = 0.8;
      g.stroke();
    }
    g.restore();
  }

  /** Touch: the enemy a tap would aim at (the same picker as the cast), while an auto-aimed skill is ready. */
  private tapTarget(w: World): Enemy | null {
    const pick = this.tapPick;
    if (w.time >= pick.at && w.time - pick.at < 0.1) return pick.e && !pick.e.dead ? pick.e : null;
    const p = w.player;
    let reach = 0;
    if (w.settings.autoAimSkills !== false)
      for (const slot of ['s1', 's2', 's3', 's4', 'ult'] as const) {
        const id = w.build.bar[slot];
        const spec = id ? w.build.skills[id]?.spec : undefined;
        const ready = slot === 'ult' ? p.ult >= 100 : p.cds[slot].charges > 0;
        if (spec && ready && tapAutoAims(spec)) reach = Math.max(reach, aimReach(spec));
      }
    this.tapPick = { at: w.time, e: reach ? autoTarget(w, reach, p.aim) : null };
    return this.tapPick.e;
  }

  /** Touch: a small arrow ahead of the hero, where a tapped spell will fly (or a ring under the enemy a tap aims at). */
  private drawFacing(w: World, time: number): void {
    const p = w.player;
    if (!this.touchMode || this.aim || p.dead || w.safe) return;
    const g = this.g;
    const t = this.tapTarget(w);
    if (t) {
      const pulse = this.reducedMotion ? 0 : Math.sin(time * 6) * 0.8;
      g.save();
      g.lineWidth = 1.5;
      g.setLineDash([3, 2]);
      g.strokeStyle = 'rgba(27,20,40,0.6)';
      g.beginPath();
      g.ellipse(t.x, t.y, t.r + 5 + pulse, t.r + 5 + pulse, 0, 0, TAU);
      g.stroke();
      g.lineWidth = 1;
      g.strokeStyle = 'rgba(255,224,102,0.9)';
      g.stroke();
      g.restore();
      return;
    }
    const d = 17 + Math.sin(time * 5) * 1.2;
    g.save();
    g.translate(Math.round(p.x + Math.cos(p.aim) * d), Math.round(p.y - 2 + Math.sin(p.aim) * d * 0.8));
    g.rotate(p.aim);
    g.globalAlpha = 0.55;
    g.fillStyle = '#1b1428';
    g.beginPath();
    g.moveTo(5, 0);
    g.lineTo(-3, -4.5);
    g.lineTo(-1, 0);
    g.lineTo(-3, 4.5);
    g.closePath();
    g.fill();
    g.globalAlpha = 0.85;
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(4, 0);
    g.lineTo(-2, -3);
    g.lineTo(-0.5, 0);
    g.lineTo(-2, 3);
    g.closePath();
    g.fill();
    g.restore();
  }

  /** Shadows and auras under characters. */
  /* -------------------------------------------------------------- figures */

  /** Buffs show as motes of their color rising around the hero; damage walls as a ring. */
  private drawBuffs(w: World, time: number): void {
    const g = this.g;
    const p = w.player;
    p.buffs.forEach((b, i) => {
      for (let j = 0; j < 2; j++) {
        const t = time * 0.9 + j * 0.5 + i * 0.27;
        const ph = t % 1;
        const a = i * 2.4 + j * 3.1 + Math.floor(t) * 1.7;
        g.fillStyle = rgba(b.def.color, (1 - ph) * 0.9);
        g.fillRect(Math.round(p.x + Math.cos(a) * 8), Math.round(p.y + 3 - ph * 18), 1, 2);
      }
      if (b.def.dr) {
        g.strokeStyle = rgba(b.def.color, 0.3 + Math.sin(time * 5) * 0.1);
        g.lineWidth = 1;
        g.beginPath();
        g.ellipse(p.x, p.y, 10, 4, 0, 0, TAU);
        g.stroke();
      }
    });
  }

  /** A scene's signs over heads: surprise, a question, a pause, affection, a tune. */
  private drawEmotes(w: World): void {
    const s = w.scene;
    if (!s?.emotes.length) return;
    const g = this.g;
    const GLYPH: Record<string, [string, string]> = { alert: ['!', '#ffcf5a'], question: ['?', '#9fd8ff'], dots: ['…', '#f2ead8'], heart: ['♥', '#ff6a8a'], note: ['♪', '#c8f0a0'] };
    g.save();
    g.font = '800 7px "Bricolage Grotesque Variable", system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.imageSmoothingEnabled = true;
    for (const e of s.emotes) {
      const who = e.who === 'hero' ? w.player : (w.npcs.find((n) => n.id === e.who) ?? w.pets.find((p) => !p.dead && p.def.id === e.who));
      if (!who) continue;
      const [ch, col] = GLYPH[e.icon] ?? GLYPH.alert!;
      // pops up, bobs, fades
      const k = clamp(e.t / 0.15, 0, 1);
      const fade = clamp((1.4 - e.t) / 0.3, 0, 1);
      const x = Math.round(who.x);
      this.upright(who.x, who.y, PERSON_H + 6);
      const y = who.y - k * 3 + Math.sin(e.t * 9) * 0.6;
      g.globalAlpha = fade;
      g.fillStyle = 'rgba(27,20,40,0.9)';
      g.beginPath();
      g.arc(x, y, 5.5, 0, TAU);
      g.fill();
      g.fillStyle = col;
      g.fillText(ch, x, y + 0.5);
    }
    g.restore();
  }

  /** Lines over people's heads (companions shouting in a fight, villagers crying out). */
  private drawSpeech(w: World): void {
    this.drawEmotes(w);
    const speech = w.story.speech;
    if (!speech.length) return;
    const g = this.g;
    g.save();
    g.font = '600 5.5px "Bricolage Grotesque Variable", system-ui, sans-serif';
    g.textBaseline = 'top';
    g.textAlign = 'left';
    g.imageSmoothingEnabled = true;
    for (const s of speech) {
      const who = s.who === 'hero' ? w.player : (w.pets.find((p) => !p.dead && p.def.id === s.who) ?? w.npcs.find((n) => n.id === s.who) ?? w.enemies.find((e) => !e.dead && e.def.id === s.who));
      if (!who) continue;
      // wrap at about 34 characters, at most three lines
      const words = s.text.split(' ');
      const lines: string[] = [];
      let cur = '';
      for (const wd of words) {
        if ((cur + ' ' + wd).trim().length > 34 && cur) {
          lines.push(cur);
          cur = wd;
        } else cur = (cur + ' ' + wd).trim();
      }
      if (cur) lines.push(cur);
      const shown = lines.slice(0, 3);
      const wdt = Math.max(...shown.map((l) => g.measureText(l).width)) + 6;
      const hgt = shown.length * 6.5 + 4;
      const fade = clamp(Math.min(s.t / 0.15, (s.dur - s.t) / 0.3), 0, 1);
      // (over the head of whoever is speaking, wherever they stand)
      this.upright(who.x, who.y, PERSON_H + 3);
      const x = who.x - wdt / 2;
      const y = who.y - 3 - hgt;
      g.globalAlpha = fade * 0.92;
      g.fillStyle = 'rgba(27,20,40,0.88)';
      g.beginPath();
      g.roundRect(x, y, wdt, hgt, 3);
      g.fill();
      g.beginPath();
      g.moveTo(who.x - 2, y + hgt);
      g.lineTo(who.x, y + hgt + 3);
      g.lineTo(who.x + 2, y + hgt);
      g.fill();
      g.globalAlpha = fade;
      g.fillStyle = '#f8f2e4';
      shown.forEach((l, i) => g.fillText(l, x + 3, y + 2.5 + i * 6.5));
    }
    g.restore();
  }

  private drawStars(x: number, y: number, time: number): void {
    const g = this.g;
    for (let i = 0; i < 3; i++) {
      const a = time * 5 + (i * TAU) / 3;
      g.fillStyle = '#ffe066';
      g.fillRect(Math.round(x + Math.cos(a) * 6), Math.round(y + Math.sin(a) * 2), 2, 2);
    }
  }

  private drawProjectile(pr: Projectile, time: number): void {
    const g = this.g;
    const x = Math.round(pr.x);
    const y = Math.round(pr.y);
    const a = Math.atan2(pr.vy, pr.vx);
    if (pr.hostile) {
      // enemy shots: red rim, dark core, unmistakable
      const r = Math.max(2, Math.round(pr.r));
      if (pr.look === 'enemyArrow' || pr.look === 'spear') {
        g.save();
        g.translate(x, y);
        g.rotate(a);
        const L = pr.look === 'spear' ? 12 : 8;
        g.fillStyle = '#1b1428';
        g.fillRect(-L, -2, L + 3, 4);
        g.fillStyle = pr.look === 'spear' ? '#d8d0b8' : '#c9b89a';
        g.fillRect(-L + 1, -1, L, 2);
        g.fillStyle = '#ff3f6a';
        g.fillRect(1, -1, 2, 2);
        g.restore();
        return;
      }
      if (pr.look === 'web') {
        // a spray of sticky threads
        g.save();
        g.translate(x, y);
        g.rotate(time * 6);
        g.fillStyle = '#ff2a4a';
        g.fillRect(-r - 1, -1, r * 2 + 2, 2);
        g.fillRect(-1, -r - 1, 2, r * 2 + 2);
        g.fillStyle = pr.color;
        g.fillRect(-r, 0, r * 2, 1);
        g.fillRect(0, -r, 1, r * 2);
        g.fillRect(-1, -1, 3, 3);
        g.restore();
        return;
      }
      if (pr.look === 'flame') {
        // a gout of fire: a flickering head with a tail streaming back
        const fl = Math.floor(time * 14) % 2;
        for (let i = 3; i >= 1; i--) pixelDisc(g, Math.round(x - Math.cos(a) * i * 2.5), Math.round(y - Math.sin(a) * i * 2.5), Math.max(1, r - i + 1), i === 3 ? '#a8261e' : '#ff7a3d');
        pixelDisc(g, x, y, r + 1, '#ff2a4a');
        pixelDisc(g, x, y, r, fl ? '#ff9a3d' : '#ffb04d');
        g.fillStyle = '#fff2a0';
        g.fillRect(x - 1, y - 1, 2, 2);
        return;
      }
      if (pr.look === 'bolt') {
        // a crackling bolt of lightning, jagged along its flight
        g.save();
        g.translate(x, y);
        g.rotate(a);
        const j = Math.floor(time * 20) % 2 ? 1 : -1;
        const pts: [number, number][] = [[-9, 0], [-6, -2 * j], [-3, 1 * j], [0, -2 * j], [3, 0]];
        for (const [width, color] of [[4, '#ff2a4a'], [2, pr.color], [1, '#ffffff']] as const) {
          g.fillStyle = color;
          for (let i = 0; i < pts.length - 1; i++) {
            const [x0, y0] = pts[i]!;
            const [x1, y1] = pts[i + 1]!;
            for (let t = 0; t <= 3; t++) g.fillRect(Math.round(x0 + ((x1 - x0) * t) / 3) - (width >> 1), Math.round(y0 + ((y1 - y0) * t) / 3) - (width >> 1), width, width);
          }
        }
        g.restore();
        return;
      }
      if (pr.look === 'ball') {
        // a cannonball (or a lump of something heavy): dark iron, a glint, a smoky wake
        g.fillStyle = 'rgba(90,84,100,0.5)';
        for (let i = 1; i <= 3; i++) g.fillRect(Math.round(x - Math.cos(a) * i * 3) - 1, Math.round(y - Math.sin(a) * i * 3) - 1, 2, 2);
        pixelDisc(g, x, y, r + 1, '#ff2a4a');
        pixelDisc(g, x, y, r, '#2a2630');
        g.fillStyle = '#8a8698';
        g.fillRect(x - 1, y - r + 1, 2, 1);
        return;
      }
      const pulse = Math.floor(time * 10) % 2;
      pixelDisc(g, x, y, r + 1, '#ff2a4a');
      pixelDisc(g, x, y, r, pr.color);
      g.fillStyle = pulse ? '#ffffff' : '#1b1428';
      g.fillRect(x - 1, y - 1, 2, 2);
      if (pr.look === 'skull') {
        g.fillStyle = '#1b1428';
        g.fillRect(x - 2, y - 1, 1, 1);
        g.fillRect(x + 1, y - 1, 1, 1);
      }
      return;
    }
    const look = pr.look;
    const [c1, c2] = PROJECTILE_COLORS[look] ?? TYPE_COLORS[pr.type] ?? ['#e8e0c8', '#ffffff'];
    if (look === 'shield' || look === 'judgment') {
      // a thrown shield or a hammer of light, spinning
      const s = weaponSprite(look === 'shield' ? 'shield' : 'hammer', look === 'shield' ? undefined : '#ffd84d');
      g.globalAlpha = 0.45;
      g.drawImage(glowDisc(c1, 9), x - 9, y - 9);
      g.globalAlpha = 1;
      g.save();
      g.translate(x, y);
      g.rotate(time * 16);
      g.drawImage(s.c, -s.width / s.k / 2, -s.height / s.k / 2, s.width / s.k, s.height / s.k);
      g.restore();
      return;
    }
    if (look === 'icelance' || look === 'vines') {
      // a long spike of ice, or a lashing root
      g.save();
      g.translate(x, y);
      g.rotate(a);
      if (look === 'icelance') {
        g.fillStyle = rgba(c1, 0.35);
        g.fillRect(-16, -1, 8, 2);
        g.fillStyle = '#1b1428';
        g.fillRect(-10, -2, 12, 4);
        g.fillStyle = c1;
        g.fillRect(-9, -1, 10, 2);
        g.fillStyle = c2;
        g.fillRect(-6, -1, 7, 1);
        g.fillRect(2, -1, 2, 2);
        g.fillRect(4, 0, 1, 1);
      } else {
        for (let i = 0; i < 6; i++) {
          const wy = Math.round(Math.sin(time * 20 - i * 1.3) * 1.5);
          g.fillStyle = i % 2 ? c1 : '#2e6a2a';
          g.fillRect(-i * 2 - 1, wy - 1, 2, 2);
        }
        g.fillStyle = c2;
        g.fillRect(1, -1, 2, 2);
        g.fillRect(-4, Math.round(Math.sin(time * 20) * 2) - 3, 1, 2);
      }
      g.restore();
      return;
    }
    if (look === 'quake') {
      g.save();
      g.translate(x, y);
      g.rotate(a);
      g.fillStyle = rgba('#5a4428', 0.7);
      g.fillRect(-8, -pr.r, 12, pr.r * 2);
      for (let i = 0; i < 6; i++) {
        g.fillStyle = i % 2 ? c1 : c2;
        g.fillRect(-6 + ((i * 5) % 10), -pr.r + ((i * 7 + Math.floor(time * 30)) % (pr.r * 2)), 3, 2);
      }
      g.restore();
      return;
    }
    if (look === 'arrow' || look === 'piercing-arrow' || look === 'multishot' || (pr.type === 'physical' && look !== 'shard')) {
      g.save();
      g.translate(x, y);
      g.rotate(a);
      const L = look === 'piercing-arrow' ? 11 : 8;
      g.fillStyle = look === 'piercing-arrow' ? 'rgba(255,240,180,0.45)' : 'rgba(255,255,255,0.25)';
      g.fillRect(-L - 6, -1, 6, 2);
      g.fillStyle = '#8a5a34';
      g.fillRect(-L, 0, L, 1);
      g.fillStyle = '#e8e8f0';
      g.fillRect(0, -1, 2, 3);
      g.fillStyle = look === 'piercing-arrow' ? '#ffe066' : '#ffffff';
      g.fillRect(2, 0, 1, 1);
      g.fillStyle = '#7cc45a';
      g.fillRect(-L, -1, 2, 1);
      g.fillRect(-L, 1, 2, 1);
      g.restore();
      return;
    }
    // bolts, fireballs, embers: a bolt of their element from the spell pack, or a glowing core with a short tail
    if (drawBolt(g, look, pr.type, pr.x, pr.y, a, pr.age, pr.r)) return;
    const r = Math.max(1.5, pr.r);
    g.globalAlpha = 0.5;
    g.drawImage(glowDisc(c1, Math.ceil(r * 2.5)), x - Math.ceil(r * 2.5), y - Math.ceil(r * 2.5));
    g.globalAlpha = 1;
    for (let i = 1; i <= 3; i++) {
      g.fillStyle = rgba(c1, 0.55 - i * 0.15);
      const s = Math.max(1, Math.round(r * (1 - i * 0.22)));
      g.fillRect(Math.round(x - Math.cos(a) * i * 3 - s / 2), Math.round(y - Math.sin(a) * i * 3 - s / 2), s, s);
    }
    const R = Math.round(r);
    pixelDisc(g, x, y, R, c1);
    pixelDisc(g, x, y, Math.max(1, R - 1), c2);
    if (look === 'lightning' || look === 'spark' || look === 'ball') {
      g.fillStyle = '#ffffff';
      g.fillRect(x + Math.round(Math.random() * 4 - 2), y + Math.round(Math.random() * 4 - 2), 1, 1);
      if (look === 'ball') {
        const k = Math.random() * TAU;
        g.fillStyle = c1;
        g.fillRect(x + Math.round(Math.cos(k) * (R + 2)), y + Math.round(Math.sin(k) * (R + 2)), 1, 2);
      }
    } else if (look === 'starsurge' || look === 'starfire') {
      // twinkles trail the star
      for (let i = 0; i < 2; i++) {
        const ph = (time * 3 + i * 0.5 + pr.x * 0.01) % 1;
        g.fillStyle = rgba(c2, 1 - ph);
        g.fillRect(Math.round(x - Math.cos(a) * (4 + ph * 8) + Math.sin(a) * (i ? 3 : -3)), Math.round(y - Math.sin(a) * (4 + ph * 8) - Math.cos(a) * (i ? 3 : -3)), 1, 1);
      }
      g.fillStyle = c2;
      g.fillRect(x - R - 1, y, 1, 1);
      g.fillRect(x + R, y, 1, 1);
      g.fillRect(x, y - R - 1, 1, 1);
      g.fillRect(x, y + R, 1, 1);
    } else if (look === 'shadowbolt' || look === 'chaosbolt') {
      // a dark heart and wisps
      g.fillStyle = look === 'chaosbolt' ? '#1a3a10' : '#1b0e2e';
      g.fillRect(x - 1, y - 1, 2, 2);
      g.fillStyle = rgba(c1, 0.7);
      const k = time * 12 + pr.x;
      g.fillRect(Math.round(x + Math.cos(k) * (R + 1)), Math.round(y + Math.sin(k) * (R + 1)), 1, 1);
    }
  }

  private drawFx(f: Fx, _w: World): void {
    const g = this.g;
    // the packed spell effects (an impact, a cast, a blast): only a picture, nothing to fall back to
    if (f.sprite && f.sprite.includes(':')) {
      drawVfx(g, f.sprite, f.x, f.y, f.t, f.size);
      return;
    }
    const k = f.t / f.life;
    const x = Math.round(f.x);
    const y = Math.round(f.y);
    switch (f.kind) {
      case 'spark': {
        // a hot speck, bright at its heart
        const r = Math.max(1.4, f.size * 0.9) * (1 - k * 0.5);
        g.save();
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = clamp(1.4 - k * 1.4, 0, 1);
        g.fillStyle = f.color;
        g.beginPath();
        g.arc(f.x, f.y, r, 0, TAU);
        g.fill();
        g.fillStyle = '#ffffff';
        g.beginPath();
        g.arc(f.x, f.y, r * 0.45, 0, TAU);
        g.fill();
        g.restore();
        break;
      }
      case 'rubble':
      case 'coin':
      case 'shard': {
        // a chip of something, turning as it flies
        const r = Math.max(1.8, f.size * 1.1);
        g.save();
        g.globalAlpha = clamp(1.6 - k * 1.4, 0, 1);
        g.translate(f.x, f.y);
        g.rotate(f.a + f.t * 9);
        g.fillStyle = f.color;
        g.beginPath();
        g.moveTo(0, -r);
        g.lineTo(r * 0.8, 0);
        g.lineTo(0, r * 0.7);
        g.lineTo(-r * 0.8, 0);
        g.closePath();
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.35)';
        g.beginPath();
        g.moveTo(0, -r);
        g.lineTo(r * 0.8, 0);
        g.lineTo(0, 0);
        g.closePath();
        g.fill();
        g.restore();
        break;
      }
      case 'smoke': {
        // a soft puff that swells and thins as it rises (three lumps: it stands up from the ground)
        this.upright(f.x, f.y, 4 + k * 14);
        const rr = (f.size * (1.3 + k * 1.3)) / 2;
        g.fillStyle = f.color;
        g.globalAlpha = clamp(0.5 - k * 0.5, 0, 1);
        g.beginPath();
        g.arc(f.x, f.y, rr, 0, TAU);
        g.arc(f.x + rr * 0.7, f.y + rr * 0.25, rr * 0.7, 0, TAU);
        g.arc(f.x - rr * 0.7, f.y + rr * 0.3, rr * 0.65, 0, TAU);
        g.fill();
        g.globalAlpha = clamp(0.28 - k * 0.28, 0, 1);
        g.fillStyle = '#ffffff';
        g.beginPath();
        g.arc(f.x - rr * 0.2, f.y - rr * 0.3, rr * 0.55, 0, TAU);
        g.fill();
        g.globalAlpha = 1;
        break;
      }
      case 'leaf':
        g.fillStyle = f.color;
        g.globalAlpha = clamp(1 - k * 1.2, 0, 0.9);
        g.save();
        g.translate(f.x, f.y);
        g.rotate(f.a + f.t * 4);
        g.fillRect(-2.5, -1, 5, 2);
        g.restore();
        g.globalAlpha = 1;
        f.vx += Math.sin(f.t * 3 + f.a) * 0.6;
        break;
      case 'ember':
        if (f.sprite === 'meteor') {
          // the falling meteor: burning rock and its long tail
          this.upright(f.x, f.y, 10);
          g.save();
          g.globalCompositeOperation = 'lighter';
          g.drawImage(glowDisc('#ff7a3d', 20), f.x - 20, f.y - 20);
          const tail = g.createLinearGradient(f.x - 14, f.y - 42, f.x, f.y);
          tail.addColorStop(0, 'rgba(255,122,61,0)');
          tail.addColorStop(1, 'rgba(255,190,90,0.8)');
          g.fillStyle = tail;
          g.beginPath();
          g.moveTo(f.x - 14, f.y - 42);
          g.lineTo(f.x + 9, f.y - 3);
          g.lineTo(f.x - 8, f.y + 5);
          g.closePath();
          g.fill();
          g.restore();
          pixelDisc(g, f.x, f.y, 9, '#4a342c');
          pixelDisc(g, f.x + 1.5, f.y + 1.5, 6, '#ff9a3d');
          pixelDisc(g, f.x + 2.5, f.y + 2.5, 3, '#fff2a0');
        } else {
          g.save();
          g.globalCompositeOperation = 'lighter';
          g.globalAlpha = clamp(1.2 - k, 0, 1);
          pixelDisc(g, f.x, f.y, 1.6, f.color);
          g.restore();
        }
        break;
      case 'ring': {
        const rr = Math.max(1, f.size * (0.3 + k * 0.7));
        const wide = Math.max(2, Math.min(7, f.size * 0.14)) * (1 - k * 0.6);
        g.beginPath();
        g.arc(f.x, f.y, rr, 0, TAU);
        g.strokeStyle = rgba(f.color, clamp(1 - k, 0, 1) * 0.35);
        g.lineWidth = wide * 2.2;
        g.stroke();
        g.strokeStyle = rgba(f.color, clamp(1.1 - k, 0, 1));
        g.lineWidth = wide;
        g.stroke();
        g.strokeStyle = rgba('#ffffff', clamp(0.8 - k, 0, 1));
        g.lineWidth = wide * 0.35;
        g.stroke();
        break;
      }
      case 'burst': {
        const s0 = Math.ceil(f.size * (1.1 + k * 0.4));
        g.save();
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = clamp(1 - k, 0, 1);
        g.drawImage(glowDisc(f.color, s0), x - s0, y - s0);
        g.restore();
        break;
      }
      case 'glow': {
        const s0 = Math.ceil(f.size * 1.2);
        g.save();
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = clamp(Math.sin(k * Math.PI), 0, 1) * 0.85;
        g.drawImage(glowDisc(f.color, s0), x - s0, y - s0);
        g.restore();
        break;
      }
      case 'slash': {
        // the blow's path, laid on the ground round who struck: a thick crescent, pinched at its tips, that
        // sweeps out and thins, with a white-hot leading edge
        const sweep = f.a2 * Math.min(1, k * 2.6 + 0.3);
        const a0 = f.a - f.a2 / 2;
        const R = f.size + 3;
        const thick = Math.max(6, R * (f.r2 ? 0.46 : 0.36)) * (1 - k * 0.6);
        g.save();
        const fade = clamp(1.15 - k * 1.15, 0, 1);
        // (bright where the blade is, nothing where it has been)
        const tail = sweep < TAU - 0.05 && g.createConicGradient ? g.createConicGradient(a0, f.x, f.y) : null;
        if (tail) {
          const head = Math.min(0.999, sweep / TAU);
          tail.addColorStop(0, rgba(f.color, 0));
          tail.addColorStop(head * 0.55, rgba(f.color, 0.22));
          tail.addColorStop(head, rgba(f.color, 0.8));
          tail.addColorStop(Math.min(1, head + 0.001), rgba(f.color, 0));
          g.fillStyle = tail;
        } else g.fillStyle = rgba(f.color, 0.45);
        g.globalAlpha = fade;
        crescent(g, f.x, f.y, R, thick, a0, sweep);
        // the hot rim, along the blade's own edge
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = fade;
        g.strokeStyle = '#ffffff';
        g.lineCap = 'round';
        g.lineWidth = f.r2 ? 2.4 : 1.7;
        g.beginPath();
        g.arc(f.x, f.y, R - 0.5, a0 + sweep * 0.45, a0 + sweep);
        g.stroke();
        g.restore();
        break;
      }
      case 'zap': {
        g.beginPath();
        g.moveTo(f.x, f.y);
        const n = Math.max(5, Math.min(10, Math.round(Math.hypot(f.x2 - f.x, f.y2 - f.y) / 14)));
        for (let i = 1; i < n; i++) {
          const t = i / n;
          g.lineTo(f.x + (f.x2 - f.x) * t + (Math.random() - 0.5) * 12, f.y + (f.y2 - f.y) * t + (Math.random() - 0.5) * 12);
        }
        g.lineTo(f.x2, f.y2);
        g.lineJoin = 'round';
        g.strokeStyle = rgba(f.color, clamp(1.2 - k, 0, 1) * 0.4);
        g.lineWidth = 6;
        g.stroke();
        g.strokeStyle = rgba(f.color, clamp(1.2 - k, 0, 1));
        g.lineWidth = 3;
        g.stroke();
        g.strokeStyle = rgba('#ffffff', clamp(1 - k, 0, 1));
        g.lineWidth = 1.2;
        g.stroke();
        break;
      }
      case 'beam': {
        if (f.sprite === 'arrow') {
          // a falling arrow of the volley
          this.upright(f.x, f.y, 0);
          const h = 60 * (1 - k);
          g.fillStyle = '#7a4a2a';
          g.fillRect(f.x - 1, f.y - h - 16, 2, 14);
          g.fillStyle = '#e8e8f0';
          g.beginPath();
          g.moveTo(f.x - 2.5, f.y - h - 4);
          g.lineTo(f.x + 2.5, f.y - h - 4);
          g.lineTo(f.x, f.y - h + 1);
          g.closePath();
          g.fill();
          g.fillStyle = '#d8dce8';
          g.fillRect(f.x - 2.5, f.y - h - 18, 5, 3);
        } else {
          // a shaft of light from the sky, fading toward its top
          this.upright(f.x, f.y, 0);
          const wide = Math.max(4, f.size);
          const shaft = g.createLinearGradient(0, f.y - 170, 0, f.y);
          shaft.addColorStop(0, rgba(f.color, 0));
          shaft.addColorStop(1, rgba(f.color, clamp(1 - k, 0, 1)));
          g.save();
          g.globalCompositeOperation = 'lighter';
          g.fillStyle = shaft;
          g.fillRect(f.x - wide / 2, f.y - 170, wide, 170);
          const core = g.createLinearGradient(0, f.y - 170, 0, f.y);
          core.addColorStop(0, 'rgba(255,255,255,0)');
          core.addColorStop(1, rgba('#ffffff', clamp(1 - k, 0, 1)));
          g.fillStyle = core;
          g.fillRect(f.x - wide / 6, f.y - 170, wide / 3, 170);
          g.restore();
        }
        break;
      }
      case 'rift': {
        const s = f.size * Math.sin(Math.min(1, k * 1.5) * Math.PI * 0.5);
        g.fillStyle = rgba('#120018', 0.85);
        g.beginPath();
        g.ellipse(f.x, f.y, s, s, 0, 0, TAU);
        g.fill();
        g.strokeStyle = Math.floor(f.t * 20) % 2 ? '#ff3fd2' : '#22e4ff';
        g.lineWidth = 2.5;
        g.stroke();
        break;
      }
      case 'ghost': {
        // what is left of someone, rising
        this.upright(f.x, f.y, 10 + k * 26);
        g.globalAlpha = clamp(0.55 - k * 0.55, 0, 1);
        g.fillStyle = '#dfe8ff';
        g.beginPath();
        g.arc(f.x, f.y - 3, 8, Math.PI, 0);
        g.lineTo(f.x + 8, f.y + 10);
        g.lineTo(f.x + 3, f.y + 7);
        g.lineTo(f.x, f.y + 11);
        g.lineTo(f.x - 3, f.y + 7);
        g.lineTo(f.x - 8, f.y + 10);
        g.closePath();
        g.fill();
        g.globalAlpha = 1;
        break;
      }
      default:
        break;
    }
  }

  private drawPortal(x: number, y: number, time: number): void {
    const g = this.g;
    g.drawImage(glowDisc('rgba(34,228,255,0.6)', 24), x - 24, y - 30);
    for (let i = 0; i < 3; i++) {
      const r = 8 + i * 3 + Math.sin(time * 3 + i) * 1.5;
      g.strokeStyle = i % 2 ? '#22e4ff' : '#ff3fd2';
      g.lineWidth = 1;
      g.beginPath();
      g.ellipse(x, y - 8, r * 0.7, r, 0, 0, TAU);
      g.stroke();
    }
  }

  private drawCollapse(cx: number, cy: number, r: number, time: number): void {
    const g = this.g;
    g.save();
    g.fillStyle = 'rgba(30,0,40,0.5)';
    g.beginPath();
    g.rect(cx - 600, cy - 600, 1200, 1200);
    g.ellipse(cx, cy, r, r, 0, 0, TAU, true);
    g.fill('evenodd');
    g.strokeStyle = Math.floor(time * 8) % 2 ? '#ff3fd2' : '#22e4ff';
    g.lineWidth = 1;
    g.beginPath();
    g.ellipse(cx, cy, r, r, 0, 0, TAU);
    g.stroke();
    g.restore();
  }

  /* -------------------------------------------------------------- light */

  /* ----------------------------------------------------------- overlays */

  /**
   * The ways into buildings, and back out: a warm pool of light on the step and a gold chevron pointing through
   * the door (in, under a painted door; out, at a room's door), so a door you can use never looks like one
   * you can't. Walking onto it goes through.
   */
  private drawEntrances(w: World, time: number): void {
    const g = this.g;
    const inside = !!w.region.interior;
    for (const x of w.exits) {
      if (!x.door) continue;
      const pulse = 0.5 + Math.sin(time * 3 + x.x * 0.1) * 0.5;
      // the step: on the tile in front of a painted door, on the door tile itself indoors
      const cy = inside ? x.y : x.y - 4;
      g.save();
      const grd = g.createRadialGradient(x.x, cy, 0, x.x, cy, 14);
      grd.addColorStop(0, rgba('#ffe08a', 0.6 + pulse * 0.2));
      grd.addColorStop(0.6, rgba('#ffc84a', 0.25 + pulse * 0.1));
      grd.addColorStop(1, rgba('#ffc84a', 0));
      g.fillStyle = grd;
      g.beginPath();
      g.ellipse(x.x, cy, 14, 7, 0, 0, Math.PI * 2);
      g.fill();
      // two chevrons, nudging the way through
      const dir = inside ? 1 : -1;
      const bob = Math.round(Math.sin(time * 4) * 1.5) * dir;
      g.lineJoin = 'round';
      g.lineCap = 'round';
      for (const step of [0, 4]) {
        const tip = cy + dir * (3 - step) + bob;
        const back = tip - dir * 4;
        g.beginPath();
        g.moveTo(x.x - 5, back);
        g.lineTo(x.x, tip);
        g.lineTo(x.x + 5, back);
        g.strokeStyle = 'rgba(40, 24, 16, 0.75)';
        g.lineWidth = 3.4;
        g.stroke();
        g.strokeStyle = step ? 'rgba(255, 244, 196, 0.75)' : '#fff4c4';
        g.lineWidth = 1.8;
        g.stroke();
      }
      g.restore();
    }
  }

}

/** A filled circle. */
const FIRE: Record<string, readonly [string, string, string]> = {
  default: ['#f4561f', '#ff9f2e', '#fff0a0'],
  // the cold dead of a crypt burn pale; a giant's ice burns blue; a rift burns violet; the rot burns sick green
  crypt: ['#4a7ad8', '#8ac0f0', '#e8f8ff'],
  icecave: ['#2a8ad8', '#70d0f0', '#e8ffff'],
  riftspire: ['#a03ae0', '#e070f0', '#ffe8ff'],
  roots: ['#5a9a2a', '#a8d040', '#f0ffa0'],
  citadel: ['#7a4ac8', '#b890f0', '#f0e8ff'],
  lavacave: ['#e0321a', '#ff7a1e', '#ffe080'],
  cistern: ['#3a9a78', '#70d0a0', '#e0ffe8'],
};

/** A shot's size next to the rules' circle. */
const SHOT_SCALE = 1.5;

/** A crescent round (x, y): the outer edge an arc, the inner edge bowing in to `thick` at the middle and pinching at the tips. */
function crescent(g: CanvasRenderingContext2D, x: number, y: number, r: number, thick: number, a0: number, sweep: number): void {
  g.beginPath();
  if (sweep >= TAU - 0.05) {
    // (all the way round: a band)
    g.arc(x, y, r, 0, TAU);
    g.arc(x, y, Math.max(0.5, r - thick), TAU, 0, true);
    g.fill('evenodd');
    return;
  }
  g.arc(x, y, r, a0, a0 + sweep);
  const mid = a0 + sweep / 2;
  const reach = r - thick * 2;
  g.quadraticCurveTo(x + Math.cos(mid) * reach, y + Math.sin(mid) * reach, x + Math.cos(a0) * r, y + Math.sin(a0) * r);
  g.closePath();
  g.fill();
}

function pixelDisc(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  g.fillStyle = color;
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
}

export const rarityColor = (r: string | undefined): string => (r === 'legendary' ? '#ff9a2a' : r === 'epic' ? '#c58cff' : r === 'rare' ? '#5ab0ff' : r === 'uncommon' ? '#6dff8f' : '#e8e0d0');

/**
 * The mark over someone: "?" when they take a quest back (handed in, or a talk the quest is for), "!" when they
 * have one to give; gold for the main story, blue for a side quest (the handing-in comes first).
 */
export function npcMark(w: World, id: string): MapIcon | null {
  const h = w.hero;
  let side: MapIcon | null = null;
  for (const [q, s] of Object.entries(h.quests)) {
    const def = QUEST_DEFS[q];
    if (!def) continue;
    const main = isMainQuest(q);
    const handIn = (s.state === 'ready' && turnInNpc(def) === id) || (s.state === 'active' && (() => { const o = currentObjective(h, def); return o.kind === 'talk' && o.npc === id; })());
    if (handIn) return main ? 'handin' : 'handinSide';
    if (s.state === 'offered' && def.giver === id && (!side || main)) side = main ? 'offer' : 'offerSide';
  }
  return side;
}

import { NPCS, QUEST_DEFS } from '../data/quests';

