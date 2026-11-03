import { CLASSES } from '../data/classes';
import type { ClassId } from '../data/types';
import { newCharacter, type Face } from '../progress/character';
import { FIELD_ICONS, SPELLS, type Element } from '../vigil/kit';
import type { Foe, Fx, Hero, Obstacle, Vigil } from '../vigil/sim';
import { fxArt, stripOf, type FxArt } from './art/atlas';
import { iconPicture } from './art/gameIcons';
import { drawCircle } from './art/vfx';
import { canvas, ctx2d, DETAIL, type Cnv } from './pixel';
import type { LandLayer, LandView } from './renderer';
import type { StaticObject } from './tiles';
import { creatureSprite, heroLook, heroSprite, weaponSprite, type HeroDir } from './sprites';
import type { HeroLook } from './art/hero';

/**
 * The Vigil's night, drawn into the land by the game's own renderer, so a foe behind a tree really is behind it. The
 * spells are the Magic Spells VFX pack, each in its element's color; what the pack has no picture for (a swing's
 * crescent, a lightning arc) is drawn in the same chunky, outlined way. All of it is in world pixels.
 */

const TAU = Math.PI * 2;
const INK = '#1c0e08';

/* ---------------------------------------------------------------- what the land keeps */

/** What people built: a night's battlefield has none of it. */
const BUILT = new Set(['building', 'fence', 'gate', 'sign', 'shrine', 'waystone', 'brazier', 'pillar', 'well']);
const TALL = 26;
const sizeOf = (o: StaticObject): { w: number; h: number } => ({ w: (o.src ? (o.anim ? o.anim.w : o.src[2]) : o.c.width) / (o.k ?? DETAIL), h: (o.src ? o.src[3] : o.c.height) / (o.k ?? DETAIL) });
const spot = (x: number, y: number): number => {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
};

/** The land thinned out for a fight: low things stay, and about one tree in five, with room to run between them. */
export function keepOnLand(o: StaticObject): boolean {
  if (o.kind === 'edge') return true;
  if (BUILT.has(o.kind)) return false;
  const { w, h } = sizeOf(o);
  if (h <= TALL) return true;
  return w <= 90 && spot(o.x, o.y) < 0.22;
}

/** The trunks and boulders of what stays: nobody walks through these, hero or Host. */
export function trunksOf(objects: StaticObject[]): Obstacle[] {
  const out: Obstacle[] = [];
  for (const o of objects) {
    if (o.kind === 'edge' || !keepOnLand(o)) continue;
    const { w, h } = sizeOf(o);
    if (h > TALL) out.push({ x: o.x, y: o.y, r: Math.max(5, Math.min(9, w * 0.16)) });
    else if (o.kind === 'rock' && h > 12) out.push({ x: o.x, y: o.y, r: Math.max(3.5, Math.min(7, w * 0.3)) });
  }
  return out;
}
/* ---------------------------------------------------------------- the night */

/** More than this many little hits at once would only hide what they hit. */
const MAX_HITS = 30;
const MAX_FULL_BURSTS = 12;

type Sheet = FxArt['fx'][string];

/** An effect in an element, or in its own colors where the pack has no such version. */
const sheetOf = (art: FxArt, effect: string, el: Element): Sheet | null => art.fx[`elements/${el}/${effect}_${el}`] ?? art.fx[effect] ?? null;

interface PlayOpts {
  /** Height, if it isn't square. */
  h?: number;
  rot?: number;
  alpha?: number;
  /** Stands on (x, y) rather than being centered on it. */
  feet?: boolean;
  /** How far along its length it sits off (x, y): a bolt's head is right of the middle of its frame. */
  ahead?: number;
}

function frameOf(g: CanvasRenderingContext2D, art: FxArt, s: Sheet, frame: number, x: number, y: number, w: number, o: PlayOpts): void {
  const F = art.frame;
  const h = o.h ?? w;
  const strip = stripOf(art, s);
  if (o.alpha !== undefined) g.globalAlpha = o.alpha;
  const cy = o.feet ? y - h * 0.42 : y;
  if (o.rot) {
    g.save();
    g.translate(x, cy);
    g.rotate(o.rot);
    g.drawImage(strip, frame * F, 0, F, F, -w / 2 - (o.ahead ?? 0), -h / 2, w, h);
    g.restore();
  } else {
    g.drawImage(strip, frame * F, 0, F, F, x - w / 2 - (o.ahead ?? 0), cy - h / 2, w, h);
  }
  if (o.alpha !== undefined) g.globalAlpha = 1;
}

/** Once through an effect, `u` from 0 to 1. */
function play(g: CanvasRenderingContext2D, art: FxArt | null, effect: string, el: Element, u: number, x: number, y: number, w: number, o: PlayOpts = {}): void {
  if (!art || u < 0 || u >= 1) return;
  const s = sheetOf(art, effect, el);
  if (s) frameOf(g, art, s, Math.floor(u * s.n), x, y, w, o);
}

/** Round and round. */
function loop(g: CanvasRenderingContext2D, art: FxArt | null, effect: string, el: Element, time: number, x: number, y: number, w: number, o: PlayOpts = {}): void {
  if (!art) return;
  const s = sheetOf(art, effect, el);
  if (s) frameOf(g, art, s, Math.floor((time * 1000) / s.ms) % s.n, x, y, w, o);
}

const glows = new Map<string, Cnv>();
/** A lit disc in a color, drawn once and stamped. */
function glow(color: string): Cnv {
  let c = glows.get(color);
  if (!c) {
    c = canvas(48, 48);
    const g = ctx2d(c);
    const grad = g.createRadialGradient(24, 24, 0, 24, 24, 24);
    grad.addColorStop(0, '#fffdf0');
    grad.addColorStop(0.3, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 48, 48);
    glows.set(color, c);
  }
  return c;
}

const stampGlow = (g: CanvasRenderingContext2D, color: string, x: number, y: number, r: number, alpha = 1): void => {
  g.globalAlpha = alpha;
  g.drawImage(glow(color), x - r, y - r, r * 2, r * 2);
  g.globalAlpha = 1;
};

const icons = new Map<string, HTMLImageElement>();
function iconImage(name: string): HTMLImageElement | null {
  let im = icons.get(name);
  if (!im) {
    const src = iconPicture(name);
    if (!src) return null;
    im = new Image();
    im.src = src;
    icons.set(name, im);
  }
  return im.complete && im.naturalWidth ? im : null;
}

/** A ring with an inked edge and a bright heart, so it reads against any ground. */
function ring(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, width: number, alpha: number): void {
  g.globalAlpha = Math.max(0, alpha);
  g.beginPath();
  g.ellipse(x, y, r, r * 0.76, 0, 0, TAU);
  g.lineWidth = width + 1;
  g.strokeStyle = INK;
  g.stroke();
  g.lineWidth = width;
  g.strokeStyle = color;
  g.stroke();
  g.lineWidth = Math.max(0.4, width * 0.3);
  g.strokeStyle = '#fffdf0';
  g.stroke();
  g.globalAlpha = 1;
}

/** A big cartoon sword, inked and shining, its point at the origin and its grip straight up: `h` long. */
function paintSword(g: CanvasRenderingContext2D, h: number): void {
  const w = h * 0.1;
  const blade = h * 0.72;
  const shape = (color: string, outline: boolean): void => {
    g.fillStyle = color;
    g.fill();
    if (outline) {
      g.lineWidth = 1;
      g.strokeStyle = INK;
      g.stroke();
    }
  };
  // the grip and its pommel
  g.beginPath();
  g.rect(-w * 0.35, -h, w * 0.7, h - blade);
  shape('#7a4a26', true);
  g.beginPath();
  g.arc(0, -h, w * 0.6, 0, TAU);
  shape('#ffcf5a', true);
  // the blade, with a bright side
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(w, -h * 0.1);
  g.lineTo(w, -blade);
  g.lineTo(-w, -blade);
  g.lineTo(-w, -h * 0.1);
  g.closePath();
  shape('#c8d0e0', true);
  g.beginPath();
  g.moveTo(0, -1);
  g.lineTo(-w + 0.6, -h * 0.1);
  g.lineTo(-w + 0.6, -blade);
  g.lineTo(0, -blade);
  g.closePath();
  shape('#ffffff', false);
  // the guard
  g.beginPath();
  g.rect(-w * 2.1, -blade - w * 0.55, w * 4.2, w * 1.1);
  shape('#ffcf5a', true);
}

/** Where something is about to land: a thin mark, not a ring of its own. */
function mark(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha: number): void {
  g.globalAlpha = Math.max(0, alpha);
  g.beginPath();
  g.ellipse(x, y, r, r * 0.76, 0, 0, TAU);
  g.lineWidth = 0.8;
  g.strokeStyle = color;
  g.stroke();
  g.globalAlpha = 1;
}

function crescent(g: CanvasRenderingContext2D, x: number, y: number, R: number, inner: number, from: number, to: number): void {
  g.beginPath();
  g.arc(x, y, R, from, to);
  g.arc(x, y, inner, to, from, true);
  g.closePath();
}

const easeOut = (u: number): number => 1 - (1 - u) * (1 - u);
const shake = (seed: number): number => {
  const n = Math.sin(seed * 127.1) * 43758.5453;
  return n - Math.floor(n) - 0.5;
};

interface Bit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  dur: number;
  c: string;
  s: number;
}

const BITS = ['#ffe39a', '#ffb45c', '#ff7a3d', '#ffffff', '#c9b8ff'];
const SPARK_TIERS: [number, string, number][] = [
  [25, '#ffd257', 7],
  [5, '#6ac8ff', 5.4],
  [0, '#7dffb0', 4],
];

export interface PartyLook {
  face?: Face;
  body?: 'm' | 'f';
}

export class VigilPainter implements LandLayer {
  /** Who the watching player is: their own hero is the renderer's, everyone else's is drawn here. */
  meId: number;
  private readonly v: Vigil;
  private readonly looks = new Map<number, HeroLook>();
  private readonly walkT = new Map<number, number>();
  private readonly pops: { x: number; y: number; n: number; big: boolean; crit: boolean; t: number }[] = [];
  private readonly bits: Bit[] = [];
  private dt = 0;

  constructor(v: Vigil, meId: number, party: Record<number, PartyLook> = {}) {
    this.v = v;
    this.meId = meId;
    for (const h of v.heroes) {
      const c = newCharacter(h.cls as ClassId, h.name, 'vigil');
      const p = party[h.id];
      this.looks.set(h.id, heroLook(h.cls as ClassId, c.equip, {}, p?.body ?? 'm', p?.face));
    }
  }

  /** Takes what has just happened, once a frame before the land is drawn. */
  frame(dt: number): void {
    this.dt = dt;
    const v = this.v;
    // (when too many hit at once, only a critical hit gets a number: a wall of them would hide the fight)
    for (const p of v.pops) if (this.pops.length < 14 || (p.crit && this.pops.length < 24)) this.pops.push({ ...p, t: 0 });
    v.pops.length = 0;
    for (const f of v.falls) {
      const n = f.boss ? 60 : f.elite ? 22 : 6;
      for (let i = 0; i < n && this.bits.length < 320; i++) {
        const a = Math.random() * TAU;
        const sp = (f.boss ? 60 : 26) + Math.random() * (f.boss ? 160 : 60);
        this.bits.push({ x: f.x, y: f.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 24, t: 0, dur: 0.3 + Math.random() * 0.4, c: BITS[i % BITS.length]!, s: f.boss ? 2.4 : 1.4 });
      }
    }
    v.falls.length = 0;
  }

  /* -------------------------------------------------------------- flat on the ground */

  under(g: CanvasRenderingContext2D, time: number, view: LandView): void {
    const v = this.v;
    const art = fxArt();
    const near = (x: number, y: number, m: number): boolean => x > view.x - m && x < view.x + view.w + m && y > view.y - m && y < view.y + view.h + m;
    for (const f of v.fields) if (near(f.x, f.y, f.r + 20)) this.drawField(g, art, f, time);
    for (const h of v.heroes) if (!h.down) this.drawAuras(g, art, h, time);
    // where the blows are about to land
    for (const s of v.slams) {
      const u = s.t / s.dur;
      g.globalAlpha = 0.22 + u * 0.3;
      g.fillStyle = '#ff3a2a';
      g.beginPath();
      g.ellipse(s.x, s.y, s.r, s.r * 0.76, 0, 0, TAU);
      g.fill();
      g.globalAlpha = 1;
      ring(g, s.x, s.y, s.r, '#ff5a4a', 1.4, 1);
      ring(g, s.x, s.y, s.r * u, '#ffd257', 1.2, 0.9);
    }
    for (const f of v.foes) if (f.mode === 1 && near(f.x, f.y, 150)) this.drawChargeLine(g, f);
    for (const s of v.sparks) {
      if (!near(s.x, s.y, 10)) continue;
      const tier = SPARK_TIERS.find(([min]) => s.xp >= min)!;
      stampGlow(g, tier[1], s.x, s.y - 2 + Math.sin(time * 5 + s.x) * 0.8, tier[2]);
    }
    for (const p of v.pickups) if (near(p.x, p.y, 20)) this.drawPickup(g, art, p.kind, p.x, p.y, time);
  }

  private drawField(g: CanvasRenderingContext2D, art: FxArt | null, f: Vigil['fields'][number], time: number): void {
    const alpha = Math.min(1, f.life / 0.5, (f.max - f.life) / 0.15 + 0.2);
    g.globalAlpha = 0.26 * alpha;
    g.fillStyle = f.color;
    g.beginPath();
    g.ellipse(f.x, f.y, f.r, f.r * 0.72, 0, 0, TAU);
    g.fill();
    g.globalAlpha = 1;
    ring(g, f.x, f.y, f.r, f.color, 0.9, alpha * 0.85);
    const circle = f.el === 'fire' || f.el === 'ice' || f.el === 'arcane' ? f.el : null;
    if (!circle || !drawCircle(g, circle, f.x, f.y, f.r * 1.15, time, alpha)) {
      loop(g, art, 'rune', f.el, time, f.x, f.y, f.r * 2.5, { h: f.r * 1.6, alpha: alpha * 0.9 });
    }
    if (f.el === 'poison') loop(g, art, 'poison', 'poison', time + f.x, f.x, f.y - f.r * 0.25, f.r * 1.5, { alpha });
    if (f.el === 'fire') loop(g, art, 'fire_cast', 'fire', time + f.y, f.x, f.y - f.r * 0.1, f.r * 1.2, { alpha: alpha * 0.8 });
    if (f.spell === 'blood-banner' || f.spell === 'blessed-ground') {
      // a blade driven into the middle of it, to mark what it is
      const sp = weaponSprite('sword', f.color);
      const w = (sp.width / sp.k) * 1.4;
      const h = (sp.height / sp.k) * 1.4;
      g.globalAlpha = alpha;
      g.save();
      g.translate(f.x, f.y);
      g.rotate(Math.PI);
      g.drawImage(sp.c, -w / 2, -2, w, h);
      g.restore();
      g.globalAlpha = 1;
    }
  }

  private drawAuras(g: CanvasRenderingContext2D, art: FxArt | null, h: Hero, time: number): void {
    for (const au of this.v.auras(h)) {
      const pulse = 1 + Math.sin(time * 7) * 0.04;
      g.globalAlpha = 0.16;
      g.fillStyle = au.color;
      g.beginPath();
      g.ellipse(h.x, h.y, au.r * pulse, au.r * pulse * 0.76, 0, 0, TAU);
      g.fill();
      g.globalAlpha = 1;
      ring(g, h.x, h.y, au.r * pulse, au.color, 0.9, 0.8);
      if (au.el === 'fire') drawCircle(g, 'fire', h.x, h.y, au.r * 1.1, time, 0.8);
      else loop(g, art, 'wind', au.el, time, h.x, h.y - 3, Math.min(70, au.r * 1.8), { h: Math.min(46, au.r * 1.2), alpha: 0.6 });
      if (au.spell === 'steel-tempest') {
        // the blades themselves, flat out and pointing away from the hero
        for (let i = 0; i < 3; i++) {
          const a = time * 7 + (i / 3) * TAU;
          g.save();
          g.translate(h.x + Math.cos(a) * au.r * 0.9, h.y - 3 + Math.sin(a) * au.r * 0.68);
          g.rotate(a - Math.PI / 2);
          g.scale(1, -1);
          paintSword(g, 18);
          g.restore();
        }
      }
    }
    if (h.frenzyT > 0) {
      loop(g, art, 'buff', 'fire', time, h.x, h.y, 34, { feet: true, alpha: 0.8 });
      ring(g, h.x, h.y, 13 + Math.sin(time * 12) * 1.5, '#ff9a3d', 1.1, 0.9);
    }
  }

  private drawChargeLine(g: CanvasRenderingContext2D, f: Foe): void {
    const u = 1 - f.modeT / 0.7;
    const len = 150 * Math.min(1, u * 1.6);
    g.save();
    g.translate(f.x, f.y);
    g.rotate(Math.atan2(f.aimY, f.aimX));
    g.globalAlpha = 0.18 + u * 0.3;
    g.fillStyle = '#ff3a2a';
    g.fillRect(0, -f.r * 0.8, len, f.r * 1.6);
    g.globalAlpha = 0.85;
    g.fillStyle = '#ffd257';
    g.fillRect(len - 2, -f.r * 0.8, 2, f.r * 1.6);
    g.restore();
    g.globalAlpha = 1;
  }

  private drawPickup(g: CanvasRenderingContext2D, art: FxArt | null, kind: keyof typeof FIELD_ICONS, x: number, y: number, time: number): void {
    const bob = Math.sin(time * 4 + x) * 1.4;
    const r = kind === 'chest' ? 9 : 6.5;
    g.fillStyle = 'rgba(8,4,16,0.35)';
    g.beginPath();
    g.ellipse(x, y + 1, r * 0.9, r * 0.36, 0, 0, TAU);
    g.fill();
    stampGlow(g, kind === 'chest' ? '#ffd257' : '#ffffff', x, y - r + bob, r * 2, 0.6);
    loop(g, art, 'spell_ready', kind === 'chest' ? 'fire' : 'lightning', time, x, y - r + bob, r * 3.2, { alpha: 0.8 });
    const im = iconImage(FIELD_ICONS[kind]);
    if (im) {
      g.save();
      g.beginPath();
      g.arc(x, y - r + bob, r, 0, TAU);
      g.closePath();
      g.lineWidth = 1;
      g.strokeStyle = INK;
      g.stroke();
      g.clip();
      g.imageSmoothingEnabled = true;
      g.drawImage(im, x - r, y - r * 2 + bob, r * 2, r * 2);
      g.imageSmoothingEnabled = false;
      g.restore();
    }
  }

  /* -------------------------------------------------------------- everything standing, sorted with the trees */

  standing(add: (y: number, draw: () => void) => void, view: LandView): void {
    const v = this.v;
    const g = view.g;
    const inView = (x: number, y: number): boolean => x > view.x - 60 && x < view.x + view.w + 60 && y > view.y - 60 && y < view.y + view.h + 90;
    for (const f of v.foes) if (inView(f.x, f.y)) add(f.y, () => this.drawFoe(g, f, view.time));
    for (const p of v.pets) {
      if (!inView(p.x, p.y)) continue;
      add(p.y, () => {
        const sp = creatureSprite(p.sprite, Math.floor(p.walk * 8) % 2);
        const w = sp.width / sp.k;
        const h = sp.height / sp.k;
        g.fillStyle = 'rgba(8,4,16,0.35)';
        g.beginPath();
        g.ellipse(p.x, p.y + 1, w * 0.34, w * 0.14, 0, 0, TAU);
        g.fill();
        // a friend, not one of the Host: lit from under and looking this way
        stampGlow(g, SPELLS[p.spell]?.color ?? '#fff', p.x, p.y - h * 0.3, w * 0.75, 0.5);
        g.drawImage(Math.cos(p.face) < 0 ? sp.f : sp.c, p.x - w / 2, p.y - h + 3, w, h);
      });
    }
    for (const h of v.heroes) {
      if (h.id === this.meId || !inView(h.x, h.y)) continue;
      add(h.y + 5, () => this.drawHero(g, h, view));
    }
  }

  private drawFoe(g: CanvasRenderingContext2D, f: Foe, time: number): void {
    const frame = Math.floor(f.walk * 6 + f.id) % 2;
    const sp = creatureSprite(f.bossSprite ?? f.def.sprite, frame);
    const scale = f.boss ? 2 : f.elite ? 1.35 : 1;
    // a little bounce in its walk; a charger winding up gathers itself
    const moving = f.frozen <= 0 && f.stun <= 0;
    const bounce = moving ? Math.sin(f.walk * 13 + f.id) * 0.05 : 0;
    const gather = f.mode === 1 ? 0.14 : 0;
    const w = (sp.width / sp.k) * scale * (1 + bounce + gather);
    const h = (sp.height / sp.k) * scale * (1 - bounce - gather);
    const flip = Math.cos(f.face) < 0;
    const x = f.x;
    const y = f.y;
    g.fillStyle = 'rgba(8,4,16,0.35)';
    g.beginPath();
    g.ellipse(x, y + 1, w * 0.34, w * 0.14, 0, 0, TAU);
    g.fill();
    if (f.elite || f.boss) stampGlow(g, f.boss ? '#ff5a4a' : '#ffb02e', x, y - h * 0.4, w * 0.85, 0.55 + Math.sin(time * 6) * 0.1);
    const top = y - h + 3 * scale;
    g.drawImage(f.flash > 0 ? (flip ? sp.wf : sp.w) : flip ? sp.f : sp.c, x - w / 2, top, w, h);
    // cold shows as a pale wash and a ring of frost (a canvas filter on each of hundreds of foes would stutter)
    if (f.frozen > 0 || f.slow > 0) {
      g.globalAlpha = f.frozen > 0 ? 0.6 : 0.22;
      g.drawImage(flip ? sp.wf : sp.w, x - w / 2, top, w, h);
      g.globalAlpha = 1;
      if (f.frozen > 0) ring(g, x, y + 1, w * 0.42, '#bfeaff', 0.7, 0.9);
    }
    if (f.stun > 0) {
      // stars around its head
      g.fillStyle = '#ffe39a';
      for (let i = 0; i < 3; i++) {
        const a = time * 7 + (i / 3) * TAU;
        g.fillRect(x + Math.cos(a) * w * 0.4 - 0.7, top - 1 + Math.sin(a) * 1.6 - 0.7, 1.4, 1.4);
      }
    }
    if (f.elite && f.hp < f.maxHp) {
      const bw = w * 0.9;
      g.fillStyle = '#120a20';
      g.fillRect(x - bw / 2 - 0.5, top - 3.5, bw + 1, 2.2);
      g.fillStyle = '#ffb02e';
      g.fillRect(x - bw / 2, top - 3, bw * Math.max(0, f.hp / f.maxHp), 1.2);
    }
  }

  private drawHero(g: CanvasRenderingContext2D, h: Hero, view: LandView): void {
    const look = this.looks.get(h.id);
    if (!look) return;
    const dir: HeroDir = Math.abs(h.dirX) > Math.abs(h.dirY) ? 'side' : h.dirY < 0 ? 'up' : 'down';
    const moving = Math.hypot(h.vx, h.vy) > 4;
    const walk = (this.walkT.get(h.id) ?? 0) + (moving ? this.dt : 0);
    this.walkT.set(h.id, walk);
    const frame = moving ? (Math.floor(walk * 7) % 2) + 1 : 0;
    const s = heroSprite(look, h.down ? 'down' : dir, h.down ? 0 : frame);
    const sw = s.width / s.k;
    const sh = s.height / s.k;
    g.fillStyle = 'rgba(8,4,16,0.35)';
    g.beginPath();
    g.ellipse(h.x, h.y + 1, sw * 0.3, sw * 0.13, 0, 0, TAU);
    g.fill();
    if (h.down) {
      g.save();
      g.globalAlpha = 0.6;
      g.translate(h.x, h.y + 3);
      g.rotate(1.4);
      g.drawImage(s.c, -sw / 2, -sh + 3, sw, sh);
      g.restore();
      g.globalAlpha = 1;
      return;
    }
    const blink = h.iframe > 0 && Math.floor(view.time * 18) % 2 === 0;
    g.globalAlpha = blink ? 0.45 : 1;
    const left = dir === 'side' && h.dirX < 0;
    g.drawImage(left ? s.f : s.c, h.x - sw / 2, h.y - sh + 3, sw, sh);
    g.globalAlpha = 1;
  }

  /* -------------------------------------------------------------- in the air, over everything */

  over(g: CanvasRenderingContext2D, time: number, view: LandView): void {
    const v = this.v;
    const art = fxArt();
    const dt = this.dt;
    for (const s of v.foeShots) {
      loop(g, art, 'bolt', 'shadow', time, s.x, s.y, 16, { rot: Math.atan2(s.vy, s.vx) });
      g.beginPath();
      g.arc(s.x, s.y, s.r, 0, TAU);
      g.fillStyle = '#ff3a6a';
      g.fill();
      g.lineWidth = 0.9;
      g.strokeStyle = INK;
      g.stroke();
      g.fillStyle = '#fff';
      g.fillRect(s.x - 0.8, s.y - 1.4, 1.6, 1.6);
    }
    for (const s of v.shots) this.drawShot(g, art, s, time);
    for (const h of v.heroes) {
      if (h.down) continue;
      for (const o of v.orbitPoints(h)) this.drawOrbiter(g, art, o, time);
    }
    let hits = 0;
    let bursts = 0;
    for (const f of v.fx) {
      if (f.kind === 'hit' && ++hits > MAX_HITS) continue;
      // when dozens go off together, past the first few each is only its explosion
      if (f.kind === 'burst' && ++bursts > MAX_FULL_BURSTS) {
        play(g, art, 'fire_impact', f.el, Math.min(0.999, f.t / f.dur), f.x, f.y, Math.max(26, Math.min(60, (f.r ?? 20) * 2)));
        continue;
      }
      this.drawFx(g, art, f, time);
    }
    for (const b of this.bits) {
      b.t += dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.vy += 140 * dt;
      g.globalAlpha = Math.max(0, 1 - b.t / b.dur);
      g.fillStyle = b.c;
      g.fillRect(b.x, b.y, b.s, b.s);
    }
    for (let i = this.bits.length - 1; i >= 0; i--) if (this.bits[i]!.t >= this.bits[i]!.dur) this.bits.splice(i, 1);
    g.globalAlpha = 1;
    this.drawPeople(g, view);
    // numbers: the game's only smooth letters, so they can be read at a glance
    g.textAlign = 'center';
    g.lineJoin = 'round';
    for (const n of this.pops) {
      n.t += dt;
      const u = n.t / 0.62;
      const y = n.y - u * 14;
      const size = (n.crit ? 11 : n.big ? 9 : 6.4) * (u < 0.18 ? 1 + (0.18 - u) * 2.6 : 1);
      g.font = `800 ${size}px Georgia, serif`;
      g.globalAlpha = Math.max(0, 1 - u * u);
      g.lineWidth = 1.6;
      g.strokeStyle = INK;
      const text = n.crit ? `${n.n}!` : String(n.n);
      const x = n.x + Math.sin(n.y) * 3;
      g.strokeText(text, x, y);
      g.fillStyle = n.crit ? '#ff7a3d' : n.big ? '#ffd257' : '#fff6e0';
      g.fillText(text, x, y);
    }
    for (let i = this.pops.length - 1; i >= 0; i--) if (this.pops[i]!.t >= 0.62) this.pops.splice(i, 1);
    g.globalAlpha = 1;
    g.textAlign = 'start';
  }

  private drawShot(g: CanvasRenderingContext2D, art: FxArt | null, s: Vigil['shots'][number], time: number): void {
    const a = Math.atan2(s.vy, s.vx);
    if (s.back) {
      // a thrown axe or hammer, turning end over end, with the ghosts of where it just was
      const kind = SPELLS[s.spell]?.weapon ?? 'axe';
      const sp = weaponSprite(kind, kind === 'hammer' ? s.color : undefined);
      const k = (s.r * 2.8) / Math.max(sp.width, sp.height) * sp.k;
      const w = (sp.width / sp.k) * k;
      const h = (sp.height / sp.k) * k;
      for (let i = 2; i >= 0; i--) {
        g.save();
        g.globalAlpha = i === 0 ? 1 : 0.28 / i;
        g.translate(s.x - s.vx * 0.025 * i, s.y - s.vy * 0.025 * i);
        g.rotate(s.spin - i * 0.45);
        g.drawImage(sp.c, -w / 2, -h / 2, w, h);
        g.restore();
      }
      g.globalAlpha = 1;
      return;
    }
    const size = Math.max(20, s.r * 6.5);
    stampGlow(g, s.color, s.x, s.y, s.r * 2.4, 0.7);
    // (the sheet's head sits right of center: it goes on the shot)
    loop(g, art, 'bolt', s.el, time, s.x, s.y, size, { rot: a, ahead: size * 0.25 });
  }

  private drawOrbiter(g: CanvasRenderingContext2D, art: FxArt | null, o: { x: number; y: number; r: number; color: string; spell: string; el: Element }, time: number): void {
    if (o.spell === 'hawk-wheel') {
      const sp = creatureSprite('griffon', Math.floor(time * 8) % 2);
      const k = (o.r * 2.6) / (sp.width / sp.k);
      const w = (sp.width / sp.k) * k;
      const h = (sp.height / sp.k) * k;
      stampGlow(g, o.color, o.x, o.y, o.r * 1.6, 0.45);
      g.drawImage(sp.c, o.x - w / 2, o.y - h / 2, w, h);
      return;
    }
    stampGlow(g, o.color, o.x, o.y, o.r * 1.5, 0.75);
    loop(g, art, o.spell === 'halo-ring' ? 'enchant' : 'spell_ready', o.spell === 'halo-ring' ? 'fire' : o.el, time + o.x * 0.01, o.x, o.y, o.r * 3.4);
  }

  private drawFx(g: CanvasRenderingContext2D, art: FxArt | null, f: Fx, time: number): void {
    const u = Math.min(0.999, f.t / f.dur);
    const r = f.r ?? 20;
    switch (f.kind) {
      case 'hit':
        play(g, art, 'impact', f.el, u, f.x, f.y, Math.max(18, r * 2.4));
        break;
      case 'burst':
        stampGlow(g, f.color, f.x, f.y, r * 1.2, (1 - u) * 0.5);
        ring(g, f.x, f.y, r * (0.3 + easeOut(u) * 0.7), f.color, 2 - u * 1.4, 1 - u);
        this.drawBlast(g, art, f.el, u, f.x, f.y - r * 0.15, r);
        break;
      case 'nova':
        this.drawNova(g, art, f, u, r);
        break;
      case 'chain':
        this.drawChain(g, art, f, u, time);
        break;
      case 'strike':
        this.drawStrike(g, art, f, r);
        break;
      case 'drop':
        this.drawDrop(g, art, f, r);
        break;
      case 'cone':
        this.drawCone(g, f, u, r);
        break;
      case 'beam':
        this.drawBeam(g, art, f, u);
        break;
      case 'heal':
        play(g, art, 'heal', f.el === 'holy' ? 'nature' : f.el, u, f.x, f.y, 34, { feet: true });
        break;
      case 'guard':
        play(g, art, 'shield_up', f.el, Math.min(0.99, f.t / 0.5), f.x, f.y - 6, 40);
        if (f.t > 0.5) loop(g, art, 'shield_up', f.el, time, f.x, f.y - 6, 40, { alpha: 0.35 });
        break;
      case 'cast':
        play(g, art, 'cast', f.el, u, f.x, f.y, 34, { feet: true });
        break;
      case 'dash':
        play(g, art, 'wind', f.el, u, f.x, f.y - 5, 36, { rot: f.a });
        break;
      case 'level':
        play(g, art, 'summon', f.el, u, f.x, f.y, 60, { feet: true });
        ring(g, f.x, f.y, 10 + easeOut(u) * 60, '#ffe39a', 2.2 - u * 1.6, 1 - u);
        ring(g, f.x, f.y, 6 + easeOut(u) * 38, '#8fd8ff', 1.6 - u, 1 - u);
        break;
      case 'frenzy':
        play(g, art, 'buff', f.el, u, f.x, f.y, 60, { feet: true });
        ring(g, f.x, f.y, r * easeOut(u), '#ff9a3d', 2.4 - u * 1.8, 1 - u);
        break;
      case 'summon':
        play(g, art, 'summon', f.el, u, f.x, f.y, 44, { feet: true });
        break;
      case 'slam':
        ring(g, f.x, f.y, r * (0.5 + easeOut(u) * 0.5), '#ff6a4a', 3 - u * 2.4, 1 - u);
        play(g, art, 'shield_break', 'shadow', u, f.x, f.y - r * 0.2, r * 2);
        break;
      case 'bomb':
        stampGlow(g, f.color, f.x, f.y, r, (1 - u) * 0.6);
        ring(g, f.x, f.y, r * easeOut(u), f.color, 4 - u * 3, 1 - u);
        this.drawBlast(g, art, f.el, u, f.x, f.y - 10, 60);
        break;
    }
  }

  /**
   * An explosion that fits its radius. The pack's frames are 64 pixels: blown up past about 90 they turn to blocks and
   * hide the fight, so a bigger blast is a cluster of them going off one after the other.
   */
  private drawBlast(g: CanvasRenderingContext2D, art: FxArt | null, el: Element, u: number, x: number, y: number, r: number): void {
    play(g, art, 'fire_impact', el, u, x, y, Math.max(26, Math.min(90, r * 2.4)));
    if (r < 36) return;
    const n = Math.min(6, Math.round(r / 12));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + x;
      play(g, art, 'fire_impact', el, u * 1.5 - 0.3 - (i % 2) * 0.1, x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.46, 46);
    }
  }

  /** A wave rolling out from the hero: a bold ring with bursts of the pack's color riding on it, the ground showing through. */
  private drawNova(g: CanvasRenderingContext2D, art: FxArt | null, f: Fx, u: number, r: number): void {
    const R = r * (0.18 + easeOut(u) * 0.82);
    g.globalAlpha = (1 - u) * 0.2;
    g.fillStyle = f.color;
    g.beginPath();
    g.ellipse(f.x, f.y, R, R * 0.76, 0, 0, TAU);
    g.fill();
    g.globalAlpha = 1;
    ring(g, f.x, f.y, R, f.color, 3.2 - u * 2.4, 1 - u * u);
    ring(g, f.x, f.y, R * 0.8, f.color, 1, (1 - u) * 0.6);
    const n = Math.max(6, Math.min(14, Math.round(r / 9)));
    const effect = f.freeze ? 'ice_shatter' : 'impact';
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + f.x;
      play(g, art, effect, f.freeze ? 'ice' : f.el, u, f.x + Math.cos(a) * R, f.y + Math.sin(a) * R * 0.76, 26);
    }
    play(g, art, 'arcane_blast', f.el, Math.min(0.99, u * 1.5), f.x, f.y - 4, Math.min(r, 50), { alpha: 0.7 });
  }

  private drawChain(g: CanvasRenderingContext2D, art: FxArt | null, f: Fx, u: number, time: number): void {
    const pts = f.pts ?? [];
    const seed = Math.floor(time * 30);
    const path = (): void => {
      g.beginPath();
      pts.forEach(([x, y], i) => {
        if (i === 0) {
          g.moveTo(x, y);
          return;
        }
        const [px, py] = pts[i - 1]!;
        // it never takes the straight way there
        for (let j = 1; j <= 3; j++) {
          const q = j / 4;
          const off = shake(seed + i * 7 + j) * 10;
          g.lineTo(px + (x - px) * q + off, py + (y - py) * q + shake(seed + i * 3 + j * 5) * 10);
        }
        g.lineTo(x, y);
      });
    };
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.globalAlpha = 1 - u * u;
    path();
    g.lineWidth = 3.4;
    g.strokeStyle = INK;
    g.stroke();
    g.lineWidth = 2.2;
    g.strokeStyle = f.color;
    g.stroke();
    g.lineWidth = 0.9;
    g.strokeStyle = '#ffffff';
    g.stroke();
    g.globalAlpha = 1;
    g.lineCap = 'butt';
    for (let i = 1; i < pts.length; i++) play(g, art, 'impact', f.el, u, pts[i]![0], pts[i]![1], 24);
  }

  private drawStrike(g: CanvasRenderingContext2D, art: FxArt | null, f: Fx, r: number): void {
    const at = f.at ?? 0.3;
    const look = f.look ?? 'star';
    if (f.t < at) {
      const fall = f.t / at;
      // the mark on the ground, closing in on where it lands
      mark(g, f.x, f.y, r * (1.3 - fall * 0.3), f.color, 0.4 + fall * 0.6);
      if (look === 'star' || look === 'lightning') {
        const sx = f.x + 70 * (1 - fall);
        const sy = f.y - 190 * (1 - fall);
        stampGlow(g, f.color, sx, sy, 16, 0.7);
        const size = Math.max(40, r * 1.5);
        loop(g, art, 'bolt', f.el, f.t, sx, sy, size, { rot: Math.atan2(190, -70), ahead: size * 0.25 });
      } else if (look === 'column') {
        play(g, art, 'teleport', f.el, fall * 0.5, f.x, f.y, Math.min(70, r * 1.6), { feet: true, h: Math.min(130, r * 3.4) });
      } else if (look === 'portal') {
        play(g, art, 'portal', f.el, fall, f.x, f.y, Math.min(90, r * 2.2), { h: Math.min(62, r * 1.5) });
      } else if (look === 'blade') {
        this.drawBlade(g, f, r, f.y - 180 * (1 - fall), 1);
      }
      return;
    }
    const u = (f.t - at) / (f.dur - at);
    ring(g, f.x, f.y, r * (0.3 + easeOut(u) * 0.8), f.color, 3 - u * 2.4, 1 - u);
    stampGlow(g, f.color, f.x, f.y - r * 0.2, r * 1.3, (1 - u) * 0.55);
    if (look === 'column') play(g, art, 'teleport', f.el, 0.5 + u * 0.5, f.x, f.y, Math.min(70, r * 1.6), { feet: true, h: Math.min(130, r * 3.4) });
    else if (look === 'portal') play(g, art, 'arcane_blast', f.el, u, f.x, f.y, Math.min(90, r * 2.2), { h: Math.min(72, r * 1.8) });
    else if (look === 'blade') this.drawBlade(g, f, r, f.y, 1 - u);
    this.drawBlast(g, art, f.el, u, f.x, f.y - r * 0.2, r);
  }

  /** The giant's sword, point down, its tip at (x, y). */
  private drawBlade(g: CanvasRenderingContext2D, f: Fx, r: number, y: number, alpha: number): void {
    g.save();
    g.globalAlpha = Math.max(0, alpha);
    g.translate(f.x, y);
    paintSword(g, Math.max(44, Math.min(84, r * 1.5)));
    g.restore();
    g.globalAlpha = 1;
  }

  private drawDrop(g: CanvasRenderingContext2D, art: FxArt | null, f: Fx, r: number): void {
    const at = f.at ?? 0.18;
    const moon = f.el === 'water';
    if (f.t < at) {
      const fall = f.t / at;
      mark(g, f.x, f.y, r, f.color, fall * 0.8);
      if (moon) return;
      loop(g, art, 'bolt', f.el, f.t, f.x, f.y - 130 * (1 - fall), 24, { rot: Math.PI / 2, ahead: 6 });
      return;
    }
    const u = (f.t - at) / (f.dur - at);
    ring(g, f.x, f.y, r * (0.4 + easeOut(u) * 0.7), f.color, 1.6 - u * 1.2, 1 - u);
    if (moon) play(g, art, 'teleport', f.el, u, f.x, f.y, r * 1.8, { feet: true, h: r * 4 });
    else if (f.el === 'poison') play(g, art, 'poison', f.el, u, f.x, f.y - r * 0.2, r * 2.2);
    else play(g, art, 'impact', f.el, u, f.x, f.y, r * 2.4);
  }

  /** A blade's sweep: a thick crescent that opens across the arc, with a bright edge and an inked outline. */
  private drawCone(g: CanvasRenderingContext2D, f: Fx, u: number, r: number): void {
    const arc = f.arc ?? 1.9;
    const from = (f.a ?? 0) - arc / 2;
    const to = from + arc * Math.min(1, u * 3);
    const R = r * (0.8 + 0.2 * Math.min(1, u * 2));
    g.globalAlpha = u < 0.5 ? 1 : 1 - (u - 0.5) / 0.5;
    crescent(g, f.x, f.y, R, R * (0.5 + u * 0.3), from, to);
    g.fillStyle = f.color;
    g.fill();
    g.lineWidth = 1;
    g.strokeStyle = INK;
    g.stroke();
    crescent(g, f.x, f.y, R * 0.97, R * (0.78 + u * 0.1), from, to);
    g.fillStyle = '#ffffff';
    g.fill();
    g.globalAlpha = 1;
  }

  private drawBeam(g: CanvasRenderingContext2D, art: FxArt | null, f: Fx, u: number): void {
    const a = f.a ?? 0;
    const len = f.len ?? 200;
    const w = (f.w ?? 8) * (1 - u * 0.7);
    const ex = f.x + Math.cos(a) * len;
    const ey = f.y + Math.sin(a) * len;
    g.lineCap = 'round';
    g.globalAlpha = u < 0.6 ? 1 : 1 - (u - 0.6) / 0.4;
    const line = (width: number, color: string): void => {
      g.beginPath();
      g.moveTo(f.x, f.y);
      g.lineTo(ex, ey);
      g.lineWidth = width;
      g.strokeStyle = color;
      g.stroke();
    };
    line(w * 1.4 + 1.6, INK);
    line(w * 1.4, f.color);
    line(w * 0.6, '#ffffff');
    g.globalAlpha = 1;
    g.lineCap = 'butt';
    // sparks of the pack's color all along it
    for (let i = 1; i <= 6; i++) {
      const q = i / 7;
      play(g, art, 'impact', f.el, u * 1.3 - q * 0.3, f.x + (ex - f.x) * q, f.y + (ey - f.y) * q, 24);
    }
    play(g, art, 'cast', f.el, u, f.x, f.y, 26);
    play(g, art, 'impact', f.el, u, ex, ey, 34);
  }

  /** Everyone's health, names and, for whoever is out of sight, which way they are. */
  private drawPeople(g: CanvasRenderingContext2D, view: LandView): void {
    const v = this.v;
    for (const h of v.heroes) {
      const mine = h.id === this.meId;
      const color = CLASSES[h.cls as ClassId].colors.accent;
      if (h.down) {
        ring(g, h.x, h.y, REVIVE_DRAW, '#ffe39a', 0.8, 0.6 + Math.sin(view.time * 6) * 0.3);
        if (h.reviveT > 0) {
          g.beginPath();
          g.arc(h.x, h.y - 14, 5, -Math.PI / 2, -Math.PI / 2 + (h.reviveT / 3) * TAU);
          g.lineWidth = 2;
          g.strokeStyle = '#7fe06a';
          g.stroke();
        }
      } else {
        const max = v.maxHpOf(h);
        const bw = 26;
        g.fillStyle = '#120a20';
        g.fillRect(h.x - bw / 2 - 0.5, h.y + 8.5, bw + 1, 3);
        g.fillStyle = h.hp / max < 0.3 ? '#ff4f6a' : mine ? '#7fe06a' : '#6ac8ff';
        g.fillRect(h.x - bw / 2, h.y + 9, bw * Math.max(0, Math.min(1, h.hp / max)), 2);
      }
      if (mine) continue;
      g.textAlign = 'center';
      g.font = '700 5.5px Georgia, serif';
      g.lineWidth = 1.2;
      g.strokeStyle = INK;
      g.strokeText(h.name, h.x, h.y - 19);
      g.fillStyle = color;
      g.fillText(h.name, h.x, h.y - 19);
      g.textAlign = 'start';
      // out of sight: an arrow at the edge of the view
      const m = 10;
      const inside = h.x > view.x + m && h.x < view.x + view.w - m && h.y > view.y + m && h.y < view.y + view.h - m;
      if (inside) continue;
      const cx = view.x + view.w / 2;
      const cy = view.y + view.h / 2;
      const a = Math.atan2(h.y - cy, h.x - cx);
      const k = Math.min((view.w / 2 - m) / Math.max(0.001, Math.abs(Math.cos(a))), (view.h / 2 - m) / Math.max(0.001, Math.abs(Math.sin(a))));
      g.save();
      g.translate(cx + Math.cos(a) * k, cy + Math.sin(a) * k);
      g.rotate(a);
      g.beginPath();
      g.moveTo(6, 0);
      g.lineTo(-4, -4.5);
      g.lineTo(-4, 4.5);
      g.closePath();
      g.fillStyle = h.down ? '#ff4f6a' : color;
      g.fill();
      g.lineWidth = 1;
      g.strokeStyle = INK;
      g.stroke();
      g.restore();
    }
  }
}

/** The ring around a downed friend: stand in it to get them up (sim.ts's reach). */
const REVIVE_DRAW = 30;
