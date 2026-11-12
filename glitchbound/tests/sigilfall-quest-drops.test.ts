import { describe, expect, it } from 'vitest';
import { QUEST_DEFS } from '../src/games/sigilfall/data/quests';
import type { Objective, RegionId } from '../src/games/sigilfall/data/types';
import { killEnemy } from '../src/games/sigilfall/sim/combat';
import { emptyInput, QUEST_DRAW, QUEST_WAIT, type World } from '../src/games/sigilfall/sim/world';
import { newWorld, readyHero } from './sigilfall-bot';

type Loot = Extract<Objective, { kind: 'loot' }>;
const LOOT = Object.values(QUEST_DEFS).filter((q) => q.objective.kind === 'loot') as (typeof QUEST_DEFS)[string][];

/** A hero on a quest for things some foes carry, in its land, with nothing else alive. */
function onQuest(id: string): { w: World; o: Loot } {
  const q = QUEST_DEFS[id]!;
  const o = q.objective as Loot;
  const c = readyHero('warrior', 60);
  c.quests[id] = { state: 'active', n: 0 };
  if (!c.unlocked.includes(o.region)) c.unlocked.push(o.region);
  const w = newWorld(o.region as RegionId, c);
  w.enemies.length = 0;
  w.drops.length = 0;
  return { w, o };
}

/** Kills its carriers `far` from the hero until one drops the thing; the drop. */
function dropOne(w: World, o: Loot, far: number): World['drops'][number] {
  for (let i = 0; i < 80 && !w.drops.some((d) => d.kind === 'quest'); i++) {
    const e = w.addEnemy(o.from[0]!, w.player.x + far, w.player.y, 10, { room: -1, pack: -1, post: true });
    e.x = w.player.x + far;
    e.y = w.player.y;
    killEnemy(w, e, 'physical', 0, null);
    w.drops = w.drops.filter((d) => d.kind === 'quest');
  }
  const d = w.drops.find((x) => x.kind === 'quest');
  if (!d) throw new Error('no quest item in 80 kills');
  return d;
}

const run = (w: World, seconds: number): void => {
  for (let t = 0; t < seconds; t += 1 / 60) {
    w.input = emptyInput();
    w.player.hp = w.player.maxHp;
    w.step(1 / 60);
  }
};

describe('Sigilfall: what a quest asks for can be seen', () => {
  it('there are many such quests, and each names its thing', () => {
    // (as a quest's first step, or a later one)
    const all = Object.values(QUEST_DEFS).flatMap((q) => [q.objective, ...(q.then ?? [])]).filter((o): o is Loot => o.kind === 'loot');
    expect(all.length).toBeGreaterThan(10);
    for (const o of all) expect(o.item.length, o.label).toBeGreaterThan(2);
  });

  const id = LOOT[0]!.id;

  it('it falls from the foe that carried it and lies there with its name: not counted until it is taken', () => {
    const { w, o } = onQuest(id);
    const d = dropOne(w, o, 400);
    expect(d.label).toBe(o.item);
    expect(d.quest).toBe(id);
    expect(w.hero.quests[id]!.n).toBe(0);
    // it stays where it fell while the hero is far off
    run(w, 1.5);
    expect(w.drops.some((x) => x.kind === 'quest')).toBe(true);
    expect(w.hero.quests[id]!.n).toBe(0);
    expect(Math.hypot(d.x - w.player.x, d.y - w.player.y)).toBeGreaterThan(300);
  });

  it('a hero who comes near takes it, and then it counts', () => {
    const { w, o } = onQuest(id);
    const d = dropOne(w, o, 400);
    w.player.x = d.x - (QUEST_DRAW - 10);
    w.player.y = d.y;
    run(w, 1.5);
    expect(w.drops.some((x) => x.kind === 'quest')).toBe(false);
    expect(w.hero.quests[id]!.n).toBe(1);
  });

  it('left lying, it comes to the hero by itself after a while: it is never lost', () => {
    const { w, o } = onQuest(id);
    dropOne(w, o, 300);
    run(w, QUEST_WAIT + 4);
    expect(w.drops.some((x) => x.kind === 'quest')).toBe(false);
    expect(w.hero.quests[id]!.n).toBe(1);
  });

  it('a hero who leaves has what was still on the ground', () => {
    const { w, o } = onQuest(id);
    dropOne(w, o, 400);
    w.collectAll();
    expect(w.drops.length).toBe(0);
    expect(w.hero.quests[id]!.n).toBe(1);
  });

  it('one lying there after its quest is done is just taken away', () => {
    const { w, o } = onQuest(id);
    dropOne(w, o, 400);
    w.hero.quests[id] = { state: 'done', n: o.count };
    w.collectAll();
    expect(w.drops.length).toBe(0);
    expect(w.hero.quests[id]!.n).toBe(o.count);
  });
});
