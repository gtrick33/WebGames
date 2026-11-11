import { ABILITIES } from '../arena/abilities';
import { ARENA_H, ARENA_W, MAPS } from '../arena/maps';
import { HERO_R, ZONE_START, type Fighter, type Match } from '../arena/sim';
import type { RingAir } from '../render3d/ringDress';
import { shot, TONES } from './effects';
import { CLASSES } from '../data/classes';
import { heroLook, heldWeapon, type WornLooks } from './sprites';
import type { Held } from '../render3d/dress';
import { FIELD, FX, type Fx3D } from '../render3d/fx3d';
import type { RingStage, RingView } from '../render3d/ring3d';
import { newCharacter, type Character, type Face } from '../progress/character';
import { wornLooks } from '../progress/wardrobe';

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
export function ringLooks(m: Match, mine: { face?: Face; body?: 'm' | 'f'; wear?: Character | null; worn?: WornLooks }, myId: number | null): RingLook[] {
  return m.fighters.map((f) => {
    const hero = newCharacter(f.cls, f.name, 'ring');
    const isMe = f.id === myId;
    // (your own campaign hero's gear and Wardrobe, if you chose to fight in them)
    const w = isMe && mine.wear && mine.wear.cls === f.cls ? mine.wear : null;
    if (w) return { look: heroLook(f.cls, w.equip, wornLooks(w), w.body, w.face), held: heldWeapon(f.cls, w.equip.weapon, wornLooks(w).weapon) };
    const body: 'm' | 'f' = isMe ? (mine.body ?? 'm') : f.id % 2 ? 'f' : 'm';
    // (in plain clothes, the Ring armor they chose goes over them)
    const look = heroLook(f.cls, hero.equip, isMe ? (mine.worn ?? {}) : {}, body, isMe ? mine.face : undefined);
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
  /** A word (not a number): words stack. */
  word?: boolean;
}

/** What an ability sounds like as it leaves the hand, and as it lands, by its school. */
const LEAVES: Record<string, string> = { physical: 'swing', fire: 'fireball', frost: 'freeze', arcane: 'bolt', holy: 'holy', shadow: 'shadow', nature: 'nature' };
const LANDS: Record<string, string> = { physical: 'clash', fire: 'explode', frost: 'freeze', arcane: 'zap', holy: 'holy', shadow: 'shadow', nature: 'nature' };
const SUPER_SOUND: Record<string, string> = { physical: 'quake', fire: 'meteor', frost: 'freeze', arcane: 'thunder', holy: 'nova', shadow: 'rift', nature: 'thunder' };
/** Every sound those tables name (a test holds them to the sounds there are). */
export const ringSchoolSounds = (): string[] => [...Object.values(LEAVES), ...Object.values(LANDS), ...Object.values(SUPER_SOUND)];

/** What's on screen for a moment: kept here, out of the simulation. */
/** A spell landing: a burst in its school's own manner, bigger for a burst ability. */
interface Burst {
  x: number;
  y: number;
  t: number;
  dur: number;
  school: string;
  color: string;
  big: boolean;
  heal: boolean;
  seed: number;
}

export class RingFx {
  flashes: Flash[] = [];
  pops: Pop[] = [];
  bursts: Burst[] = [];
  /** Who just let a super go: a column of light on them for a moment. */
  supers: { id: number; t: number }[] = [];
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
        if (e.kind === 'dmg' && e.id === myId) sound('hurt', e.crit ? 0.7 : 0.45);
      } else if (e.k === 'word') {
        const f = m.fighters[e.id];
        if (!f) continue;
        // (a combo is called out big, in gold, with a burst of light on them; words said close together stand one over
        // the other, never on top of each other)
        const above = this.pops.filter((p) => p.word && p.t < 0.5 && Math.abs(p.x - f.x) < 40 && Math.abs(p.y - f.y) < 110).length;
        this.pops.push({ x: f.x, y: f.y - (e.combo ? 50 : 42) - above * 13, t: 0, text: e.combo ? `${e.word}!` : e.word, color: e.combo ? '#ffd257' : e.bad ? '#ff9ab0' : '#e0d0ff', big: !!e.combo, word: true });
        if (e.combo) {
          this.flashes.push({ x: f.x, y: f.y, t: 0, dur: 0.5, r: 26, color: '#ffd257', ring: true });
          // (a chain's later links ring higher)
          sound(/×[34]$/.test(e.word) ? 'epic' : 'shard', 0.7);
        } else if (e.word === 'Interrupted' || e.word === 'Reflected') sound('shieldBreak', 0.6);
      } else if (e.k === 'ab') {
        const ab = ABILITIES[e.ab];
        const f = m.fighters[e.id];
        if (!ab || !f) continue;
        if (ab.aim === 'near') this.flashes.push({ x: f.x, y: f.y, t: 0, dur: 0.42, r: ab.range + HERO_R, color: ab.color, ring: true });
        else if (ab.cast === 0 && ab.range <= 40) this.flashes.push({ x: f.x + f.dirX * 12, y: f.y - 8 + f.dirY * 8, t: 0, dur: 0.16, r: 16, color: ab.color, ring: false });
        // (what it is made of, as it leaves the hand: your own a little louder than the rest)
        const vol = e.id === myId ? 0.7 : 0.4;
        const melee = ab.range > 0 && ab.range <= 40;
        if (ab.id === 'dash') sound('dodge', vol);
        else if (ab.super) sound(SUPER_SOUND[ab.school] ?? 'nova', 0.9);
        else if (ab.role === 'heal' || ab.aim === 'friend') sound('buff', vol * 0.8);
        else if (ab.aim === 'self') sound(ab.role === 'defense' ? 'shield' : ab.role === 'mobility' ? 'blink' : 'buff', vol);
        else if (ab.school === 'physical') sound(melee ? (ab.role === 'burst' ? 'swingBig' : 'swing') : ab.cls === 'ranger' ? 'bow' : 'swingBig', vol);
        else sound(LEAVES[ab.school] ?? 'bolt', vol);
      } else if (e.k === 'land') {
        const ab = ABILITIES[e.ab];
        const f = m.fighters[e.id];
        if (!ab || !f) continue;
        this.flashes.push({ x: f.x, y: f.y - 12, t: 0, dur: 0.32, r: ab.role === 'burst' ? 30 : 22, color: ab.color, ring: false });
        if (ab.role === 'heal') this.flashes.push({ x: f.x, y: f.y, t: 0, dur: 0.5, r: 18, color: ab.color, ring: true });
        // (and as it lands: steel for a blow, the school's own for a spell, a soft chime for a heal)
        const mine = e.id === myId;
        if (ab.role === 'heal' || ab.aim === 'friend') sound('heal', mine ? 0.6 : 0.35);
        else if (ab.aim === 'enemy' || ab.aim === 'near') sound(ab.school === 'physical' ? (ab.role === 'burst' ? 'critBlade' : 'clash') : ab.role === 'burst' ? 'explode' : (LANDS[ab.school] ?? 'hit'), mine ? 0.75 : 0.5);
        this.bursts.push({ x: f.x, y: f.y, t: 0, dur: ab.role === 'burst' ? 0.75 : 0.55, school: ab.school, color: ab.color, big: ab.role === 'burst', heal: ab.role === 'heal' || ab.aim === 'friend', seed: (f.x * 7 + f.y * 3 + this.bursts.length) % 97 });
        if (this.bursts.length > 24) this.bursts.shift();
      } else if (e.k === 'death') {
        const f = m.fighters[e.id];
        if (!f) continue;
        this.flashes.push({ x: f.x, y: f.y - 10, t: 0, dur: 0.8, r: 60, color: '#ff5a5a', ring: true });
        // (a fighter down: a body falling and the crowd's drum; the match's own end has its jingle)
        sound('die', 0.9);
        sound('slam', 0.6);
      } else if (e.k === 'miss') {
        // a shot that hit stone or flew out: a puff where it fell
        const ab = ABILITIES[e.ab];
        this.flashes.push({ x: e.x, y: e.y, t: 0, dur: 0.22, r: 9, color: ab?.color ?? '#ffffff', ring: false });
      } else if (e.k === 'super') {
        // a super: a great ring of its color, a crowd that roars, and its name called out
        const ab = ABILITIES[e.ab];
        const f = m.fighters[e.id];
        if (!ab || !f) continue;
        this.flashes.push({ x: f.x, y: f.y, t: 0, dur: 0.7, r: Math.max(46, ab.aim === 'near' ? ab.range + HERO_R : 46), color: ab.color, ring: true });
        this.flashes.push({ x: f.x, y: f.y - 14, t: 0, dur: 0.45, r: 34, color: '#fff6d8', ring: false });
        this.pops.push({ x: f.x, y: f.y - 54, t: 0, text: ab.name, color: '#ffd257', big: true });
        this.supers.push({ id: f.id, t: 0 });
        sound('roar', 0.5);
      } else if (e.k === 'sigil') {
        this.flashes.push({ x: e.x, y: e.y, t: 0, dur: 0.6, r: e.id < 0 ? 22 : 34, color: '#ffe27a', ring: true });
        sound(e.id >= 0 ? 'pickupBig' : 'orb', e.id >= 0 ? 0.7 : 0.4);
      }
    }
    m.events.length = 0;
    if (this.pops.length > 40) this.pops.splice(0, this.pops.length - 40);
  }

  age(dt: number): void {
    for (const f of this.flashes) f.t += dt;
    for (const p of this.pops) p.t += dt;
    for (const b of this.bursts) b.t += dt;
    for (const s of this.supers) s.t += dt;
    this.supers = this.supers.filter((s) => s.t < 0.8);
    this.bursts = this.bursts.filter((b) => b.t < b.dur);
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
  // what's on them, over the bar: harm in red-edged pips, help in green, each running down as it wears off
  const shown = f.auras.filter((a) => a.dur > 0 && a.t > 0 && ABILITIES[a.ab]).slice(0, 6);
  const pip = 4.6;
  const gap = 1.2;
  let px = f.x - (shown.length * (pip + gap) - gap) / 2;
  const py = by - pip - 2.2;
  for (const a of shown) {
    const ab = ABILITIES[a.ab]!;
    g.fillStyle = 'rgba(6,2,14,0.9)';
    g.fillRect(px - 0.5, py - 0.5, pip + 1, pip + 1);
    g.fillStyle = ab.color;
    g.fillRect(px, py, pip, pip);
    // (the part that's worn off, darkened from the top)
    const gone = 1 - Math.max(0, Math.min(1, a.t / a.dur));
    g.fillStyle = 'rgba(6,2,14,0.62)';
    g.fillRect(px, py, pip, pip * gone);
    g.strokeStyle = a.harmful ? '#ff4a5a' : '#6ee07a';
    g.lineWidth = 0.6;
    g.strokeRect(px - 0.3, py - 0.3, pip + 0.6, pip + 0.6);
    px += pip + gap;
  }
  // the cast they're holding: a bar of its own under the life, with its name, so a cast to stop can be seen and read
  const c = f.cast;
  if (c) {
    const ab = ABILITIES[c.ab];
    const k = Math.min(1, c.t / c.dur);
    const cw = 34;
    const cy = by + 3.6;
    g.fillStyle = 'rgba(6,2,14,0.88)';
    g.beginPath();
    g.roundRect(f.x - cw / 2 - 0.6, cy - 0.6, cw + 1.2, 4.4, 1.2);
    g.fill();
    g.fillStyle = ab?.color ?? '#fff';
    g.fillRect(f.x - cw / 2, cy, cw * (c.channel ? 1 - k : k), 3.2);
    if (ab) {
      g.font = '700 4.6px "Bricolage Grotesque Variable", system-ui, sans-serif';
      g.textAlign = 'center';
      g.lineWidth = 1.2;
      g.lineJoin = 'round';
      g.strokeStyle = '#120a20';
      g.strokeText(ab.name, f.x, cy + 9);
      g.fillStyle = '#fff6e0';
      g.fillText(ab.name, f.x, cy + 9);
    }
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
    const a = Math.atan2(b.vy, b.vx);
    const el = SCHOOL_EL[ab?.school ?? ''] ?? 'arcane';
    const tone = el === 'trail' ? { a: c, b: '#ffffff' } : (TONES[el] ?? { a: c, b: '#ffffff' });
    const k = ab?.super ? 1.7 : 1;
    shot(q, el === 'trail' ? 'orb' : el, b.x, b.y, Math.cos(a) * 100, Math.sin(a) * 100, 14 * k, 3.4 * k, b.x * 0.03 + b.y * 0.05, tone);
  }
  // a Swift Step: a streak of light behind
  for (const f of m.fighters) {
    if (!f.dash || f.dead) continue;
    for (let i = 1; i <= 4; i++) {
      const dx = f.dash.x - f.x;
      const dy = f.dash.y - f.y;
      const d = Math.hypot(dx, dy) || 1;
      q.put({ kind: FX.spark, x: f.x - (dx / d) * i * 5, y: f.y - (dy / d) * i * 5, up: 10 + i, w: 7 - i, a: '#bff4ff', t: 0.2, alpha: 1 - i * 0.2 });
    }
  }
  // a super: a column of light on whoever let it go
  for (const s of fx.supers) {
    const f = m.fighters[s.id];
    if (!f) continue;
    const u = s.t / 0.8;
    q.put({ kind: FX.shaft, x: f.x, y: f.y, base: true, w: 34, h: 90, a: classColor(f.cls), b: '#ffffff', t: u, alpha: 1 - u });
  }
  // the sigil in the middle, turning and shining, worth the run
  if (m.sigil) {
    const s = m.sigil;
    const bob = Math.sin(time * 3) * 2;
    q.put({ kind: FX.glow, x: s.x, y: s.y, up: 12 + bob, w: 50, a: '#ffd76a', alpha: 0.75 });
    q.put({ kind: FX.ring, x: s.x, y: s.y, flat: true, w: 30, a: '#ffe27a', t: (time * 0.6) % 1, seed: 3 });
    q.put({ kind: FX.orb, x: s.x, y: s.y, up: 12 + bob, w: 13, a: '#ffe27a', b: '#ffffff', t: 0.3, seed: time });
    for (let i = 0; i < 5; i++) {
      const ang = time * 1.8 + (i / 5) * Math.PI * 2;
      q.put({ kind: FX.spark, x: s.x + Math.cos(ang) * 11, y: s.y + Math.sin(ang) * 5, up: 12 + bob + Math.sin(ang * 2) * 3, w: 4, a: '#fff6c8', t: 0.2, alpha: 0.9 });
    }
  }
  // the Gloam: smoke along its edge, where it burns
  const z = m.zone;
  if (m.phase === 'fight' && z < ZONE_START - 0.01) {
    const cx = ARENA_W / 2;
    const cy = ARENA_H / 2;
    for (let i = 0; i < 64; i++) {
      const ang = (i / 64) * Math.PI * 2;
      const x = cx + Math.cos(ang) * cx * z;
      const y = cy + Math.sin(ang) * cy * z;
      if (x < -10 || y < -10 || x > ARENA_W + 10 || y > ARENA_H + 10) continue;
      const u = (time * 0.35 + i * 0.37) % 1;
      q.put({ kind: FX.smoke, x, y, up: 4 + u * 26, w: 26 + u * 18, a: '#3a1460', alpha: 0.55 * Math.sin(u * Math.PI), t: 0.3, seed: i });
      if (i % 3 === 0) q.put({ kind: FX.flame, x, y, up: -2, base: true, w: 10, h: 16 + Math.sin(time * 4 + i) * 4, a: '#7a3cff', b: '#d8a8ff', seed: i * 0.71 });
    }
  }
  for (const f of fx.flashes) {
    const u = f.t / f.dur;
    if (f.ring) q.put({ kind: FX.ring, x: f.x, y: f.y, flat: true, w: f.r * 2, a: f.color, t: u, seed: f.r });
    else q.put({ kind: FX.impact, x: f.x, y: f.y, up: 12, w: f.r * 2.4, a: f.color, b: '#fffdf0', t: u, seed: f.x * 0.2 });
  }
  for (const b of fx.bursts) landing(q, b);
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

/** A spell landing, in its school's manner. */
function landing(q: Fx3D, b: Burst): void {
  const u = b.t / b.dur;
  const k = b.big ? 1.5 : 1;
  const out = 1 - (1 - u) * (1 - u);
  const fade = Math.max(0, 1 - u * 1.1);
  const c = b.color;
  const spray = (kind: number, count: number, reach: number, w: number, extra: Partial<Parameters<Fx3D['put']>[0]> = {}): void => {
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2 + b.seed;
      q.put({ kind: kind as Parameters<Fx3D['put']>[0]['kind'], x: b.x + Math.cos(ang) * reach * out * k, y: b.y + Math.sin(ang) * reach * 0.6 * out * k, up: 10 + Math.sin(u * Math.PI) * 12 * k, w: w * k, a: c, b: '#ffffff', alpha: fade, t: u, seed: b.seed + i, ...extra });
    }
  };
  if (b.heal) {
    // rising light
    q.put({ kind: FX.shaft, x: b.x, y: b.y, base: true, w: 22 * k, h: 60 * k, a: c, b: '#ffffff', t: u, alpha: fade });
    spray(FX.spark, 6, 14, 6, { up: 6 + u * 30 });
    return;
  }
  switch (b.school) {
    case 'fire':
      q.put({ kind: FX.blast, x: b.x, y: b.y, up: 10, w: 40 * k * (0.5 + out), a: c, b: '#ffe08a', t: u, seed: b.seed });
      spray(FX.spark, b.big ? 12 : 8, 26, 6);
      break;
    case 'frost':
      spray(FX.frost, b.big ? 10 : 7, 24, 10, { h: 5, rot: b.seed });
      q.put({ kind: FX.ring, x: b.x, y: b.y, flat: true, w: 44 * k * out, a: '#d8f4ff', t: u, seed: b.seed });
      break;
    case 'shadow':
      // a knot of shadow that swells and thins, a ring of its color running out along the ground under it, and wisps
      // thrown off. (This drew the closing Gloam's own effect, which is dark everywhere outside a radius it was never
      // given: a dark square over whoever a shadow spell hit. The owner, of the Gloamknight: "theres some black
      // square as an effect on the enemy ... this one just seems as the game is broken".)
      q.put({ kind: FX.shadow, x: b.x, y: b.y, up: 13, w: 30 * k * (0.55 + out * 0.75), a: c, b: '#120a20', alpha: fade, seed: b.seed });
      q.put({ kind: FX.ring, x: b.x, y: b.y, flat: true, w: 46 * k * out, a: c, t: u, seed: b.seed });
      spray(FX.shadow, b.big ? 9 : 6, 20, 11);
      break;
    case 'holy':
      q.put({ kind: FX.shaft, x: b.x, y: b.y, base: true, w: 20 * k, h: 70 * k, a: c, b: '#ffffff', t: u, alpha: fade });
      spray(FX.holy, 6, 20, 10);
      break;
    case 'nature':
      spray(FX.leaf, b.big ? 12 : 8, 26, 7, { h: 4, rot: b.seed + u * 6 });
      q.put({ kind: FX.poison, x: b.x, y: b.y, up: 8, w: 26 * k, a: c, b: '#e8ffb0', seed: b.seed });
      break;
    case 'arcane':
      q.put({ kind: FX.rune, x: b.x, y: b.y, flat: true, w: 40 * k, a: c, b: '#ffffff', t: u, seed: b.seed });
      spray(FX.spark, b.big ? 12 : 8, 24, 7);
      break;
    default:
      // a blow: a slash across them, and chips flying
      q.put({ kind: FX.slash, x: b.x, y: b.y, up: 14, flat: true, w: 40 * k, rot: b.seed, a: '#fff4e0', t: u, p1: 1.2, p2: 0 });
      spray(FX.chip, 6, 22, 5);
  }
  if (b.big) q.put({ kind: FX.shock, x: b.x, y: b.y, flat: true, w: 70 * out, a: c, t: u, seed: b.seed });
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
    } else if (a.kind === 'dot' || a.kind === 'hot') {
      lingering(q, f, a, time, lift);
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

/**
 * What lingers on someone, burning or mending, in its own spell's color: a poison bubbles, a curse wisps black, fire
 * licks and throws embers, a bleed drips, light and growth rise in motes. Several at once, each on its own clock.
 */
function lingering(q: Fx3D, f: Fighter, a: Fighter['auras'][number], time: number, lift: number): void {
  const ab = ABILITIES[a.ab];
  if (!ab) return;
  const c = ab.color;
  const seed = f.id * 3.1 + a.ab.length;
  const n = 5;
  for (let i = 0; i < n; i++) {
    // each mote rises and fades on its own phase, round the body
    const ph = (time * (a.kind === 'hot' ? 0.55 : 0.8) + i / n + seed * 0.13) % 1;
    const ang = i * 2.39 + seed + time * 0.6;
    const r = 6 + (i % 3) * 2;
    const x = f.x + Math.cos(ang) * r;
    const y = f.y + Math.sin(ang) * r * 0.5;
    const up = 4 + ph * 26 + lift;
    const fade = Math.max(0, Math.min(1, (1 - ph) * 1.6));
    if (a.kind === 'hot') {
      if (ab.school === 'nature') q.put({ kind: FX.leaf, x, y, up, w: 7, h: 4, rot: ph * 7 + i, a: i % 2 ? c : '#d8ffb0', alpha: fade });
      else q.put({ kind: FX.spark, x, y, up, w: 7 + (1 - ph) * 5, a: i % 2 ? c : '#fff6d0', t: ph * 0.6, seed: seed + i });
      continue;
    }
    switch (ab.school) {
      case 'fire':
        q.put({ kind: FX.flame, x, y, up: up * 0.5, base: true, w: 9, h: 12 + (1 - ph) * 6, rot: Math.PI / 2, a: c, b: '#ffe08a', seed: seed + i });
        if (i % 2) q.put({ kind: FX.spark, x, y, up: up + 6, w: 5, a: '#ffd36a', t: ph, seed: seed + i });
        break;
      case 'shadow':
        q.put({ kind: FX.shadow, x, y, up, w: 10 + (1 - ph) * 6, a: c, b: '#120a20', seed: seed + i });
        break;
      case 'nature':
        q.put({ kind: FX.poison, x, y, up: up * 0.7, w: 8 + (1 - ph) * 4, a: c, b: '#e8ffb0', seed: seed + i });
        break;
      case 'holy':
        q.put({ kind: FX.holy, x, y, up, w: 10, a: c, b: '#ffffff', seed: seed + i });
        break;
      case 'frost':
        q.put({ kind: FX.frost, x, y, up, w: 8, h: 4, rot: ang, a: c, b: '#ffffff', alpha: fade });
        break;
      case 'physical':
        // a bleed: drops falling from the wound
        q.put({ kind: FX.spark, x, y, up: 22 - ph * 18 + lift, w: 5, a: '#d0283c', t: ph * 0.5, seed: seed + i });
        break;
      default:
        q.put({ kind: FX.spark, x, y, up, w: 8, a: c, t: ph * 0.6, seed: seed + i });
    }
  }
}

/** The top layer of one frame. */
export function drawRing(m: Match, fx: RingFx, myId: number | null, time: number, view: RingStage): void {
  const me = myId === null ? null : (m.fighters[myId] ?? null);
  let g = view.groundLayer();
  if (m.phase === 'fight' && m.zone < ZONE_START - 0.01) gloamGround(g, m, view, time);
  // a shot is a thing to dodge: a fading line on the ground ahead of it, where it's going
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.lineCap = 'round';
  for (const b of m.bolts) {
    const sp = Math.hypot(b.vx, b.vy) || 1;
    const reach = Math.min(70, b.left);
    const from = view.spot(b.x, b.y + 8);
    const to = view.spot(b.x + (b.vx / sp) * reach, b.y + 8 + (b.vy / sp) * reach);
    const line = g.createLinearGradient(from.x, from.y, to.x, to.y);
    const c = ABILITIES[b.ab]?.color ?? '#ffffff';
    line.addColorStop(0, `${c}88`);
    line.addColorStop(1, `${c}00`);
    g.strokeStyle = line;
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(from.x, from.y);
    g.lineTo(to.x, to.y);
    g.stroke();
  }
  g.restore();
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

/** The Gloam on the ground: everything outside the safe oval darkened, and its edge glowing. */
function gloamGround(g: Ctx, m: Match, view: RingStage, time: number): void {
  const z = m.zone;
  const cx = ARENA_W / 2;
  const cy = ARENA_H / 2;
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    pts.push(view.spot(cx + Math.cos(a) * cx * z, cy + Math.sin(a) * cy * z));
  }
  const trace = (): void => {
    g.moveTo(pts[0]!.x, pts[0]!.y);
    for (const p of pts) g.lineTo(p.x, p.y);
    g.closePath();
  };
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.beginPath();
  g.rect(0, 0, g.canvas.width, g.canvas.height);
  trace();
  g.fillStyle = 'rgba(24,6,44,0.55)';
  g.fill('evenodd');
  g.beginPath();
  trace();
  const pulse = 0.65 + Math.sin(time * 4) * 0.2;
  g.strokeStyle = `rgba(190,130,255,${pulse})`;
  g.lineWidth = 5;
  g.stroke();
  g.strokeStyle = 'rgba(255,236,255,0.8)';
  g.lineWidth = 1.5;
  g.stroke();
  g.restore();
}
