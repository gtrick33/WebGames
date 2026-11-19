/**
 * Loot (POLISH_PLAN.md piece 22): the story's rolled rewards have names of their own, shown on the quest's page and
 * given to the piece; a piece on the ground stands in a beam that grows with its rarity, and is heard by it.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ITEM_DEFS } from '../src/games/sigilfall/data/items';
import { QUEST_DEFS, QUESTS } from '../src/games/sigilfall/data/quests';
import { RARITIES } from '../src/games/sigilfall/data/types';
import { SAMPLES } from '../src/games/sigilfall/audio/samples';
import { isMainQuest } from '../src/games/sigilfall/progress/handin';
import { itemName } from '../src/games/sigilfall/progress/items';
import { questRewards } from '../src/games/sigilfall/progress/rewards';
import { validateItem } from '../src/games/sigilfall/progress/save';
import { BEAM_TALL } from '../src/games/sigilfall/render/effects';
import { newWorld, readyHero } from './sigilfall-bot';

const rolled = (q: (typeof QUESTS)[number]): { rarity: string; name?: string } | null => (q.reward.item && typeof q.reward.item === 'object' ? q.reward.item : null);

describe('Sigilfall: the story’s rewards have names', () => {
  it('every rare or uncommon piece the main story rolls has a name of its own, each name once', () => {
    const names: string[] = [];
    for (const q of QUESTS) {
      const it = rolled(q);
      if (!it || !isMainQuest(q.id) || (it.rarity !== 'rare' && it.rarity !== 'uncommon')) continue;
      expect(it.name, q.id).toBeTruthy();
      expect(it.name!.length, q.id).toBeLessThanOrEqual(48);
      // (not the name of a hand-made piece: two things in the bag by one name)
      expect(Object.values(ITEM_DEFS).some((d) => d.name === it.name), q.id).toBe(false);
      names.push(it.name!);
    }
    expect(names.length).toBeGreaterThan(15);
    expect(new Set(names).size).toBe(names.length);
  });

  it('the quest’s page says the name, and the piece given carries it, through a save', () => {
    const q = QUEST_DEFS['briar-hold-the-door']!;
    const hero = readyHero('warrior', 4);
    const line = questRewards(hero, q).find((l) => l.kind === 'item')!;
    expect(line.text).toBe('Promise of the Held Door, a rare piece for your class');
    hero.bag = [];
    const w = newWorld('briarhollow', hero);
    w.completeQuests([q]);
    const got = hero.bag.find((i) => itemName(i) === 'Promise of the Held Door');
    expect(got, hero.bag.map(itemName).join(', ')).toBeTruthy();
    expect(itemName(validateItem(JSON.parse(JSON.stringify(got)))!)).toBe('Promise of the Held Door');
  });
});

describe('Sigilfall: a piece on the ground by its rarity', () => {
  it('stands in a taller beam the rarer it is, and the rare and better are heard as they fall', () => {
    const tall = RARITIES.map((r) => BEAM_TALL[r]!);
    for (let i = 1; i < tall.length; i++) expect(tall[i]!, RARITIES[i]).toBeGreaterThan(tall[i - 1]!);
    for (const r of ['rare', 'epic', 'legendary']) expect(SAMPLES[r], r).toBeTruthy();
    const world = readFileSync('src/games/sigilfall/sim/world.ts', 'utf8');
    expect(world).toContain("else if (item.r === 'rare') this.sfx('rare');");
  });
});
