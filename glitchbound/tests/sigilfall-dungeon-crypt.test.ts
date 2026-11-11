/**
 * The Chapel Crypt (levels 4-6), the first dungeon: three bosses, each teaching one thing (sim/patterns/crypt.ts).
 * The Coffin Matron's shell game (strike the coffin she lies in), Warden Ossric's grave-candles (snuff them to break
 * his ward) and Morgrave's soul-split (break every shard before his spell ends). Every class clears it with the bot.
 */
import { describe, expect, it } from 'vitest';
import type { PatternUse } from '../src/games/sigilfall/data/bosses';
import { CLASS_IDS } from '../src/games/sigilfall/data/classes';
import type { ClassId } from '../src/games/sigilfall/data/types';
import { hitEnemy } from '../src/games/sigilfall/sim/combat';
import { TILE } from '../src/games/sigilfall/sim/map';
import type { Enemy } from '../src/games/sigilfall/sim/types';
import type { World } from '../src/games/sigilfall/sim/world';
import { clearsWithRetry, gearAt, HARD_DEATHS, newWorld, play, readyHero } from './sigilfall-bot';

const LEVEL = 6;

function nextRoom(w: World): { x: number; y: number } | null {
  const enc = w.encounters.find((e) => e.state === 'idle');
  if (!enc) return null;
  const tiles = (w.map.roomTiles[enc.index] ?? []).filter((i) => !w.map.solid[i]);
  const i = tiles[Math.floor(tiles.length / 2)];
  return i === undefined ? null : { x: ((i % w.map.w) + 0.5) * TILE, y: (Math.floor(i / w.map.w) + 0.5) * TILE };
}

/** A hero standing in a boss room (the rooms before it cleared), the boss up and doing only what it is told. */
function arena(boss: string): { w: World; b: Enemy; hold: () => void } {
  const w = newWorld('crypt', readyHero('warrior', LEVEL, 'uncommon'));
  const enc = w.encounters.find((e) => e.def.boss === boss)!;
  for (const e of w.encounters) if (e.index < enc.index) e.state = 'cleared';
  const tiles = w.map.roomTiles[enc.index]!.filter((i) => !w.map.solid[i]);
  const i = tiles[Math.floor(tiles.length / 2)]!;
  w.player.x = ((i % w.map.w) + 0.5) * TILE;
  w.player.y = (Math.floor(i / w.map.w) + 0.5) * TILE + 40;
  for (let k = 0; k < 5; k++) w.step(1 / 60);
  const b = w.boss()!;
  expect(b.def.id).toBe(boss);
  b.boss!.queue = [];
  b.boss!.pattern = null;
  const hold = (): void => {
    w.player.iframe = 99;
    if (!b.boss!.pattern && !b.boss!.queue.length) b.boss!.rest = 99;
  };
  return { w, b, hold };
}
const run = (w: World, s: number, each: () => void): void => {
  for (let i = 0; i < s * 60; i++) {
    each();
    w.step(1 / 60);
  }
};
const order = (b: Enemy, id: string, p: PatternUse['p'] = {}): void => {
  b.boss!.pattern = null;
  b.boss!.queue = [{ id: id as PatternUse['id'], w: 1, cd: 0, p }];
  b.boss!.rest = 0;
};
const things = (w: World, id: string): Enemy[] => w.enemies.filter((e) => e.def.id === id && !e.dead && e.hp > 0);
const strike = (w: World, e: Enemy): void => void hitEnemy(w, e, e.hp + e.shield + 999, 'physical', { depth: 1 });

describe('sigilfall: the Chapel Crypt', () => {
  for (const cls of CLASS_IDS) {
    it(`${cls}: clears the Chapel Crypt at level ${LEVEL}, three bosses in turn`, { timeout: 180_000 }, () => {
      const { w, r } = clearsWithRetry((seed) => {
        const w = newWorld('crypt', readyHero(cls as ClassId, LEVEL, gearAt(LEVEL)), seed);
        return { w, r: play(w, { seconds: 1200, done: (x) => x.cleared, goal: nextRoom }) };
      });
      expect(r.stuck).toBe(false);
      expect(w.cleared).toBe(true);
      expect(r.bossesDown).toEqual(['coffin-matron', 'ossric', 'morgrave']);
      expect(r.deaths).toBeLessThanOrEqual(HARD_DEATHS);
    });
  }

  it('the Matron hides in one of her coffins: the right one lets her out stunned, a wrong one lets out the dead', () => {
    const { w, b, hold } = arena('coffin-matron');
    order(b, 'crypt:coffins', { n: 4, swaps: 2, swap: 0.4, wait: 20 });
    run(w, 0.5, hold);
    const coffins = things(w, 'matron-coffin');
    expect(coffins).toHaveLength(4);
    // she can't be touched while she hides
    const hp = b.hp;
    hitEnemy(w, b, 500, 'physical', { depth: 1 });
    expect(b.hp).toBe(hp);
    // the shuffle trades their places: the same spots in the end, coffins moving between them on the way
    const spot = (c: Enemy): string => `${Math.round(c.x)},${Math.round(c.y)}`;
    const before = coffins.map(spot);
    const start = coffins.map((c) => ({ x: c.x, y: c.y }));
    let moved = 0;
    run(w, 2.5, () => {
      hold();
      for (const [j, c] of coffins.entries()) moved = Math.max(moved, Math.hypot(c.x - start[j]!.x, c.y - start[j]!.y));
    });
    expect(coffins.map(spot).sort()).toEqual([...before].sort());
    expect(moved).toBeGreaterThan(40);
    // a wrong coffin: two of the dead come out, she stays hidden
    const right = coffins[b.boss!.pattern!.data.right!]!;
    const wrong = coffins.find((c) => c !== right)!;
    const skeletons = things(w, 'skeleton').length;
    strike(w, wrong);
    run(w, 0.3, hold);
    expect(things(w, 'skeleton').length).toBe(skeletons + 2);
    expect(b.boss!.pattern?.use.id).toBe('crypt:coffins');
    // the right one: she bursts out, stunned and marked, and the coffins sink
    strike(w, right);
    run(w, 0.3, hold);
    expect(b.boss!.pattern).toBeNull();
    expect(b.boss!.dazed).toBeGreaterThan(2);
    expect(b.statuses.some((s) => s.id === 'mark')).toBe(true);
    expect(things(w, 'matron-coffin')).toHaveLength(0);
  });

  it('wait too long and the Matron comes out screaming', () => {
    const { w, b, hold } = arena('coffin-matron');
    order(b, 'crypt:coffins', { n: 3, swaps: 1, swap: 0.4, wait: 1 });
    let scream = false;
    run(w, 3, () => {
      hold();
      scream ||= w.telegraphs.some((t) => t.shape === 'circle' && t.r === 64);
    });
    expect(scream).toBe(true);
    expect(b.boss!.pattern).toBeNull();
    expect(things(w, 'matron-coffin')).toHaveLength(0);
  });

  it('Ossric is warded while his grave-candles burn, and snuffing them all breaks the ward', () => {
    const { w, b, hold } = arena('ossric');
    order(b, 'crypt:candles', { n: 3, relight: 3 });
    run(w, 1.5, hold);
    const candles = things(w, 'grave-candle');
    expect(candles).toHaveLength(3);
    run(w, 4, hold);
    expect(b.shield).toBeGreaterThan(0);
    for (const c of candles) strike(w, c);
    run(w, 0.6, hold);
    expect(b.shield).toBe(0);
    // relit, one at a time
    order(b, 'crypt:candles', { n: 3, relight: 1 });
    run(w, 1.5, hold);
    expect(things(w, 'grave-candle')).toHaveLength(1);
  });

  it('Morgrave splits into soul-shards: break them all and he falls back together stunned', () => {
    const { w, b, hold } = arena('morgrave');
    order(b, 'crypt:soul-split', { n: 3, time: 20, heal: 0.1, rage: 1.12 });
    // (the shards can be struck once they have formed)
    run(w, 1, hold);
    const souls = things(w, 'morgrave-soul');
    expect(souls).toHaveLength(3);
    const hp = b.hp;
    hitEnemy(w, b, 500, 'physical', { depth: 1 });
    expect(b.hp).toBe(hp);
    for (const s of souls) strike(w, s);
    run(w, 0.3, hold);
    expect(b.boss!.pattern).toBeNull();
    expect(b.boss!.dazed).toBeGreaterThan(1.5);
  });

  it('a soul-shard left when the spell ends flies home and heals him', () => {
    const { w, b, hold } = arena('morgrave');
    // (above his next phase, so the wound doesn't start it)
    b.hp = b.maxHp * 0.7;
    order(b, 'crypt:soul-split', { n: 3, time: 1.5, heal: 0.1, rage: 1.12 });
    run(w, 1, hold);
    strike(w, things(w, 'morgrave-soul')[0]!);
    run(w, 1.5, hold);
    expect(b.boss!.pattern).toBeNull();
    expect(b.hp).toBeCloseTo(b.maxHp * 0.9, 0);
    expect(b.atkMul).toBeGreaterThan(1.2);
    expect(things(w, 'morgrave-soul')).toHaveLength(0);
  });
});
