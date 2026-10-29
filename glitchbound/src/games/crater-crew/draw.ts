/**
 * Draws one frame of the battle: sky and distant scenery, the painted ground, the liquid, the crews
 * (with every player's name and health over their critters), shells in flight, the aim and power,
 * sparks and smoke, then the weather. Positions are blended between physics steps for smoothness.
 */
import { CHARS } from './characters';
import { dcos, dsin } from './math';
import type { Scene } from './scene';
import type { Proj, Unit } from './sim';
import { WEAPONS, isWeaponId, type WeaponId } from './weapons';
import { drawCritter, drawGrave } from './render/critters';

type Ctx = CanvasRenderingContext2D;

export function drawScene(c: Ctx, s: Scene, dpr: number, alpha: number): void {
  const cam = s.cam;
  const shake = s.reduced ? 0 : s.fx.shake;
  const sx = shake ? (Math.random() - 0.5) * shake : 0;
  const sy = shake ? (Math.random() - 0.5) * shake : 0;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  s.back.sky(c, cam, s.t);
  const z = cam.z;
  c.setTransform(dpr * z, 0, 0, dpr * z, dpr * (cam.vw / 2 - cam.x * z + sx), dpr * (cam.vh / 2 - cam.y * z + sy));
  c.imageSmoothingEnabled = true;
  c.drawImage(s.painter.decor, 0, 0);
  c.drawImage(s.painter.canvas, 0, 0);
  s.back.liquidBack(c, cam, s.world.liquidY, s.t);
  s.fx.drawBack(c);
  drawTarget(c, s);
  const m = s.shown;
  const active = s.world.units.find((u) => u.id === m.active);
  for (const u of s.world.units) if (u.drowned === false && u !== active) drawUnit(c, s, u, alpha, false);
  if (active && !active.drowned) drawUnit(c, s, active, alpha, true);
  for (const p of s.world.projs) drawProj(c, s, p, alpha);
  drawAim(c, s, false);
  s.fx.drawFront(c);
  s.back.liquidFront(c, cam, s.world.liquidY, s.t);
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawTags(c, s, alpha);
  drawAim(c, s, true);
  s.fx.drawTexts(c, (x, y) => s.toScreen(x, y));
  s.back.weather(c, cam, s.t, m.wind);
}

function lerpPos(s: Scene, o: { x: number; y: number }, alpha: number): [number, number] {
  const p = s.prev.get(o);
  if (!p) return [o.x, o.y];
  return [p.x + (o.x - p.x) * alpha, p.y + (o.y - p.y) * alpha];
}

/** Where to draw a unit: blended, or the live position of someone else's walk. */
function unitPos(s: Scene, u: Unit, alpha: number, isActive: boolean): { x: number; y: number; f: 1 | -1 } {
  const d = s.displayPos(u);
  if (isActive && (d.x !== u.x || d.y !== u.y)) return d;
  const [x, y] = lerpPos(s, u, alpha);
  return { x, y, f: d.f };
}

function heldWeapon(s: Scene): WeaponId | null {
  const st = s.stage.k;
  if (s.myTurn) return s.weapon;
  if (st === 'think' || st === 'swing') return s.shownWeapon;
  if (st === 'aim' && s.remote?.turn === s.shown.turn && isWeaponId(s.remote.w)) return s.remote.w;
  if (st === 'aim' && !s.shown.over) return 'rocket';
  return null;
}

function drawUnit(c: Ctx, s: Scene, u: Unit, alpha: number, isActive: boolean): void {
  const crew = s.shown.crews[u.crew];
  if (!crew) return;
  const def = CHARS[crew.char];
  const p = unitPos(s, u, alpha, isActive);
  c.save();
  c.translate(p.x, p.y);
  if (u.dead) {
    drawGrave(c, def.color);
    c.restore();
    return;
  }
  // a soft shadow where it stands
  c.fillStyle = 'rgba(0,0,0,0.18)';
  c.beginPath();
  c.ellipse(0, 0.5, 8, 1.8, 0, 0, Math.PI * 2);
  c.fill();
  if (p.f < 0) c.scale(-1, 1);
  const a = s.animOf(u);
  const hurt = Math.max(0, 1 - (s.t - a.hurtAt) / 0.5);
  const weapon = isActive ? heldWeapon(s) : null;
  const look = isActive && weapon ? (s.displayAim() / 1800) * Math.PI : 0;
  const walk = isActive && s.remote && !s.myTurn && s.stage.k === 'aim' && s.remote.turn === s.shown.turn ? (s.remote.mv === 1 ? (s.t * 1.6) % 1 : -1) : a.walk;
  // a wobble while flying
  if (u.air) c.rotate(Math.sin(s.t * 14 + u.id) * 0.18);
  drawCritter(c, crew.char, def.color, { t: s.t, walk, air: u.air, look: WEAPONS[weapon ?? 'rocket'].aim === 'drop' || WEAPONS[weapon ?? 'rocket'].aim === 'target' ? 0 : look, weapon, hurt, seed: u.id * 1.7 });
  c.restore();
}

function drawProj(c: Ctx, s: Scene, p: Proj, alpha: number): void {
  const [x, y] = lerpPos(s, p, alpha);
  c.save();
  c.translate(x, y);
  switch (p.kind) {
    case 'rocket':
    case 'splitter': {
      c.rotate(Math.atan2(p.vy, p.vx));
      const body = p.kind === 'rocket' ? '#e43d30' : '#ff8a1f';
      c.fillStyle = '#2f3b4a';
      c.beginPath();
      c.moveTo(-7, -4);
      c.lineTo(-3, 0);
      c.lineTo(-7, 4);
      c.fill();
      c.beginPath();
      c.roundRect(-6, -2.4, 11, 4.8, 2);
      c.fillStyle = body;
      c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.5)';
      c.lineWidth = 0.8;
      c.stroke();
      c.fillStyle = '#f5f5f5';
      c.beginPath();
      c.moveTo(5, -2.4);
      c.quadraticCurveTo(9, 0, 5, 2.4);
      c.fill();
      if (p.kind === 'rocket') {
        const g = c.createRadialGradient(-8, 0, 0, -8, 0, 6);
        g.addColorStop(0, 'rgba(255,240,150,0.95)');
        g.addColorStop(1, 'rgba(255,100,20,0)');
        c.fillStyle = g;
        c.beginPath();
        c.arc(-9, 0, 6, 0, Math.PI * 2);
        c.fill();
      }
      break;
    }
    case 'grenade':
    case 'bomblet': {
      const r = p.kind === 'grenade' ? 4 : 2.6;
      c.rotate(p.age * 0.2 * Math.sign(p.vx || 1));
      c.fillStyle = p.kind === 'grenade' ? '#3f7a24' : '#2a2a2a';
      c.beginPath();
      c.arc(0, 0, r, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.6)';
      c.lineWidth = 0.8;
      c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.4)';
      c.beginPath();
      c.arc(-r * 0.35, -r * 0.35, r * 0.35, 0, Math.PI * 2);
      c.fill();
      if (p.kind === 'grenade') {
        c.fillStyle = '#9aa3ad';
        c.fillRect(-1, -r - 2, 2, 2);
      }
      break;
    }
    case 'dynamite': {
      c.rotate(p.rest ? 0 : p.age * 0.15);
      c.fillStyle = '#dc2626';
      c.beginPath();
      c.roundRect(-5, -2.2, 10, 4.4, 1);
      c.fill();
      c.strokeStyle = '#5c0b0b';
      c.lineWidth = 0.8;
      c.stroke();
      c.fillStyle = '#fef08a';
      c.fillRect(-1.5, -2.2, 3, 4.4);
      const sp = 1.4 + Math.sin(s.t * 30) * 0.6;
      c.fillStyle = '#ffd23f';
      c.beginPath();
      c.arc(6, -3, sp, 0, Math.PI * 2);
      c.fill();
      break;
    }
    case 'meteor': {
      const a = Math.atan2(p.vy, p.vx);
      c.rotate(a);
      const g = c.createLinearGradient(-26, 0, 4, 0);
      g.addColorStop(0, 'rgba(255,120,30,0)');
      g.addColorStop(1, 'rgba(255,200,80,0.9)');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(-28, 0);
      c.lineTo(2, -6);
      c.lineTo(2, 6);
      c.fill();
      c.fillStyle = '#5b4636';
      c.beginPath();
      c.arc(2, 0, 6, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#ffb347';
      c.beginPath();
      c.arc(4, -1, 2.4, 0, Math.PI * 2);
      c.fill();
      break;
    }
  }
  c.restore();
  // fuse seconds over anything about to go off
  if (p.fuse > 0) {
    c.save();
    c.font = 'bold 9px system-ui, sans-serif';
    c.textAlign = 'center';
    c.lineWidth = 2.5;
    c.strokeStyle = 'rgba(0,0,0,0.8)';
    const n = String(Math.ceil(p.fuse / 60));
    c.strokeText(n, x, y - 9);
    c.fillStyle = '#ffffff';
    c.fillText(n, x, y - 9);
    c.restore();
  }
}

/** The power wedge (world space), or the crosshair (screen space, over the name tags). */
function drawAim(c: Ctx, s: Scene, cross: boolean): void {
  const st = s.stage.k;
  const watching = st === 'aim' && !s.myTurn && s.remote?.turn === s.shown.turn;
  if (!(s.myTurn || watching || st === 'swing')) return;
  const u = s.world.units.find((x) => x.id === s.shown.active);
  if (!u || u.dead || u.drowned) return;
  const w = s.myTurn ? s.weapon : watching && isWeaponId(s.remote!.w) ? s.remote!.w : s.shownWeapon;
  const def = WEAPONS[w];
  if (def.aim === 'drop' || def.aim === 'target') return;
  const p = s.displayPos(u);
  const dir = s.myTurn ? s.dir : p.f;
  const a = (s.displayAim() / 1800) * Math.PI;
  const ux = dir * dcos(a);
  const uy = -dsin(a);
  const ox = p.x;
  const oy = p.y - 11;
  const color = s.crewColor(u.crew);
  const power = s.myTurn ? s.power : watching ? s.remote!.p : 0;
  if (cross) return crosshair(c, s, ox, oy, ux, uy, def.aim === 'swing' ? 22 : 50, color);
  if (def.aim === 'power' && power > 0) {
    // the wedge grows with the power
    const len = 14 + power * 0.62;
    const g = c.createLinearGradient(ox, oy, ox + ux * len, oy + uy * len);
    g.addColorStop(0, 'rgba(255,230,90,0.9)');
    g.addColorStop(1, 'rgba(255,60,40,0.95)');
    c.fillStyle = g;
    const nx = -uy;
    const ny = ux;
    const wEnd = 2 + power * 0.07;
    c.beginPath();
    c.moveTo(ox + ux * 12, oy + uy * 12);
    c.lineTo(ox + ux * len + nx * wEnd, oy + uy * len + ny * wEnd);
    c.lineTo(ox + ux * len - nx * wEnd, oy + uy * len - ny * wEnd);
    c.closePath();
    c.fill();
  }
}

function crosshair(c: Ctx, s: Scene, wx: number, wy: number, ux: number, uy: number, r: number, color: string): void {
  const [ox, oy] = s.toScreen(wx, wy);
  r = Math.max(r * s.cam.z, r * 0.8 + 6);
  const cx = ox + ux * r;
  const cy = oy + uy * r;
  c.strokeStyle = 'rgba(0,0,0,0.55)';
  c.lineWidth = 3.4;
  c.beginPath();
  c.arc(cx, cy, 5.5, 0, Math.PI * 2);
  c.stroke();
  c.strokeStyle = color;
  c.lineWidth = 2;
  c.stroke();
  c.beginPath();
  c.moveTo(cx - 9, cy);
  c.lineTo(cx - 3, cy);
  c.moveTo(cx + 3, cy);
  c.lineTo(cx + 9, cy);
  c.moveTo(cx, cy - 9);
  c.lineTo(cx, cy - 3);
  c.moveTo(cx, cy + 3);
  c.lineTo(cx, cy + 9);
  c.stroke();
  // a dotted guide out to the crosshair
  c.fillStyle = 'rgba(255,255,255,0.7)';
  for (let d = 14; d < r - 6; d += 6) {
    c.beginPath();
    c.arc(ox + ux * d, oy + uy * d, 1, 0, Math.PI * 2);
    c.fill();
  }
}

/** Meteor Shower's target marker. */
function drawTarget(c: Ctx, s: Scene): void {
  const mine = s.myTurn && WEAPONS[s.weapon].aim === 'target' && s.tx >= 0;
  const theirs = s.stage.k === 'aim' && !s.myTurn && s.remote?.turn === s.shown.turn && s.remote.w === 'meteor' && s.remote.tx > 0;
  if (!mine && !theirs) return;
  const x = mine ? s.tx : s.remote!.tx;
  const pulse = 0.5 + 0.5 * Math.sin(s.t * 6);
  c.strokeStyle = `rgba(255,80,60,${0.5 + pulse * 0.5})`;
  c.lineWidth = 2;
  c.setLineDash([6, 6]);
  c.beginPath();
  c.moveTo(x, -400);
  c.lineTo(x, s.world.liquidY);
  c.stroke();
  c.setLineDash([]);
  c.fillStyle = 'rgba(255,80,60,0.12)';
  c.fillRect(x - 85, -400, 170, s.world.liquidY + 400);
}

/** Every unit's player name and health, crisp in screen space, and the arrow over whose turn it is. */
function drawTags(c: Ctx, s: Scene, alpha: number): void {
  const m = s.shown;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  for (const u of s.world.units) {
    if (u.dead || u.drowned) continue;
    const crew = m.crews[u.crew];
    if (!crew) continue;
    const isActive = u.id === m.active && !m.over;
    const p = unitPos(s, u, alpha, isActive);
    const [x, y0] = s.toScreen(p.x, p.y - 26);
    if (x < -60 || x > s.cam.vw + 60 || y0 < -40 || y0 > s.cam.vh + 40) continue;
    const color = CHARS[crew.char].color;
    const hp = Math.max(0, Math.round(u.hp));
    // your own tag steps back while you aim, so the crosshair stays clear
    c.globalAlpha = isActive && s.myTurn ? 0.55 : 1;
    c.font = '700 11px system-ui, -apple-system, Segoe UI, sans-serif';
    const name = crew.name.length > 14 ? `${crew.name.slice(0, 13)}…` : crew.name;
    const nw = c.measureText(name).width + 12;
    const y = y0 - 22;
    pill(c, x - nw / 2, y - 8, nw, 16, 'rgba(12,14,28,0.78)', color);
    c.fillStyle = color;
    c.fillText(name, x, y + 0.5);
    c.font = '800 10px system-ui, -apple-system, Segoe UI, sans-serif';
    const hs = String(hp);
    const hw = c.measureText(hs).width + 10;
    pill(c, x - hw / 2, y + 9, hw, 13, color, 'rgba(12,14,28,0.85)');
    c.fillStyle = '#10121e';
    c.fillText(hs, x, y + 16);
    if (isActive && (s.stage.k === 'aim' || s.stage.k === 'think' || s.stage.k === 'swing' || s.stage.k === 'intro')) {
      const b = Math.sin(s.t * 6) * 3;
      c.fillStyle = color;
      c.strokeStyle = 'rgba(12,14,28,0.9)';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(x - 7, y - 22 + b);
      c.lineTo(x + 7, y - 22 + b);
      c.lineTo(x, y - 13 + b);
      c.closePath();
      c.stroke();
      c.fill();
    }
    c.globalAlpha = 1;
  }
  c.textBaseline = 'alphabetic';
}

function pill(c: Ctx, x: number, y: number, w: number, h: number, fill: string, line: string): void {
  c.beginPath();
  c.roundRect(x, y, w, h, h / 2);
  c.fillStyle = fill;
  c.fill();
  c.strokeStyle = line;
  c.lineWidth = 1.5;
  c.stroke();
}
