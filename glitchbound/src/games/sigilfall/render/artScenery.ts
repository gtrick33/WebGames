import { hash2 } from '../core/math';
import { REGIONS } from '../data/regions';
import type { Marker } from '../data/types';
import { K, TILE, type TileMap } from '../sim/map';
import type { AnimInfo, Rect, WorldArt } from './art/atlas';
import type { Biome } from './art/biomes';
import { thinWall } from './tileGround';
import { DETAIL, type Cnv } from './pixel';

/**
 * The standing things of an outdoor land drawn from the Royal Keep props: trees and woods, bushes,
 * rocks, fences that join, cottages, the buildings the maps name, camp and town props, and small
 * plants about the open ground. Placed on the same tiles the simulation blocks, so what you see is
 * what stops you. Pieces the pack has no match for (waystones, shrines, dungeon mouths, bones) keep
 * their procedural pictures (see tiles.ts).
 */

const D = DETAIL;

export interface ArtObject {
  x: number;
  y: number;
  c: Cnv;
  dx: number;
  dy: number;
  fade: boolean;
  kind: string;
  /** Source rectangle in the atlas. */
  src: Rect;
  /** An animated prop: frames left to right in `src`. */
  anim?: AnimInfo;
}

/** Something animated over the scene that isn't sorted (chimney smoke). */
export interface ArtOverlay {
  x: number;
  y: number;
  anim: AnimInfo;
  phase: number;
}

type Style = Extract<Marker, { kind: 'building' }>['style'];

const COTTAGES = ['cottage_thatch', 'cottage_tile', 'cottage_slate', 'cottage_stone', 'cottage_moss', 'house_gable_tile', 'house_gable_slate', 'house_gable_plum'];
const STYLE: Record<Style, string[]> = {
  house: COTTAGES,
  tavern: ['inn'],
  inn: ['inn'],
  shop: ['house_tall_tile', 'house_tall_slate', 'house_gable_tile'],
  smithy: ['smithy'],
  temple: ['chapel'],
  keep: ['keep'],
  tower: ['tower_square_roof', 'tower_round_tile', 'tower_round_slate'],
  hall: ['house_tall_tile', 'house_tall_slate', 'stable'],
  lighthouse: ['tower_round_tile'],
};

/** Props the maps name, in the pack's words (several: one is picked per spot). */
const PROPS: Record<string, string[]> = {
  crate: ['crate', 'crates', 'crate_big', 'crate_apples'],
  barrel: ['barrel', 'barrels', 'barrel_water', 'keg'],
  tent: ['tent_red', 'tent_blue', 'tent_small'],
  well: ['well'],
  eggs: ['basket_eggs'],
  anvil: ['anvil'],
  wreck: ['boat'],
  lamp: ['lantern_post'],
};
const ANIMATED_PROPS: Record<string, string> = { campfire: 'campfire', brazier: 'brazier' };

export function buildArtObjects(map: TileMap, art: WorldArt, biome: Biome): { objects: ArtObject[]; overlays: ArtOverlay[]; handled: Set<number> } {
  const objects: ArtObject[] = [];
  const overlays: ArtOverlay[] = [];
  /** Marker tiles drawn here (the procedural builder skips them). */
  const handled = new Set<number>();
  const pick = (list: string[], h: number): string | undefined => {
    const have = list.filter((n) => art.prop[n]);
    return have[Math.floor(h * have.length) % Math.max(1, have.length)];
  };
  /**
   * Stands a prop with its ground point at (x, y) in world pixels; `sortY` is where it sorts with
   * the characters (default: its ground line).
   */
  const stand = (name: string | undefined, x: number, y: number, o: { kind: string; fade?: boolean; sortY?: number } = { kind: 'prop' }): ArtObject | null => {
    const p = name ? art.prop[name] : undefined;
    if (!p) return null;
    const ob: ArtObject = { x, y: o.sortY ?? y, c: art.props, dx: -p.o[0] / D, dy: y - (o.sortY ?? y) - p.o[1] / D, fade: !!o.fade, kind: o.kind, src: p.r };
    objects.push(ob);
    return ob;
  };
  const standAnim = (name: string, x: number, y: number, kind: string): void => {
    const a = art.anim[name];
    if (!a) return;
    objects.push({ x, y, c: art.props, dx: -a.w / D / 2, dy: -a.h / D + 1, fade: false, kind, src: a.r, anim: a });
  };
  /**
   * A building whose footprint is `w` x `h` tiles with its bottom-left tile at (tx, ty): the picture's
   * own footprint is centred on it, its south-west ground corner on the footprint's bottom edge.
   */
  const building = (name: string | undefined, tx: number, ty: number, w: number, xShift = 0): void => {
    const p = name ? art.prop[name] : undefined;
    if (!p) return;
    const fpw = (p.fp?.[0] ?? p.r[2]) / D;
    const left = tx * TILE + (w * TILE - fpw) / 2 + xShift;
    const bottom = (ty + 1) * TILE;
    const x = left + fpw / 2;
    objects.push({ x, y: bottom - 2, c: art.props, dx: left - p.o[0] / D - x, dy: 2 - p.o[1] / D, fade: true, kind: 'building', src: p.r });
    const smoke = art.anim.smoke;
    if (smoke && p.smoke) for (const [sx, sy] of p.smoke) overlays.push({ x: left - p.o[0] / D + sx / D, y: bottom - p.o[1] / D + sy / D, anim: smoke, phase: hash2(tx, ty, 5) });
  };

  const fenceAt = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < map.w && y < map.h && map.kind[y * map.w + x] === K.Fence;
  const kindAt = (x: number, y: number): number => (x < 0 || y < 0 || x >= map.w || y >= map.h ? K.Wall : map.kind[y * map.w + x]!);
  const open = (k: number): boolean => k === K.Floor || k === K.Deco || k === K.Path || k === K.Cobble || k === K.Sand || k === K.Bridge;

  for (let i = 0; i < map.w * map.h; i++) {
    const tx = i % map.w;
    const ty = Math.floor(i / map.w);
    const k = map.kind[i]!;
    const cx = (tx + 0.5) * TILE;
    const bottom = (ty + 1) * TILE;
    const h = hash2(tx, ty, 77);
    switch (k) {
      case K.Tree:
        stand(pick(biome.trees, hash2(tx, ty, 91)), cx + (h - 0.5) * 4, bottom - 2, { kind: 'tree', fade: true });
        break;
      case K.Bush:
        stand(pick(biome.bushes, h), cx, bottom - 3, { kind: 'bush' });
        break;
      case K.Rock:
        stand(pick(biome.rocks, h), cx, bottom - 4, { kind: 'rock' });
        break;
      case K.Bramble:
        stand(pick(['bush_berry', 'bush_wide', 'hedge_block'], h), cx, bottom - 3, { kind: 'bush' });
        break;
      case K.Fence: {
        const n = (fenceAt(tx, ty - 1) ? 1 : 0) + (fenceAt(tx + 1, ty) ? 2 : 0) + (fenceAt(tx, ty + 1) ? 4 : 0) + (fenceAt(tx - 1, ty) ? 8 : 0);
        const iron = biome.edge === 'ledge' && biome.look.grade.sat !== undefined && biome.look.grade.sat < 0.7;
        const name = `${iron ? 'fence_iron' : 'fence'}_${n}`;
        const p = art.prop[name];
        if (p) objects.push({ x: cx, y: bottom - 4, c: art.props, dx: -TILE / 2, dy: 4 - p.o[1] / D, fade: false, kind: 'fence', src: p.r });
        break;
      }
      case K.HouseAnchor:
        // the generator's 4 x 3 cottage, with a little yard in front
        building(pick(COTTAGES, h), tx, ty, 4);
        break;
      case K.Pillar:
        stand(h < 0.6 ? 'pillar' : 'pillar_broken', cx, bottom - 3, { kind: 'pillar', fade: true });
        break;
      case K.Brazier:
        standAnim('brazier', cx, bottom - 4, 'brazier');
        break;
      case K.Wall: {
        if (biome.edge === 'ledge') {
          // a spine of rock one tile thick: boulders, not a cliff
          if (thinWall(map, tx, ty)) stand(pick(['rock_tall', 'rock_mossy_1', 'rock_mossy_2', 'rock_4', ...biome.rocks], h), cx + (hash2(tx, ty, 98) - 0.5) * 4, bottom - 3, { kind: 'rock', fade: true });
          break;
        }
        if (biome.edge !== 'forest') break;
        // woods: a tree on every other tile, more toward the clearing, so the edge reads as a forest
        const edge = open(kindAt(tx, ty + 1)) || open(kindAt(tx, ty - 1)) || open(kindAt(tx - 1, ty)) || open(kindAt(tx + 1, ty));
        const near = edge || open(kindAt(tx, ty + 2)) || open(kindAt(tx + 2, ty)) || open(kindAt(tx - 2, ty));
        const every = (tx + ty) % 2 === 0;
        if (!(every || (near && h < 0.55))) break;
        const jx = (hash2(tx, ty, 92) - 0.5) * 9;
        const jy = (hash2(tx, ty, 93) - 0.5) * 6;
        stand(pick(biome.trees, hash2(tx, ty, 94)), cx + jx, bottom - 2 + jy, { kind: 'tree', fade: near });
        break;
      }
      case K.Floor:
      case K.Deco: {
        // a few small plants about the open land, thicker along the woods and by water
        if (!biome.flora.length) break;
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
        if (h > (rim ? 0.72 : 0.965)) {
          const name = pick(biome.flora.filter((f) => f !== 'lilypad'), hash2(tx, ty, 95));
          stand(name, cx + (hash2(tx, ty, 96) - 0.5) * 10, bottom - 3 - hash2(tx, ty, 97) * 8, { kind: 'flora' });
        }
        break;
      }
      case K.Water:
        if (biome.flora.includes('lilypad') && h > 0.93) stand(h > 0.97 ? 'lilypad_flower' : 'lilypad', cx, bottom - 4, { kind: 'flora' });
        break;
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
    if (m.kind === 'prop') {
      const anim = ANIMATED_PROPS[m.prop];
      if (anim && art.anim[anim]) {
        standAnim(anim, cx, bottom - 3, m.prop);
        handled.add(idx);
      } else if (PROPS[m.prop]) {
        if (stand(pick(PROPS[m.prop]!, h), cx, bottom - 3, { kind: m.prop, fade: m.prop === 'well' || m.prop === 'tent' })) handled.add(idx);
      }
    }
    if (m.kind === 'building') {
      const list = STYLE[m.style];
      if (m.style === 'keep' && m.w >= 8) {
        // a great keep: the keep with a tower at either end of the footprint
        building('keep', pm.tx, pm.ty, m.w);
        const t = art.prop.tower_round_tile;
        if (t) {
          const off = (m.w * TILE) / 2 - (t.fp?.[0] ?? 40) / D / 2 - 2;
          building('tower_round_tile', pm.tx, pm.ty, m.w, -off);
          building('tower_round_tile', pm.tx, pm.ty, m.w, off);
        }
      } else building(pick(list, h), pm.tx, pm.ty, m.w);
      handled.add(idx);
    }
    if (m.kind === 'exit' && REGIONS[m.to]?.kind !== 'dungeon') {
      // a signpost by the road out (one for a wide gateway)
      if (!objects.some((o) => o.kind === 'sign' && Math.abs(o.x - (cx - 10)) < 3 * TILE && Math.abs(o.y - (bottom - 14)) < 3 * TILE)) {
        if (stand('signpost', cx - 10, bottom - 14, { kind: 'sign' })) handled.add(idx);
      } else handled.add(idx);
    }
  }
  return { objects, overlays, handled };
}
