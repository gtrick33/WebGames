import { ABILITIES } from '../arena/abilities';
import { ARENA_H, ARENA_W, MAPS } from '../arena/maps';
import { HERO_R, type Fighter, type Match } from '../arena/sim';
import { CLASSES } from '../data/classes';
import { heroLook, heldWeapon } from './sprites';
import type { Held } from '../render3d/dress';
import type { RingStage, RingView } from '../render3d/ring3d';
import { newCharacter, type Face } from '../progress/character';

/**
 * The Ring's top layer: the arena and the fighters are in 3D underneath (render3d/ring3d.ts); here are the rings under
 * their feet, what is afoot on them, their bars, and the spells in flight.
 */

type Ctx = CanvasRenderingContext2D;



export interface RingLook {
  look: ReturnType<typeof heroLook>;
  held: Held;
}

/** Every fighter's picture, made once. */
export function ringLooks(m: Match, mine: { face?: Face; body?: 'm' | 'f' }, myId: number | null): RingLook[] {
  return m.fighters.map((f) => {
    const hero = newCharacter(f.cls, f.name, 'ring');
    const isMe = f.id === myId;
    const body: 'm' | 'f' = isMe ? (mine.body ?? 'm') : f.id % 2 ? 'f' : 'm';
    const look = heroLook(f.cls, hero.equip, {}, body, isMe ? mine.face : undefined);
    return { look, held: heldWeapon(f.cls, hero.equip.weapon) };
  });
}

interface Flash {
  x: number;
  y: number;
  t: number;
  dur: number;
  r: number;
  color: string;
  ring: boolean;
}

interface Pop {
  x: number;
  y: number;
  t: number;
  text: string;
  color: string;
  big: boolean;
}

/** What's on screen for a moment: kept here, out of the simulation. */
export class RingFx {
  flashes: Flash[] = [];
  pops: Pop[] = [];
  private spread = 0;

  /** Takes the match's events. Returns what's worth a sound. */
  take(m: Match, sound: (id: string, vol?: number) => void, myId: number | null): void {
    for (const e of m.events) {
      if (e.k === 'num') {
        const f = m.fighters[e.id];
        if (!f) continue;
        this.spread = (this.spread + 1) % 5;
        const x = f.x + (this.spread - 2) * 7;
        this.pops.push({ x, y: f.y - 30, t: 0, text: e.kind === 'dmg' ? `${e.n}` : e.kind === 'heal' ? `+${e.n}` : `(${e.n})`, color: e.kind === 'dmg' ? (e.crit ? '#ffd257' : '#fff6e0') : e.kind === 'heal' ? '#7fe06a' : '#9fdcff', big: e.crit || e.n > 120 });
        if (e.kind === 'dmg' && e.id === myId) sound('squish', 0.5);
      } else if (e.k === 'word') {
        const f = m.fighters[e.id];
        if (!f) continue;
        this.pops.push({ x: f.x, y: f.y - 42, t: 0, text: e.word, color: e.bad ? '#ff9ab0' : '#e0d0ff', big: false });
      } else if (e.k === 'ab') {
        const ab = ABILITIES[e.ab];
        const f = m.fighters[e.id];
        if (!ab || !f) continue;
        if (ab.aim === 'near') this.flashes.push({ x: f.x, y: f.y, t: 0, dur: 0.42, r: ab.range + HERO_R, color: ab.color, ring: true });
        else if (ab.cast === 0 && ab.range <= 40) this.flashes.push({ x: f.x + f.dirX * 12, y: f.y - 8 + f.dirY * 8, t: 0, dur: 0.16, r: 16, color: ab.color, ring: false });
        sound(ab.school === 'physical' ? 'enemySwing' : 'click', 0.5);
      } else if (e.k === 'land') {
        const ab = ABILITIES[e.ab];
        const f = m.fighters[e.id];
        if (!ab || !f) continue;
        this.flashes.push({ x: f.x, y: f.y - 12, t: 0, dur: 0.28, r: 20, color: ab.color, ring: false });
        if (ab.role === 'heal') this.flashes.push({ x: f.x, y: f.y, t: 0, dur: 0.5, r: 18, color: ab.color, ring: true });
      } else if (e.k === 'death') {
        const f = m.fighters[e.id];
        if (!f) continue;
        this.flashes.push({ x: f.x, y: f.y - 10, t: 0, dur: 0.8, r: 60, color: '#ff5a5a', ring: true });
        sound('playerDie', 0.8);
      }
    }
    m.events.length = 0;
    if (this.pops.length > 40) this.pops.splice(0, this.pops.length - 40);
  }

  age(dt: number): void {
    for (const f of this.flashes) f.t += dt;
    for (const p of this.pops) p.t += dt;
    this.flashes = this.flashes.filter((f) => f.t < f.dur);
    this.pops = this.pops.filter((p) => p.t < 0.9);
  }
}

function ring(g: Ctx, x: number, y: number, r: number, color: string, width = 1.4): void {
  g.strokeStyle = color;
  g.lineWidth = width;
  g.beginPath();
  g.ellipse(x, y, r, r * 0.55, 0, 0, Math.PI * 2);
  g.stroke();
}

/** What is on a fighter: the rings at their feet, what's afoot on them, their bar and their cast. */
function markFighter(g: Ctx, m: Match, f: Fighter, myId: number | null, time: number, targeted: boolean, friendSel: boolean, seeable: boolean, view: RingView): void {
  const gale = f.auras.some((a) => a.ab === 'l-gale' && a.cc === 'incap');
  const lift = gale ? 10 + Math.sin(time * 6) * 2 : 0;
  view.flat(f.x, f.y);
  if (f.id === myId) ring(g, f.x, f.y, 11, '#ffe39a', 1.4);
  if (targeted) ring(g, f.x, f.y, 13 + Math.sin(time * 5) * 0.8, '#ff5a6a', 1.8);
  else if (friendSel) ring(g, f.x, f.y, 13, '#7fe06a', 1.6);
  if (f.dead) return;
  // what's on them: `head` is their head's height on the screen, drawn as if on their own spot
  view.up(f.x, f.y, HEAD + lift);
  const head = f.y;
  for (const a of f.auras) {
    if (a.cc === 'stun') {
      for (let i = 0; i < 3; i++) {
        const an = time * 5 + (i * Math.PI * 2) / 3;
        g.fillStyle = '#ffe39a';
        g.fillRect(f.x + Math.cos(an) * 8 - 1, head + 1 + Math.sin(an) * 2.5 - 1, 2, 2);
      }
    } else if (a.cc === 'fear') {
      g.fillStyle = '#c88aff';
      g.font = '700 9px Georgia, serif';
      g.textAlign = 'center';
      g.fillText('!', f.x, head - 1 + Math.sin(time * 9) * 1.5);
    } else if (a.cc === 'root') {
      view.flat(f.x, f.y);
      ring(g, f.x, f.y, 9, '#7ad65a', 2);
      g.fillStyle = '#4a8a3a';
      for (let i = 0; i < 5; i++) {
        const an = (i / 5) * Math.PI * 2;
        g.fillRect(f.x + Math.cos(an) * 8, f.y + Math.sin(an) * 8 - 2, 1.4, 3);
      }
      view.up(f.x, f.y, HEAD + lift);
    } else if (a.cc === 'silence') {
      g.fillStyle = '#cfe0ff';
      g.font = '700 8px Georgia, serif';
      g.textAlign = 'center';
      g.fillText('✕', f.x, head - 1);
    } else if (a.cc === 'incap' && a.ab !== 'm-toad' && a.ab !== 'l-gale') {
      g.fillStyle = '#fff2c0';
      g.font = '700 8px Georgia, serif';
      g.textAlign = 'center';
      g.fillText('z', f.x + 5, head - 1 + Math.sin(time * 3) * 1.5);
    } else if (a.ab === 'l-gale' && a.cc) {
      view.flat(f.x, f.y);
      for (let i = 0; i < 4; i++) {
        const an = time * 11 + i * 1.6;
        ring(g, f.x + Math.cos(an) * 1.5, f.y, 8 + i * 1.6, 'rgba(232,232,244,0.7)', 1);
      }
      view.up(f.x, f.y, HEAD + lift);
    } else if (a.kind === 'absorb') {
      view.up(f.x, f.y, 13);
      g.strokeStyle = 'rgba(160,220,255,0.65)';
      g.lineWidth = 1;
      g.beginPath();
      g.arc(f.x, f.y, 15, 0, Math.PI * 2);
      g.stroke();
      view.up(f.x, f.y, HEAD + lift);
    } else if (a.kind === 'immune') {
      view.up(f.x, f.y, 13);
      const ice = a.still;
      g.fillStyle = ice ? 'rgba(170,225,255,0.42)' : 'rgba(255,226,140,0.24)';
      g.strokeStyle = ice ? '#dff4ff' : '#ffe39a';
      g.lineWidth = 1.2;
      g.beginPath();
      g.arc(f.x, f.y, 16 + Math.sin(time * 5) * 0.8, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      view.up(f.x, f.y, HEAD + lift);
    } else if (a.kind === 'reflect') {
      view.up(f.x, f.y, 13);
      g.strokeStyle = 'rgba(190,235,255,0.9)';
      g.lineWidth = 1;
      g.beginPath();
      g.arc(f.x, f.y, 13, time * 3, time * 3 + 1.4);
      g.stroke();
      view.up(f.x, f.y, HEAD + lift);
    } else if (a.kind === 'guard') {
      view.flat(f.x, f.y);
      ring(g, f.x, f.y, 10, 'rgba(216,220,230,0.8)', 1.5);
      view.up(f.x, f.y, HEAD + lift);
    } else if (a.kind === 'fury') {
      view.up(f.x, f.y, 8);
      g.fillStyle = 'rgba(255,70,90,0.5)';
      g.fillRect(f.x - 7 + Math.sin(time * 13) * 5, f.y - ((time * 26) % 22), 1.6, 1.6);
      view.up(f.x, f.y, HEAD + lift);
    }
  }
  // a bar over the head, in their team's color
  const barW = 26;
  const by = head - 6;
  g.fillStyle = 'rgba(6,2,14,0.85)';
  g.beginPath();
  g.roundRect(f.x - barW / 2 - 0.7, by - 0.7, barW + 1.4, 3.8, 1.2);
  g.fill();
  const share = Math.max(0, f.hp / f.maxHp);
  g.fillStyle = f.team === m.fighters[myId ?? 0]?.team ? (share < 0.3 ? '#ff7a5a' : '#57d36a') : share < 0.3 ? '#ffb45c' : '#ff5a6a';
  g.beginPath();
  g.roundRect(f.x - barW / 2, by, barW * share, 2.4, 1);
  g.fill();
  // out of your sight: a small eye-shut mark over them
  if (!seeable) {
    g.strokeStyle = '#a8a0b8';
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(f.x - 4, by - 3);
    g.lineTo(f.x + 4, by - 3);
    g.stroke();
  }
  // the cast they're holding
  const c = f.cast;
  if (c) {
    const ab = ABILITIES[c.ab];
    const k = Math.min(1, c.t / c.dur);
    g.fillStyle = 'rgba(6,2,14,0.85)';
    g.fillRect(f.x - barW / 2 - 0.5, by + 3, barW + 1, 2.6);
    g.fillStyle = ab?.color ?? '#fff';
    g.fillRect(f.x - barW / 2, by + 3.5, barW * (c.channel ? 1 - k : k), 1.6);
    // gathering in the hands
    view.up(f.x, f.y, 16);
    const r = 3 + k * 3;
    const gl = g.createRadialGradient(f.x, f.y, 0, f.x, f.y, r * 2);
    gl.addColorStop(0, '#fffdf0');
    gl.addColorStop(0.4, ab?.color ?? '#fff');
    gl.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gl;
    g.fillRect(f.x - r * 2, f.y - r * 2, r * 4, r * 4);
  }
}

/** How high a fighter's head stands, in world pixels. */
const HEAD = 30;

/** The top layer of one frame. */
export function drawRing(g: Ctx, m: Match, fx: RingFx, myId: number | null, time: number, view: RingStage): void {
  const me = myId === null ? null : (m.fighters[myId] ?? null);
  for (const tr of m.traps) {
    const enemy = me && tr.team !== me.team;
    // an enemy's trap is hard to see, but not impossible
    view.flat(tr.x, tr.y);
    g.globalAlpha = enemy ? 0.42 : 0.9;
    ring(g, tr.x, tr.y, 11, tr.arm > 0 ? '#a8a0b8' : '#e8c070', 1.5);
    g.fillStyle = '#6a5a3a';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.fillRect(tr.x + Math.cos(a) * 8 - 1, tr.y + Math.sin(a) * 8 - 1, 2, 2);
    }
    g.globalAlpha = 1;
  }
  const target = me?.target;
  const friend = me?.friend;
  for (const f of m.fighters) markFighter(g, m, f, myId, time, f.id === target, f.id === friend && f.id !== myId, !me || f === me || m.sees(me, f), view);
  // the fires round the ring
  for (const f of view.flames) {
    view.up(f.x, f.y, f.h);
    const fl = 1 + Math.sin(time * 9 + f.x) * 0.16;
    const glow = g.createRadialGradient(f.x, f.y, 0, f.x, f.y, 13 * fl);
    glow.addColorStop(0, 'rgba(255,190,90,0.85)');
    glow.addColorStop(1, 'rgba(255,120,40,0)');
    g.fillStyle = glow;
    g.fillRect(f.x - 15, f.y - 15, 30, 30);
    g.fillStyle = '#fff2c0';
    g.beginPath();
    g.ellipse(f.x, f.y, 2, 5 * fl, 0, 0, Math.PI * 2);
    g.fill();
  }
  for (const b of m.bolts) {
    const ab = ABILITIES[b.ab];
    const c = ab?.color ?? '#fff';
    const t = m.fighters[b.tgt];
    const a = t ? Math.atan2(t.y - b.y, t.x - b.x) : 0;
    view.up(b.x, b.y, 14);
    g.strokeStyle = c;
    g.globalAlpha = 0.55;
    g.lineWidth = 2.6;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(b.x, b.y);
    g.lineTo(b.x - Math.cos(a) * 15, b.y - Math.sin(a) * 15);
    g.stroke();
    g.lineCap = 'butt';
    g.globalAlpha = 1;
    const gl = g.createRadialGradient(b.x, b.y, 0, b.x, b.y, 7);
    gl.addColorStop(0, '#fffdf0');
    gl.addColorStop(0.4, c);
    gl.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gl;
    g.fillRect(b.x - 7, b.y - 7, 14, 14);
  }
  for (const f of fx.flashes) {
    const u = f.t / f.dur;
    g.globalAlpha = 1 - u;
    if (f.ring) {
      view.flat(f.x, f.y);
      ring(g, f.x, f.y, f.r * (0.3 + u * 0.7), f.color, 3 - u * 2);
    } else {
      view.up(f.x, f.y, 6);
      const r = f.r * (0.5 + u * 0.5);
      const gl = g.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
      gl.addColorStop(0, '#fffdf0');
      gl.addColorStop(0.35, f.color);
      gl.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gl;
      g.fillRect(f.x - r, f.y - r, r * 2, r * 2);
    }
    g.globalAlpha = 1;
  }
  g.textAlign = 'center';
  for (const p of fx.pops) {
    const u = p.t / 0.9;
    const size = (p.big ? 11 : 8) * (u < 0.15 ? 1 + (0.15 - u) * 2.4 : 1);
    view.up(p.x, p.y + 30, HEAD);
    g.font = `800 ${size}px "Bricolage Grotesque Variable", system-ui, sans-serif`;
    g.globalAlpha = Math.max(0, 1 - u * u);
    g.lineWidth = 2;
    g.lineJoin = 'round';
    g.strokeStyle = '#120a20';
    g.strokeText(p.text, p.x, p.y + 30 - u * 14);
    g.fillStyle = p.color;
    g.fillText(p.text, p.x, p.y + 30 - u * 14);
  }
  g.globalAlpha = 1;
  // snow coming down over the frozen ground
  const map = MAPS[m.map] ?? Object.values(MAPS)[0]!;
  if (map.theme === 'frost') {
    view.flat(ARENA_W / 2, ARENA_H / 2);
    for (let i = 0; i < 46; i++) {
      const speed = 12 + (i % 6) * 5;
      const x = (((i * 83 + Math.sin(time * 0.7 + i) * 14 + time * (5 + (i % 3) * 4)) % ARENA_W) + ARENA_W) % ARENA_W;
      const y = (i * 53 + time * speed) % ARENA_H;
      g.fillStyle = `rgba(255,255,255,${0.4 + (i % 4) * 0.15})`;
      const size = 1 + (i % 3) * 0.6;
      g.fillRect(x, y, size, size);
    }
  }
}

export function fighterAt(m: Match, x: number, y: number): Fighter | null {
  let best: Fighter | null = null;
  let bd = 26;
  for (const f of m.fighters) {
    if (f.dead) continue;
    const d = Math.hypot(f.x - x, f.y - y);
    if (d < bd) {
      bd = d;
      best = f;
    }
  }
  return best;
}

export const classColor = (cls: Fighter['cls']): string => CLASSES[cls].colors.accent;
