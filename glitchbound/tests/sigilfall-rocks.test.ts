import { describe, expect, it } from 'vitest';
import { REGIONS } from '../src/games/sigilfall/data/regions';
import { setSkill } from '../src/games/sigilfall/progress/character';
import { tryCast } from '../src/games/sigilfall/sim/cast';
import { circleHitsWall, K, parseRegion, TILE } from '../src/games/sigilfall/sim/map';
import { emptyInput } from '../src/games/sigilfall/sim/world';
import { newWorld, readyHero } from './sigilfall-bot';

/**
 * A playtester's spells kept stopping on small stones (2026-10-27): a lone rock blocked a whole tile though it
 * is drawn a third of one wide. The open land's lone rocks are low enough to shoot over now; walls, trees,
 * pillars and boulder fields still stop shots, and every rock still stops feet.
 */

describe('Sigilfall: spells fly over lone rocks', () => {
  it('a rock blocks walking but not shots; walls and trees block both', () => {
    for (const id of ['whisperwood', 'ironpeak', 'saltmarsh']) {
      const m = parseRegion(REGIONS[id as keyof typeof REGIONS] as never);
      let rocks = 0;
      for (let i = 0; i < m.w * m.h; i++) {
        if (m.kind[i] === K.Rock) {
          rocks++;
          // (it stops feet where it stands, as wide as it is drawn: sim/map.ts `openWoods`)
          expect(circleHitsWall(m, ((i % m.w) + 0.5) * TILE, (Math.floor(i / m.w) + 0.5) * TILE, 4), id).toBe(true);
          expect(m.block[i], id).toBe(0);
        }
        // (the edge of a wood is walked and shot through, between its trunks; where it stands as wall it stops both)
        if ((m.kind[i] === K.Wall || m.kind[i] === K.Tree) && m.solid[i]) expect(m.block[i], id).toBe(1);
      }
      expect(rocks, id).toBeGreaterThan(0);
    }
  });

  it('a Fireball cast past a rock hits the enemy behind it', () => {
    const c = readyHero('mage', 12);
    expect(setSkill(c, 0, 'fireball')).toBe(true);
    const w = newWorld('whisperwood', c);
    w.enemies = [];
    // a pair of rocks in the open at tiles 59-60, row 37 (tests/sigilfall-rocks: the Whisperwood's meadow)
    expect([w.map.kind[37 * w.map.w + 59], w.map.kind[37 * w.map.w + 60]]).toEqual([K.Rock, K.Rock]);
    const y = 37.5 * TILE;
    w.player.x = 57.5 * TILE;
    w.player.y = y;
    const e = w.addEnemy('moss-slime', 62 * TILE, y, 12, { room: -1, pack: 0 });
    e.hp = e.maxHp = 1e6;
    e.state = 'chase';
    e.aggro = true;
    w.player.mana = w.player.maxMana;
    expect(tryCast(w, { slot: 's1', angle: 0, dist: null, assist: 0 })).toBeTruthy();
    for (let t = 0; t < 1.5 && e.hp === e.maxHp; t += 1 / 60) {
      w.input = emptyInput();
      e.x = 62 * TILE;
      e.y = y;
      w.step(1 / 60);
    }
    expect(e.hp).toBeLessThan(e.maxHp);
  });
});
