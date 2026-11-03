import { ABILITIES } from '../arena/abilities';
import { ARENA_H, ARENA_W, ENTRY_GATES, ENTRY_W, ENTRY_Y0, ENTRY_Y1, MAPS, type Pillar, type RingMap } from '../arena/maps';
import { HERO_R, type Fighter, type Match } from '../arena/sim';
import { CLASSES } from '../data/classes';
import { creatureSprite, heroLook, heroSprite, weaponSprite, heldWeapon, type HeroDir } from './sprites';
import { newCharacter, type Face } from '../progress/character';

/**
 * The Ring on screen: a ground painted once at the game's own low resolution, then stone, heroes and spells over it
 * every frame, sorted by depth so that a hero can really be behind a pillar.
 */

type Ctx = CanvasRenderingContext2D;

function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const THEME = {
  sands: { dark: '#6a4a2a', mid: '#a87c48', light: '#c89a60', edge: '#3a2616', stone: '#a89a88', stoneDark: '#6c6052', stoneTop: '#cfc2ae', wall: '#4a3626', glow: '#ffb45c' },
  frost: { dark: '#7fa8c4', mid: '#d4e4f0', light: '#f4fafe', edge: '#1a3044', stone: '#9cc8e4', stoneDark: '#4f7ea2', stoneTop: '#e4f4fc', wall: '#1f3a52', glow: '#a8e8ff' },
  forge: { dark: '#2a1a1a', mid: '#4a3430', light: '#604640', edge: '#160c0c', stone: '#5a4a4a', stoneDark: '#2e2222', stoneTop: '#7a6462', wall: '#241414', glow: '#ff7a2a' },
} as const;

/** The margin around the ground: the stands and the gates. */
export const RING_PAD = { x: 14, top: 34, bottom: 10 };
export const RING_VIEW_W = ARENA_W + RING_PAD.x * 2;
export const RING_VIEW_H = ARENA_H + RING_PAD.top + RING_PAD.bottom;

export function paintGround(g: Ctx, map: RingMap): void {
  const th = THEME[map.theme];
  const rand = rng(map.id.length * 971 + 7);
  const W = RING_VIEW_W;
  const H = RING_VIEW_H;
  // the wall and stands around the ground
  g.fillStyle = th.edge;
  g.fillRect(0, 0, W, H);
  const stands = g.createLinearGradient(0, 0, 0, RING_PAD.top);
  stands.addColorStop(0, '#0a0614');
  stands.addColorStop(1, th.wall);
  g.fillStyle = stands;
  g.fillRect(0, 0, W, RING_PAD.top);
  // rows of faces in the dark, and banners
  for (let row = 0; row < 3; row++) {
    for (let x = 4 + row * 3; x < W; x += 7) {
      if (rand() < 0.28) continue;
      g.fillStyle = `rgba(${150 + rand() * 90},${120 + rand() * 80},${100 + rand() * 80},${0.16 + row * 0.1})`;
      g.fillRect(x, 6 + row * 7, 3, 4);
    }
  }
  for (const x of [60, 170, 282, 394, 506]) {
    g.fillStyle = th.stoneDark;
    g.fillRect(x - 1, 1, 2, RING_PAD.top - 6);
    g.fillStyle = map.color;
    g.beginPath();
    g.moveTo(x + 1, 3);
    g.lineTo(x + 11, 3);
    g.lineTo(x + 11, 18);
    g.lineTo(x + 6, 14);
    g.lineTo(x + 1, 18);
    g.closePath();
    g.fill();
  }
  // the front of the wall
  g.fillStyle = th.stoneDark;
  g.fillRect(0, RING_PAD.top - 8, W, 8);
  g.fillStyle = th.stoneTop;
  g.fillRect(0, RING_PAD.top - 9, W, 1);
  for (let x = 0; x < W; x += 13) {
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(x, RING_PAD.top - 8, 1, 8);
  }
  // the ground itself
  const X = RING_PAD.x;
  const Y = RING_PAD.top;
  g.save();
  g.beginPath();
  g.rect(X, Y, ARENA_W, ARENA_H);
  g.clip();
  g.fillStyle = th.mid;
  g.fillRect(X, Y, ARENA_W, ARENA_H);
  if (map.theme === 'frost') {
    // blown snow: speckle, then long soft drifts with a shadow on their lee side
    for (let i = 0; i < 2200; i++) {
      g.fillStyle = rand() < 0.6 ? '#ffffff' : '#a8c8de';
      g.globalAlpha = 0.14 + rand() * 0.32;
      g.fillRect(X + rand() * ARENA_W, Y + rand() * ARENA_H, 1 + rand() * 2, 1);
    }
    g.globalAlpha = 1;
    for (let i = 0; i < 16; i++) {
      const cx = X + rand() * ARENA_W;
      const cy = Y + rand() * ARENA_H;
      const rx = 22 + rand() * 46;
      const ry = 4 + rand() * 7;
      g.fillStyle = 'rgba(96,140,176,0.26)';
      g.beginPath();
      g.ellipse(cx + 2, cy + ry * 0.7, rx, ry, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.82)';
      g.beginPath();
      g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      g.fill();
    }
    // the mere itself: black water far under clear ice, with the cracks running out from where someone once fell
    const mere = (cx: number, cy: number, rx: number, ry: number): void => {
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.beginPath();
      g.ellipse(cx, cy + 2, rx + 5, ry + 4, 0, 0, Math.PI * 2);
      g.fill();
      const ice = g.createRadialGradient(cx - rx * 0.25, cy - ry * 0.3, 2, cx, cy, Math.max(rx, ry));
      ice.addColorStop(0, '#b4e6f8');
      ice.addColorStop(0.6, '#6fb4d8');
      ice.addColorStop(1, '#3f80ac');
      g.fillStyle = ice;
      g.beginPath();
      g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      g.fill();
      g.save();
      g.clip();
      g.strokeStyle = 'rgba(240,252,255,0.75)';
      g.lineWidth = 0.8;
      for (let i = 0; i < 9; i++) {
        let x = cx + (rand() - 0.5) * rx * 0.5;
        let y = cy + (rand() - 0.5) * ry * 0.5;
        const a = rand() * Math.PI * 2;
        g.beginPath();
        g.moveTo(x, y);
        for (let j = 0; j < 6; j++) {
          x += Math.cos(a + (rand() - 0.5) * 1.1) * (10 + rand() * 16);
          y += Math.sin(a + (rand() - 0.5) * 1.1) * (5 + rand() * 9);
          g.lineTo(x, y);
        }
        g.stroke();
      }
      // the shine lying across it
      g.fillStyle = 'rgba(255,255,255,0.24)';
      g.fillRect(cx - rx, cy - ry * 0.46, rx * 2, ry * 0.16);
      g.fillRect(cx - rx, cy - ry * 0.16, rx * 2, ry * 0.06);
      g.restore();
    };
    mere(X + ARENA_W / 2, Y + ARENA_H / 2, 96, 46);
    mere(X + 130, Y + 58, 34, 14);
    mere(X + ARENA_W - 130, Y + ARENA_H - 58, 34, 14);
    // old tracks across the snow
    g.fillStyle = 'rgba(96,136,170,0.34)';
    for (let i = 0; i < 26; i++) g.fillRect(X + 50 + i * 16, Y + 34 + Math.sin(i * 0.7) * 10 + (i % 2) * 4, 3, 2);
  } else if (map.theme === 'forge') {
    // black stone plates with fire in the seams
    for (let y = 0; y < ARENA_H; y += 34) {
      for (let x = -(y % 68) / 2; x < ARENA_W; x += 34) {
        g.fillStyle = rand() < 0.5 ? th.mid : th.light;
        g.fillRect(X + x, Y + y, 33, 33);
      }
    }
    g.strokeStyle = 'rgba(255,110,30,0.75)';
    g.lineWidth = 1;
    for (let i = 0; i < 14; i++) {
      let x = X + rand() * ARENA_W;
      let y = Y + rand() * ARENA_H;
      g.beginPath();
      g.moveTo(x, y);
      for (let j = 0; j < 7; j++) {
        x += (rand() - 0.5) * 26;
        y += (rand() - 0.5) * 26;
        g.lineTo(x, y);
      }
      g.stroke();
    }
  } else {
    // sand raked by old fights: speckle, drifts, and a dark stain or two
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = rand() < 0.5 ? th.light : th.dark;
      g.globalAlpha = 0.1 + rand() * 0.3;
      g.fillRect(X + rand() * ARENA_W, Y + rand() * ARENA_H, 1 + rand() * 2, 1);
    }
    g.globalAlpha = 1;
    for (let i = 0; i < 8; i++) {
      g.fillStyle = 'rgba(80,30,20,0.16)';
      g.beginPath();
      g.ellipse(X + rand() * ARENA_W, Y + rand() * ARENA_H, 8 + rand() * 20, 3 + rand() * 9, rand() * 3, 0, Math.PI * 2);
      g.fill();
    }
  }
  // the old sigil in the middle, worn nearly away
  g.strokeStyle = map.theme === 'forge' ? 'rgba(255,140,60,0.35)' : map.theme === 'frost' ? 'rgba(30,70,110,0.2)' : 'rgba(40,20,10,0.26)';
  g.lineWidth = 2;
  for (const r of [58, 44]) {
    g.beginPath();
    g.ellipse(X + ARENA_W / 2, Y + ARENA_H / 2, r * 1.3, r, 0, 0, Math.PI * 2);
    g.stroke();
  }
  // the gates' sides: each team's end, faintly its own
  // the entries lie in shadow, each lit faintly in its team's color
  g.fillStyle = 'rgba(6,2,14,0.34)';
  g.fillRect(X, Y + ENTRY_Y0, ENTRY_W, ENTRY_Y1 - ENTRY_Y0);
  g.fillRect(X + ARENA_W - ENTRY_W, Y + ENTRY_Y0, ENTRY_W, ENTRY_Y1 - ENTRY_Y0);
  const blue = g.createLinearGradient(X, 0, X + 80, 0);
  blue.addColorStop(0, 'rgba(70,140,255,0.2)');
  blue.addColorStop(1, 'rgba(70,140,255,0)');
  g.fillStyle = blue;
  g.fillRect(X, Y, 80, ARENA_H);
  const red = g.createLinearGradient(X + ARENA_W, 0, X + ARENA_W - 80, 0);
  red.addColorStop(0, 'rgba(255,70,70,0.2)');
  red.addColorStop(1, 'rgba(255,70,70,0)');
  g.fillStyle = red;
  g.fillRect(X + ARENA_W - 80, Y, 80, ARENA_H);
  // the edge of the light
  const v = g.createRadialGradient(X + ARENA_W / 2, Y + ARENA_H / 2, ARENA_H * 0.55, X + ARENA_W / 2, Y + ARENA_H / 2, ARENA_W * 0.66);
  v.addColorStop(0, 'rgba(10,4,20,0)');
  v.addColorStop(1, 'rgba(10,4,20,0.42)');
  g.fillStyle = v;
  g.fillRect(X, Y, ARENA_W, ARENA_H);
  g.restore();
  // each pillar's foot on the ground
  for (const p of map.pillars) {
    if (p.wall) continue;
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillRect(X + p.x - 2, Y + p.y + p.h - 4, p.w + 6, 8);
  }
  // the low wall on the sides and front
  g.fillStyle = th.stoneDark;
  g.fillRect(X - 5, Y, 5, ARENA_H + 4);
  g.fillRect(X + ARENA_W, Y, 5, ARENA_H + 4);
  g.fillRect(X - 5, Y + ARENA_H, ARENA_W + 10, 5);
}

/** How tall a pillar stands. */
const STONE_H = 30;

/** An entry's wall: low, plain stone, so it never hides who stands behind it. */
function drawWall(g: Ctx, p: Pillar, map: RingMap): void {
  const th = THEME[map.theme];
  const h = 8;
  g.fillStyle = th.stoneDark;
  g.fillRect(p.x, p.y + p.h - h, p.w, h);
  g.fillStyle = 'rgba(0,0,0,0.25)';
  for (let x = p.x + 6; x < p.x + p.w; x += 11) g.fillRect(x, p.y + p.h - h, 1, h);
  g.fillStyle = th.stone;
  g.fillRect(p.x, p.y - h, p.w, p.h);
  g.fillStyle = th.stoneTop;
  g.fillRect(p.x, p.y - h, p.w, 1);
  g.fillStyle = 'rgba(0,0,0,0.12)';
  for (let y = p.y - h + 11; y < p.y + p.h - h; y += 11) g.fillRect(p.x, y, p.w, 1);
}

/** One shard of ice standing out of the snow: a dark side, a lit side and a hard white edge. */
function shard(g: Ctx, x: number, y: number, w: number, h: number, lean: number): void {
  const tipX = x + lean;
  const tipY = y - h;
  g.fillStyle = '#4f8ebc';
  g.beginPath();
  g.moveTo(x - w / 2, y);
  g.lineTo(tipX, tipY);
  g.lineTo(x + w * 0.1, y + 1);
  g.closePath();
  g.fill();
  g.fillStyle = '#a8def6';
  g.beginPath();
  g.moveTo(x + w * 0.1, y + 1);
  g.lineTo(tipX, tipY);
  g.lineTo(x + w / 2, y);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.lineWidth = 0.8;
  g.beginPath();
  g.moveTo(x + w * 0.1, y);
  g.lineTo(tipX, tipY);
  g.stroke();
}

/** Stone on the frozen ground is ice: a thicket of shards the size of the block, tall enough to hide behind. */
function drawIce(g: Ctx, p: Pillar, time: number): void {
  const rand = rng(p.x * 31 + p.y * 17 + 5);
  g.fillStyle = 'rgba(50,90,130,0.3)';
  g.beginPath();
  g.ellipse(p.x + p.w / 2 + 3, p.y + p.h, p.w / 2 + 5, 5, 0, 0, Math.PI * 2);
  g.fill();
  // a footing of packed snow the shards stand in
  g.fillStyle = '#eef8fd';
  g.fillRect(p.x - 1, p.y - 1, p.w + 2, p.h + 2);
  g.fillStyle = '#c4e0ef';
  g.fillRect(p.x - 1, p.y + p.h - 2, p.w + 2, 3);
  const rows = Math.max(1, Math.round(p.h / 13));
  const across = Math.max(2, Math.round(p.w / 9));
  for (let r = 0; r < rows; r++) {
    const y = p.y + ((r + 0.8) / rows) * p.h;
    for (let i = 0; i < across; i++) {
      const x = p.x + ((i + 0.5) / across) * p.w + (rand() - 0.5) * 4;
      shard(g, x, y, 9 + rand() * 7, 18 + rand() * 22, (rand() - 0.5) * 7);
    }
  }
  // a glint walking over it
  const u = (time * 0.35 + p.x * 0.01) % 1;
  const gx = p.x + u * p.w;
  const gy = p.y + p.h * 0.4 - 16;
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.fillRect(gx - 0.5, gy - 3, 1, 6);
  g.fillRect(gx - 3, gy - 0.5, 6, 1);
}

function drawPillar(g: Ctx, p: Pillar, map: RingMap, time: number): void {
  if (p.wall) return drawWall(g, p, map);
  if (map.theme === 'frost') return drawIce(g, p, time);
  const th = THEME[map.theme];
  const x = p.x;
  const y = p.y;
  const top = y - STONE_H;
  // the sunlit top face, then the front, in blocks
  g.fillStyle = th.stoneDark;
  g.fillRect(x, top + p.h, p.w, y + p.h - (top + p.h));
  const courses = 4;
  for (let i = 0; i < courses; i++) {
    const cy = top + p.h + (i * STONE_H) / courses;
    g.fillStyle = i % 2 ? th.stoneDark : th.stone;
    g.globalAlpha = 0.86;
    g.fillRect(x + 1, cy + 1, p.w - 2, STONE_H / courses - 1);
    g.globalAlpha = 1;
    g.fillStyle = 'rgba(0,0,0,0.22)';
    for (let bx = (i % 2 ? 6 : 12); bx < p.w; bx += 12) g.fillRect(x + bx, cy + 1, 1, STONE_H / courses - 1);
  }
  g.fillStyle = th.stoneTop;
  g.fillRect(x, top, p.w, p.h);
  g.fillStyle = 'rgba(255,255,255,0.14)';
  g.fillRect(x, top, p.w, 1);
  g.fillRect(x, top, 1, p.h);
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.fillRect(x + p.w - 1, top, 1, p.h);
  g.fillRect(x, top + p.h - 1, p.w, 1);
  // a flame in a bowl on top of each, against the dark
  const cx = x + p.w / 2;
  const cy = top + p.h / 2;
  g.fillStyle = 'rgba(0,0,0,0.45)';
  g.beginPath();
  g.ellipse(cx, cy, 6, 4, 0, 0, Math.PI * 2);
  g.fill();
  const fl = 1 + Math.sin(time * 9 + x) * 0.15;
  const glow = g.createRadialGradient(cx, cy - 3, 0, cx, cy - 3, 16 * fl);
  glow.addColorStop(0, `${th.glow}cc`);
  glow.addColorStop(1, `${th.glow}00`);
  g.fillStyle = glow;
  g.fillRect(cx - 18, cy - 21, 36, 36);
  g.fillStyle = '#fff2c0';
  g.fillRect(cx - 1, cy - 5 - fl, 2, 4);
}

/** The entries: posts in each team's color either side of the mouth, and the portcullis until it lifts. */
function drawEntries(g: Ctx, m: Match, time: number): void {
  const lift = m.phase === 'gates' ? 0 : Math.min(1, m.clock / 0.9);
  for (const [i, gate] of ENTRY_GATES.entries()) {
    const color = i === 0 ? '#5a9cff' : '#ff5a5a';
    const x = gate.x + gate.w / 2;
    if (lift < 1) {
      const len = gate.h * (1 - lift);
      // rising out of sight: the bars run from the far post down, and climb away
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.fillRect(x - 3, gate.y, 7, len);
      for (let y = gate.y; y < gate.y + len; y += 7) {
        g.fillStyle = '#2a2430';
        g.fillRect(x - 3, y, 6, 2);
        g.fillStyle = '#6a6270';
        g.fillRect(x - 3, y, 6, 1);
      }
      g.fillStyle = '#4a4250';
      g.fillRect(x - 1, gate.y, 2, len);
    }
    for (const y of [gate.y, gate.y + gate.h]) {
      g.fillStyle = '#2a2430';
      g.fillRect(x - 5, y - 16, 10, 18);
      g.fillStyle = '#6a6270';
      g.fillRect(x - 5, y - 18, 10, 3);
      const fl = 1 + Math.sin(time * 9 + y + i) * 0.16;
      const glow = g.createRadialGradient(x, y - 22, 0, x, y - 22, 13 * fl);
      glow.addColorStop(0, `${color}cc`);
      glow.addColorStop(1, `${color}00`);
      g.fillStyle = glow;
      g.fillRect(x - 15, y - 37, 30, 30);
      g.fillStyle = '#fff2c0';
      g.fillRect(x - 1, y - 24 - fl, 2, 4);
    }
  }
}

export interface RingLook {
  look: ReturnType<typeof heroLook>;
  weapon: ReturnType<typeof weaponSprite>;
}

/** Every fighter's picture, made once. */
export function ringLooks(m: Match, mine: { face?: Face; body?: 'm' | 'f' }, myId: number | null): RingLook[] {
  return m.fighters.map((f) => {
    const hero = newCharacter(f.cls, f.name, 'ring');
    const isMe = f.id === myId;
    const body: 'm' | 'f' = isMe ? (mine.body ?? 'm') : f.id % 2 ? 'f' : 'm';
    const look = heroLook(f.cls, hero.equip, {}, body, isMe ? mine.face : undefined);
    const held = heldWeapon(f.cls, hero.equip.weapon);
    return { look, weapon: weaponSprite(held.kind, held.tint) };
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

const dirOf = (f: Fighter): { dir: HeroDir; flip: boolean } => {
  if (Math.abs(f.dirX) > Math.abs(f.dirY)) return { dir: 'side', flip: f.dirX < 0 };
  return { dir: f.dirY < 0 ? 'up' : 'down', flip: false };
};

function ring(g: Ctx, x: number, y: number, r: number, color: string, width = 1.4): void {
  g.strokeStyle = color;
  g.lineWidth = width;
  g.beginPath();
  g.ellipse(x, y, r, r * 0.55, 0, 0, Math.PI * 2);
  g.stroke();
}

function drawFighter(g: Ctx, m: Match, f: Fighter, l: RingLook, myId: number | null, time: number, targeted: boolean, friendSel: boolean, seeable: boolean): void {
  const { dir, flip } = dirOf(f);
  const moving = Math.hypot(f.vx, f.vy) > 1;
  const frame = moving ? (Math.floor(f.walk * 8) % 2) + 1 : 0;
  const sp = heroSprite(l.look, dir, frame);
  const w = sp.width / sp.k;
  const h = sp.height / sp.k;
  const gale = f.auras.some((a) => a.ab === 'l-gale' && a.cc === 'incap');
  const lift = gale ? 10 + Math.sin(time * 6) * 2 : 0;
  // the ground under them
  g.fillStyle = 'rgba(6,2,14,0.4)';
  g.beginPath();
  g.ellipse(f.x, f.y + 1, f.dead ? 12 : 8, 3.2, 0, 0, Math.PI * 2);
  g.fill();
  if (f.id === myId) ring(g, f.x, f.y + 1, 11, '#ffe39a', 1.4);
  if (targeted) {
    ring(g, f.x, f.y + 1, 13 + Math.sin(time * 5) * 0.8, '#ff5a6a', 1.8);
  } else if (friendSel) {
    ring(g, f.x, f.y + 1, 13, '#7fe06a', 1.6);
  }
  if (f.dead) {
    // fallen, on their side
    g.save();
    g.translate(f.x, f.y - 2);
    g.rotate(Math.PI / 2);
    g.globalAlpha = 0.72;
    g.drawImage(sp.c as CanvasImageSource, -h * 0.82, -w * 0.5, w, h);
    g.restore();
    return;
  }
  const hexed = f.auras.some((a) => a.ab === 'm-toad' && a.cc === 'incap');
  if (hexed) {
    const toad = creatureSprite('slime', Math.floor(time * 3) % 2);
    const tw = toad.width / toad.k;
    const th = toad.height / toad.k;
    g.drawImage(toad.c as CanvasImageSource, f.x - tw / 2, f.y - th + 2, tw, th);
  } else {
    const x = f.x - w / 2;
    const y = f.y - h + 3 - lift;
    const wp = l.weapon;
    const ww = wp.width / wp.k;
    const wh = wp.height / wp.k;
    const flipW = flip || dir === 'down';
    const wx = f.x + (flipW ? -7 : 7) - ww / 2;
    const wy = f.y - 16 - lift - wh * 0.4;
    if (dir === 'up') g.drawImage((flipW ? wp.f : wp.c) as CanvasImageSource, wx, wy, ww, wh);
    g.drawImage((flip ? sp.f : sp.c) as CanvasImageSource, x, y, w, h);
    if (dir !== 'up') g.drawImage((flipW ? wp.f : wp.c) as CanvasImageSource, wx, wy, ww, wh);
  }
  const head = f.y - h + 3 - lift;
  // what's on them
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
      ring(g, f.x, f.y + 1, 9, '#7ad65a', 2);
      g.fillStyle = '#4a8a3a';
      for (let i = 0; i < 5; i++) {
        const an = (i / 5) * Math.PI * 2;
        g.fillRect(f.x + Math.cos(an) * 8, f.y + Math.sin(an) * 4 - 4, 1.4, 5);
      }
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
      for (let i = 0; i < 4; i++) {
        const an = time * 11 + i * 1.6;
        ring(g, f.x + Math.cos(an) * 1.5, f.y - 3 - i * 5, 8 - i * 0.9, 'rgba(232,232,244,0.7)', 1);
      }
    } else if (a.kind === 'absorb') {
      g.strokeStyle = 'rgba(160,220,255,0.65)';
      g.lineWidth = 1;
      g.beginPath();
      g.arc(f.x, f.y - 12, 15, 0, Math.PI * 2);
      g.stroke();
    } else if (a.kind === 'immune') {
      const ice = a.still;
      g.fillStyle = ice ? 'rgba(170,225,255,0.42)' : 'rgba(255,226,140,0.24)';
      g.strokeStyle = ice ? '#dff4ff' : '#ffe39a';
      g.lineWidth = 1.2;
      g.beginPath();
      g.arc(f.x, f.y - 12, 16 + Math.sin(time * 5) * 0.8, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    } else if (a.kind === 'reflect') {
      g.strokeStyle = 'rgba(190,235,255,0.9)';
      g.lineWidth = 1;
      g.beginPath();
      g.arc(f.x, f.y - 12, 13, time * 3, time * 3 + 1.4);
      g.stroke();
    } else if (a.kind === 'guard') {
      ring(g, f.x, f.y + 1, 10, 'rgba(216,220,230,0.8)', 1.5);
    } else if (a.kind === 'fury') {
      g.fillStyle = 'rgba(255,70,90,0.5)';
      g.fillRect(f.x - 7 + Math.sin(time * 13) * 5, f.y - 6 - ((time * 26) % 22), 1.6, 1.6);
    }
  }
  // a name and a bar over the head; the bar in their team's color
  const barW = 24;
  const by = head - 6;
  g.fillStyle = 'rgba(6,2,14,0.8)';
  g.fillRect(f.x - barW / 2 - 0.5, by - 0.5, barW + 1, 3);
  const share = Math.max(0, f.hp / f.maxHp);
  g.fillStyle = f.team === m.fighters[myId ?? 0]?.team ? (share < 0.3 ? '#ff7a5a' : '#57d36a') : share < 0.3 ? '#ffb45c' : '#ff5a6a';
  g.fillRect(f.x - barW / 2, by, barW * share, 2);
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
    g.fillRect(f.x - barW / 2 - 0.5, by + 2.5, barW + 1, 2.4);
    g.fillStyle = ab?.color ?? '#fff';
    g.fillRect(f.x - barW / 2, by + 3, barW * (c.channel ? 1 - k : k), 1.5);
    // gathering in the hands
    const r = 3 + k * 3;
    const gl = g.createRadialGradient(f.x, f.y - 16, 0, f.x, f.y - 16, r * 2);
    gl.addColorStop(0, '#fffdf0');
    gl.addColorStop(0.4, ab?.color ?? '#fff');
    gl.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gl;
    g.fillRect(f.x - r * 2, f.y - 16 - r * 2, r * 4, r * 4);
  }
}

/** One frame. `g` is set up by the caller to the view's own units (RING_VIEW_W × RING_VIEW_H). */
export function drawRing(g: Ctx, ground: CanvasImageSource, m: Match, looks: RingLook[], fx: RingFx, myId: number | null, time: number): void {
  const map = MAPS[m.map] ?? Object.values(MAPS)[0]!;
  g.imageSmoothingEnabled = false;
  g.drawImage(ground, 0, 0, RING_VIEW_W, RING_VIEW_H);
  g.save();
  g.translate(RING_PAD.x, RING_PAD.top);
  const me = myId === null ? null : (m.fighters[myId] ?? null);
  g.save();
  g.beginPath();
  g.rect(0, 0, ARENA_W, ARENA_H);
  g.clip();
  for (const tr of m.traps) {
    const enemy = me && tr.team !== me.team;
    // an enemy's trap is hard to see, but not impossible
    g.globalAlpha = enemy ? 0.42 : 0.9;
    ring(g, tr.x, tr.y, 11, tr.arm > 0 ? '#a8a0b8' : '#e8c070', 1.5);
    g.fillStyle = '#6a5a3a';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.fillRect(tr.x + Math.cos(a) * 8 - 1, tr.y + Math.sin(a) * 4.4 - 1, 2, 2);
    }
    g.globalAlpha = 1;
  }
  g.restore();
  drawEntries(g, m, time);
  // stone and people, back to front
  const order: ({ y: number; p: Pillar } | { y: number; f: Fighter })[] = [...m.pillars.map((p) => ({ y: p.y + p.h, p })), ...m.fighters.map((f) => ({ y: f.y, f }))];
  order.sort((a, b) => a.y - b.y);
  const target = me?.target;
  const friend = me?.friend;
  for (const o of order) {
    if ('p' in o) drawPillar(g, o.p, map, time);
    else drawFighter(g, m, o.f, looks[o.f.id]!, myId, time, o.f.id === target, o.f.id === friend && o.f.id !== myId, !me || o.f === me || m.sees(me, o.f));
  }
  for (const b of m.bolts) {
    const ab = ABILITIES[b.ab];
    const c = ab?.color ?? '#fff';
    const t = m.fighters[b.tgt];
    const a = t ? Math.atan2(t.y - 8 - b.y, t.x - b.x) : 0;
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
      ring(g, f.x, f.y, f.r * (0.3 + u * 0.7), f.color, 3 - u * 2);
    } else {
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
    g.font = `700 ${size}px Georgia, serif`;
    g.globalAlpha = Math.max(0, 1 - u * u);
    g.lineWidth = 2;
    g.strokeStyle = '#120a20';
    g.strokeText(p.text, p.x, p.y - u * 14);
    g.fillStyle = p.color;
    g.fillText(p.text, p.x, p.y - u * 14);
  }
  g.globalAlpha = 1;
  g.restore();
  // snow coming down over the frozen ground
  if (map.theme === 'frost') {
    for (let i = 0; i < 46; i++) {
      const speed = 12 + (i % 6) * 5;
      const x = ((i * 83 + Math.sin(time * 0.7 + i) * 14 + time * (5 + (i % 3) * 4)) % RING_VIEW_W + RING_VIEW_W) % RING_VIEW_W;
      const y = (i * 53 + time * speed) % RING_VIEW_H;
      g.fillStyle = `rgba(255,255,255,${0.4 + (i % 4) * 0.15})`;
      const size = 1 + (i % 3) * 0.6;
      g.fillRect(x, y, size, size);
    }
  }
}

/** Which fighter a point in the view's units is on, if any. */
export function fighterAt(m: Match, vx: number, vy: number): Fighter | null {
  const x = vx - RING_PAD.x;
  const y = vy - RING_PAD.top;
  let best: Fighter | null = null;
  let bd = 26;
  for (const f of m.fighters) {
    if (f.dead) continue;
    const d = Math.hypot(f.x - x, f.y - 12 - y);
    if (d < bd) {
      bd = d;
      best = f;
    }
  }
  return best;
}

export const classColor = (cls: Fighter['cls']): string => CLASSES[cls].colors.accent;
