import { clamp, damp, dist, hash2, TAU } from '../core/math';
import type { ClassId } from '../data/types';
import { bossHidden } from '../sim/boss';
import { hasStatus } from '../sim/combat';
import { K, TILE } from '../sim/map';
import type { Enemy, Fx, Projectile, Telegraph } from '../sim/types';
import type { World } from '../sim/world';
import { itemTint } from '../progress/items';
import { canvas, ctx2d, pixelText, rgba, type Cnv } from './pixel';
import { creatureSprite, glowDisc, heldWeapon, heroSprite, recolored, weaponSprite, type HeroDir } from './sprites';
import { buildScenery, type Scenery } from './tiles';

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

const PROJECTILE_COLORS: Record<string, [string, string]> = {
  'arcane-bolt': ['#d2a8ff', '#ffffff'],
  lightning: ['#9ad8ff', '#ffffff'],
  fireball: ['#ff7a3d', '#ffe07a'],
  ember: ['#ff9a4d', '#ffe07a'],
  spark: ['#bfe9ff', '#ffffff'],
  shard: ['#bdf1ff', '#ffffff'],
  needle: ['#8be36b', '#e8ffd8'],
  quake: ['#c9a06a', '#f2dcb0'],
};

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  /** View size in art pixels. */
  vw = 320;
  vh = 180;
  /** Device pixels per art pixel. */
  scale = 4;
  camX = 0;
  camY = 0;
  private scenery: Scenery | null = null;
  private sceneryFor: World | null = null;
  private light: Cnv;
  private lg: CanvasRenderingContext2D;
  aim: AimPreview | null = null;
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
   * Fits the view to the element: an integer number of device pixels per art pixel, chosen so the
   * view is about 200 art pixels tall on phones (bigger sprites) and 240 on desktops.
   */
  resize(cssW: number, cssH: number, dpr: number, touch: boolean): void {
    const devW = Math.max(1, Math.round(cssW * dpr));
    const devH = Math.max(1, Math.round(cssH * dpr));
    const target = touch ? 196 : 236;
    const shortSide = Math.min(devW, devH);
    const landscape = devW >= devH;
    let s = Math.max(1, Math.round((landscape ? devH : devW * 1.25) / target));
    if (shortSide / s < 150) s = Math.max(1, Math.floor(shortSide / 150));
    this.scale = s;
    this.vw = Math.ceil(devW / s);
    this.vh = Math.ceil(devH / s);
    if (this.canvas.width !== this.vw || this.canvas.height !== this.vh) {
      this.canvas.width = this.vw;
      this.canvas.height = this.vh;
      this.g = ctx2d(this.canvas);
    }
    // the canvas is shown a touch larger than the element when the division isn't exact
    this.canvas.style.width = `${(this.vw * s) / dpr}px`;
    this.canvas.style.height = `${(this.vh * s) / dpr}px`;
    if (this.light.width !== this.vw || this.light.height !== this.vh) {
      this.light.width = this.vw;
      this.light.height = this.vh;
      this.lg = ctx2d(this.light);
    }
  }

  /** Screen (CSS px relative to the canvas) to world coordinates. */
  toWorld(cx: number, cy: number, dpr: number): { x: number; y: number } {
    return { x: this.camX + (cx * dpr) / this.scale, y: this.camY + (cy * dpr) / this.scale };
  }

  setHeroWeapon(cls: ClassId, w: World): void {
    this.weapon = heldWeapon(cls, w.hero.equip.weapon);
  }

  /** Puts the camera on the hero at once (after loading a region or respawning). */
  snap(w: World): void {
    const m = w.map;
    this.camX = clamp(w.player.x - this.vw / 2, 0, Math.max(0, m.w * TILE - this.vw));
    this.camY = clamp(w.player.y - this.vh / 2 - 8, 0, Math.max(0, m.h * TILE - this.vh));
  }

  draw(w: World, dt: number, time: number): void {
    if (this.sceneryFor !== w) {
      this.scenery = buildScenery(w.map, w.region);
      this.sceneryFor = w;
      this.setHeroWeapon(w.hero.cls, w);
      this.snap(w);
    }
    const sc = this.scenery!;
    const g = this.g;
    const p = w.player;
    // camera: follows the hero, leaning a little toward where they aim
    const mapW = w.map.w * TILE;
    const mapH = w.map.h * TILE;
    const lead = p.dead ? 0 : 14;
    let tx = p.x + Math.cos(p.aim) * lead - this.vw / 2;
    let ty = p.y + Math.sin(p.aim) * lead * 0.7 - this.vh / 2 - 8;
    const boss = w.boss();
    if (boss && !boss.dead) {
      // keep some of the boss in view
      tx = tx * 0.8 + (boss.x - this.vw / 2) * 0.2;
      ty = ty * 0.8 + (boss.y - this.vh / 2) * 0.2;
    }
    tx = mapW <= this.vw ? (mapW - this.vw) / 2 : clamp(tx, 0, mapW - this.vw);
    ty = mapH <= this.vh ? (mapH - this.vh) / 2 : clamp(ty, 0, mapH - this.vh);
    this.camX = damp(this.camX, tx, 7, dt);
    this.camY = damp(this.camY, ty, 7, dt);
    const shake = this.reducedMotion ? 0 : w.shakeAmt;
    const ox = Math.round(this.camX + (shake ? (Math.random() - 0.5) * shake : 0));
    const oy = Math.round(this.camY + (shake ? (Math.random() - 0.5) * shake : 0));

    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = sc.theme === 'crypt' ? '#0e0c18' : sc.theme === 'forest' ? '#123a22' : '#1f5a2a';
    g.fillRect(0, 0, this.vw, this.vh);
    g.drawImage(sc.ground, ox, oy, this.vw, this.vh, 0, 0, this.vw, this.vh);
    g.translate(-ox, -oy);

    this.drawLiveGround(w, sc, time, ox, oy);
    for (const f of w.fields) this.drawField(f, time);
    for (const t of w.telegraphs) this.drawTelegraph(t);
    for (const wv of w.waves) this.drawWave(wv);
    this.drawEnemyWarnings(w);
    for (const tr of w.traps) this.drawTrap(tr.x, tr.y, tr.arm > 0, time);
    this.drawAim(w);
    this.drawRings(w);

    // everything standing, sorted by depth
    const items: { y: number; draw: () => void }[] = [];
    const inView = (x: number, y: number, m = 40): boolean => x > ox - m && x < ox + this.vw + m && y > oy - m && y < oy + this.vh + 60;
    for (const o of sc.objects) {
      if (!inView(o.x, o.y, 70)) continue;
      items.push({
        y: o.y,
        draw: () => {
          const behind = o.fade && !p.dead && p.y < o.y && p.y > o.y + o.dy + 4 && Math.abs(p.x - o.x) < o.c.width / 2 - 2;
          if (behind) g.globalAlpha = 0.55;
          g.drawImage(o.c, Math.round(o.x + o.dx), Math.round(o.y + o.dy));
          g.globalAlpha = 1;
        },
      });
    }
    for (const c of w.chests) if (inView(c.x, c.y)) items.push({ y: c.y + 4, draw: () => this.drawChest(c.x, c.y, c.open, c.tier, time) });
    for (const s of w.spores) if (inView(s.x, s.y)) items.push({ y: s.y + 3, draw: () => this.drawSpore(s.x, s.y, s.ripe, s.fuse, time) });
    for (const n of w.npcs) if (inView(n.x, n.y)) items.push({ y: n.y + 6, draw: () => this.drawNpc(w, n.id, n.x, n.y, n.face, n.bob) });
    for (const c of w.chickens) if (inView(c.x, c.y)) items.push({ y: c.y, draw: () => this.drawChicken(c.x, c.y, c.face, time) });
    for (const d of w.drops) if (inView(d.x, d.y)) items.push({ y: d.y, draw: () => this.drawDrop(d.kind, d.x, d.y, d.z, d.item?.r, time, d.t) });
    for (const e of w.enemies) if (inView(e.x, e.y)) items.push({ y: e.y + e.r * 0.6, draw: () => this.drawEnemy(e, time) });
    items.push({ y: p.y + 5, draw: () => this.drawHero(w, time) });
    this.drawDoors(w, items);
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.draw();

    for (const pr of w.projectiles) this.drawProjectile(pr, time);
    for (const f of w.fx) this.drawFx(f, w);
    if (w.portal) this.drawPortal(w.portal.x, w.portal.y, time);

    // the crypt is dark: light comes from the hero, torches and spells
    if (w.region.dark) this.drawLighting(w, sc, ox, oy, time);
    else if (sc.theme === 'forest') this.drawCanopyShade(ox, oy, time);

    // collapse ring (Morgrave's last phase)
    const bz = w.boss();
    if (bz?.boss && bz.boss.collapse > 0) this.drawCollapse(bz.boss.cx, bz.boss.cy, bz.boss.collapse, time);

    for (const e of w.enemies) if (inView(e.x, e.y)) this.drawEnemyBar(e, w);
    for (const t of w.texts) {
      const img = pixelText(t.text, t.color);
      const a = clamp(1.6 - t.t / (t.big ? 0.75 : 0.55), 0, 1);
      g.globalAlpha = a;
      const k = t.big && t.t < 0.12 ? 2 : 1;
      g.drawImage(img, Math.round(t.x - (img.width * k) / 2), Math.round(t.y - (img.height * k) / 2), img.width * k, img.height * k);
      g.globalAlpha = 1;
    }
    this.drawInteractMarker(w, time);
    this.drawObjectiveArrow(w, ox, oy, time);
    g.setTransform(1, 0, 0, 1, 0, 0);
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
    g.fillStyle = 'rgba(220,240,255,0.75)';
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const i = ty * m.w + tx;
        const k = m.kind[i];
        if (k === K.Water) {
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
    const color = f.look === 'fire' ? '#ff7a3d' : f.look === 'poison' ? '#8be36b' : f.look === 'frost' ? '#9be7ff' : f.look === 'arrows' ? '#f5e6c8' : f.look === 'lightning' ? '#9ad8ff' : '#ff3fd2';
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
      g.fillRect(Math.round(f.x + Math.cos(a) * r), Math.round(f.y + Math.sin(a) * r * 0.75 - ph * 6), 1, f.look === 'fire' ? 2 : 1);
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
    if (p.dead) {
      const s = heroSprite(cls, 'down', 0);
      g.save();
      g.globalAlpha = clamp(1 - p.deadT * 0.5, 0.3, 1);
      g.translate(Math.round(p.x), Math.round(p.y + 4));
      g.rotate(Math.min(1.4, p.deadT * 3));
      g.drawImage(s.c, -s.width / 2, -s.height + 2);
      g.restore();
      return;
    }
    const dir: HeroDir = p.dir === 0 ? 'down' : p.dir === 3 ? 'up' : 'side';
    const flip = p.dir === 1;
    const moving = Math.hypot(p.vx, p.vy) > 10;
    const frame = moving ? (Math.floor(p.walkT * 7) % 2) + 1 : 0;
    const s = heroSprite(cls, dir, frame);
    const bob = moving ? (Math.floor(p.walkT * 7) % 2 === 0 ? 0 : -1) : Math.sin(time * 2.5) > 0.6 ? -1 : 0;
    const x = Math.round(p.x - s.width / 2);
    const y = Math.round(p.y + 6 - s.height + bob);
    const blink = p.iframe > 0 && !p.dash && Math.floor(time * 20) % 2 === 0;
    // the held weapon behind the body when facing up or away from the aim
    const wpn = weaponSprite(this.weapon.kind, this.weapon.tint);
    const weaponBehind = p.dir === 3 || (p.dir === 1 && Math.cos(p.aim) > 0) || (p.dir === 2 && Math.cos(p.aim) < 0);
    if (weaponBehind) this.drawWeapon(w, wpn, time);
    if (cls === 'warrior' && p.dir !== 3) this.drawShield(w, p.dir, x, y);
    g.globalAlpha = blink ? 0.45 : 1;
    g.drawImage(p.flash > 0 ? (flip ? s.wf : s.w) : flip ? s.f : s.c, x, y);
    g.globalAlpha = 1;
    if (!weaponBehind) this.drawWeapon(w, wpn, time);
    if (cls === 'warrior' && p.dir === 3) this.drawShield(w, p.dir, x, y);
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
    if (hasStatus(p, 'stun')) this.drawStars(p.x, p.y - 18, time);
  }

  private drawShield(w: World, dir: number, x: number, y: number): void {
    const off = w.hero.equip.offhand;
    const s = weaponSprite('shield', off ? itemTint(off) : undefined);
    const sx = dir === 1 ? x + 10 : dir === 2 ? x - 1 : dir === 0 ? x + 1 : x + 9;
    this.g.drawImage(s.c, sx, y + 11);
  }

  private drawWeapon(w: World, wpn: { c: Cnv; f: Cnv; width: number; height: number }, time: number): void {
    const g = this.g;
    const p = w.player;
    const kind = this.weapon.kind;
    let angle = p.aim;
    let reach = 5;
    if (p.actKind === 'swing' || p.actKind === 'heavy') {
      // sweep the arc while the swing plays
      const total = p.actKind === 'heavy' ? 0.28 : 0.2;
      const k = clamp(1 - p.actT / total, 0, 1);
      const arc = p.actKind === 'heavy' ? 1.6 : p.actBig ? 2.6 : 2;
      angle = p.actAngle - arc / 2 + arc * k;
      reach = 7;
    } else if (p.actKind === 'spin') angle = time * 18;
    else if (p.actKind === null && Math.hypot(p.vx, p.vy) < 10 && w.input.aim === null) angle = p.dir === 1 ? Math.PI * 0.75 : p.dir === 3 ? -Math.PI / 2 : Math.PI * 0.25;
    const hx = p.x + Math.cos(angle) * reach;
    const hy = p.y - 3 + Math.sin(angle) * reach * 0.8;
    g.save();
    g.translate(Math.round(hx), Math.round(hy));
    // art points up: rotate so its top points along the angle
    g.rotate(angle + Math.PI / 2);
    if (kind === 'bow') g.drawImage(wpn.c, -wpn.width / 2, -wpn.height / 2);
    else g.drawImage(wpn.c, -wpn.width / 2, -wpn.height + 3);
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
    const sprite = e.boss?.def.id === 'grimtusk' ? recolored('grimtusk', frame, {}, 'grimtusk') : creatureSprite(e.def.sprite, frame);
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
    const dw = Math.round(sprite.width * scale * sx);
    const dh = Math.round(sprite.height * scale * sy);
    const floatY = e.def.ai === 'caster' || e.boss?.def.floats ? Math.round(Math.sin(time * 3 + e.id) * 2) - 3 : 0;
    const x = Math.round(e.x - dw / 2);
    const y = Math.round(e.y + e.r * 0.8 - dh + floatY);
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
    const sprite = creatureSprite(npcSprite(id), 0);
    const b = Math.sin(bob * 2) > 0.7 ? -1 : 0;
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.beginPath();
    g.ellipse(x, y + 6, 6, 2.5, 0, 0, TAU);
    g.fill();
    g.drawImage(face < 0 ? sprite.f : sprite.c, Math.round(x - sprite.width / 2), Math.round(y + 7 - sprite.height + b));
    // a "!" over NPCs with something new to say
    if (npcHasNews(w, id)) {
      const img = pixelText('!', '#ffe066');
      g.drawImage(img, Math.round(x - img.width / 2), Math.round(y + 2 - sprite.height + Math.sin(bob * 3) * 1.5) - 4);
    }
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
    const X = Math.round(x - 7);
    const Y = Math.round(y - 6);
    const trim = tier === 'epic' ? '#c58cff' : tier === 'rare' ? '#5ab0ff' : '#ffcf5a';
    if (!open && tier !== 'common') {
      g.globalAlpha = 0.35 + Math.sin(time * 3) * 0.15;
      g.drawImage(glowDisc(trim, 12), x - 12, y - 14);
      g.globalAlpha = 1;
    }
    g.fillStyle = '#1b1428';
    g.fillRect(X - 1, Y - 1, 16, 13);
    g.fillStyle = '#8a5a34';
    g.fillRect(X, Y + 4, 14, 7);
    g.fillStyle = open ? '#2a1a14' : '#a8703f';
    g.fillRect(X, Y, 14, 4);
    if (open) {
      g.fillStyle = '#6a4424';
      g.fillRect(X, Y - 4, 14, 4);
      g.fillStyle = '#1b1428';
      g.fillRect(X - 1, Y - 5, 16, 1);
    }
    g.fillStyle = trim;
    g.fillRect(X, Y + 4, 14, 1);
    g.fillRect(X + 6, Y + 3, 2, 3);
    g.fillRect(X, Y, 1, 11);
    g.fillRect(X + 13, Y, 1, 11);
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

  private drawDrop(kind: string, x: number, y: number, z: number, rarity: string | undefined, time: number, age: number): void {
    const g = this.g;
    const X = Math.round(x);
    const Y = Math.round(y - z);
    if (kind === 'gold') {
      g.fillStyle = '#1b1428';
      g.fillRect(X - 2, Y - 3, 5, 5);
      g.fillStyle = Math.floor(time * 6 + x) % 4 === 0 ? '#fff2b0' : '#ffcf5a';
      g.fillRect(X - 1, Y - 2, 3, 3);
      return;
    }
    if (kind === 'orb') {
      g.drawImage(glowDisc('rgba(255,90,122,0.8)', 6), X - 6, Y - 9);
      g.fillStyle = '#ff5a7a';
      g.fillRect(X - 2, Y - 5, 4, 4);
      g.fillStyle = '#ffd0da';
      g.fillRect(X - 1, Y - 4, 1, 1);
      return;
    }
    if (kind === 'shard') {
      g.drawImage(glowDisc('rgba(255,63,210,0.8)', 8), X - 8, Y - 12);
      g.fillStyle = '#1b1428';
      g.fillRect(X - 2, Y - 8, 5, 8);
      g.fillStyle = '#ff3fd2';
      g.fillRect(X - 1, Y - 7, 3, 6);
      g.fillStyle = '#22e4ff';
      g.fillRect(X, Y - 6, 1, 3);
      return;
    }
    // items: a bag with a beam in the rarity's color
    const color = rarityColor(rarity);
    if (rarity === 'rare' || rarity === 'epic' || rarity === 'legendary') {
      const h = rarity === 'legendary' ? 60 : rarity === 'epic' ? 44 : 28;
      const grd = g.createLinearGradient(0, Y - h, 0, Y);
      grd.addColorStop(0, rgba(color, 0));
      grd.addColorStop(1, rgba(color, 0.55 + Math.sin(time * 4) * 0.15));
      g.fillStyle = grd;
      g.fillRect(X - 2, Y - h, 4, h);
    }
    const bounce = age < 0.6 ? 0 : Math.round(Math.sin(time * 4) * 1);
    g.fillStyle = '#1b1428';
    g.fillRect(X - 4, Y - 8 + bounce, 9, 9);
    g.fillStyle = '#a8784a';
    g.fillRect(X - 3, Y - 6 + bounce, 7, 6);
    g.fillStyle = color;
    g.fillRect(X - 3, Y - 7 + bounce, 7, 2);
    g.fillRect(X - 1, Y - 4 + bounce, 3, 2);
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
    const [c1, c2] = PROJECTILE_COLORS[look] ?? (pr.type === 'fire' ? PROJECTILE_COLORS.fireball! : pr.type === 'lightning' ? PROJECTILE_COLORS.lightning! : pr.type === 'poison' ? PROJECTILE_COLORS.needle! : pr.type === 'frost' ? PROJECTILE_COLORS.shard! : ['#e8e0c8', '#ffffff']);
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
    // bolts, fireballs, embers: a glowing core with a short tail
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
    if (look === 'lightning' || look === 'spark') {
      g.fillStyle = '#ffffff';
      g.fillRect(x + Math.round(Math.random() * 4 - 2), y + Math.round(Math.random() * 4 - 2), 1, 1);
    }
  }

  private drawFx(f: Fx, w: World): void {
    const g = this.g;
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
      case 'smoke':
      case 'leaf':
        g.fillStyle = f.color;
        g.globalAlpha = f.kind === 'leaf' ? clamp(1 - k * 1.2, 0, 0.9) : clamp(0.6 - k * 0.6, 0, 1);
        g.fillRect(x, y, f.kind === 'leaf' ? 2 : Math.ceil(f.size * (1 + k)), f.kind === 'leaf' ? 1 : Math.ceil(f.size * (1 + k)));
        g.globalAlpha = 1;
        if (f.kind === 'leaf') f.vx += Math.sin(f.t * 3 + f.a) * 0.6;
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
        const s = heroSprite(w.hero.cls, w.player.dir === 0 ? 'down' : w.player.dir === 3 ? 'up' : 'side', 0);
        g.globalAlpha = clamp(0.5 - k * 0.5, 0, 1);
        g.drawImage(w.player.dir === 1 ? s.wf : s.w, Math.round(f.x - s.width / 2), Math.round(f.y + 6 - s.height));
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
    lg.setTransform(1, 0, 0, 1, 0, 0);
    lg.globalCompositeOperation = 'source-over';
    // a fresh layer every frame (a translucent fill drawn over last frame's would stack up to black)
    lg.clearRect(0, 0, this.vw, this.vh);
    // moody, not murky: the room stays readable outside the pools of light
    lg.fillStyle = 'rgba(10,6,26,0.72)';
    lg.fillRect(0, 0, this.vw, this.vh);
    lg.globalCompositeOperation = 'destination-out';
    const hole = (x: number, y: number, r: number, a = 1): void => {
      const sx = x - ox;
      const sy = y - oy;
      if (sx < -r || sy < -r || sx > this.vw + r || sy > this.vh + r) return;
      lg.globalAlpha = a;
      lg.drawImage(glowDisc('#ffffff', Math.round(r)), Math.round(sx - r), Math.round(sy - r));
    };
    const p = w.player;
    hole(p.x, p.y - 4, 120);
    hole(p.x, p.y - 4, 70);
    for (const t of sc.torches) hole(t.x, t.y + 6, 58 + Math.sin(time * 9 + t.x) * 2, 0.9);
    for (const b of sc.braziers) hole(b.x, b.y + 4, 72 + Math.sin(time * 8 + b.x) * 2);
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
    // warm glow around flames
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.18;
    for (const t of sc.torches) g.drawImage(glowDisc('#ff9a3d', 22), Math.round(t.x - ox - 22), Math.round(t.y - oy - 18));
    for (const b of sc.braziers) g.drawImage(glowDisc('#ff9a3d', 30), Math.round(b.x - ox - 30), Math.round(b.y - oy - 24));
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
    if (e.hp >= e.maxHp && !e.elite.length && e.shield <= 0) return;
    const g = this.g;
    const wdt = e.elite.length ? 22 : 14;
    const x = Math.round(e.x - wdt / 2);
    const sprite = creatureSprite(e.def.sprite, 0);
    const y = Math.round(e.y + e.r * 0.8 - sprite.height * e.scale - 5);
    g.fillStyle = '#1b1428';
    g.fillRect(x - 1, y - 1, wdt + 2, 4);
    g.fillStyle = '#4a1a26';
    g.fillRect(x, y, wdt, 2);
    g.fillStyle = e.elite.length ? '#ffcf5a' : '#ff4a5a';
    g.fillRect(x, y, Math.max(0, Math.round((wdt * e.hp) / e.maxHp)), 2);
    if (e.shield > 0) {
      g.fillStyle = '#7fd8ff';
      g.fillRect(x, y - 1, Math.max(1, Math.round((wdt * e.shield) / (e.maxHp * 0.4))), 1);
    }
    if (e.elite.length) {
      const img = pixelText(e.name.split(' ')[0]!, '#ffd36b');
      g.drawImage(img, Math.round(e.x - img.width / 2), y - 8);
    }
    void w;
  }

  /** A bobbing hint over what you can interact with. */
  private drawInteractMarker(w: World, time: number): void {
    const it = w.interactable;
    if (!it) return;
    const g = this.g;
    const img = pixelText(it.kind === 'npc' ? 'TALK' : it.kind === 'waystone' ? 'TRAVEL' : 'EXIT', '#ffffff');
    const y = Math.round(it.y - 34 + Math.sin(time * 4) * 1.5);
    g.drawImage(img, Math.round(it.x - img.width / 2), y);
  }

  /** An arrow at the edge of the view toward the current objective. */
  private drawObjectiveArrow(w: World, ox: number, oy: number, time: number): void {
    const target = objectiveTarget(w);
    if (!target) return;
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

const npcSprite = (id: string): string => (id === 'maren' ? 'elder' : id === 'brannoc' ? 'smith' : id === 'ysolde' ? 'mystic' : 'villager');

/** Whether an NPC is the giver of an active quest (shows a "!"). */
function npcHasNews(w: World, id: string): boolean {
  return Object.entries(w.hero.quests).some(([q, s]) => s.state === 'active' && questGiver(q) === id);
}

import { QUEST_DEFS } from '../data/quests';
const questGiver = (q: string): string | undefined => QUEST_DEFS[q]?.giver;

/** Where the tracked quest wants you to go in this region, if anywhere. */
export function objectiveTarget(w: World): { x: number; y: number } | null {
  const h = w.hero;
  const active = Object.entries(h.quests).filter(([, s]) => s.state === 'active').map(([id]) => QUEST_DEFS[id]!);
  for (const q of active) {
    const o = q.objective;
    if (o.kind === 'tutorial' && w.region.id === 'emberwick') {
      const d = w.enemies.find((e) => e.dummy === (o.step === 'dodge' ? 2 : 1));
      if (d) return { x: d.x, y: d.y };
    }
    if ((o.kind === 'kill' || o.kind === 'collect') && w.region.id === 'emberwick' && h.unlocked.includes('whisperwood')) {
      const ws = w.waystones[0];
      if (ws) return ws;
    }
    if (o.kind === 'boss' && o.boss === 'grimtusk' && w.region.id === 'whisperwood') {
      const m = w.map.markers.find((pm) => pm.marker.kind === 'boss');
      if (m) return { x: (m.tx + 0.5) * TILE, y: (m.ty + 0.5) * TILE };
    }
    if (o.kind === 'boss' && (o.boss === 'ossric' || o.boss === 'morgrave') && w.region.id === 'whisperwood' && h.unlocked.includes('crypt')) {
      const x = w.exits.find((e) => e.to === 'crypt');
      if (x) return x;
    }
    if (o.kind === 'boss' && w.region.id === 'crypt') {
      const m = w.map.markers.find((pm) => pm.marker.kind === 'boss' && pm.marker.boss === o.boss);
      if (m) return { x: (m.tx + 0.5) * TILE, y: (m.ty + 0.5) * TILE };
    }
    if (o.kind === 'explore' && w.region.id === 'whisperwood' && dist(w.player.x, w.player.y, w.shrines[0]?.x ?? 0, w.shrines[0]?.y ?? 0) < 260) {
      // only a nudge once you are already in the north-west
      return null;
    }
  }
  if (w.portal) return w.portal;
  return null;
}
