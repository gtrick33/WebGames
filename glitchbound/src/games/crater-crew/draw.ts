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
import { drawShell } from './render/arms';
import { drawCritter, drawGrave } from './render/critters';
import { FONT, INK, star } from './render/paint';

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
  s.back.weather(c, cam, s.t, m.wind);
  drawTags(c, s, alpha);
  drawFuses(c, s, alpha);
  drawAim(c, s, true);
  s.fx.drawTexts(c, (x, y) => s.toScreen(x, y));
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
  // seeing stars for a moment after a hit
  const dizzy = 1 - (s.t - a.hurtAt) / 1.6;
  if (dizzy > 0) {
    for (let i = 0; i < 3; i++) {
      const k = s.t * 5 + (i * Math.PI * 2) / 3;
      const z = Math.sin(k);
      star(c, Math.cos(k) * 9, -28 + z * 2.4, 2.6 * Math.min(1, dizzy * 3) * (0.8 + z * 0.2), 1.1, 5, s.t * 3);
      c.fillStyle = '#ffd23f';
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 0.7;
      c.stroke();
    }
  }
  c.restore();
}

function drawProj(c: Ctx, s: Scene, p: Proj, alpha: number): void {
  const [x, y] = lerpPos(s, p, alpha);
  c.save();
  c.translate(x, y);
  drawShell(c, p.kind, p.vx, p.vy, p.age, p.rest, s.t);
  c.restore();
}

/** Seconds left on anything about to go off, in a bubble (screen space) that throbs red at the end. */
function drawFuses(c: Ctx, s: Scene, alpha: number): void {
  for (const p of s.world.projs) {
    if (p.fuse <= 0) continue;
    const [x, y] = lerpPos(s, p, alpha);
    const n = Math.ceil(p.fuse / 60);
    const [bx, by] = s.toScreen(x, y - 10);
    const last = n <= 1;
    const r = 9 + (last ? Math.abs(Math.sin(s.t * 12)) * 2 : 0);
    c.beginPath();
    c.arc(bx, by - 10, r, 0, Math.PI * 2);
    c.fillStyle = last ? '#ff4d4d' : '#ffffff';
    c.fill();
    c.lineWidth = 2;
    c.strokeStyle = INK;
    c.stroke();
    c.font = `800 12px ${FONT}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = last ? '#ffffff' : INK;
    c.fillText(String(n), bx, by - 9.5);
    c.textBaseline = 'alphabetic';
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
  if (cross) return crosshair(c, s, ox, oy, ux, uy, def.aim === 'swing' ? 28 : 62, color);
  if (def.aim === 'power' && power > 0) {
    // the wedge grows with the power, yellow to red
    const len = 16 + power * 0.7;
    const g = c.createLinearGradient(ox, oy, ox + ux * len, oy + uy * len);
    g.addColorStop(0, '#ffe14d');
    g.addColorStop(0.6, '#ff8a1f');
    g.addColorStop(1, '#ff2d4d');
    c.fillStyle = g;
    const nx = -uy;
    const ny = ux;
    const wEnd = 2.5 + power * 0.085;
    c.beginPath();
    c.moveTo(ox + ux * 13, oy + uy * 13);
    c.lineTo(ox + ux * len + nx * wEnd, oy + uy * len + ny * wEnd);
    c.quadraticCurveTo(ox + ux * (len + wEnd * 0.9), oy + uy * (len + wEnd * 0.9), ox + ux * len - nx * wEnd, oy + uy * len - ny * wEnd);
    c.closePath();
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 1.2;
    c.lineJoin = 'round';
    c.stroke();
    c.lineJoin = 'miter';
  }
}

function crosshair(c: Ctx, s: Scene, wx: number, wy: number, ux: number, uy: number, r: number, color: string): void {
  const [ox, oy] = s.toScreen(wx, wy);
  r = Math.max(r * s.cam.z, r * 0.9);
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
    // while you aim, your own critter shows only its health: the HUD says whose turn it is, and the
    // crosshair gets the space above your head
    const aiming = isActive && s.myTurn;
    const y = y0 - 20;
    if (aiming && s.youLabel) {
      // a first battle: say which one is yours
      c.font = `900 12.5px ${FONT}`;
      const nw = c.measureText('This is you').width + 16;
      pill(c, x - nw / 2, y - 48, nw, 18, color, INK);
      c.fillStyle = '#14101f';
      c.fillText('This is you', x, y - 38.5);
    }
    if (!aiming) {
      c.font = `800 12.5px ${FONT}`;
      const name = crew.name.length > 14 ? `${crew.name.slice(0, 13)}…` : crew.name;
      const nw = c.measureText(name).width + 14;
      pill(c, x - nw / 2, y - 9, nw, 18, 'rgba(18,14,36,0.86)', color);
      c.fillStyle = color;
      c.fillText(name, x, y + 0.5);
    }
    c.font = `800 11px ${FONT}`;
    const hs = String(hp);
    const hw = c.measureText(hs).width + 12;
    pill(c, x - hw / 2, y + 10, hw, 14, hp <= 25 ? '#ff6b6b' : color, INK);
    c.fillStyle = '#14101f';
    c.fillText(hs, x, y + 17.5);
    // the bouncing arrow over whoever plays, yours included (running from your dynamite too)
    if (isActive && (s.stage.k === 'aim' || s.stage.k === 'think' || s.stage.k === 'swing' || s.stage.k === 'intro' || s.stage.k === 'run')) {
      const b = Math.sin(s.t * 6) * 3;
      c.fillStyle = color;
      c.strokeStyle = INK;
      c.lineWidth = 2;
      c.lineJoin = 'round';
      c.beginPath();
      c.moveTo(x - 8, y - 25 + b);
      c.lineTo(x + 8, y - 25 + b);
      c.lineTo(x, y - 14 + b);
      c.closePath();
      c.stroke();
      c.fill();
      c.lineJoin = 'miter';
    }
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
