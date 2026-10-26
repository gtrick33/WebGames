import type { Theme } from '../../data/types';
import { groundSet, overlays, propAtlas, worldArt, type GroundSet, type Overlays, type PropAtlas, type Season, type WorldArt } from './atlas';
import { atlasesOf, RECIPES, type Recipe } from './recipes';

/**
 * Everything an outdoor land draws, loaded: its recipe, the CraftPix ground set, the overlays, the prop
 * atlases it names, and Royal Keep's smoothed build for its architecture (in the land's season and grade).
 * Null while any piece is still loading (the procedural art stands in), or for a land without a recipe.
 */
export interface WorldLook {
  recipe: Recipe;
  ground: GroundSet;
  over: Overlays;
  props: Record<string, PropAtlas>;
  rk: WorldArt | null;
}

const SEASON: Partial<Record<Theme, Season>> = {
  snow: 'winter',
  peaks: 'winter',
  pale: 'winter',
  haunted: 'winter',
  deadlake: 'winter',
  autumn: 'autumn',
  barrow: 'autumn',
  moor: 'autumn',
  plague: 'autumn',
  warfront: 'autumn',
  rift: 'autumn',
  blight: 'autumn',
  bonefield: 'autumn',
  volcanic: 'autumn',
};

const looks = new Map<Theme, WorldLook>();

export function worldLook(theme: Theme): WorldLook | null {
  const hit = looks.get(theme);
  if (hit) return hit;
  const recipe = RECIPES[theme];
  if (!recipe) return null;
  const ground = groundSet(recipe.ground.set, recipe.grade);
  const over = overlays(recipe.grade, recipe.water);
  const rk = worldArt({ season: SEASON[theme] ?? 'summer', grade: recipe.grade, hd: true });
  const props: Record<string, PropAtlas> = {};
  let ready = !!ground && !!over && !!rk;
  for (const id of atlasesOf(recipe)) {
    const a = propAtlas(id, recipe.grade);
    if (a) props[id] = a;
    else ready = false;
  }
  if (!ready || !ground || !over) return null;
  const look: WorldLook = { recipe, ground, over, props, rk };
  looks.set(theme, look);
  return look;
}
