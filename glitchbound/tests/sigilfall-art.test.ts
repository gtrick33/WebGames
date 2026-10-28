import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildingPic, buildingPicIds } from '../src/games/sigilfall/data/buildingArt';
import { THEMES } from '../src/games/sigilfall/data/themes';
import { DERIVED, RECIPES, recipeRefs } from '../src/games/sigilfall/render/art/recipes';
import { sceneryRefs } from '../src/games/sigilfall/render/worldScenery';
import type { Theme } from '../src/games/sigilfall/data/types';

/**
 * The packed art and the tables that name pieces of it: every prop, ground set and decal a land asks for is in
 * the atlases the build ships (public/games/sigilfall/art), so nothing silently falls back; and the outdoor
 * world is drawn from one pack (VISUAL_BIBLE.md §1).
 */

const ART = 'public/games/sigilfall/art';
const json = <T>(f: string): T => JSON.parse(readFileSync(`${ART}/${f}`, 'utf8')) as T;
const rk = json<{ props: Record<string, { r: number[]; o: number[]; fp?: number[] }>; anims: Record<string, unknown> }>('rk-props-summer.json');
const gc = json<{ props: Record<string, unknown> }>('props-gc.json').props;
const tiles = json<{ tiles: Record<string, number> }>('rk-tiles.json').tiles;

const has = (ref: string): boolean => (ref.startsWith('gc:') ? gc[ref.slice(3)] !== undefined : ref.startsWith('anim:') ? rk.anims[ref.slice(5)] !== undefined : rk.props[ref] !== undefined);
/** A ground set the pack has (or one made from it at load: sand, soil, ash and mud from its dirt). */
const hasSet = (set: string): boolean => {
  if (set === 'grass') return tiles.grass_0 !== undefined && tiles.grass_15 !== undefined;
  const from = DERIVED.find((d) => d.name === set)?.from ?? set;
  return tiles[`${from}_11111111`] !== undefined && tiles[`${from}_01100000`] !== undefined && tiles[`${from}_00000000`] !== undefined;
};

describe('Sigilfall packed art', () => {
  it('has a recipe for every outdoor land', () => {
    for (const [theme, look] of Object.entries(THEMES)) if (!look.indoor) expect(RECIPES[theme as Theme], theme).toBeDefined();
  });

  it('names only pieces, ground sets and decals that are in the atlases', () => {
    for (const [theme, r] of Object.entries(RECIPES)) {
      for (const ref of recipeRefs(r)) expect(has(ref), `${theme}: ${ref}`).toBe(true);
      const g = r.ground;
      for (const set of [g.base, g.under, g.path, g.sand, g.cobble, g.field, ...g.patches.map((p) => p.set)]) expect(hasSet(set), `${theme}: set ${set}`).toBe(true);
      for (const piece of ['h_l', 'h_m', 'h_r', 'v_t', 'v_m', 'v_b']) expect(tiles[`${g.bridge}_${piece}`], `${theme}: ${g.bridge}_${piece}`).toBeDefined();
      for (const d of g.decals) expect(tiles[d], `${theme}: decal ${d}`).toBeDefined();
    }
    for (const ref of sceneryRefs()) expect(has(ref), ref).toBe(true);
    // water ripples in four frames
    expect(tiles.water_11111111_f3).toBeDefined();
  });

  it('draws the outdoor world from one pack: Royal Keep, and Gloomvault only for the story pieces it lacks', () => {
    for (const [theme, r] of Object.entries(RECIPES)) for (const ref of recipeRefs(r)) expect(!ref.includes(':') || ref.startsWith('gc:') || ref.startsWith('anim:'), `${theme}: ${ref}`).toBe(true);
    for (const ref of sceneryRefs()) expect(!ref.includes(':') || ref.startsWith('gc:') || ref.startsWith('anim:'), ref).toBe(true);
  });

  it('measures every building as the pack ships it (what the simulation makes solid is what is drawn)', () => {
    for (const id of buildingPicIds()) {
      const p = rk.props[id];
      const pic = buildingPic(id)!;
      expect(p, id).toBeDefined();
      expect([pic.w * 2, pic.h * 2], `${id} size`).toEqual([p!.r[2], p!.r[3]]);
      expect([pic.ox * 2, pic.oy * 2], `${id} origin`).toEqual(p!.o);
      expect([pic.fpw * 2, pic.fpd * 2], `${id} footprint`).toEqual(p!.fp);
    }
  });
});
