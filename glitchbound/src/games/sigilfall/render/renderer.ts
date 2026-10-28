import { clamp, damp, dist, hash2, TAU } from '../core/math';
import { currentObjective } from '../progress/character';
import { drawMapIcon, type MapIcon } from '../ui/mapIcons';
import { isMainQuest, turnInNpc } from '../progress/handin';
import { chestArt, CHEST_H, CHEST_W, coinArt, orbArt, potionArt, shardArt } from './art/loot';
import { LEAD, leanTarget, LIFT, placeCamera } from './camera';
import { drawBolt, drawVfx } from './art/vfx';
import { worldLook } from './art/world';
import { THEMES } from '../data/themes';
import type { ClassId, Item } from '../data/types';
import { bossHidden } from '../sim/boss';
import { hasStatus } from '../sim/combat';
import { K, TILE } from '../sim/map';
import type { Enemy, Fx, Ghost, Pet, Projectile, Telegraph } from '../sim/types';
import type { World } from '../sim/world';
import { itemTint } from '../progress/items';
import { canvas, ctx2d, DETAIL, pixelText, RES, rgba, type Cnv, type Sprite } from './pixel';
import { creatureSprite, glowDisc, heldWeapon, itemIconCanvas, heroLook, heroSprite, mountSprites, npcSprite, recolored, riderLegsSprite, vendorSign, weaponSprite, type HeroDir } from './sprites';
import { HERO_H, HERO_W, type HeroLook } from './art/hero';
import { MOUNT_FRAMES, MOUNT_WALK_FRAMES, RIDER_HIP } from './art/mount';
import { MOUNT_DEFS, type MountDef } from '../data/mounts';
import { wornLooks } from '../progress/wardrobe';
import { SUMMON_TIME } from '../sim/world';
import { buildScenery, type Scenery } from './tiles';
import { objectiveTarget } from '../sim/objective';

/**
 * Draws the world at low resolution (a few hundred pixels across) onto a canvas that CSS scales up
 * with crisp pixels. One frame: ground, ground effects and warnings, everything standing (sorted by
 * depth), projectiles and particles, darkness and lights in the crypt, then numbers and names.
 */

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

/** Where the hero holds the weapon at rest, by facing (0 down, 1 left, 2 right, 3 up): hand offset and lean. */
const REST_POSE: Record<number, { x: number; y: number; lean: number }> = {
  0: { x: 6, y: 1, lean: 0.22 },
  1: { x: -4, y: 1, lean: -0.32 },
  2: { x: 4, y: 1, lean: 0.32 },
  3: { x: -6, y: 0, lean: -0.18 },
};

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

/** Wards drawn as the thing itself (others, like a person at a lock, are drawn as people). */
const WARD_LOOKS = new Set(['door', 'gate', 'stone', 'boat', 'wagon', 'lantern']);

/** Props that light the dark around them (radius in world px). */
const LIGHTS: Record<string, number> = { lamp: 54, campfire: 70, 'iron-torch': 46, lantern: 40 };

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
  /** View size in art pixels. */
  vw = 320;
  vh = 180;
  /** Device pixels per art pixel. */
  scale = 4;
  /** The last frame drawn was of a paused world. */
  private still = false;
  camX = 0;
  camY = 0;
  private scenery: Scenery | null = null;
  private sceneryFor: World | null = null;
  /** The story state the scenery was built for (World.stateVersion). */
  private sceneryVersion = -1;
  private light: Cnv;
  private lg: CanvasRenderingContext2D;
  aim: AimPreview | null = null;
  /** Touch controls: show the facing marker (where a tapped spell goes). */
  touchMode = false;
  /** The hero's held weapon art changes with gear. */
  private weapon: { kind: string; tint?: string } = { kind: 'staff' };
  reducedMotion = false;

  constructor(target: HTMLCanvasElement) {
    this.canvas = target;
    this.g = ctx2d(target);
    this.light = canvas(16, 16);
    this.lg = ctx2d(this.light);
  }

  /**
   * Fits the view to the element: about 196 world pixels tall on phones (bigger figures) and 236 on
   * desktops. The canvas holds up to RES pixels per world pixel (64 per tile, the art's own grid) and
   * is scaled smoothly to the screen; on a small screen it is drawn at the screen's own resolution.
   */
  resize(cssW: number, cssH: number, dpr: number, touch: boolean): void {
    const devW = Math.max(1, Math.round(cssW * dpr));
    const devH = Math.max(1, Math.round(cssH * dpr));
    const landscape = devW >= devH;
    // device pixels per world pixel for the target view, never showing less than 150 world pixels
    let total = (landscape ? devH : devW * 1.25) / (touch ? 196 : 236);
    total = Math.min(total, Math.min(devW, devH) / 150);
    total = Math.max(0.5, total);
    const res = Math.min(RES, total);
    this.res = res;
    this.scale = total / res;
    this.dpr = dpr;
    // one world pixel more than the element on each axis: the canvas slides by the camera's
    // fraction of a canvas pixel (see placeCamera), and the extra column and row fill the gap
    const worldW = Math.ceil(devW / total) + 1;
    const worldH = Math.ceil(devH / total) + 1;
    const aw = Math.ceil(worldW * res);
    const ah = Math.ceil(worldH * res);
    this.vw = aw / res;
    this.vh = ah / res;
    if (this.canvas.width !== aw || this.canvas.height !== ah) {
      this.canvas.width = aw;
      this.canvas.height = ah;
      this.g = ctx2d(this.canvas);
    }
    this.canvas.style.width = `${(aw * this.scale) / dpr}px`;
    this.canvas.style.height = `${(ah * this.scale) / dpr}px`;
    this.slideX = this.slideY = NaN;
    if (this.light.width !== aw || this.light.height !== ah) {
      this.light.width = aw;
      this.light.height = ah;
      this.lg = ctx2d(this.light);
    }
  }

  /** Canvas pixels per world pixel (at most RES). */
  res = RES;

  /** Screen (CSS px relative to the canvas) to world coordinates. */
  toWorld(cx: number, cy: number, dpr: number): { x: number; y: number } {
    const k = dpr / this.scale / this.res;
    return { x: this.camX + cx * k, y: this.camY + cy * k };
  }

  /** World coordinates to the screen (CSS px relative to the canvas): where to pin a button to the hero. */
  toScreen(x: number, y: number): { x: number; y: number } {
    const k = this.dpr / this.scale / this.res;
    return { x: (x - this.camX) / k, y: (y - this.camY) / k };
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
    this.look = heroLook(cls, w.hero.equip, worn, w.hero.body);
  }

  /** The camera's lean toward the aim (and a boss), smoothed (see camera.ts). */
  private leanX = 0;
  private leanY = LIFT;
  /** The mouse on the view, -0.5 to 0.5 from its center on each axis (null: no mouse in use). */
  pointer: { x: number; y: number } | null = null;
  private dpr = 1;
  /** The CSS slide last given to the canvas, in device pixels. */
  private slideX = NaN;
  private slideY = NaN;
  /** Where the world is drawn from this frame: the camera rounded down to an art pixel. */
  private drawX = 0;
  private drawY = 0;

  /** Puts the camera on the hero at once (after loading a region or respawning). */
  snap(w: World): void {
    this.leanX = 0;
    this.leanY = LIFT;
    this.placeCamera(w);
  }

  /** The hero's position rounded to an art pixel: the camera is pinned to it, so the hero never wobbles. */
  private heroPos(w: World): { x: number; y: number } {
    return { x: Math.round(w.player.x * this.res) / this.res, y: Math.round(w.player.y * this.res) / this.res };
  }

  private placeCamera(w: World): void {
    // what is actually on screen: the drawn view less its spare world pixel
    // only on a wide view: upright, the thumbs are below the hero, not beside them
    const shift = this.vw > this.vh * 1.2 ? this.frameShift * (this.vw - 1) : 0;
    const c = placeCamera(w.player.x, w.player.y, { x: this.leanX + shift, y: this.leanY }, this.vw - 1, this.vh - 1, w.map.w * TILE, w.map.h * TILE, this.res, this.scale);
    this.camX = c.camX;
    this.camY = c.camY;
    this.drawX = c.drawX;
    this.drawY = c.drawY;
    if (c.slideX !== this.slideX || c.slideY !== this.slideY) {
      this.slideX = c.slideX;
      this.slideY = c.slideY;
      this.canvas.style.transform = c.slideX || c.slideY ? `translate(${-c.slideX / this.dpr}px, ${-c.slideY / this.dpr}px)` : '';
    }
  }

  /** Lets go of the region's ground painter (a worker). */
  dispose(): void {
    this.scenery?.ground.dispose();
  }

  draw(w: World, dt: number, time: number): void {
    // a paused world (a dialogue, a panel) holds still: nothing blinks on in it
    this.still = dt === 0;
    // the packed art for this land (null while it loads, or indoors): the scenery is rebuilt once it is in
    const art = worldLook(w.region.theme);
    if (this.sceneryFor !== w || (art && this.scenery?.art !== art) || this.sceneryVersion !== w.stateVersion) {
      const fresh = this.sceneryFor !== w;
      this.sceneryVersion = w.stateVersion;
      this.scenery?.ground.dispose();
      this.scenery = buildScenery(w.map, w.region, art, (pm) => w.isShown(pm));
      this.sceneryFor = w;
      if (fresh) {
        this.setHeroWeapon(w.hero.cls, w);
        this.snap(w);
      }
    }
    const sc = this.scenery!;
    const g = this.g;
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
    const rate = w.scene ? 2.6 : 4;
    this.leanX = damp(this.leanX, lx, rate, dt);
    this.leanY = damp(this.leanY, ly, rate, dt);
    this.placeCamera(w);
    const shake = this.reducedMotion ? 0 : w.shakeAmt;
    const ox = this.drawX + (shake ? Math.round((Math.random() - 0.5) * shake) : 0);
    const oy = this.drawY + (shake ? Math.round((Math.random() - 0.5) * shake) : 0);

    // everything is drawn in world pixels; the transform turns them into art pixels
    g.setTransform(this.res, 0, 0, this.res, 0, 0);
    g.fillStyle = THEMES[sc.theme].bg;
    g.fillRect(0, 0, this.vw, this.vh);
    sc.ground.draw(g, ox, oy, this.vw, this.vh);
    g.translate(-ox, -oy);

    this.drawLiveGround(w, sc, time, ox, oy);
    for (const f of w.fields) this.drawField(f, time);
    for (const t of w.telegraphs) this.drawTelegraph(t);
    for (const wv of w.waves) this.drawWave(wv);
    this.drawEnemyWarnings(w);
    for (const tr of w.traps) this.drawTrap(tr.x, tr.y, tr.arm > 0, time);
    this.drawAim(w);
    this.drawFacing(w, time);
    this.drawRings(w);
    this.drawEntrances(w, time);

    // everything standing, sorted by depth
    const items: { y: number; draw: () => void }[] = [];
    const inView = (x: number, y: number, m = 40): boolean => x > ox - m && x < ox + this.vw + m && y > oy - m && y < oy + this.vh + 60;
    for (const o of sc.objects) {
      if (!inView(o.x, o.y, 70)) continue;
      items.push({
        y: o.y,
        draw: () => {
          const ow = (o.src ? (o.anim ? o.anim.w : o.src[2]) : o.c.width) / (o.k ?? DETAIL);
          const behind = o.fade && !p.dead && p.y < o.y && p.y > o.y + o.dy + 4 && Math.abs(p.x - o.x) < ow / 2 - 2;
          if (behind) g.globalAlpha = 0.55;
          if (o.src) {
            // from an atlas, placed on its art pixel; animated props step through their frames
            const [sx, sy, sw, sh] = o.src;
            const fw = o.anim ? o.anim.w : sw;
            const f = o.anim ? Math.floor((time * 1000) / o.anim.ms + o.x * 0.37) % o.anim.n : 0;
            g.drawImage(o.c, sx + f * fw, sy, fw, sh, Math.round((o.x + o.dx) * this.res) / this.res, Math.round((o.y + o.dy) * this.res) / this.res, fw / (o.k ?? DETAIL), sh / (o.k ?? DETAIL));
          } else g.drawImage(o.c, Math.round(o.x + o.dx), Math.round(o.y + o.dy), ow, o.c.height / DETAIL);
          g.globalAlpha = 1;
        },
      });
    }
    for (const c of w.chests) if (inView(c.x, c.y)) items.push({ y: c.y + 4, draw: () => this.drawChest(c.x, c.y, c.open, c.tier, time) });
    for (const s of w.spores) if (inView(s.x, s.y)) items.push({ y: s.y + 3, draw: () => this.drawSpore(s.x, s.y, s.ripe, s.fuse, time) });
    for (const n of w.npcs) if (inView(n.x, n.y)) items.push({ y: n.y + 6, draw: () => this.drawNpc(w, n.id, n.x, n.y, n.face, n.bob) });
    for (const c of w.chickens) if (inView(c.x, c.y)) items.push({ y: c.y, draw: () => this.drawChicken(c.x, c.y, c.face, time) });
    for (const d of w.drops) if (inView(d.x, d.y)) items.push({ y: d.y, draw: () => this.drawDrop(d.kind, d.x, d.y, d.z, d.item, time, d.t) });
    for (const e of w.enemies) if (inView(e.x, e.y)) items.push({ y: e.y + e.r * 0.6, draw: () => this.drawEnemy(e, time) });
    for (const pet of w.pets) if (inView(pet.x, pet.y)) items.push({ y: pet.y + pet.r * 0.6, draw: () => this.drawPet(pet, time) });
    // the party's other heroes (net/coop.ts)
    for (const gh of w.coop?.ghosts ?? []) if (gh.seen > 0 && inView(gh.x, gh.y)) items.push({ y: gh.y + 5, draw: () => this.drawGhost(gh, time) });
    items.push({
      y: p.y + 5,
      draw: () => {
        // the hero's art is placed on whole world pixels: shift it to the art pixel the camera follows
        const h = this.heroPos(w);
        const hx = h.x - Math.round(p.x);
        const hy = h.y - Math.round(p.y);
        g.translate(hx, hy);
        this.drawHero(w, time);
        g.translate(-hx, -hy);
      },
    });
    this.drawDoors(w, items);
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.draw();

    for (const pr of w.projectiles) this.drawProjectile(pr, time);
    for (const f of w.fx) this.drawFx(f, w);
    if (w.portal) this.drawPortal(w.portal.x, w.portal.y, time);

    // the crypt is dark: light comes from the hero, torches and spells
    // late light: a low sun warms everything (the Prologue's first evening)
    if (w.storyState?.dusk) {
      g.globalAlpha = 0.16;
      g.fillStyle = '#ff9a4a';
      g.fillRect(ox, oy, this.vw, this.vh);
      g.globalAlpha = 0.1;
      g.fillStyle = '#5a2a6a';
      g.fillRect(ox, oy, this.vw, this.vh);
      g.globalAlpha = 1;
    }
    // the lamps are out: a cold, early dark over the land (not night; the way is still seen)
    if (w.storyState?.gloom) {
      g.globalAlpha = 0.3;
      g.fillStyle = '#2a2440';
      g.fillRect(ox, oy, this.vw, this.vh);
      g.globalAlpha = 0.08;
      g.fillStyle = '#8a7ac8';
      g.fillRect(ox, oy, this.vw, this.vh);
      g.globalAlpha = 1;
    }
    // flames on the roofs while the village burns (above the roofs, under the light)
    for (const f of w.fires) this.drawFire(f.x, f.y, f.size, time);
    if (w.dark) this.drawLighting(w, sc, ox, oy, time);
    else if (sc.theme === 'forest' || sc.theme === 'jungle') this.drawCanopyShade(ox, oy, time);
    // gloomy lands lie under a cold veil (light: with the packed art the land's own grade carries its mood)
    const veil = THEMES[sc.theme].tint;
    if (veil && !w.dark) {
      g.globalAlpha = sc.art ? 0.12 : 0.26;
      g.fillStyle = veil;
      g.fillRect(ox, oy, this.vw, this.vh);
      g.globalAlpha = 1;
    }

    // collapse ring (Morgrave's last phase)
    const bz = w.boss();
    if (bz?.boss && bz.boss.collapse > 0) this.drawCollapse(bz.boss.cx, bz.boss.cy, bz.boss.collapse, time);

    for (const e of w.enemies) if (inView(e.x, e.y)) this.drawEnemyBar(e, w);
    for (const pet of w.pets) if (inView(pet.x, pet.y)) this.drawPetBar(pet);
    for (const t of w.texts) {
      const img = pixelText(t.text, t.color);
      const a = clamp(1.6 - t.t / (t.big ? 0.75 : 0.55), 0, 1);
      g.globalAlpha = a;
      const k = t.big && t.t < 0.12 ? 2 : 1;
      g.drawImage(img, Math.round(t.x - (img.width * k) / 2), Math.round(t.y - (img.height * k) / 2), img.width * k, img.height * k);
      g.globalAlpha = 1;
    }
    this.drawSpeech(w);
    this.drawInteractMarker(w, time);
    this.drawObjectiveArrow(w, ox, oy, time);
    g.setTransform(this.res, 0, 0, this.res, 0, 0);
    // hurt vignette
    if (!p.dead && p.hp < p.maxHp * 0.3) {
      const a = 0.25 + Math.sin(time * 6) * 0.08;
      const grd = g.createRadialGradient(this.vw / 2, this.vh / 2, this.vh * 0.35, this.vw / 2, this.vh / 2, this.vh * 0.85);
      grd.addColorStop(0, 'rgba(120,0,20,0)');
      grd.addColorStop(1, `rgba(150,0,30,${a})`);
      g.fillStyle = grd;
      g.fillRect(0, 0, this.vw, this.vh);
    }
    if (p.dead) {
      g.fillStyle = `rgba(20,0,10,${clamp(p.deadT * 0.5, 0, 0.55)})`;
      g.fillRect(0, 0, this.vw, this.vh);
    }
    // paint the ground just outside the view ahead of time
    sc.ground.prefetch(ox, oy, this.vw, this.vh);
  }

  /* ---------------------------------------------------------------- ground */

  private drawLiveGround(w: World, sc: Scenery, time: number, ox: number, oy: number): void {
    const g = this.g;
    // water glints
    const m = w.map;
    const tx0 = Math.max(0, Math.floor(ox / TILE));
    const ty0 = Math.max(0, Math.floor(oy / TILE));
    const tx1 = Math.min(m.w - 1, Math.floor((ox + this.vw) / TILE));
    const ty1 = Math.min(m.h - 1, Math.floor((oy + this.vh) / TILE));
    // the pack's water moves by itself; the painted water gets glints
    const tiled = !!sc.ground.drawWater;
    sc.ground.drawWater?.(g, ox, oy, this.vw, this.vh, time);
    g.fillStyle = 'rgba(220,240,255,0.75)';
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const i = ty * m.w + tx;
        const k = m.kind[i];
        if (k === K.Water && !tiled) {
          const h = hash2(tx, ty, 3);
          const phase = (time * 0.8 + h * 5) % 3;
          if (phase < 0.6) g.fillRect(tx * TILE + Math.floor(h * 12) + 2, ty * TILE + Math.floor(h * 97) % 12 + 2, phase < 0.3 ? 2 : 3, 1);
        } else if (k === K.Illusion) {
          // a hedge that isn't quite there: faint motes drift through it
          const ph = (time * 0.7 + hash2(tx, ty, 8) * 4) % 2.4;
          if (ph < 0.8) {
            g.fillStyle = `rgba(200,255,220,${0.6 - ph * 0.6})`;
            g.fillRect(tx * TILE + Math.floor(hash2(tx, ty, 2) * 14), ty * TILE + Math.floor(14 - ph * 12), 1, 1);
            g.fillStyle = 'rgba(220,240,255,0.75)';
          }
        }
      }
    }
    // braziers and torches burn
    for (const b of sc.braziers) this.drawFlame(b.x, b.y, time, 1);
    for (const t of sc.torches) {
      g.fillStyle = '#3a3040';
      g.fillRect(t.x - 1, t.y, 3, 4);
      this.drawFlame(t.x, t.y, time, 0.7);
    }
    // waystone runes pulse
    for (const ws of w.waystones) {
      const a = 0.35 + Math.sin(time * 2.5) * 0.2;
      g.globalAlpha = a;
      g.drawImage(glowDisc('#22e4ff', 14), ws.x - 14, ws.y - 32);
      g.globalAlpha = 1;
    }
    for (const s of w.shrines) {
      g.globalAlpha = 0.3 + Math.sin(time * 2) * 0.15;
      g.drawImage(glowDisc('#9cffd0', 16), s.x - 16, s.y - 30);
      g.globalAlpha = 1;
    }
  }

  private drawFlame(x: number, y: number, time: number, k: number): void {
    const g = this.g;
    const f = Math.floor(time * 10 + x) % 3;
    g.fillStyle = '#ff7a3d';
    g.fillRect(x - 2, y - 3 - f, 4, 3 + f);
    g.fillStyle = '#ffd86b';
    g.fillRect(x - 1, y - 2 - (f % 2), 2, 2 + (f % 2));
    if (k >= 1) {
      g.fillStyle = '#ff4a2a';
      g.fillRect(x - 3, y - 1, 1, 1);
      g.fillRect(x + 2, y - 2, 1, 1);
    }
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
      g.ellipse(Math.round(f.x) + 0.5, Math.round(f.y) + 0.5, f.r, f.r * 0.75, 0, 0, TAU);
      g.stroke();
      g.fillStyle = rgba('#000000', 0.12 * fade);
      g.beginPath();
      g.ellipse(f.x, f.y, f.r, f.r * 0.75, 0, 0, TAU);
      g.fill();
      return;
    }
    g.fillStyle = rgba(color, (f.hostile ? 0.32 : 0.22) * fade);
    g.beginPath();
    g.ellipse(f.x, f.y, f.r, f.r * 0.75, 0, 0, TAU);
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
        const ry = 0.75;
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
    g.ellipse(wv.x, wv.y, wv.r, wv.r * 0.75, 0, 0, TAU);
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
          g.ellipse(e.x, e.y, r, r * 0.75, 0, 0, TAU);
          g.fill();
          g.fillStyle = rgba(red, 0.3);
          g.beginPath();
          g.ellipse(e.x, e.y, r * k, r * k * 0.75, 0, 0, TAU);
          g.fill();
          g.strokeStyle = rgba(red, 0.8);
          g.lineWidth = 1;
          g.beginPath();
          g.ellipse(e.x, e.y, r, r * 0.75, 0, 0, TAU);
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
      g.ellipse(x, y, a.size, a.size * 0.75, 0, 0, TAU);
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
      g.ellipse(p.x, p.y, a.size, a.size * 0.75, 0, 0, TAU);
      g.fill();
      g.globalAlpha = 0.8;
      g.stroke();
    }
    g.restore();
  }

  /** Touch: a small arrow ahead of the hero, where a tapped spell will fly. */
  private drawFacing(w: World, time: number): void {
    const p = w.player;
    if (!this.touchMode || this.aim || p.dead || w.safe) return;
    const g = this.g;
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
  private drawRings(w: World): void {
    const g = this.g;
    const p = w.player;
    if (!p.dead) {
      g.fillStyle = 'rgba(0,0,0,0.28)';
      g.beginPath();
      g.ellipse(p.x, p.y + 5, 6, 2.5, 0, 0, TAU);
      g.fill();
      // a soft ring so you never lose your hero in a crowd
      g.strokeStyle = 'rgba(34,228,255,0.45)';
      g.lineWidth = 1;
      g.beginPath();
      g.ellipse(p.x, p.y + 5, 8, 3.5, 0, 0, TAU);
      g.stroke();
    }
    for (const pet of w.pets) {
      if (pet.dead) continue;
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.beginPath();
      g.ellipse(pet.x, pet.y + pet.r * 0.7, pet.r * 1.05, pet.r * 0.42, 0, 0, TAU);
      g.fill();
    }
    for (const e of w.enemies) {
      if (e.dead && e.deathT > 0.3) continue;
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.beginPath();
      g.ellipse(e.x, e.y + e.r * 0.7, e.r * 1.05, e.r * 0.42, 0, 0, TAU);
      g.fill();
      if (e.elite.length && !e.dead) {
        g.strokeStyle = 'rgba(255,211,107,0.7)';
        g.beginPath();
        g.ellipse(e.x, e.y + e.r * 0.7, e.r * 1.4, e.r * 0.6, 0, 0, TAU);
        g.stroke();
      }
    }
  }

  /* -------------------------------------------------------------- figures */

  private drawHero(w: World, time: number): void {
    const g = this.g;
    const p = w.player;
    const cls = w.hero.cls;
    const look = this.look ?? heroLook(cls);
    if (p.dead) {
      const s = heroSprite(look, 'down', 0);
      g.save();
      g.globalAlpha = clamp(1 - p.deadT * 0.5, 0.3, 1);
      g.translate(Math.round(p.x), Math.round(p.y + 4));
      g.rotate(Math.min(1.4, p.deadT * 3));
      g.drawImage(s.c, -s.width / s.k / 2, -s.height / s.k + 3, s.width / s.k, s.height / s.k);
      g.restore();
      return;
    }
    const blink = p.iframe > 0 && !p.dash && !this.still && Math.floor(time * 20) % 2 === 0;
    const mount = p.riding ? MOUNT_DEFS[p.riding] : undefined;
    if (p.form) this.drawShape(w, p.form, time, blink);
    else if (mount) this.drawRider(w, mount, look, time);
    else {
      // calling the mount: it fades in behind the hero, kicking up dust
      if (p.summon > 0 && w.hero.mount && MOUNT_DEFS[w.hero.mount]) this.drawMountGhost(w, MOUNT_DEFS[w.hero.mount]!, clamp(p.summon / SUMMON_TIME, 0, 1));
      const dir: HeroDir = p.dir === 0 ? 'down' : p.dir === 3 ? 'up' : 'side';
      const flip = p.dir === 1;
      const moving = Math.hypot(p.vx, p.vy) > 10;
      const frame = moving ? (Math.floor(p.walkT * 7) % 2) + 1 : 0;
      const s = heroSprite(look, dir, frame);
      const bob = moving ? (Math.floor(p.walkT * 7) % 2 === 0 ? 0 : -0.5) : Math.sin(time * 2.5) > 0.6 ? -0.5 : 0;
      // the picture is at art resolution: its feet (one row above the bottom) stand at p.y + 6
      const sw = s.width / s.k;
      const sh = s.height / s.k;
      const x = Math.round(p.x) - sw / 2;
      const y = Math.round(p.y) + 6.5 - sh + bob;
      // the held weapon behind the body when facing up or away from the aim
      const wpn = weaponSprite(this.weapon.kind, this.weapon.tint);
      const weaponBehind = p.dir === 3 || (p.actKind !== null && ((p.dir === 1 && Math.cos(p.actAngle) > 0) || (p.dir === 2 && Math.cos(p.actAngle) < 0)));
      if (weaponBehind) this.drawWeapon(w, wpn, time);
      // the shield is placed from where the old, smaller hero's corner was
      const sx0 = Math.round(p.x) - 9;
      const sy0 = Math.round(p.y) - 17 + Math.round(bob);
      if ((cls === 'warrior' || cls === 'paladin') && p.dir !== 3) this.drawShield(w, p.dir, sx0, sy0);
      g.globalAlpha = blink ? 0.45 : 1;
      g.drawImage(p.flash > 0 ? (flip ? s.wf : s.w) : flip ? s.f : s.c, x, y, sw, sh);
      g.globalAlpha = 1;
      if (!weaponBehind) this.drawWeapon(w, wpn, time);
      if ((cls === 'warrior' || cls === 'paladin') && p.dir === 3) this.drawShield(w, p.dir, sx0, sy0);
    }
    if (p.shield > 0) {
      g.strokeStyle = `rgba(127,216,255,${0.5 + Math.sin(time * 8) * 0.2})`;
      g.lineWidth = 1;
      g.beginPath();
      g.ellipse(p.x, p.y - 4, 11, 13, 0, 0, TAU);
      g.stroke();
    }
    if (p.channel) {
      for (let i = 0; i < 3; i++) {
        const a = time * 18 + (i * TAU) / 3;
        g.fillStyle = 'rgba(255,255,255,0.6)';
        g.fillRect(Math.round(p.x + Math.cos(a) * 16), Math.round(p.y - 2 + Math.sin(a) * 9), 3, 1);
      }
    }
    if (p.buffs.length) this.drawBuffs(w, time);
    if (hasStatus(p, 'stun')) this.drawStars(p.x, p.y - 18, time);
  }

  /**
   * Another player's hero in a co-op party: their look and weapon at rest, walking as they move, their
   * name and health over them, and their shots in flight.
   */
  private drawGhost(gh: Ghost, time: number): void {
    const g = this.g;
    const look = gh.look as HeroLook;
    const wpn = gh.weapon as { kind: string; tint?: string };
    for (const sh of gh.shots) {
      g.fillStyle = sh.color;
      g.beginPath();
      g.arc(sh.x, sh.y, Math.max(1.5, sh.r), 0, TAU);
      g.fill();
    }
    const dir: HeroDir = gh.dir === 0 ? 'down' : gh.dir === 3 ? 'up' : 'side';
    const s = heroSprite(look, gh.dead ? 'down' : dir, 0);
    const sw = s.width / s.k;
    const sh = s.height / s.k;
    if (gh.dead) {
      g.save();
      g.globalAlpha = 0.5;
      g.translate(Math.round(gh.x), Math.round(gh.y + 4));
      g.rotate(1.4);
      g.drawImage(s.c, -sw / 2, -sh + 3, sw, sh);
      g.restore();
    } else {
      const moving = Math.hypot(gh.vx, gh.vy) > 10;
      const frame = moving ? (Math.floor(gh.walkT * 7) % 2) + 1 : 0;
      const body = heroSprite(look, dir, frame);
      const flip = gh.dir === 1;
      const x = Math.round(gh.x) - sw / 2;
      const y = Math.round(gh.y) + 6.5 - sh + (moving && Math.floor(gh.walkT * 7) % 2 ? -0.5 : 0);
      const ws = weaponSprite(wpn.kind, wpn.tint);
      const pose = REST_POSE[gh.dir] ?? REST_POSE[0]!;
      const drawW = (): void => {
        g.save();
        g.translate(Math.round(gh.x) + Math.round(pose.x), Math.round(gh.y) - 3 + Math.round(pose.y));
        g.rotate(pose.lean);
        const ww = ws.width / ws.k;
        const wh = ws.height / ws.k;
        g.drawImage(ws.c, -ww / 2, wpn.kind === 'bow' ? -wh / 2 : -wh + 3, ww, wh);
        g.restore();
      };
      if (gh.dir === 3) drawW();
      g.globalAlpha = gh.untouchable && Math.floor(time * 20) % 2 === 0 ? 0.6 : 1;
      g.drawImage(flip ? body.f : body.c, x, y, sw, sh);
      g.globalAlpha = 1;
      if (gh.dir !== 3) drawW();
    }
    // name and health, small, over the head
    const name = pixelText(gh.name, '#bfe8ff');
    const top = Math.round(gh.y) - 30;
    g.drawImage(name, Math.round(gh.x - name.width / 2), top - name.height - 2);
    const bw = 18;
    g.fillStyle = 'rgba(20,14,32,0.85)';
    g.fillRect(Math.round(gh.x - bw / 2) - 1, top - 1, bw + 2, 4);
    g.fillStyle = '#6ad06a';
    g.fillRect(Math.round(gh.x - bw / 2), top, Math.round(bw * clamp(gh.hp / gh.maxHp, 0, 1)), 2);
  }

  /** Where a mount picture goes for the hero's facing: its view, mirroring and top-left corner (world px). */
  private mountPlace(w: World, view: HeroDir): { x: number; y: number; flip: boolean } {
    const p = w.player;
    const F = MOUNT_FRAMES[view];
    const flip = p.dir === 1;
    return { x: Math.round(p.x) - (flip ? F.w - F.gx : F.gx) / DETAIL, y: Math.round(p.y) + 6 - F.gy / DETAIL, flip };
  }

  /**
   * The hero in the saddle (blueprint §6.5): the mount's back layer, the rider (their own paper doll down to
   * the hips, so every piece and Wardrobe look shows) and the weapon, the mount's front layer, the rider's
   * legs over the flank. The hero's place, collider and camera stay where they are on foot.
   */
  private drawRider(w: World, m: MountDef, look: HeroLook, time: number): void {
    const g = this.g;
    const p = w.player;
    const view: HeroDir = p.dir === 0 ? 'down' : p.dir === 3 ? 'up' : 'side';
    const moving = Math.hypot(p.vx, p.vy) > 10;
    const frame = moving ? 1 + (Math.floor(p.walkT * 6) % MOUNT_WALK_FRAMES) : 0;
    const bob = frame === 0 ? (Math.sin(time * 2) > 0.7 ? -0.5 : 0) : frame % 2 === 0 ? -0.5 : 0;
    const F = MOUNT_FRAMES[view];
    const at = this.mountPlace(w, view);
    const { back, front } = mountSprites(m, view, frame);
    const blink = p.iframe > 0 && !this.still && Math.floor(time * 20) % 2 === 0;
    // a soft shadow under the animal
    g.fillStyle = 'rgba(10,8,20,0.22)';
    g.beginPath();
    g.ellipse(Math.round(p.x), Math.round(p.y) + 5, view === 'side' ? 17 : 10, view === 'side' ? 3.5 : 6, 0, 0, TAU);
    g.fill();
    g.globalAlpha = blink ? 0.45 : 1;
    const put = (s: Sprite): void => g.drawImage(at.flip ? s.f : s.c, at.x, at.y, s.width / s.k, s.height / s.k);
    put(back);
    // the rider, cut at the hips, sitting on the seat
    const hero = heroSprite(look, view, 0);
    const [seatX, seatY] = F.seat[m.body];
    const sx = at.x + (at.flip ? F.w - seatX : seatX) / DETAIL - HERO_W / DETAIL / 2;
    const sy = at.y + (seatY - RIDER_HIP) / DETAIL + bob;
    const cut = RIDER_HIP + 1;
    const lift = { x: sx + HERO_W / DETAIL / 2 - Math.round(p.x), y: sy - (Math.round(p.y) + 6.5 - HERO_H / DETAIL) };
    const wpn = weaponSprite(this.weapon.kind, this.weapon.tint);
    g.translate(lift.x, lift.y);
    if (p.dir === 3) this.drawWeapon(w, wpn, time);
    g.translate(-lift.x, -lift.y);
    // the picture is at the hero's own art scale (one pixel of outline round it)
    const hk = hero.k;
    g.drawImage(at.flip ? hero.f : hero.c, 0, 0, hero.width, (cut * hk) / DETAIL + 1, sx - 1 / hk, sy - 1 / hk, hero.width / hk, cut / DETAIL + 1 / hk);
    g.translate(lift.x, lift.y);
    if (p.dir !== 3) this.drawWeapon(w, wpn, time);
    if (w.hero.cls === 'warrior' || w.hero.cls === 'paladin') this.drawShield(w, p.dir, Math.round(p.x) - 9, Math.round(p.y) - 17);
    g.translate(-lift.x, -lift.y);
    put(front);
    put(riderLegsSprite(view, m.body, look));
    g.globalAlpha = 1;
    // a prestige mount's touch: a few embers off the mane or stars round the hooves
    if (m.glow) {
      g.fillStyle = m.glow.color;
      for (let i = 0; i < 5; i++) {
        const k = (time * 0.7 + i / 5) % 1;
        const ox = Math.sin(i * 2.4 + time) * (view === 'side' ? 14 : 8);
        const y = m.glow.kind === 'embers' ? Math.round(p.y) - 10 - k * 12 : Math.round(p.y) + 5 - k * 5;
        g.globalAlpha = (1 - k) * 0.8;
        g.fillRect(Math.round(p.x + ox), Math.round(y), 1, 1);
      }
      g.globalAlpha = 1;
    }
  }

  /** The mount fading in while it is called. */
  private drawMountGhost(w: World, m: MountDef, k: number): void {
    const g = this.g;
    const p = w.player;
    const view: HeroDir = p.dir === 0 ? 'down' : p.dir === 3 ? 'up' : 'side';
    const at = this.mountPlace(w, view);
    const { back, front } = mountSprites(m, view, 0);
    g.globalAlpha = k * 0.55;
    for (const s of [back, front]) g.drawImage(at.flip ? s.f : s.c, at.x, at.y, s.width / s.k, s.height / s.k);
    g.globalAlpha = 1;
    g.strokeStyle = `rgba(255,236,190,${0.35 + k * 0.4})`;
    g.lineWidth = 1;
    g.beginPath();
    g.arc(Math.round(p.x), Math.round(p.y) - 6, 15, -Math.PI / 2, -Math.PI / 2 + k * TAU);
    g.stroke();
  }

  /** A druid in cat or bear form: the beast instead of the hero, turned the way they face. */
  private drawShape(w: World, form: string, time: number, blink: boolean): void {
    const g = this.g;
    const p = w.player;
    const moving = Math.hypot(p.vx, p.vy) > 10;
    const frame = moving ? Math.floor(p.walkT * 8) % 2 : 0;
    const s = creatureSprite(form, frame);
    const flip = p.dir === 1 || (p.dir !== 2 && Math.cos(p.actKind ? p.actAngle : p.aim) < 0);
    const sw = s.width / s.k;
    const sh = s.height / s.k;
    // a pounce or a swipe leans the beast forward
    const lunge = p.actKind && p.actT > 0 ? Math.round(Math.cos(p.actAngle) * 2) : 0;
    const breathe = moving ? 0 : Math.sin(time * 2.5) > 0.6 ? -0.5 : 0;
    g.globalAlpha = blink ? 0.45 : 1;
    g.drawImage(p.flash > 0 ? (flip ? s.wf : s.w) : flip ? s.f : s.c, Math.round(p.x) - sw / 2 + lunge, Math.round(p.y) + 6.5 - sh + breathe, sw, sh);
    g.globalAlpha = 1;
  }

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
        g.ellipse(p.x, p.y + 4, 10, 4, 0, 0, TAU);
        g.stroke();
      }
    });
  }

  private drawPet(pet: Pet, time: number): void {
    const g = this.g;
    // things to hold (a door, a gate, a wagon) are drawn as themselves; a person holding a lock is a person
    if (pet.def.role === 'ward' && WARD_LOOKS.has(pet.def.look ?? 'door')) {
      this.drawWard(pet, time);
      return;
    }
    if (pet.def.look) {
      // a companion or someone being led to safety: drawn as the person they are
      const s = npcSprite(pet.def.look);
      const small = pet.def.role === 'follower' ? 0.72 : 1;
      const sw = (s.width / s.k) * small;
      const sh = (s.height / s.k) * small;
      const moving = Math.hypot(pet.vx, pet.vy) > 8;
      const b = moving && Math.floor(pet.walkT * 7) % 2 ? -1 : 0;
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.beginPath();
      g.ellipse(pet.x, pet.y + 5, 5 * small, 2 * small, 0, 0, TAU);
      g.fill();
      if (pet.dead) g.globalAlpha = clamp(1 - pet.deathT / 0.5, 0, 1);
      const flip = Math.cos(pet.face) < 0;
      // knocked down: on one knee, greyed, getting back up
      const down = pet.downT ? 0.55 : 1;
      if (pet.downT) g.globalAlpha = 0.6;
      g.drawImage(pet.flash > 0 ? (flip ? s.wf : s.w) : flip ? s.f : s.c, Math.round(pet.x - sw / 2), Math.round(pet.y + 6 - sh * down + b), sw, sh * down);
      g.globalAlpha = 1;
      return;
    }
    const moving = Math.hypot(pet.vx, pet.vy) > 8;
    const frame = moving ? Math.floor(pet.walkT * 7) % 2 : Math.floor(time * 2 + pet.id) % 2;
    const sprite = pet.def.pal ? recolored(pet.def.sprite, frame, pet.def.pal, `pet:${pet.def.id}`) : creatureSprite(pet.def.sprite, frame);
    const flip = Math.cos(pet.face) < 0;
    const dw = sprite.width / sprite.k;
    const dh = sprite.height / sprite.k;
    const float = pet.def.id === 'voidwalker' ? Math.round(Math.sin(time * 3 + pet.id) * 1.5) - 2 : 0;
    const lunge = pet.actT > 0 && !pet.def.ranged ? (flip ? -2 : 2) : 0;
    const x = Math.round((pet.x - dw / 2 + lunge) * sprite.k) / sprite.k;
    const y = Math.round((pet.y + pet.r * 0.8 - dh + float) * sprite.k) / sprite.k;
    if (pet.dead) g.globalAlpha = clamp(1 - pet.deathT / 0.5, 0, 1);
    // a summon about to fade flickers
    else if (pet.life < 2) g.globalAlpha = Math.floor(time * 10) % 2 ? 1 : 0.5;
    g.drawImage(pet.flash > 0 ? (flip ? sprite.wf : sprite.w) : flip ? sprite.f : sprite.c, x, y, dw, dh);
    g.globalAlpha = 1;
  }

  /** The door the hero must hold (a defend event): a barred door in its frame, splintering as it is hit. */
  private drawWard(pet: Pet, time: number): void {
    const g = this.g;
    const x = Math.round(pet.x);
    const y = Math.round(pet.y);
    const k = pet.hp / pet.maxHp;
    const shake = pet.flash > 0 ? Math.round(Math.sin(time * 60) * 1) : 0;
    if (pet.def.look === 'gate') return this.drawGate(x + shake, y, k);
    if (pet.def.look === 'stone') return this.drawStone(x + shake, y, k, time);
    if (pet.def.look === 'boat') return this.drawBoat(x + shake, y, k);
    if (pet.def.look === 'wagon') return this.drawWagon(x + shake, y, k, pet.walkT, pet.vx < -1);
    if (pet.def.look === 'lantern') return this.drawLamp(x + shake, y, k, time);
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillRect(x - 11, y + 3, 22, 4);
    g.fillStyle = '#3a2a1c';
    g.fillRect(x - 10 + shake, y - 18, 20, 22);
    g.fillStyle = k > 0.5 ? '#8a5a34' : k > 0.25 ? '#7a4a2a' : '#5a3420';
    g.fillRect(x - 9 + shake, y - 17, 18, 20);
    g.fillStyle = '#5a3a20';
    for (const px of [-5, 0, 5]) g.fillRect(x + px + shake, y - 17, 1, 20);
    // iron bars across
    g.fillStyle = '#4a4a5a';
    g.fillRect(x - 10 + shake, y - 12, 20, 2);
    g.fillRect(x - 10 + shake, y - 3, 20, 2);
    // a ward of light while Elyra holds it
    if (k > 0.25) {
      g.globalAlpha = 0.25 + Math.sin(time * 4) * 0.08;
      g.strokeStyle = '#ffe9a0';
      g.lineWidth = 1;
      g.strokeRect(x - 12, y - 20, 24, 26);
      g.globalAlpha = 1;
    }
  }

  /** A palisade gate of lashed logs, splintering as it takes blows. */
  private drawGate(x: number, y: number, k: number): void {
    const g = this.g;
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillRect(x - 16, y + 3, 32, 4);
    for (let i = 0; i < 7; i++) {
      const lx = x - 15 + i * 4.5;
      // broken logs stand lower
      const h = 24 - (k < 0.5 && i % 3 === 1 ? 7 : 0) - (k < 0.25 && i % 2 === 0 ? 6 : 0);
      g.fillStyle = i % 2 ? '#7a5434' : '#8a603a';
      g.fillRect(Math.round(lx), y - h + 4, 4, h);
      g.fillStyle = '#5a3a22';
      g.fillRect(Math.round(lx), y - h + 4, 4, 2);
    }
    g.fillStyle = '#4a3220';
    g.fillRect(x - 16, y - 12, 32, 2);
    g.fillRect(x - 16, y - 3, 32, 2);
  }

  /**
   * A harvest stone with grieflight in its cracks: the violet fades to warm gold as the dead fall (it is
   * cleansed by the fighting around it), and it greys as it is struck.
   */
  private drawStone(x: number, y: number, k: number, time: number): void {
    const g = this.g;
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillRect(x - 9, y + 2, 18, 4);
    g.fillStyle = k > 0.4 ? '#8a8a96' : '#6a6a74';
    g.beginPath();
    g.moveTo(x - 8, y + 3);
    g.lineTo(x - 7, y - 18);
    g.quadraticCurveTo(x, y - 26, x + 7, y - 18);
    g.lineTo(x + 8, y + 3);
    g.closePath();
    g.fill();
    g.fillStyle = '#5a5a66';
    g.fillRect(x - 8, y - 2, 16, 5);
    g.globalAlpha = 0.6 + Math.sin(time * 3) * 0.25;
    g.fillStyle = '#c9a0ff';
    g.fillRect(x - 3, y - 17, 1, 9);
    g.fillRect(x - 2, y - 9, 4, 1);
    g.fillRect(x + 2, y - 14, 1, 6);
    g.globalAlpha = 1;
  }

  /** A covered refugee wagon: canvas over hoops, a plank bed, wheels that turn as it rolls. */
  private drawWagon(x: number, y: number, k: number, roll: number, left: boolean): void {
    const g = this.g;
    const f = left ? -1 : 1;
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillRect(x - 17, y + 3, 34, 4);
    // the bed and the shaft
    g.fillStyle = '#6a4a2c';
    g.fillRect(x - 15, y - 8, 30, 6);
    g.fillStyle = '#4a3220';
    g.fillRect(x + f * 15 - (left ? 8 : 0), y - 5, 8, 2);
    // the canvas, patched and greying as it takes blows
    g.fillStyle = k > 0.5 ? '#e8e0cc' : k > 0.25 ? '#c8c0aa' : '#a8a08a';
    g.beginPath();
    g.moveTo(x - 14, y - 8);
    g.quadraticCurveTo(x - 14, y - 24, x, y - 24);
    g.quadraticCurveTo(x + 14, y - 24, x + 14, y - 8);
    g.closePath();
    g.fill();
    g.fillStyle = '#b8a888';
    for (const hx of [-8, 0, 8]) g.fillRect(x + hx, y - 22, 1, 14);
    if (k < 0.6) {
      g.fillStyle = '#8a7a5a';
      g.fillRect(x - 6, y - 17, 5, 4);
    }
    // wheels: a spoke turns with the rolling
    for (const wx of [-10, 10]) {
      g.fillStyle = '#3a2614';
      g.beginPath();
      g.arc(x + wx, y - 1, 4.5, 0, TAU);
      g.fill();
      g.fillStyle = '#8a6a44';
      g.beginPath();
      g.arc(x + wx, y - 1, 3, 0, TAU);
      g.fill();
      const a = roll * 6;
      g.strokeStyle = '#3a2614';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x + wx - Math.cos(a) * 3, y - 1 - Math.sin(a) * 3);
      g.lineTo(x + wx + Math.cos(a) * 3, y - 1 + Math.sin(a) * 3);
      g.stroke();
    }
  }

  /** Lantern Hill's great lamp on its iron post: it burns brighter as it is relit, and gutters when struck. */
  private drawLamp(x: number, y: number, k: number, time: number): void {
    const g = this.g;
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillRect(x - 6, y + 2, 12, 3);
    g.fillStyle = '#2e2a34';
    g.fillRect(x - 1, y - 26, 3, 28);
    g.fillRect(x - 5, y, 11, 2);
    g.fillRect(x - 6, y - 30, 13, 2);
    g.fillStyle = '#4a4452';
    g.fillRect(x - 5, y - 28, 11, 9);
    const flick = 0.75 + Math.sin(time * 9) * 0.15 + Math.sin(time * 23) * 0.08;
    g.globalAlpha = Math.max(0.2, k) * flick;
    g.fillStyle = '#ffd27a';
    g.fillRect(x - 4, y - 27, 9, 7);
    g.globalAlpha = 1;
  }

  /** A boat on its slip, propped on blocks: the shipwright's pride. */
  private drawBoat(x: number, y: number, k: number): void {
    const g = this.g;
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillRect(x - 20, y + 2, 40, 4);
    g.fillStyle = '#5a4030';
    g.fillRect(x - 14, y, 4, 4);
    g.fillRect(x + 10, y, 4, 4);
    g.fillStyle = k > 0.5 ? '#9a6a3a' : '#7a5030';
    g.beginPath();
    g.moveTo(x - 20, y - 10);
    g.lineTo(x + 20, y - 10);
    g.lineTo(x + 14, y);
    g.lineTo(x - 14, y);
    g.closePath();
    g.fill();
    g.fillStyle = '#c9a060';
    g.fillRect(x - 19, y - 10, 38, 2);
    g.fillStyle = '#e8e0d0';
    if (k > 0.25) g.fillRect(x - 1, y - 26, 2, 16);
    g.fillStyle = '#5a4030';
    for (const px of [-10, -2, 6]) g.fillRect(x + px, y - 7, 1, 6);
  }

  /** A fire on a roof or a beam: tongues of flame and a few sparks, flickering. */
  private drawFire(x: number, y: number, size: number, time: number): void {
    const g = this.g;
    const n = 2 + size;
    for (let i = 0; i < n; i++) {
      const fx = x + (i - (n - 1) / 2) * 4 + Math.sin(time * 5 + i * 2.1 + x) * 1.5;
      const h = 6 + size * 2 + Math.sin(time * 11 + i * 1.7 + y) * 2.5;
      g.fillStyle = '#ff5a2a';
      g.beginPath();
      g.moveTo(fx - 3, y);
      g.quadraticCurveTo(fx - 2, y - h * 0.6, fx, y - h);
      g.quadraticCurveTo(fx + 2, y - h * 0.6, fx + 3, y);
      g.fill();
      g.fillStyle = '#ffc24a';
      g.beginPath();
      g.moveTo(fx - 1.5, y);
      g.quadraticCurveTo(fx - 1, y - h * 0.4, fx, y - h * 0.65);
      g.quadraticCurveTo(fx + 1, y - h * 0.4, fx + 1.5, y);
      g.fill();
    }
    const sp = Math.floor(time * 6 + x) % 3;
    g.fillStyle = '#ffd86b';
    g.fillRect(Math.round(x + Math.sin(time * 3 + x) * 5), Math.round(y - 12 - size * 3 - sp * 3), 1, 1);
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
      const y = Math.round(who.y - 36 - k * 3 + Math.sin(e.t * 9) * 0.6);
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
      const x = Math.round(who.x - wdt / 2);
      const y = Math.round(who.y - 34 - hgt);
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

  /** A companion's health, in green, once it has been hit (a door's always). */
  private drawPetBar(pet: Pet): void {
    if (pet.dead || (pet.hp >= pet.maxHp && pet.def.role !== 'ward') || pet.def.unhurt) return;
    const g = this.g;
    if (pet.def.look) {
      const wdt = pet.def.role === 'ward' ? 22 : 12;
      const x = Math.round(pet.x - wdt / 2);
      const y = Math.round(pet.y - (pet.def.role === 'ward' ? 24 : 32));
      g.fillStyle = '#1b1428';
      g.fillRect(x - 1, y - 1, wdt + 2, 4);
      g.fillStyle = '#1e3a1a';
      g.fillRect(x, y, wdt, 2);
      g.fillStyle = pet.def.role === 'ward' ? '#ffcf5a' : '#7bd65a';
      g.fillRect(x, y, Math.round(wdt * (pet.hp / pet.maxHp)), 2);
      return;
    }
    const s = creatureSprite(pet.def.sprite, 0);
    const wdt = 12;
    const x = Math.round(pet.x - wdt / 2);
    const y = Math.round(pet.y + pet.r * 0.8 - s.height / s.k - 4);
    g.fillStyle = '#1b1428';
    g.fillRect(x - 1, y - 1, wdt + 2, 4);
    g.fillStyle = '#1e3a1a';
    g.fillRect(x, y, wdt, 2);
    g.fillStyle = '#7bd65a';
    g.fillRect(x, y, Math.max(0, Math.round((wdt * pet.hp) / pet.maxHp)), 2);
  }

  private drawShield(w: World, dir: number, x: number, y: number): void {
    const off = w.hero.equip.offhand;
    const s = weaponSprite('shield', off ? itemTint(off) : undefined);
    const sx = dir === 1 ? x + 10 : dir === 2 ? x - 1 : dir === 0 ? x + 1 : x + 9;
    this.g.drawImage(s.c, sx, y + 11, s.width / s.k, s.height / s.k);
  }

  private drawWeapon(w: World, wpn: { c: Cnv; f: Cnv; width: number; height: number; k: number }, time: number): void {
    const g = this.g;
    const p = w.player;
    const kind = this.weapon.kind;
    let angle: number;
    let ox: number;
    let oy: number;
    if (p.actKind === 'swing' || p.actKind === 'heavy') {
      // sweep the arc while the swing plays
      const total = p.actKind === 'heavy' ? 0.28 : 0.2;
      const k = clamp(1 - p.actT / total, 0, 1);
      const arc = p.actKind === 'heavy' ? 1.6 : p.actBig ? 2.6 : 2;
      angle = p.actAngle - arc / 2 + arc * k;
      ox = Math.cos(angle) * 7;
      oy = Math.sin(angle) * 5.6;
    } else if (p.actKind === 'spin') {
      angle = time * 18;
      ox = Math.cos(angle) * 5;
      oy = Math.sin(angle) * 4;
    } else if (p.actKind) {
      // casting and shooting: the weapon points where the skill goes
      angle = p.actAngle;
      ox = Math.cos(angle) * 5;
      oy = Math.sin(angle) * 4;
    } else {
      // at rest (walking included): held upright at the side, leaning toward the way the hero faces
      const pose = REST_POSE[p.dir] ?? REST_POSE[0]!;
      angle = -Math.PI / 2 + pose.lean;
      ox = pose.x;
      oy = pose.y;
    }
    g.save();
    g.translate(Math.round(p.x) + Math.round(ox), Math.round(p.y) - 3 + Math.round(oy));
    // art points up: rotate so its top points along the angle
    g.rotate(angle + Math.PI / 2);
    const ww = wpn.width / wpn.k;
    const wh = wpn.height / wpn.k;
    if (kind === 'bow') g.drawImage(wpn.c, -ww / 2, -wh / 2, ww, wh);
    else g.drawImage(wpn.c, -ww / 2, -wh + 3, ww, wh);
    g.restore();
  }

  private drawEnemy(e: Enemy, time: number): void {
    const g = this.g;
    if (e.dummy) {
      this.drawDummy(e, time);
      return;
    }
    if (e.boss && bossHidden(e)) return;
    const moving = e.state === 'chase' || e.state === 'act' || e.state === 'return';
    const frame = moving ? Math.floor(e.walkT * 6) % 2 : Math.floor(time * 2 + e.id) % 2;
    const sprite = e.def.pal ? recolored(e.def.sprite, frame, e.def.pal, `en:${e.def.id}`) : e.boss?.def.id === 'grimtusk' ? recolored('grimtusk', frame, {}, 'grimtusk') : creatureSprite(e.def.sprite, frame);
    const flip = Math.cos(e.face) < 0;
    let sx = 1;
    let sy = 1;
    if (e.def.ai === 'hopper') {
      // slimes squash before a hop and stretch in the air
      const h = clamp(Math.hypot(e.vx, e.vy) / 90, 0, 1);
      sx = 1 + (e.state === 'windup' ? 0.15 : -0.1 * h);
      sy = 1 + (e.state === 'windup' ? -0.15 : 0.12 * h);
    }
    if (e.state === 'windup' && e.def.ai !== 'hopper') {
      const k = Math.sin(time * 30) * 0.03;
      sx += k;
    }
    const scale = e.scale;
    // whole art pixels, so the doubled art stays crisp
    const dw = Math.round(sprite.width * scale * sx) / sprite.k;
    const dh = Math.round(sprite.height * scale * sy) / sprite.k;
    const floatY = e.def.ai === 'caster' || e.def.floats || e.boss?.def.floats ? Math.round(Math.sin(time * 3 + e.id) * 2) - (e.def.floats ? 6 : 3) : 0;
    const x = Math.round((e.x - dw / 2) * sprite.k) / sprite.k;
    const y = Math.round((e.y + e.r * 0.8 - dh + floatY) * sprite.k) / sprite.k;
    g.save();
    if (e.state === 'spawn') {
      const k = clamp(1 - e.t / 0.7, 0, 1);
      g.beginPath();
      g.rect(x - 2, y + dh * (1 - k) - 1, dw + 4, dh * k + 2);
      g.clip();
    }
    if (e.dead) g.globalAlpha = clamp(1 - e.deathT / 0.6, 0, 1);
    if (e.boss && e.boss.dying > 0) g.globalAlpha = Math.floor(time * 16) % 2 ? 1 : 0.4;
    if (e.elite.length && !e.dead) {
      // a golden glow around elites
      const glow = flip ? sprite.wf : sprite.w;
      g.globalAlpha = 0.5 + Math.sin(time * 5) * 0.2;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const)
        g.drawImage(glow, x + dx, y + dy, dw, dh);
      g.globalCompositeOperation = 'source-atop';
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
    }
    const img = e.flash > 0 ? (flip ? sprite.wf : sprite.w) : flip ? sprite.f : sprite.c;
    g.drawImage(img, x, y, dw, dh);
    // status tints
    const frozen = hasStatus(e, 'freeze');
    const chilled = hasStatus(e, 'chill');
    if ((frozen || chilled) && !e.flash) {
      g.globalAlpha = frozen ? 0.55 : 0.3;
      g.drawImage(flip ? sprite.wf : sprite.w, x, y, dw, dh);
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
      g.fillStyle = frozen ? 'rgba(160,230,255,0.5)' : 'rgba(160,230,255,0.25)';
    }
    if (e.state === 'windup' && Math.floor(time * 14) % 2 === 0 && !e.flash) {
      g.globalAlpha = 0.35;
      g.drawImage(flip ? sprite.wf : sprite.w, x, y, dw, dh);
      g.globalAlpha = 1;
    }
    g.restore();
    if (e.dead) return;
    // statuses
    if (hasStatus(e, 'burn') && Math.floor(time * 8 + e.id) % 2 === 0) this.drawFlame(e.x + Math.sin(time * 7 + e.id) * e.r * 0.5, e.y - e.r * 0.5, time, 0.7);
    if (e.statuses.some((s) => s.id === 'poison')) {
      const ph = (time * 1.5 + e.id * 0.3) % 1;
      g.fillStyle = `rgba(139,227,107,${1 - ph})`;
      g.fillRect(Math.round(e.x - 3 + (e.id % 5)), Math.round(e.y - e.r - ph * 8), 2, 2);
    }
    if (hasStatus(e, 'stun') || frozen) this.drawStars(e.x, y - 3, time);
    if (hasStatus(e, 'root')) {
      g.fillStyle = '#4a8a3a';
      for (let i = -2; i <= 2; i++) g.fillRect(Math.round(e.x + i * 3), Math.round(e.y + e.r * 0.5 - (i % 2 ? 4 : 2)), 1, i % 2 ? 4 : 2);
    }
    if (hasStatus(e, 'mark')) {
      const yy = y - 6 + Math.round(Math.sin(time * 4));
      g.strokeStyle = '#ffe066';
      g.lineWidth = 1;
      g.strokeRect(Math.round(e.x) - 3.5, yy - 3.5, 7, 7);
      g.fillStyle = '#ff4a4a';
      g.fillRect(Math.round(e.x) - 1, yy - 1, 2, 2);
    }
    if (hasStatus(e, 'shock') && Math.floor(time * 12) % 3 === 0) {
      g.fillStyle = '#bfe9ff';
      g.fillRect(Math.round(e.x + (Math.random() - 0.5) * e.r * 2), Math.round(e.y - Math.random() * e.r * 2), 1, 2);
    }
    if (hasStatus(e, 'armorBreak')) {
      g.fillStyle = '#ffb04d';
      g.fillRect(Math.round(e.x + e.r), y + 2, 2, 1);
      g.fillRect(Math.round(e.x + e.r) + 1, y + 3, 1, 2);
    }
    if (e.shield > 0) {
      g.strokeStyle = `rgba(127,216,255,${0.6 + Math.sin(time * 6) * 0.2})`;
      g.lineWidth = 1;
      g.beginPath();
      g.ellipse(e.x, e.y - e.r * 0.4, e.r + 4, e.r + 6, 0, 0, TAU);
      g.stroke();
    }
    if (e.boss?.dazed) this.drawStars(e.x, y - 2, time);
  }

  private drawStars(x: number, y: number, time: number): void {
    const g = this.g;
    for (let i = 0; i < 3; i++) {
      const a = time * 5 + (i * TAU) / 3;
      g.fillStyle = '#ffe066';
      g.fillRect(Math.round(x + Math.cos(a) * 6), Math.round(y + Math.sin(a) * 2), 2, 2);
    }
  }

  private drawDummy(e: Enemy, time: number): void {
    const g = this.g;
    const wob = e.flash > 0 ? Math.round(Math.sin(time * 60) * 1) : 0;
    const x = Math.round(e.x) + wob;
    const y = Math.round(e.y + 6);
    g.fillStyle = '#1b1428';
    g.fillRect(x - 2, y - 22, 4, 23);
    g.fillRect(x - 7, y - 19, 14, 11);
    g.fillStyle = '#6a4424';
    g.fillRect(x - 1, y - 21, 2, 21);
    g.fillStyle = e.flash > 0 ? '#ffffff' : '#e0c070';
    g.fillRect(x - 6, y - 18, 12, 9);
    g.fillStyle = e.flash > 0 ? '#ffffff' : '#c9a050';
    g.fillRect(x - 6, y - 10, 12, 1);
    if (e.dummy === 2) {
      g.fillStyle = '#ffcf5a';
      g.fillRect(x - 2, y - 16, 4, 4);
      g.fillStyle = '#ff7a3d';
      g.fillRect(x - 1, y - 15, 2, 2);
    } else {
      g.fillStyle = '#d8364a';
      g.fillRect(x - 3, y - 16, 6, 5);
      g.fillStyle = '#ffffff';
      g.fillRect(x - 2, y - 15, 4, 3);
      g.fillStyle = '#d8364a';
      g.fillRect(x - 1, y - 14, 2, 1);
    }
    g.fillStyle = '#e0c070';
    g.fillRect(x - 3, y - 24, 6, 5);
  }

  private drawNpc(w: World, id: string, x: number, y: number, face: number, bob: number): void {
    const g = this.g;
    const def = NPCS[id];
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.beginPath();
    g.ellipse(x, y + 6, 6, 2.5, 0, 0, TAU);
    g.fill();
    const sprite = npcSprite(id);
    const b = Math.sin(bob * 2) > 0.7 ? -1 : 0;
    const sw = sprite.width / sprite.k;
    const sh = sprite.height / sprite.k;
    g.drawImage(face < 0 ? sprite.f : sprite.c, Math.round(x) - sw / 2, Math.round(y + 7 - sh + b), sw, sh);
    let top = Math.round(y + 4 - sh);
    // vendors carry a sign of what they sell; quests use "!" (yours) and "?" (talk to them) above it
    const sign = def ? vendorSign(def.shop ?? (def.service === 'respec' ? 'respec' : '')) : null;
    if (sign) {
      const bw = sign.width / sign.k;
      const bh = sign.height / sign.k;
      const bx = Math.round(x - bw / 2);
      const by = top - bh - 1;
      g.fillStyle = 'rgba(27,20,40,0.72)';
      g.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
      g.fillRect(Math.round(x) - 1, by + bh + 2, 2, 1);
      g.drawImage(sign.c, bx, by, bw, bh);
      top = by - 2;
    }
    const mark = npcMark(w, id);
    if (mark) drawMapIcon(g, mark, x, Math.round(top + Math.sin(bob * 3) * 1.5) - 8, 1);
  }

  private drawChicken(x: number, y: number, face: number, time: number): void {
    const g = this.g;
    const X = Math.round(x);
    const Y = Math.round(y);
    const peck = Math.floor(time * 2 + x) % 5 === 0 ? 1 : 0;
    g.fillStyle = '#1b1428';
    g.fillRect(X - 4, Y - 6, 8, 6);
    g.fillStyle = '#ffffff';
    g.fillRect(X - 3, Y - 5, 6, 4);
    g.fillStyle = '#ff4a4a';
    g.fillRect(X + (face < 0 ? -3 : 2), Y - 7 + peck, 1, 1);
    g.fillStyle = '#ffb04d';
    g.fillRect(X + (face < 0 ? -4 : 3), Y - 5 + peck, 1, 1);
    g.fillRect(X - 1, Y, 1, 1);
    g.fillRect(X + 1, Y, 1, 1);
  }

  private drawChest(x: number, y: number, open: boolean, tier: string, time: number): void {
    const g = this.g;
    const trim = tier === 'epic' ? '#c58cff' : tier === 'rare' ? '#5ab0ff' : '#ffcf5a';
    if (!open && tier !== 'common') {
      g.globalAlpha = 0.35 + Math.sin(time * 3) * 0.15;
      g.drawImage(glowDisc(trim, 12), x - 12, y - 14);
      g.globalAlpha = 1;
    }
    g.drawImage(chestArt(tier, open), Math.round(x - CHEST_W / 2), Math.round(y - CHEST_H + 5), CHEST_W, CHEST_H);
  }

  private drawSpore(x: number, y: number, ripe: boolean, fuse: number, time: number): void {
    const g = this.g;
    const X = Math.round(x);
    const Y = Math.round(y);
    if (!ripe) {
      g.fillStyle = '#5a7a3a';
      g.fillRect(X - 2, Y - 2, 4, 2);
      return;
    }
    const swell = fuse > 0 ? Math.floor(time * 20) % 2 : 0;
    g.fillStyle = '#1b1428';
    g.fillRect(X - 5 - swell, Y - 9 - swell, 10 + swell * 2, 10 + swell);
    g.fillStyle = '#b6e36b';
    g.fillRect(X - 4 - swell, Y - 8 - swell, 8 + swell * 2, 8 + swell);
    g.fillStyle = '#e8ff9a';
    g.fillRect(X - 3, Y - 7, 2, 2);
    g.fillStyle = '#7a9a3a';
    g.fillRect(X - 1, Y - 4, 1, 1);
    g.fillRect(X + 2, Y - 6, 1, 1);
  }

  private drawDrop(kind: string, x: number, y: number, z: number, item: Item | undefined, time: number, age: number): void {
    const g = this.g;
    const X = Math.round(x);
    const Y = Math.round(y - z);
    if (kind === 'gold') {
      g.drawImage(coinArt(Math.floor(time * 3 + x) % 5 === 0), X - 3.5, Y - 4, 7, 5);
      return;
    }
    if (kind === 'orb') {
      g.drawImage(glowDisc('rgba(255,90,122,0.8)', 6), X - 6, Y - 9);
      g.drawImage(orbArt(), X - 4, Y - 7 + Math.round(Math.sin(time * 5)), 8, 8);
      return;
    }
    if (kind === 'potion') {
      g.drawImage(glowDisc('rgba(255,74,106,0.7)', 7), X - 7, Y - 11);
      g.drawImage(potionArt(), X - 3, Y - 9 + Math.round(Math.sin(time * 4 + x)), 6, 9);
      return;
    }
    if (kind === 'shard') {
      g.drawImage(glowDisc('rgba(255,63,210,0.8)', 8), X - 8, Y - 12);
      g.drawImage(shardArt(), X - 3, Y - 10, 6, 10);
      return;
    }
    // an item: what it is, over a pool of its rarity's light (and a beam for the good ones)
    const rarity = item?.r;
    const color = rarityColor(rarity);
    if (rarity === 'rare' || rarity === 'epic' || rarity === 'legendary') {
      const h = rarity === 'legendary' ? 60 : rarity === 'epic' ? 44 : 28;
      const grd = g.createLinearGradient(0, Y - h, 0, Y);
      grd.addColorStop(0, rgba(color, 0));
      grd.addColorStop(1, rgba(color, 0.55 + Math.sin(time * 4) * 0.15));
      g.fillStyle = grd;
      g.fillRect(X - 2, Y - h, 4, h);
    }
    g.fillStyle = rgba(color, 0.32 + Math.sin(time * 4 + x) * 0.08);
    g.beginPath();
    g.ellipse(X, Y, 7, 2.4, 0, 0, Math.PI * 2);
    g.fill();
    const bounce = age < 0.6 ? 0 : Math.round(Math.sin(time * 4) * 1);
    if (item) {
      const icon = itemIconCanvas(item);
      const s = 11 / Math.max(icon.width, icon.height);
      const w = icon.width * s;
      const h = icon.height * s;
      g.drawImage(icon, Math.round(X - w / 2), Math.round(Y - h - 1 + bounce), w, h);
      return;
    }
    g.fillStyle = '#1b1428';
    g.fillRect(X - 4, Y - 8 + bounce, 9, 9);
    g.fillStyle = color;
    g.fillRect(X - 3, Y - 7 + bounce, 7, 7);
  }

  /** Closed room doors: bars (crypt) or a palisade (the den). */
  private drawDoors(w: World, items: { y: number; draw: () => void }[]): void {
    const m = w.map;
    const g = this.g;
    for (let r = 0; r < m.doors.length; r++) {
      for (const i of m.doors[r]!) {
        if (!m.solid[i]) continue;
        const tx = i % m.w;
        const ty = Math.floor(i / m.w);
        const x = tx * TILE;
        const y = ty * TILE;
        const crypt = w.region.theme === 'crypt';
        items.push({
          y: y + 14,
          draw: () => {
            if (crypt) {
              g.fillStyle = '#1b1428';
              g.fillRect(x, y - 6, 16, 22);
              g.fillStyle = '#5a5670';
              for (let b = 1; b < 16; b += 4) g.fillRect(x + b, y - 5, 2, 20);
              g.fillStyle = '#7a7690';
              g.fillRect(x, y - 5, 16, 2);
              g.fillRect(x, y + 7, 16, 2);
            } else {
              g.fillStyle = '#1b1428';
              g.fillRect(x, y - 8, 16, 24);
              for (let b = 0; b < 16; b += 4) {
                g.fillStyle = '#8a5a34';
                g.fillRect(x + b + 1, y - 7, 3, 22);
                g.fillStyle = '#b07a48';
                g.fillRect(x + b + 1, y - 7, 1, 22);
                g.fillStyle = '#1b1428';
                g.fillRect(x + b + 2, y - 8, 1, 1);
              }
            }
          },
        });
      }
    }
  }

  /* --------------------------------------------------- shots and effects */

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

  private drawFx(f: Fx, w: World): void {
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
      case 'spark':
      case 'rubble':
      case 'coin':
      case 'shard':
        g.fillStyle = f.color;
        g.globalAlpha = clamp(1.4 - k, 0, 1);
        g.fillRect(x, y, f.size, f.size);
        g.globalAlpha = 1;
        break;
      case 'smoke': {
        // a soft puff that swells and thins as it rises (two discs: a body and a lighter heart)
        const rr = (f.size * (1 + k)) / 2;
        g.fillStyle = f.color;
        g.globalAlpha = clamp(0.42 - k * 0.42, 0, 1);
        g.beginPath();
        g.arc(x + rr, y + rr, rr, 0, TAU);
        g.fill();
        g.globalAlpha = clamp(0.2 - k * 0.2, 0, 1);
        g.beginPath();
        g.arc(x + rr * 0.8, y + rr * 0.7, rr * 0.6, 0, TAU);
        g.fill();
        g.globalAlpha = 1;
        break;
      }
      case 'leaf':
        g.fillStyle = f.color;
        g.globalAlpha = clamp(1 - k * 1.2, 0, 0.9);
        g.fillRect(x, y, 2, 1);
        g.globalAlpha = 1;
        f.vx += Math.sin(f.t * 3 + f.a) * 0.6;
        break;
      case 'ember':
        if (f.sprite === 'meteor') {
          // the falling meteor
          g.fillStyle = 'rgba(255,122,61,0.4)';
          g.fillRect(x - 6, y - 12, 4, 10);
          g.fillStyle = '#1b1428';
          g.fillRect(x - 4, y - 4, 9, 9);
          g.fillStyle = '#6a4a3a';
          g.fillRect(x - 3, y - 3, 7, 7);
          g.fillStyle = '#ffb04d';
          g.fillRect(x - 3, y - 3, 3, 3);
        } else {
          g.fillStyle = f.color;
          g.fillRect(x, y, 1, 1);
        }
        break;
      case 'ring': {
        g.strokeStyle = rgba(f.color, clamp(1 - k, 0, 1));
        g.lineWidth = k < 0.5 ? 2 : 1;
        g.beginPath();
        g.ellipse(f.x, f.y, Math.max(1, f.size * (0.3 + k * 0.7)), Math.max(1, f.size * 0.75 * (0.3 + k * 0.7)), 0, 0, TAU);
        g.stroke();
        break;
      }
      case 'burst': {
        g.globalAlpha = clamp(1 - k, 0, 1);
        g.drawImage(glowDisc(f.color, Math.ceil(f.size)), x - Math.ceil(f.size), y - Math.ceil(f.size));
        g.globalAlpha = 1;
        break;
      }
      case 'glow': {
        g.globalAlpha = clamp(Math.sin(k * Math.PI), 0, 1) * 0.8;
        g.drawImage(glowDisc(f.color, Math.ceil(f.size)), x - Math.ceil(f.size), y - Math.ceil(f.size));
        g.globalAlpha = 1;
        break;
      }
      case 'slash': {
        // a crescent that sweeps and fades
        g.save();
        g.globalAlpha = clamp(1 - k, 0, 1);
        g.strokeStyle = f.color;
        g.lineWidth = f.r2 ? 3 : 2;
        g.beginPath();
        const sweep = f.a2 * Math.min(1, k * 2 + 0.3);
        g.arc(f.x, f.y - 2, f.size, f.a - f.a2 / 2, f.a - f.a2 / 2 + sweep);
        g.stroke();
        g.strokeStyle = 'rgba(255,255,255,0.5)';
        g.lineWidth = 1;
        g.beginPath();
        g.arc(f.x, f.y - 2, f.size - 3, f.a - f.a2 / 2, f.a - f.a2 / 2 + sweep);
        g.stroke();
        g.restore();
        break;
      }
      case 'zap': {
        g.strokeStyle = rgba(f.color, clamp(1.2 - k, 0, 1));
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(f.x, f.y);
        const n = 5;
        for (let i = 1; i < n; i++) {
          const t = i / n;
          g.lineTo(f.x + (f.x2 - f.x) * t + (Math.random() - 0.5) * 6, f.y + (f.y2 - f.y) * t + (Math.random() - 0.5) * 6);
        }
        g.lineTo(f.x2, f.y2);
        g.stroke();
        g.strokeStyle = rgba('#ffffff', clamp(1 - k, 0, 1));
        g.stroke();
        break;
      }
      case 'beam': {
        if (f.sprite === 'arrow') {
          // a falling arrow of the volley
          const h = 30 * (1 - k);
          g.fillStyle = '#8a5a34';
          g.fillRect(x, Math.round(y - h - 6), 1, 6);
          g.fillStyle = '#e8e8f0';
          g.fillRect(x, Math.round(y - h), 1, 2);
          if (k > 0.85) {
            g.fillStyle = '#c9b89a';
            g.fillRect(x - 1, y, 3, 1);
          }
        } else {
          g.globalAlpha = clamp(1 - k, 0, 1);
          g.fillStyle = f.color;
          g.fillRect(x - Math.ceil(f.size / 2), y - 200, Math.ceil(f.size), 200);
          g.fillStyle = '#ffffff';
          g.fillRect(x - 0.5, y - 200, 1, 200);
          g.globalAlpha = 1;
        }
        break;
      }
      case 'rift': {
        const s = f.size * Math.sin(Math.min(1, k * 1.5) * Math.PI * 0.5);
        g.fillStyle = rgba('#120018', 0.85);
        g.beginPath();
        g.ellipse(f.x, f.y, s, s * 0.45, 0, 0, TAU);
        g.fill();
        g.strokeStyle = Math.floor(f.t * 20) % 2 ? '#ff3fd2' : '#22e4ff';
        g.lineWidth = 1;
        g.stroke();
        break;
      }
      case 'ghost': {
        const pl = w.player;
        const s = pl.form ? creatureSprite(pl.form, 0) : heroSprite(this.look ?? heroLook(w.hero.cls), pl.dir === 0 ? 'down' : pl.dir === 3 ? 'up' : 'side', 0);
        const flip = pl.form ? pl.dir === 1 || (pl.dir !== 2 && Math.cos(pl.aim) < 0) : pl.dir === 1;
        g.globalAlpha = clamp(0.5 - k * 0.5, 0, 1);
        g.drawImage(flip ? s.wf : s.w, Math.round(f.x) - s.width / s.k / 2, Math.round(f.y) + 6.5 - s.height / s.k, s.width / s.k, s.height / s.k);
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
    g.ellipse(cx, cy, r, r * 0.8, 0, 0, TAU, true);
    g.fill('evenodd');
    g.strokeStyle = Math.floor(time * 8) % 2 ? '#ff3fd2' : '#22e4ff';
    g.lineWidth = 1;
    g.beginPath();
    g.ellipse(cx, cy, r, r * 0.8, 0, 0, TAU);
    g.stroke();
    g.restore();
  }

  /* -------------------------------------------------------------- light */

  private drawLighting(w: World, sc: Scenery, ox: number, oy: number, time: number): void {
    const lg = this.lg;
    lg.setTransform(this.res, 0, 0, this.res, 0, 0);
    lg.globalCompositeOperation = 'source-over';
    // a fresh layer every frame (a translucent fill drawn over last frame's would stack up to black)
    lg.clearRect(0, 0, this.vw, this.vh);
    // moody, not murky: the room stays readable outside the pools of light
    lg.fillStyle = 'rgba(10,6,26,0.72)';
    lg.fillRect(0, 0, this.vw, this.vh);
    lg.globalCompositeOperation = 'destination-out';
    const hole = (x: number, y: number, r0: number, a = 1): void => {
      // in steps of 4 px and at most 240 (each size of light is a canvas kept for good)
      const r = Math.min(240, Math.max(4, Math.round(r0 / 4) * 4));
      const sx = x - ox;
      const sy = y - oy;
      if (sx < -r || sy < -r || sx > this.vw + r || sy > this.vh + r) return;
      lg.globalAlpha = a;
      lg.drawImage(glowDisc('#ffffff', r), Math.round(sx - r), Math.round(sy - r));
    };
    const p = w.player;
    hole(p.x, p.y - 4, 120);
    hole(p.x, p.y - 4, 70);
    for (const t of sc.torches) hole(t.x, t.y + 6, 58 + Math.sin(time * 9 + t.x) * 2, 0.9);
    for (const b of sc.braziers) hole(b.x, b.y + 4, 72 + Math.sin(time * 8 + b.x) * 2);
    // a village at night: burning roofs, lamps and cookfires
    for (const f of w.fires) hole(f.x, f.y, 40 + f.size * 22 + Math.sin(time * 7 + f.x) * 4, 0.95);
    for (const pr of w.props) if (LIGHTS[pr.prop]) hole(pr.x, pr.y - 6, LIGHTS[pr.prop]!, 0.85);
    // a lamp being relit pushes the dark back as it takes
    for (const pet of w.pets) if (!pet.dead && pet.def.look === 'lantern') hole(pet.x, pet.y - 24, 40 + 70 * (pet.hp / pet.maxHp), 0.9);
    for (const ws of w.waystones) hole(ws.x, ws.y - 10, 40, 0.6);
    for (const pr of w.projectiles) if (!pr.hostile || pr.look === 'riftOrb' || pr.look === 'skull') hole(pr.x, pr.y, pr.hostile ? 16 : 22, 0.8);
    for (const f of w.fields) hole(f.x, f.y, f.r + 10, 0.5);
    for (const t of w.telegraphs) if (t.tone !== 'player') hole(t.x, t.y, Math.max(20, t.r + 8), 0.6);
    for (const d of w.drops) if (d.kind === 'item' || d.kind === 'shard') hole(d.x, d.y, 20, 0.6);
    for (const f of w.fx) if (f.kind === 'burst' || f.kind === 'ring' || f.kind === 'beam') hole(f.x, f.y, 30, 0.6 * (1 - f.t / f.life));
    if (w.portal) hole(w.portal.x, w.portal.y, 60);
    const boss = w.boss();
    if (boss) hole(boss.x, boss.y, 64, 0.8);
    for (const e of w.enemies) if (!e.dead && e.def.id === 'rift-acolyte') hole(e.x, e.y, 22, 0.5);
    lg.globalAlpha = 1;
    lg.globalCompositeOperation = 'source-over';
    const g = this.g;
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(this.light, 0, 0);
    g.setTransform(this.res, 0, 0, this.res, 0, 0);
    // warm glow around flames
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.18;
    for (const t of sc.torches) g.drawImage(glowDisc('#ff9a3d', 22), Math.round(t.x - ox - 22), Math.round(t.y - oy - 18));
    for (const b of sc.braziers) g.drawImage(glowDisc('#ff9a3d', 30), Math.round(b.x - ox - 30), Math.round(b.y - oy - 24));
    for (const f of w.fires) {
      const r = 24 + f.size * 14;
      g.drawImage(glowDisc('#ff7a2a', r), Math.round(f.x - ox - r), Math.round(f.y - oy - r));
    }
    g.restore();
  }

  /** The forest: soft moving light through the leaves. */
  private drawCanopyShade(ox: number, oy: number, time: number): void {
    if (this.reducedMotion) return;
    const g = this.g;
    g.save();
    g.globalAlpha = 0.07;
    for (let i = 0; i < 5; i++) {
      const x = ((i * 137 + time * 6) % (this.vw + 160)) - 80 + ox;
      const y = ((i * 89) % this.vh) + oy;
      g.drawImage(glowDisc('#fff8d0', 40), Math.round(x - 40), Math.round(y - 40));
    }
    g.restore();
  }

  /* ----------------------------------------------------------- overlays */

  private drawEnemyBar(e: Enemy, w: World): void {
    if (e.dead || e.boss || e.dummy || e.state === 'spawn') return;
    const named = !!e.def.named;
    if (e.hp >= e.maxHp && !e.elite.length && !named && e.shield <= 0) return;
    const g = this.g;
    const wdt = e.elite.length || named ? 22 : 14;
    const x = Math.round(e.x - wdt / 2);
    const sprite = creatureSprite(e.def.sprite, 0);
    const y = Math.round(e.y + e.r * 0.8 - (sprite.height / sprite.k) * e.scale - 5 - (e.def.floats ? 6 : 0));
    g.fillStyle = '#1b1428';
    g.fillRect(x - 1, y - 1, wdt + 2, 4);
    g.fillStyle = '#4a1a26';
    g.fillRect(x, y, wdt, 2);
    g.fillStyle = named ? '#d8b0ff' : e.elite.length ? '#ffcf5a' : '#ff4a5a';
    g.fillRect(x, y, Math.max(0, Math.round((wdt * e.hp) / e.maxHp)), 2);
    if (e.shield > 0) {
      g.fillStyle = '#7fd8ff';
      g.fillRect(x, y - 1, Math.max(1, Math.round((wdt * e.shield) / (e.maxHp * 0.4))), 1);
    }
    if (named) {
      const img = pixelText(`${e.name} ${e.level}`, '#e8d0ff');
      g.drawImage(img, Math.round(e.x - img.width / 2), y - 8);
    } else if (e.elite.length) {
      const img = pixelText(e.name.split(' ')[0]!, '#ffd36b');
      g.drawImage(img, Math.round(e.x - img.width / 2), y - 8);
    }
    void w;
  }

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

  /** A bobbing hint over what you can interact with. */
  private drawInteractMarker(w: World, time: number): void {
    const it = w.interactable;
    // on touch the Talk button itself stands beside the hero (ui/Touch.tsx)
    if (!it || this.touchMode) return;
    const g = this.g;
    const img = pixelText(it.kind === 'npc' ? 'TALK' : it.kind === 'waystone' ? 'TRAVEL' : it.kind === 'exit' && it.door && !w.region.interior ? 'ENTER' : 'EXIT', '#ffffff');
    const y = Math.round(it.y - 34 + Math.sin(time * 4) * 1.5);
    g.drawImage(img, Math.round(it.x - img.width / 2), y);
  }

  /** An arrow at the edge of the view toward the current objective. */
  private drawObjectiveArrow(w: World, ox: number, oy: number, time: number): void {
    const target = objectiveTarget(w);
    // enemies to hunt show on the minimap; the edge arrow is for places
    if (!target || target.soft) return;
    const g = this.g;
    const cx = ox + this.vw / 2;
    const cy = oy + this.vh / 2;
    const inView = target.x > ox + 10 && target.x < ox + this.vw - 10 && target.y > oy + 10 && target.y < oy + this.vh - 10;
    if (inView) {
      const img = pixelText('V', '#ffe066');
      g.drawImage(img, Math.round(target.x - img.width / 2), Math.round(target.y - 30 + Math.sin(time * 5) * 2));
      return;
    }
    const a = Math.atan2(target.y - cy, target.x - cx);
    const mx = this.vw / 2 - 14;
    const my = this.vh / 2 - 14;
    const t = Math.min(Math.abs(mx / (Math.cos(a) || 1e-6)), Math.abs(my / (Math.sin(a) || 1e-6)));
    const x = cx + Math.cos(a) * t;
    const y = cy + Math.sin(a) * t;
    g.save();
    g.translate(Math.round(x), Math.round(y));
    g.rotate(a);
    g.globalAlpha = 0.8 + Math.sin(time * 5) * 0.2;
    g.fillStyle = '#1b1428';
    g.beginPath();
    g.moveTo(7, 0);
    g.lineTo(-5, -6);
    g.lineTo(-2, 0);
    g.lineTo(-5, 6);
    g.closePath();
    g.fill();
    g.fillStyle = '#ffe066';
    g.beginPath();
    g.moveTo(5, 0);
    g.lineTo(-4, -4);
    g.lineTo(-1, 0);
    g.lineTo(-4, 4);
    g.closePath();
    g.fill();
    g.restore();
    void dist;
  }
}

/** A filled pixel circle (no smoothing). */
function pixelDisc(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  g.fillStyle = color;
  if (r <= 1) {
    g.fillRect(x - 1, y - 1, 2, 2);
    return;
  }
  for (let dy = -r; dy < r; dy++) {
    const w = Math.round(Math.sqrt(r * r - (dy + 0.5) * (dy + 0.5)));
    g.fillRect(x - w, y + dy, w * 2, 1);
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

