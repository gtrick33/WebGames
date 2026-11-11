import type { Theme } from './types';

/*
 * The towns of the world, each its own place (the owner: "most of the towns look the same, streets, houses and misc
 * items ... the whole vibe of towns need to change"). The buildings and goods are the same good ones everywhere; what
 * makes a harbor a harbor is that it's a stone quay with piers and boats and houses packed down its lanes, and what
 * makes a fen town a fen town is that there is no ground, only boardwalks over the water. So each form below lays out a
 * town its own way, says what lights its streets and what stands at its doors, and leaves the rest of the rules (who
 * stands where, what a door needs) to the village code in zonegen.ts.
 *
 * Everything here is in map tiles from the town's middle (east, south), mirrored or not by the village code; the
 * waystone stands at (0, -1) and the tile south of it stays clear.
 */

/* Tile letters (see regions.ts). */
const WALL = 35;
const FLOOR = 46;
const DECO = 44;
const PATH = 61;
const COBBLE = 58;
const WATER = 126;
const BRIDGE = 98;
const FENCE = 102;
const RAMPART = 124;

export type LotStyle = 'house' | 'tavern' | 'inn' | 'shop' | 'smithy' | 'temple' | 'keep' | 'hall';

/** What a form is given to build with. */
export interface TownKit {
  theme: Theme;
  seed: number;
  /** Which side the water is on, if the land has a sea (east in the kit's own terms: the village code mirrors it). */
  sea: 's' | 'x' | null;
  /** A number from 0 to 1 that stays the same for this spot. */
  rand(dx: number, dy: number, salt?: number): number;
  at(dx: number, dy: number): number;
  /** Sets a tile, if nothing stands there. */
  set(dx: number, dy: number, c: number): void;
  /** Nothing on it, and open ground. */
  open(dx: number, dy: number): boolean;
  /** Ground, over grass, woods and (for stone) dirt road. */
  rect(dx0: number, dy0: number, dx1: number, dy1: number, c: number): void;
  /** Takes the road off some ground, to build there (whoever takes it gives the road another way round). */
  clear(dx0: number, dy0: number, dx1: number, dy1: number): void;
  /** Water here (a road through it becomes a bridge). */
  water(dx: number, dy: number): void;
  /** A thing on the ground; false if it won't go. */
  prop(dx: number, dy: number, name: string, solid?: boolean): boolean;
  /**
   * A building whose west edge is about `dx` (it shifts a little to find room) and whose front row is `front`; it keeps
   * a footpath to the nearest road. Comes to fill its lot, whatever the size.
   */
  lot(style: LotStyle, dx: number, front: number, w: number, h: number): boolean;
  /** A tree, on open ground. */
  tree(dx: number, dy: number): void;
  /** How far a town reaches, east and west, north and south. */
  vx: number;
  vy: number;
}

/** What a form leaves for the village code to finish with. */
export interface TownLook {
  /** Where the land's heart stands (its well, its forge, its bonfire...), and the stalls of its market (each with its goods to one side). */
  heart: [number, number];
  stalls: [number, number, 1 | -1][];
  /** What its market is sold from and what's sold (the land's usual if it doesn't say). */
  stall?: string;
  goods?: string[];
  /** Everything else on the square. */
  furniture: [number, number, string][];
  /** What lights its streets; null if nothing does. */
  lamp: string | null;
  /** What stands either side of a house's door. */
  fronts: [string[], string[]];
  /** Flowers on its open ground and trees at its edge. */
  green: boolean;
}

/** Houses in a row along a street whose road is the row after `front`, from `dx` going `dir`. */
function row(k: TownKit, dx: number, dir: 1 | -1, front: number, count: number, w = 5, h = 4, gap = 0): void {
  let x = dx;
  for (let n = 0, tries = 0; n < count && tries < count * 2 + 2; tries++) {
    const wide = k.rand(x, front, 75) < 0.3 ? w + 1 : w;
    if (k.lot('house', dir > 0 ? x : x - wide + 1, front, wide, h)) n++;
    x += dir * (wide + gap + (k.rand(x, front, 76) < 0.3 ? 1 : 0));
  }
}

/** A square's corners cut. */
function plaza(k: TownKit, dx0: number, dy0: number, dx1: number, dy1: number, c: number): void {
  for (let y = dy0; y <= dy1; y++) for (let x = dx0; x <= dx1; x++) if (!((x === dx0 || x === dx1) && (y === dy0 || y === dy1))) k.rect(x, y, x, y, c);
}

/** A field in rows, fenced, its gate south: furrows of earth and what grows on them. */
function field(k: TownKit, dx0: number, dy0: number, dx1: number, dy1: number, crop: string): void {
  for (let y = dy0; y <= dy1; y++) for (let x = dx0; x <= dx1; x++) if (!k.open(x, y)) return;
  const gate = Math.round((dx0 + dx1) / 2);
  for (let y = dy0; y <= dy1; y++) {
    for (let x = dx0; x <= dx1; x++) {
      const edge = x === dx0 || x === dx1 || y === dy0 || y === dy1;
      if (edge) {
        if (!(y === dy1 && x === gate)) k.set(x, y, FENCE);
      } else {
        k.rect(x, y, x, y, PATH);
        if ((y - dy0) % 2 === 1 && x !== gate) k.prop(x, y, crop, false);
      }
    }
  }
}

function graveyard(k: TownKit, dx0: number, dy0: number, dx1: number, dy1: number): void {
  for (let y = dy0; y <= dy1; y++) for (let x = dx0; x <= dx1; x++) if (!k.open(x, y)) return;
  const gate = Math.round((dx0 + dx1) / 2);
  for (let y = dy0; y <= dy1; y++) {
    for (let x = dx0; x <= dx1; x++) {
      const edge = x === dx0 || x === dx1 || y === dy0 || y === dy1;
      if (edge) {
        if (!(y === dy1 && x === gate)) k.set(x, y, FENCE);
      } else if ((y - dy0) % 2 === 1 && x !== gate && (x - dx0) % 2 === 1) k.prop(x, y, k.rand(x, y, 85) < 0.6 ? 'gravestone' : 'grave-cross');
    }
  }
}

/** Ground raised out of the water for something to stand on. */
function hummock(k: TownKit, dx: number, front: number, w: number, h: number): void {
  for (let y = front - h - 1; y <= front; y++) for (let x = dx - 1; x <= dx + w; x++) if (k.at(x, y) === WATER) k.set(x, y, FLOOR);
}

const FLOWERS: [string[], string[]] = [['flowerbed', 'planter', 'flowerbed'], ['woodpile', 'barrel', 'bucket', 'sacks']];

/* ------------------------------------------------------------------ the forms */

export const TOWN_FORMS: Record<string, (k: TownKit) => TownLook> = {
  /**
   * Millbrook, Thornvale: a farm town on its brook. The stream runs through it under the bridges, the mill on its bank;
   * wheat and corn in fenced fields right up to the back doors. No cobbles but the little square.
   */
  mill(k) {
    for (let x = -k.vx; x <= k.vx; x++) {
      const y = 7 + Math.round(Math.sin(x / 7) * 1.6);
      for (let d = 0; d < 3; d++) k.water(x, y + d);
    }
    k.rect(-k.vx, 0, k.vx + 1, 1, PATH);
    k.rect(0, -k.vy, 1, k.vy, PATH);
    plaza(k, -5, -5, 6, 3, COBBLE);
    k.lot('tavern', -13, -1, 7, 5);
    row(k, -14, -1, -1, 2);
    k.lot('shop', 8, -1, 6, 4);
    row(k, 15, 1, -1, 2);
    k.lot('smithy', -6, -7, 6, 4);
    k.rect(-16, -6, 17, -6, PATH);
    row(k, 3, 1, -7, 3);
    k.lot('temple', -16, -7, 7, 6);
    // south of the brook: cottages on their own path, the mill on the bank
    k.rect(-20, 12, 21, 12, PATH);
    row(k, -20, 1, 11, 3);
    row(k, 3, 1, 11, 2);
    k.prop(14, 5, 'water-mill');
    field(k, -24, -17, -9, -11, 'wheat');
    field(k, 4, -17, 16, -11, 'corn');
    field(k, -22, 14, -6, 18, 'wheat');
    field(k, 6, 14, 22, 18, 'pumpkin');
    return {
      heart: [-2, -3],
      stalls: [[-3, 2, -1], [5, -4, 1]],
      stall: 'market-cart',
      goods: ['hay', 'sacks', 'basket', 'crate'],
      furniture: [[-4, -4, 'bench'], [5, 2, 'hay'], [6, -2, 'notice'], [4, -1, 'cart'], [-4, 2, 'lamp'], [6, 2, 'lamp']],
      lamp: 'lamp',
      fronts: FLOWERS,
      green: true,
    };
  },

  /**
   * Fernstead, Brackenridge: a round village under one great old tree. A ring road, the houses all looking in at the
   * green, harvest tables out on the grass, and nothing else in the middle.
   */
  ring(k) {
    const rx = 18;
    const ry = 11;
    for (let a = 0; a < 720; a++) {
      const t = (a / 720) * Math.PI * 2;
      const x = Math.round(Math.cos(t) * rx);
      const y = Math.round(Math.sin(t) * ry);
      k.rect(x, y, x + 1, y, PATH);
    }
    // the spokes: every road in comes to the green
    k.rect(0, -k.vy, 1, k.vy, PATH);
    k.rect(-k.vx, 0, k.vx + 1, 1, PATH);
    k.prop(-7, -6, 'green-oak');
    for (const [x, y] of [[-8, -6], [-6, -6], [-7, -7], [-7, -5]] as const) k.prop(x, y, 'block');
    // the north arc looks down on the ring; the south arc stands inside it, looking out across the road
    const spots: [number, number][] = [[-14, -9], [-8, -11], [-3, -12], [4, -12], [9, -11], [15, -9], [-17, -4], [18, -4], [-12, 8], [-5, 10], [5, 10], [12, 8], [-16, 4], [17, 4]];
    const styles: ('house' | 'tavern' | 'smithy' | 'shop' | 'temple')[] = ['house', 'tavern', 'house', 'temple', 'house', 'smithy', 'house', 'house', 'house', 'shop', 'house', 'house', 'house', 'house'];
    spots.forEach(([x, y], i) => {
      const s = styles[i]!;
      const w = s === 'house' ? 5 : 7;
      const h = s === 'house' ? 4 : s === 'temple' ? 6 : 5;
      k.lot(s, x - Math.floor(w / 2), y - 1, w, h);
    });
    // outside the ring: old orchards
    for (let y = -17; y <= 17; y += 3) for (let x = -27; x <= 27; x += 3) if (Math.hypot(x / 22, y / 14) > 1.05 && k.rand(x, y, 83) < 0.45) k.tree(x, y);
    return {
      heart: [4, -4],
      stalls: [[6, 4, 1], [-6, 3, -1]],
      stall: 'table',
      goods: ['basket', 'hay', 'sacks', 'keg'],
      furniture: [[3, -6, 'bench'], [7, -3, 'bench'], [-3, 5, 'hay'], [8, 1, 'lamp'], [-8, 1, 'lamp'], [2, 4, 'notice']],
      lamp: null,
      fronts: [['flowerbed', 'planter'], ['woodpile', 'hay', 'barrel']],
      green: true,
    };
  },

  /**
   * Gullport, and any harbor town: a stone quay and its piers. Houses packed tight down lanes that run to the water,
   * warehouses on the front, fish and rope and barrels everywhere, boats tied up. Paved, wall to wall.
   */
  harbor(k) {
    return k.sea === 's' ? quaySouth(k) : quayEast(k);
  },

  /**
   * The fen towns: no ground at all. Everything stands on its own hummock in the water, and boardwalks join them, with a
   * lantern on a post every few steps and boats tied where a street should be. Lastlight (Gloamhollow) is one long
   * causeway, lamp after lamp, across water with nothing in it.
   */
  boardwalk(k) {
    const causeway = k.theme === 'gloam';
    for (let y = -k.vy + 1; y <= k.vy - 1; y++) for (let x = -k.vx + 1; x <= k.vx - 1; x++) if ((x / k.vx) ** 2 + (y / k.vy) ** 2 < 0.96) k.water(x, y);
    const walk = (x0: number, y0: number, x1: number, y1: number): void => k.rect(x0, y0, x1, y1, BRIDGE);
    walk(-k.vx, 0, k.vx + 1, 1);
    walk(0, -k.vy, 1, k.vy);
    if (!causeway) {
      walk(-20, -9, 21, -8);
      walk(-20, 9, 21, 10);
      walk(-20, -9, -19, 10);
      walk(20, -9, 21, 10);
    }
    // the landing round the waystone, and its market
    plaza(k, -6, -5, 7, 3, BRIDGE);
    k.rect(-5, -3, 6, 2, BRIDGE);
    const pad = (style: LotStyle, dx: number, front: number, w: number, h: number): void => {
      hummock(k, dx, front, w, h);
      k.lot(style, dx, front, w, h);
    };
    pad('tavern', -17, -1, 8, 5);
    pad('temple', 9, -1, 8, 6);
    if (causeway) {
      // nothing but the one road across the black water, the houses on it like beads
      for (const x of [-26, -22, 18, 23]) pad('house', x, -1, 4, 4);
      // and a back walk, south of it, for the forge and the chandler
      walk(-26, 8, 27, 9);
      walk(-26, 2, -25, 8);
      walk(26, 2, 27, 8);
      pad('smithy', -22, 7, 6, 4);
      pad('house', -14, 7, 5, 4);
      pad('house', -8, 7, 5, 4);
      pad('shop', 4, 7, 6, 4);
      pad('house', 12, 7, 5, 4);
      pad('house', 19, 7, 5, 4);
    } else {
      pad('house', -17, -10, 5, 4);
      pad('house', -10, -10, 5, 4);
      pad('smithy', 3, -10, 6, 5);
      pad('house', 11, -10, 5, 4);
      pad('house', 16, -10, 4, 4);
      pad('house', -17, 8, 5, 4);
      pad('shop', -10, 8, 6, 4);
      pad('house', 3, 8, 5, 4);
      pad('house', 10, 8, 5, 4);
      pad('house', -27, -1, 5, 4);
      pad('house', 23, -1, 4, 4);
      pad('house', 3, -1, 4, 3);
      pad('house', -8, -1, 4, 3);
    }
    // what grows out of the water
    for (let y = -k.vy + 2; y < k.vy - 1; y += 2) {
      for (let x = -k.vx + 2; x < k.vx - 1; x += 3) {
        if (k.at(x, y) !== WATER || k.rand(x, y, 96) > 0.12) continue;
        k.set(x, y, FLOOR);
        if (k.rand(x, y, 97) < 0.5) k.tree(x, y);
      }
    }
    for (const [x, y] of [[-14, 3], [12, 3], [-24, 2], [24, -2], [-6, -11], [8, 12]] as const) k.prop(x, y, 'boat', false);
    return {
      heart: [-3, -3],
      stalls: [[-3, 1, -1], [4, 1, 1]],
      stall: 'table',
      goods: ['basket', 'fish', 'crate', 'clay-pot'],
      furniture: [[-5, -2, 'lantern'], [6, -2, 'lantern'], [-5, 2, 'lantern'], [6, 2, 'lantern'], [3, -4, 'crate'], [-4, -4, 'barrel']],
      lamp: 'lantern',
      fronts: [['crate', 'fish', 'basket'], ['barrel', 'sacks']],
      green: false,
    };
  },

  /**
   * A lane that wanders (Candlewick, the plague villages, the barrow-keepers): no two houses square to it, a graveyard
   * bigger than the village in the middle of everything, and a candle on every step.
   */
  crooked(k) {
    const laneY = (x: number): number => Math.round(Math.sin(x / 6.5) * 3.2);
    const frontOf = (lane: (x: number) => number, x: number, w: number): number => {
      let top = 99;
      for (let i = 0; i < w; i++) top = Math.min(top, lane(x + i));
      return top - 1;
    };
    for (let x = -k.vx; x <= k.vx; x++) k.rect(x, laneY(x), x, laneY(x) + 1, PATH);
    // (the roads in come on the middle line: the lane meets them at its ends)
    for (const x of [-k.vx, k.vx]) k.rect(x, Math.min(0, laneY(x)), x + 1, Math.max(1, laneY(x) + 1), PATH);
    k.rect(0, -k.vy, 1, k.vy, PATH);
    k.rect(-3, -3, 4, 2, COBBLE);
    k.lot('temple', 3, -5, 8, 7);
    // the inn and the forge nearest the square, the houses going off along the lane either way
    k.lot('tavern', -14, frontOf(laneY, -14, 7), 7, 5);
    k.lot('smithy', 6, frontOf(laneY, 6, 6), 6, 5);
    k.lot('shop', 13, frontOf(laneY, 13, 6), 6, 5);
    for (const x of [-20, -26, 20]) k.lot('house', x, frontOf(laneY, x, 5), 5, 4);
    // the back lane, and the row along it
    const backY = (x: number): number => 13 + Math.round(Math.sin(x / 5) * 1.5);
    for (let x = -26; x <= 26; x++) k.rect(x, backY(x), x, backY(x), PATH);
    for (let x = -25; x < 24; x += 6) if (x < -5 || x > 3) k.lot('house', x, frontOf(backY, x, 5), 5, 4);
    const northY = (x: number): number => -9 + Math.round(Math.sin(x / 4) * 1.4);
    for (let x = -26; x <= 26; x++) k.rect(x, northY(x), x, northY(x), PATH);
    for (let x = -24; x < 22; x += 6) if (x < -6 || x > 4) k.lot('house', x, frontOf(northY, x, 5), 5, 4);
    graveyard(k, 6, 3, 24, 9);
    graveyard(k, -24, 3, -6, 9);
    for (let y = -k.vy; y <= k.vy; y += 2) for (let x = -k.vx; x <= k.vx; x += 3) if (Math.hypot(x / k.vx, y / k.vy) > 0.78 && k.rand(x, y, 83) < 0.3) k.tree(x, y);
    return {
      heart: [3, -3],
      stalls: [[-5, 3, -1]],
      stall: 'table',
      goods: ['candles', 'clay-pot', 'sacks', 'basket'],
      furniture: [[-2, -3, 'candles'], [4, -2, 'candles'], [-3, 2, 'candles'], [4, 2, 'candles']],
      lamp: 'lantern',
      fronts: [['candles', 'candles', 'clay-pot'], ['candles', 'sacks', 'barrel']],
      green: false,
    };
  },

  /**
   * The dwarves' holds, and any town cut into its mountain: long stepped streets one above another, a retaining wall of
   * dressed stone behind each row of houses and a stair through it, the thane's hall at the very top of everything.
   */
  terraces(k) {
    const streets = [-7, 0, 7, 14];
    const stair = (x: number): boolean => (x >= -1 && x <= 2) || (x >= -21 && x <= -18) || (x >= 19 && x <= 22);
    k.clear(-11, -17, 12, -13);
    for (const y of streets) k.rect(-k.vx, y, k.vx + 1, y + 1, COBBLE);
    // the stairs between the terraces
    for (const x of [-20, 20]) k.rect(x, -11, x + 1, 15, COBBLE);
    k.rect(0, -11, 1, k.vy, COBBLE);
    // the north road comes down round the hall
    k.rect(-22, -k.vy, 23, -k.vy, COBBLE);
    k.rect(-21, -k.vy, -20, -7, COBBLE);
    k.rect(20, -k.vy, 21, -7, COBBLE);
    k.rect(0, -12, 1, -7, COBBLE);
    plaza(k, -6, -4, 7, 3, COBBLE);
    // the retaining walls
    for (const y of streets) {
      const wall = y - 5;
      for (let x = -26; x <= 27; x++) if (!stair(x) && k.open(x, wall)) k.set(x, wall, RAMPART);
    }
    // the hall at the top of everything
    k.lot('keep', -10, -13, 22, 5);
    k.lot('smithy', -17, -1, 8, 4);
    k.lot('smithy', 11, -8, 7, 4);
    k.lot('temple', -17, -8, 7, 4);
    k.lot('tavern', -17, 6, 8, 4);
    row(k, -3, -1, -8, 2, 5, 4);
    row(k, 3, 1, -8, 1, 5, 4);
    row(k, 8, 1, -1, 2, 5, 4);
    k.lot('shop', 4, 6, 6, 4);
    row(k, 11, 1, 6, 1, 5, 4);
    row(k, -3, -1, 6, 1, 5, 4);
    row(k, -3, -1, 13, 3, 5, 4);
    row(k, 3, 1, 13, 3, 5, 4);
    return {
      heart: [-3, -2],
      stalls: [[6, 2, 1], [-5, 2, -1]],
      stall: 'forge',
      goods: ['anvil', 'weapon-rack', 'grindstone', 'stone-heap'],
      furniture: [[-5, -3, 'iron-torch'], [6, -3, 'iron-torch'], [3, -3, 'stone-heap'], [4, 3, 'cart'], [-2, 3, 'coal-heap'], [7, -1, 'anvil']],
      lamp: 'iron-torch',
      fronts: [['stone-heap', 'barrel', 'crate'], ['coal-heap', 'anvil', 'woodpile']],
      green: false,
    };
  },

  /**
   * The desert towns: all of it faces the water. A wide pool under palms in the middle of the town, sand for streets,
   * striped pavilions for a market, and the houses shoulder to shoulder round the edge to keep the wind out.
   */
  oasis(k) {
    for (let y = 3; y <= 13; y++) for (let x = -12; x <= 13; x++) if (((x - 0.5) / 12.5) ** 2 + ((y - 8) / 5.5) ** 2 < 1) k.water(x, y);
    for (let a = 0; a < 22; a++) {
      const t = (a / 22) * Math.PI * 2;
      k.tree(Math.round(0.5 + Math.cos(t) * 15), Math.round(8 + Math.sin(t) * 7.5));
    }
    k.rect(-k.vx, 0, k.vx + 1, 1, PATH);
    k.rect(0, -k.vy, 1, 2, PATH);
    // (round the pool to the south road)
    k.rect(-17, 2, -16, 15, PATH);
    k.rect(17, 2, 18, 15, PATH);
    k.rect(-17, 14, 18, 15, PATH);
    k.rect(0, 15, 1, k.vy, PATH);
    // the north row looks over the pool; the far rows look over the sand
    k.lot('tavern', -13, -2, 8, 5);
    k.lot('temple', 7, -2, 9, 6);
    row(k, -14, -1, -2, 2, 5, 4);
    row(k, 17, 1, -2, 2, 5, 4);
    k.lot('smithy', -12, -9, 6, 4);
    k.lot('shop', 6, -9, 6, 4);
    row(k, -5, 1, -9, 1, 4, 4);
    k.lot('house', 3, -14, 5, 4);
    k.lot('house', -5, -14, 5, 4);
    k.lot('house', -13, -14, 5, 4);
    row(k, -13, -1, -9, 2, 5, 4);
    row(k, 13, 1, -9, 2, 5, 4);
    // east and west of the pool, and the south shore
    row(k, -26, 1, 9, 1, 5, 4);
    row(k, 18, 1, 9, 2, 5, 4);
    row(k, -14, 1, 18, 3, 5, 4);
    row(k, 3, 1, 18, 3, 5, 4);
    // the colonnade along the road in from the desert
    for (const x of [-26, -21, 19, 24]) {
      k.prop(x, -1, 'standing-stone');
      k.prop(x, 2, 'standing-stone');
    }
    return {
      heart: [-17, 4],
      stalls: [[-17, 7, 1], [17, 6, -1], [-9, 2, -1], [9, 2, 1]],
      stall: 'pavilion',
      goods: ['pot', 'urn', 'basket', 'clay-pot'],
      furniture: [[4, 2, 'bench'], [-4, 2, 'clay-pot'], [-3, -1, 'pot'], [5, -1, 'basket'], [-5, 3, 'urn'], [6, 3, 'urn']],
      lamp: 'torch',
      fronts: [['pot', 'urn', 'clay-pot'], ['basket', 'sacks', 'urn']],
      green: false,
    };
  },

  /**
   * The woods' towns (the fey court, the jungle camp, the Blightwood's last hamlet, the glass-cracked vale): nothing in
   * rows. Houses stand where the trees let them, each with its own trail, and the wood goes on between them.
   */
  glade(k) {
    // two old trails, crossing at the stone, that wander off to the roads
    for (let x = -k.vx; x <= k.vx; x++) k.rect(x, Math.round(Math.sin(x / 7) * 1.6), x, Math.round(Math.sin(x / 7) * 1.6) + 1, PATH);
    for (let y = -k.vy; y <= k.vy; y++) k.rect(Math.round(Math.sin(y / 6) * 1.6), y, Math.round(Math.sin(y / 6) * 1.6) + 1, y, PATH);
    k.rect(-3, -3, 4, 2, DECO);
    k.prop(-8, -5, k.theme === 'fey' ? 'great-mushroom-tree' : k.theme === 'rift' ? 'rift-spire' : 'green-oak');
    for (const [x, y] of [[-9, -5], [-7, -5], [-8, -6], [-8, -4]] as const) k.prop(x, y, 'block');
    const spots: [number, number, LotStyle][] = [
      [8, -8, 'tavern'],
      [-20, -6, 'temple'],
      [-14, 5, 'smithy'],
      [14, 5, 'shop'],
      [-3, -13, 'house'],
      [18, -13, 'house'],
      [-14, -14, 'house'],
      [-23, 8, 'house'],
      [-5, 9, 'house'],
      [6, 13, 'house'],
      [22, 8, 'house'],
      [-14, 15, 'house'],
      [23, -4, 'house'],
      [-25, -13, 'house'],
      [4, -14, 'house'],
      [15, 15, 'house'],
      [-4, 16, 'house'],
    ];
    for (const [x, y, s] of spots) {
      const jx = Math.round((k.rand(x, y, 60) - 0.5) * 3);
      const jy = Math.round((k.rand(x, y, 61) - 0.5) * 2);
      const w = s === 'house' ? 5 : 7;
      // (the wood decides: if it won't go here, a step back from the path)
      if (!k.lot(s, x + jx, y + jy, w, s === 'house' ? 4 : 5)) k.lot(s, x + jx, y + jy - 3, w, s === 'house' ? 4 : 5);
    }
    // the wood between them
    const small = k.theme === 'fey' ? 'great-mushroom' : k.theme === 'rift' ? 'rift-crystal' : k.theme === 'blight' ? 'thorns' : 'planter';
    for (let y = -k.vy; y <= k.vy; y++) {
      for (let x = -k.vx; x <= k.vx; x++) {
        const r = k.rand(x, y, 62);
        if (Math.abs(x) < 7 && Math.abs(y) < 5) continue;
        if (r < 0.08) k.tree(x, y);
        else if (r < 0.11 && k.open(x, y)) k.prop(x, y, small);
      }
    }
    return {
      heart: [3, -3],
      stalls: [[-4, 2, -1], [5, 3, 1]],
      stall: 'market-cart',
      goods: ['basket', 'flowers', 'clay-pot', 'planter'],
      furniture: [[-2, 3, 'lantern'], [4, -3, 'lantern'], [-5, -1, 'bench']],
      lamp: 'lantern',
      fronts: [['flowers', 'planter', 'basket'], ['basket', 'clay-pot', 'sacks']],
      green: true,
    };
  },

  /**
   * A hold (Rimeheld's jarl, the moor folk): a ring of wall against the cold and the wolves, one great hall at the back
   * of the yard with a fire before it, and the people's houses close round the inside of the wall.
   */
  hold(k) {
    const rx = 24;
    const ry = 16;
    const inside = (x: number, y: number): boolean => Math.abs(x) <= rx && Math.abs(y) <= ry && Math.abs(x) + Math.abs(y) * 1.4 <= rx + 12;
    k.clear(-10, -13, 11, -6);
    for (let y = -ry - 1; y <= ry + 1; y++) {
      for (let x = -rx - 1; x <= rx + 1; x++) {
        if (inside(x, y) && (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1))) {
          if (Math.abs(x - 0.5) > 2.5 && Math.abs(y - 0.5) > 2.5 && k.open(x, y)) k.set(x, y, RAMPART);
        }
      }
    }
    // the way round the great hall from the north gate
    k.rect(0, -k.vy, 1, -14, PATH);
    k.rect(-12, -15, 13, -14, PATH);
    k.rect(-12, -15, -11, -5, PATH);
    k.rect(12, -15, 13, -5, PATH);
    k.rect(-k.vx, 0, k.vx + 1, 1, PATH);
    k.rect(0, 0, 1, k.vy, PATH);
    plaza(k, -11, -5, 12, 5, PATH);
    k.lot('hall', -9, -6, 20, 7);
    k.lot('tavern', -22, -2, 8, 5);
    k.lot('smithy', 15, -2, 7, 4);
    k.lot('temple', 14, -7, 6, 4);
    k.lot('shop', -22, -8, 7, 4);
    // the south street and the people's houses along it
    k.rect(-20, 11, 21, 12, PATH);
    k.rect(-16, 2, -15, 12, PATH);
    k.rect(16, 2, 17, 12, PATH);
    for (const [x, w] of [[-14, 5], [-9, 5], [-4, 4], [3, 5], [8, 5], [13, 3]] as const) k.lot('house', x, 10, w, 4);
    k.lot('house', -20, 10, 4, 4);
    k.lot('house', -21, 6, 4, 3);
    k.lot('house', 18, 6, 4, 3);
    for (const [x, y, n] of [[-20, 4, 'woodpile'], [-22, 6, 'hay'], [20, 4, 'woodpile'], [22, 6, 'hay'], [-9, 7, 'barrel'], [8, 7, 'barrel']] as const) k.prop(x, y, n);
    return {
      heart: [-1, -3],
      stalls: [[-7, 2, -1], [8, 2, 1]],
      stall: 'table',
      goods: ['keg', 'sacks', 'barrel', 'woodpile'],
      furniture: [[-6, -4, 'flag'], [7, -4, 'flag'], [-3, -2, 'bench'], [4, -2, 'bench'], [3, 3, 'keg'], [-3, 3, 'barrel']],
      lamp: 'torch',
      fronts: [['woodpile', 'barrel', 'sacks'], ['woodpile', 'hay', 'sacks']],
      green: false,
    };
  },

  /**
   * A war camp: straight lines, mud and canvas. Tents in ranks, a palisade, a muster ground the size of the village it
   * replaced, standards, and the few real buildings kept for the officers and the wounded.
   */
  ranks(k) {
    const rx = 25;
    const ry = 16;
    // (the Host's camp is the color of ash, the last camp in the Reach the color of the snow on it)
    const canvas = k.theme === 'bonefield' ? ':#a89c84' : k.theme === 'pale' ? ':#c8ccd8' : '';
    k.clear(-10, -13, 11, -7);
    for (let x = -rx; x <= rx; x++) {
      for (const y of [-ry, ry]) if (Math.abs(x - 0.5) > 2.5 && k.open(x, y)) k.set(x, y, FENCE);
    }
    for (let y = -ry; y <= ry; y++) {
      for (const x of [-rx, rx]) if (Math.abs(y - 0.5) > 2.5 && k.open(x, y)) k.set(x, y, FENCE);
    }
    for (const [x, y] of [[-rx - 1, -ry - 1], [rx + 1, -ry - 1], [-rx - 1, ry + 1], [rx + 1, ry + 1]] as const) k.prop(x, y, 'lookout');
    k.rect(0, -k.vy, 1, -14, PATH);
    k.rect(-12, -15, 13, -14, PATH);
    k.rect(-12, -15, -11, -6, PATH);
    k.rect(12, -15, 13, -6, PATH);
    k.rect(-k.vx, 0, k.vx + 1, 1, PATH);
    k.rect(0, 0, 1, k.vy, PATH);
    // the muster ground
    k.rect(-12, -6, 13, 5, PATH);
    k.lot('hall', -9, -7, 20, 6);
    k.lot('smithy', 15, -7, 8, 5);
    k.lot('tavern', -23, -7, 9, 5);
    k.lot('temple', 15, -1, 8, 4);
    k.lot('shop', -23, -1, 8, 4);
    // ranks of tents, tight, with the lanes between them dead straight
    for (const y of [8, 11, 14]) {
      for (let x = -22; x <= 22; x += 4) {
        if (Math.abs(x) < 3) continue;
        k.prop(x, y, `${k.rand(x, y, 66) < 0.25 ? 'tent' : 'camp-tent'}${canvas}`);
      }
    }
    for (const x of [-23, -19, 19, 23]) k.prop(x, -13, `camp-tent${canvas}`);
    // (two standards at the foot of the muster ground: eight of them, with the story's own, was a field of flags)
    for (const x of [-10, 11]) k.prop(x, 4, 'red-banner');
    for (const [x, y, name] of [[-9, 2, 'weapon-rack'], [10, 2, 'weapon-rack'], [-9, -3, 'target'], [10, -3, 'target'], [-5, -3, 'armor-stand'], [6, -3, 'armor-stand']] as const) k.prop(x, y, name);
    return {
      heart: [-3, -6],
      stalls: [[-5, 3, -1], [6, 3, 1]],
      stall: 'crates-stack',
      goods: ['barrel', 'rack', 'sacks', 'armor-stand'],
      furniture: [[-2, -3, 'campfire'], [3, -3, 'campfire'], [6, -1, 'notice']],
      lamp: 'torch',
      fronts: [['crate', 'sacks', 'barrel'], ['rack', 'crate', 'barrel']],
      green: false,
    };
  },

  /**
   * A black citadel (the thanes of the Caldera, the archmages of the Riftscar): one great keep behind a moat, the town
   * pressed in between the moat and an outer wall. You come to it over a bridge.
   */
  citadel(k) {
    const rx = 24;
    const ry = 16;
    k.clear(0, -15, 1, -4);
    for (let y = -ry; y <= ry; y++) {
      for (let x = -rx; x <= rx; x++) {
        if ((Math.abs(x) === rx || Math.abs(y) === ry) && Math.abs(x - 0.5) > 2.5 && Math.abs(y - 0.5) > 2.5 && k.open(x, y)) k.set(x, y, RAMPART);
      }
    }
    // the moat round the keep, north of the square, and the one bridge over it
    for (let y = -14; y <= -4; y++) for (let x = -14; x <= 15; x++) if (Math.abs(x - 0.5) > 11 || y < -12 || y > -6) k.water(x, y);
    k.rect(0, -5, 1, -4, BRIDGE);
    // (the keep stands a row back from the moat: the bridge comes onto open ground before its door, so the island is
    // reached by the bridge. With the keep's wall right at the bridge's head the island's ground was cut off, and the
    // land put bridges of its own across the moat to the flags at the keep's corners, each ending at a flag's pole.)
    k.lot('keep', -9, -7, 20, 6);
    // the north gate's road comes round behind the moat
    k.rect(0, -k.vy, 1, -15, COBBLE);
    k.rect(-19, -15, 20, -15, COBBLE);
    k.rect(-19, -15, -18, -3, COBBLE);
    k.rect(19, -15, 20, -3, COBBLE);
    k.rect(0, 0, 1, k.vy, COBBLE);
    k.rect(-k.vx, 0, k.vx + 1, 1, COBBLE);
    k.rect(-rx + 2, -3, rx - 2, 3, COBBLE);
    k.lot('tavern', -23, -4, 7, 5);
    k.lot('temple', 17, -4, 6, 6);
    // the town pressed in below the square, two streets of it against the wall
    k.rect(-rx + 2, 9, rx - 2, 10, COBBLE);
    k.rect(-rx + 2, 15, rx - 2, 15, COBBLE);
    k.lot('smithy', -22, 8, 7, 4);
    k.lot('shop', 15, 8, 7, 4);
    row(k, -14, 1, 8, 2, 5, 4);
    row(k, 3, 1, 8, 2, 5, 4);
    row(k, -22, 1, 14, 4, 5, 4);
    row(k, 3, 1, 14, 4, 5, 4);
    return {
      heart: [-3, 3],
      stalls: [[-10, 3, -1], [11, 3, 1]],
      stall: 'market-stall',
      goods: ['anvil', 'crate', 'rack', 'barrel'],
      furniture: [[-14, -2, 'iron-torch'], [15, -2, 'iron-torch'], [-5, 2, 'iron-torch'], [6, 2, 'iron-torch'], [3, 2, 'anvil']],
      lamp: 'iron-torch',
      fronts: [['crate', 'barrel', 'stone-heap'], ['barrel', 'sacks', 'crate']],
      green: false,
    };
  },

  /**
   * The canyon road (Sablewind): one street, wall to wall. The red rock stands up on both sides, the houses are backed
   * against it, and everything that goes through the canyon goes down this road: wagons, lumber, stone.
   */
  canyon(k) {
    for (let x = -k.vx - 1; x <= k.vx + 1; x++) {
      for (const y of [-11 + Math.round(Math.sin(x / 5) * 1.2), 13 + Math.round(Math.sin(x / 7) * 1.2)]) {
        for (let d = 0; d < 3; d++) {
          if (Math.abs(x - 0.5) > 2.5) k.set(x, y + (y < 0 ? -d : d), WALL);
        }
      }
    }
    k.rect(-k.vx, -1, k.vx + 1, 2, PATH);
    plaza(k, -8, -3, 9, 4, PATH);
    k.rect(0, -k.vy, 1, k.vy, PATH);
    k.lot('tavern', -18, -2, 8, 5);
    k.lot('shop', 8, -2, 7, 5);
    k.lot('smithy', 16, -2, 7, 5);
    row(k, -19, -1, -2, 2);
    // south of the road the houses sit back on a yard of their own
    k.rect(-24, 9, 25, 10, PATH);
    k.lot('temple', -24, 8, 8, 4);
    row(k, -15, 1, 8, 2);
    row(k, 3, 1, 8, 4);
    for (const [x, y, n] of [[-24, 4, 'lumber-pile'], [-13, 4, 'stone-heap'], [13, 4, 'lumber-pile'], [22, 4, 'stone-heap'], [-6, 4, 'cart'], [6, -3, 'wagon']] as const) k.prop(x, y, n);
    return {
      heart: [-3, -2],
      stalls: [[-5, 3, -1], [6, 3, 1]],
      stall: 'cart',
      goods: ['stone-heap', 'lumber-pile', 'barrel', 'crate'],
      furniture: [[-7, -3, 'torch'], [8, -3, 'torch'], [-7, 3, 'torch'], [8, 3, 'torch']],
      lamp: 'torch',
      fronts: [['crate', 'lumber-pile', 'barrel'], ['stone-heap', 'sacks', 'barrel']],
      green: false,
    };
  },

  /**
   * Vaelmoor's drowned quarter: the streets of a real city, gone under. Plank walks laid along where the roads were,
   * roofs and doorways standing out of the water, pillars of a harbor front that isn't there any more.
   */
  drowned(k) {
    for (let y = -k.vy; y <= k.vy; y++) for (let x = -k.vx; x <= k.vx; x++) if ((x / k.vx) ** 4 + (y / k.vy) ** 4 < 1) k.water(x, y);
    const walk = (x0: number, y0: number, x1: number, y1: number): void => k.rect(x0, y0, x1, y1, BRIDGE);
    walk(-k.vx, 0, k.vx + 1, 1);
    walk(0, -k.vy, 1, k.vy);
    for (const y of [-10, 10]) walk(-24, y, 25, y + 1);
    for (const x of [-16, 16]) walk(x, -10, x + 1, 11);
    plaza(k, -5, -4, 6, 3, BRIDGE);
    k.rect(-4, -3, 5, 2, BRIDGE);
    const pad = (style: LotStyle, dx: number, front: number, w: number, h: number): void => {
      hummock(k, dx, front, w, h);
      k.lot(style, dx, front, w, h);
    };
    pad('tavern', -14, -1, 8, 5);
    pad('temple', 7, -1, 8, 6);
    for (const x of [-24, -13, -7, 4, 10, 20]) pad('house', x, -11, 5, 4);
    pad('smithy', -24, -1, 7, 5);
    pad('shop', 19, -1, 6, 4);
    for (const x of [-24, -13, 4, 10, 20]) pad('house', x, 9, 5, 4);
    for (let i = 0; i < 14; i++) {
      const x = -k.vx + 3 + i * 4;
      const y = 15 - (i % 3) * 2;
      if (k.at(x, y) === WATER) {
        k.set(x, y, FLOOR);
        k.prop(x, y, 'broken-column');
      }
    }
    return {
      heart: [-3, -3],
      stalls: [[-3, 1, -1], [5, 1, 1]],
      stall: 'table',
      goods: ['fish', 'crate', 'barrel', 'basket'],
      furniture: [[-4, -3, 'lantern'], [5, -3, 'lantern'], [-4, 2, 'lantern'], [5, 2, 'lantern'], [3, -4, 'crate']],
      lamp: 'lantern',
      fronts: [['crate', 'fish', 'barrel'], ['barrel', 'sacks', 'crate']],
      green: false,
    };
  },
};

/** The quay running north and south, the water to the east of it. */
function quayEast(k: TownKit): TownLook {
  // the front: straight stone where the shore was, whatever the shore did
  const qx = 15;
  for (let y = -k.vy; y <= k.vy; y++) {
    for (let x = qx; x <= k.vx + 8; x++) if (x > qx + 2) k.water(x, y);
    for (let x = qx - 10; x <= qx + 2; x++) if (k.at(x, y) === WATER) k.set(x, y, FLOOR);
  }
  k.rect(qx, -k.vy + 1, qx + 2, k.vy - 1, COBBLE);
  // piers out into it, a boat either side
  for (const [y, len] of [[-13, 12], [-5, 15], [4, 11], [12, 14]] as const) {
    k.rect(qx + 3, y, qx + 3 + len, y + 1, BRIDGE);
    k.prop(qx + 6, y - 2, 'boat', false);
    k.prop(qx + 10, y + 3, 'boat', false);
    k.prop(qx + 2 + len, y, 'crate');
    k.prop(qx + 1 + len, y + 1, 'barrel');
  }
  // lanes down to it: paved, narrow, the houses shoulder to shoulder
  k.rect(-k.vx, 0, qx, 1, COBBLE);
  k.rect(-18, -9, qx, -8, COBBLE);
  k.rect(-18, 9, qx, 10, COBBLE);
  k.rect(0, -k.vy, 1, k.vy, COBBLE);
  k.rect(-18, -9, -17, 10, COBBLE);
  // the fish market where the middle lane meets the water
  plaza(k, 3, 2, qx - 1, 7, COBBLE);
  // warehouses on the front, the inn at the head of the lane
  k.lot('shop', 8, -10, 6, 5);
  k.lot('hall', 8, -1, 6, 5);
  k.lot('tavern', -8, -1, 8, 5);
  k.lot('smithy', 3, -1, 4, 4);
  row(k, -14, -1, -1, 1, 4, 4);
  row(k, -1, -1, -10, 3, 4, 4);
  row(k, 3, 1, -10, 1, 4, 4);
  k.lot('temple', -16, -10, 6, 5);
  row(k, -1, -1, 8, 4, 4, 4);
  row(k, 3, 1, 8, 2, 4, 4);
  row(k, 9, 1, 8, 1, 5, 4);
  // ropes and salt fish on the front
  for (const [x, y, n] of [[qx, -14, 'barrel'], [qx + 1, -10, 'crate'], [qx + 2, -2, 'fish'], [qx, 7, 'barrel'], [qx + 1, 15, 'crate'], [qx + 2, 3, 'barrel']] as const) k.prop(x, y, n);
  return {
    heart: [6, 3],
    stalls: [[9, 5, 1], [4, 5, -1]],
    stall: 'market-cart',
    goods: ['fish', 'barrel', 'crate', 'basket'],
    furniture: [[12, 3, 'fish'], [8, 3, 'fish'], [12, 6, 'barrel'], [2, 2, 'notice'], [3, 3, 'lamp'], [13, 7, 'lamp']],
    lamp: 'lamp',
    fronts: [['barrel', 'crate', 'fish'], ['crate', 'sacks', 'barrel']],
    green: false,
  };
}

/** The same, with the sea to the south: the town looks down at the water over its quay. */
function quaySouth(k: TownKit): TownLook {
  const qy = 10;
  for (let x = -k.vx; x <= k.vx; x++) {
    for (let y = qy + 3; y <= k.vy + 8; y++) k.water(x, y);
    for (let y = qy - 8; y <= qy + 2; y++) if (k.at(x, y) === WATER) k.set(x, y, FLOOR);
  }
  k.rect(-k.vx + 1, qy, k.vx - 1, qy + 2, COBBLE);
  for (const [x, len] of [[-18, 11], [-6, 14], [8, 10], [18, 13]] as const) {
    k.rect(x, qy + 3, x + 1, qy + 3 + len, BRIDGE);
    k.prop(x - 3, qy + 6, 'boat', false);
    k.prop(x + 3, qy + 9, 'boat', false);
    k.prop(x, qy + 2 + len, 'crate');
    k.prop(x + 1, qy + 1 + len, 'barrel');
  }
  k.rect(-k.vx, 0, k.vx + 1, 1, COBBLE);
  k.rect(0, -k.vy, 1, qy, COBBLE);
  k.rect(-22, -9, 23, -8, COBBLE);
  k.rect(-20, -9, -19, qy, COBBLE);
  k.rect(20, -9, 21, qy, COBBLE);
  plaza(k, -6, -2, 7, 2, COBBLE);
  // the front row looks straight out at the piers
  k.lot('tavern', -14, 9, 8, 5);
  k.lot('shop', 6, 9, 6, 5);
  k.lot('hall', 13, 9, 6, 5);
  row(k, -3, -1, 9, 1, 4, 4);
  k.lot('smithy', 3, 9, 3, 4);
  row(k, -3, -1, -1, 4, 4, 4);
  row(k, 3, 1, -1, 4, 4, 4);
  row(k, -3, -1, -10, 4, 4, 4);
  k.lot('temple', 3, -10, 7, 6);
  row(k, 11, 1, -10, 2, 4, 4);
  for (const [x, y, n] of [[-22, qy + 1, 'barrel'], [-12, qy + 2, 'fish'], [-3, qy, 'crate'], [4, qy + 2, 'fish'], [14, qy, 'barrel'], [23, qy + 1, 'crate']] as const) k.prop(x, y, n);
  return {
    heart: [-3, -1],
    stalls: [[-5, 1, -1], [6, 1, 1]],
    stall: 'market-cart',
    goods: ['fish', 'barrel', 'crate', 'basket'],
    furniture: [[5, -2, 'notice'], [3, 2, 'lamp'], [-3, 2, 'lamp'], [-5, -1, 'fish'], [7, -1, 'barrel']],
    lamp: 'lamp',
    fronts: [['barrel', 'crate', 'fish'], ['crate', 'sacks', 'barrel']],
    green: false,
  };
}
