import { rng } from '../core/math';
import { K, moveCircle, TILE, type TileMap } from './map';

/**
 * The people of a place going about their day: villagers who walk between the doors, the square and the
 * streets of a town or a village, stop for a while, and walk on (the owner's references are full of them; a
 * village of standing quest-givers felt empty). They are decoration: nobody talks to them or fights them, they
 * walk through the hero, and they keep their own random numbers, so nothing they do changes a fight or a co-op
 * game. They stay indoors at night, while a place burns, and while the story fights in its streets.
 */
export interface Folk {
  x: number;
  y: number;
  /** Where they live (a door) and how far they wander from it. */
  hx: number;
  hy: number;
  /** Where they are walking to. */
  tx: number;
  ty: number;
  /** Seconds they stand before walking on. */
  wait: number;
  /** Seconds without getting anywhere (then they choose somewhere else). */
  stuck: number;
  speed: number;
  /** 0 down, 1 left, 2 right, 3 up (as the hero). */
  dir: number;
  walkT: number;
  moving: boolean;
  /** Which villager's look (render/art/townsfolk.ts, passerby). */
  look: number;
}

/** Ground they walk on: streets and squares first, the grass of the green too. */
const STREET = new Set<number>([K.Path, K.Cobble, K.Bridge]);
const GROUND = new Set<number>([K.Floor, K.Deco, K.Path, K.Cobble, K.Sand, K.Bridge]);
const WANDER = 7 * TILE;

/** Everyone at home in a place: a few for every house, more in a town, none where nobody lives. */
export function spawnFolk(map: TileMap, seed: number, town: boolean, squares: { x: number; y: number }[] | null): { folk: Folk[]; rand: () => number } {
  const rand = rng(seed ^ 0x5f0c);
  // out in the wilds only the village round a square is lived in (a lone farm has wolves at its fence)
  const lived = (b: TileMap['buildings'][number]): boolean => !squares || squares.some((q) => Math.hypot((b.lot.tx + b.lot.w / 2) * TILE - q.x, (b.lot.ty + b.lot.h) * TILE - q.y) < 30 * TILE);
  const doors = map.buildings.filter((b) => (b.style === 'house' || b.style === 'inn' || b.style === 'tavern' || b.style === 'shop' || b.style === 'smithy' || b.style === 'hall') && lived(b));
  if (doors.length < 3) return { folk: [], rand };
  // (a few people about their day: a town is lived in, not crowded)
  const n = Math.min(town ? 8 : 5, Math.round(doors.length * 0.3));
  const folk: Folk[] = [];
  // a third of them about the square and the market (a town's squares: its waystones), the rest by their doors
  const plazas = squares ?? map.markers.filter((pm) => pm.marker.kind === 'waystone').map((pm) => ({ x: (pm.tx + 0.5) * TILE, y: (pm.ty + 2.5) * TILE }));
  for (let k = 0; k < n; k++) {
    const b = doors[Math.floor(rand() * doors.length)]!;
    const square = plazas.length && k % 3 === 0 ? plazas[Math.floor(rand() * plazas.length)]! : null;
    const hx = square ? square.x : (b.lot.tx + b.lot.w / 2) * TILE;
    const hy = square ? square.y : (b.lot.ty + b.lot.h + 0.6) * TILE;
    const at = pickSpot(map, hx, hy, rand) ?? { x: hx, y: hy };
    folk.push({ x: at.x, y: at.y, hx, hy, tx: at.x, ty: at.y, wait: rand() * 4, stuck: 0, speed: 15 + rand() * 9, dir: 0, walkT: rand(), moving: false, look: Math.floor(rand() * 64) });
  }
  return { folk, rand };
}

/** Somewhere to walk to near home: on a street or the square most of the time. */
function pickSpot(map: TileMap, hx: number, hy: number, rand: () => number): { x: number; y: number } | null {
  let fallback: { x: number; y: number } | null = null;
  for (let tries = 0; tries < 14; tries++) {
    const x = hx + (rand() * 2 - 1) * WANDER;
    const y = hy + (rand() * 2 - 1) * WANDER * 0.7;
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    if (tx < 1 || ty < 1 || tx >= map.w - 1 || ty >= map.h - 1) continue;
    const i = ty * map.w + tx;
    if (map.solid[i] || !GROUND.has(map.kind[i]!)) continue;
    const spot = { x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE };
    if (STREET.has(map.kind[i]!)) return spot;
    fallback ??= spot;
  }
  return fallback;
}

export function updateFolk(folk: Folk[], map: TileMap, rand: () => number, dt: number): void {
  for (const f of folk) {
    f.moving = false;
    if (f.wait > 0) {
      f.wait -= dt;
      continue;
    }
    const dx = f.tx - f.x;
    const dy = f.ty - f.y;
    const d = Math.hypot(dx, dy);
    if (d < 2 || f.stuck > 1.2) {
      // arrived (or can't get there): stand a while, then somewhere else
      f.wait = f.stuck > 1.2 ? 0.3 : 1.5 + rand() * 5;
      f.stuck = 0;
      const next = pickSpot(map, f.hx, f.hy, rand);
      if (next) {
        f.tx = next.x;
        f.ty = next.y;
      }
      if (rand() < 0.5) f.dir = 0;
      continue;
    }
    const step = Math.min(d, f.speed * dt);
    const r = moveCircle(map, f.x, f.y, 3, (dx / d) * step, (dy / d) * step);
    const moved = Math.hypot(r.x - f.x, r.y - f.y);
    f.stuck = moved < step * 0.3 ? f.stuck + dt : 0;
    f.x = r.x;
    f.y = r.y;
    f.moving = moved > 0.01;
    f.walkT += dt;
    f.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : dy < 0 ? 3 : 0;
  }
}
