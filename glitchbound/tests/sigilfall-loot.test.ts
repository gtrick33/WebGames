import { describe, expect, it } from 'vitest';
import { potionCap } from '../src/games/sigilfall/progress/character';
import { QUEST_DEFS } from '../src/games/sigilfall/data/quests';
import { GOLD_FIND } from '../src/games/sigilfall/data/vendors';
import { itemWorth, salvageValue } from '../src/games/sigilfall/progress/items';
import { gearPrice, potionPrice } from '../src/games/sigilfall/progress/shop';
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

  it('chests still hold gear: one piece from a rare chest, one now and then from an ordinary one', () => {
    const w = world();
    w.chests = [{ id: 'c', key: 'test:c', x: w.player.x, y: w.player.y, tier: 'rare', once: false, open: false, openT: 0 }];
    w.input = emptyInput();
    w.step(1 / 60);
    const items = (): number => w.drops.filter((d) => d.kind === 'item').length + w.run.items.length;
    expect(items()).toBe(1);
    // (the owner: "items drop rate is still massive": an ordinary chest gives a piece about every other time)
    let got = 0;
    for (let i = 0; i < 40; i++) {
      const before = items();
      w.chests = [{ id: `c${i}`, key: `test:c${i}`, x: w.player.x, y: w.player.y, tier: 'common', once: false, open: false, openT: 0 }];
      w.step(1 / 60);
      got += items() - before;
    }
    expect(got).toBeGreaterThan(8);
    expect(got).toBeLessThan(32);
  });

  it('a potion goes on the belt, or comes as the road’s share of its price in coin when the belt is full', () => {
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
    expect(h.gold).toBe(gold + Math.round(potionPrice(h.level) * GOLD_FIND));
  });

  // the owner (2026-11-15): "gold currently is meaningless, either drop way less, or adjust prices, i say drop less,
  // ive got 50k gold and i have no idea what to use them for"
  it('the road pays a quarter of the coin it did, and what things cost stays as it was', () => {
    expect(GOLD_FIND).toBe(0.25);
    // a piece melts down (or sells) for a quarter of its worth; a vendor still asks four times its worth
    const piece = { il: 34, r: 'rare' as const };
    expect(itemWorth(piece)).toBe(216);
    expect(salvageValue(piece)).toBe(54);
    expect(gearPrice({ ...piece, uid: 'x' } as Parameters<typeof gearPrice>[0])).toBe(864);
    // quests pay a quarter of what they say (to the nearest 5), never nothing when they paid something
    const q = QUEST_DEFS['the-sun-kings-tomb']!;
    expect(q.reward.gold).toBe(65);
    for (const d of Object.values(QUEST_DEFS)) if (d.reward.gold > 0) expect(d.reward.gold).toBeGreaterThanOrEqual(5);
    // and a hundred foes of level 30 drop a few hundred coins, not thousands
    const w = newWorld('whisperwood', readyHero('mage', 30), 3);
    w.enemies = [];
    let coin = 0;
    for (let i = 0; i < 100; i++) {
      const e = w.addEnemy('moss-slime', w.player.x + 300, w.player.y, 30, { room: -1, pack: 0 });
      e.hp = 0;
      e.dead = true;
      w.onKill(e);
    }
    for (const d of w.drops) if (d.kind === 'gold') coin += d.amount;
    expect(coin).toBeLessThan(900);
    expect(coin).toBeGreaterThan(100);
  });
});
