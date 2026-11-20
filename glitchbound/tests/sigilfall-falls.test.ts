/**
 * Each kind of foe goes down its own way (POLISH_PLAN.md piece 6): bones fly apart, a shade rises and thins away, a
 * slime bursts, a shell cracks, a great one lands in dust. Before, every foe fell the same and faded.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../src/games/sigilfall/data/enemies';
import { fallOf } from '../src/games/sigilfall/data/falls';
import { killEnemy } from '../src/games/sigilfall/sim/combat';
import type { World } from '../src/games/sigilfall/sim/world';
import { newWorld, readyHero } from './sigilfall-bot';

function arena(): World {
  const w = newWorld('whisperwood', readyHero('warrior', 12));
  w.enemies = [];
  w.fx = [];
  return w;
}

describe('Sigilfall: how a foe goes down', () => {
  it('every foe has a way to fall, and the kinds are told apart', () => {
    for (const def of Object.values(ENEMIES)) expect(['bone', 'ghost', 'slime', 'bug', 'heavy', 'beast', 'person'], def.id).toContain(fallOf(def));
    expect(fallOf({ id: 'skeleton', sprite: 'skeleton' })).toBe('bone');
    expect(fallOf({ id: 'moss-slime', sprite: 'slime' })).toBe('slime');
    expect(fallOf({ id: 'grave-wraith', sprite: 'ghost' })).toBe('ghost');
    expect(fallOf({ id: 'stone-golem', sprite: 'golem' })).toBe('heavy');
    expect(fallOf({ id: 'bandit', sprite: 'bandit' })).toBe('person');
  });

  it('leaves what its kind leaves', () => {
    const cases: [string, (w: World) => boolean][] = [
      ['skeleton', (w) => w.fx.filter((f) => f.kind === 'shard').length >= 6],
      ['moss-slime', (w) => w.fx.some((f) => f.kind === 'burst' && f.color === '#8be36b')],
    ];
    for (const [id, saw] of cases) {
      if (!ENEMIES[id]) continue;
      const w = arena();
      const e = w.addEnemy(id, w.player.x + 30, w.player.y, 12, { room: -1, pack: -1 });
      killEnemy(w, e, 'physical', 0, null);
      expect(saw(w), id).toBe(true);
    }
    // a great one shakes the ground as it lands
    const heavy = Object.values(ENEMIES).find((d) => fallOf(d) === 'heavy' && !d.prop);
    if (heavy) {
      const w = arena();
      w.shakeAmt = 0;
      const e = w.addEnemy(heavy.id, w.player.x + 30, w.player.y, 12, { room: -1, pack: -1 });
      killEnemy(w, e, 'physical', 0, null);
      expect(w.fx.some((f) => f.kind === 'smoke')).toBe(true);
      expect(w.shakeAmt).toBeGreaterThan(0);
    }
  });

  it('is drawn until its fall is over, after the rules have let go of it (they keep a dead foe 0.6 s)', () => {
    // (the renderer can't be made without a page: held by its text, and seen in the browser)
    const src = readFileSync('src/games/sigilfall/render3d/worldCast.ts', 'utf8');
    expect(src).toContain('const FALL_KEPT = 1.8;');
    expect(src).toContain('if (e.dead && !e.dummy && !this.fallen.has(e.id)) this.fallen.set(e.id, { e, at: time, from: e.deathT });');
    expect(src).toContain('f.e.deathT = f.from + (time - f.at);');
    const world = readFileSync('src/games/sigilfall/sim/world.ts', 'utf8');
    expect(world).toContain('this.enemies = this.enemies.filter((e) => !e.dead || e.deathT < 0.6);');
  });
});
