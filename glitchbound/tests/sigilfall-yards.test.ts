/**
 * What stands in a building's yard stands clear of the building (the owner, of Briarhollow: "the statue here ... is
 * inside the chapel, fix it or remove it completely"). A building's model stands with its own door on the door's
 * tile, so it can reach a tile past what its picture made solid: nothing is set down under it, and nothing tall (a
 * statue) under its eaves, where it stood head and horns in the roof.
 */
import { describe, expect, it } from 'vitest';
import { MODEL_FOOT, modelOnLot } from '../src/games/sigilfall/data/buildingArt';
import { PROPS } from '../src/games/sigilfall/data/props';
import { REGIONS } from '../src/games/sigilfall/data/regions';
import { isRetired } from '../src/games/sigilfall/data/retired';
import type { RegionId } from '../src/games/sigilfall/data/types';
import { K, parseRegion } from '../src/games/sigilfall/sim/map';

const LANDS = (Object.keys(REGIONS) as RegionId[]).filter((id) => !isRetired(id) && REGIONS[id].kind !== 'dungeon' && !REGIONS[id].interior);

describe('Sigilfall: a building’s yard', () => {
  it('has nothing under the building, and nothing tall under its eaves', () => {
    let yards = 0;
    let tall = 0;
    for (const id of LANDS) {
      const m = parseRegion(REGIONS[id]);
      for (const b of m.buildings) {
        if (!b.yard.length) continue;
        let x0 = Infinity;
        let x1 = -Infinity;
        let y0 = Infinity;
        let y1 = -Infinity;
        for (let y = b.lot.ty; y < b.lot.ty + b.lot.h; y++) {
          for (let x = b.lot.tx; x < b.lot.tx + b.lot.w; x++) {
            if (m.kind[y * m.w + x] !== K.House) continue;
            x0 = Math.min(x0, x);
            x1 = Math.max(x1, x + 1);
            y0 = Math.min(y0, y);
            y1 = Math.max(y1, y + 1);
          }
        }
        if (x1 < x0) continue;
        const stands = modelOnLot(b.style, b.lot, b.pics[0]?.grim === true, x0, x1, y0, y1, b.door?.[0] ?? null);
        const foot = stands ? MODEL_FOOT[stands.m] : undefined;
        if (!stands || !foot) continue;
        const within = (x: number, y: number, by: number): boolean => x + 1 > stands.x + foot[0] * stands.sx - by && x < stands.x + foot[2] * stands.sx + by && y + 1 > stands.z + foot[1] * stands.sz - by && y < stands.z + foot[3] * stands.sz + by;
        for (const y of b.yard) {
          yards++;
          const where = `${id}: ${y.prop} at ${y.tx},${y.ty} in the yard of ${b.name ?? b.style}`;
          expect(within(y.tx, y.ty, 0.1), `${where} is under it`).toBe(false);
          if ((PROPS[y.prop]?.h ?? 0) + (PROPS[y.prop]?.hero ?? 0) > 44) {
            tall++;
            expect(within(y.tx, y.ty, 0.7), `${where} is under its eaves`).toBe(false);
          }
        }
      }
    }
    expect(yards).toBeGreaterThan(50);
    // (some statues still stand: the ones with room to)
    expect(tall).toBeGreaterThan(2);
  });

  it('Briarhollow’s chapel has no statue at its wall', () => {
    const chapel = parseRegion(REGIONS.briarhollow).buildings.find((b) => b.name === 'Chapel of the Bell')!;
    expect(chapel).toBeDefined();
    expect(chapel.yard.map((y) => y.prop)).not.toContain('statue');
  });
});
