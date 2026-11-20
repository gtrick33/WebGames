/**
 * Companions on the road (POLISH_PLAN.md piece 21): Mara, Elyra and Nyx walk and fight beside the hero in the stretch
 * of the story that is theirs, never in a town, and say a word now and then on a quiet road.
 */
import { describe, expect, it } from 'vitest';
import { PETS } from '../src/games/sigilfall/data/pets';
import { QUEST_DEFS } from '../src/games/sigilfall/data/quests';
import type { Character } from '../src/games/sigilfall/progress/character';
import { ESCORTS, escortOf, ROAD_LINES } from '../src/games/sigilfall/sim/escort';
import { emptyInput, type World } from '../src/games/sigilfall/sim/world';
import { newWorld, readyHero } from './sigilfall-bot';

const set = (h: Character, id: string, state: 'active' | 'done'): void => {
  h.quests[id] = { state, n: 0 };
};
const run = (w: World, s: number): void => {
  for (let i = 0; i < s * 60; i++) {
    w.input = emptyInput();
    w.step(1 / 60);
  }
};

describe('Sigilfall: who walks with the hero', () => {
  it('names only companions who fight and get back up, and quests that are the story’s', () => {
    for (const e of ESCORTS) {
      expect(PETS[e.who]?.rally, e.who).toBe(true);
      const quests = JSON.stringify(e.when).match(/"quest":"([a-z0-9-]+)"/g)!.map((m) => m.slice(9, -1));
      for (const q of quests) expect(QUEST_DEFS[q], `${e.who}: ${q}`).toBeTruthy();
    }
  });

  it('follows the story: Mara on the hunt, Elyra in Act I, Nyx to the Tear, nobody after it, Nyx back, Elyra freed', () => {
    const h = readyHero('warrior', 12);
    expect(escortOf(h)).toBeNull();
    set(h, 'into-the-wood', 'active');
    expect(escortOf(h)).toBe('mara');
    set(h, 'west-road', 'active');
    expect(escortOf(h)).toBe('elyra');
    set(h, 'the-bandit-king', 'done');
    expect(escortOf(h)).toBe('nyx');
    set(h, 'the-tear', 'done');
    expect(escortOf(h)).toBeNull();
    set(h, 'gate-the-prison-map', 'active');
    expect(escortOf(h)).toBe('nyx');
    set(h, 'the-gloam-gate', 'done');
    expect(escortOf(h)).toBe('elyra');
  });
});

describe('Sigilfall: a companion on the road', () => {
  const walking = (): Character => {
    const h = readyHero('warrior', 12);
    set(h, 'into-the-wood', 'done');
    set(h, 'west-road', 'active');
    return h;
  };

  it('is at the hero’s side out on the road, and not in a town', () => {
    const w = newWorld('whisperwood', walking());
    run(w, 2);
    expect(w.pets.filter((p) => !p.dead && p.def.id === 'elyra' && p.escort)).toHaveLength(1);
    const town = newWorld('briarhollow', walking());
    run(town, 2);
    expect(town.pets.some((p) => !p.dead && p.escort)).toBe(false);
  });

  it('never twice, and nobody who no longer should', () => {
    const h = walking();
    const w = newWorld('whisperwood', h);
    run(w, 3);
    expect(w.pets.filter((p) => !p.dead && p.def.id === 'elyra')).toHaveLength(1);
    // Nyx comes along: Elyra no longer walks with the hero here
    set(h, 'the-bandit-king', 'done');
    run(w, 2);
    expect(w.pets.some((p) => !p.dead && p.def.id === 'elyra')).toBe(false);
    expect(w.pets.filter((p) => !p.dead && p.def.id === 'nyx')).toHaveLength(1);
  });

  it('says a word now and then on a quiet road, in their own words', () => {
    const w = newWorld('whisperwood', walking());
    w.enemies = [];
    run(w, 70);
    const said = new Set<string>();
    for (let i = 0; i < 200 * 60 && said.size < 2; i++) {
      w.input = emptyInput();
      w.step(1 / 60);
      w.enemies = [];
      for (const s of w.story.speech) if (s.who === 'elyra') said.add(s.text);
    }
    expect(said.size).toBeGreaterThanOrEqual(1);
    for (const line of said) expect(ROAD_LINES.elyra!.early).toContain(line);
  });
});
