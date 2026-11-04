import { hash2 } from '../core/math';
import { MODEL_FOOT, modelOnLot, picBody, placeBuilding, yardProps, type PlacedPic } from '../data/buildingArt';
import { FEET, propBody, propReach, propStandsUp } from '../data/props';
import type { Marker, PlacedMarkerDef, RegionDef, StoryCond } from '../data/types';

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

const TERRAIN: Record<string, K> = {
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
  const reachOf = (pm: PlacedMarkerDef): { w: number; d: number } | null => (pm.marker.kind === 'prop' && propStandsUp(pm.marker.prop) ? propReach(pm.marker.prop) : null);
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
  const over: [number, number][] = [];
  const buildings = standBuildings(def, w, h, kind, markers, over);
  const settle = (): void => {
    for (let i = 0; i < w * h; i++) {
      solid[i] = SOLID_KINDS.has(kind[i] as K) ? 1 : 0;
      block[i] = BLOCK_KINDS.has(kind[i] as K) ? 1 : 0;
    }
  };
  settle();
  inSight(markers, w, h, kind, solid);
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
    } else if (m.kind === 'prop' && (m.solid || propStandsUp(m.prop))) pm.body = stand(propBody(m.prop), pm.tx, pm.ty);
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
  const map: TileMap = { w, h, kind, room, solid, block, markers, doors, roomTiles, buildings, bodies, soft, clogged };
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

/**
 * What the camera comes in over from the south: someone to talk to or a chest to open standing right behind a house
 * can't be seen, so they stand round the front, on the nearest ground where they can.
 */
function inSight(markers: PlacedMarker[], w: number, h: number, kind: Uint8Array, solid: Uint8Array): void {
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
  for (const pm of markers) {
    if (pm.marker.kind !== 'npc' && pm.marker.kind !== 'chest') continue;
    const up = pm.marker.kind === 'npc' ? 0.95 : 0.4;
    if (!unseen(pm.tx, pm.ty, up)) continue;
    let best: [number, number] | null = null;
    let bd = Infinity;
    for (let y = pm.ty - 8; y <= pm.ty + 8; y++) {
      for (let x = pm.tx - 8; x <= pm.tx + 8; x++) {
        if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) continue;
        const i = y * w + x;
        if (solid[i] || kind[i] === K.Water || taken.has(i) || unseen(x, y, up)) continue;
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
    // its yard: a few things on the free tiles of the lot's front rows, clear of the doorway
    const free: number[] = [];
    for (let y = Math.max(lot.ty, lot.ty + lot.h - 2); y < lot.ty + lot.h; y++) {
      for (let x = lot.tx; x < lot.tx + lot.w; x++) {
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const i = y * w + x;
        if (kind[i] !== K.Floor || taken.has(i) || (way && Math.abs(x - way.tx) <= 1)) continue;
        free.push(i);
      }
    }
    free.sort((a, b) => hash2(a % w, Math.floor(a / w), 57) - hash2(b % w, Math.floor(b / w), 57));
    const yard: MapBuilding['yard'] = [];
    for (const prop of yardProps(lot.style, lot, Math.min(3, Math.ceil(free.length / 2)))) {
      const i = free.shift()!;
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
