import { describe, expect, it } from 'vitest';
import { QUEST_DEFS } from '../src/games/sigilfall/data/quests';
import { REGIONS } from '../src/games/sigilfall/data/regions';
import type { RegionId } from '../src/games/sigilfall/data/types';
import { questState, type Character } from '../src/games/sigilfall/progress/character';
import { migrate } from '../src/games/sigilfall/progress/save';
import { hitEnemy } from '../src/games/sigilfall/sim/combat';
import type { World } from '../src/games/sigilfall/sim/world';
import { newWorld, readyHero } from './sigilfall-bot';

/**
 * Act II on the simulation (STORY_BIBLE.md §3, "Road to the Crown City"): the refugee wagon through the
 * fen, Nyx at the Deepforge's postern, Orren's vigil lifting the gloom on the downs, and the Night of
 * Knives in the Crown City.
 */

function heroAt(quest: string, level = 32): Character {
  const c = readyHero('mage', level);
  const done = (id: string): void => {
    if (c.quests[id]) return;
    c.quests[id] = { state: 'done', n: 1 };
    for (const a of QUEST_DEFS[id]?.after ?? []) done(a);
  };
  for (const a of QUEST_DEFS[quest]!.after ?? []) done(a);
  c.quests[quest] = { state: 'active', n: 0 };
  for (const r of Object.keys(REGIONS) as RegionId[]) if (!c.unlocked.includes(r)) c.unlocked.push(r);
  return c;
}

const DT = 1 / 60;
function run(w: World, seconds: number): void {
  for (let t = 0; t < seconds; t += DT) w.step(DT);
}
function goTo(w: World, place: string): void {
  const at = w.places[place] ?? w.spots.find((s) => s.id === place)!;
  w.player.x = at.x;
  w.player.y = at.y + 8;
}
function smite(w: World): void {
  for (const e of w.enemies) if (!e.dead && e.state !== 'spawn') hitEnemy(w, e, 1e7, 'physical', { depth: 0 });
}
function beat(w: World, quest: string, rounds = 40): void {
  for (let i = 0; i < rounds && questState(w.hero, quest) === 'active'; i++) {
    run(w, 2.5);
    smite(w);
  }
}

describe('Sigilfall: the road to the Crown City (Act II)', () => {
  it('the refugee wagon rolls through the fen, stops when attacked, and Nyx is waiting at Stilt Hollow', () => {
    const w = newWorld('duskfen', heroAt('the-sick-villages'));
    goTo(w, 'dusk-causeway');
    run(w, 0.3);
    expect(w.story.run?.def.id).toBe('dusk-caravan');
    const wagon = w.pets.find((p) => p.def.id === 'refugee-wagon')!;
    expect(wagon.goal).toBeTruthy();
    expect(w.pets.filter((p) => p.def.id === 'refugee')).toHaveLength(4);
    // it moves along the road while nothing threatens it
    for (const e of w.enemies) e.dead = true;
    const start = { x: wagon.x, y: wagon.y };
    run(w, 1.2);
    expect(Math.hypot(wagon.x - start.x, wagon.y - start.y)).toBeGreaterThan(8);
    // an ambush stops it
    run(w, 1);
    const foe = w.enemies.find((e) => !e.dead && e.state !== 'spawn');
    if (foe) {
      foe.x = wagon.x + 30;
      foe.y = wagon.y;
      run(w, 0.2);
      expect(wagon.paused).toBe(true);
    }
    // keep with it and keep it clear until it is in
    for (let i = 0; i < 200 && questState(w.hero, 'the-sick-villages') === 'active'; i++) {
      w.player.x = wagon.x + 10;
      w.player.y = wagon.y + 20;
      run(w, 0.5);
      smite(w);
    }
    expect(questState(w.hero, 'the-sick-villages')).toBe('done');
    expect(questState(w.hero, 'nyx-joins')).toBe('active');
    run(w, 0.6);
    expect(w.npcs.some((n) => n.id === 'nyx')).toBe(true);
    expect(QUEST_DEFS['the-dwarves-plea']!.giver).toBe('nyx');
  });

  it('the Deepforge: the toll-garrison holds the gate, Nyx opens the postern, and the dwarves’ banners go back up', () => {
    const held = newWorld('ironpeak', heroAt('nyx-the-back-door'));
    const gate = held.spots.find((s) => s.id === 'deepforge-gate')!;
    expect(held.enemies.some((e) => !e.dead && Math.hypot(e.x - gate.x, e.y - gate.y) < 10 * 16)).toBe(true);
    goTo(held, 'iron-postern');
    run(held, 0.3);
    expect(held.story.run?.def.id).toBe('iron-postern');
    const nyx = held.pets.find((p) => p.def.id === 'nyx-at-the-lock')!;
    expect(nyx.def.role).toBe('ward');
    beat(held, 'nyx-the-back-door');
    // Borrik offers the way down
    expect(questState(held.hero, 'the-slag-colossus')).not.toBe('locked');
    const free = newWorld('ironpeak', heroAt('camp-dwarves'));
    expect(free.enemies.some((e) => !e.dead && Math.hypot(e.x - gate.x, e.y - gate.y) < 6 * 16)).toBe(false);
    expect(free.props.filter((p) => p.prop === 'blue-banner').length).toBeGreaterThanOrEqual(4);
  });

  it('Lantern Hill lies in gloom until Orren’s vigil relights the great lamp; Cael waits in the hostel', () => {
    const w = newWorld('ashen-barrows', heroAt('the-last-lamp'));
    expect(w.storyState?.gloom).toBe(true);
    expect(w.npcs.some((n) => n.id === 'cael-varrow')).toBe(true);
    goTo(w, 'lantern-hill');
    run(w, 0.3);
    expect(w.story.run?.def.id).toBe('lantern-vigil');
    expect(w.pets.some((p) => p.def.id === 'great-lamp')).toBe(true);
    beat(w, 'the-last-lamp');
    expect(questState(w.hero, 'the-last-lamp')).toBe('done');
    run(w, 0.6);
    expect(w.storyState).toBeNull();
    expect(w.props.filter((p) => p.prop === 'lantern').length).toBeGreaterThan(4);
    // Cael comes in the story before the Kings' Mound
    expect(QUEST_DEFS['the-kings-mound']!.after).toEqual(['cael-the-hostel']);
  });

  it('the Night of Knives: lanterns, then fire in the square, the Regent held, Crane gone', () => {
    const fest = newWorld('emberwick', heroAt('festival-the-lanterns'));
    expect(fest.storyState?.id).toBe('festival');
    expect(fest.props.filter((p) => p.prop === 'lantern').length).toBeGreaterThanOrEqual(8);
    expect(fest.npcs.some((n) => n.id === 'chancellor-crane')).toBe(true);
    const w = newWorld('emberwick', heroAt('festival-the-knives'));
    expect(w.storyState?.id).toBe('night-of-knives');
    expect(w.dark).toBe(true);
    // the Regent is in the square, not on the keep's steps
    expect(w.npcs.some((n) => n.id === 'regent-elowen')).toBe(false);
    goTo(w, 'ember-dais');
    run(w, 0.3);
    expect(w.story.run?.def.id).toBe('festival-knives');
    expect(w.safe).toBe(false);
    expect(w.pets.some((p) => p.def.id === 'regent' && p.def.role === 'ward')).toBe(true);
    beat(w, 'festival-the-knives');
    expect(questState(w.hero, 'festival-the-catacombs')).toBe('active');
    run(w, 0.6);
    expect(w.storyState?.id).toBe('lockdown');
    expect(w.npcs.some((n) => n.id === 'chancellor-crane')).toBe(false);
    expect(w.npcs.some((n) => n.id === 'regent-elowen')).toBe(true);
    expect(w.spots.some((s) => s.id === 'crane-catacombs')).toBe(true);
    // Act III opens from the Regent's champion
    for (const id of ['the-sun-kings-tomb', 'the-frozen-road', 'the-fading-lights']) expect(QUEST_DEFS[id]!.after, id).toEqual(['festival-the-champion']);
  });

  it('an old save already in Act III has played the Crown City’s new beats', () => {
    const save = migrate({ v: 4, heroes: [{ cls: 'mage', level: 33, quests: { 'the-frozen-road': { state: 'active', n: 0 }, 'the-dwarves-plea': { state: 'done', n: 1 }, 'the-kings-mound': { state: 'done', n: 1 } }, unlocked: ['emberwick'] }], last: 0 })!;
    const h = save.heroes[0] as Character;
    for (const id of ['festival-the-champion', 'festival-the-knives', 'city-the-treasury', 'nyx-joins', 'cael-the-hostel']) expect(questState(h, id), id).toBe('done');
  });
});
