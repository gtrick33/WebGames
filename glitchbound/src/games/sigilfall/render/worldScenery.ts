import { buildingPic } from '../data/buildingArt';
import { hash2, noise2 } from '../core/math';
import { REGIONS } from '../data/regions';
import { K, TILE, type TileMap } from '../sim/map';
import type { AnimInfo, PropAtlas, Rect, WorldArt } from './art/atlas';
import type { Recipe } from './art/recipes';
import type { Cnv } from './pixel';
import { faces, farmFields } from './worldGround';

/** What a small plant is for: where it may grow (the flora rule below). */
type FloraRole = 'shade' | 'field' | 'bloom' | 'water' | 'grass';
const floraRole = (ref: string): FloraRole =>
  /mushroom|stump|log/.test(ref) ? 'shade' : /hay/.test(ref) ? 'field' : /flower/.test(ref) ? 'bloom' : /reeds/.test(ref) ? 'water' : 'grass';
const floraFor = (list: string[], roles: FloraRole[]): string[] => list.filter((ref) => roles.includes(floraRole(ref)));

/** The low rocks of a land's set (boulders stand only in boulder fields, which are walls). */
const lowRocks = (rocks: string[]): string[] => {
  const low = rocks.filter((id) => !/rock_5|rock_tall|mossy_2/.test(id));
  return low.length ? low : ['rock_3'];
};

/**
 * The standing things of an outdoor land, all of them Royal Keep's (VISUAL_BIBLE.md §1): its trees, bushes,
 * rocks, flowers, fences (joined to their neighbours), houses and castles (where the map stands them, so what
 * you see stops you), carts, stalls, tents, lamps and banners. The few story pieces the pack has nothing for
 * (skulls, bones, cages, crystals) are Gloomvault's; waystones, shrines and dungeon doors keep their own
 * pictures.
 */

export interface SceneObject {
  x: number;
  y: number;
  c: Cnv;
  dx: number;
  dy: number;
  fade: boolean;
  kind: string;
  src: Rect;
  k: number;
  anim?: AnimInfo;
}

export interface SceneArt {
  rk: WorldArt;
  gc: PropAtlas | null;
}

/** Map props in the pack's words (the first one the land has wins per spot). */
const PROPS: Record<string, string[]> = {
  crate: ['crate', 'crates', 'crate_apples', 'crate_big'],
  barrel: ['barrel', 'barrels', 'barrel_water', 'keg'],
  tent: ['tent_red', 'tent_blue', 'tent_small'],
  well: ['well'],
  campfire: ['anim:campfire'],
  wreck: ['boat'],
  lamp: ['lantern_post', 'lantern_post_double'],
  cart: ['cart', 'cart_goods'],
  'market-cart': ['stall_red', 'stall_blue', 'stall_green'],
  hay: ['hay_bale', 'hay_pile'],
  'red-banner': ['anim:banner_red'],
  'blue-banner': ['anim:banner_blue'],
  flag: ['anim:flag_blue', 'anim:flag_red'],
  scarecrow: ['training_dummy'],
  bench: ['bench', 'bench_stone'],
  'danger-sign': ['notice_board'],
  windmill: ['cart_hay'],
  watchtower: ['turret'],
  debris: ['log', 'wall_rubble', 'stump'],
  lantern: ['anim:torch_post'],
  'clay-pot': ['pot_clay', 'pot_big'],
  stump: ['stump'],
  rubble: ['wall_rubble', 'rock_3'],
  skulls: ['gc:skulls'],
  'bone-heap': ['gc:scattered_bones'],
  coffin: ['gc:stone_coffin'],
  cage: ['gc:iron_cage'],
  urn: ['pot_big'],
  'skull-banner': ['gc:skull_banner'],
  'iron-torch': ['anim:torch_post'],
  altar: ['gc:stone_altar'],
  crystals: ['gc:cyan_crystals'],
  'standing-stone': ['rock_tall'],
  anvil: ['anvil'],
  'weapon-rack': ['rack_swords', 'rack_spears'],
  stool: ['stool'],
  table: ['table', 'table_food'],
  casks: ['barrels'],
  trough: ['trough'],
  grindstone: ['grindstone'],
  candles: ['anim:candelabra'],
  fountain: ['anim:fountain'],
  flowerbed: ['flowerbed_red', 'flowerbed_gold', 'flowerbed_violet', 'flowerbed_blue'],
  planter: ['planter_red', 'planter_gold', 'planter_blue', 'planter_violet'],
  topiary: ['topiary'],
  notice: ['notice_board'],
  statue: ['statue_king', 'statue_queen', 'statue_knight'],
  target: ['archery_target'],
  'armor-stand': ['armor_stand'],
  woodpile: ['woodpile'],
  'chopping-block': ['chopping_block'],
  log: ['log'],
  bedroll: ['bedroll_red', 'bedroll_blue'],
  cauldron: ['cauldron'],
  gravestone: ['gravestone_1', 'gravestone_2'],
  'grave-cross': ['grave_cross'],
  sacks: ['sacks', 'sack_grain', 'sack_flour'],
  bucket: ['bucket_water', 'bucket'],
  // the land's own dressing (zonegen.ts scenes), named apart from the story's
  'camp-tent': ['tent_red', 'tent_blue', 'tent_small'],
  wagon: ['cart', 'cart_goods', 'cart_hay'],
  torch: ['anim:torch_post'],
  menhir: ['rock_tall'],
  // a village's street life (zonegen.ts village)
  'market-goods': ['market_veg', 'market_fish', 'market_pots', 'market_cloth', 'market_arms'],
  basket: ['basket_apples', 'basket_bread', 'basket_eggs', 'basket'],
  hedge: ['hedge_h', 'hedge_h_rose', 'hedge_long'],
  boat: ['boat'],
  flowers: ['flowers_red', 'flowers_yellow', 'flowers_white', 'flowers_pink', 'flowers_blue', 'flowers_violet'],
  'shop-sign': ['sign_inn', 'sign_shop', 'sign_smith', 'sign_arms'],
  rack: ['rack_shields', 'rack_spears', 'rack_swords'],
  pavilion: ['pavilion_blue', 'pavilion_red'],
  keg: ['keg'],
  pot: ['pot_clay', 'pot_blue', 'pot_big'],
  fish: ['barrel_fish'],
  brazier: ['anim:brazier'],
};

/** The pieces that give light: how far it reaches, and how high its flame or lamp is over its foot (world px). */
const LIGHT: Record<string, [number, number]> = {
  'anim:wall_torch': [46, 8],
  'anim:torch_post': [52, 14],
  'anim:campfire': [70, 4],
  'anim:brazier': [62, 8],
  'anim:candelabra': [40, 10],
  lantern_post: [54, 16],
  lantern_post_double: [60, 16],
};

/** Tall props the hero fades when walking behind. */
const FADE = new Set(['pavilion', 'brazier', 'well', 'tent', 'camp-tent', 'torch', 'menhir', 'market-cart', 'watchtower', 'fountain', 'statue', 'lamp', 'lantern', 'scarecrow', 'red-banner', 'blue-banner', 'skull-banner', 'standing-stone']);

/** Every piece the fixed tables name (for the art-integrity test). */
export const sceneryRefs = (): string[] => [...Object.values(PROPS).flat(), 'signpost', 'pillar', 'pillar_broken', 'anim:smoke', 'lilypad', 'lilypad_flower', 'reeds', 'reeds_2', 'bush_small_leaf', 'bush_small_mint', 'hedge_block', 'planter_red', 'anim:wall_torch', 'wall_banner_blue', 'wall_banner_red', 'wall_moss_a', 'wall_crack_a', ...Array.from({ length: 16 }, (_, n) => `fence_${n}`), ...Array.from({ length: 16 }, (_, n) => `fence_iron_${n}`)];

export function buildWorldObjects(map: TileMap, art: SceneArt, r: Recipe, town = false): { objects: SceneObject[]; handled: Set<number>; lights: { x: number; y: number; r: number }[] } {
  const objects: SceneObject[] = [];
  const handled = new Set<number>();
  const lights: { x: number; y: number; r: number }[] = [];
  const rk = art.rk;
  /** A piece by name ('tree_big_leaf', 'anim:campfire', 'gc:skulls'): its picture, ground point and scale. */
  const find = (ref: string): { c: Cnv; r: Rect; o: [number, number]; k: number; fp?: [number, number]; anim?: AnimInfo; smoke?: [number, number][] } | null => {
    if (ref.startsWith('gc:')) {
      const p = art.gc?.props[ref.slice(3)];
      return p && art.gc ? { c: art.gc.img, r: p.r, o: p.o, k: art.gc.k } : null;
    }
    if (ref.startsWith('anim:')) {
      const a = rk.anim[ref.slice(5)];
      return a ? { c: rk.props, r: [a.r[0], a.r[1], a.w, a.h], o: [a.w / 2, a.h], k: rk.k, anim: a } : null;
    }
    const p = rk.prop[ref];
    return p ? { c: rk.props, r: p.r, o: p.o, k: rk.k, ...(p.fp ? { fp: p.fp } : {}), ...(p.smoke ? { smoke: p.smoke } : {}) } : null;
  };
  const pick = (list: string[], h: number): string | undefined => {
    const have = list.filter((ref) => find(ref));
    return have.length ? have[Math.floor(h * have.length) % have.length] : undefined;
  };
  /** Stands a piece with its ground point at (x, y) world px; it sorts at `sortY` (its ground line by default). */
  const stand = (ref: string | undefined, x: number, y: number, kind: string, fade = false, sortY = y): SceneObject | null => {
    const p = ref ? find(ref) : null;
    if (!p) return null;
    // a piece with walls (a stall, a well, a tower, a tent) has its origin at its south-west corner: centered on
    // its footprint, so it stands on its tile, not half a tile east of it
    const ox = p.fp ? p.o[0] + p.fp[0] / 2 : p.o[0];
    const ob: SceneObject = { x, y: sortY, c: p.c, dx: -ox / p.k, dy: y - sortY - p.o[1] / p.k, fade, kind, src: p.r, k: p.k, ...(p.anim ? { anim: p.anim } : {}) };
    objects.push(ob);
    // a flame or a lamp lights the dark around it (the crypt, a night, a frightening land)
    const glow = ref ? LIGHT[ref] : undefined;
    if (glow) lights.push({ x, y: y - glow[1], r: glow[0] });
    return ob;
  };

  const kindAt = (x: number, y: number): number => (x < 0 || y < 0 || x >= map.w || y >= map.h ? K.Wall : map.kind[y * map.w + x]!);
  const open = (k: number): boolean => k === K.Floor || k === K.Deco || k === K.Path || k === K.Cobble || k === K.Sand || k === K.Bridge;
  const fenceAt = (x: number, y: number): boolean => kindAt(x, y) === K.Fence;
  // a fence round graves is wrought iron
  const graves = map.markers.filter((pm) => pm.marker.kind === 'prop' && (pm.marker.prop === 'gravestone' || pm.marker.prop === 'grave-cross'));
  const byGraves = (x: number, y: number): boolean => graves.some((pm) => Math.abs(pm.tx - x) <= 3 && Math.abs(pm.ty - y) <= 3);
  const field = farmFields(map);
  const calm = !r.water?.hue;
  // a bare land's rock is drawn as cliffs (worldGround.ts): nothing stands on their faces
  const cliff = r.edge === 'rocks' ? faces(map, K.Wall, 3) : null;

  for (let i = 0; i < map.w * map.h; i++) {
    const tx = i % map.w;
    const ty = Math.floor(i / map.w);
    const k = map.kind[i]!;
    const cx = (tx + 0.5) * TILE;
    const bottom = (ty + 1) * TILE;
    const h = hash2(tx, ty, 77);
    switch (k) {
      // off the tile grid a little, so a copse reads as grown, not planted in rows
      case K.Tree:
        stand(pick(r.trees, hash2(tx, ty, 91)), cx + (h - 0.5) * 8, bottom - 2 + (hash2(tx, ty, 95) - 0.5) * 5, 'tree', true);
        break;
      case K.Bush:
      case K.Bramble:
        stand(pick(r.bushes, h), cx + (hash2(tx, ty, 96) - 0.5) * 5, bottom - 3, 'bush');
        break;
      case K.Illusion:
        // a hedge that isn't quite there (the secret way through)
        stand('hedge_block', cx, bottom - 1, 'bush');
        break;
      case K.Rock:
        // a lone rock is low (shots fly over it, sim/map.ts): never one of the land's boulders
        stand(pick(lowRocks(r.rocks), h), cx, bottom - 4, 'rock');
        break;
      case K.Fence: {
        // the pack's fences join themselves: 1 north, 2 east, 4 south, 8 west
        const n = (fenceAt(tx, ty - 1) ? 1 : 0) + (fenceAt(tx + 1, ty) ? 2 : 0) + (fenceAt(tx, ty + 1) ? 4 : 0) + (fenceAt(tx - 1, ty) ? 8 : 0);
        const p = find(byGraves(tx, ty) ? `fence_iron_${n}` : `fence_${n}`);
        if (p) objects.push({ x: cx, y: bottom - 3, c: p.c, dx: -TILE / 2, dy: 3 - p.o[1] / p.k, fade: false, kind: 'fence', src: p.r, k: p.k });
        break;
      }
      case K.Pillar:
        // a ruin's standing stones are the land's own (graves on the moors, crystals in the fey wood)
        stand(pick(r.ruins ?? ['pillar', 'pillar_broken'], h), cx, bottom - 3, 'pillar', true);
        break;
      case K.Wall: {
        // woods and boulder fields: about half the tiles carry a piece (thicker along the clearing), at random
        // and well off the grid, big trees in the deep wood and every size at its edge
        const edge = open(kindAt(tx, ty + 1)) || open(kindAt(tx, ty - 1)) || open(kindAt(tx - 1, ty)) || open(kindAt(tx + 1, ty));
        const near = edge || open(kindAt(tx, ty + 2)) || open(kindAt(tx + 2, ty)) || open(kindAt(tx - 2, ty));
        if (hash2(tx, ty, 90) > (near ? 0.62 : 0.4)) break;
        const jx = (hash2(tx, ty, 92) - 0.5) * 12;
        const jy = (hash2(tx, ty, 93) - 0.5) * 8;
        if (r.edge === 'forest') {
          const deep = near ? r.trees : r.trees.filter((t) => /big|tall|pine_big/.test(t));
          stand(pick(deep.length ? deep : r.trees, hash2(tx, ty, 94)), cx + jx, bottom - 2 + jy, 'tree', near);
        } else if (!cliff?.[i] && !cliff?.[i + map.w] && hash2(tx, ty, 98) < 0.5) {
          // on top of the cliffs, away from their edge: a tree now and then, a boulder
          stand(pick(h < 0.55 ? r.trees : r.rocks, hash2(tx, ty, 94)), cx + jx * 0.5, bottom - 2, h < 0.55 ? 'tree' : 'rock', true);
        }
        break;
      }
      case K.Water: {
        // lily pads on still water, near its banks
        if (!calm || h > 0.07) break;
        let bank = false;
        for (const [dx, dy] of [
          [0, -1],
          [1, 0],
          [0, 1],
          [-1, 0],
        ] as const)
          if (open(kindAt(tx + dx, ty + dy))) bank = true;
        if (bank) stand(h < 0.025 ? 'lilypad_flower' : 'lilypad', cx + (hash2(tx, ty, 98) - 0.5) * 8, bottom - 4, 'lily', false, ty * TILE);
        break;
      }
      case K.Sand:
      case K.Floor:
      case K.Deco: {
        // a desert's sand grows what the desert grows (a beach's stays bare)
        if (k === K.Sand && r.ground.base !== 'sand') break;
        // crops in rows on the tilled fields
        if (field[i]) {
          if (ty % 2 === 0) stand(hash2(tx, ty, 99) < 0.5 ? 'bush_small_leaf' : 'bush_small_mint', cx + (hash2(tx, ty, 97) - 0.5) * 3, bottom - 5, 'crop');
          break;
        }
        if (!r.flora.length) break;
        let rim = false;
        let shore = false;
        for (const [dx, dy] of [
          [0, -1],
          [1, 0],
          [0, 1],
          [-1, 0],
        ] as const) {
          const nk = kindAt(tx + dx, ty + dy);
          if (nk === K.Wall || nk === K.Tree || nk === K.Rock) rim = true;
          if (nk === K.Water) shore = true;
        }
        // reeds where the land meets still water
        if (shore && calm && h > 0.7) {
          stand(h > 0.85 ? 'reeds' : 'reeds_2', cx + (hash2(tx, ty, 96) - 0.5) * 8, bottom - 2, 'flora');
          break;
        }
        // plants grow where they would: mushrooms and stumps at the foot of woods and rocks, hay by fences,
        // flowers in the meadows and by houses, only grass out in the open
        let fenced = k === K.Deco;
        let garden = false;
        for (const [dx, dy] of [
          [0, -1],
          [1, 0],
          [0, 1],
          [-1, 0],
          [0, 2],
        ] as const) {
          const nk = kindAt(tx + dx, ty + dy);
          if (nk === K.Fence) fenced = true;
          if (nk === K.House) garden = true;
        }
        const clump = noise2(tx / 7, ty / 7, 191) > 0.52;
        const fits = floraFor(r.flora, rim ? ['shade', 'grass'] : fenced ? ['field', 'bloom', 'grass'] : garden ? ['bloom', 'grass'] : clump ? ['bloom', 'grass'] : ['grass']);
        // the open land is never bare: grass in tufts everywhere, meadows thick where they grow
        if (fits.length && h > (rim ? 0.66 : fenced || garden ? 0.8 : clump ? 0.62 : 0.88)) stand(pick(fits, hash2(tx, ty, 95)), cx + (hash2(tx, ty, 96) - 0.5) * 10, bottom - 3 - hash2(tx, ty, 97) * 8, 'flora');
        break;
      }
      default:
        break;
    }
  }

  // a long wall is kept: torches and banners along its face (the Regent's blue in a town); a short one is a
  // ruin: moss and cracks
  const wallFace = faces(map, K.Rampart);
  for (let ty = 0; ty < map.h; ty++) {
    for (let tx = 0; tx < map.w; tx++) {
      if (wallFace[ty * map.w + tx] !== 1 || (tx > 0 && wallFace[ty * map.w + tx - 1] === 1)) continue;
      let len = 0;
      while (tx + len < map.w && wallFace[ty * map.w + tx + len] === 1) len++;
      const tall = ty > 0 && wallFace[(ty - 1) * map.w + tx] === 2;
      const foot = (ty + 1) * TILE - 1;
      if (len >= 8) {
        for (let k = 3, n = 0; k < len - 1; k += 5, n++) {
          const x = (tx + k + 0.5) * TILE;
          if (n % 2 === 0) stand('anim:wall_torch', x, foot - (tall ? 10 : 2), 'decor', false, foot);
          else stand(town ? 'wall_banner_blue' : 'wall_banner_red', x, foot - (tall ? 4 : 0), 'decor', false, foot);
        }
      } else {
        for (let k = 0; k < len; k++) {
          const hh = hash2(tx + k, ty, 99);
          if (hh < 0.3) stand(hh < 0.15 ? 'wall_moss_a' : 'wall_crack_a', (tx + k + 0.5) * TILE, foot - 2, 'decor', false, foot);
        }
      }
      tx += len;
    }
  }

  // the buildings where the map stands them (sim/map.ts), each with its yard and its chimneys smoking
  for (const b of map.buildings) {
    for (const pic of b.pics) {
      const p = find(pic.id);
      const m = buildingPic(pic.id);
      if (!p || !m) continue;
      const x = pic.x + m.ox + m.fpw / 2;
      const top = pic.y - p.o[1] / p.k;
      objects.push({ x, y: pic.y - 2, c: p.c, dx: pic.x - x, dy: top - (pic.y - 2), fade: true, kind: 'building', src: p.r, k: p.k });
      for (const [sx, sy] of p.smoke ?? []) stand('anim:smoke', pic.x + sx / p.k, top + sy / p.k, 'smoke', false, pic.y - 1);
    }
    for (const y of b.yard) stand(y.prop, (y.tx + 0.5) * TILE, (y.ty + 1) * TILE - 3, 'yard');
  }

  for (const pm of map.markers) {
    const m = pm.marker;
    const cx = (pm.tx + 0.5) * TILE;
    const bottom = (pm.ty + 1) * TILE;
    const idx = pm.ty * map.w + pm.tx;
    const h = hash2(pm.tx, pm.ty, 51);
    if (m.kind === 'prop' && PROPS[m.prop]?.length) {
      if (stand(pick(PROPS[m.prop]!, h), cx + (m.prop === 'bench' || m.prop === 'flowerbed' || m.prop === 'log' ? 0 : (hash2(pm.tx, pm.ty, 53) - 0.5) * 3), bottom - 3, m.prop, FADE.has(m.prop))) handled.add(idx);
    }
    if (m.kind === 'building') handled.add(idx);
    // a signpost by the road out (one for a wide gateway); doors are marked where they are (the renderer)
    if (m.kind === 'exit' && !m.door && REGIONS[m.to]?.kind !== 'dungeon') {
      if (!objects.some((o) => o.kind === 'sign' && Math.abs(o.x - (cx - 10)) < 3 * TILE && Math.abs(o.y - (bottom - 14)) < 3 * TILE)) stand('signpost', cx - 10, bottom - 14, 'sign');
      handled.add(idx);
    }
    if (m.kind === 'exit' && m.door) handled.add(idx);
  }
  return { objects, handled, lights };
}
