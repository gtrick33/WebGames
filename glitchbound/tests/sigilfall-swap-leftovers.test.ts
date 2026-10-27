import { describe, expect, it } from 'vitest';
import type { ClassId } from '../src/games/sigilfall/data/types';
import { setSkill, type Character } from '../src/games/sigilfall/progress/character';
import { tryCast } from '../src/games/sigilfall/sim/cast';
import { summonPet } from '../src/games/sigilfall/sim/pets';
import { emptyInput, type World } from '../src/games/sigilfall/sim/world';
import { newWorld, readyHero } from './sigilfall-bot';

/**
 * A playtester's warlock swapped Summon Imp for another skill and kept the imp (2026-10-27). What a skill
 * keeps going (its companions, its buff, the shape it took) now ends when the skill leaves the bar, for
 * every class; moving it to another slot or shapeshifting keeps it.
 */

const step = (w: World, seconds: number): void => {
  for (let t = 0; t < seconds; t += 1 / 60) {
    w.input = emptyInput();
    w.step(1 / 60);
  }
};

function heroWith(cls: ClassId, level: number, spec: 0 | 1 | 2, ...skills: string[]): { c: Character; w: World } {
  const c = readyHero(cls, level, 'uncommon', 7, spec);
  skills.forEach((id, slot) => expect(setSkill(c, slot as 0 | 1 | 2 | 3, id), id).toBe(true));
  const w = newWorld('whisperwood', c);
  w.enemies = [];
  return { c, w };
}

/** Casts the skill in the first slot and lets it play out. */
const castFirst = (w: World): void => {
  w.player.mana = w.player.maxMana;
  expect(tryCast(w, { slot: 's1', angle: 0, dist: null, assist: 0 })).toBeTruthy();
  step(w, 0.5);
};

/** Takes a skill off the bar the way the Skills screen does, then the game re-reads the hero. */
const takeOff = (c: Character, w: World, id: string): void => {
  expect(setSkill(c, c.skills.indexOf(id) as 0 | 1 | 2 | 3, null)).toBe(true);
  w.rebuild();
};

const alive = (w: World, pet: string): number => w.pets.filter((p) => !p.dead && p.def.id === pet).length;

describe('Sigilfall: a skill taken off the bar takes what it left behind', () => {
  it('the warlock’s imp leaves with Summon Imp, but stays when the skill only moves to another slot', () => {
    const { c, w } = heroWith('warlock', 12, 0, 'summon-imp', 'fear');
    castFirst(w);
    expect(alive(w, 'imp')).toBe(1);
    // Summon Imp moves to the second slot (the two swap): still on the bar, the imp stays
    expect(setSkill(c, 1, 'summon-imp')).toBe(true);
    w.rebuild();
    expect(alive(w, 'imp')).toBe(1);
    takeOff(c, w, 'summon-imp');
    expect(alive(w, 'imp')).toBe(0);
  });

  it('the ranger’s wolf leaves with Call Wolf', () => {
    // Call Wolf is the Beastmaster's own skill
    const { c, w } = heroWith('ranger', 12, 2, 'call-wolf');
    castFirst(w);
    expect(alive(w, 'wolf')).toBe(1);
    takeOff(c, w, 'call-wolf');
    expect(alive(w, 'wolf')).toBe(0);
  });

  it('the warrior’s War Bellow ends with the skill', () => {
    const { c, w } = heroWith('warrior', 20, 0, 'battle-shout');
    castFirst(w);
    expect(w.player.buffs.map((b) => b.def.id)).toContain('battle-shout');
    takeOff(c, w, 'battle-shout');
    expect(w.player.buffs.map((b) => b.def.id)).not.toContain('battle-shout');
  });

  it('a druid whose Bear Shape is taken off the bar turns back into themself instead of staying a bear for good', () => {
    const { c, w } = heroWith('druid', 12, 0, 'bear-form');
    w.setForm('bear');
    expect(w.player.form).toBe('bear');
    takeOff(c, w, 'bear-form');
    expect(w.player.form).toBeNull();
    expect(w.build.bar.basic).not.toBe('maul');
  });

  it('shapeshifting keeps what the hero’s other skills called, and companions from talents and items belong to no skill', () => {
    const { w } = heroWith('druid', 24, 0, 'rejuvenation', 'bear-form');
    summonPet(w, 'treant', 1, 10, 'rejuvenation');
    summonPet(w, 'treant', 1, 10);
    w.setForm('bear');
    expect(alive(w, 'treant')).toBe(2);
  });
});
