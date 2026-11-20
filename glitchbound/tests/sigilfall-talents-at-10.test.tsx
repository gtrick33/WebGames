import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { xpToNext } from '../src/games/sigilfall/data/classes';
import { SPEC_LEVEL } from '../src/games/sigilfall/data/talents';
import type { SigilEngine } from '../src/games/sigilfall/engine';
import { cantLearn, freePoints, newCharacter, talentPoints } from '../src/games/sigilfall/progress/character';
import { LevelUpBanner } from '../src/games/sigilfall/ui/GameScreen';
import { newWorld } from './sigilfall-bot';

/**
 * Talents start at level 10 (the owner, 2026-10-27: "dont get talents before lvl 10"). The rules always
 * gave the first point at 10, but every level-up from 2 said "+1 talent point" and level 2 said "You have a
 * talent point": a new hero seemed to be piling up talents they could not use.
 */

vi.mock('../src/games/sigilfall/render/sprites', () => ({ skillIconUrl: () => '' }));
vi.mock('../src/games/sigilfall/ui/uiIcons', () => ({ uiIcon: () => '' }));
afterEach(cleanup);

describe('Sigilfall: talents start at level 10', () => {
  it('no point before level 10, one a level from 10 (51 at 60)', () => {
    const hero = newCharacter('mage', 'Test', 'hero0', 1);
    for (let level = 1; level < SPEC_LEVEL; level++) {
      hero.level = level;
      expect(talentPoints(hero), `level ${level}`).toBe(0);
      expect(freePoints(hero)).toBe(0);
    }
    hero.level = SPEC_LEVEL;
    expect(talentPoints(hero)).toBe(1);
    hero.level = 60;
    expect(talentPoints(hero)).toBe(51);
    hero.level = 5;
    expect(cantLearn(hero, Object.keys(hero.talents)[0] ?? 'none')).toBeTruthy();
  });

  it('the talent tip comes when talents open at 10, not at level 2', () => {
    const world = newWorld('whisperwood', newCharacter('ranger', 'Test', 'hero0', 1));
    const tips = (): string[] => world.events.flatMap((e) => (e.t === 'hint' ? [e.id] : []));
    while (world.hero.level < SPEC_LEVEL - 1) world.giveXp(xpToNext(world.hero.level));
    expect(tips()).not.toContain('spec');
    world.giveXp(xpToNext(world.hero.level));
    expect(world.hero.level).toBe(SPEC_LEVEL);
    expect(tips().filter((id) => id === 'spec')).toHaveLength(1);
  });

  it('a level-up promises a talent point only from level 10', () => {
    const say = (level: number, skills: string[] = []): string => {
      const engine = { ui: { levelUp: { level, skills, id: level } } } as unknown as SigilEngine;
      const view = render(<LevelUpBanner engine={engine} />);
      const text = view.container.textContent ?? '';
      view.unmount();
      return text;
    };
    // (skill slots open at 2, 6 and 12: progress/character.ts SLOT_LEVELS; "Level up" stands over every one)
    expect(say(2)).toBe('Level upLevel 2New skill slot');
    expect(say(3)).toBe('Level upLevel 3More health');
    expect(say(4, ['chain-lightning'])).toBe('Level upLevel 4New: Chain Lightning');
    expect(say(6)).toBe('Level upLevel 6New skill slot');
    expect(say(SPEC_LEVEL)).toBe('Level upLevel 10Talents open: choose your specialization');
    expect(say(11)).toBe('Level upLevel 11+1 talent point');
    for (let level = 2; level < SPEC_LEVEL; level++) expect(say(level)).not.toMatch(/talent/i);
  });
});
