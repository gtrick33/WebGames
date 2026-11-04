import { rng } from '../core/math';
import { K, moveCircle, TILE, type TileMap } from './map';
import { aimAlong, findRoute, turnToward, type Route } from './nav';

/**
 * The people of a place going about their day: villagers who walk between the doors, the square and the
 * streets of a town or a village, stop for a while, and walk on (the owner's references are full of them; a
 * village of standing quest-givers felt empty). They are decoration: nobody talks to them or fights them, and
 * they keep their own random numbers, so nothing they do changes a fight or a co-op game. They stay indoors at
 * night, while a place burns, and while the story fights in its streets.
 *
 * They plan a way round what stands (sim/nav.ts), turn as people turn, slow down for a corner, and step round anyone
 * in their way.
 */
export interface Folk {
  x: number;
  y: number;
  /** Where they live (a door) and how far they wander from it. */
  hx: number;
  hy: number;
  /** The way they're walking. */
  route: Route | null;
  /** Which way they're facing. */
  a: number;
  /** Seconds they stand before walking on. */
  wait: number;
  /** Seconds without getting anywhere (then they think again). */
  stuck: number;
  speed: number;
  walkT: number;
  moving: boolean;
  /** Which villager's look (render/art/townsfolk.ts, passerby). */
  look: number;
}

/** Anyone else about (the hero, the people who stand in a place). */
export interface Someone {
  x: number;
  y: number;
}

/** Ground they walk on: streets and squares first, the grass of the green too. */
const STREET = new Set<number>([K.Path, K.Cobble, K.Bridge]);
const GROUND = new Set<number>([K.Floor, K.Deco, K.Path, K.Cobble, K.Sand, K.Bridge]);
const WANDER = 7 * TILE;
/** Their body, and the room they plan for: planning wider than they are keeps them off what they pass. */
const BODY = 5;
const CLEARANCE = 9;
/** How fast they turn, radians a second. */
const TURN = 5.5;
/** How far off they notice someone in the way, and how far they keep from them. */
const NOTICE = 30;
const KEEP = 15;

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
    folk.push({ x: at.x, y: at.y, hx, hy, route: null, a: Math.PI / 2, wait: rand() * 4, stuck: 0, speed: 15 + rand() * 9, walkT: rand(), moving: false, look: Math.floor(rand() * 64) });
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

export function updateFolk(folk: Folk[], map: TileMap, rand: () => number, dt: number, others: readonly Someone[] = []): void {
  // (a walk's worth of thought, once a frame at most: nobody's plan costs a stutter)
  let planned = false;
  for (const f of folk) {
    f.moving = false;
    if (f.wait > 0) {
      f.wait -= dt;
      continue;
    }
    if (!f.route) {
      if (planned) continue;
      planned = true;
      const next = pickSpot(map, f.hx, f.hy, rand);
      f.route = next ? findRoute(map, f.x, f.y, next.x, next.y, { r: CLEARANCE, budget: 2600, roads: true }) : null;
      // (nowhere to go from here for now: they stand a little longer)
      if (!f.route) {
        f.wait = 0.8;
        continue;
      }
      f.stuck = 0;
    }
    const aim = aimAlong(f.route, f.x, f.y);
    if (!aim) {
      // arrived: stand a while, then somewhere else
      f.route = null;
      f.wait = 1.5 + rand() * 5;
      continue;
    }
    let ax = aim.x;
    let ay = aim.y;
    // anyone in the way: step round them, passing on the side they're already on
    const step = (o: Someone): void => {
      const ox = o.x - f.x;
      const oy = o.y - f.y;
      const d = Math.hypot(ox, oy);
      if (d >= NOTICE || d < 0.01) return;
      const ahead = (ox * ax + oy * ay) / d;
      if (ahead < 0.2) return;
      const side = ox * ay - oy * ax > 0 ? -1 : 1;
      const k = ((NOTICE - Math.max(d, KEEP)) / (NOTICE - KEEP)) * ahead * 1.4;
      const px = ay;
      const py = -ax;
      ax += px * side * k;
      ay += py * side * k;
    };
    for (const o of others) step(o);
    for (const o of folk) if (o !== f) step(o);
    const want = Math.atan2(ay, ax);
    f.a = turnToward(f.a, want, TURN, dt);
    // (walking on while turning, slowing for a sharp one)
    const off = Math.abs(Math.atan2(Math.sin(want - f.a), Math.cos(want - f.a)));
    const pace = f.speed * Math.max(0.25, 1 - off * 0.55);
    const wx = Math.cos(f.a) * pace * dt;
    const wy = Math.sin(f.a) * pace * dt;
    const r = moveCircle(map, f.x, f.y, BODY, wx, wy);
    const moved = Math.hypot(r.x - f.x, r.y - f.y);
    f.stuck = moved < pace * dt * 0.3 ? f.stuck + dt : 0;
    f.x = r.x;
    f.y = r.y;
    f.moving = moved > 0.01;
    f.walkT += dt;
    // (something's come to stand in the way: think again)
    if (f.stuck > 0.6) {
      f.route = null;
      f.wait = 0.3;
    }
  }
}
