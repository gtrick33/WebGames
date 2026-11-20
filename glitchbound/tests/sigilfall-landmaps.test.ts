/**
 * Every land a map file (the owner's call of 2026-11-19: every land hand-built, POLISH_PLAN.md). The live lands the
 * generator made were frozen to data/maps/<land>.json; each loads from its file, and nothing about it is generated as
 * it loads. Until a land is worked by hand (its file says so: `"hand": true`), its file is exactly what the generator
 * made of it. Once it is, the generator's rules for where a wandering pack may stand still hold on it.
 */
import { describe, expect, it } from 'vitest';
import { GROUND, paintError, PAINTABLE } from '../src/games/sigilfall/data/ground';
import { LAND_MAPS } from '../src/games/sigilfall/data/landmaps';
import { REGION_IDS, REGIONS } from '../src/games/sigilfall/data/regions';
import { generatedLand } from '../src/games/sigilfall/data/zonegen';
import { TERRAIN } from '../src/games/sigilfall/sim/map';

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

  it('keeps the generator’s rules for a wandering pack on a land worked by hand', () => {
    // (zonegen wildPacks: never in a sight, which keeps its own packs and stays empty once a quest clears it, as a
    // wandering pack would come back; nine tiles from a way out and from any other pack. And none at a town's doors.)
    const broken: string[] = [];
    for (const [id, file] of Object.entries(LAND_MAPS)) {
      if (!file.hand) continue;
      const houses: [number, number][] = [];
      file.map.forEach((row, y) => [...row].forEach((ch, x) => (ch === 'h' || ch === 'H') && houses.push([x, y])));
      for (const pm of file.placed) {
        if (pm.marker.kind !== 'pack' || !pm.marker.roam) continue;
        const at = `${id} (${pm.tx}, ${pm.ty})`;
        const d = (x: number, y: number): number => Math.hypot(pm.tx - x, pm.ty - y);
        for (const o of file.placed) {
          if (o.marker.kind === 'spot' && d(o.tx, o.ty) < o.marker.r + 3) broken.push(`${at} in ${o.marker.name}`);
          if (o.marker.kind === 'exit' && d(o.tx, o.ty) < 9) broken.push(`${at} by a way out`);
          if (o !== pm && o.marker.kind === 'pack' && d(o.tx, o.ty) < 9) broken.push(`${at} by the pack at (${o.tx}, ${o.ty})`);
        }
        if (houses.some(([x, y]) => d(x, y) <= 8)) broken.push(`${at} at a town's doors`);
      }
    }
    expect(broken).toEqual([]);
  });
});

describe('Sigilfall: the editor paints a land’s ground, never its buildings', () => {
  const land = ['#######', '#..h..#', '#.HhT.#', '#..j..#', '#######'];
  const paint = (x: number, y: number, ch: string): string[] => land.map((r, i) => (i === y ? r.slice(0, x) + ch + r.slice(x + 1) : r));

  it('paints only ground the land can stand on', () => {
    for (const g of GROUND) expect(TERRAIN[g.ch], g.name).toBeDefined();
    // (a building, a pillar or a door is the land's own)
    for (const ch of ['h', 'H', 'j', 'D', 'Q', 'Z', '%']) expect(PAINTABLE.includes(ch), ch).toBe(false);
  });

  it('takes grass into road, a tree into water, and nothing at all', () => {
    expect(paintError(land, paint(1, 1, '='))).toBeNull();
    expect(paintError(land, paint(4, 2, '~'))).toBeNull();
    expect(paintError(land, land)).toBeNull();
  });

  it('refuses a building, a pillar, an unknown letter and rows of another size', () => {
    expect(paintError(land, paint(3, 1, '.'))).toMatch(/h can't become \./);
    expect(paintError(land, paint(3, 3, '.'))).toMatch(/j can't become/);
    expect(paintError(land, paint(1, 1, 'X'))).toMatch(/can't become X/);
    expect(paintError(land, paint(1, 1, 'h'))).toMatch(/can't become h/);
    expect(paintError(land, land.slice(1))).toBe('rows of another size');
    expect(paintError(land, [...land.slice(0, -1), '######'])).toBe('rows of another size');
    expect(paintError(land, 'not rows')).toBe('rows of another size');
  });
});

