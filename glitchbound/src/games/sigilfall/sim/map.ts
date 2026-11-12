import { hash2 } from '../core/math';
import { MODEL_FOOT, modelOnLot, picBody, placeBuilding, yardProps, type PlacedPic } from '../data/buildingArt';
import { FEET, propBody, propReach, propStandsUp, dressedFor, keepsApart, PROPS } from '../data/props';
import { DRAWN } from '../data/propDrawn';
import { THEMES } from '../data/themes';
import type { Marker, PlacedMarkerDef, RegionDef, StoryCond } from '../data/types';
import { isWoody, treeOn, woodAt } from './woods';

/**
 * A region's tile map at runtime: terrain kinds, which room each floor tile belongs to, what is solid
 * right now (doors close, cracked walls break), plus collision, line of sight and a flow field that
 * lets enemies walk around obstacles. Pixels in, pixels out; tiles are 16 px.
 */

/** A tile, in world pixels. People, speeds and reaches are in world pixels too, so this is how big every land feels. */
export const TILE = 26;
/** The grid the building plans were measured on, whatever a tile is now. */
export const ART_TILE = 16;
/** How much wider the world is than those plans. */
export const WORLD_K = TILE / ART_TILE;

export const K = {
  Floor: 0,
  Deco: 1,
  Path: 2,
  Cobble: 3,
  Water: 4,
  Bridge: 5,
  Wall: 6,
  Tree: 7,
  Bush: 8,
  Rock: 9,
  Fence: 10,
  House: 11,
  HouseAnchor: 12,
  Pillar: 13,
  Brazier: 14,
  Cracked: 15,
  Door: 16,
  Illusion: 17,
  Bramble: 18,
  Prop: 19,
  Sand: 20,
  /** City walls (stone, too high to see over). */
  Rampart: 21,
} as const;
export type K = (typeof K)[keyof typeof K];

export const TERRAIN: Record<string, K> = {
  '.': K.Floor,
  ',': K.Deco,
  '=': K.Path,
  ':': K.Cobble,
  '~': K.Water,
  b: K.Bridge,
  '#': K.Wall,
  T: K.Tree,
  t: K.Bush,
  r: K.Rock,
  f: K.Fence,
  h: K.House,
  H: K.HouseAnchor,
  j: K.Pillar,
  Q: K.Brazier,
  Z: K.Cracked,
  D: K.Door,
  '%': K.Illusion,
  k: K.Bramble,
  u: K.Rock,
  s: K.Sand,
  '|': K.Rampart,
};

/** Kinds you can't walk through. */
const SOLID_KINDS = new Set<K>([K.Water, K.Wall, K.Tree, K.Bush, K.Rock, K.Fence, K.House, K.HouseAnchor, K.Pillar, K.Brazier, K.Cracked, K.Prop, K.Rampart]);
/**
 * Kinds that stop projectiles. Water, fences and the lone rocks of the open land don't: they are low enough to
 * shoot over (a playtester's spells kept catching on pebbles a third of a tile wide). Boulder fields are walls.
 */
const BLOCK_KINDS = new Set<K>([K.Wall, K.Tree, K.House, K.HouseAnchor, K.Pillar, K.Cracked, K.Rampart]);

export interface PlacedMarker {
  ch: string;
  /** Shown only while this story condition holds. */
  when?: StoryCond;
  marker: Marker;
  tx: number;
  ty: number;
  /** What it blocks, if it's a prop with a body. */
  body?: PropBody;
}

/** The ground a prop's body covers, in world pixels (`off` while the story has it not standing). */
export interface PropBody {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  off?: boolean;
}

export interface TileMap {
  w: number;
  h: number;
  kind: Uint8Array;
  /** Encounter index + 1 for room floors, 0 elsewhere. */
  room: Uint8Array;
  /** 1 = can't walk. Doors and cracked walls change it at runtime. */
  solid: Uint8Array;
  /** 1 = stops projectiles. */
  block: Uint8Array;
  markers: PlacedMarker[];
  /** Door tiles per encounter index. */
  doors: number[][];
  /** Room floor tiles per encounter index. */
  roomTiles: number[][];
  /** The buildings standing on their lots (data/buildingArt.ts): what is drawn is what is solid. */
  buildings: MapBuilding[];
  /** By tile, the bodies of the props that reach it: a walker bumps into what's there to see, not a whole tile. */
  bodies: (PropBody[] | undefined)[];
  /** 1 = something stands in the middle of it: a walker can stand on what's left of it, but routes go round. */
  clogged: Uint8Array;
  /** 1 = only the bodies on it stop a walker, though routes go round it (`solid`). */
  soft: Uint8Array;
  /** 1 = the first tile of a wood that can't be walked into: it is drawn thick, a tree or a great bush on every tile. */
  thicket: Uint8Array;
}

export interface MapBuilding {
  style: Extract<Marker, { kind: 'building' }>['style'] | 'house';
  name?: string;
  /** The lot the plan gave it (its top-left tile and size). */
  lot: { tx: number; ty: number; w: number; h: number };
  pics: PlacedPic[];
  /** The things standing in its yard: a Royal Keep prop on a (solid) tile. */
  yard: { prop: string; tx: number; ty: number }[];
  /** The tile of its way in (a door into an interior), if it has one. */
  door: [number, number] | null;
}

/**
 * No two things stand in each other (a lamp inside a watchtower, a tent in a tower's wall): what a generator set down
 * where something bigger already reaches moves aside onto the nearest clear ground, or isn't there. Only things that
 * stand at the same time: what the story brings later may take the place of what it took away.
 */
function settled(placed: readonly PlacedMarkerDef[], w: number, h: number): PlacedMarkerDef[] {
  // (a little overlap is only things standing close)
  const TOUCH = 12;
  const reachOf = (pm: PlacedMarkerDef): { w: number; d: number } | null => (pm.marker.kind === 'prop' && !pm.marker.through && propStandsUp(pm.marker.prop) ? propReach(pm.marker.prop) : null);
  const standing = placed.filter((pm) => reachOf(pm));
  if (!standing.length) return [...placed];
  const size = (pm: PlacedMarkerDef): number => {
    const r = reachOf(pm)!;
    return r.w * r.d;
  };
  const big = [...standing].sort((a, b) => size(b) - size(a));
  const taken = new Set<number>(placed.map((pm) => pm.ty * w + pm.tx));
  const fixed: { tx: number; ty: number; r: { w: number; d: number }; when: unknown }[] = [];
  // (where the story needs someone to stand is no place for a market stall)
  for (const pm of placed) {
    if (pm.marker.kind === 'place' || pm.marker.kind === 'spot') fixed.push({ tx: pm.tx, ty: pm.ty, r: { w: 30, d: 30 }, when: pm.when });
  }
  const hits = (tx: number, ty: number, r: { w: number; d: number }, when: unknown): boolean =>
    fixed.some((o) => {
      if (o.when !== when && o.when && when) return false;
      const ox = (o.r.w + r.w) / 2 - Math.abs(o.tx - tx) * TILE;
      const oy = (o.r.d + r.d) / 2 - Math.abs(o.ty - ty) * TILE;
      return ox > TOUCH && oy > TOUCH;
    });
  const moved = new Map<PlacedMarkerDef, PlacedMarkerDef | null>();
  for (const pm of big) {
    const r = reachOf(pm)!;
    let at: [number, number] | null = hits(pm.tx, pm.ty, r, pm.when) ? null : [pm.tx, pm.ty];
    for (let d = 1; d <= 3 && !at; d++) {
      for (let dy = -d; dy <= d && !at; dy++) {
        for (let dx = -d; dx <= d && !at; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== d) continue;
          const tx = pm.tx + dx;
          const ty = pm.ty + dy;
          if (tx < 1 || ty < 1 || tx >= w - 1 || ty >= h - 1 || taken.has(ty * w + tx) || hits(tx, ty, r, pm.when)) continue;
          at = [tx, ty];
        }
      }
    }
    if (!at) {
      moved.set(pm, null);
      continue;
    }
    fixed.push({ tx: at[0], ty: at[1], r, when: pm.when });
    if (at[0] !== pm.tx || at[1] !== pm.ty) {
      taken.add(at[1] * w + at[0]);
      moved.set(pm, { ...pm, tx: at[0], ty: at[1] });
    }
  }
  const out: PlacedMarkerDef[] = [];
  for (const pm of placed) {
    const m = moved.get(pm);
    if (m === null) continue;
    out.push(m ?? pm);
  }
  return out;
}

/**
 * Carves a road (path tiles, over grass only) from each way out of the land back to the nearest road, so a way out is
 * never a gap in the trees at the end of nothing. A way out with no road within reach is left as it was.
 */
function roadsOut(w: number, h: number, kind: Uint8Array, markers: { marker: Marker; tx: number; ty: number }[]): void {
  const open = (k: number): boolean => k === K.Floor || k === K.Deco || k === K.Path;
  const done = new Set<string>();
  for (const pm of markers) {
    if (pm.marker.kind !== 'exit' || pm.marker.door) continue;
    const key = `${pm.marker.to}`;
    // (a way out two tiles wide gets one road, in its middle)
    if (done.has(key)) continue;
    done.add(key);
    const start = pm.ty * w + pm.tx;
    const from = new Int32Array(w * h).fill(-1);
    from[start] = start;
    const q = [start];
    let found = -1;
    for (let qi = 0; qi < q.length && qi < 6000; qi++) {
      const i = q[qi]!;
      if (i !== start && kind[i] === K.Path) {
        found = i;
        break;
      }
      const x = i % w;
      const y = (i - x) / w;
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (from[j]! >= 0 || !open(kind[j]!)) continue;
        from[j] = i;
        q.push(j);
      }
    }
    if (found < 0) continue;
    // the way back, two tiles wide where the ground allows
    for (let i = found; i !== start; i = from[i]!) {
      const x = i % w;
      const y = (i - x) / w;
      for (const j of [i, x + 1 < w ? i + 1 : i, y + 1 < h ? i + w : i]) if (kind[j] === K.Floor || kind[j] === K.Deco) kind[j] = K.Path;
    }
    if (kind[start] === K.Floor || kind[start] === K.Deco) kind[start] = K.Path;
  }
}

export function parseRegion(def: RegionDef): TileMap {
  const h = def.map.length;
  const w = def.map[0]!.length;
  const kind = new Uint8Array(w * h);
  const room = new Uint8Array(w * h);
  const solid = new Uint8Array(w * h);
  const block = new Uint8Array(w * h);
  const markers: PlacedMarker[] = [];
  const roomOf = new Map(def.encounters.map((e, i) => [e.floor, i]));
  const roomTiles: number[][] = def.encounters.map(() => []);
  for (let y = 0; y < h; y++) {
    const row = def.map[y]!;
    for (let x = 0; x < w; x++) {
      const ch = row[x] ?? '#';
      const i = y * w + x;
      const marker = def.markers[ch];
      const r = roomOf.get(ch);
      if (marker) {
        markers.push({ ch, marker, tx: x, ty: y });
        // markers stand on floor; some are solid things in their own right
        kind[i] = marker.kind === 'prop' && marker.solid && hasBulk(marker.prop) ? K.Prop : marker.kind === 'waystone' || marker.kind === 'dummy' ? K.Prop : K.Floor;
        // a marker inside a room belongs to it
        const around = [row[x - 1], row[x + 1], def.map[y - 1]?.[x], def.map[y + 1]?.[x]];
        for (const a of around) {
          const rr = a !== undefined ? roomOf.get(a) : undefined;
          if (rr !== undefined) {
            room[i] = rr + 1;
            break;
          }
        }
      } else if (r !== undefined) {
        kind[i] = K.Floor;
        room[i] = r + 1;
      } else {
        kind[i] = TERRAIN[ch] ?? K.Wall;
      }
      if (room[i]) roomTiles[room[i] - 1]!.push(i);
      solid[i] = SOLID_KINDS.has(kind[i] as K) ? 1 : 0;
      block[i] = BLOCK_KINDS.has(kind[i] as K) ? 1 : 0;
    }
  }
  // doors belong to the rooms they touch
  const doors: number[][] = def.encounters.map(() => []);
  for (let i = 0; i < w * h; i++) {
    if (kind[i] !== K.Door) continue;
    const x = i % w;
    const y = (i - x) / w;
    const near = new Set<number>();
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const rr = room[ny * w + nx];
      if (rr) near.add(rr - 1);
    }
    for (const r of near) doors[r]!.push(i);
  }
  // markers a zone generator placed: they stand on the ground already there (sand, a road), or on grass
  for (const pm of settled(def.placed ?? [], w, h)) {
    const { tx, ty, marker } = pm;
    if (tx < 0 || ty < 0 || tx >= w || ty >= h) continue;
    const i = ty * w + tx;
    markers.push({ ch: '', marker, tx, ty, ...(pm.when ? { when: pm.when } : {}) });
    if ((marker.kind === 'prop' && marker.solid && hasBulk(marker.prop)) || marker.kind === 'waystone' || marker.kind === 'dummy') kind[i] = K.Prop;
    // buildings stand on their own footprint, which stays solid
    else if (marker.kind !== 'building' && SOLID_KINDS.has(kind[i] as K)) kind[i] = K.Floor;
    solid[i] = SOLID_KINDS.has(kind[i] as K) ? 1 : 0;
    block[i] = BLOCK_KINDS.has(kind[i] as K) ? 1 : 0;
  }
  // a road runs out to every way out of a land: the shortest way over open ground from the nearest road to its edge
  if (def.kind !== 'dungeon' && !def.interior) roadsOut(w, h, kind, markers);
  const over: [number, number][] = [];
  const buildings = standBuildings(def, w, h, kind, markers, over);
  const settle = (): void => {
    for (let i = 0; i < w * h; i++) {
      solid[i] = SOLID_KINDS.has(kind[i] as K) ? 1 : 0;
      block[i] = BLOCK_KINDS.has(kind[i] as K) ? 1 : 0;
    }
  };
  settle();
  inSight(markers, w, h, kind, solid, def.kind === 'wild');
  if (def.kind !== 'dungeon' && !def.interior) outOfSight(markers, w, h, kind, solid, block);
  apart(def, w, h, kind, solid, block, room, markers, buildings);
  // (what the dressing stood on a room's floor is no place for a foe to appear)
  for (let r = 0; r < roomTiles.length; r++) roomTiles[r] = roomTiles[r]!.filter((i) => !solid[i]);
  // what stands has a body of its own size: a bucket doesn't fill its tile, and a wagon runs over into the next ones
  const bodies: TileMap['bodies'] = new Array(w * h);
  const soft = new Uint8Array(w * h);
  const clogged = new Uint8Array(w * h);
  /** Puts a body on the tiles it stands on. */
  const standing = (body: PropBody, thin: boolean): void => {
    for (let y = Math.max(0, Math.floor(body.y0 / TILE)); y <= Math.min(h - 1, Math.floor(body.y1 / TILE)); y++) {
      for (let x = Math.max(0, Math.floor(body.x0 / TILE)); x <= Math.min(w - 1, Math.floor(body.x1 / TILE)); x++) {
        (bodies[y * w + x] ??= []).push(body);
        const mx = (x + 0.5) * TILE;
        const my = (y + 0.5) * TILE;
        const dx = mx - Math.max(body.x0, Math.min(mx, body.x1));
        const dy = my - Math.max(body.y0, Math.min(my, body.y1));
        // (a thin post leaves room either side of it, and so does what only clips the edge: a route can go by)
        const room = Math.max(body.y0 - y * TILE, (y + 1) * TILE - body.y1, body.x0 - x * TILE, (x + 1) * TILE - body.x1);
        if (!thin && dx * dx + dy * dy < CLEAR_OF_BODY * CLEAR_OF_BODY && room < WALK_BY) clogged[y * w + x] = 1;
      }
    }
  };
  const stand = (size: { w: number; d: number } | null, tx: number, ty: number): PropBody | undefined => {
    if (!size) return undefined;
    const cx = (tx + 0.5) * TILE;
    const cy = (ty + 0.5) * TILE;
    const body: PropBody = { x0: cx - size.w / 2, y0: cy - size.d / 2, x1: cx + size.w / 2, y1: cy + size.d / 2 };
    standing(body, size.w <= THIN_POST && size.d <= THIN_POST);
    if (kind[ty * w + tx] === K.Prop) soft[ty * w + tx] = 1;
    return body;
  };
  /** What a marker's model takes up, for the `block` tiles laid round it: its body is what's there to bump into. */
  const ownBoxes: { x0: number; y0: number; x1: number; y1: number }[] = [];
  for (const pm of markers) {
    const m = pm.marker;
    if (m.kind === 'prop' && FEET[m.prop]) {
      // (an arch is its feet: the way under it is open)
      const cx = (pm.tx + 0.5) * TILE;
      const cy = (pm.ty + 0.5) * TILE;
      for (const [dx, dy, fw, fd] of FEET[m.prop]!) standing({ x0: cx + dx - fw / 2, y0: cy + dy - fd / 2, x1: cx + dx + fw / 2, y1: cy + dy + fd / 2 }, false);
      if (kind[pm.ty * w + pm.tx] === K.Prop) soft[pm.ty * w + pm.tx] = 1;
    } else if (m.kind === 'prop' && !m.through && (m.solid || propStandsUp(m.prop))) pm.body = stand(propBody(m.prop), pm.tx, pm.ty);
    else if (m.kind === 'waystone') pm.body = stand({ w: 20, d: 16 }, pm.tx, pm.ty);
    else if (m.kind === 'dummy') pm.body = stand({ w: 14, d: 10 }, pm.tx, pm.ty);
    if (m.kind === 'prop' && m.prop !== 'block') {
      const reach = propReach(m.prop);
      if (reach && (FEET[m.prop] || propBody(m.prop))) {
        const cx = (pm.tx + 0.5) * TILE;
        const cy = (pm.ty + 0.5) * TILE;
        ownBoxes.push({ x0: cx - reach.w / 2 - 14, y0: cy - reach.d / 2 - 14, x1: cx + reach.w / 2 + 14, y1: cy + reach.d / 2 + 14 });
      }
    }
  }
  for (const b of buildings) for (const y of b.yard) stand(propBody(y.prop), y.tx, y.ty);
  // a `block` is for what has no body of its own. Laid round something that has one, it's a wall of air beside it
  for (const pm of markers) {
    if (pm.marker.kind !== 'prop' || pm.marker.prop !== 'block') continue;
    const mx = (pm.tx + 0.5) * TILE;
    const my = (pm.ty + 0.5) * TILE;
    if (pm.marker.solid && ownBoxes.some((q) => mx >= q.x0 && mx <= q.x1 && my >= q.y0 && my <= q.y1)) soft[pm.ty * w + pm.tx] = 1;
  }
  const thicket = new Uint8Array(w * h);
  if (def.kind !== 'dungeon' && !def.interior) openWoods(def, w, h, kind, solid, block, markers, buildings, thicket, standing);
  const map: TileMap = { w, h, kind, room, solid, block, markers, doors, roomTiles, buildings, bodies, soft, clogged, thicket };
  // a tall roof over the ground behind its lot is wall only if that cuts nobody off
  const start = markers.find((m) => m.marker.kind === 'start');
  if (over.length && start) {
    const f = flowField({ ...map, solid: solid.map((v, i) => (kind[i] === K.Cracked ? 0 : v)) }, start.tx, start.ty, 30000);
    const cut = markers.some((pm) => !PASSIVE.has(pm.marker.kind) && Math.max(...[0, 1, -1, w, -w].map((d) => f[pm.ty * w + pm.tx + d] ?? -1)) < 0);
    if (cut) {
      for (const [i, k] of over) kind[i] = k;
      settle();
    }
  }
  // a building is as solid as its model is wide: you walk up to its walls, and into nothing beside them
  for (const b of buildings) {
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    const tiles: number[] = [];
    for (let y = b.lot.ty; y < b.lot.ty + b.lot.h; y++) {
      for (let x = b.lot.tx; x < b.lot.tx + b.lot.w; x++) {
        if (x < 0 || y < 0 || x >= w || y >= h || kind[y * w + x] !== K.House) continue;
        tiles.push(y * w + x);
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x + 1);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y + 1);
      }
    }
    if (!tiles.length) continue;
    const stands = modelOnLot(b.style, b.lot, b.pics[0]?.grim === true, x0, x1, y0, y1, b.door?.[0] ?? null);
    const foot = stands ? MODEL_FOOT[stands.m] : undefined;
    if (!stands || !foot || stands.seat) continue;
    // (what's under its eaves and round its chimney isn't wall: a little in from the model's edges, its front at the front)
    const inX = (foot[2] - foot[0]) * stands.sx * 0.08;
    const inZ = (foot[3] - foot[1]) * stands.sz * 0.1;
    const body: PropBody = { x0: (stands.x + foot[0] * stands.sx + inX) * TILE, x1: (stands.x + foot[2] * stands.sx - inX) * TILE, y0: (stands.z + foot[1] * stands.sz + inZ) * TILE, y1: (stands.z + foot[3] * stands.sz - inZ * 0.5) * TILE };
    standing(body, false);
    for (const i of tiles) soft[i] = 1;
  }
  // (and a picture's roof past the back of its lot was never anything you could bump into)
  for (const [i] of over) if (kind[i] === K.House) soft[i] = 1;
  return map;
}

/** How deep into a wood's edge a walker can go, in tiles. */
const WOOD_DEEP = 2;
/** How near a way out of the land a wood stays whole: its gate's towers and walls stand there (render3d/gateways.ts). */
const GATE_CLEAR = 14;

/**
 * The edge of a wood is walked through, and what stops a walker there is what stands there (sim/woods.ts): a trunk, a
 * bush, a rock, each its own size, where every tile of it used to be a wall of air. The same for the trees that stand alone in
 * the open; a bush or a rock there fills its tile and stays one. Two tiles in, the wood closes (`thicket`, drawn thick).
 *
 * It never opens a way that wasn't there: a tile is only opened where all the open ground near it is one ground
 * already, counting a shut door, a wall to be broken and a hidden way as shut. So a hedge between two fields stays a
 * hedge, a boss's den stays closed behind its gate, and nothing walled in is let out.
 */
function openWoods(
  def: RegionDef,
  w: number,
  h: number,
  kind: Uint8Array,
  solid: Uint8Array,
  block: Uint8Array,
  markers: PlacedMarker[],
  buildings: MapBuilding[],
  thicket: Uint8Array,
  standing: (body: PropBody, thin: boolean) => void,
): void {
  const look = THEMES[def.theme];
  if (!look || look.indoor) return;
  const woody = isWoody(look) && !look.stone;
  const wide = !isWoody(look);
  const grows = (i: number): boolean => {
    const k = kind[i];
    return k === K.Tree || k === K.Bush || k === K.Rock || (woody && k === K.Wall);
  };
  // the grounds of the land: open tiles that are one walk from each other, with every door shut
  const ground = new Int32Array(w * h);
  const open = (i: number): boolean => !solid[i] && kind[i] !== K.Door && kind[i] !== K.Cracked && kind[i] !== K.Illusion;
  let grounds = 0;
  const queue = new Int32Array(w * h);
  for (let s = 0; s < w * h; s++) {
    if (ground[s] || !open(s)) continue;
    ground[s] = ++grounds;
    let head = 0;
    let tail = 0;
    queue[tail++] = s;
    while (head < tail) {
      const i = queue[head++]!;
      const x = i % w;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
        if (j < 0 || j >= w * h || ground[j] || !open(j)) continue;
        ground[j] = ground[i]!;
        queue[tail++] = j;
      }
    }
  }
  // how deep in the wood each of its tiles is, and which ground it is the edge of
  const deep = new Uint8Array(w * h);
  const of = new Int32Array(w * h);
  let ring: number[] = [];
  for (let i = 0; i < w * h; i++) if (ground[i]) ring.push(i);
  for (let d = 1; d <= WOOD_DEEP; d++) {
    const next: number[] = [];
    for (const i of ring) {
      const x = i % w;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
        if (j < 0 || j >= w * h || deep[j] || ground[j] || !grows(j)) continue;
        deep[j] = d;
        of[j] = ground[i] || of[i]!;
        next.push(j);
      }
    }
    ring = next;
  }
  // where a wood stays whole: at the map's edge, round the ways out (their gates stand there) and under what is built
  const whole = new Uint8Array(w * h);
  const keep = (x0: number, y0: number, x1: number, y1: number): void => {
    for (let y = Math.max(0, y0); y <= Math.min(h - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(w - 1, x1); x++) whole[y * w + x] = 1;
  };
  keep(0, 0, w - 1, 1);
  keep(0, h - 2, w - 1, h - 1);
  keep(0, 0, 1, h - 1);
  keep(w - 2, 0, w - 1, h - 1);
  for (const pm of markers) {
    if (pm.marker.kind === 'exit' && !pm.marker.door) keep(pm.tx - GATE_CLEAR, pm.ty - GATE_CLEAR, pm.tx + GATE_CLEAR, pm.ty + GATE_CLEAR);
    // (a dungeon's way in is a model set in the wood: a cave's mouth, a stair's head)
    else if (pm.marker.kind === 'exit') keep(pm.tx - 3, pm.ty - 4, pm.tx + 3, pm.ty + 2);
    // (a great tree or an arch clears the wood where it stands)
    else if (pm.marker.kind === 'prop' && FEET[pm.marker.prop]) keep(pm.tx - 3, pm.ty - 3, pm.tx + 3, pm.ty + 3);
  }
  for (const b of buildings) keep(b.lot.tx - 2, b.lot.ty - 3, b.lot.tx + b.lot.w + 1, b.lot.ty + b.lot.h + 1);
  // a tile opens only where everything round it is of the one ground
  const opens = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (!deep[i] || whole[i]) continue;
    const x = i % w;
    const y = Math.floor(i / w);
    let ok = true;
    for (let dy = -1; dy <= 1 && ok; dy++) {
      for (let dx = -1; dx <= 1 && ok; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        const g = ground[j] || (deep[j] && !whole[j] ? of[j]! : 0);
        if (g && g !== of[i]) ok = false;
      }
    }
    if (ok) opens[i] = 1;
  }
  const near = (x: number, y: number): number => {
    let n = 0;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      const k = nx < 0 || ny < 0 || nx >= w || ny >= h ? K.Wall : kind[ny * w + nx];
      if (k === K.Tree || k === K.Wall) n++;
    }
    return n;
  };
  const wall = (x: number, y: number): boolean => x < 0 || y < 0 || x >= w || y >= h || kind[y * w + x] === K.Wall;
  for (let i = 0; i < w * h; i++) {
    if (!opens[i]) continue;
    const x = i % w;
    const y = Math.floor(i / w);
    const k = kind[i];
    // (a bush or a rock of the open land nearly fills its tile, and stays a tile: opened, it left a rim a walker could
    // step onto and not off again. So does a tree of a thicket that is drawn as one of those)
    if (k === K.Bush || k === K.Rock) continue;
    const g = k === K.Wall ? woodAt(x, y, !wall(x, y + 1) || !wall(x - 1, y) || !wall(x + 1, y) || !wall(x, y - 1)) : treeOn(x, y, near(x, y), wide);
    if (g && k === K.Tree && (g.what !== 'tree' || g.body > THIN_POST / TILE)) continue;
    solid[i] = 0;
    block[i] = 0;
    if (g && g.body > 0) {
      const half = (g.body * TILE) / 2;
      // (not as a thin post, though a trunk is one: a route that ran through every trunk's tile had whoever followed
      // it walking into trunks all the way, and stopping at some. Routes go round a tile with a trunk in its middle)
      standing({ x0: g.x * TILE - half, y0: g.z * TILE - half, x1: g.x * TILE + half, y1: g.z * TILE + half }, false);
    }
  }
  if (!woody) return;
  for (let i = 0; i < w * h; i++) {
    if (kind[i] !== K.Wall || !solid[i]) continue;
    const x = i % w;
    const y = Math.floor(i / w);
    for (let dy = -1; dy <= 1 && !thicket[i]; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        if (!solid[ny * w + nx] && kind[ny * w + nx] === K.Wall) {
          thicket[i] = 1;
          break;
        }
      }
    }
  }
}

/**
 * What the camera comes in over from the south: someone to talk to or a chest to open standing right behind a house
 * can't be seen, so they stand round the front, on the nearest ground where they can.
 */
function inSight(markers: PlacedMarker[], w: number, h: number, kind: Uint8Array, solid: Uint8Array, packs = false): void {
  const RISE = Math.tan((50 * Math.PI) / 180);
  const tallAt = (i: number): number => {
    const k = kind[i];
    return k === K.Wall || k === K.Illusion ? 2.7 : k === K.Rampart ? 2.4 : k === K.House ? 3.2 : 0;
  };
  const unseen = (tx: number, ty: number, up: number): boolean => {
    for (let d = 1; d <= 5; d++) {
      const y = ty + d;
      if (y >= h) return false;
      const sight = up + (y + 0.5 - ty) * RISE;
      if (sight > 3.4) return false;
      if (tallAt(y * w + tx) > sight) return true;
    }
    return false;
  };
  const taken = new Set(markers.map((pm) => pm.ty * w + pm.tx));
  const gone = new Set<PlacedMarker>();
  // (a pack stands about its marker, a tile or two either side: none of them behind the wall. The owner, of a bone
  // catapult behind a ruin's wall: "there's also something behind the wall there that is not visible")
  // (to its top, not to where a head shows over it: a wall as it is built stands over three tiles with its merlons)
  // (nor a few steps back from it, showing over its top. A place's own pack is stood where it can be seen; one of the
  // land's wandering packs has nowhere it must be and is taken away: the owner, of a bone catapult that had wandered
  // into the Knights' Chapel's walled graveyard, moved two tiles off the wall and then round to its front: "i was just
  // asking to remove the catapult")
  // (what is built: a rampart, a house. The deep wood and the cliffs a land is closed with are walls to the map too,
  // and half a land's packs stand north of some of them: those are let be)
  const behind = (tx: number, ty: number): boolean => {
    for (let d = 1; d <= 3; d++) {
      const k = ty + d < h ? kind[(ty + d) * w + tx] : K.Floor;
      if (k === K.Rampart || k === K.House) return true;
    }
    return false;
  };
  const packUnseen = (tx: number, ty: number): boolean => [-1, 0, 1].some((dx) => [-1, 0, 1].some((dy) => behind(tx + dx, ty + dy)));
  for (const pm of markers) {
    const pack = packs && pm.marker.kind === 'pack';
    if (pm.marker.kind !== 'npc' && pm.marker.kind !== 'chest' && !pack) continue;
    const up = pm.marker.kind === 'npc' ? 0.95 : 0.4;
    if (pack && !packUnseen(pm.tx, pm.ty)) continue;
    if (pack && pm.marker.kind === 'pack' && pm.marker.roam) {
      gone.add(pm);
      continue;
    }
    if (!pack && !unseen(pm.tx, pm.ty, up)) continue;
    let best: [number, number] | null = null;
    let bd = Infinity;
    for (let y = pm.ty - 8; y <= pm.ty + 8; y++) {
      for (let x = pm.tx - 8; x <= pm.tx + 8; x++) {
        if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) continue;
        const i = y * w + x;
        if (solid[i] || kind[i] === K.Water || taken.has(i) || (pack ? packUnseen(x, y) || solid[i - 1] || solid[i + 1] : unseen(x, y, up))) continue;
        const d = Math.hypot(x - pm.tx, y - pm.ty);
        if (d < bd) {
          bd = d;
          best = [x, y];
        }
      }
    }
    if (best) {
      taken.add(best[1] * w + best[0]);
      pm.tx = best[0];
      pm.ty = best[1];
    }
  }
  for (let n = markers.length - 1; gone.size && n >= 0; n--) if (gone.has(markers[n]!)) markers.splice(n, 1);
}

/** What lies flat, grows underfoot or is only a rule: other things may stand over it. */
const LIES_LOW = new Set(['rug', 'runner', 'hall-floor', 'dais', 'sunbeam', 'window', 'bell-rope', 'block', 'guard-post', 'flowers', 'bones', 'skulls', 'debris', 'rubble', 'spores', 'candle-stub', 'candles', 'eggs', 'coin-pile', 'wheat', 'corn', 'thorns', 'bedroll']);
/** What is made to hold other things: a boat with its cargo aboard. */
const HOLDS: Readonly<Record<string, readonly string[]>> = { boat: ['barrel', 'crate', 'sacks', 'fish', 'basket'], wreck: ['barrel', 'crate'] };
/** What grows or lies in clumps: crystals shoulder to shoulder are a seam of crystal, not a mistake. */
const CLUMPS = new Set(['rift-crystal', 'ice-crystal', 'crystals', 'ember-rock', 'great-mushroom', 'menhir', 'root-tangle', 'rubble-heap', 'stone-heap', 'coal-heap', 'black-column', 'great-column', 'tall-column', 'column']);
/** The great trees: a wood's own trees stand under their crowns. */
const GROWN = new Set(['ancient-oak', 'green-oak', 'ancient-pine', 'dead-colossus', 'great-mushroom-tree']);
/** Ground a thing may be moved onto. */
const STANDS_ON = new Set<number>([K.Floor, K.Deco, K.Path, K.Cobble, K.Sand]);

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
const boxArea = (a: Box): number => (a.x1 - a.x0) * (a.y1 - a.y0);
const boxOverlap = (a: Box, b: Box): number => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));

/** The tiles round a spot, nearest first, out to three. */
const NEARBY: readonly (readonly [number, number])[] = (() => {
  const out: [number, number][] = [];
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (dx || dy) out.push([dx, dy]);
  return out.sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]) || a[1] - b[1] || a[0] - b[0]);
})();

/**
 * Nothing stands in anything else (the owner: "the collisions should be correct and there should not be overlapping
 * textures/models"). The rules that set things down each know their own thing: a stall and the goods beside it, a
 * house and what is in its yard, a camp's tents and the pack that guards them, a wood and the windmill built in it.
 * None knows how big another's model is drawn, so a crate stood half in a cart, a statue in a chapel's wall, a tree's
 * crown through a roof, a soldier in a tent. Here every model is measured as it is drawn (data/propDrawn.ts) and the
 * smaller of two that overlap is stood on the nearest clear ground, or left out if there is none; a tree at a
 * building's shoulder becomes a bush, one inside it is cleared; a pack is stood clear of what is built.
 *
 * What the story sets down and takes away keeps its place (the things round it give way), and so do buildings, arches
 * and the great trees. Things that lie flat may be stood over; a boat keeps its cargo; crystals keep their clumps.
 */
function apart(def: RegionDef, w: number, h: number, kind: Uint8Array, solid: Uint8Array, block: Uint8Array, room: Uint8Array, markers: PlacedMarker[], buildings: MapBuilding[]): void {
  const boxAt = (name: string, tx: number, ty: number): Box | null => {
    const d = DRAWN[name];
    if (!d || d[0] <= 0 || d[1] <= 0) return null;
    const cx = (tx + 0.5) * TILE;
    const cy = (ty + 0.5) * TILE;
    return { x0: cx - d[0] / 2, y0: cy - d[1] / 2, x1: cx + d[0] / 2, y1: cy + d[1] / 2 };
  };
  // what stands and stays: buildings as their models stand (a great dark keep rises over its whole yard and is let be)
  const built: Box[] = [];
  for (const b of buildings) {
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (let y = b.lot.ty; y < b.lot.ty + b.lot.h; y++) {
      for (let x = b.lot.tx; x < b.lot.tx + b.lot.w; x++) {
        if (x < 0 || y < 0 || x >= w || y >= h || kind[y * w + x] !== K.House) continue;
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x + 1);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y + 1);
      }
    }
    if (x1 < x0) continue;
    const st = modelOnLot(b.style, b.lot, b.pics[0]?.grim === true, x0, x1, y0, y1, b.door?.[0] ?? null);
    const f = st ? MODEL_FOOT[st.m] : undefined;
    if (!st || !f || st.seat) continue;
    built.push({ x0: (st.x + f[0] * st.sx) * TILE, x1: (st.x + f[2] * st.sx) * TILE, y0: (st.z + f[1] * st.sz) * TILE, y1: (st.z + f[3] * st.sz) * TILE });
  }
  const kept: { name: string; box: Box }[] = [];
  /** Whether a thing standing there would be in something that stands already. */
  const clash = (name: string, box: Box): boolean => {
    const a = boxArea(box);
    for (const q of built) if (boxOverlap(box, q) > 0.2 * a) return true;
    for (const q of kept) {
      if (HOLDS[q.name]?.includes(name) || HOLDS[name]?.includes(q.name)) continue;
      const most = CLUMPS.has(name) && CLUMPS.has(q.name) ? 0.36 : 0.18;
      if (boxOverlap(box, q.box) > most * Math.min(a, boxArea(q.box))) return true;
    }
    return false;
  };
  interface Mover {
    name: string;
    box: Box;
    pm?: PlacedMarker;
    yard?: { of: MapBuilding; at: MapBuilding['yard'][number] };
  }
  const movers: Mover[] = [];
  const storied: Mover[] = [];
  const taken = new Set<number>();
  for (const pm of markers) {
    if (pm.marker.kind !== 'building') taken.add(pm.ty * w + pm.tx);
    if (pm.marker.kind !== 'prop') continue;
    const name = pm.marker.prop.split(':')[0]!;
    if (LIES_LOW.has(name) || name === 'great' || FEET[name] || GROWN.has(name)) continue;
    const box = boxAt(name, pm.tx, pm.ty);
    if (!box) continue;
    // (what the story sets down and takes away keeps its place among things, and gives way only to a building: a
    // memorial stone set on a shop's lot before the shop was a shop's size)
    if (pm.when) storied.push({ name, box, pm });
    else movers.push({ name, box, pm });
  }
  for (const b of buildings) {
    for (const y of b.yard) {
      taken.add(y.ty * w + y.tx);
      const name = y.prop.split(':')[0]!;
      const box = LIES_LOW.has(name) ? null : boxAt(name, y.tx, y.ty);
      if (box) movers.push({ name, box, yard: { of: b, at: y } });
    }
  }
  // the bigger thing keeps its place
  movers.sort((a, b) => boxArea(b.box) - boxArea(a.box) || (a.pm?.ty ?? a.yard!.at.ty) - (b.pm?.ty ?? b.yard!.at.ty) || (a.pm?.tx ?? a.yard!.at.tx) - (b.pm?.tx ?? b.yard!.at.tx));
  /** The ground a thing stood on, when it leaves: what lies round it. */
  const groundAt = (i: number): number => {
    if (kind[i] !== K.Prop) return kind[i]!;
    const count = new Map<number, number>();
    for (const d of [-1, 1, -w, w]) {
      const k = kind[i + d];
      if (k !== undefined && STANDS_ON.has(k)) count.set(k, (count.get(k) ?? 0) + 1);
    }
    return [...count].sort((a, b) => b[1] - a[1])[0]?.[0] ?? K.Floor;
  };
  const IN_THE_WAY = new Set<number>([K.Wall, K.Rampart, K.Tree, K.Water, K.House, K.Rock, K.Fence, K.Pillar]);
  /** Whether a thing standing there would reach into a wall, a tree or the water beside it. */
  const into = (box: Box, tx: number, ty: number): boolean => {
    for (let y = Math.floor(box.y0 / TILE); y <= Math.floor((box.y1 - 0.01) / TILE); y++) {
      for (let x = Math.floor(box.x0 / TILE); x <= Math.floor((box.x1 - 0.01) / TILE); x++) {
        if ((x === tx && y === ty) || x < 0 || y < 0 || x >= w || y >= h || !IN_THE_WAY.has(kind[y * w + x]!)) continue;
        if (boxOverlap(box, { x0: x * TILE, y0: y * TILE, x1: (x + 1) * TILE, y1: (y + 1) * TILE }) > 0.3 * TILE * TILE) return true;
      }
    }
    return false;
  };
  const gone = new Set<PlacedMarker>();
  const inBuilding = (box: Box): boolean => built.some((q) => boxOverlap(box, q) > 0.2 * boxArea(box));
  for (const t of storied) {
    if (inBuilding(t.box)) {
      const i0 = t.pm!.ty * w + t.pm!.tx;
      for (const [dx, dy] of NEARBY) {
        const x = t.pm!.tx + dx;
        const y = t.pm!.ty + dy;
        if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) continue;
        const i = y * w + x;
        if (taken.has(i) || solid[i] || !STANDS_ON.has(kind[i]!) || room[i] !== room[i0]) continue;
        const box = boxAt(t.name, x, y)!;
        if (inBuilding(box) || into(box, x, y)) continue;
        const was = kind[i0]!;
        const under = groundAt(i0);
        kind[i0] = under;
        solid[i0] = SOLID_KINDS.has(under as K) ? 1 : 0;
        block[i0] = BLOCK_KINDS.has(under as K) ? 1 : 0;
        if (was === K.Prop) {
          kind[i] = K.Prop;
          solid[i] = 1;
          block[i] = 0;
        }
        taken.delete(i0);
        taken.add(i);
        t.pm!.tx = x;
        t.pm!.ty = y;
        t.box = box;
        break;
      }
    }
    kept.push({ name: t.name, box: t.box });
  }
  for (const t of movers) {
    if (!clash(t.name, t.box)) {
      kept.push({ name: t.name, box: t.box });
      continue;
    }
    const tx = t.pm ? t.pm.tx : t.yard!.at.tx;
    const ty = t.pm ? t.pm.ty : t.yard!.at.ty;
    const i0 = ty * w + tx;
    const was = kind[i0]!;
    const under = groundAt(i0);
    let to: [number, number, Box] | null = null;
    // (a yard's thing is its building's: with no room for it there, it is left out)
    for (const [dx, dy] of t.yard ? [] : NEARBY) {
      const x = tx + dx;
      const y = ty + dy;
      if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) continue;
      const i = y * w + x;
      if (taken.has(i) || solid[i] || !STANDS_ON.has(kind[i]!) || room[i] !== room[i0]) continue;
      // (roads stay clear: a thing is moved onto one only if it stood on one)
      if ((kind[i] === K.Path || kind[i] === K.Cobble) && kind[i] !== under) continue;
      const box = boxAt(t.name, x, y)!;
      if (clash(t.name, box) || into(box, x, y)) continue;
      to = [x, y, box];
      break;
    }
    kind[i0] = under;
    solid[i0] = SOLID_KINDS.has(under as K) ? 1 : 0;
    block[i0] = BLOCK_KINDS.has(under as K) ? 1 : 0;
    taken.delete(i0);
    if (!to) {
      if (t.pm) gone.add(t.pm);
      else t.yard!.of.yard.splice(t.yard!.of.yard.indexOf(t.yard!.at), 1);
      continue;
    }
    const i = to[1] * w + to[0];
    if (was === K.Prop) {
      kind[i] = K.Prop;
      solid[i] = 1;
      block[i] = 0;
    }
    taken.add(i);
    t.pm!.tx = to[0];
    t.pm!.ty = to[1];
    kept.push({ name: t.name, box: to[2] });
  }
  for (let n = markers.length - 1; gone.size && n >= 0; n--) if (gone.has(markers[n]!)) markers.splice(n, 1);
  const tall = kept.filter((q) => (DRAWN[q.name]?.[2] ?? 0) >= 10);
  // a pack stands clear of what is built: nobody appears inside a tent
  if (def.kind === 'wild') {
    const inside = (x: number, y: number): boolean => {
      const px = (x + 0.5) * TILE;
      const py = (y + 0.5) * TILE;
      const at = { x0: px - 9, y0: py - 9, x1: px + 9, y1: py + 9 };
      return built.some((q) => boxOverlap(at, q) > 0) || tall.some((q) => boxOverlap(at, q.box) > 0);
    };
    for (const pm of markers) {
      if (pm.marker.kind !== 'pack' || !inside(pm.tx, pm.ty)) continue;
      for (const [dx, dy] of NEARBY) {
        const x = pm.tx + dx;
        const y = pm.ty + dy;
        if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) continue;
        const i = y * w + x;
        if (taken.has(i) || solid[i] || !STANDS_ON.has(kind[i]!) || inside(x, y)) continue;
        taken.delete(pm.ty * w + pm.tx);
        taken.add(i);
        pm.tx = x;
        pm.ty = y;
        break;
      }
    }
  }
  // a tree at a building's shoulder, its crown through the eaves, is a bush there; one growing inside is cleared
  if (def.kind !== 'dungeon' && !def.interior) {
    const walls = [...built, ...tall.filter((q) => (DRAWN[q.name]?.[2] ?? 0) >= 20).map((q) => q.box)];
    for (let ty = 1; ty < h - 1; ty++) {
      for (let tx = 1; tx < w - 1; tx++) {
        const i = ty * w + tx;
        if (kind[i] !== K.Tree) continue;
        const crown = { x0: (tx - 0.25) * TILE, y0: (ty - 0.25) * TILE, x1: (tx + 1.25) * TILE, y1: (ty + 1.25) * TILE };
        const mx = (tx + 0.5) * TILE;
        const my = (ty + 0.5) * TILE;
        let next = K.Tree as number;
        for (const q of walls) {
          if (boxOverlap(crown, q) <= 0.15 * TILE * TILE) continue;
          const grows = mx > q.x0 - 5 && mx < q.x1 + 5 && my > q.y0 - 5 && my < q.y1 + 5;
          next = grows ? K.Floor : next === K.Floor ? K.Floor : K.Bush;
        }
        if (next === K.Tree) continue;
        kind[i] = next;
        solid[i] = SOLID_KINDS.has(next as K) ? 1 : 0;
        block[i] = BLOCK_KINDS.has(next as K) ? 1 : 0;
      }
    }
  }
}

/**
 * Nothing is set down where no one can see it (the owner: "there's also something behind the wall there that is not
 * visible"): a wagon, a rack or a lamp right behind a wall, a rampart or a house, its middle below the camera's line
 * over the top, is left out, and the ground it would have stood on is open. People and chests are moved round the
 * front instead (inSight); what the story sets down and takes away is the story's to place.
 */
function outOfSight(markers: PlacedMarker[], w: number, h: number, kind: Uint8Array, solid: Uint8Array, block: Uint8Array): void {
  const RISE = Math.tan((50 * Math.PI) / 180);
  // (to their tops as they are built, merlons and eaves and all: not to where a head would show over them)
  const tallAt = (i: number): number => {
    const k = kind[i];
    return k === K.Wall || k === K.Illusion || k === K.Rampart ? 3.3 : k === K.House ? 3.6 : 0;
  };
  for (let n = markers.length - 1; n >= 0; n--) {
    const pm = markers[n]!;
    if (pm.marker.kind !== 'prop' || pm.when) continue;
    const def = PROPS[pm.marker.prop.split(':')[0]!];
    // (a rule with no model has nothing to see; what lies flat is seen from above; a tower or a great tree is seen over anything)
    if (!def || !def.m || def.flat || (def.h ?? 0) > 2.2 * TILE) continue;
    const up = (def.h ?? 12) / TILE / 2;
    let hidden = false;
    for (let d = 1; d <= 3 && !hidden; d++) {
      const y = pm.ty + d;
      if (y >= h) break;
      const sight = up + (y + 0.5 - pm.ty) * RISE;
      if (sight > 3.7) break;
      if (tallAt(y * w + pm.tx) > sight) hidden = true;
    }
    if (!hidden) continue;
    const i = pm.ty * w + pm.tx;
    if (kind[i] === K.Prop) {
      kind[i] = K.Floor;
      solid[i] = 0;
      block[i] = 0;
    }
    markers.splice(n, 1);
  }
}

/** How far from what stands the middle of a tile has to be for a route to go through it (world pixels). */
const CLEAR_OF_BODY = 5.5;
/** How wide a way past something has to be for someone to walk by it, and how thin a post anyone can (world pixels). */
const WALK_BY = 13;
const THIN_POST = 6;

/**
 * Whether what's marked solid has anything to it: a plain `block` does, or something with a body. A candle marked solid
 * isn't a whole tile of wall around a candle.
 */
const hasBulk = (prop: string): boolean => prop === 'block' || prop.startsWith('great:') || propBody(prop) !== null || !!FEET[prop];

/** Markers that are not somewhere to get to (props, scenery, fires on roofs). */
const PASSIVE = new Set<string>(['prop', 'hazard', 'building', 'fire', 'wisp', 'place']);

/** Open ground a picture may stand over (a roof's peak over the grass behind its lot). */
const OVER = new Set<number>([K.Floor, K.Deco, K.Sand, K.Path, K.Cobble]);

/**
 * Stands each building's picture on its lot (a plan's building, or a generated village's house): the
 * tiles its walls and roof cover are solid, the rest of the lot is its yard, open ground with a few things
 * standing in it. So the hero meets a wall where a wall is drawn, never walks into a picture, and comes in
 * through the painted door.
 */
function standBuildings(def: RegionDef, w: number, h: number, kind: Uint8Array, markers: PlacedMarker[], over: [number, number][]): MapBuilding[] {
  const out: MapBuilding[] = [];
  const lots: { style: MapBuilding['style']; tx: number; ty: number; w: number; h: number; name?: string; art?: string; scale?: number; grim?: boolean; fit?: boolean }[] = [];
  for (const pm of markers) {
    const m = pm.marker;
    if (m.kind === 'building') lots.push({ style: m.style, tx: pm.tx, ty: pm.ty - m.h + 1, w: m.w, h: m.h, ...(m.name ? { name: m.name } : {}), ...(m.art ? { art: m.art } : {}), ...(m.scale ? { scale: m.scale } : {}), ...(m.grim ? { grim: true } : {}), ...(m.fit ? { fit: true } : {}) });
  }
  for (let i = 0; i < w * h; i++) if (kind[i] === K.HouseAnchor) lots.push({ style: 'house', tx: i % w, ty: Math.floor(i / w) - 2, w: 4, h: 3 });
  if (!lots.length) return out;
  // the tiles markers stand on stay open (a fire is not one: it goes on the roof, below)
  const taken = new Set(markers.filter((m) => m.marker.kind !== 'building' && m.marker.kind !== 'fire').map((m) => m.ty * w + m.tx));
  const ways = markers.filter((m) => m.marker.kind === 'exit' && m.marker.door);
  for (const lot of lots) {
    const inLot = (x: number, y: number): boolean => x >= lot.tx && x < lot.tx + lot.w && y >= lot.ty && y < lot.ty + lot.h;
    const col = lot.tx + Math.floor(lot.w / 2);
    const way = ways.find((d) => d.ty === lot.ty + lot.h && Math.abs(d.tx - col) <= 1) ?? null;
    const pics = placeBuilding(lot.style, lot, def.theme, def.kind === 'town', lot.art, way ? way.tx : null, { ...(lot.scale ? { scale: lot.scale } : {}), ...(lot.grim ? { grim: true } : {}), ...(lot.fit ? { fit: true } : {}) });
    // no wood grows up against a wall (the owner: "the church is placed inside the woods"): a land's own woods stand
    // back from what is built in them. Not along a ruled line ("don't cut it abruptly like that, it has to be
    // natural"): a rounded clearing whose edge gives way tree by tree, wider for a chapel, a keep or a hall than for a
    // house, and closing in again toward the land's own edge, which keeps its trees ("a forest surrounding it, just
    // not colliding directly"). Of the deep wood a land closes its unreached ground with, drawn as trees too, only
    // what stands at a great building's roof and shoulders goes: cleared far back, the Knights' Chapel stood in a bare
    // field, which the owner called horrendous
    if (def.kind === 'wild') {
      const great = lot.style === 'temple' || lot.style === 'keep' || lot.style === 'hall';
      const back = lot.style === 'house' || lot.style === 'tower' ? 1.5 : great ? 5.5 : 2.5;
      const cx = lot.tx + lot.w / 2;
      const cy = lot.ty + lot.h / 2;
      const rx = lot.w / 2 + back;
      const ry = lot.h / 2 + back;
      for (let y = Math.floor(cy - ry) - 1; y <= Math.ceil(cy + ry) + 1; y++) {
        for (let x = Math.floor(cx - rx) - 1; x <= Math.ceil(cx + rx) + 1; x++) {
          if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) continue;
          const i = y * w + x;
          const k = kind[i];
          if (k !== K.Tree && k !== K.Bush && k !== K.Wall) continue;
          const edge = Math.min(x, y, w - 1 - x, h - 1 - y);
          // how far out it is, as a share of the clearing: 1 at its rim
          const n = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
          if (k === K.Wall) {
            // (one tile at each flank and three rows behind its roof, no more: with the wood taken two and three tiles
            // back there was a strip of bare ground beside the Knights' Chapel that "players can venture" into. The
            // far row gives way tree by tree, so the notch isn't ruled either)
            const at = x >= lot.tx - 1 && x < lot.tx + lot.w + 1 && y >= lot.ty - 3 && y < lot.ty + lot.h;
            const rim = y === lot.ty - 3 && hash2(x, y, 917) < 0.45;
            if (great && edge >= 4 && at && !rim) kind[i] = K.Floor;
            continue;
          }
          // right against it, always; further out, a ragged rim
          const at = x >= lot.tx - 1 && x < lot.tx + lot.w + 1 && y >= lot.ty - 2 && y < lot.ty + lot.h + 2;
          const inside = n < 0.72 + 0.4 * hash2(x, y, 911);
          const kept = edge < 4 || (edge < 8 && hash2(x, y, 913) > (edge - 3) / 5);
          if ((at && edge >= 2) || (inside && !kept)) kind[i] = K.Floor;
        }
      }
    }
    for (let y = lot.ty; y < lot.ty + lot.h; y++) {
      for (let x = lot.tx; x < lot.tx + lot.w; x++) {
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const i = y * w + x;
        if (kind[i] === K.House || kind[i] === K.HouseAnchor) kind[i] = K.Floor;
      }
    }
    // a tile is wall where the picture's walls and roof cover a good part of it
    for (const p of pics) {
      const [x0, y0, x1, y1] = picBody(p);
      for (let ty = Math.floor(y0 / ART_TILE); ty <= Math.floor((y1 - 1) / ART_TILE); ty++) {
        for (let tx = Math.floor(x0 / ART_TILE); tx <= Math.floor((x1 - 1) / ART_TILE); tx++) {
          if (tx < 0 || ty < 0 || tx >= w || ty >= h) continue;
          const ox = Math.min(x1, (tx + 1) * ART_TILE) - Math.max(x0, tx * ART_TILE);
          const oy = Math.min(y1, (ty + 1) * ART_TILE) - Math.max(y0, ty * ART_TILE);
          if (ox < 4 || oy < 6) continue;
          const i = ty * w + tx;
          // a story marker on the lot (a fire on the roof) keeps its tile
          if (taken.has(i)) continue;
          if (inLot(tx, ty)) kind[i] = K.House;
          else if (OVER.has(kind[i]!)) {
            over.push([i, kind[i]!]);
            kind[i] = K.House;
          }
        }
      }
    }
    // where its model will stand (render3d/land.ts stands it the same way): over the tiles its picture made solid, but
    // with its own door on the door's tile, so it can reach a tile past them. A yard tile under it is not free: the
    // statue at Briarhollow's chapel stood inside the chapel's wall (the owner: "the statue here in briarhollow is
    // inside the chapel, fix it or remove it completely")
    let mx0 = Infinity;
    let mx1 = -Infinity;
    let my0 = Infinity;
    let my1 = -Infinity;
    for (let y = lot.ty; y < lot.ty + lot.h; y++) {
      for (let x = lot.tx; x < lot.tx + lot.w; x++) {
        if (x < 0 || y < 0 || x >= w || y >= h || kind[y * w + x] !== K.House) continue;
        mx0 = Math.min(mx0, x);
        mx1 = Math.max(mx1, x + 1);
        my0 = Math.min(my0, y);
        my1 = Math.max(my1, y + 1);
      }
    }
    const stands = mx1 > mx0 ? modelOnLot(lot.style, lot, !!lot.grim, mx0, mx1, my0, my1, way?.tx ?? null) : null;
    const foot = stands ? MODEL_FOOT[stands.m] : undefined;
    const within = (x: number, y: number, by: number): boolean =>
      !!stands && !!foot && x + 1 > stands.x + foot[0] * stands.sx - by && x < stands.x + foot[2] * stands.sx + by && y + 1 > stands.z + foot[1] * stands.sz - by && y < stands.z + foot[3] * stands.sz + by;
    const under = (x: number, y: number): boolean => within(x, y, 0.15);
    /** Under its eaves: against the wall, where a low thing is fine and a tall one stands up into the roof. */
    const eaves = (x: number, y: number): boolean => within(x, y, 0.75);
    // its yard: a few things on the free tiles of the lot's front rows, clear of the doorway
    const free: number[] = [];
    for (let y = Math.max(lot.ty, lot.ty + lot.h - 2); y < lot.ty + lot.h; y++) {
      for (let x = lot.tx; x < lot.tx + lot.w; x++) {
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const i = y * w + x;
        if (kind[i] !== K.Floor || taken.has(i) || (way && Math.abs(x - way.tx) <= 1) || under(x, y)) continue;
        free.push(i);
      }
    }
    free.sort((a, b) => hash2(a % w, Math.floor(a / w), 57) - hash2(b % w, Math.floor(b / w), 57));
    const yard: MapBuilding['yard'] = [];
    // (a great dark keep rises far over its own lot, front rows and all: nothing is set down under it)
    const seat = lot.style === 'keep' && !!lot.grim;
    for (const given of seat ? [] : yardProps(lot.style, lot, Math.min(3, Math.ceil(free.length / 2)))) {
      // (as the land would have it: no flowerbeds on ash or by a dead lake)
      const prop = dressedFor(def.theme, given);
      // never beside another of its own kind (two statues shoulder to shoulder read as a mistake), nor within its
      // kind's keep of one the town already set down (a chapel's statue two steps from the square's): the next free place
      const apart = keepsApart(prop);
      const beside = (i: number): boolean =>
        yard.some((y) => y.prop === prop && Math.abs(y.tx - (i % w)) <= 1 && Math.abs(y.ty - Math.floor(i / w)) <= 1) ||
        (apart > 0 && markers.some((pm) => pm.marker.kind === 'prop' && pm.marker.prop.split(':')[0] === prop && Math.abs(pm.tx - (i % w)) <= apart + 1 && Math.abs(pm.ty - Math.floor(i / w)) <= apart + 1));
      // (a statue is taller than the eaves it would stand under: the chapel's stood head and horns in its roof)
      const tall = (PROPS[prop]?.h ?? 0) + (PROPS[prop]?.hero ?? 0) > 44;
      const at = free.findIndex((i) => !beside(i) && !(tall && eaves(i % w, Math.floor(i / w))));
      if (at < 0) continue;
      const i = free.splice(at, 1)[0]!;
      // (a flowerbed is walked over: only what has a body to bump into takes the tile)
      if (propBody(prop)) kind[i] = K.Prop;
      yard.push({ prop, tx: i % w, ty: Math.floor(i / w) });
    }
    out.push({ style: lot.style, ...(lot.name ? { name: lot.name } : {}), lot: { tx: lot.tx, ty: lot.ty, w: lot.w, h: lot.h }, pics, yard, door: way ? [way.tx, way.ty] : null });
  }
  // flames the story puts on a roof burn on the roof the picture has (the plan knew only the lot)
  const bodies = out.flatMap((b) => b.pics.map(picBody));
  for (const pm of markers) {
    if (pm.marker.kind !== 'fire') continue;
    const fx = (pm.tx + 0.5) * ART_TILE;
    const fy = (pm.ty + 0.5) * ART_TILE;
    let best: [number, number, number, number] | null = null;
    let bd = ART_TILE * 2.5;
    for (const r of bodies) {
      const d = Math.hypot(Math.max(r[0] - fx, 0, fx - r[2]), Math.max(r[1] - fy, 0, fy - r[3]));
      if (d < bd) [best, bd] = [r, d];
    }
    if (!best) continue;
    const [x0, y0, x1, y1] = best;
    // somewhere along the roof, keeping which side of it the fire was on
    const rx = Math.min(x1 - 6, Math.max(x0 + 6, fx));
    pm.tx = Math.floor(rx / ART_TILE);
    pm.ty = Math.floor((y0 + (y1 - y0) * 0.3) / ART_TILE);
  }
  return out;
}

export const tileAt = (m: TileMap, px: number, py: number): number => {
  const tx = Math.floor(px / TILE);
  const ty = Math.floor(py / TILE);
  if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return -1;
  return ty * m.w + tx;
};

export function solidAt(m: TileMap, px: number, py: number): boolean {
  const i = tileAt(m, px, py);
  return i < 0 || m.solid[i] === 1;
}

export function blocksAt(m: TileMap, px: number, py: number): boolean {
  const i = tileAt(m, px, py);
  return i < 0 || m.block[i] === 1;
}

/** Whether a circle overlaps any solid tile, or the body of any prop. */
export function circleHitsWall(m: TileMap, x: number, y: number, r: number): boolean {
  const x0 = Math.floor((x - r) / TILE);
  const x1 = Math.floor((x + r) / TILE);
  const y0 = Math.floor((y - r) / TILE);
  const y1 = Math.floor((y + r) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return true;
      const i = ty * m.w + tx;
      const list = m.bodies[i];
      if (list) {
        for (const b of list) {
          if (b.off) continue;
          const nx = Math.max(b.x0, Math.min(x, b.x1));
          const ny = Math.max(b.y0, Math.min(y, b.y1));
          if ((nx - x) * (nx - x) + (ny - y) * (ny - y) < r * r) return true;
        }
      }
      if (!m.solid[i] || m.soft[i]) continue;
      // nearest point of the tile to the circle center
      const nx = Math.max(tx * TILE, Math.min(x, tx * TILE + TILE));
      const ny = Math.max(ty * TILE, Math.min(y, ty * TILE + TILE));
      if ((nx - x) * (nx - x) + (ny - y) * (ny - y) < r * r) return true;
    }
  }
  return false;
}

/**
 * Moves a circle by (dx, dy), sliding along walls: X then Y, in steps no longer than a quarter tile
 * so nothing tunnels. Returns the new position and whether each axis was blocked.
 */
export function moveCircle(m: TileMap, x: number, y: number, r: number, dx: number, dy: number): { x: number; y: number; bx: boolean; by: boolean } {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 4));
  const sx = dx / steps;
  const sy = dy / steps;
  let bx = false;
  let by = false;
  for (let i = 0; i < steps; i++) {
    if (!bx && sx !== 0) {
      if (circleHitsWall(m, x + sx, y, r)) bx = true;
      else x += sx;
    }
    if (!by && sy !== 0) {
      if (circleHitsWall(m, x, y + sy, r)) by = true;
      else y += sy;
    }
  }
  return { x, y, bx, by };
}

/** Clear line between two points for projectiles and sight (walks the tiles the segment crosses). */
export function lineOfSight(m: TileMap, x0: number, y0: number, x1: number, y1: number): boolean {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const n = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 6);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (blocksAt(m, x0 + dx * t, y0 + dy * t)) return false;
  }
  return true;
}

/** The farthest free point from (x, y) toward angle `a`, up to `dist` (for blinks and dashes). */
export function castRay(m: TileMap, x: number, y: number, r: number, a: number, dist: number): { x: number; y: number } {
  const c = Math.cos(a);
  const s = Math.sin(a);
  let lx = x;
  let ly = y;
  for (let d = 2; d <= dist; d += 2) {
    const nx = x + c * d;
    const ny = y + s * d;
    // stop at the first wall: never through doors or into sealed rooms
    if (circleHitsWall(m, nx, ny, r)) break;
    lx = nx;
    ly = ny;
  }
  return { x: lx, y: ly };
}

/**
 * Distance field (in tiles) from a target tile over walkable tiles, out to `max` steps. Enemies step
 * to the neighbour with the smallest value, so they path around walls instead of pushing into them.
 */
export function flowField(m: TileMap, tx: number, ty: number, max: number, out?: Int16Array): Int16Array {
  const f = out && out.length === m.w * m.h ? out : new Int16Array(m.w * m.h);
  f.fill(-1);
  if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return f;
  const q = new Int32Array(m.w * m.h);
  let head = 0;
  let tail = 0;
  const start = ty * m.w + tx;
  f[start] = 0;
  q[tail++] = start;
  while (head < tail) {
    const i = q[head++]!;
    const d = f[i]!;
    if (d >= max) continue;
    const x = i % m.w;
    if (x > 0) visit(i - 1);
    if (x < m.w - 1) visit(i + 1);
    if (i >= m.w) visit(i - m.w);
    if (i < m.w * (m.h - 1)) visit(i + m.w);
    function visit(j: number): void {
      if (f[j] !== -1 || m.solid[j] || m.clogged[j]) return;
      f[j] = d + 1;
      q[tail++] = j;
    }
  }
  return f;
}

/** The direction to step from (px, py) following a flow field, or null when off the field. */
export function flowStep(m: TileMap, f: Int16Array, px: number, py: number): { x: number; y: number } | null {
  const tx = Math.floor(px / TILE);
  const ty = Math.floor(py / TILE);
  const here = f[ty * m.w + tx];
  if (here === undefined) return null;
  // (someone standing beside a small thing, on a tile routes go round: on to the nearest tile that's on the way)
  if (here < 0 && !m.soft[ty * m.w + tx] && !m.clogged[ty * m.w + tx]) return null;
  let best = here < 0 ? 32767 : here;
  let bx = 0;
  let by = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = tx + dx;
      const ny = ty + dy;
      if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) continue;
      const v = f[ny * m.w + nx]!;
      if (v < 0 || v >= best) continue;
      // no corner cutting through walls
      if (dx && dy && (m.solid[ty * m.w + nx] || m.solid[ny * m.w + tx])) continue;
      best = v;
      bx = dx;
      by = dy;
    }
  }
  if (!bx && !by) return null;
  // aim for the middle of the next tile, or for what's clear of it if something stands there
  const aim = clearPartOf(m, tx + bx, ty + by);
  const cx = aim.x - px;
  const cy = aim.y - py;
  const l = Math.hypot(cx, cy) || 1;
  const x = cx / l;
  const y = cy / l;
  // a brazier can stand in the middle of a tile the route goes through: whoever follows it steps round
  return m.bodies[ty * m.w + tx] || m.bodies[(ty + by) * m.w + tx + bx] ? roundWhatStands(m, px, py, x, y) : { x, y };
}

/**
 * The point of a tile to walk through: its middle, unless a body stands over that, and then the nearest point of the
 * tile that a walker fits past it. (A route may go through a gap beside a pavilion, and whoever makes for the middle of
 * the tile only walks into the pavilion.)
 */
function clearPartOf(m: TileMap, tx: number, ty: number): { x: number; y: number } {
  let x = (tx + 0.5) * TILE;
  let y = (ty + 0.5) * TILE;
  const list = m.bodies[ty * m.w + tx];
  if (!list) return { x, y };
  const x0 = tx * TILE + 1;
  const x1 = (tx + 1) * TILE - 1;
  const y0 = ty * TILE + 1;
  const y1 = (ty + 1) * TILE - 1;
  for (const b of list) {
    if (b.off) continue;
    const nx = Math.max(b.x0, Math.min(x, b.x1));
    const ny = Math.max(b.y0, Math.min(y, b.y1));
    if ((nx - x) * (nx - x) + (ny - y) * (ny - y) >= CLEAR_AIM * CLEAR_AIM) continue;
    let best = Infinity;
    let bx = x;
    let by = y;
    const consider = (ax: number, ay: number): void => {
      if (ax < x0 || ax > x1 || ay < y0 || ay > y1) return;
      const d = Math.abs(ax - x) + Math.abs(ay - y);
      if (d < best) {
        best = d;
        bx = ax;
        by = ay;
      }
    };
    consider(b.x0 - CLEAR_AIM, y);
    consider(b.x1 + CLEAR_AIM, y);
    consider(x, b.y0 - CLEAR_AIM);
    consider(x, b.y1 + CLEAR_AIM);
    x = bx;
    y = by;
  }
  return { x, y };
}

/** How far from a body someone following a route aims to pass. */
const CLEAR_AIM = 7;

/** How far ahead someone following a route looks for what's in the way, and how wide they take to be. */
const LOOK_AHEAD = 9;
const STEP_WIDE = 6;
const TURNS = [0.6, 1.1, 1.6];

/** The way (dx, dy), or the nearest to it that isn't straight into something, turning away from what's there. */
function roundWhatStands(m: TileMap, px: number, py: number, dx: number, dy: number): { x: number; y: number } {
  const free = (x: number, y: number): boolean => !circleHitsWall(m, px + x * LOOK_AHEAD, py + y * LOOK_AHEAD, STEP_WIDE);
  if (free(dx, dy)) return { x: dx, y: dy };
  // (the side they're already on, which doesn't flicker from one step to the next; failing that, always the same one)
  const tile = m.bodies[Math.floor((py + dy * LOOK_AHEAD) / TILE) * m.w + Math.floor((px + dx * LOOK_AHEAD) / TILE)]?.[0];
  const across = tile ? dx * (py - (tile.y0 + tile.y1) / 2) - dy * (px - (tile.x0 + tile.x1) / 2) : 0;
  const side = across < 0 ? -1 : 1;
  for (const a of TURNS) {
    for (const s of [side, -side]) {
      const c = Math.cos(a * s);
      const n = Math.sin(a * s);
      const x = dx * c - dy * n;
      const y = dx * n + dy * c;
      if (free(x, y)) return { x, y };
    }
  }
  return { x: dx, y: dy };
}

/** Tile-center position of a marker. */
export const markerPos = (pm: PlacedMarker): { x: number; y: number } => ({ x: (pm.tx + 0.5) * TILE, y: (pm.ty + 0.5) * TILE });

export function setDoors(m: TileMap, room: number, closed: boolean): void {
  for (const i of m.doors[room] ?? []) {
    m.solid[i] = closed ? 1 : 0;
    m.block[i] = closed ? 1 : 0;
  }
}

/**
 * The nearest point where a circle overlaps no wall (a door that slammed shut on top of someone).
 * Searches outward in rings, preferring tiles of `room` when given; returns null if nothing is free
 * within two tiles.
 */
export function pushOut(m: TileMap, x: number, y: number, r: number, room = -1): { x: number; y: number } | null {
  if (!circleHitsWall(m, x, y, r)) return { x, y };
  let fallback: { x: number; y: number } | null = null;
  for (let d = 1; d <= TILE * 2; d += 1) {
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const nx = x + Math.cos(a) * d;
      const ny = y + Math.sin(a) * d;
      if (circleHitsWall(m, nx, ny, r)) continue;
      if (room < 0 || m.room[tileAt(m, nx, ny)] === room + 1) return { x: nx, y: ny };
      fallback ??= { x: nx, y: ny };
    }
    if (fallback && d > r + 2) return fallback;
  }
  return fallback;
}

/** Breaks a cracked wall tile (returns whether it was one). */
export function breakWall(m: TileMap, i: number): boolean {
  if (m.kind[i] !== K.Cracked) return false;
  m.kind[i] = K.Floor;
  m.solid[i] = 0;
  m.block[i] = 0;
  return true;
}

export const isKind = (m: TileMap, i: number, k: K): boolean => m.kind[i] === k;
