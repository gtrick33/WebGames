import { hash2, noise2 } from '../core/math';
import { REGIONS } from '../data/regions';
import type { Marker } from '../data/types';
import { K, TILE, type TileMap } from '../sim/map';
import type { PropAtlas, Rect, WorldArt } from './art/atlas';
import type { Recipe } from './art/recipes';
import type { Cnv } from './pixel';

/** What a small plant is for: where it may grow (worldScenery's flora rule). */
type FloraRole = 'shade' | 'field' | 'garden' | 'bloom' | 'bush' | 'grass';
const floraRole = (ref: string): FloraRole =>
  /mushroom|toadstool|fern|sticks|log/.test(ref)
    ? 'shade'
    : /hay/.test(ref)
      ? 'field'
      : /sunflower/.test(ref)
        ? 'garden'
        : /flower|bellflower|rafflesia|blossom/.test(ref)
          ? 'bloom'
          : /bush|shrub/.test(ref)
            ? 'bush'
            : 'grass';
const floraFor = (list: string[], roles: FloraRole[]): string[] => list.filter((ref) => roles.includes(floraRole(ref)));

/** The low rocks of a land's set (boulders stand only in boulder fields, which are walls). */
const lowRocks = (rocks: string[]): string[] => {
  const low = rocks.filter((id) => !id.includes('boulder'));
  return low.length ? low : ['cps:rock-01'];
};

/**
 * The standing things of an outdoor land in the approved hierarchy: CraftPix trees, bushes, rocks,
 * fences, houses, wells, tents, banners and towers lead; Worlds-bundle pieces stand in only for what
 * CraftPix lacks (crates, lamps, signposts, cottages, reeds); Royal Keep (smoothed) builds the capital's
 * houses and every keep and chapel. Placed on the tiles the simulation blocks, so what you see stops you.
 * Things the packs don't have (waystones, shrines, dungeon mouths) keep their procedural pictures.
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
}

type Style = Extract<Marker, { kind: 'building' }>['style'];

export interface SceneArt {
  props: Record<string, PropAtlas>;
  /** Royal Keep's smoothed build (architecture), or null. */
  rk: WorldArt | null;
}

/** Map props in the packs' words, first one the land has wins per spot. */
const PROPS: Record<string, string[]> = {
  crate: ['gv:wooden_crate'],
  barrel: ['cps:wooden-barrel', 'gv:wooden_barrel'],
  tent: ['cps:tent'],
  well: ['cps:well'],
  campfire: ['cps:campfire'],
  wreck: ['cpw:broken-boat'],
  lamp: ['gv:lamp_post'],
  bones: ['cpw:animal-skeleton'],
  chickens: [],
  // the story's dressing (camps, blockades, shrines, aftermaths)
  cart: ['cps:wooden-cart'],
  'market-cart': ['gv:market_cart'],
  hay: ['gv:hay_bale'],
  'red-banner': ['cps:red-banner'],
  'blue-banner': ['cps:blue-banner'],
  flag: ['cps:flag'],
  scarecrow: ['gv:scarecrow'],
  bench: ['gv:wooden_bench'],
  'danger-sign': ['cpw:danger-sign'],
  windmill: ['cps:windmill'],
  watchtower: ['cps:watchtower-short'],
  debris: ['cpw:sticks-2', 'cpw:sticks-4', 'cpw:sticks-5'],
  lantern: ['cpw:lantern'],
  'clay-pot': ['gv:clay_pot'],
  stump: ['cps:tree-stump-short'],
  rubble: ['gc:rubble'],
  skulls: ['gc:skulls'],
  'bone-heap': ['gc:scattered_bones'],
  coffin: ['gc:stone_coffin'],
  cage: ['gc:iron_cage'],
  urn: ['gc:ceramic_urn'],
  'skull-banner': ['gc:skull_banner'],
  'iron-torch': ['gc:iron_torch'],
  altar: ['gc:stone_altar'],
  crystals: ['gc:cyan_crystals'],
  'standing-stone': ['cpw:boulder-1', 'cpw:boulder-2', 'cpw:boulder-3'],
};

/** Buildings by style: the capital is Royal Keep's (architecture), the wilds CraftPix-led. */
const STYLE: Record<Style, { capital: string[]; wild: string[] }> = {
  house: { capital: ['rk:house_gable_tile', 'rk:house_gable_slate', 'rk:cottage_tile'], wild: ['cps:house'] },
  tavern: { capital: ['rk:inn'], wild: ['cps:house'] },
  inn: { capital: ['rk:inn'], wild: ['cps:house'] },
  shop: { capital: ['rk:house_tall_tile', 'rk:house_tall_slate'], wild: ['cps:house'] },
  smithy: { capital: ['rk:smithy'], wild: ['gv:blacksmith_hut'] },
  temple: { capital: ['rk:chapel'], wild: ['rk:chapel'] },
  keep: { capital: ['rk:keep'], wild: ['rk:keep'] },
  tower: { capital: ['rk:tower_square_roof'], wild: ['cpt:brick-watchtower-level-2', 'cpt:wooden-watchtower-level-3'] },
  hall: { capital: ['rk:house_tall_tile'], wild: ['rk:stable'] },
  lighthouse: { capital: ['cps:magic-stone-tower'], wild: ['cps:magic-stone-tower'] },
};

/** Every piece the fixed tables name (for the art-integrity test). */
export const sceneryRefs = (): string[] => [...Object.values(PROPS).flat(), ...Object.values(STYLE).flatMap((s) => [...s.capital, ...s.wild]), 'cps:wooden-fence-horizontal', 'cps:wooden-fence-vertical', 'gv:wooden_signpost', 'rk:pillar', 'rk:pillar_broken', 'rk:keep', 'rk:tower_round_tile'];

export function buildWorldObjects(map: TileMap, art: SceneArt, r: Recipe, capital: boolean): { objects: SceneObject[]; handled: Set<number> } {
  const objects: SceneObject[] = [];
  const handled = new Set<number>();
  /** A piece by reference ("cps:tree-medium", "rk:keep"). */
  const find = (ref: string): { c: Cnv; r: Rect; o: [number, number]; k: number; fp?: [number, number] } | null => {
    const [atlas, name] = ref.split(':') as [string, string];
    if (atlas === 'rk') {
      const p = art.rk?.prop[name];
      return p && art.rk ? { c: art.rk.props, r: p.r, o: p.o, k: art.rk.k, ...(p.fp ? { fp: p.fp } : {}) } : null;
    }
    const a = art.props[atlas];
    const p = a?.props[name];
    return p && a ? { c: a.img, r: p.r, o: p.o, k: a.k } : null;
  };
  const pick = (list: string[], h: number): string | undefined => {
    const have = list.filter((ref) => find(ref));
    return have.length ? have[Math.floor(h * have.length) % have.length] : undefined;
  };
  /** Stands a piece with its ground point at (x, y) world px; it sorts at `sortY` (its ground line by default). */
  const stand = (ref: string | undefined, x: number, y: number, kind: string, fade = false, sortY = y): SceneObject | null => {
    const p = ref ? find(ref) : null;
    if (!p) return null;
    const ob: SceneObject = { x, y: sortY, c: p.c, dx: -p.o[0] / p.k, dy: y - sortY - p.o[1] / p.k, fade, kind, src: p.r, k: p.k };
    objects.push(ob);
    return ob;
  };
  /**
   * A building on a footprint of `w` tiles whose bottom-left tile is (tx, ty): centered on it, standing on
   * its bottom edge. Royal Keep buildings carry their own footprint and origin (south-west corner).
   */
  const building = (ref: string | undefined, tx: number, ty: number, w: number, shift = 0): void => {
    const p = ref ? find(ref) : null;
    if (!p) return;
    const bottom = (ty + 1) * TILE;
    const cx = tx * TILE + (w * TILE) / 2 + shift;
    if (p.fp) {
      const fpw = p.fp[0] / p.k;
      const left = cx - fpw / 2;
      objects.push({ x: cx, y: bottom - 2, c: p.c, dx: left - p.o[0] / p.k - cx, dy: 2 - p.o[1] / p.k, fade: true, kind: 'building', src: p.r, k: p.k });
    } else objects.push({ x: cx, y: bottom - 2, c: p.c, dx: -p.o[0] / p.k, dy: 2 - p.o[1] / p.k, fade: true, kind: 'building', src: p.r, k: p.k });
  };

  const kindAt = (x: number, y: number): number => (x < 0 || y < 0 || x >= map.w || y >= map.h ? K.Wall : map.kind[y * map.w + x]!);
  const open = (k: number): boolean => k === K.Floor || k === K.Deco || k === K.Path || k === K.Cobble || k === K.Sand || k === K.Bridge;
  const fenceAt = (x: number, y: number): boolean => kindAt(x, y) === K.Fence;

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
        stand(pick(r.trees, hash2(tx, ty, 91)), cx + (h - 0.5) * 10, bottom - 2 + (hash2(tx, ty, 95) - 0.5) * 5, 'tree', true);
        break;
      case K.Bush:
      case K.Bramble:
        stand(pick(r.bushes, h), cx + (hash2(tx, ty, 96) - 0.5) * 7, bottom - 3, 'bush');
        break;
      case K.Rock:
        // a lone rock is low (shots fly over it, sim/map.ts): never one of the land's boulders
        stand(pick(lowRocks(r.rocks), h), cx, bottom - 4, 'rock');
        break;
      case K.Fence: {
        // CraftPix fence runs: a rail east-west, a rail north-south, and a post where they turn
        const ew = fenceAt(tx - 1, ty) || fenceAt(tx + 1, ty);
        const ns = fenceAt(tx, ty - 1) || fenceAt(tx, ty + 1);
        if (ew || !ns) stand('cps:wooden-fence-horizontal', cx, bottom - 3, 'fence');
        if (ns) stand('cps:wooden-fence-vertical', cx, bottom - 1, 'fence');
        break;
      }
      case K.HouseAnchor:
        building(capital ? pick(STYLE.house.capital, h) : pick(r.houses, h), tx, ty, 4);
        break;
      case K.Pillar:
        // a ruin's standing stones are the land's own (graves on the moors, crystals in the fey wood)
        stand(pick(r.ruins ?? ['rk:pillar', 'rk:pillar_broken'], h), cx, bottom - 3, 'pillar', true);
        break;
      case K.Wall: {
        // woods and boulder fields: about half the tiles carry a piece (thicker along the clearing), at random
        // and well off the grid (it was every other tile, which read as a checkerboard of trees)
        const edge = open(kindAt(tx, ty + 1)) || open(kindAt(tx, ty - 1)) || open(kindAt(tx - 1, ty)) || open(kindAt(tx + 1, ty));
        const near = edge || open(kindAt(tx, ty + 2)) || open(kindAt(tx + 2, ty)) || open(kindAt(tx - 2, ty));
        if (hash2(tx, ty, 90) > (near ? 0.8 : 0.52)) break;
        const jx = (hash2(tx, ty, 92) - 0.5) * 14;
        const jy = (hash2(tx, ty, 93) - 0.5) * 9;
        if (r.edge === 'forest') stand(pick(r.trees, hash2(tx, ty, 94)), cx + jx, bottom - 2 + jy, 'tree', near);
        else stand(pick(h < 0.25 ? r.trees : r.rocks, hash2(tx, ty, 94)), cx + jx, bottom - 2 + jy, 'rock', near);
        break;
      }
      case K.Floor:
      case K.Deco: {
        if (!r.flora.length) break;
        let rim = false;
        for (const [dx, dy] of [
          [0, -1],
          [1, 0],
          [0, 1],
          [-1, 0],
        ] as const) {
          const nk = kindAt(tx + dx, ty + dy);
          if (nk === K.Wall || nk === K.Tree || nk === K.Water || nk === K.Rock) rim = true;
        }
        // plants grow where they would: mushrooms, ferns and undergrowth at the foot of woods, rocks and water;
        // flowers and hay by houses, fences and fields; flowers in the meadows; only grass out in the open
        // (sunflowers and toadstools sprinkled over every field looked like a toy box)
        let field = k === K.Deco;
        let garden = false;
        for (const [dx, dy] of [
          [0, -1],
          [1, 0],
          [0, 1],
          [-1, 0],
          [0, 2],
        ] as const) {
          const nk = kindAt(tx + dx, ty + dy);
          if (nk === K.Fence) field = true;
          if (nk === K.House || nk === K.HouseAnchor) garden = true;
        }
        const tended = field || garden;
        const clump = noise2(tx / 7, ty / 7, 191) > 0.64;
        const fits = floraFor(r.flora, rim ? ['shade', 'bush', 'grass'] : field ? ['field', 'garden', 'grass'] : garden ? ['garden', 'bloom', 'grass'] : clump ? ['bloom', 'grass'] : ['grass']);
        if (fits.length && h > (rim ? 0.8 : tended ? 0.82 : clump ? 0.84 : 0.975)) stand(pick(fits, hash2(tx, ty, 95)), cx + (hash2(tx, ty, 96) - 0.5) * 10, bottom - 3 - hash2(tx, ty, 97) * 8, 'flora');
        break;
      }
      default:
        break;
    }
  }

  for (const pm of map.markers) {
    const m = pm.marker;
    const cx = (pm.tx + 0.5) * TILE;
    const bottom = (pm.ty + 1) * TILE;
    const idx = pm.ty * map.w + pm.tx;
    const h = hash2(pm.tx, pm.ty, 51);
    if (m.kind === 'prop' && PROPS[m.prop]?.length) {
      if (stand(pick(PROPS[m.prop]!, h), cx, bottom - 3, m.prop, m.prop === 'well' || m.prop === 'tent')) handled.add(idx);
    }
    if (m.kind === 'building') {
      const s = STYLE[m.style];
      if (m.style === 'keep' && m.w >= 8) {
        building('rk:keep', pm.tx, pm.ty, m.w);
        const off = (m.w * TILE) / 2 - 22;
        building('rk:tower_round_tile', pm.tx, pm.ty, m.w, -off);
        building('rk:tower_round_tile', pm.tx, pm.ty, m.w, off);
      } else building(m.art && find(m.art) ? m.art : pick(capital ? s.capital : s.wild, h), pm.tx, pm.ty, m.w);
      handled.add(idx);
    }
    if (m.kind === 'exit' && REGIONS[m.to]?.kind !== 'dungeon') {
      if (!objects.some((o) => o.kind === 'sign' && Math.abs(o.x - (cx - 10)) < 3 * TILE && Math.abs(o.y - (bottom - 14)) < 3 * TILE)) {
        if (stand('gv:wooden_signpost', cx - 10, bottom - 14, 'sign')) handled.add(idx);
      } else handled.add(idx);
    }
  }
  return { objects, handled };
}
