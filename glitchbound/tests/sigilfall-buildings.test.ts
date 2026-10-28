import { describe, expect, it } from 'vitest';
import { buildingPic, picBody } from '../src/games/sigilfall/data/buildingArt';
import { REGIONS } from '../src/games/sigilfall/data/regions';
import type { RegionId } from '../src/games/sigilfall/data/types';
import { newCharacter } from '../src/games/sigilfall/progress/character';
import { DEFAULT_SETTINGS } from '../src/games/sigilfall/progress/save';
import { K, parseRegion, TILE } from '../src/games/sigilfall/sim/map';
import { emptyInput, World } from '../src/games/sigilfall/sim/world';

/**
 * Buildings stand where they are drawn (data/buildingArt.ts, sim/map.ts): the walls you see stop you, nothing
 * you can't see does, and a way in is right under its painted door. Indoors is peaceful.
 */

describe('Sigilfall buildings', () => {
  it('are solid where their walls are drawn, and each way in is under its painted door', () => {
    let doors = 0;
    for (const id of Object.keys(REGIONS) as RegionId[]) {
      const m = parseRegion(REGIONS[id]);
      for (const b of m.buildings) {
        const what = `${id}: ${b.name ?? b.style} at ${b.lot.tx},${b.lot.ty}`;
        for (const p of b.pics) {
          const [x0, , x1, y1] = picBody(p);
          // the front of the walls, across their middle
          const ty = Math.floor((y1 - 1) / TILE);
          const tx = Math.floor((x0 + x1) / 2 / TILE);
          expect(m.solid[ty * m.w + tx], what).toBe(1);
        }
        if (!b.door) continue;
        doors++;
        const [dx, dy] = b.door;
        const pic = b.pics[0]!;
        const art = buildingPic(pic.id)!;
        expect(art.door, what).toBeDefined();
        // the painted door's middle within a pixel of the step's, the step open, the wall right behind it
        expect(Math.abs(pic.x + art.door! - (dx + 0.5) * TILE), what).toBeLessThanOrEqual(1);
        expect(m.solid[dy * m.w + dx], what).toBe(0);
        expect(m.solid[(dy - 1) * m.w + dx], what).toBe(1);
      }
    }
    // the inn, the chapel and the Elder's hall in Briarhollow; the inn, the Great Hall and the forge in the capital
    expect(doors).toBeGreaterThanOrEqual(6);
  });

  it('leave nothing solid on their lots that no picture covers', () => {
    for (const id of Object.keys(REGIONS) as RegionId[]) {
      const m = parseRegion(REGIONS[id]);
      for (const b of m.buildings) {
        const bodies = b.pics.map(picBody);
        const yard = new Set(b.yard.map((y) => y.ty * m.w + y.tx));
        for (let ty = b.lot.ty; ty < b.lot.ty + b.lot.h; ty++) {
          for (let tx = b.lot.tx; tx < b.lot.tx + b.lot.w; tx++) {
            const i = ty * m.w + tx;
            if (m.kind[i] !== K.House) continue;
            const covered = bodies.some(([x0, y0, x1, y1]) => Math.min(x1, (tx + 1) * TILE) - Math.max(x0, tx * TILE) >= 4 && Math.min(y1, (ty + 1) * TILE) - Math.max(y0, ty * TILE) >= 6);
            expect(covered || yard.has(i), `${id}: ${b.name ?? b.style} tile ${tx},${ty}`).toBe(true);
          }
        }
      }
    }
  });

  it('keep the peace indoors: no spells or blows in an inn', () => {
    const swing = (region: RegionId): boolean => {
      const w = new World({ region, tier: 0, mods: [], hero: newCharacter('mage', 'Test', 'hero0', 0), settings: { ...DEFAULT_SETTINGS }, seed: 1 });
      const before = w.player.cds.basic.charges;
      const f = emptyInput();
      f.casts = [{ slot: 'basic', angle: 0, dist: null, assist: 0 }];
      w.input = f;
      w.step(1 / 60);
      w.input = emptyInput();
      for (let i = 0; i < 20; i++) w.step(1 / 60);
      return w.player.cds.basic.charges < before || w.projectiles.length > 0;
    };
    expect(swing('briarhollow')).toBe(true);
    expect(swing('bramble-and-barrel')).toBe(false);
  });
});
