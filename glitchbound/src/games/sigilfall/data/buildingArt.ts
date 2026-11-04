import { hash2 } from '../core/math';
import type { Marker, Theme } from './types';

/*
 * Where a building's picture stands on its lot, shared by the simulation (what is solid) and the renderer
 * (what is drawn), so the walls you see are the walls that stop you and the door you see is the way in.
 *
 * Every building is a Royal Keep piece (the world's one art pack, VISUAL_BIBLE.md). A plan gives each
 * building a lot (its footprint in tiles); the picture stands on the lot's front edge, its painted door over
 * the lot's door tile (the middle of the front) when the building has a way in, centered otherwise. Only the
 * picture is solid; the rest of the lot is its yard, with a few things standing in it.
 */

type Style = Extract<Marker, { kind: 'building' }>['style'];

/**
 * The pictures, measured from the pack: [width, height, origin x, origin y, footprint width, footprint depth,
 * door] in the pack's pixels (two to a world pixel). The origin is the pixel on the ground at the south-west
 * corner of the walls; the door is the middle of the front door, from the picture's left edge.
 */
const PICS: Record<string, [number, number, number, number, number, number, number?]> = {
  cottage_thatch: [98, 101, 4, 94, 78, 44, 67],
  cottage_tile: [96, 98, 4, 91, 76, 42, 17],
  cottage_slate: [100, 100, 4, 93, 80, 44, 46],
  cottage_stone: [100, 100, 4, 93, 80, 44, 45],
  cottage_moss: [92, 98, 4, 91, 72, 42, 16],
  house_gable_tile: [86, 133, 4, 126, 66, 54, 22],
  house_gable_slate: [84, 130, 4, 123, 64, 52, 22],
  house_gable_plum: [82, 127, 4, 120, 62, 50, 21.5],
  house_tall_tile: [112, 128, 4, 121, 92, 46, 49.5],
  house_tall_slate: [108, 126, 4, 119, 88, 44, 17],
  inn: [148, 145, 4, 138, 128, 62, 68.5],
  smithy: [104, 111, 4, 104, 84, 46, 64.5],
  stable: [124, 95, 4, 88, 104, 46, 56],
  chapel: [78, 161, 4, 154, 58, 70, 31],
  keep: [186, 220, 2, 212, 160, 80, 82],
  gatehouse: [149, 162, 3, 155, 128, 40],
  tower_square_roof: [68, 153, 6, 145, 44, 34],
  tower_square: [64, 137, 3, 131, 46, 34],
  turret: [51, 102, 6, 94, 27, 21],
  tower_round: [58, 135, 3, 129, 41, 31],
  tower_round_slate: [60, 154, 6, 146, 37, 27],
  tower_round_tile: [60, 154, 6, 146, 37, 27],
};

/** A picture in world pixels. */
export interface BuildingPic {
  w: number;
  h: number;
  ox: number;
  oy: number;
  fpw: number;
  fpd: number;
  door?: number;
}

export function buildingPic(id: string): BuildingPic | null {
  const p = PICS[id];
  if (!p) return null;
  const [w, h, ox, oy, fpw, fpd, door] = p;
  return { w: w / 2, h: h / 2, ox: ox / 2, oy: oy / 2, fpw: fpw / 2, fpd: fpd / 2, ...(door !== undefined ? { door: door / 2 } : {}) };
}

/** Every picture this table names (for the art-integrity test). */
export const buildingPicIds = (): string[] => Object.keys(PICS);

/** The houses of each land: roofs of its own (thatch on the farms, slate in the cold, moss in the wet). */
const VALE = ['cottage_thatch', 'cottage_tile', 'house_gable_tile', 'cottage_slate', 'cottage_thatch'];
const STONE = ['cottage_stone', 'cottage_slate', 'house_gable_slate', 'cottage_stone'];
const WET = ['cottage_moss', 'cottage_thatch', 'cottage_moss', 'house_gable_slate'];
const GRIM = ['cottage_stone', 'house_gable_slate', 'cottage_moss', 'house_gable_plum'];
const HOUSES: Record<Theme, string[]> = {
  village: ['house_gable_tile', 'house_gable_slate', 'cottage_tile', 'house_gable_plum', 'cottage_slate'],
  farm: VALE,
  plains: VALE,
  autumn: ['cottage_tile', 'cottage_thatch', 'house_gable_tile', 'cottage_stone'],
  coast: ['cottage_slate', 'house_gable_slate', 'cottage_stone', 'cottage_thatch'],
  forest: ['cottage_moss', 'cottage_thatch', 'cottage_tile'],
  fey: ['house_gable_plum', 'cottage_moss', 'cottage_thatch'],
  jungle: ['cottage_moss', 'cottage_thatch'],
  mountain: STONE,
  storm: STONE,
  snow: STONE,
  peaks: STONE,
  pale: STONE,
  desert: ['cottage_stone', 'cottage_thatch', 'cottage_stone'],
  volcanic: ['cottage_stone', 'house_gable_slate'],
  bonefield: ['cottage_stone', 'cottage_thatch'],
  marsh: WET,
  plague: WET,
  sunken: WET,
  gloam: WET,
  blight: GRIM,
  barrow: GRIM,
  moor: GRIM,
  haunted: GRIM,
  deadlake: GRIM,
  rift: GRIM,
  warfront: ['cottage_stone', 'cottage_tile', 'house_gable_slate'],
  // indoor themes have no houses
  crypt: STONE,
  cave: STONE,
  cistern: STONE,
  keep: STONE,
  icecave: STONE,
  temple: STONE,
  lavacave: STONE,
  citadel: STONE,
  roots: STONE,
  tavern: VALE,
  greathall: VALE,
  riftspire: STONE,
};

/** A land's houses for a village: its cottages and gabled houses, and its big two-story houses. */
export function villageHouses(theme: Theme): { small: string[]; big: string[] } {
  const small = HOUSES[theme];
  const cold = small.some((id) => id.includes('slate') || id.includes('stone') || id.includes('moss'));
  return { small, big: cold ? ['house_tall_slate', 'house_tall_tile'] : ['house_tall_tile', 'house_tall_slate', 'house_tall_tile'] };
}

/**
 * How many tile rows a building of a kind makes solid, from its front up, at most (its tallest picture: a
 * steep roof rises over the ground behind its lot, so a plan leaves that ground clear of streets).
 */
export function buildingRows(style: Style | 'house', theme: Theme, art?: string): number {
  const ids = art ? [art] : style === 'house' ? HOUSES[theme] : STYLE[style].wild;
  return Math.max(...ids.map((id) => {
    const oy = buildingPic(id)!.oy;
    return Math.floor(oy / 16) + (oy % 16 >= 6 ? 1 : 0);
  }));
}

/** Each kind of building in a town (the capital, Briarhollow) and out in the wilds. */
const STYLE: Record<Style, { town: string[]; wild: string[] }> = {
  house: { town: [], wild: [] },
  tavern: { town: ['inn'], wild: ['inn'] },
  inn: { town: ['inn'], wild: ['inn'] },
  shop: { town: ['house_tall_tile', 'house_tall_slate'], wild: ['house_tall_tile'] },
  smithy: { town: ['smithy'], wild: ['smithy'] },
  temple: { town: ['chapel'], wild: ['chapel'] },
  keep: { town: ['keep'], wild: ['keep'] },
  tower: { town: ['tower_square_roof'], wild: ['tower_square_roof', 'tower_square'] },
  hall: { town: ['house_tall_tile', 'house_tall_slate'], wild: ['stable'] },
  lighthouse: { town: ['tower_round_slate'], wild: ['tower_round_slate'] },
};

/** What stands in a building's yard, by kind: the first fits first (Royal Keep props). */
const YARD: Record<Style, string[]> = {
  house: ['lantern', 'barrel', 'planter', 'woodpile', 'flowerbed', 'lantern', 'crate', 'sacks', 'bench', 'planter', 'bucket', 'flowerbed'],
  tavern: ['big-barrel', 'keg', 'bench', 'table', 'barrel'],
  inn: ['big-barrel', 'bench', 'keg', 'table', 'barrel'],
  shop: ['crates-stack', 'sacks', 'barrel', 'market-goods', 'basket'],
  smithy: ['anvil', 'grindstone', 'woodpile', 'weapon-rack', 'bucket'],
  temple: ['statue', 'statue', 'planter', 'flowerbed'],
  keep: ['statue', 'statue', 'planter', 'planter'],
  tower: [],
  hall: ['weapon-rack', 'rack', 'crates-stack', 'target', 'barrel'],
  lighthouse: ['barrel', 'crate'],
};

export interface PlacedPic {
  id: string;
  /** The picture's left edge and the ground line under its walls, in world pixels. */
  x: number;
  y: number;
  /** Drawn this many times its size (the capital's keep and its towers). */
  scale?: number;
  /** In dark stone, its lit windows and red banners kept (data/types.ts). */
  grim?: boolean;
}

export interface Lot {
  /** The lot's top-left tile and its size, in tiles. */
  tx: number;
  ty: number;
  w: number;
  h: number;
}

/**
 * The picture(s) for a building on a lot. `door`: the tile column of its way in, if it has one (its painted
 * door goes over it). A keep on a lot wide enough stands between two round towers; a keep drawn bigger
 * (`o.scale`, the Crown City's) is a fortress: between two tall round towers, and further out and set back,
 * two square ones, all of them bigger than the land's own.
 */
export function placeBuilding(style: Style | 'house', lot: Lot, theme: Theme, town: boolean, art: string | undefined, door: number | null, o: { scale?: number; grim?: boolean; fit?: boolean } = {}): PlacedPic[] {
  const h = hash2(lot.tx, lot.ty + lot.h - 1, 51);
  const own = art?.startsWith('rk:') && PICS[art.slice(3)] ? art.slice(3) : null;
  const list = style === 'house' ? HOUSES[theme] : town ? STYLE[style].town : STYLE[style].wild;
  const id = own ?? list[Math.floor(h * list.length) % list.length]!;
  const pic = buildingPic(id)!;
  // (a lot laid out to be this big: the building comes to fill it, however big that is)
  const s = o.fit ? Math.min((lot.w * 16) / pic.fpw, (lot.h * 16) / Math.max(1, pic.oy)) : (o.scale ?? 1);
  const look = { ...(s !== 1 ? { scale: s } : {}), ...(o.grim ? { grim: true } : {}) };
  const ground = (lot.ty + lot.h) * 16;
  const middle = (lot.tx + lot.w / 2) * 16;
  // the painted door over the lot's door tile (the middle of its front, where a plan paves the step and an
  // interior's way in is); a building with no way in may shift back over its lot, a little past it at most
  let x = Math.round(middle - (pic.ox + pic.fpw / 2) * s);
  if (pic.door !== undefined && !o.fit) {
    x = Math.round(((door ?? lot.tx + Math.floor(lot.w / 2)) + 0.5) * 16 - pic.door * s);
    // (never so far its walls stand on a neighbour's lot: a tile is solid where a wall covers 4 px of it)
    if (door === null) x = Math.max(lot.tx * 16 - 3 - pic.ox * s, Math.min((lot.tx + lot.w) * 16 + 3 - (pic.ox + pic.fpw) * s, x));
  }
  const out: PlacedPic[] = [{ id, x, y: ground, ...look }];
  if (id === 'keep' && s > 1 && !o.fit) {
    const kc = x + (pic.ox + pic.fpw / 2) * s;
    const inner = buildingPic('tower_round_slate')!;
    const outer = buildingPic('tower_square_roof')!;
    const si = s * 0.95;
    const so = s * 0.8;
    // (the round towers stand a little into the keep's flanks, the square ones clear of them, further back)
    const di = (pic.fpw * s) / 2 + inner.fpw * si * 0.3;
    const dout = (pic.fpw * s) / 2 + inner.fpw * si + (outer.fpw * so) / 2 + 2;
    for (const side of [-1, 1]) {
      out.push({ id: 'tower_round_slate', x: Math.round(kc + side * di - (inner.ox + inner.fpw / 2) * si), y: ground - 10, scale: si, ...(o.grim ? { grim: true } : {}) });
      out.push({ id: 'tower_square_roof', x: Math.round(kc + side * dout - (outer.ox + outer.fpw / 2) * so), y: ground - 26, scale: so, ...(o.grim ? { grim: true } : {}) });
    }
  } else if (id === 'keep' && lot.w >= 8) {
    const tower = buildingPic('tower_round_tile')!;
    const kc = x + pic.ox + pic.fpw / 2;
    const span = pic.fpw + tower.fpw * 1.4;
    for (const s of [-1, 1]) out.push({ id: 'tower_round_tile', x: Math.round(kc + (s * span) / 2 - tower.ox - tower.fpw / 2), y: ground - 6 });
  }
  return out;
}

/** The yard's things for a building: up to `n` from its kind's list, in a stable order. */
export function yardProps(style: Style | 'house', lot: Lot, n: number): string[] {
  const list = YARD[style];
  if (!list.length || n <= 0) return [];
  const start = Math.floor(hash2(lot.tx, lot.ty, 53) * list.length);
  return Array.from({ length: Math.min(n, list.length) }, (_, i) => list[(start + i) % list.length]!);
}

/** What 3D model each kind of building is. */
const MODELS: Record<string, string[]> = {
  house: ['b_home_A', 'b_home_B'],
  inn: ['b_tavern'],
  tavern: ['b_tavern'],
  shop: ['b_workshop'],
  tower: ['b_tower_A', 'b_tower_B', 'b_watchtower'],
  temple: ['b_church'],
  keep: ['b_castle'],
  hall: ['b_townhall'],
  lighthouse: ['b_tower_B'],
  smithy: ['b_blacksmith'],
};

/** Those models' extents, [min x, min z, max x, max z] as they stand, measured off the pack (sigilfall-props test keeps them honest). */
export const MODEL_FOOT: Record<string, readonly [number, number, number, number]> = {
  b_home_A: [-0.396, -0.469, 0.396, 0.385],
  b_home_B: [-0.439, -0.539, 0.436, 0.56],
  b_tavern: [-0.595, -0.702, 0.577, 0.63],
  b_workshop: [-0.836, -0.881, 0.829, 0.786],
  b_tower_A: [-0.497, -0.574, 0.497, 0.58],
  b_tower_B: [-0.599, -0.691, 0.599, 0.691],
  b_watchtower: [-0.522, -0.522, 0.522, 0.522],
  b_church: [-0.514, -0.56, 0.514, 0.595],
  b_castle: [-0.988, -1.128, 0.988, 1.128],
  b_townhall: [-0.719, -0.784, 0.716, 0.78],
  b_blacksmith: [-0.63, -0.56, 0.658, 0.685],
};

/** Where a model's door and the steps up to it are, across it (where it isn't the middle): a way in opens right there. */
const MODEL_DOOR: Record<string, number> = { b_tavern: -0.14, b_townhall: -0.185, b_blacksmith: -0.04 };

export interface StandingModel {
  m: string;
  /** Where its origin goes (tiles), and how much it's scaled. */
  x: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  /** The capital's keep, rising far over its own gate. */
  seat: boolean;
}

/**
 * How a building's model stands on what its picture made solid (x0..x1, y0..y1 in tiles): true to its own shape (no
 * stretched barns), at most a quarter wider or deeper than the model was made, its door on the lot's front, toward the
 * street. The land draws this, and the rules bump into it.
 */
export function modelOnLot(style: string, lot: Lot, grim: boolean, x0: number, x1: number, y0: number, y1: number, doorTile: number | null = null): StandingModel | null {
  const list = MODELS[style] ?? MODELS.house!;
  const m = list[Math.floor(hash2(lot.tx, lot.ty, 7) * list.length)]!;
  const b = MODEL_FOOT[m];
  if (!b) return null;
  const wideX = Math.max(0.01, b[2] - b[0]);
  const wideZ = Math.max(0.01, b[3] - b[1]);
  const fx = (x1 - x0) / wideX;
  const fz = (y1 - y0) / wideZ;
  // (the capital's keep rises far over its own gate: the rest of it goes back behind its wall, out of anyone's way)
  const seat = style === 'keep' && grim;
  const base = Math.min(fx, fz) * (seat ? 2.1 : 1);
  const sx = seat ? base : Math.min(fx, base * 1.25) * 1.03;
  const sz = seat ? base : Math.min(fz, base * 1.25) * 1.03;
  const sy = base * (seat ? 1 : 1.12);
  // (its own steps over the tile that takes you in, if it has one: that's where the arrow is)
  const x = doorTile !== null && !seat ? doorTile + 0.5 - (MODEL_DOOR[m] ?? 0) * sx : (x0 + x1) / 2 - ((b[0] + b[2]) / 2) * sx;
  return { m, x, z: y1 + 0.05 - b[3] * sz, sx, sy, sz, seat };
}

/** The ground rectangle a placed picture covers ([x0, y0, x1, y1], world px): its walls and roof, not its shadow. */
export function picBody(p: PlacedPic): [number, number, number, number] {
  const pic = buildingPic(p.id)!;
  const s = p.scale ?? 1;
  return [p.x + pic.ox * s, p.y - pic.oy * s, p.x + (pic.ox + pic.fpw) * s, p.y];
}
