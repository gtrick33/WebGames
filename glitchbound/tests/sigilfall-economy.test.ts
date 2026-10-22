import { describe, expect, it } from 'vitest';
import { CLASSES } from '../src/games/sigilfall/data/classes';
import { SKILLS } from '../src/games/sigilfall/data/skills';
import { QM_LEVEL } from '../src/games/sigilfall/data/vendors';
import { POTION_CAP } from '../src/games/sigilfall/progress/character';
import { itemSlot } from '../src/games/sigilfall/progress/items';
import { emptySave, loadSave, writeSave } from '../src/games/sigilfall/progress/save';
import { buyItem, buyPotions, cantBuy, potionPrice, restock, stockFor } from '../src/games/sigilfall/progress/shop';
import { hitEnemy } from '../src/games/sigilfall/sim/combat';
import { tryCast } from '../src/games/sigilfall/sim/cast';
import { emptyInput } from '../src/games/sigilfall/sim/world';
import { newWorld, readyHero } from './sigilfall-bot';

const step = (w: ReturnType<typeof newWorld>, seconds: number) => {
  for (let t = 0; t < seconds; t += 1 / 60) {
    w.input = emptyInput();
    w.step(1 / 60);
  }
};

describe('sigilfall mana', () => {
  it('the mage pays mana for spells, is refused when short, and gets mana back from bolt hits', () => {
    const w = newWorld('whisperwood', readyHero('mage', 6));
    const p = w.player;
    expect(p.maxMana).toBe(CLASSES.mage.resource!.base + CLASSES.mage.resource!.perLevel * 5);
    expect(p.mana).toBe(p.maxMana);
    const cost = (SKILLS.fireball!.base.cost * p.maxMana) / 100;
    expect(tryCast(w, { slot: 's1', angle: 0, dist: null, assist: 0 })).toBe(true);
    expect(p.mana).toBeCloseTo(p.maxMana - cost);
    // short of mana: refused, and the cooldown isn't spent
    p.mana = cost / 2;
    p.cds.s1.charges = 1;
    expect(tryCast(w, { slot: 's1', angle: 0, dist: null, assist: 0 })).toBe(false);
    expect(p.cds.s1.charges).toBe(1);
    // the basic bolt gives a little back on a hit
    w.enemies = [];
    const e = w.addEnemy('moss-slime', p.x + 30, p.y, 3, { room: -1, pack: 0 });
    e.hp = e.maxHp = 1e6;
    const before = p.mana;
    hitEnemy(w, e, 10, 'arcane', { spec: w.build.skills['arcane-bolt']!.spec, depth: 0 });
    expect(p.mana).toBeGreaterThan(before);
  });

  it('classes without mana cast on cooldowns alone', () => {
    const w = newWorld('whisperwood', readyHero('warrior', 6));
    expect(w.player.maxMana).toBe(0);
    expect(tryCast(w, { slot: 's1', angle: 0, dist: null, assist: 0 })).toBe(true);
  });

  it('out of combat, health and mana come back fast; in combat they don’t', () => {
    const w = newWorld('whisperwood', readyHero('mage', 6));
    const p = w.player;
    p.hp = p.maxHp * 0.3;
    p.mana = 0;
    p.calm = 0;
    step(w, 1);
    expect(p.hp).toBeLessThan(p.maxHp * 0.45);
    step(w, 12);
    expect(p.hp).toBe(p.maxHp);
    expect(p.mana).toBe(p.maxMana);
  });
});

describe('sigilfall potions and shops', () => {
  it('potions are bought at the inn up to the cap, and a fall doesn’t refill them', () => {
    const w = newWorld('whisperwood', readyHero('ranger', 5));
    const h = w.hero;
    h.potions = 1;
    w.playerDies();
    w.respawn();
    expect(h.potions).toBe(1);
    h.gold = potionPrice(h.level) * 2 + 1;
    expect(buyPotions(h, 10)).toBe(2);
    expect(h.potions).toBe(3);
    expect(h.gold).toBe(1);
    h.gold = 1e6;
    buyPotions(h, 99);
    expect(h.potions).toBe(POTION_CAP);
    expect(buyPotions(h, 1)).toBe(0);
  });

  it('gear stock is stable until the hero levels or comes home, and bought pieces stay sold', () => {
    const h = readyHero('mage', 6);
    h.bag = [];
    const a = stockFor(h, 'weapons');
    const b = stockFor(h, 'weapons');
    expect(a.map((s) => s.item.uid)).toEqual(b.map((s) => s.item.uid));
    expect(a.length).toBe(6);
    for (const s of a) {
      expect(s.item.il).toBe(6);
      expect(['weapon', 'offhand']).toContain(itemSlot(s.item));
    }
    h.gold = a[0]!.price.gold;
    const got = buyItem(h, 'weapons', a[0]!.item.uid);
    expect(got).not.toBeNull();
    expect(h.gold).toBe(0);
    expect(h.bag.map((i) => i.uid)).toEqual([a[0]!.item.uid]);
    expect(stockFor(h, 'weapons').some((s) => s.item.uid === a[0]!.item.uid)).toBe(false);
    // no gold: refused
    expect(buyItem(h, 'weapons', a[1]!.item.uid)).toBeNull();
    restock(h);
    expect(stockFor(h, 'weapons').map((s) => s.item.uid)).not.toEqual(a.map((s) => s.item.uid));
  });

  it('the quartermaster sells top-level epics and legendaries for marks, from its level', () => {
    const h = readyHero('warrior', 10);
    const stock = stockFor(h, 'quartermaster');
    expect(stock.length).toBeGreaterThan(0);
    for (const s of stock) {
      expect(['epic', 'legendary']).toContain(s.item.r);
      expect(s.price.marks).toBeGreaterThan(0);
    }
    h.gold = 1e6;
    h.marks = 1e3;
    expect(cantBuy(h, 'quartermaster', stock[0]!)).toMatch(/level/);
    h.level = QM_LEVEL;
    expect(cantBuy(h, 'quartermaster', stock[0]!)).toBeNull();
  });

  it('bosses pay Sigil Marks, more on harder tiers', () => {
    for (const [tier, want] of [
      [0, 4],
      [2, 12],
    ] as const) {
      const w = newWorld('crypt', readyHero('mage', 9), 1, tier);
      const enc = w.encounters.findIndex((e) => e.def.boss === 'morgrave');
      const tile = w.map.roomTiles[enc]!.find((i) => !w.map.solid[i])!;
      w.player.x = ((tile % w.map.w) + 0.5) * 16;
      w.player.y = (Math.floor(tile / w.map.w) + 0.5) * 16;
      step(w, 0.2);
      const boss = w.boss()!;
      w.bossFinished(boss);
      expect(w.hero.marks).toBe(want);
    }
  });

  it('marks and shop state are saved', () => {
    const save = emptySave();
    const h = readyHero('ranger', 4);
    h.marks = 7;
    h.restock = 3;
    h.sold = ['vabc0'];
    save.heroes[0] = h;
    writeSave(save);
    const back = loadSave().save.heroes[0]!;
    expect(back.marks).toBe(7);
    expect(back.restock).toBe(3);
    expect(back.sold).toEqual(['vabc0']);
  });
});

describe('sigilfall aiming', () => {
  it('a tapped spell goes where the hero faces, not at the nearest enemy', () => {
    const w = newWorld('whisperwood', readyHero('mage', 6));
    const p = w.player;
    w.enemies = [];
    const e = w.addEnemy('moss-slime', p.x + 40, p.y, 3, { room: -1, pack: 0 });
    e.state = 'chase';
    p.aim = Math.PI / 2;
    expect(tryCast(w, { slot: 's1', angle: null, dist: null, assist: 0 })).toBe(true);
    step(w, 0.05);
    const shot = w.projectiles.find((x) => !x.hostile)!;
    expect(Math.atan2(shot.vy, shot.vx)).toBeCloseTo(Math.PI / 2, 1);
  });

  it('dodges have real cooldowns', () => {
    for (const cls of ['mage', 'warrior', 'ranger'] as const) expect(SKILLS[CLASSES[cls].dodge]!.base.cooldown).toBeGreaterThanOrEqual(4.5);
  });
});
