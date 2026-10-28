import type { Theme } from '../../data/types';
import { forgetArt, propAtlas, propAtlasKey, worldArt, worldArtKey, type LookKey, type PropAtlas, type WorldArt } from './atlas';
import { DERIVED, RECIPES, type Recipe } from './recipes';

/**
 * Everything an outdoor land draws, loaded: its recipe, and Royal Keep's smoothed build in the land's season
 * and grade (ground tiles, the derived sets, every prop), plus the few story pieces the pack lacks (`gc`).
 * Null while any piece is still loading (the procedural art stands in), or for a land without a recipe.
 */
export interface WorldLook {
  recipe: Recipe;
  rk: WorldArt;
  /** Gloomvault's story pieces (skulls, bones, cages, crystals), graded like the land. */
  gc: PropAtlas | null;
}

const looks = new Map<Theme, WorldLook>();
/** How many lands' art stays loaded (each is two large atlases, graded): the one here and the last ones left. */
const KEEP = 3;

const lookKey = (recipe: Recipe): LookKey => {
  const g = recipe.ground;
  const used = new Set([g.base, g.under, g.path, g.sand, g.cobble, g.field, ...g.patches.map((p) => p.set)]);
  return { season: recipe.season, grade: recipe.grade, ...(recipe.water ? { water: recipe.water } : {}), derived: DERIVED.filter((d) => used.has(d.name)), hd: true };
};

let latest: Theme | null = null;

export function worldLook(theme: Theme): WorldLook | null {
  const hit = looks.get(theme);
  if (hit) {
    // the land here is the last one left behind
    if (latest !== theme) {
      looks.delete(theme);
      looks.set(theme, hit);
      latest = theme;
    }
    return hit;
  }
  const recipe = RECIPES[theme];
  if (!recipe) return null;
  const rk = worldArt(lookKey(recipe));
  const gc = propAtlas('gc', recipe.grade);
  if (!rk || !gc) return null;
  const look: WorldLook = { recipe, rk, gc };
  looks.set(theme, look);
  latest = theme;
  // the land longest left behind lets its art go (it loads again if the hero comes back)
  while (looks.size > KEEP) {
    const [old, l] = looks.entries().next().value!;
    looks.delete(old);
    if (![...looks.values()].some((o) => JSON.stringify(lookKey(o.recipe)) === JSON.stringify(lookKey(l.recipe)))) forgetArt(worldArtKey(lookKey(l.recipe)));
    if (![...looks.values()].some((o) => JSON.stringify(o.recipe.grade) === JSON.stringify(l.recipe.grade))) forgetArt(propAtlasKey('gc', l.recipe.grade));
  }
  return look;
}
