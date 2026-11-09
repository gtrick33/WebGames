/**
 * The Molten Throne (levels 53-54), the second: under Emberdeep, past the Magma Warden to Ashkar the Bound, chained to his throne and forging the Pale Crown,
 * played through by the bot (tests/sigilfall-bot.ts): every class clears it a level above its own with the
 * gear a player would have by then, room by room, both bosses in order, without getting stuck, and the last
 * boss is a real fight. Its bosses' attacks all exist and its rooms are registered.
 */
import { describe, expect, it } from 'vitest';
import { BOSSES } from '../src/games/sigilfall/data/bosses';
import { CLASS_IDS } from '../src/games/sigilfall/data/classes';
import { REGIONS } from '../src/games/sigilfall/data/regions';
import type { ClassId } from '../src/games/sigilfall/data/types';
import { TILE } from '../src/games/sigilfall/sim/map';
import { EXTRA_PATTERNS } from '../src/games/sigilfall/sim/patterns';
import type { World } from '../src/games/sigilfall/sim/world';
import { newWorld, play, readyHero, clearsWithRetry } from './sigilfall-bot';
import { gearAt, HARD_DEATHS } from './sigilfall-bot';

const REGION = 'molten-throne';
const LEVEL = REGIONS[REGION].level + 1;
const BOSS_ORDER = ['magma-warden', 'ashkar-the-bound'];

/** The middle of the first room not fought yet (the bot's route through a dungeon). */
function nextRoom(w: World): { x: number; y: number } | null {
  const enc = w.encounters.find((e) => e.state === 'idle');
  if (!enc) return null;
  const tiles = (w.map.roomTiles[enc.index] ?? []).filter((i) => !w.map.solid[i]);
  const i = tiles[Math.floor(tiles.length / 2)];
  return i === undefined ? null : { x: ((i % w.map.w) + 0.5) * TILE, y: (Math.floor(i / w.map.w) + 0.5) * TILE };
}

describe('sigilfall: the Molten Throne', () => {
  it('has its two bosses in order, each in phases, and every attack they use exists', () => {
    const bosses = REGIONS[REGION].encounters.filter((e) => e.boss).map((e) => e.boss);
    expect(bosses).toEqual(BOSS_ORDER);
    for (const id of BOSS_ORDER) {
      expect(BOSSES[id]!.phases.length, id).toBeGreaterThanOrEqual(2);
      for (const ph of BOSSES[id]!.phases) for (const u of [...ph.patterns, ...(ph.enter ?? [])]) if (u.id.includes(':')) expect(EXTRA_PATTERNS[u.id], u.id).toBeTruthy();
    }
  });

  for (const cls of CLASS_IDS) {
    it(`${cls}: clears the Molten Throne at level ${LEVEL}`, { timeout: 180_000 }, () => {
      const { w, r } = clearsWithRetry((seed) => {
        const w = newWorld(REGION, readyHero(cls as ClassId, LEVEL, gearAt(LEVEL)), seed);
        return { w, r: play(w, { seconds: 1200, done: (x) => x.cleared, goal: nextRoom }) };
      });
      expect(r.stuck).toBe(false);
      expect(w.cleared).toBe(true);
      expect(r.bossesDown).toEqual(BOSS_ORDER);
      expect(r.deaths).toBeLessThanOrEqual(HARD_DEATHS);
      // Ashkar is a real fight, not a few seconds of burst
      expect(r.bossTimes['ashkar-the-bound']).toBeGreaterThan(30);
    });
  }
});
