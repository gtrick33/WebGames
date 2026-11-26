import { describe, expect, it } from 'vitest';
import { QUEST_DEFS } from '../src/games/sigilfall/data/quests';
import { REGIONS } from '../src/games/sigilfall/data/regions';
import type { RegionId } from '../src/games/sigilfall/data/types';
import { questState, type Character } from '../src/games/sigilfall/progress/character';
import { migrate } from '../src/games/sigilfall/progress/save';
import { hitEnemy } from '../src/games/sigilfall/sim/combat';
import type { World } from '../src/games/sigilfall/sim/world';
import { doSteps, newWorld, readyHero } from './sigilfall-bot';

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

  it('Lantern Hill lies in gloom until Orren’s vigil relights the great lamp; Cael waits in the hostel', () => {
    const w = newWorld('ashen-barrows', heroAt('the-last-lamp'));
    expect(w.storyState?.gloom).toBe(true);
    expect(w.npcs.some((n) => n.id === 'cael-varrow')).toBe(true);
    // (the night's oil is carried up first: that step's own test plays it)
    doSteps(w, 'the-last-lamp');
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
    // Act III opens from the Regent's champion, and runs from sigil to sigil: the sands, the forest, the ice
    expect(QUEST_DEFS['the-sun-kings-tomb']!.after).toEqual(['festival-the-champion']);
    expect(QUEST_DEFS['the-fading-lights']!.after).toEqual(['the-sun-king']);
    expect(QUEST_DEFS['the-frozen-road']!.after).toEqual(['the-clans-decide']);
  });

  it('an old save already in Act III has played the Crown City’s new beats, and the story before it in one line', () => {
    const save = migrate({ v: 4, heroes: [{ cls: 'mage', level: 33, quests: { 'the-frozen-road': { state: 'active', n: 0 }, 'the-dwarves-plea': { state: 'done', n: 1 }, 'the-kings-mound': { state: 'done', n: 1 } }, unlocked: ['emberwick'] }], last: 0 })!;
    const h = save.heroes[0] as Character;
    for (const id of ['festival-the-champion', 'festival-the-knives', 'city-the-treasury', 'cael-the-hostel', 'the-sun-king', 'the-clans-decide']) expect(questState(h, id), id).toBe('done');
    expect(questState(h, 'the-frozen-road')).toBe('active');
    // with the sigils those give, and the quests of the lands that left the story dropped
    expect(h.perks).toEqual(expect.arrayContaining(['sigil-embers', 'sigil-sun', 'sigil-thorns']));
    expect(h.quests['the-dwarves-plea']).toBeUndefined();
  });
});
