import { drawReach, drawReticle } from './reticle';
import { clamp, damp, TAU } from '../core/math';
import { zoneLight } from './zoneLight';
import { currentObjective } from '../progress/character';
import { drawMapIcon, type MapIcon } from '../ui/mapIcons';
import { isMainQuest, turnInNpc } from '../progress/handin';
import { edgeArrowAngle, LEAD, leanTarget, LIFT } from './camera';
import { layoutSpeechClear, type ViewBox } from './speech';
import { ghostName, TALK_ZOOM, TYPE_CPS } from '../sim/scene';
import { Effects, headOf, inView } from './effects';
import { THEMES } from '../data/themes';
import { ROOM, type RoomLight } from './rooms';

/** The light of the place the hero is in, where it's under a roof: a deep place, or a house in a town. */
const roomOf = (w: World): RoomLight | null => (w.region.dark ? (ROOM[w.region.theme] ?? ROOM.default!) : w.region.interior ? (ROOM[w.region.theme] ?? null) : null);
import type { ClassId } from '../data/types';
import { TILE } from '../sim/map';
import type { Enemy, NpcActor, Pet } from '../sim/types';
import type { World } from '../sim/world';
import { ctx2d, rgba } from './pixel';
import { heldWeapon, itemIconCanvas, heroLook, vendorSign } from './sprites';
import type { HeroLook } from './art/hero';
import { wornLooks } from '../progress/wardrobe';
import { objectiveTarget } from '../sim/objective';
import { ZOOM_MAX, ZOOM_MIN } from '../progress/save';
import { autoTarget, seekReach, tapAutoAims } from '../sim/cast';
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

/** A plate's colors: its bar from top to bottom, the trough behind it, and the frame's bright edge. */
interface Plate {
  top: string;
  mid: string;
  low: string;
  back: string;
  rim: string;
}
const PLATE: Record<'foe' | 'elite' | 'named' | 'hero' | 'heroLow' | 'mana' | 'rage' | 'energy' | 'focus' | 'holy', Plate> = {
  foe: { top: '#ff8a7a', mid: '#e23a44', low: '#8f1626', back: '#3a0e16', rim: 'rgba(255,150,150,0.55)' },
  elite: { top: '#fff0a8', mid: '#f2b632', low: '#a86a10', back: '#3a2a0c', rim: 'rgba(255,224,130,0.85)' },
  named: { top: '#f0d8ff', mid: '#b878f0', low: '#6a2fa8', back: '#2a1040', rim: 'rgba(224,180,255,0.85)' },
  hero: { top: '#b8ffa0', mid: '#4fd060', low: '#1f7a36', back: '#0e2a16', rim: 'rgba(200,255,190,0.8)' },
  heroLow: { top: '#ffc0a0', mid: '#ff5a3a', low: '#a81e1e', back: '#3a0e0e', rim: 'rgba(255,170,150,0.9)' },
  mana: { top: '#a8dcff', mid: '#3a8fe8', low: '#1c4aa0', back: '#0c1a36', rim: '' },
  rage: { top: '#ffa890', mid: '#e0403a', low: '#8a1c1c', back: '#300c0c', rim: '' },
  energy: { top: '#fff0a8', mid: '#e8b04a', low: '#9a6a18', back: '#2e220a', rim: '' },
  focus: { top: '#b8ffd8', mid: '#3ac890', low: '#167a56', back: '#0a2a1e', rim: '' },
  holy: { top: '#fff6c8', mid: '#ffd84d', low: '#b88a18', back: '#2e260a', rim: '' },
};

/** Aim preview the touch controls ask for while a skill button is dragged. */
export interface AimPreview {
  shape: 'line' | 'circle' | 'cone' | 'ring';
  angle: number;
  /** Line length / circle distance from the hero. */
  dist: number;
  /** Line width / circle radius / cone reach. */
  size: number;
  cancel: boolean;
  /** The spell's own color (its kind of harm), for the mark. */
  color?: string;
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
  /**
   * Where pieces of the HUD sit over the picture, in the view's CSS pixels (ui/hudBoxes.ts keeps them): `quest` is
   * the quest under the hero's bars, `call` a boss's call, `map` the minimap, `thumbs` and `potion` a phone's skills.
   * The picture's own words know what they would cover.
   */
  readonly hudBoxes = new Map<string, ViewBox>();
  /** The spoken lines drawn this frame, as boxes: the HUD steps out from under them (the quest fades while one is across it). */
  readonly speechBoxes: ViewBox[] = [];
  aim: AimPreview | null = null;
  /** Touch controls: show the facing marker (where a tapped spell goes). */
  touchMode = false;
  /** The enemy a tapped skill would turn at, picked again every 0.1 s (not every frame). */
  private tapPick: { at: number; e: Enemy | null } = { at: -1, e: null };
  /** The hero's held weapon changes with gear. */
  private weapon: { kind: string; tint?: string } = { kind: 'staff' };
  reducedMotion = false;
  /** How big what is written and barred over the picture is drawn (render/camera.ts hudScale): names, health plates. */
  hud = 1;
  /** Plates over heads (Settings): the hero's health and resource, and every foe's health. */
  plates = true;
  private cssW = 1;
  private cssH = 1;
  /** Canvas pixels per CSS pixel of this top canvas. */
  private k = 1;

  constructor(target: HTMLCanvasElement) {
    this.canvas = target;
    this.g = ctx2d(target);
  }

  /**
   * Fits the view to the element: about 216 world pixels tall on phones (bigger figures) and 300 on
   * desktops (240 and 196 until 1.0: the owner asked for the camera 10 to 15% further out on a desk, then 5% more on both, twice), never less than 150 across the short side.
   */
  /** The view's size in CSS pixels (what the HUD is laid out in). */
  get viewW(): number {
    return this.cssW;
  }
  get viewH(): number {
    return this.cssH;
  }

  /**
   * How far back the camera stands, as the player set it (Settings: Camera distance): 1 is the game's own view, more
   * is further out. What the land keeps standing follows it (render3d/land.ts viewBox goes by the picture's reach).
   */
  private zoom = 1;
  private sized: [number, number, number, boolean] | null = null;
  setZoom(zoom: number): void {
    const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));
    if (z === this.zoom) return;
    this.zoom = z;
    if (this.sized) this.resize(...this.sized);
  }

  resize(cssW: number, cssH: number, dpr: number, touch: boolean): void {
    this.sized = [cssW, cssH, dpr, touch];
    // (the picture's reach over the ground is measured again at its new size)
    this.reach = null;
    const devW = Math.max(1, Math.round(cssW * dpr));
    const devH = Math.max(1, Math.round(cssH * dpr));
    const landscape = devW >= devH;
    let total = (landscape ? devH : devW * 1.25) / ((touch ? 216 : 300) * this.zoom);
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
    // The picture is held inside the land. It is not a rectangle of ground `vw` by `vh` but a wedge, reaching further
    // up the land than down it and wider at its top (the camera looks along the land with a lens), and holding only
    // the rectangle in let the top of the picture and its corners run well past the map's edge, onto the bare pale
    // ground beyond it (the owner, at a town's south gate: "check the pale green ground, this is ugly ... edges of
    // the map shouldn't be visible"). So it is held by what it really shows (`reach`, measured from the picture
    // itself each frame), and the hero walks on toward the edge of the screen from there.
    const cx = w.player.x + this.leanX + shift;
    const cy = w.player.y + this.leanY;
    // near a way out at an edge the view may still go a little past it, so the hero at a gate isn't standing under
    // the HUD: easing in as the hero nears it, so the camera never jumps
    const peek = this.edgePeek(w);
    const r = this.reach ?? { far: this.vh / 2, near: this.vh / 2 };
    const held = (c: number, lo: number, hi: number, size: number): number => (lo > hi ? size / 2 : clamp(c, lo, hi));
    // (to the sides it is held by its width where the hero stands, not at its top where it is widest: held by its
    // top, a hero at the land's west edge was off the side of the screen. So at a side edge the top corners of the
    // picture still show a few tiles of what is beyond; never the top or the bottom)
    this.camX = held(cx, this.vw / 2 - peek.l, mapW - this.vw / 2 + peek.r, mapW) - this.vw / 2;
    this.camY = held(cy, r.far - peek.t, mapH - r.near + peek.b, mapH) - this.vh / 2;
  }

  /**
   * How far the picture reaches over the ground from the spot the camera looks at, in world pixels: up the land
   * (`far`) and down it (`near`). Null until the 3D view has drawn once (the flat view's own reach is its rectangle).
   */
  private reach: { far: number; near: number } | null = null;
  private measureReach(st: Stage, cy: number): void {
    const top = st.unproject(0, 0);
    const bottom = st.unproject(this.cssW, this.cssH);
    const far = cy - top.y;
    const near = bottom.y - cy;
    // (a camera placed by hand, or one drawn right in on a face, shows less: never more than the open view's)
    if (Number.isFinite(far) && Number.isFinite(near) && far > 0 && near > 0) this.reach = { far, near };
  }

  /** How far past each edge the view may go: up to a few tiles, the nearer the hero is to a way out at that edge. */
  private edgePeek(w: World): { l: number; r: number; t: number; b: number } {
    const out = { l: 0, r: 0, t: 0, b: 0 };
    if (w.region.interior || w.region.kind === 'dungeon') return out;
    const mapW = w.map.w * TILE;
    const mapH = w.map.h * TILE;
    const near = TILE * 12;
    // (two tiles, where it was four: what lies past an edge is dressed for a glimpse, not for a view)
    const most = TILE * 2;
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
    size *= this.hud;
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
    wide *= this.hud;
    const h = 5 * this.hud;
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
    // a scene's camera draws in on whoever is speaking (or stands as near as a step says), and eases back out after
    if (st) {
      const speaking = !!w.scene && w.story.speech.some((sp) => sp.staged);
      const push = this.landOnly ? 1 : (w.scene?.zoom ?? (speaking ? TALK_ZOOM : 1));
      st.push = this.reducedMotion ? push : damp(st.push, push, 2.2, dt);
    }
    this.placeCamera(w);
    const shake = this.reducedMotion ? 0 : w.shakeAmt;
    this.shakeX = shake ? (Math.random() - 0.5) * shake : 0;
    this.shakeY = shake ? (Math.random() - 0.5) * shake : 0;
    const cx = this.camX + this.vw / 2 + this.shakeX;
    const cy = this.camY + this.vh / 2 + this.shakeY;

    if (st?.ready) {
      st.look(cx / TILE, cy / TILE);
      // (measured with the camera drawn back as far as it goes: a scene's close-up mustn't loosen the hold)
      if (st.push >= 0.999) this.measureReach(st, cy);
      LIGHT.uTime.value = time;
      this.setMood(w, st, dt);
      st.heroAt(p.x, p.y);
      st.land?.update(cx / TILE, cy / TILE, st.spanX, st.spanZ);
      st.land?.lightFlames(cx / TILE, cy / TILE, time, this.burning(w));
      st.land?.updateDoors(dt);
      st.land?.updateColumns(dt, p.x / TILE, p.y / TILE);
      this.folkK = damp(this.folkK, w.story.fighting ? 0 : 1, 3, dt);
      st.cast.begin();
      this.people.sync(st.cast, w, dt, time, { look: this.look ?? heroLook(w.hero.cls), weapon: this.weapon, folk: this.folkK, statues: st.land?.statues, colossi: st.land?.colossi, landOnly: this.landOnly, view: { x: cx / TILE, z: cy / TILE, spanX: st.spanX, spanZ: st.spanZ } });
      this.layer?.cast?.(st.cast, dt, time);
      st.fx.begin();
      this.effects.draw(w, { fx: st.fx, cast: st.cast, land: st.land, time, near: (x, y, reach = 0) => inView(cx, cy, this.vw, this.vh, x, y, reach) });
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
    g.setTransform(this.k, 0, 0, this.k, 0, 0);
    this.vignette(g, w);
    g.setTransform(1, 0, 0, 1, 0, 0);

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
      this.drawHeroPlate(w, st);
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
      // what a quest asks for, lying on the ground: its name over it
      for (const d of w.drops) {
        if (d.kind !== 'quest' || !d.label || !near(d.x, d.y)) continue;
        const s = st.project(d.x, d.y, 16 + d.z);
        this.label(d.label, s.x, s.y - 6, 10, '#ffe066');
      }
    }
    if (st) {
      // (a boss's call is said over the top of the picture, in the HUD: a caption that would rise under it, "The
      // coffin closes: out the open side!" with the hero at the top of a room, is kept just below it. Numbers are
      // left where they land)
      const call = ui ? this.hudBoxes.get('call') : undefined;
      for (const t of w.texts) {
        const a = clamp(1.6 - t.t / (t.big ? 0.75 : 0.55), 0, 1);
        const s = st.project(t.x, t.y, 18);
        const pop = t.big && t.t < 0.12 ? 1.7 : 1;
        const size = (t.big ? 17 : 13) * pop;
        let y = s.y;
        if (call && t.text.length > 8 && /[a-z]{3}/i.test(t.text)) {
          g.font = `800 ${size}px "Bricolage Grotesque Variable", system-ui, sans-serif`;
          const half = g.measureText(t.text).width / 2;
          const tall = size * 0.75;
          if (s.x + half > call.x && s.x - half < call.x + call.w && y + tall > call.y && y - tall < call.y + call.h) y = call.y + call.h + tall + 2;
        }
        this.label(t.text, s.x, y, size, t.color, a);
      }
    }
    this.upright(p.x, p.y);
    this.drawSpeech(w, time);
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

  /** The dim edge of a deep place: drawn under the names and bars, over the world. */
  private vignette(g: CanvasRenderingContext2D, w: World): void {
    const room = roomOf(w);
    if (!room) return;
    const W = this.cssW;
    const H = this.cssH;
    const grd = g.createRadialGradient(W / 2, H * 0.52, Math.min(W, H) * 0.42, W / 2, H * 0.52, Math.hypot(W, H) * 0.62);
    grd.addColorStop(0, `rgba(${room.edge},0)`);
    const k = room.edgeK ?? 1;
    grd.addColorStop(0.6, `rgba(${room.edge},${0.22 * k})`);
    grd.addColorStop(1, `rgba(${room.edge},${0.62 * k})`);
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);
  }

  private setMood(w: World, st: Stage, dt: number): void {
    const look = THEMES[w.region.theme];
    const grade = LIGHT.uGrade.value;
    const dark = LIGHT.uDark.value;
    const night = LIGHT.uNight.value;
    const dread = look.dread;
    grade.set(0, 0, 0, 0);
    dark.set(0, 8, 0, 0);
    // a deep place has its own dim light, which its fires push back in their own color (render3d/toon.ts roomLight)
    const room = roomOf(w);
    if (room) {
      LIGHT.uAmb.value.set(room.amb[0], room.amb[1], room.amb[2], 1);
      LIGHT.uFlameCol.value.set(room.fire[0], room.fire[1], room.fire[2]);
      LIGHT.uRim.value.set(room.rim[0], room.rim[1], room.rim[2]);
    } else {
      LIGHT.uAmb.value.set(1, 1, 1, 0);
      LIGHT.uRim.value.set(0.5, 0.47, 0.4);
    }
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

  /**
   * A plate over someone's head: their health in a framed bar, as the nameplates of the great online worlds are (the
   * owner: "add the health bar and the mana on top of the character like wow, and also u can add the hp bars of all
   * enemies even if they arent hit, make it stylish"). A dark frame with a thin bright edge, the bar itself shaded
   * from light to deep with a line of gloss along its top, notches at each quarter, and behind the health a pale
   * trail that drains a moment after a blow, so a hit is seen as well as counted. `under`: a second, thinner bar
   * (the hero's mana, rage, energy). `id`: whose trail this is.
   */
  private plate(id: number, x: number, y: number, wide: number, high: number, k: number, tone: Plate, o: { shield?: number; under?: { k: number; tone: Plate }; alpha?: number } = {}): void {
    const g = this.g;
    g.setTransform(this.k, 0, 0, this.k, 0, 0);
    wide *= this.hud;
    high *= this.hud;
    const kk = clamp(k, 0, 1);
    // the trail: it follows the health down, never up
    const was = this.plateTrail.get(id) ?? kk;
    const trail = kk >= was ? kk : Math.max(kk, was - Math.max(0.006, (was - kk) * 0.07));
    if (this.plateTrail.size > 600) this.plateTrail.clear();
    this.plateTrail.set(id, trail);
    const uh = o.under ? Math.max(2.5, high * 0.5) : 0;
    const x0 = x - wide / 2;
    const y0 = y - high / 2;
    const whole = high + (o.under ? uh + 1 : 0);
    g.globalAlpha = o.alpha ?? 1;
    // the frame: a dark body, a bright rim
    g.fillStyle = 'rgba(12,8,20,0.92)';
    g.beginPath();
    g.roundRect(x0 - 2, y0 - 2, wide + 4, whole + 4, 3.5);
    g.fill();
    g.strokeStyle = tone.rim;
    g.lineWidth = 1;
    g.beginPath();
    g.roundRect(x0 - 1.5, y0 - 1.5, wide + 3, whole + 3, 3);
    g.stroke();
    const fill = (fy: number, fh: number, share: number, t: Plate, lag: number): void => {
      g.fillStyle = t.back;
      g.fillRect(x0, fy, wide, fh);
      if (lag > share) {
        g.fillStyle = 'rgba(255,236,190,0.85)';
        g.fillRect(x0, fy, wide * lag, fh);
      }
      if (share > 0) {
        const grad = g.createLinearGradient(0, fy, 0, fy + fh);
        grad.addColorStop(0, t.top);
        grad.addColorStop(0.55, t.mid);
        grad.addColorStop(1, t.low);
        g.fillStyle = grad;
        g.fillRect(x0, fy, Math.max(1, wide * share), fh);
        // a line of gloss along the top
        g.fillStyle = 'rgba(255,255,255,0.28)';
        g.fillRect(x0, fy, Math.max(1, wide * share), Math.max(0.8, fh * 0.22));
      }
    };
    fill(y0, high, kk, tone, trail);
    // a notch at each quarter
    g.fillStyle = 'rgba(8,4,14,0.55)';
    for (let q = 1; q < 4; q++) g.fillRect(x0 + (wide * q) / 4 - 0.4, y0, 0.8, high);
    if (o.shield && o.shield > 0) {
      g.fillStyle = '#9fe4ff';
      g.fillRect(x0, y0 - 1.6, wide * clamp(o.shield, 0, 1), 1.6);
    }
    if (o.under) fill(y0 + high + 1, uh, clamp(o.under.k, 0, 1), o.under.tone, 0);
    g.globalAlpha = 1;
  }
  private plateTrail = new Map<number, number>();

  /** Every foe carries a plate, struck or not: fainter on one that hasn't been touched and isn't after the hero. */
  private drawEnemyBar(e: Enemy, st: Stage): void {
    if (e.dead || e.boss || e.dummy || e.state === 'spawn') {
      if (e.dead) this.plateTrail.delete(e.id);
      return;
    }
    const named = !!e.def.named;
    const elite = e.elite.length > 0;
    // (what a boss fight stands up, a coffin, a candle, a cage, is a thing: it shows its health once it is struck,
    // not a row of full bars over the furniture)
    const thing = !!e.def.prop;
    // (a little above the head: on a boar's or a ram's back the bar lay across the animal)
    const s = st.project(e.x, e.y, headOf(e) + (this.plates ? 5 : 0));
    if (!this.plates || (thing && e.hp >= e.maxHp && e.shield <= 0)) {
      // (the plain bars, as before: only on one that is hurt, or is somebody)
      if (e.hp >= e.maxHp && !elite && !named && e.shield <= 0) return;
      this.bar(s.x, s.y, elite || named ? 46 : 30, e.hp / e.maxHp, named ? '#d8b0ff' : elite ? '#ffcf5a' : '#ff4a5a', e.shield > 0 ? e.shield / (e.maxHp * 0.4) : 0);
    } else {
      const quiet = e.hp >= e.maxHp && !e.aggro && !elite && !named;
      this.plate(e.id, s.x, s.y, elite || named ? 48 : 32, elite || named ? 5.5 : 4.5, e.hp / e.maxHp, named ? PLATE.named : elite ? PLATE.elite : PLATE.foe, { shield: e.shield > 0 ? e.shield / (e.maxHp * 0.4) : 0, alpha: quiet ? 0.6 : 1 });
    }
    if (named) this.label(`${e.name} ${e.level}`, s.x, s.y - 11 * this.hud, 11, '#e8d0ff');
    else if (elite) this.label(e.name.split(' ')[0]!, s.x, s.y - 11 * this.hud, 11, '#ffd36b');
  }

  /** The hero's own plate: health, and under it what they spend (mana, rage, energy, focus, zeal). */
  private drawHeroPlate(w: World, st: Stage): void {
    const p = w.player;
    if (!this.plates || p.dead) return;
    const s = st.project(p.x, p.y, PERSON_H + (p.riding ? 22 : 6));
    const res = w.build.resource;
    const low = p.hp < p.maxHp * 0.3;
    this.plate(-1, s.x, s.y, 40, 5.5, p.hp / p.maxHp, low ? PLATE.heroLow : PLATE.hero, { shield: p.shield > 0 ? p.shield / p.maxHp : 0, ...(res && p.maxMana > 0 ? { under: { k: p.mana / p.maxMana, tone: PLATE[res.kind] } } : {}) });
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
    if (s.front !== false && s.x > m && s.x < W - m && s.y > m && s.y < H - m) {
      this.label('▼', s.x, s.y + Math.sin(time * 5) * 3, 15, '#ffe066');
      return;
    }
    // (over the ground from the hero, not from where the place falls on the screen: render/camera.ts)
    const a = edgeArrowAngle(w.player.x, w.player.y, target.x, target.y);
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

  /** The touch aim preview: where the dragged skill will go (a placed spell's mark is render/reticle.ts). */
  private drawAim(w: World): void {
    const a = this.aim;
    const p = w.player;
    if (!a || p.dead) return;
    const g = this.g;
    const time = this.reducedMotion ? 0 : performance.now() / 1000;
    const color = a.cancel ? '#ff5a5a' : (a.color ?? '#ffd84d');
    g.save();
    if (a.shape === 'circle') {
      const x = p.x + Math.cos(a.angle) * a.dist;
      const y = p.y + Math.sin(a.angle) * a.dist;
      drawReach(g, p.x, p.y, x - Math.cos(a.angle) * a.size, y - Math.sin(a.angle) * a.size, color, time, a.cancel);
      // (laid on the ground where it will land: the ground's slant there, not at the hero)
      this.flat(x, y);
      drawReticle(g, x, y, a.size, color, time, a.cancel);
      this.flat(p.x, p.y);
    } else if (a.shape === 'ring') {
      drawReticle(g, p.x, p.y, a.size, color, time, a.cancel);
    } else {
      // a shot's lane, a swing's fan: the spell's color, its edge drawn dark and bright so it reads on any ground
      g.globalAlpha = 0.3;
      g.fillStyle = color;
      g.beginPath();
      if (a.shape === 'line') {
        g.translate(p.x, p.y);
        g.rotate(a.angle);
        g.rect(6, -a.size / 2, a.dist, a.size);
      } else {
        g.moveTo(p.x, p.y);
        g.arc(p.x, p.y, a.size, a.angle - a.dist / 2, a.angle + a.dist / 2);
        g.closePath();
      }
      g.fill();
      g.globalAlpha = 1;
      g.lineWidth = 2.4;
      g.strokeStyle = 'rgba(14,8,22,0.6)';
      g.stroke();
      g.lineWidth = 1.2;
      g.strokeStyle = color;
      g.stroke();
      if (a.shape === 'line') {
        // its head: a bright arrow at the far end
        g.fillStyle = '#ffffff';
        g.beginPath();
        g.moveTo(a.dist + 12, 0);
        g.lineTo(a.dist + 4, -Math.max(3, a.size * 0.7));
        g.lineTo(a.dist + 4, Math.max(3, a.size * 0.7));
        g.closePath();
        g.fill();
        g.stroke();
      }
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
        if (spec && ready && tapAutoAims(spec)) reach = Math.max(reach, seekReach(spec));
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

  /**
   * Lines over people's heads: a scene's (written out under the speaker's name, with a mark once the next can be
   * taken), a companion's shout in a fight, a villager crying out. Laid out on the screen, not in the world: the same
   * size near or far and however close the camera stands, every word of it shown, and all of it on the screen clear
   * of the bars along its edges (render/speech.ts).
   */
  private drawSpeech(w: World, time: number): void {
    this.drawEmotes(w);
    this.speechBoxes.length = 0;
    const speech = w.story.speech;
    if (!speech.length) return;
    const g = this.g;
    const st = this.stage;
    g.save();
    g.setTransform(this.k, 0, 0, this.k, 0, 0);
    g.imageSmoothingEnabled = true;
    g.textBaseline = 'alphabetic';
    g.textAlign = 'left';
    const FONT = '"Bricolage Grotesque Variable", system-ui, sans-serif';
    const measure = (text: string, px: number, weight: number): number => {
      g.font = `${weight} ${px}px ${FONT}`;
      return g.measureText(text).width;
    };
    // (a scene's bars are 9% of the picture each; otherwise the HUD's rows, and on a phone its stick and its skills:
    // a shout is kept to the open middle, not under the buttons)
    const hud = !w.scene && !this.landOnly;
    const top = w.scene ? this.cssH * 0.09 + 4 : this.touchMode ? 62 : 44;
    const bottom = w.scene ? this.cssH * 0.09 + 4 : 76;
    const sideL = hud && this.touchMode ? this.cssW * 0.26 : 8;
    const sideR = hud && this.touchMode ? this.cssW * 0.39 : 8;
    for (const s of speech) {
      const npc = w.npcs.find((n) => n.id === s.who);
      const pet = w.pets.find((p) => !p.dead && p.def.id === s.who);
      const foe = w.enemies.find((e) => !e.dead && e.def.id === s.who);
      const who = s.who === 'hero' ? w.player : (pet ?? npc ?? foe);
      if (!who) continue;
      const name = s.who === 'hero' ? w.hero.name : pet ? pet.def.name : npc ? (npc.ghost ? ghostName(npc.id) : (NPCS[npc.id]?.name ?? '')) : (foe?.def.name ?? '');
      const accent = s.who === 'hero' ? '#9fd8ff' : foe && !pet && !npc ? '#ff9a8a' : '#ffcf5a';
      // where their head is on the screen; someone out of the picture (or behind the camera) can still shout: their
      // words are kept at the edge nearest them
      const head = st ? st.project(who.x, who.y, PERSON_H + 9) : { x: ((who.x - this.camX) / this.vw) * this.cssW, y: ((who.y - PERSON_H - 9 - this.camY) / this.vh) * this.cssH };
      const behind = who.y > this.camY + this.vh * 1.5;
      const sane = Number.isFinite(head.x) && Number.isFinite(head.y);
      const said = { text: s.text, name, headX: sane && !behind ? head.x : this.cssW / 2, headY: behind ? this.cssH * 2 : sane ? head.y : -this.cssH, viewW: this.cssW, viewH: this.cssH, top, bottom, measure };
      // (on a phone the quest under the hero's bars reaches into the open middle: a line that would be written across
      // it goes beside it when it fits there, render/speech.ts; where it doesn't, the HUD lets the quest fade)
      const card = layoutSpeechClear({ ...said, left: sideL, right: sideR }, hud ? this.hudBoxes : null);
      if (hud) this.speechBoxes.push({ x: card.x, y: card.y, w: card.w, h: card.h });
      const fade = clamp(Math.min(s.t / 0.15, (s.dur - s.t) / 0.3), 0, 1);
      g.globalAlpha = fade * 0.95;
      g.fillStyle = 'rgba(22,16,36,0.93)';
      g.strokeStyle = rgba(accent, 0.5);
      g.lineWidth = 1;
      g.beginPath();
      g.roundRect(card.x, card.y, card.w, card.h, Math.round(card.fs * 0.6));
      g.fill();
      g.stroke();
      if (card.tailX !== null) {
        g.beginPath();
        g.moveTo(card.tailX - 6, card.y + card.h - 0.5);
        g.lineTo(card.tailX, card.y + card.h + 7);
        g.lineTo(card.tailX + 6, card.y + card.h - 0.5);
        g.closePath();
        g.fill();
      }
      g.globalAlpha = fade;
      if (name) {
        g.font = `800 ${card.nameFs}px ${FONT}`;
        g.fillStyle = accent;
        g.fillText(name, card.x + card.padX, card.y + card.padY + card.nameFs * 0.86);
      }
      g.font = `600 ${card.fs}px ${FONT}`;
      g.fillStyle = '#f8f2e4';
      // a scene's line is written out; anyone else's is simply said
      let left = s.staged ? Math.floor(s.t * TYPE_CPS) : Infinity;
      card.lines.forEach((l, i) => {
        if (left <= 0) return;
        g.fillText(left >= l.length ? l : l.slice(0, left), card.x + card.padX, card.textY + i * card.lineH);
        left -= l.length + 1;
      });
      // all of it out: a small mark at its foot says the next line can be taken (a tap, a click, the talk key)
      if (s.staged && s.t * TYPE_CPS >= s.text.length) {
        const mx = card.x + card.w - card.padX * 0.9;
        const my = card.y + card.h - card.padY * 0.75 + (this.reducedMotion ? 0 : Math.sin(time * 5) * 1.5);
        g.fillStyle = accent;
        g.globalAlpha = fade * 0.9;
        g.beginPath();
        g.moveTo(mx - 4, my - 3);
        g.lineTo(mx + 4, my - 3);
        g.lineTo(mx, my + 2.5);
        g.closePath();
        g.fill();
      }
    }
    g.restore();
  }

  /* -------------------------------------------------------------- light */

  /* ----------------------------------------------------------- overlays */

  /**
   * The roads out of a land: motes of the next land's light drifting up across the way out, as dust does in a beam.
   * Nothing else is drawn here (a curtain of light across the road read as a painted panel): the light on the ground
   * and the gate itself say the rest (render/effects.ts wayLights, render3d/gateways.ts).
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
      const col = zoneLight(o.to);
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
      // (it spans the way out, and a little past each side of it)
      const across = x1 - x0 >= y1 - y0;
      const pad = TILE * 0.95;
      const ax0 = across ? x0 - pad : (x0 + x1) / 2;
      const ax1 = across ? x1 + pad : (x0 + x1) / 2;
      const ay0 = across ? (y0 + y1) / 2 : y0 - pad;
      const ay1 = across ? (y0 + y1) / 2 : y1 + pad;
      const cx = (ax0 + ax1) / 2;
      const cy = (ay0 + ay1) / 2;
      const span = Math.max(ax1 - ax0, ay1 - ay0);

      const tall = 70;
      // motes rising through it
      this.upright(cx, cy);
      g.save();
      g.globalCompositeOperation = 'lighter';
      const half = (across ? span : TILE * 2) / 2 + 18;
      const motes = Math.max(10, Math.round(span / 5));
      for (let i = 0; i < motes; i++) {
        const t = (time * (0.2 + (i % 5) * 0.035) + i * 0.137) % 1;
        const u = ((i * 0.618) % 1) - 0.5;
        const mx = (across ? cx + u * (half * 1.7) : cx + u * 24) + Math.sin(time * 1.3 + i) * 3;
        const my = cy - 4 - t * tall * 1.05;
        const sz = 0.8 + ((i * 7) % 5) * 0.3;
        g.fillStyle = rgba(i % 3 ? col : '#fffbe8', Math.sin(t * Math.PI) * 0.7);
        g.beginPath();
        g.arc(mx, my, sz, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
    }
  }

  /** What is drawn on the ground at the ways out of a land (the doors of houses and the ways down have their light in render/effects.ts). */
  private drawEntrances(w: World, time: number): void {
    if (w.region.interior || w.region.kind === 'dungeon') return;
    this.drawWayBlooms(w, time);
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

