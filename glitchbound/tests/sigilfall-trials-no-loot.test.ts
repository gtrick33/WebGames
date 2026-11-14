/**
 * A Rift Trial drops no gear (the owner: "make it so the insta riftstone mode doesnt drop items"): its ready hero is
 * thrown away at the end of the run, so whatever it found was thrown away with it. A story hero's Riftstone run drops
 * as it always has.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { trialHero } from '../src/games/sigilfall/progress/trial';
import { rollGear } from '../src/games/sigilfall/progress/items';
import { DEFAULT_SETTINGS } from '../src/games/sigilfall/progress/save';
import { World } from '../src/games/sigilfall/sim/world';
import { rng } from '../src/games/sigilfall/core/math';

function run(noLoot: boolean): World {
  const hero = trialHero('warrior', 0, 3);
  return new World({ region: 'barrow-of-kings', tier: 2, mods: [], hero, settings: { ...DEFAULT_SETTINGS }, seed: 7, key: 3, affixes: [], handIns: false, noLoot });
}

describe('Sigilfall: a Rift Trial drops no gear', () => {
  it('nothing a Trial would drop reaches the ground; a story run drops it', () => {
    const item = rollGear('warrior', 60, 'epic', rng(3));
    const t = run(true);
    t.dropItem(t.player.x, t.player.y, item);
    expect(t.drops.filter((d) => d.kind === 'item')).toHaveLength(0);
    const s = run(false);
    s.dropItem(s.player.x, s.player.y, item);
    expect(s.drops.filter((d) => d.kind === 'item')).toHaveLength(1);
  });

  it('the engine makes every Trial world one that drops nothing', () => {
    const engine = readFileSync('src/games/sigilfall/engine.ts', 'utf8');
    expect(engine).toContain('...(this.trial ? { noLoot: true } : {}),');
  });
});
