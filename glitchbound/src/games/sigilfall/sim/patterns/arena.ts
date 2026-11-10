import { applyStatus } from '../combat';
import { circleHitsWall, TILE, tileAt } from '../map';
import type { Enemy } from '../types';
import type { World } from '../world';

/**
 * What a boss fight's own mechanics share (sim/patterns/crypt.ts, gallows.ts and the dungeons after them): the
 * fight's room, the open floor in it, and the things a fight puts down in it (candles, coffins, posts), which are
 * enemies drawn as props (EnemyDef.prop) so the hero, and the test bot, strike them like anything else.
 */

/** The fight goes on: the boss stands, isn't falling, its room hasn't reset (and, if given, it is still in that phase). */
export function fighting(w: World, e: Enemy, phase?: number): boolean {
  const b = e.boss;
  return !!b && !e.dead && b.dying <= 0 && w.enemies.includes(e) && (phase === undefined || b.phase === phase);
}

/** Someone of the fight still standing. */
export const standing = (w: World, x: Enemy | null | undefined): x is Enemy => !!x && !x.dead && x.hp > 0 && w.enemies.includes(x);
/** The same, as a plain answer (for a thing that is known to exist and may have fallen). */
export const up = (w: World, x: Enemy): boolean => standing(w, x);

/** The boss room's bounds in pixels (worked out once per fight). */
export function roomBox(w: World, e: Enemy): { x0: number; y0: number; x1: number; y1: number; cx: number; cy: number } {
  const m = e.boss!.misc;
  if (m.ax1 === undefined) {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    let sx = 0;
    let sy = 0;
    const tiles = w.map.roomTiles[e.room] ?? [];
    for (const i of tiles) {
      const tx = i % w.map.w;
      const ty = Math.floor(i / w.map.w);
      x0 = Math.min(x0, tx);
      y0 = Math.min(y0, ty);
      x1 = Math.max(x1, tx);
      y1 = Math.max(y1, ty);
      sx += tx;
      sy += ty;
    }
    if (!tiles.length) {
      x0 = x1 = Math.floor(e.x / TILE);
      y0 = y1 = Math.floor(e.y / TILE);
      sx = x0;
      sy = y0;
    }
    m.ax0 = x0 * TILE;
    m.ay0 = y0 * TILE;
    m.ax1 = (x1 + 1) * TILE;
    m.ay1 = (y1 + 1) * TILE;
    m.acx = ((sx / Math.max(1, tiles.length)) + 0.5) * TILE;
    m.acy = ((sy / Math.max(1, tiles.length)) + 0.5) * TILE;
  }
  return { x0: m.ax0!, y0: m.ay0!, x1: m.ax1, y1: m.ay1!, cx: m.acx!, cy: m.acy! };
}

/** A spot on the boss room's open floor with room for a circle of radius r. */
export function onFloor(w: World, e: Enemy, x: number, y: number, r: number): boolean {
  const i = tileAt(w.map, x, y);
  return i >= 0 && w.map.room[i] === e.room + 1 && !circleHitsWall(w.map, x, y, r);
}

/**
 * `n` spots on open floor in a ring of radius `r` round the room's middle (turned by `turn`), each moved in toward
 * the middle until it is open: where a fight's candles, coffins or posts stand.
 */
export function ringSpots(w: World, e: Enemy, n: number, r: number, turn = 0): { x: number; y: number }[] {
  const box = roomBox(w, e);
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = turn + (i / n) * Math.PI * 2;
    let placed = { x: box.cx, y: box.cy };
    for (let k = r; k >= 0; k -= 6) {
      const x = box.cx + Math.cos(a) * k;
      const y = box.cy + Math.sin(a) * k * 0.8;
      if (onFloor(w, e, x, y, 9)) {
        placed = { x, y };
        break;
      }
    }
    out.push(placed);
  }
  return out;
}

/** Puts down one of a fight's things (an enemy, often drawn as a prop) and returns it. */
export function spawnThing(w: World, e: Enemy, id: string, x: number, y: number): Enemy | null {
  const before = w.enemies.length;
  w.spawnAdd(id, x, y, e.room);
  const it = w.enemies.length > before ? w.enemies[w.enemies.length - 1]! : null;
  return it && it.def.id === id ? it : null;
}

/** Takes a fight's thing away at once (no loot, no kill credit): a coffin sinking, a post gone with its scaffold. */
export function removeThing(w: World, x: Enemy | null | undefined): void {
  if (!x || x.dead) return;
  x.hp = 0;
  x.dead = true;
  x.deathT = 0;
  w.fxBurst(x.x, x.y - 6, '#9a9aa8', 8, 10);
}

/** A stunned boss, open to every blow for a while (the reward for playing a fight's mechanic right). */
export function exposed(w: World, e: Enemy, secs: number, text: string, color: string): void {
  e.boss!.dazed = Math.max(e.boss!.dazed, secs);
  applyStatus(w, e, { status: 'mark', dur: secs + 1, power: 40 }, 0);
  w.text(e.x, e.y - e.r - 16, text, color, true);
  w.sfx('shieldBreak');
  w.shake(4);
  w.fxBurst(e.x, e.y - 8, color, 22, 18);
}

/** Whether a circle at (px, py) of radius pr touches a line `len` long and `width` wide from (x, y) along `a`. */
export function inLine(px: number, py: number, pr: number, x: number, y: number, a: number, len: number, width: number): boolean {
  const dx = px - x;
  const dy = py - y;
  const along = dx * Math.cos(a) + dy * Math.sin(a);
  const across = Math.abs(-dx * Math.sin(a) + dy * Math.cos(a));
  return along >= -pr && along <= len + pr && across <= width / 2 + pr;
}

/**
 * A wound of a set share of a boss's health, whoever the hero is (a fight's mechanic paying out: a hit through
 * hitEnemy would be scaled by the hero's power). Never the killing blow.
 */
export function wound(w: World, e: Enemy, share: number, color: string): void {
  const d = Math.min(e.hp - 1, e.maxHp * share);
  if (d <= 0) return;
  e.hp -= d;
  e.flash = 0.15;
  w.text(e.x, e.y - e.r - 4, `-${Math.round(d)}`, color, true);
}
