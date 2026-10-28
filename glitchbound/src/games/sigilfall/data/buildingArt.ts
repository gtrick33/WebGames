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
  house: ['lantern_post', 'barrel', 'planter_red', 'woodpile', 'flowerbed_gold', 'lantern_post', 'crate', 'sacks', 'bench', 'planter_blue', 'barrel_water', 'flowerbed_violet'],
  tavern: ['barrels', 'keg', 'bench', 'table_food', 'barrel'],
  inn: ['barrels', 'bench', 'keg', 'table_small', 'barrel'],
  shop: ['crates', 'sacks', 'barrel_apples', 'crate_cabbage', 'basket_bread'],
  smithy: ['anvil', 'grindstone', 'woodpile', 'rack_swords', 'barrel_water'],
  temple: ['statue_queen', 'statue_king', 'planter_gold', 'flowerbed_gold'],
  keep: ['statue_knight', 'statue_knight', 'planter_red', 'planter_red'],
  tower: [],
  hall: ['rack_spears', 'rack_shields', 'crates', 'training_dummy', 'barrel'],
  lighthouse: ['barrel', 'crate'],
};

export interface PlacedPic {
  id: string;
  /** The picture's left edge and the ground line under its walls, in world pixels. */
  x: number;
  y: number;
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
 * door goes over it). A keep on a lot wide enough stands between two round towers.
 */
export function placeBuilding(style: Style | 'house', lot: Lot, theme: Theme, town: boolean, art: string | undefined, door: number | null): PlacedPic[] {
  const h = hash2(lot.tx, lot.ty + lot.h - 1, 51);
  const own = art?.startsWith('rk:') && PICS[art.slice(3)] ? art.slice(3) : null;
  const list = style === 'house' ? HOUSES[theme] : town ? STYLE[style].town : STYLE[style].wild;
  const id = own ?? list[Math.floor(h * list.length) % list.length]!;
  const pic = buildingPic(id)!;
  const ground = (lot.ty + lot.h) * 16;
  const middle = (lot.tx + lot.w / 2) * 16;
  // the painted door over the lot's door tile (the middle of its front, where a plan paves the step and an
  // interior's way in is); a building with no way in may shift back over its lot, a little past it at most
  let x = Math.round(middle - pic.ox - pic.fpw / 2);
  if (pic.door !== undefined) {
    x = Math.round(((door ?? lot.tx + Math.floor(lot.w / 2)) + 0.5) * 16 - pic.door);
    if (door === null) x = Math.max(lot.tx * 16 - 6 - pic.ox, Math.min((lot.tx + lot.w) * 16 + 6 - pic.ox - pic.fpw, x));
  }
  const out: PlacedPic[] = [{ id, x, y: ground }];
  if (id === 'keep' && lot.w >= 8) {
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

/** The ground rectangle a placed picture covers ([x0, y0, x1, y1], world px): its walls and roof, not its shadow. */
export function picBody(p: PlacedPic): [number, number, number, number] {
  const pic = buildingPic(p.id)!;
  return [p.x + pic.ox, p.y - pic.oy, p.x + pic.ox + pic.fpw, p.y];
}
