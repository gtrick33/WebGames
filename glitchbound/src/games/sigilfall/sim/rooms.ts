import { dist2, TAU } from '../core/math';
import type { Encounter, RoomLook, RoomMechanic, StatusId, Theme } from '../data/types';
import { mechanicKey } from '../progress/tips';
import { TILE } from './map';
import type { World } from './world';

/**
 * A dungeon room's own mechanic (POLISH_PLAN.md piece 18): while its waves are fought, the room itself does something
 * to play around, one thing to a room, set in its dungeon's data (Encounter.mechanic). Each is warned on the ground
 * before it lands, as a boss's blows are, and strikes only the hero (and a party's heroes): stones come down, vents
 * breathe in turns, a blade sweeps a line, shots fly from the walls, the Rift opens underfoot. The room's banner says
 * what it does as its fight begins, and the first time a hero meets each kind (with the hints on, as a boss's
 * mechanics are), the news says what to do about it. It stops when the room is cleared.
 *
 * Its chances are its own (World.roomRand), so a room's mechanic never changes what else a fight draws.
 */

interface Play {
  /** Seconds between one fall (or breath, or sweep) and the next. */
  every: number;
  /** How long it is warned on the ground. */
  warn: number;
  /** What it takes, as a share of the hero's health. */
  share: number;
}

// (a room presses the hero, it doesn't hound them: what is aimed at the hero comes every other time or less, so a
// caster can finish a cast between. Aimed every three seconds, the bots' mage no longer cleared Duskspire in its time)
const PLAY: Record<RoomMechanic, Play> = {
  rockfall: { every: 3.4, warn: 1.25, share: 0.08 },
  vents: { every: 1.8, warn: 1.1, share: 0.08 },
  blades: { every: 5, warn: 1.35, share: 0.1 },
  volley: { every: 4, warn: 1.05, share: 0.07 },
  rift: { every: 4.6, warn: 1.05, share: 0.09 },
};

/** What to do about each, said under its name as the room's fight begins. */
const HINTS: Record<RoomMechanic, string> = {
  rockfall: 'Step out of the marked circles before it lands.',
  vents: 'The vents breathe in turns: keep off the one marked.',
  blades: 'Get off the marked line before it sweeps.',
  volley: 'Step out of the marked lines.',
  rift: 'Keep moving: it opens where you stand.',
};

interface Look {
  /** What the room calls it. */
  call: string;
  color: string;
  status?: StatusId;
  /** What it leaves where it lands. */
  fx: 'rubble' | 'shard' | 'ember' | 'burst' | 'zap' | 'rift';
  sfx: string;
}

const LOOKS: Record<RoomLook, Look> = {
  stone: { call: 'The roof is coming down', color: '#a39886', fx: 'rubble', sfx: 'crumble' },
  brick: { call: 'Loose brick falls', color: '#9c7a64', fx: 'rubble', sfx: 'crumble' },
  ice: { call: 'Icicles fall', color: '#c4e8ff', status: 'chill', fx: 'shard', sfx: 'shard' },
  slag: { call: 'Slag drips from the roof', color: '#ff7a2a', status: 'burn', fx: 'ember', sfx: 'fireball' },
  glass: { call: 'Glass falls from the spire', color: '#d0b0ff', fx: 'shard', sfx: 'shard' },
  bough: { call: 'Rotten boughs fall', color: '#7c8a44', fx: 'rubble', sfx: 'crumble' },
  fire: { call: 'Fire vents', color: '#ff8a3a', status: 'burn', fx: 'ember', sfx: 'fireball' },
  bile: { call: 'Bile vents', color: '#9bcb52', status: 'poison', fx: 'burst', sfx: 'squish' },
  spore: { call: 'Spore vents', color: '#c4dc74', status: 'poison', fx: 'burst', sfx: 'puff' },
  frost: { call: 'Frost vents', color: '#c4e8ff', status: 'chill', fx: 'shard', sfx: 'freeze' },
  steam: { call: 'Steam vents', color: '#ececec', fx: 'burst', sfx: 'puff' },
  sand: { call: 'Sand jets', color: '#e4c88e', fx: 'burst', sfx: 'puff' },
  blade: { call: 'Blades sweep the room', color: '#dcdce6', status: 'bleed', fx: 'zap', sfx: 'whirl' },
  chain: { call: 'Chains swing across', color: '#a8a8b2', fx: 'zap', sfx: 'whirl' },
  water: { call: 'Water surges through', color: '#86c8ea', fx: 'zap', sfx: 'rush' },
  bolt: { call: 'Bolts from the walls', color: '#dccca4', fx: 'zap', sfx: 'volley' },
  dart: { call: 'Darts from the walls', color: '#ccb474', status: 'poison', fx: 'zap', sfx: 'volley' },
  spear: { call: 'Spears hurled from the dark', color: '#cdbfa6', fx: 'zap', sfx: 'spear' },
  riftbolt: { call: 'Rift bolts from the walls', color: '#ff3fd2', fx: 'zap', sfx: 'riftShot' },
  rift: { call: 'The Rift opens underfoot', color: '#ff3fd2', fx: 'rift', sfx: 'rift' },
};

/** A room mechanic's look when its room doesn't name one: by what it is and where. */
export function lookOf(kind: RoomMechanic, theme: Theme): RoomLook {
  switch (kind) {
    case 'rockfall':
      return theme === 'icecave' ? 'ice' : theme === 'lavacave' ? 'slag' : theme === 'riftspire' ? 'glass' : theme === 'roots' ? 'bough' : theme === 'cistern' ? 'brick' : 'stone';
    case 'vents':
      return theme === 'lavacave' || theme === 'keep' ? 'fire' : theme === 'cistern' ? 'bile' : theme === 'roots' ? 'spore' : theme === 'icecave' ? 'frost' : theme === 'temple' ? 'sand' : 'steam';
    case 'blades':
      return theme === 'cistern' ? 'water' : theme === 'keep' || theme === 'citadel' || theme === 'lavacave' ? 'chain' : 'blade';
    case 'volley':
      return theme === 'temple' ? 'dart' : theme === 'riftspire' ? 'riftbolt' : 'bolt';
    case 'rift':
      return 'rift';
  }
}

/** What the room calls its mechanic and what to do about it. */
export function roomCall(kind: RoomMechanic, look: RoomLook): { text: string; hint: string; color: string } {
  const l = LOOKS[look];
  return { text: l.call, hint: HINTS[kind], color: l.color };
}

/** The line under a room's name on its banner as its fight begins (sim/world.ts startEncounter): its waves, and what it does. */
export function roomBannerSub(enc: Encounter, theme: Theme): string {
  const waves = `${enc.waves.length} waves`;
  const m = enc.mechanic;
  return m ? `${waves} · ${roomCall(m.kind, m.look ?? lookOf(m.kind, theme)).text}` : waves;
}

/** The mechanic of the room being fought, and where it stands. */
export interface RoomPlay {
  /** The room (encounter index). */
  room: number;
  kind: RoomMechanic;
  look: RoomLook;
  /** Seconds to the next fall. */
  next: number;
  /** A vent room's vents, and whose turn it is. */
  vents: { x: number; y: number }[];
  turn: number;
  /** Across or down, turn about (blades). */
  across: boolean;
  /** The room's open ground, and its bounds (world px). */
  ground: { x: number; y: number }[];
  box: { x0: number; y0: number; x1: number; y1: number };
  /** What has been warned and will land: its look is drawn there when it does. */
  landing: { at: number; x: number; y: number; x2: number; y2: number; r: number }[];
}

/** The open floor of a room, away from its walls. */
function groundOf(w: World, room: number): { x: number; y: number }[] {
  const m = w.map;
  const out: { x: number; y: number }[] = [];
  for (const i of m.roomTiles[room] ?? []) {
    if (m.solid[i]) continue;
    const tx = i % m.w;
    const ty = (i - tx) / m.w;
    // (a tile with a wall beside it is the room's edge: nothing is aimed to land in its wall)
    if (m.solid[i - 1] || m.solid[i + 1] || m.solid[i - m.w] || m.solid[i + m.w]) continue;
    out.push({ x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE });
  }
  return out;
}

/** Vents spread over a room: each as far from the others as the room allows. */
function ventsOf(ground: { x: number; y: number }[], n: number, rand: () => number): { x: number; y: number }[] {
  if (!ground.length) return [];
  const out = [ground[Math.floor(rand() * ground.length)]!];
  while (out.length < Math.min(n, ground.length)) {
    let best = ground[0]!;
    let far = -1;
    for (const g of ground) {
      const d = Math.min(...out.map((o) => dist2(o.x, o.y, g.x, g.y)));
      if (d > far) {
        far = d;
        best = g;
      }
    }
    out.push(best);
  }
  return out;
}

/** The room being fought, if it has a mechanic: its play begun, or carried on. */
function playOf(w: World): RoomPlay | null {
  const enc = w.encounters.find((e) => e.state === 'active' && !e.def.boss && e.def.mechanic);
  if (!enc) return (w.roomPlay = null);
  if (w.roomPlay?.room === enc.index) return w.roomPlay;
  const def = enc.def.mechanic!;
  const look = def.look ?? lookOf(def.kind, w.region.theme);
  const ground = groundOf(w, enc.index);
  const xs = ground.map((g) => g.x);
  const ys = ground.map((g) => g.y);
  const box = ground.length ? { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) } : { x0: 0, y0: 0, x1: 0, y1: 0 };
  w.roomPlay = { room: enc.index, kind: def.kind, look, next: 2.2, vents: def.kind === 'vents' ? ventsOf(ground, 4, w.roomRand) : [], turn: 0, across: true, ground, box, landing: [] };
  // what to do about it: said once in the news, the first time a hero meets this kind, with the hints on
  const call = roomCall(def.kind, look);
  const key = mechanicKey(call.text);
  if (w.settings.tutorial && !w.hero.opened.includes(key)) {
    w.hero.opened.push(key);
    w.emit({ t: 'toast', text: `${call.text}. ${call.hint}`, tone: 'warn' });
  }
  return w.roomPlay;
}

/** The status a fall leaves on the hero, by its look. */
function statusOf(look: RoomLook, dmg: number): { status: StatusId; dur: number; power: number } | undefined {
  const s = LOOKS[look].status;
  if (!s) return undefined;
  return s === 'chill' ? { status: s, dur: 1.2, power: 0.35 } : { status: s, dur: 2.5, power: Math.max(1, dmg * 0.12) };
}

/** Runs the mechanic of the room being fought (World.step, not in a co-op guest's world: the host's lands for both). */
export function updateRooms(w: World, dt: number): void {
  const rp = playOf(w);
  if (!rp) return;
  // what was warned lands with its look
  if (rp.landing.length) {
    const look = LOOKS[rp.look];
    for (const l of rp.landing) {
      if (l.at > w.time) continue;
      if (look.fx === 'zap') w.addFx({ kind: 'zap', x: l.x, y: l.y, x2: l.x2, y2: l.y2, life: 0.25, size: 1.6, color: look.color });
      else if (look.fx === 'rift') w.addFx({ kind: 'rift', x: l.x, y: l.y, life: 0.6, size: l.r * 0.8, color: look.color });
      else {
        for (let k = 0; k < 8; k++) {
          const a = w.roomRand() * TAU;
          const s = 30 + w.roomRand() * 70;
          w.addFx({ kind: look.fx, x: l.x, y: l.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30, life: 0.55, size: 2 + Math.floor(w.roomRand() * 2), color: look.color });
        }
        w.addFx({ kind: 'smoke', x: l.x, y: l.y, life: 0.7, size: l.r * 0.5, color: look.color });
      }
      w.sfx(look.sfx, 0.5);
      if (rp.kind === 'rockfall') w.shake(1.5);
    }
    rp.landing = rp.landing.filter((l) => l.at > w.time);
  }
  const p = w.player;
  if (p.dead || w.scene) return;
  rp.next -= dt;
  if (rp.next > 0 || !rp.ground.length) return;
  const play = PLAY[rp.kind];
  rp.next = play.every * (0.85 + w.roomRand() * 0.3);
  // (as much harder as the foes are on a harder tier, but never past twice: a share of the hero's health that grew with
  // a Riftstone's might would soon take them at a blow)
  const dmg = p.maxHp * play.share * Math.min(2, w.foeDamageMul());
  const status = statusOf(rp.look, dmg);
  const tone = rp.kind === 'rift' ? 'rift' : 'enemy';
  const circle = (x: number, y: number, r: number): void => {
    w.addTelegraph({ shape: 'circle', x, y, r, r2: 0, angle: 0, len: 0, dur: play.warn, dmg, ...(status ? { status } : {}), knock: 90, tone, owner: -1, linger: 0 });
    rp.landing.push({ at: w.time + play.warn, x, y, x2: x, y2: y, r });
  };
  const line = (x: number, y: number, angle: number, len: number, width: number): void => {
    w.addTelegraph({ shape: 'line', x, y, r: 0, r2: width, angle, len, dur: play.warn, dmg, ...(status ? { status } : {}), knock: rp.look === 'water' ? 200 : 70, tone, owner: -1, linger: 0 });
    rp.landing.push({ at: w.time + play.warn, x, y, x2: x + Math.cos(angle) * len, y2: y + Math.sin(angle) * len, r: width });
  };
  // (somewhere on the room's open ground near a point)
  const near = (x: number, y: number, within: number): { x: number; y: number } => {
    const close = rp.ground.filter((g) => dist2(g.x, g.y, x, y) < within * within);
    const from = close.length ? close : rp.ground;
    return from[Math.floor(w.roomRand() * from.length)]!;
  };
  switch (rp.kind) {
    case 'rockfall': {
      // three about the hero, and every other time one of them where the hero stands (or is going)
      rp.turn += 1;
      if (rp.turn % 2 === 0) {
        const at = near(p.x + p.vx * 0.4, p.y + p.vy * 0.4, 30);
        circle(at.x, at.y, 28);
      }
      for (let k = rp.turn % 2 === 0 ? 1 : 0; k < 3; k++) {
        const o = near(p.x, p.y, 160);
        circle(o.x, o.y, 26);
      }
      break;
    }
    case 'vents': {
      const v = rp.vents[rp.turn % rp.vents.length]!;
      rp.turn += 1;
      circle(v.x, v.y, 36);
      break;
    }
    case 'blades': {
      // across the room through the hero, then down it, turn about
      const { x0, y0, x1, y1 } = rp.box;
      if (rp.across) line(x0 - TILE / 2, p.y, 0, x1 - x0 + TILE, 24);
      else line(p.x, y0 - TILE / 2, Math.PI / 2, y1 - y0 + TILE, 24);
      rp.across = !rp.across;
      break;
    }
    case 'volley': {
      // two shots from the room's edge across the room: one through where the hero stands, one through the room near them
      const { x0, y0, x1, y1 } = rp.box;
      const span = Math.hypot(x1 - x0, y1 - y0) + TILE * 2;
      for (let k = 0; k < 2; k++) {
        const side = Math.floor(w.roomRand() * 4);
        const t = w.roomRand();
        const sx = side === 0 ? x0 + (x1 - x0) * t : side === 1 ? x1 : side === 2 ? x0 + (x1 - x0) * t : x0;
        const sy = side === 0 ? y0 : side === 1 ? y0 + (y1 - y0) * t : side === 2 ? y1 : y0 + (y1 - y0) * t;
        const to = k === 0 ? p : near(p.x, p.y, 120);
        line(sx, sy, Math.atan2(to.y - sy, to.x - sx), span, 12);
      }
      break;
    }
    case 'rift': {
      const at = near(p.x + p.vx * 0.5, p.y + p.vy * 0.5, 26);
      circle(at.x, at.y, 30);
      break;
    }
  }
}
