/** The Rift Trials from the level they open at: a young hero's clock is one they can beat, so the stones climb. */
import { describe, expect, it } from 'vitest';
import { keyPar, keyParFor, keyUpgrade, riftDungeons, TRIAL_EASE_TO } from '../src/games/sigilfall/data/keystones';
import { REGIONS } from '../src/games/sigilfall/data/regions';
import type { ClassId, RegionId } from '../src/games/sigilfall/data/types';
import { DEFAULT_SETTINGS } from '../src/games/sigilfall/progress/save';
import { RIFT_LEVEL, syncRift } from '../src/games/sigilfall/progress/wardrobe';
import { TILE } from '../src/games/sigilfall/sim/map';
import { World } from '../src/games/sigilfall/sim/world';
import { gearAt, play, readyHero } from './sigilfall-bot';

function nextRoom(w: World): { x: number; y: number } | null {
  const enc = w.encounters.find((e) => e.state === 'idle');
  if (!enc) return null;
  const tiles = (w.map.roomTiles[enc.index] ?? []).filter((i) => !w.map.solid[i]);
  const i = tiles[Math.floor(tiles.length / 2)];
  return i === undefined ? null : { x: ((i % w.map.w) + 0.5) * TILE, y: (Math.floor(i / w.map.w) + 0.5) * TILE };
}

function trial(cls: ClassId, level: number, region: RegionId): World {
  const hero = readyHero(cls, level, gearAt(level));
  expect(syncRift(hero)).toBe(true);
  hero.potions = 5;
  return new World({ region, tier: 2, mods: [], hero, settings: { ...DEFAULT_SETTINGS }, seed: 1, key: 1, affixes: [], handIns: false });
}

describe('Sigilfall: the Rift Trials from the level they open', () => {
  it('a young hero’s clock is longer, and eases to the measured one', () => {
    for (const r of riftDungeons(30)) {
      expect(keyParFor(r, 60), r.id).toBe(keyPar(r));
      expect(keyParFor(r, TRIAL_EASE_TO), r.id).toBe(keyPar(r));
      expect(keyParFor(r, RIFT_LEVEL) / keyPar(r), r.id).toBeGreaterThan(2.2);
      expect(keyParFor(r, RIFT_LEVEL) / keyPar(r), r.id).toBeLessThan(2.4);
      // (whole quarter-minutes, and never shorter for being younger)
      let last = Infinity;
      for (let level = RIFT_LEVEL; level <= 60; level += 5) {
        const par = keyParFor(r, level);
        expect(par % 15, `${r.id} ${level}`).toBe(0);
        expect(par, `${r.id} ${level}`).toBeLessThanOrEqual(last);
        last = par;
      }
    }
  });

  it('the run is timed by the hero’s own clock', () => {
    const w = trial('warrior', RIFT_LEVEL, 'crypt');
    expect(w.keyRun!.par).toBe(keyParFor(REGIONS.crypt, RIFT_LEVEL));
    expect(w.keyRun!.par).toBeGreaterThan(keyPar(REGIONS.crypt));
    // (the first stones a new holder can pick: the gentlest dungeons)
    expect(riftDungeons(1).map((r) => r.id)).toContain('crypt');
  });

  // The play-bot at the level the Rift opens, in the gear of that level: a quick class and the slowest one.
  for (const [cls, region] of [['warrior', 'crypt'], ['priest', 'crypt'], ['mage', 'gallows-keep']] as const) {
    it(`a level-${RIFT_LEVEL} ${cls} beats the clock on Riftstone +1 of ${region}, and the next stone opens`, { timeout: 120_000 }, () => {
      const w = trial(cls, RIFT_LEVEL, region);
      const r = play(w, { seconds: 1500, done: (x) => x.cleared, goal: nextRoom, maxDeaths: 6 });
      expect(r.stuck).toBe(false);
      expect(w.cleared).toBe(true);
      const end = w.keyRun!.end!;
      expect(end.up, `took ${Math.round(end.time)} s of ${w.keyRun!.par}`).toBeGreaterThan(0);
      expect(end.up).toBe(keyUpgrade(end.time, w.keyRun!.par));
      expect(w.hero.keystone).toBeGreaterThan(1);
      expect(end.marks).toBeGreaterThan(1);
      // (the Rift's cache came, at about the hero's own level)
      const loot = [...w.run.items, ...w.drops.flatMap((d) => (d.item ? [d.item] : []))];
      expect(loot.length).toBeGreaterThan(3);
      expect(Math.max(...loot.map((it) => it.il))).toBeLessThanOrEqual(RIFT_LEVEL + 6);
    });
  }
});
