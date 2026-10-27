import { describe, expect, it } from 'vitest';
import { potionCap } from '../src/games/sigilfall/progress/character';
import { potionPrice } from '../src/games/sigilfall/progress/shop';
import { emptyInput, type World } from '../src/games/sigilfall/sim/world';
import { newWorld, readyHero } from './sigilfall-bot';

/**
 * Gear comes from chests, bosses, quests and shops (a playtester, 2026-10-27: the same staff dropped six or
 * seven times). The enemies on the way drop coin, a potion now and then and health orbs; an elite or a
 * named foe drops a purse worth a piece of gear.
 */

const world = (): World => {
  const w = newWorld('whisperwood', readyHero('mage', 12), 3);
  w.enemies = [];
  return w;
};

/** Kills `n` enemies of a kind next to the hero and counts what fell. */
function kill(w: World, n: number, elite: boolean): Record<string, number> {
  for (let i = 0; i < n; i++) {
    const e = w.addEnemy('moss-slime', w.player.x + 300, w.player.y, 12, { room: -1, pack: 0, elite });
    e.hp = 0;
    e.dead = true;
    w.onKill(e);
  }
  const out: Record<string, number> = {};
  for (const d of w.drops) out[d.kind] = (out[d.kind] ?? 0) + (d.kind === 'gold' ? d.amount : 1);
  return out;
}

describe('Sigilfall: gear from chests and bosses, coin and potions from the rest', () => {
  it('ordinary enemies drop no gear: coin, now and then a potion and a health orb', () => {
    const got = kill(world(), 400, false);
    expect(got.item ?? 0).toBe(0);
    expect(got.gold).toBeGreaterThan(0);
    // about one in twenty-five
    expect(got.potion).toBeGreaterThan(4);
    expect(got.potion).toBeLessThan(40);
    expect(got.orb).toBeGreaterThan(0);
  });

  it('elites drop no gear either, but a fat purse and often a potion', () => {
    const plain = kill(world(), 60, false).gold!;
    const got = kill(world(), 60, true);
    expect(got.item ?? 0).toBe(0);
    expect(got.gold).toBeGreaterThan(plain * 4);
    expect(got.potion).toBeGreaterThan(15);
  });

  it('chests still hold gear', () => {
    const w = world();
    w.chests = [{ id: 'c', key: 'test:c', x: w.player.x, y: w.player.y, tier: 'rare', once: false, open: false, openT: 0 }];
    w.input = emptyInput();
    w.step(1 / 60);
    expect(w.drops.filter((d) => d.kind === 'item').length + w.run.items.length).toBe(2);
  });

  it('a potion goes on the belt, or comes as its price in coin when the belt is full', () => {
    const w = world();
    const h = w.hero;
    h.potions = 0;
    w.collectAll();
    w.drops.push({ id: 1, kind: 'potion', x: w.player.x, y: w.player.y, vx: 0, vy: 0, z: 0, vz: 0, amount: 1, t: 1, dead: false });
    w.collectAll();
    expect(h.potions).toBe(1);
    h.potions = potionCap(h);
    const gold = h.gold;
    w.drops.push({ id: 2, kind: 'potion', x: w.player.x, y: w.player.y, vx: 0, vy: 0, z: 0, vz: 0, amount: 1, t: 1, dead: false });
    w.collectAll();
    expect(h.potions).toBe(potionCap(h));
    expect(h.gold).toBe(gold + potionPrice(h.level));
  });
});
