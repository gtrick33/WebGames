/**
 * Every land a map file (the owner's call of 2026-11-19: every land hand-built, POLISH_PLAN.md). The live lands the
 * generator made were frozen to data/maps/<land>.json; each loads from its file, and nothing about it is generated as
 * it loads. Until a land is worked by hand (its file says so: `"hand": true`), its file is exactly what the generator
 * made of it.
 */
import { describe, expect, it } from 'vitest';
import { LAND_MAPS } from '../src/games/sigilfall/data/landmaps';
import { REGION_IDS, REGIONS } from '../src/games/sigilfall/data/regions';
import { generatedLand } from '../src/games/sigilfall/data/zonegen';

describe('Sigilfall: every land is a map file', () => {
  it('has a file for every live land the generator made, and for nothing else', () => {
    const made = REGION_IDS.filter((id) => generatedLand(id) !== null);
    expect(Object.keys(LAND_MAPS).sort()).toEqual([...made].sort());
  });

  it('loads each of those lands from its file', () => {
    for (const [id, file] of Object.entries(LAND_MAPS)) {
      const def = REGIONS[id as keyof typeof REGIONS];
      expect(def.map, id).toBe(file.map);
      expect(def.placed, id).toBe(file.placed);
    }
  });

  it('keeps each file whole: rows of one width, everything placed on the land', () => {
    for (const [id, file] of Object.entries(LAND_MAPS)) {
      const w = file.map[0]!.length;
      expect(file.map.length, id).toBeGreaterThan(20);
      for (const [y, row] of file.map.entries()) expect(row.length, `${id} row ${y}`).toBe(w);
      for (const pm of file.placed) {
        expect(pm.tx >= 0 && pm.tx < w && pm.ty >= 0 && pm.ty < file.map.length, `${id}: ${JSON.stringify(pm)}`).toBe(true);
        expect(typeof pm.marker.kind, id).toBe('string');
      }
    }
  });

  it('froze each land not yet worked by hand exactly as the generator made it', () => {
    const asMade = Object.entries(LAND_MAPS).filter(([, file]) => !file.hand);
    for (const [id, file] of asMade) {
      const made = generatedLand(id)!;
      expect(file.map, id).toEqual(made.map);
      expect(file.placed, id).toEqual(made.placed);
    }
  });
});
