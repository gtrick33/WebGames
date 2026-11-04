import { ABILITIES } from '../arena/abilities';
import { ARENA_H, ARENA_W, MAPS } from '../arena/maps';
import { HERO_R, type Fighter, type Match } from '../arena/sim';
import type { RingAir } from '../render3d/ringDress';
import { shot, TONES } from './effects';
import { CLASSES } from '../data/classes';
import { heroLook, heldWeapon } from './sprites';
import type { Held } from '../render3d/dress';
import { FIELD, FX, type Fx3D } from '../render3d/fx3d';
import type { RingStage, RingView } from '../render3d/ring3d';
import { newCharacter, type Face } from '../progress/character';

/**
 * The Ring's top layer: the arena and the fighters are in 3D underneath (render3d/ring3d.ts); here are the rings under
 * their feet, their bars and numbers. The spells, and what's afoot on people, are the shaders' (`ringSpells`).
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
  g.ellipse(x, y, r, r, 0, 0, Math.PI * 2);
  g.stroke();
}

/** What is on a fighter: the rings at their feet, what's afoot on them, their bar and their cast. */
function markFighter(g: Ctx, m: Match, f: Fighter, myId: number | null, time: number, seeable: boolean, view: RingView): void {
  const gale = f.auras.some((a) => a.ab === 'l-gale' && a.cc === 'incap');
  const lift = gale ? 10 + Math.sin(time * 6) * 2 : 0;
  if (f.dead) return;
  // what's on them that's a word: `head` is their head's height on the screen, drawn as if on their own spot
  view.up(f.x, f.y, HEAD + lift);
  const head = f.y;
  for (const a of f.auras) {
    if (a.cc === 'fear') {
      g.fillStyle = '#c88aff';
      g.font = '700 9px Georgia, serif';
      g.textAlign = 'center';
      g.fillText('!', f.x, head - 1 + Math.sin(time * 9) * 1.5);
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
  }
}

/** How high a fighter's head stands, in world pixels. */
const HEAD = 30;

/** The spells in flight and what's afoot on the fighters: handed to the shaders before the frame is drawn. */
export function ringSpells(q: Fx3D, m: Match, fx: RingFx, myId: number | null, time: number, air: RingAir): void {
  const me = myId === null ? null : (m.fighters[myId] ?? null);
  for (const tr of m.traps) {
    const enemy = me && tr.team !== me.team;
    // an enemy's trap is hard to see, but not impossible
    q.put({ kind: FX.trap, x: tr.x, y: tr.y, flat: true, w: 26, a: tr.arm > 0 ? '#a8a0b8' : '#e8c070', t: tr.arm > 0 ? 0 : 1, alpha: enemy ? 0.42 : 1 });
  }
  for (const f of air.flames) {
    const k = f.size ?? 1;
    q.put({ kind: FX.glow, x: f.x, y: f.y, up: f.h + 5 * k, w: 44 * k, a: '#ff7a2d', alpha: 0.5 });
    q.put({ kind: FX.flame, x: f.x, y: f.y, up: f.h - 2, base: true, w: 15 * k, h: 22 * k, a: '#f4561f', b: '#ffb02e', seed: f.x * 0.37 });
  }
  for (const s of air.smokes) {
    const k = s.size ?? 1;
    for (let i = 0; i < 3; i++) {
      const u = (time * 0.22 + i / 3 + s.x * 0.013) % 1;
      q.put({ kind: FX.smoke, x: s.x + Math.sin(time * 0.6 + i * 2) * 4 * u + u * 8, y: s.y, up: s.h + u * 44 * k, w: (12 + u * 26) * k, a: s.tone, alpha: 0.44 * Math.sin(u * Math.PI), t: 0.3, seed: s.x + i });
    }
  }
  for (const g of air.glints) {
    const u = (time * 0.17 + g.x * 0.131 + g.h * 0.37) % 1;
    if (u < 0.1) q.put({ kind: FX.spark, x: g.x, y: g.y, up: g.h, w: 3 + Math.sin((u / 0.1) * Math.PI) * 11, a: '#ffffff', t: 0.2, alpha: 0.95 });
  }
  if (air.embers.length) {
    for (let i = 0; i < 34; i++) {
      const e = air.embers[i % air.embers.length]!;
      const u = (time * (0.16 + (i % 5) * 0.03) + i * 0.137) % 1;
      q.put({ kind: FX.spark, x: e.x + Math.sin(time * 1.1 + i) * (5 + u * 14) + ((i * 13) % 18) - 9, y: e.y + ((i * 7) % 12) - 6, up: 2 + u * 62, w: 3.4 - u * 1.8, a: u < 0.5 ? '#ffd27a' : '#ff6a2a', t: 0.2, alpha: 1 - u });
    }
  }
  for (const f of m.fighters) ringMarks(q, f, time);
  for (const b of m.bolts) {
    const ab = ABILITIES[b.ab];
    const c = ab?.color ?? '#ffffff';
    const t = m.fighters[b.tgt];
    const a = t ? Math.atan2(t.y - b.y, t.x - b.x) : 0;
    const el = SCHOOL_EL[ab?.school ?? ''] ?? 'arcane';
    const tone = el === 'trail' ? { a: c, b: '#ffffff' } : (TONES[el] ?? { a: c, b: '#ffffff' });
    shot(q, el === 'trail' ? 'orb' : el, b.x, b.y, Math.cos(a) * 100, Math.sin(a) * 100, 14, 3.4, b.x * 0.03 + b.y * 0.05, tone);
  }
  for (const f of fx.flashes) {
    const u = f.t / f.dur;
    if (f.ring) q.put({ kind: FX.ring, x: f.x, y: f.y, flat: true, w: f.r * 2, a: f.color, t: u, seed: f.r });
    else q.put({ kind: FX.impact, x: f.x, y: f.y, up: 12, w: f.r * 2.4, a: f.color, b: '#fffdf0', t: u, seed: f.x * 0.2 });
  }
  const map = MAPS[m.map] ?? Object.values(MAPS)[0]!;
  // sand on the wind, low over the ground
  if (map.theme === 'sands') {
    for (let i = 0; i < 9; i++) {
      const u = (time * (0.05 + (i % 3) * 0.018) + i * 0.117) % 1;
      q.put({ kind: FX.smoke, x: u * (ARENA_W + 80) - 40, y: ((i * 67) % ARENA_H) + Math.sin(time * 0.3 + i) * 8, up: 4, w: 44 + (i % 4) * 12, a: '#f2deb2', alpha: 0.13 * Math.sin(u * Math.PI), t: 0.3, seed: i * 3.1 });
    }
  }
  // snow coming down over the frozen ground, and blown along it
  if (map.theme === 'frost') {
    for (let i = 0; i < 46; i++) {
      const speed = 12 + (i % 6) * 5;
      const x = (((i * 83 + Math.sin(time * 0.7 + i) * 14 + time * (5 + (i % 3) * 4)) % ARENA_W) + ARENA_W) % ARENA_W;
      const y = (i * 53 + time * speed * 0.3) % ARENA_H;
      const up = 60 - ((time * speed + i * 17) % 60);
      q.put({ kind: FX.spark, x, y, up, w: 4 + (i % 3) * 1.5, a: '#ffffff', alpha: 0.5 + (i % 4) * 0.12, t: 0.3 });
    }
    for (let i = 0; i < 7; i++) {
      const u = (time * (0.07 + (i % 3) * 0.02) + i * 0.143) % 1;
      q.put({ kind: FX.smoke, x: u * (ARENA_W + 80) - 40, y: ((i * 83) % ARENA_H) + Math.sin(time * 0.4 + i) * 7, up: 3, w: 40 + (i % 4) * 10, a: '#ffffff', alpha: 0.2 * Math.sin(u * Math.PI), t: 0.3, seed: i * 2.3 });
    }
  }
}

const SCHOOL_EL: Record<string, string> = { fire: 'fire', frost: 'frost', arcane: 'arcane', shadow: 'shadow', holy: 'holy', nature: 'nature', physical: 'trail' };

/** What's afoot on a fighter. */
function ringMarks(q: Fx3D, f: Fighter, time: number): void {
  if (f.dead) return;
  const gale = f.auras.some((a) => a.ab === 'l-gale' && a.cc === 'incap');
  const lift = gale ? 10 + Math.sin(time * 6) * 2 : 0;
  const seed = f.id * 1.7;
  for (const a of f.auras) {
    if (a.cc === 'stun') {
      for (let i = 0; i < 3; i++) {
        const an = time * 5 + (i * Math.PI * 2) / 3;
        q.put({ kind: FX.spark, x: f.x + Math.cos(an) * 9, y: f.y + Math.sin(an) * 3, up: HEAD + lift, w: 11, a: '#ffe39a', t: 0.1 });
      }
    } else if (a.cc === 'root') {
      q.put({ kind: FX.field, x: f.x, y: f.y, flat: true, w: 26, a: '#4a9a3a', b: '#b8ff8a', t: 1, seed, p1: FIELD.nature });
    } else if (a.ab === 'l-gale' && a.cc) {
      q.put({ kind: FX.smoke, x: f.x, y: f.y, up: 6, w: 34, a: '#e8e8f4', alpha: 0.55, t: 0.2, seed: time * 2 });
      q.put({ kind: FX.ring, x: f.x, y: f.y, flat: true, w: 34, a: '#e8e8f4', t: (time * 1.6) % 1, seed });
    } else if (a.kind === 'absorb') {
      q.put({ kind: FX.bubble, x: f.x, y: f.y, up: 15, w: 44, a: '#7fd8ff' });
    } else if (a.kind === 'immune') {
      q.put({ kind: FX.bubble, x: f.x, y: f.y, up: 15, w: 50 + Math.sin(time * 5) * 2, a: a.still ? '#a8e4ff' : '#ffe39a' });
      if (a.still) q.put({ kind: FX.field, x: f.x, y: f.y, flat: true, w: 34, a: '#7fd4ff', b: '#ffffff', t: 1, seed, p1: FIELD.frost });
    } else if (a.kind === 'reflect') {
      q.put({ kind: FX.slash, x: f.x, y: f.y, up: 14, flat: true, w: 36, rot: time * 3, a: '#bee8ff', t: 0.3, p1: 1.4, p2: 0 });
    } else if (a.kind === 'guard') {
      q.put({ kind: FX.mark, x: f.x, y: f.y, flat: true, w: 26, a: '#d8dce6' });
    } else if (a.kind === 'fury') {
      q.put({ kind: FX.rain, x: f.x, y: f.y, base: true, w: 28, h: 40, a: '#ff465a', t: -1, seed });
    }
  }
  if (f.cast) {
    const ab = ABILITIES[f.cast.ab];
    const k = Math.min(1, f.cast.t / f.cast.dur);
    const c = ab?.color ?? '#ffffff';
    q.put({ kind: FX.gather, x: f.x, y: f.y, up: 18, w: 38, a: c, b: '#fffdf0', t: k, seed });
    q.put({ kind: FX.rune, x: f.x, y: f.y, flat: true, w: 34, a: c, b: '#ffffff', t: 0.5, seed });
  }
}

/** The top layer of one frame. */
export function drawRing(m: Match, fx: RingFx, myId: number | null, time: number, view: RingStage): void {
  const me = myId === null ? null : (m.fighters[myId] ?? null);
  let g = view.groundLayer();
  for (const f of m.fighters) {
    view.flat(f.x, f.y);
    if (f.id === myId) ring(g, f.x, f.y, 11, '#ffe39a', 1.4);
    if (f.id === me?.target) ring(g, f.x, f.y, 13 + Math.sin(time * 5) * 0.8, '#ff5a6a', 1.8);
    else if (f.id === me?.friend && f.id !== myId) ring(g, f.x, f.y, 13, '#7fe06a', 1.6);
  }
  g = view.upperLayer();
  for (const f of m.fighters) markFighter(g, m, f, myId, time, !me || f === me || m.sees(me, f), view);
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
}

export const classColor = (cls: Fighter['cls']): string => CLASSES[cls].colors.accent;
