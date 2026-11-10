import { clamp, damp, TAU } from '../core/math';
import { currentObjective } from '../progress/character';
import { drawMapIcon, type MapIcon } from '../ui/mapIcons';
import { isMainQuest, turnInNpc } from '../progress/handin';
import { LEAD, leanTarget, LIFT } from './camera';
import { Effects, headOf } from './effects';
import { THEMES } from '../data/themes';
import type { ClassId } from '../data/types';
import { TILE } from '../sim/map';
import type { Enemy, NpcActor, Pet } from '../sim/types';
import type { World } from '../sim/world';
import { ctx2d, rgba } from './pixel';
import { heldWeapon, itemIconCanvas, heroLook, vendorSign } from './sprites';
import type { HeroLook } from './art/hero';
import { wornLooks } from '../progress/wardrobe';
import { objectiveTarget } from '../sim/objective';
import { aimReach, autoTarget, tapAutoAims } from '../sim/cast';
import { PERSON_H, type Cast } from '../render3d/cast';
import type { Fx3D } from '../render3d/fx3d';
import { hexRgb } from '../render3d/kits';
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
  under?(g: CanvasRenderingContext2D, time: number, view: LandView): void;
  /** Who stands on the land. */
  cast?(cast: Cast, dt: number, time: number): void;
  /** Its spells (render3d/fx3d.ts). */
  fx?(fx: Fx3D, cast: Cast, time: number): void;
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
  private readonly effects = new Effects();
  private landFor: World | null = null;
  /** The story state the land was built for (World.stateVersion). */
  private landVersion = -1;
  /** How much the townsfolk are out (they go indoors while the story fights in the streets). */
  /** How far night has come over the land (0-1), and for which world. */
  private nightK = 0;
  private nightFor: World | null = null;
  private wasDusk = false;
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
   * Fits the view to the element: about 196 world pixels tall on phones (bigger figures) and 240 on
   * desktops, never less than 150 across the short side.
   */
  resize(cssW: number, cssH: number, dpr: number, touch: boolean): void {
    const devW = Math.max(1, Math.round(cssW * dpr));
    const devH = Math.max(1, Math.round(cssH * dpr));
    const landscape = devW >= devH;
    let total = (landscape ? devH : devW * 1.25) / (touch ? 196 : 240);
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
    this.stageNow()?.setSize(this.cssW, this.cssH, dpr, total * TILE, touch);
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
    // near a way out at an edge the view may go a little past the edge, so what it goes through (a cave, an arch,
    // trees) is seen whole: easing in as the hero nears it, so the camera never jumps
    const peek = this.edgePeek(w);
    this.camX = mapW <= this.vw ? (mapW - this.vw) / 2 : clamp(x, -peek.l, mapW - this.vw + peek.r);
    this.camY = mapH <= this.vh ? (mapH - this.vh) / 2 : clamp(y, -peek.t, mapH - this.vh + peek.b);
  }

  /** How far past each edge the view may go: up to a few tiles, the nearer the hero is to a way out at that edge. */
  private edgePeek(w: World): { l: number; r: number; t: number; b: number } {
    const out = { l: 0, r: 0, t: 0, b: 0 };
    if (w.region.interior || w.region.kind === 'dungeon') return out;
    const mapW = w.map.w * TILE;
    const mapH = w.map.h * TILE;
    const near = TILE * 12;
    const most = TILE * 4;
    const p = w.player;
    for (const x of w.exits) {
      if (x.door) continue;
      const d = Math.hypot(x.x - p.x, x.y - p.y);
      if (d >= near) continue;
      const k = most * Math.min(1, (1 - d / near) * 1.6);
      if (x.x < TILE * 4) out.l = Math.max(out.l, k);
      if (x.x > mapW - TILE * 4) out.r = Math.max(out.r, k);
      if (x.y < TILE * 4) out.t = Math.max(out.t, k);
      if (x.y > mapH - TILE * 4) out.b = Math.max(out.b, k);
    }
    return out;
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
      const hadWays = st.land ? [...st.land.ways.keys()] : [];
      st.land = new Land3D(w.map, w.region, st.landPacks!, (pm) => w.isShown(pm), this.keepObject);
      st.scene.add(st.land.group);
      st.groundScene.add(st.land.under);
      this.landFor = w;
      // a way down that wasn't there a moment ago comes up out of the ground, with the sound of old stone
      if (!fresh) {
        for (const [to, way] of st.land.ways) {
          if (hadWays.includes(to)) continue;
          st.land.openWay(to);
          const x = way.x * TILE;
          const y = way.z * TILE;
          w.sfx('doorSlam', 0.8);
          w.shake(2.5);
          for (let i = 0; i < 8; i++) w.addFx({ kind: 'smoke', x: x + (i - 3.5) * 8, y: y - 10 - (i % 3) * 14, life: 1.1 + (i % 3) * 0.3, size: 12 + (i % 4) * 3, color: '#8a8494' });
        }
      }
      if (fresh) {
        this.setHeroWeapon(w.hero.cls, w);
        this.snap(w);
        this.people.reset();
        st.cast.preload(this.expected(w));
      }
    }
    st?.land?.tickOpening(dt);
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
      this.setMood(w, st, dt);
      st.heroAt(p.x, p.y);
      st.land?.update(cx / TILE, cy / TILE, st.spanX, st.spanZ);
      st.land?.lightFlames(cx / TILE, cy / TILE, time, this.burning(w));
      st.land?.updateDoors(dt);
      st.land?.updateColumns(dt, p.x / TILE, p.y / TILE);
      this.folkK = damp(this.folkK, w.story.fighting ? 0 : 1, 3, dt);
      st.cast.begin();
      this.people.sync(st.cast, w, dt, time, { look: this.look ?? heroLook(w.hero.cls), weapon: this.weapon, folk: this.folkK, statues: st.land?.statues, colossi: st.land?.colossi, landOnly: this.landOnly });
      this.layer?.cast?.(st.cast, dt, time);
      st.fx.begin();
      this.effects.draw(w, { fx: st.fx, cast: st.cast, land: st.land, time, near: (x, y) => Math.abs(x - cx) < this.vw * 0.7 && Math.abs(y - cy) < this.vh * 0.9 });
      this.layer?.fx?.(st.fx, st.cast, time);
      st.fx.end();
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

    // ---- what's drawn on the ground for the player: on its own layer, under whatever stands
    const near0 = (x: number, y: number): boolean => Math.abs(x - cx) < this.vw * 0.7 && Math.abs(y - cy) < this.vh * 0.9;
    if (st) this.g = st.beginDecals();
    const dg = this.g;
    this.flat(p.x, p.y);
    if (!w.scene) this.drawAim(w);
    this.drawFacing(w, time);
    if (!this.landOnly) this.drawEntrances(w, time);
    this.flat(cx, cy);
    this.layer?.under?.(dg, time, view);
    this.g = g;

    // ---- icons over what's on the ground, and another game's own
    const near = near0;
    // (what a wall stands in front of isn't shown over the wall)
    const seen = (x: number, y: number, h: number): boolean => near0(x, y) && !st?.land?.hidden(x, y, h);
    for (const d of w.drops) if (d.kind === 'item' && near(d.x, d.y)) this.drawItemDrop(d, time);
    this.flat(cx, cy);
    this.layer?.over(g, time, view);

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
        // their cast bar, filling in gold under their health
        if (gh.cast && !gh.dead) this.bar(s.x, s.y + 8, 34, gh.cast.k, '#ffd36a');
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
  /** What the story has burning here lights the night too (a roof gives more than a torch). */
  private burning(w: World): { x: number; z: number; reach: number }[] {
    const out: { x: number; z: number; reach: number }[] = [];
    for (const f of w.fires) if (w.fireLit(f)) out.push({ x: f.x / TILE, z: f.y / TILE, reach: 7.5 });
    return out;
  }

  private setMood(w: World, st: Stage, dt: number): void {
    const look = THEMES[w.region.theme];
    const grade = LIGHT.uGrade.value;
    const dark = LIGHT.uDark.value;
    const night = LIGHT.uNight.value;
    const dread = look.dread;
    grade.set(0, 0, 0, 0);
    dark.set(0, 8, 0, 0);
    // night falling or lifting is a matter of a few seconds; coming into a land it's already what it is
    const state = w.storyState;
    const want = state?.night ? 1 : state?.dusk ? 0.7 : 0;
    this.nightK = w !== this.nightFor ? want : damp(this.nightK, want, 0.9, dt);
    this.nightFor = w;
    // (a dusk is warmer than the moon: it goes to violet before it goes to blue)
    if (want === 0.7 || (want === 0 && this.nightK > 0 && this.wasDusk)) night.set(0.62, 0.52, 0.72, this.nightK);
    else night.set(0.5, 0.56, 0.84, this.nightK);
    if (want) this.wasDusk = want === 0.7;
    const paint = (hex: string, a: number): void => {
      const [r, gg, b] = hexRgb(hex);
      grade.set(r, gg, b, a);
    };
    if (look.tint) paint(look.tint, 0.14);
    if (w.storyState?.gloom) paint('#3a4468', 0.16);
    // a room under the sea (sim/patterns/grotto.ts): green and deep
    if (w.flooded > 0) paint('#1a7a96', 0.3 * w.flooded);
    if (dread && dread.dark > 0) {
      paint(dread.shade, 0.16);
      dark.set(dread.dark * 0.2, 16, 0, 0);
    }
    // a crypt sets a mood, never hides the game: the far edge of the view is dim, everything can be seen. (A night
    // has no such edge: it's night everywhere, and what's lit is lit.)
    if (w.region.dark) dark.set(0.36, 11, 0, 0);
    // a quarter of a hall whose lamp was devoured (sim/patterns/barrow-of-kings.ts): the gloom closes in
    if (w.dimmed > 0) {
      paint('#1a1030', 0.32 * w.dimmed);
      dark.set(0.36 + 0.3 * w.dimmed, 11 - 4 * w.dimmed, 0, 0);
    }
    void st;
  }

  /* ---------------------------------------------------------------- names and marks */

  private drawEnemyBar(e: Enemy, st: Stage): void {
    if (e.dead || e.boss || e.dummy || e.state === 'spawn') return;
    const named = !!e.def.named;
    if (e.hp >= e.maxHp && !e.elite.length && !named && e.shield <= 0) return;
    const s = st.project(e.x, e.y, headOf(e));
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

  /** An item on the ground: its icon, over its beam (render/effects.ts). */
  private drawItemDrop(d: World['drops'][number], time: number): void {
    const g = this.g;
    const item = d.item;
    if (!item) return;
    this.upright(d.x, d.y, 10 + d.z + Math.sin(time * 3 + d.x) * 1.5);
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
  private arrowLand = '';
  private arrowSince = 0;

  private drawObjectiveArrow(w: World, time: number, st: Stage): void {
    const target = objectiveTarget(w);
    // enemies to hunt show on the minimap; the edge arrow is for places
    if (!target || target.soft) return;
    const g = this.g;
    const W = this.cssW;
    const H = this.cssH;
    // right after a change of land the camera can still be on the old one: point nowhere until it is on the hero
    const me = st.project(w.player.x, w.player.y, PERSON_H);
    if (Math.abs(me.x - W / 2) > W * 0.3 || Math.abs(me.y - H / 2) > H * 0.3) return;
    if (this.arrowLand !== w.region.id) {
      this.arrowLand = w.region.id;
      this.arrowSince = time;
    }
    if (time - this.arrowSince < 0.5) return;
    const s = st.project(target.x, target.y, PERSON_H);
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
      // (laid on the ground where the enemy stands: the ground's slant there, not at the hero, so it rings them on any part of the screen)
      this.flat(t.x, t.y);
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
      this.flat(p.x, p.y);
      return;
    }
    // on the ground, straight along the aim (the 3D ground is foreshortened already: no 2D lift or squash on top)
    const d = 17 + Math.sin(time * 5) * 1.2;
    const ax = p.x + Math.cos(p.aim) * d;
    const ay = p.y + Math.sin(p.aim) * d;
    this.flat(ax, ay);
    g.save();
    g.translate(ax, ay);
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
    this.flat(p.x, p.y);
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

  /** The size a world pixel is drawn in the middle of the view, on the overlay. */
  private plainScale(): number {
    const st = this.stage;
    if (!st) return this.k;
    const cx = this.camX + this.vw / 2;
    const cy = this.camY + this.vh / 2;
    const a = st.project(cx, cy, PERSON_H);
    const b = st.project(cx + TILE, cy, PERSON_H);
    return ((b.x - a.x) / TILE) * this.k;
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
      // ...and always all of it on the screen, clear of the bars along its edges: someone just out of view can still
      // shout. (Then it has no one to point at, so it goes without its tail.) One size for everyone, near or far: past
      // the far edge of the view the land's perspective would stretch it, and behind the camera turn it upside down.
      let t = g.getTransform();
      const plain = this.plainScale();
      if (!(t.a >= plain * 0.82 && t.a <= plain * 1.2)) {
        const s0 = t.a > 0 ? Math.min(plain * 1.2, Math.max(plain * 0.82, t.a)) : plain;
        const aimed = t.a > 0 && Number.isFinite(t.e) && Number.isFinite(t.f);
        const ax = aimed ? t.a * who.x + t.e : g.canvas.width / 2;
        const ay = aimed ? t.d * (who.y - 3 - hgt) + t.f : -9999;
        g.setTransform(s0, 0, 0, s0, ax - s0 * who.x, ay - s0 * (who.y - 3 - hgt));
        t = g.getTransform();
      }
      const cw = g.canvas.width;
      const ch = g.canvas.height;
      const edge = 8 * this.k;
      const left = t.a * x + t.e;
      const right = t.a * (x + wdt) + t.e;
      const up = t.d * y + t.f;
      const low = t.d * (y + hgt + 3) + t.f;
      const inX = right - left > cw - edge * 2 ? 0 : left < edge ? edge - left : right > cw - edge ? cw - edge - right : 0;
      const inY = up < 44 * this.k ? 44 * this.k - up : low > ch - 76 * this.k ? ch - 76 * this.k - low : 0;
      if (inX || inY) g.setTransform(t.a, t.b, t.c, t.d, t.e + inX, t.f + inY);
      g.globalAlpha = fade * 0.92;
      g.fillStyle = 'rgba(27,20,40,0.88)';
      g.beginPath();
      g.roundRect(x, y, wdt, hgt, 3);
      g.fill();
      if (!inY) {
        g.beginPath();
        g.moveTo(who.x - 2, y + hgt);
        g.lineTo(who.x, y + hgt + 3);
        g.lineTo(who.x + 2, y + hgt);
        g.fill();
      }
      g.globalAlpha = fade;
      g.fillStyle = '#f8f2e4';
      shown.forEach((l, i) => g.fillText(l, x + 3, y + 2.5 + i * 6.5));
    }
    g.restore();
  }

  /* -------------------------------------------------------------- light */

  /* ----------------------------------------------------------- overlays */

  /**
   * The roads out of a land: a gateway of light standing across the whole way out, in the color of the land it leads
   * to. A bright pool on the ground fills the road from side to side; over it a veil of light rises, made of pillars
   * that breathe and drift one after another, with motes going up through it and a crown of sparks along its top, so a
   * way on reads from afar as the door to somewhere else, not a patch on the road.
   */
  private drawWayBlooms(w: World, time: number): void {
    const g = this.g;
    const groups: { to: string; pts: { x: number; y: number }[] }[] = [];
    for (const x of w.exits) {
      if (x.door) continue;
      const near = groups.find((o) => o.to === x.to && o.pts.some((p) => Math.abs(p.x - x.x) <= TILE * 2.5 && Math.abs(p.y - x.y) <= TILE * 2.5));
      if (near) near.pts.push({ x: x.x, y: x.y });
      else groups.push({ to: x.to, pts: [{ x: x.x, y: x.y }] });
    }
    for (const o of groups) {
      const col = wayColor(REGIONS[o.to as RegionId]?.theme);
      let x0 = Infinity;
      let x1 = -Infinity;
      let y0 = Infinity;
      let y1 = -Infinity;
      for (const p of o.pts) {
        x0 = Math.min(x0, p.x);
        x1 = Math.max(x1, p.x);
        y0 = Math.min(y0, p.y);
        y1 = Math.max(y1, p.y);
      }
      // (it spans the way out, and a little past each side of it, so no edge of the road is left out of the light)
      const across = x1 - x0 >= y1 - y0;
      const pad = TILE * 0.95;
      const ax0 = across ? x0 - pad : (x0 + x1) / 2;
      const ax1 = across ? x1 + pad : (x0 + x1) / 2;
      const ay0 = across ? (y0 + y1) / 2 : y0 - pad;
      const ay1 = across ? (y0 + y1) / 2 : y1 + pad;
      const cx = (ax0 + ax1) / 2;
      const cy = (ay0 + ay1) / 2;
      const span = Math.max(ax1 - ax0, ay1 - ay0);
      const breathe = 0.5 + Math.sin(time * 1.6 + cx * 0.03) * 0.5;

      // the pool on the ground, filling the road from side to side
      this.flat(cx, cy);
      g.save();
      g.globalCompositeOperation = 'lighter';
      const rx = (across ? span / 2 : TILE * 1.3) + 14;
      const ry = (across ? TILE * 1.3 : span / 2) + 14;
      g.translate(cx, cy);
      g.scale(rx / ry, 1);
      const pool = g.createRadialGradient(0, 0, 0, 0, 0, ry);
      pool.addColorStop(0, rgba('#fffbe8', 0.6));
      pool.addColorStop(0.35, rgba(col, 0.6 + breathe * 0.15));
      pool.addColorStop(0.75, rgba(col, 0.22));
      pool.addColorStop(1, rgba(col, 0));
      g.fillStyle = pool;
      g.beginPath();
      g.arc(0, 0, ry, 0, Math.PI * 2);
      g.fill();
      g.restore();
      // a ring of runes turning slowly on the ground at its heart
      this.flat(cx, cy);
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = rgba('#fff6d8', 0.35 + breathe * 0.2);
      g.lineWidth = 1.1;
      g.setLineDash([5, 4]);
      g.lineDashOffset = -time * 8;
      g.beginPath();
      g.ellipse(cx, cy, rx * 0.62, ry * 0.62, 0, 0, Math.PI * 2);
      g.stroke();
      g.setLineDash([]);
      g.restore();

      // the veil: pillars of light standing all across the way out
      const n = Math.max(6, Math.round(span / 7));
      const tall = 96;
      for (let i = 0; i < n; i++) {
        const u = n === 1 ? 0.5 : i / (n - 1);
        const px = ax0 + (ax1 - ax0) * u;
        const py = ay0 + (ay1 - ay0) * u;
        // (brightest in the middle, softer to the sides; each pillar breathes on its own beat, and a wave runs across)
        const edge = Math.sin(u * Math.PI);
        const wave = 0.5 + Math.sin(time * 2.4 - u * 7 + cx * 0.01) * 0.5;
        const h = tall * (0.55 + edge * 0.45) * (0.85 + wave * 0.25);
        const a = (0.11 + edge * 0.16) * (0.7 + wave * 0.5);
        this.upright(px, py);
        g.save();
        g.globalCompositeOperation = 'lighter';
        const foot = py + 10;
        const beam = g.createLinearGradient(px, foot, px, py - h);
        // (the foot fades into the pool rather than ending in a bright bar)
        beam.addColorStop(0, rgba(col, 0));
        beam.addColorStop(0.12, rgba('#fffbe8', a * 1.3));
        beam.addColorStop(0.3, rgba(col, a * 1.2));
        beam.addColorStop(0.7, rgba(col, a * 0.5));
        beam.addColorStop(1, rgba(col, 0));
        g.fillStyle = beam;
        const bw = 7 + edge * 3;
        g.beginPath();
        g.moveTo(px - bw, foot);
        g.quadraticCurveTo(px - bw * 0.7, py - h * 0.6, px, py - h);
        g.quadraticCurveTo(px + bw * 0.7, py - h * 0.6, px + bw, foot);
        g.closePath();
        g.fill();
        g.restore();
      }

      // a great soft glow behind it all, and motes rising through, and sparks along the top
      this.upright(cx, cy);
      g.save();
      g.globalCompositeOperation = 'lighter';
      const half = (across ? span : TILE * 2) / 2 + 18;
      const glow = g.createRadialGradient(cx, cy - tall * 0.42, 0, cx, cy - tall * 0.42, Math.max(half, tall * 0.7));
      glow.addColorStop(0, rgba('#fff6d8', 0.32 + breathe * 0.12));
      glow.addColorStop(0.4, rgba(col, 0.24));
      glow.addColorStop(1, rgba(col, 0));
      g.fillStyle = glow;
      g.beginPath();
      g.ellipse(cx, cy - tall * 0.42, half, tall * 0.72, 0, 0, Math.PI * 2);
      g.fill();
      const motes = Math.max(14, Math.round(span / 4));
      for (let i = 0; i < motes; i++) {
        const t = (time * (0.22 + (i % 5) * 0.04) + i * 0.137) % 1;
        const u = ((i * 0.618) % 1) - 0.5;
        const mx = (across ? cx + u * (half * 1.7) : cx + u * 24) + Math.sin(time * 1.3 + i) * 3;
        const my = cy - 4 - t * tall * 1.05;
        const sz = 0.8 + ((i * 7) % 5) * 0.3;
        g.fillStyle = rgba(i % 3 ? '#fffbe8' : col, Math.sin(t * Math.PI) * 0.95);
        g.beginPath();
        g.arc(mx, my, sz, 0, Math.PI * 2);
        g.fill();
      }
      for (let i = 0; i < 5; i++) {
        const t = (time * 0.5 + i / 5) % 1;
        const sx = cx + (((i * 0.37) % 1) - 0.5) * half * 1.4;
        const sy = cy - tall * (0.82 + Math.sin(time + i) * 0.06);
        const k = Math.sin(t * Math.PI);
        g.strokeStyle = rgba('#ffffff', k * 0.85);
        g.lineWidth = 0.9;
        g.beginPath();
        g.moveTo(sx - 3 * k, sy);
        g.lineTo(sx + 3 * k, sy);
        g.moveTo(sx, sy - 3 * k);
        g.lineTo(sx, sy + 3 * k);
        g.stroke();
      }
      g.restore();
    }
  }

  /**
   * The ways into buildings, and back out: a warm pool of light on the step and a gold chevron pointing through
   * the door (in, under a painted door; out, at a room's door), so a door you can use never looks like one
   * you can't. Walking onto it goes through. A dungeon's way back out to the land gets the same, on its gap in the wall.
   */
  private drawEntrances(w: World, time: number): void {
    const g = this.g;
    const dungeon = w.region.kind === 'dungeon';
    const inside = !!w.region.interior || dungeon;
    const seen = new Set<string>();
    if (!inside) this.drawWayBlooms(w, time);
    for (const x0 of w.exits) {
      if (!x0.door && !dungeon) continue;
      // (a way out two tiles wide is one way out: the chevrons go in the middle of it)
      let x = x0;
      if (!x0.door) {
        if (seen.has(x0.to)) continue;
        seen.add(x0.to);
        const twin = w.exits.find((o) => o !== x0 && o.to === x0.to && o.y === x0.y && Math.abs(o.x - x0.x) <= TILE);
        if (twin) x = { ...x0, x: (x0.x + twin.x) / 2 };
      }
      const pulse = 0.5 + Math.sin(time * 3 + x.x * 0.1) * 0.5;
      // the step: on the tile in front of a painted door, on the door tile itself indoors
      const cy = inside ? x.y : x.y - 4;
      // (laid flat where it lies: the view tilts differently here than round the hero, and it would slide as they walk)
      this.flat(x.x, cy);
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
import { REGIONS } from '../data/regions';
import type { RegionId, Theme } from '../data/types';

/** The bloom on a road out, in the color that suits the land it leads to (gold where nothing says otherwise). */
const WAY_COLORS: Partial<Record<Theme, string>> = {
  village: '#ffd66a', forest: '#9cff7a', farm: '#ffe27a', coast: '#7ae8ff', autumn: '#ffa64a', marsh: '#b8e070', plague: '#c8f070',
  plains: '#ffe08a', mountain: '#d8e4ff', barrow: '#c8b8ff', storm: '#8ab8ff', moor: '#d0a0ff', desert: '#ffc860', fey: '#ff9af0',
  snow: '#bfe8ff', rift: '#b88aff', jungle: '#7affa0', warfront: '#ff8a5a', blight: '#c0ff6a', haunted: '#a0d8ff', volcanic: '#ff7a3a',
  deadlake: '#9ad0d0', peaks: '#e0ecff', sunken: '#6ae0d8', bonefield: '#f0e6c8', gloam: '#d08aff',
};
const wayColor = (t: Theme | undefined): string => (t && WAY_COLORS[t]) || '#ffd66a';

