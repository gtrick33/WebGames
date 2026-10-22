/**
 * Sigilfall's newer dungeons, played through by the bot (tests/sigilfall-bot.ts): every class clears
 * Gallows Keep and the Smugglers' Grotto at their level with the gear a player would have by then,
 * room by room and boss by boss, without getting stuck.
 */
import { describe, expect, it } from 'vitest';
import { CLASS_IDS } from '../src/games/sigilfall/data/classes';
import type { ClassId, RegionId } from '../src/games/sigilfall/data/types';
import { TILE } from '../src/games/sigilfall/sim/map';
import type { World } from '../src/games/sigilfall/sim/world';
import { newWorld, play, readyHero } from './sigilfall-bot';

/** The middle of the first room not fought yet (the bot's route through a dungeon). */
function nextRoom(w: World): { x: number; y: number } | null {
  const enc = w.encounters.find((e) => e.state === 'idle');
  if (!enc) return null;
  const tiles = (w.map.roomTiles[enc.index] ?? []).filter((i) => !w.map.solid[i]);
  const i = tiles[Math.floor(tiles.length / 2)];
  return i === undefined ? null : { x: ((i % w.map.w) + 0.5) * TILE, y: (Math.floor(i / w.map.w) + 0.5) * TILE };
}

function runDungeon(region: RegionId, cls: ClassId, level: number) {
  const w = newWorld(region, readyHero(cls, level, 'uncommon'));
  const r = play(w, { seconds: 1200, done: (x) => x.cleared, goal: nextRoom });
  return { w, r };
}

const DUNGEONS: { region: RegionId; level: number; bosses: string[] }[] = [
  { region: 'gallows-keep', level: 15, bosses: ['hangman', 'varric'] },
  { region: 'smugglers-grotto', level: 21, bosses: ['the-drowned', 'saltbeard'] },
];

describe('sigilfall dungeons', () => {
  for (const d of DUNGEONS) {
    for (const cls of CLASS_IDS) {
      it(`${cls}: clears ${d.region} at level ${d.level}`, { timeout: 30_000 }, () => {
        const { w, r } = runDungeon(d.region, cls, d.level);
        expect(r.stuck).toBe(false);
        expect(w.cleared).toBe(true);
        expect(r.bossesDown).toEqual(d.bosses);
        expect(r.deaths).toBeLessThanOrEqual(2);
        // the last boss is a real fight, not a few seconds of burst
        expect(r.bossTimes[d.bosses[1]!]).toBeGreaterThan(15);
      });
    }
  }
});
