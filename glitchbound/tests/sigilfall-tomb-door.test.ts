/**
 * The way into the Tomb of the Sun King, after the owner's note of 2026-11-15: "check the entrance of the tomb of the
 * sun king dungeon (pic uploaded), this needs to be fixed, check other gates if they have such discrepancies". The
 * pack's arch with its gate stood buried in the face of the colossus's plinth, which stood a tile out over the door:
 * the arch showed high up the wall and the gate as bars at the foot of solid stone. Now the door is one built pylon.
 */
import { describe, expect, it } from 'vitest';
import { GREAT, GREAT_IN } from '../src/games/sigilfall/data/greatworks';
import { THEMES } from '../src/games/sigilfall/data/themes';
import { REGIONS } from '../src/games/sigilfall/data/regions';
import { parseRegion } from '../src/games/sigilfall/sim/map';
import { DOORWAYS, PYLON } from '../src/games/sigilfall/render3d/doorways';
import { Land3D } from '../src/games/sigilfall/render3d/land';
import { readPack } from './sigilfall-packs';

const door = DOORWAYS['tomb-of-the-sun-king']!;

describe('Sigilfall: the Tomb of the Sun King’s door', () => {
  it('is one doorway: the dark of its opening at the ground, the arch round it, the gate in it', () => {
    const { pos, col, idx } = door.build(Object.values(THEMES)[0]!).m;
    const verts = (t: number): number[][] => [0, 1, 2].map((k) => [pos[idx[t + k]! * 3]!, pos[idx[t + k]! * 3 + 1]!, pos[idx[t + k]! * 3 + 2]!]);
    let darkFoot = Infinity;
    let darkTop = -Infinity;
    let bars = 0;
    for (let t = 0; t < idx.length; t += 3) {
      const v = verts(t);
      const c = [col[idx[t]! * 3]!, col[idx[t]! * 3 + 1]!, col[idx[t]! * 3 + 2]!];
      // (the dark: near black, standing in the plane between the pylon's face and the plinth's)
      if (c[0]! < 0.13 && v.every((p) => Math.abs(p[2]! - PYLON.dark) < 1e-6)) {
        for (const p of v) {
          darkFoot = Math.min(darkFoot, p[1]!);
          darkTop = Math.max(darkTop, p[1]!);
          expect(Math.abs(p[0]!)).toBeLessThanOrEqual(PYLON.half + 1e-6);
        }
      }
      // (the portcullis's iron: inside the opening, behind the face, under the arch)
      if (Math.abs(c[0]! - 0.17) < 1e-3 && Math.abs(c[2]! - 0.16) < 1e-3) {
        bars++;
        for (const p of v) {
          expect(Math.abs(p[0]!)).toBeLessThan(PYLON.half);
          expect(p[2]!).toBeGreaterThan(PYLON.dark);
          expect(p[2]!).toBeLessThan(PYLON.front);
          const up = Math.max(0, p[1]! - PYLON.spring);
          expect(up * up + p[0]! * p[0]!).toBeLessThan(PYLON.half * PYLON.half + 1e-6);
        }
      }
    }
    // (the opening goes down to the ground, and up into the arch)
    expect(darkFoot).toBe(0);
    expect(darkTop).toBeGreaterThan(PYLON.spring);
    expect(bars).toBeGreaterThan(20);
    // (a doorway a hero walks into, not a hatch, and the pylon over it taller than the plinth behind it)
    expect(PYLON.half * 2).toBeGreaterThanOrEqual(2);
    expect(PYLON.spring + PYLON.half).toBeGreaterThan(2.5);
  });

  it('the colossus’s plinth stands behind the door, its face where its solid ground ends', () => {
    const at = GREAT_IN.sunscorch!.find((g) => g.id === 'sun-king-colossus')!;
    const work = GREAT['sun-king-colossus']!;
    const plinth = work.parts.find((p) => p.box && p.box[0] > 10)!;
    // (tiles from the door tile's middle: the work's middle is `dy` rows north of the door)
    const face = at.dy! + plinth.z + plinth.box![2] / 2;
    const solidEnd = at.dy! + Math.max(...work.solid.filter(([x0, , x1]) => x0 <= 0 && x1 >= 0).map(([, , , y1]) => y1)) + 0.5;
    expect(face).toBeCloseTo(-0.5);
    expect(face).toBeCloseTo(solidEnd);
    // (the pylon's face and the dark of its door both in front of it, the dark not in its plane)
    expect(PYLON.front).toBeGreaterThan(PYLON.dark);
    expect(PYLON.dark - face).toBeGreaterThan(0.02);
  });

  it('the land builds it at the door, and the pack’s arch is no longer stood there', { timeout: 60_000 }, () => {
    const packs = { nature: readPack('nature'), town: readPack('town'), indoor: readPack('indoor'), hero: readPack('hero') };
    const region = REGIONS.sunscorch;
    const map = parseRegion(region);
    const land = new Land3D(map, region, packs, () => true);
    const way = land.ways.get('tomb-of-the-sun-king');
    expect(way).toBeTruthy();
    land.update(way!.x, way!.z + 3, 12, 8);
    const stands = (land as unknown as { stands: Map<string, { mesh: { count: number } }> }).stands;
    expect(stands.get('arch_gate')?.mesh.count ?? 0).toBe(0);
  });
});
