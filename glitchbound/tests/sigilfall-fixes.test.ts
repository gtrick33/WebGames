import { describe, expect, it } from 'vitest';
import { QUEST_DEFS } from '../src/games/sigilfall/data/quests';
import { BAG_OVERFLOW, bagSize, HELD_MAX, levelGated, newCharacter, startQuests, type Character } from '../src/games/sigilfall/progress/character';
import { REGION_IDS } from '../src/games/sigilfall/data/regions';
import { rollGear, salvageValue } from '../src/games/sigilfall/progress/items';
import { buyItem, sellPrice, stockFor } from '../src/games/sigilfall/progress/shop';
import { validateItem } from '../src/games/sigilfall/progress/save';
import { xpToNext } from '../src/games/sigilfall/data/classes';
import { paragonXp } from '../src/games/sigilfall/progress/paragon';
import { migrate, saveText, emptySave } from '../src/games/sigilfall/progress/save';
import { rng } from '../src/games/sigilfall/core/math';
import { armorReduction, hitEnemy } from '../src/games/sigilfall/sim/combat';
import { buildHero } from '../src/games/sigilfall/progress/build';
import { npcRegion } from '../src/games/sigilfall/sim/routes';
import { TILE } from '../src/games/sigilfall/sim/map';
import { emptyInput, type World } from '../src/games/sigilfall/sim/world';
import { newWorld, readyHero } from './sigilfall-bot';

const steps = (w: World, n: number): void => {
  for (let i = 0; i < n; i++) {
    w.input = emptyInput();
    w.step(1 / 60);
  }
};

/** A warrior in the Crypt Gate's boss room with Warden Ossric down to his last point of health. */
function atOssric() {
  const c = readyHero('warrior', 8, 'uncommon');
  c.unlocked.push('crypt');
  const w = newWorld('crypt', c, 3);
  const enc = w.encounters.findIndex((e) => e.def.boss === 'ossric');
  const tiles = w.map.roomTiles[enc]!.filter((i) => !w.map.solid[i]);
  const t = tiles[Math.floor(tiles.length / 2)]!;
  w.player.x = ((t % w.map.w) + 0.5) * TILE;
  w.player.y = (Math.floor(t / w.map.w) + 0.5) * TILE;
  steps(w, 30);
  const boss = w.boss()!;
  for (let i = 0; i < 200 && (boss.state === 'spawn' || boss.boss!.shift > 0); i++) steps(w, 1);
  boss.hp = 1;
  return { c, w, boss, enc };
}

/** A hero with these quests (and everything before them) done, and these in the given states. */
function storyHero(done: string[], now: Record<string, Character['quests'][string]['state']> = {}): Character {
  const c = newCharacter('warrior', 'Story', 'hero0', 0);
  const mark = (id: string): void => {
    if (c.quests[id]) return;
    c.quests[id] = { state: 'done', n: 1 };
    for (const a of QUEST_DEFS[id]?.after ?? []) mark(a);
  };
  done.forEach(mark);
  for (const [id, state] of Object.entries(now)) {
    for (const a of QUEST_DEFS[id]?.after ?? []) mark(a);
    c.quests[id] = { state, n: state === 'ready' ? 1e6 : 0 };
  }
  return c;
}

describe('Sigilfall systems fixes', () => {
  it('SFS-04: Mara can still be reported to after the Gloam Gate', () => {
    const h = storyHero(['the-gloam-gate'], { 'mara-commands': 'active' });
    expect(npcRegion('captain-mara', h)).toBe('highwall');
    // and once reported to, she has gone on with the story
    h.quests['mara-commands'] = { state: 'done', n: 1 };
    expect(npcRegion('captain-mara', h)).toBeUndefined();
  });

  it('SFS-05: the quest arrow follows people the story moves', () => {
    // Fernstead lost: from the Herald's ambush the villagers stand in Briarhollow, never nowhere
    const ambush = storyHero(['the-heralds-ambush'], { 'lights-on-the-ridge': 'ready' });
    expect(QUEST_DEFS['fall-of-fernstead'] && ambush.quests['fall-of-fernstead']?.state).not.toBe('done');
    for (const npc of ['warden-hollis', 'mother-alsa', 'pip-tanner']) expect(npcRegion(npc, ambush)).toBe('briarhollow');
    // before it, they are at home in Brackenridge
    expect(npcRegion('warden-hollis', storyHero([], { 'lights-on-the-ridge': 'ready' }))).toBe('brackenridge');
    // Brother Orren goes to Emberwick after Sir Corvane
    expect(npcRegion('brother-orren', storyHero(['sir-corvane'], { 'orren-the-last-chapel': 'active' }))).toBe('emberwick');
    expect(npcRegion('brother-orren', storyHero([], { 'orren-the-last-chapel': 'active' }))).toBe('ashen-barrows');
  });

  it('SFS-03: a burn does not kill the hero during a boss death throes, and the kill counts', { timeout: 30_000 }, () => {
    const { c, w, boss } = atOssric();
    w.player.hp = 30;
    w.player.iframe = 0;
    w.player.statuses.push({ id: 'burn', t: 3, power: 40, tick: 0.5 });
    hitEnemy(w, boss, 50, 'physical', { depth: 0 });
    steps(w, 240);
    expect(w.player.dead).toBe(false);
    expect(c.bosses.ossric).toBe(1);
  });

  it('SFS-03: a hero who falls during the throes still has the kill after Rise again', { timeout: 30_000 }, () => {
    const { c, w, boss, enc } = atOssric();
    hitEnemy(w, boss, 50, 'physical', { depth: 0 });
    steps(w, 10);
    expect(boss.boss!.dying).toBeGreaterThan(0);
    w.playerDies();
    w.respawn();
    expect(c.bosses.ossric).toBe(1);
    expect(w.encounters[enc]!.state).not.toBe('active');
  });

  it('SFS-06: a quest reward with a full bag goes to the overflow, then waits for room, never to the ground', { timeout: 30_000 }, () => {
    const c = readyHero('warrior', 20, 'uncommon');
    const w = newWorld('briarhollow', c, 3);
    const r = rng(9);
    const fill = (n: number): void => {
      c.bag = [];
      for (let i = 0; i < n; i++) c.bag.push(rollGear('warrior', 20, 'common', r));
    };
    const heroic = QUEST_DEFS['heroic']!;
    // a full bag (30/30): into the overflow
    fill(bagSize(c));
    w.completeQuests([heroic]);
    expect(c.bag.some((i) => i.base === 'amulet-of-echoes')).toBe(true);
    expect(w.drops.filter((d) => d.kind === 'item')).toHaveLength(0);
    // the overflow full too: held, saved with the hero, and in the bag once there is room
    fill(bagSize(c) + BAG_OVERFLOW);
    w.completeQuests([heroic]);
    expect(w.drops.filter((d) => d.kind === 'item')).toHaveLength(0);
    expect(c.held?.map((i) => i.base)).toEqual(['amulet-of-echoes']);
    const back = migrate(JSON.parse(saveText({ ...emptySave(), heroes: [c, null, null] })))!.heroes[0]!;
    expect(back.held?.map((i) => i.base)).toEqual(['amulet-of-echoes']);
    c.bag = c.bag.slice(0, bagSize(c) - 1);
    steps(w, 1);
    expect(c.held).toBeUndefined();
    expect(c.bag.at(-1)?.base).toBe('amulet-of-echoes');
    // past HELD_MAX waiting, a reward is sold for its gold rather than lost
    fill(bagSize(c) + BAG_OVERFLOW);
    c.held = [];
    for (let i = 0; i < HELD_MAX; i++) c.held.push(rollGear('warrior', 20, 'common', r));
    const gold = c.gold;
    w.completeQuests([heroic]);
    expect(c.gold).toBeGreaterThan(gold + heroic.reward.gold);
  });

  it('SFS-08: a quartermaster piece sells back for less than it cost', () => {
    const c = readyHero('warrior', 15, 'uncommon');
    c.gold = 1e6;
    c.marks = 1e4;
    c.bag = [];
    const stock = stockFor(c, 'quartermaster');
    expect(stock.length).toBeGreaterThan(0);
    for (const s of stock) {
      const item = buyItem(c, 'quartermaster', s.item.uid)!;
      expect(item).toBeTruthy();
      expect(sellPrice(item)).toBeLessThan(s.price.gold);
      // and still after a reload, also for a piece bought before prices were kept
      expect(salvageValue(validateItem(JSON.parse(JSON.stringify(item)))!)).toBe(sellPrice(item));
      const old: Record<string, unknown> = { ...item };
      delete old.paid;
      expect(salvageValue(validateItem(JSON.parse(JSON.stringify(old)))!)).toBeLessThan(s.price.gold);
    }
  });

  it('SFS-12: experience past level 60 in one gain goes to Paragon', { timeout: 30_000 }, () => {
    const c = readyHero('warrior', 59, 'uncommon');
    const w = newWorld('briarhollow', c, 3);
    c.xp = xpToNext(59) - 100;
    w.events = [];
    w.giveXp(100 + paragonXp(0) + 50);
    const events = w.events.map((e) => e.t);
    expect(c.level).toBe(60);
    expect(c.para.l).toBe(1);
    expect(c.para.x).toBe(50);
    expect(events).toContain('paragon');
  });

  it('SFS-09: armor keeps mattering past level 20, and early levels feel as before', () => {
    for (const [lvl, rar] of [[20, 'uncommon'], [30, 'rare'], [45, 'rare'], [60, 'rare'], [60, 'epic']] as const) {
      const warrior = buildHero(readyHero('warrior', lvl, rar)).stats.armor;
      const mage = buildHero(readyHero('mage', lvl, rar)).stats.armor;
      // below the cap: more armor (plate, a roll, a Toughness point) still means less damage
      expect(armorReduction(warrior, lvl)).toBeLessThan(0.6);
      expect(armorReduction(warrior + 2, lvl)).toBeGreaterThan(armorReduction(warrior, lvl));
      expect(armorReduction(warrior, lvl)).toBeGreaterThan(armorReduction(mage, lvl));
      expect(armorReduction(mage, lvl)).toBeGreaterThan(0.35);
    }
    for (const lvl of [1, 5, 10, 12]) {
      const armor = buildHero(readyHero('warrior', lvl, 'uncommon')).stats.armor;
      expect(armorReduction(armor, lvl)).toBe(Math.min(0.6, armor / (armor + 60)));
    }
  });

  it('Design: a quest waiting only for a level is listed with the level it opens at', () => {
    const h = storyHero(['break-the-giants']);
    h.unlocked = [...REGION_IDS];
    h.level = 49;
    startQuests(h);
    expect(h.quests['muster-the-field']).toBeUndefined();
    const gate = levelGated(h).find((q) => q.id === 'muster-the-field');
    expect(gate?.level).toBe(50);
    // lowest level first, and none that the hero could already start
    const levels = levelGated(h).map((q) => q.level!);
    expect([...levels].sort((a, b) => a - b)).toEqual(levels);
    expect(levels.every((l) => l > h.level)).toBe(true);
    h.level = 50;
    startQuests(h);
    expect(h.quests['muster-the-field']?.state).toBe('active');
    expect(levelGated(h).some((q) => q.id === 'muster-the-field')).toBe(false);
  });
});
