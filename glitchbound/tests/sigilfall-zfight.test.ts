import { describe, expect, it } from 'vitest';
import { DOORWAYS } from '../src/games/sigilfall/render3d/doorways';
import { stoneGate, timberGate } from '../src/games/sigilfall/render3d/gateways';
import { THEMES } from '../src/games/sigilfall/data/themes';
import { REGIONS } from '../src/games/sigilfall/data/regions';
import { parseRegion } from '../src/games/sigilfall/sim/map';
import { CLAD_SHY, Land3D } from '../src/games/sigilfall/render3d/land';
import { readPack } from './sigilfall-packs';
import { fights, placedFights, type Fight } from './sigilfall-zfight';

const LOOKS = Object.values(THEMES);

const sum = (f: Fight[]): string => [...new Set(f.map((x) => `${x.plane} near ${x.at.join(',')}`))].slice(0, 8).join(' | ');

describe('Sigilfall: nothing built flickers', () => {
  const found: Record<string, string> = {};
  const check = (name: string, m: { pos: number[]; nor: number[]; idx: number[]; col: number[] }): void => {
    const f = fights(m);
    if (f.length) found[name] = `${f.length}: ${sum(f)}`;
  };

  it('no gate has two faces fighting over one place', () => {
    for (const span of [3, 4, 5, 7]) {
      for (const ends of [undefined, true, 'east', 'west'] as const) {
        for (const shut of [false, true]) {
          check(`stone ${span} ${ends} ${shut}`, stoneGate({ span, body: '#a69e94', trim: '#d8c8a0', light: '#7fe06a', seed: 5, ...(ends ? { ends } : {}), shut }).b.m);
        }
      }
      check(`timber ${span}`, timberGate({ span, body: '#6a4a2a', trim: '#c8a878', light: '#7fe06a', seed: 5 }).b.m);
    }
    expect(found).toEqual({});
  });

  it('no way down (a cave mouth, a stair, a culvert, a barrow) has either', () => {
    const bad: Record<string, string> = {};
    for (const [id, d] of Object.entries(DOORWAYS)) {
      const f = fights(d.build(LOOKS[0]!).m);
      if (f.length) bad[id] = `${f.length}: ${sum(f)}`;
    }
    expect(bad).toEqual({});
  });

  // the Tomb of the Sun King, all steps and corners (the owner: "some of the walls (mostly the edges) in this particular
  // dungeon flicker and jitter, fix them, check every other dungeon as well"): a run of the facing pieces ended in the
  // plane of the side the wall's own block shows at a corner, and the two flickered through each other down its edge
  it('a built place’s walls: no facing piece ends in the plane of the wall’s own side', { timeout: 60_000 }, () => {
    expect(CLAD_SHY).toBeGreaterThan(0.005);
    const packs = { nature: readPack('nature'), town: readPack('town'), indoor: readPack('indoor'), hero: readPack('hero') };
    const bad: Record<string, string> = {};
    for (const id of ['tomb-of-the-sun-king', 'crypt', 'siege-of-highwall', 'rotmother-cistern', 'duskspire', 'spire-of-the-rift']) {
      const region = REGIONS[id as keyof typeof REGIONS]!;
      const map = parseRegion(region);
      const land = new Land3D(map, region, packs, () => true);
      land.update(map.w / 2, map.h / 2, map.w, map.h);
      // (the walls and their facing, inside the map: a piece's end over a wall's side fought over half a square tile)
      const f = placedFights(land.group, (x, z) => x > 0 && z > 0 && x < map.w && z < map.h, 0.05).filter((x) => x.at[1] > 0.15);
      if (f.length) bad[id] = `${f.length}: ${sum(f)}`;
    }
    expect(bad).toEqual({});
  });
});
