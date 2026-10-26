import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { THEMES } from '../src/games/sigilfall/data/themes';
import { RECIPES } from '../src/games/sigilfall/render/art/recipes';
import { sceneryRefs } from '../src/games/sigilfall/render/worldScenery';
import type { Theme } from '../src/games/sigilfall/data/types';

/**
 * The packed art and the tables that name pieces of it: every prop, ground set and overlay a land asks
 * for is in the atlases the build ships (public/games/sigilfall/art), so nothing silently falls back.
 */

const ART = 'public/games/sigilfall/art';
const json = <T>(f: string): T => JSON.parse(readFileSync(`${ART}/${f}`, 'utf8')) as T;
const props = (id: string): Record<string, unknown> => (id === 'rk' ? json<{ props: Record<string, unknown> }>('rk-props-summer.json').props : json<{ props: Record<string, unknown> }>(`props-${id}.json`).props);
const has = (ref: string): boolean => {
  const [atlas, name] = ref.split(':') as [string, string];
  return props(atlas)[name] !== undefined;
};

describe('Sigilfall packed art', () => {
  it('has a recipe for every outdoor land', () => {
    for (const [theme, look] of Object.entries(THEMES)) if (!look.indoor) expect(RECIPES[theme as Theme], theme).toBeDefined();
  });

  it('names only pieces, ground sets and overlays that are in the atlases', () => {
    const over = json<{ overlays: Record<string, unknown> }>('wb-ground.json').overlays;
    for (const [theme, r] of Object.entries(RECIPES)) {
      for (const ref of [...r.trees, ...r.bushes, ...r.rocks, ...r.flora, ...r.houses]) expect(has(ref), `${theme}: ${ref}`).toBe(true);
      const g = json<{ sets: Record<string, Record<string, number[]>>; fill: Record<string, number[]> }>(`${r.ground.set}.json`);
      expect(g.fill[r.ground.base]?.length, `${theme}: base ${r.ground.base}`).toBeGreaterThan(0);
      for (const set of [r.ground.path, r.ground.sand, r.ground.patches?.set].filter(Boolean)) expect(Object.keys(g.sets[set!] ?? {}).length, `${theme}: set ${set}`).toBeGreaterThan(4);
      for (const o of [r.ground.water, r.ground.cobble === 'rk' ? null : r.ground.cobble, r.ground.bridge, r.ground.field].filter(Boolean)) expect(over[o!], `${theme}: overlay ${o}`).toBeDefined();
    }
    for (const ref of sceneryRefs()) expect(has(ref), ref).toBe(true);
  });

  it('reads the CraftPix ground as a blob set: the inside ground covers most of its 47 cases', () => {
    for (const id of ['cp-summer', 'cp-swamp']) {
      const g = json<{ inside: string; sets: Record<string, Record<string, number[]>> }>(`${id}.json`);
      expect(Object.keys(g.sets[g.inside]!).length).toBeGreaterThanOrEqual(35);
      expect(g.sets[g.inside]!['11111111']!.length).toBeGreaterThan(0);
    }
  });
});
