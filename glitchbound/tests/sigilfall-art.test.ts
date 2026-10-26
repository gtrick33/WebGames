import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { THEMES } from '../src/games/sigilfall/data/themes';
import { NPCS } from '../src/games/sigilfall/data/quests';
import { BIOMES, INTERIORS } from '../src/games/sigilfall/render/art/biomes';
import { FOE_FOLK, folkFor } from '../src/games/sigilfall/render/art/folk';
import { thinWall } from '../src/games/sigilfall/render/tileGround';
import { K, type TileMap } from '../src/games/sigilfall/sim/map';
import type { Theme } from '../src/games/sigilfall/data/types';

/**
 * The packed art and the tables that name pieces of it: every prop, tile and figure a land or a
 * person asks for is in the atlases the build ships (public/games/sigilfall/art), so nothing silently
 * falls back to a blank.
 */

const ART = 'public/games/sigilfall/art';
const json = <T>(f: string): T => JSON.parse(readFileSync(`${ART}/${f}`, 'utf8')) as T;
const tiles = json<{ tiles: Record<string, number> }>('rk-tiles.json').tiles;
const props = json<{ props: Record<string, unknown>; anims: Record<string, unknown> }>('rk-props-summer.json');
const folk = json<{ rows: string[] }>('rk-folk.json');
const interior = json<{ rects: Record<string, unknown> }>('interior.json');

describe('Sigilfall packed art', () => {
  it('has a look for every outdoor land and every indoor one', () => {
    for (const [theme, look] of Object.entries(THEMES)) {
      if (look.indoor) expect(INTERIORS[theme as Theme], theme).toBeDefined();
      else expect(BIOMES[theme as Theme], theme).toBeDefined();
    }
  });

  it('names only props and tiles that are in the atlases', () => {
    const derived = new Set(['sand', 'ash', 'mud']);
    for (const [theme, b] of Object.entries(BIOMES)) {
      for (const p of [...b.trees, ...b.bushes, ...b.rocks, ...b.flora]) expect(props.props[p], `${theme}: ${p}`).toBeDefined();
      for (const d of b.decals) expect(tiles[d], `${theme}: ${d}`).toBeDefined();
      if (b.patches) expect(derived.has(b.patches.set) || tiles[`${b.patches.set}_11111111`] !== undefined, `${theme}: ${b.patches.set}`).toBe(true);
      for (const dv of b.look.derived ?? []) expect(tiles[`${dv.from}_11111111`], `${theme}: ${dv.from}`).toBeDefined();
    }
    for (const [theme, it] of Object.entries(INTERIORS)) for (const p of [...it.floor, it.wall, ...it.dressing]) expect(interior.rects[p], `${theme}: ${p}`).toBeDefined();
    for (const a of ['campfire', 'brazier', 'smoke']) expect(props.anims[a], a).toBeDefined();
  });

  it('dresses every person and folk-drawn foe as a figure the sheet has', () => {
    for (const [id, npc] of Object.entries(NPCS)) expect(folk.rows, id).toContain(folkFor(npc, id));
    for (const who of Object.values(FOE_FOLK)) expect(folk.rows).toContain(who);
    // roles read from titles
    expect(folkFor({ ...Object.values(NPCS)[0]!, title: 'Smith' }, 'x')).toBe('blacksmith');
    expect(folkFor({ ...Object.values(NPCS)[0]!, title: 'Innkeeper' }, 'x')).toBe('innkeeper');
  });

  it('draws a rock spine one tile thick as boulders, a thick cliff as a cliff', () => {
    const rows = ['.....', '.###.', '.###.', '..#..', '.....'];
    const map = { w: 5, h: 5, kind: Uint8Array.from(rows.join('').split('').map((c) => (c === '#' ? K.Wall : K.Floor))) } as unknown as TileMap;
    expect(thinWall(map, 1, 1)).toBe(false);
    expect(thinWall(map, 2, 3)).toBe(true);
  });
});
