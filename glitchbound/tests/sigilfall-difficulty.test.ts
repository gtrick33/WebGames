/**
 * The campaign's difficulty (POLISH_PLAN.md piece 23): Story, Normal and Hard take every foe's health and blows with
 * them, a boss's blow's floor too, in the campaign; Heroic, Mythic, the Riftstones and a party keep their own measure.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, validateSettings } from '../src/games/sigilfall/progress/save';
import { hurtPlayer } from '../src/games/sigilfall/sim/combat';
import { bossInTheWay } from '../src/games/sigilfall/sim/objective';
import { DIFFICULTY, World } from '../src/games/sigilfall/sim/world';
import { newWorld, readyHero } from './sigilfall-bot';

function made(difficulty: 'story' | 'normal' | 'hard', tier = 0): World {
  const hero = readyHero('warrior', 20);
  if (!hero.unlocked.includes('crypt')) hero.unlocked.push('crypt');
  return new World({ region: 'whisperwood', tier, mods: [], hero, settings: { ...DEFAULT_SETTINGS, difficulty }, seed: 3 });
}

describe('Sigilfall: the campaign’s difficulty', () => {
  it('is Normal unless chosen, and a choice is kept', () => {
    expect(DEFAULT_SETTINGS.difficulty).toBe('normal');
    expect(validateSettings({ difficulty: 'story' }).difficulty).toBe('story');
    expect(validateSettings({ difficulty: 'nightmare' }).difficulty).toBe('normal');
  });

  it('takes every foe’s health and blows with it', () => {
    const foe = (w: World) => w.addEnemy('skeleton', w.player.x + 60, w.player.y, 20, { room: -1, pack: -1 });
    const normal = foe(made('normal'));
    const story = foe(made('story'));
    const hard = foe(made('hard'));
    expect(story.maxHp / normal.maxHp).toBeCloseTo(DIFFICULTY.story.hp, 2);
    expect(hard.maxHp / normal.maxHp).toBeCloseTo(DIFFICULTY.hard.hp, 2);
    expect(story.dmg / normal.dmg).toBeCloseTo(DIFFICULTY.story.dmg, 2);
    expect(hard.dmg / normal.dmg).toBeCloseTo(DIFFICULTY.hard.dmg, 2);
  });

  it('a boss’s blow’s floor comes down with Story', () => {
    const lost = (d: 'story' | 'normal'): number => {
      const w = made(d);
      const boss = w.addEnemy('skeleton', w.player.x + 40, w.player.y, 20, { room: -1, pack: -1 });
      boss.boss = { def: { id: 'test' } } as never;
      w.player.iframe = 0;
      const before = w.player.hp;
      hurtPlayer(w, 1, { source: boss, floor: 0.3 });
      return before - w.player.hp;
    };
    expect(lost('story')).toBeLessThan(lost('normal'));
  });

  it('Heroic and Mythic keep their own measure whatever is chosen', () => {
    expect(made('story', 1).measure).toEqual({ hp: 1, dmg: 1 });
    expect(made('hard', 2).measure).toEqual({ hp: 1, dmg: 1 });
    expect(made('story', 0).measure).toMatchObject({ hp: DIFFICULTY.story.hp, dmg: DIFFICULTY.story.dmg });
  });

  it('the tracker names the boss in the way: the Coffin Matron before Warden Ossric', () => {
    const hero = readyHero('warrior', 6);
    if (!hero.unlocked.includes('crypt')) hero.unlocked.push('crypt');
    const w = newWorld('crypt', hero);
    const ossric = { kind: 'boss', boss: 'ossric' };
    expect(bossInTheWay(w, ossric)).toBe('coffin-matron');
    // her room cleared, the way to Ossric is open
    for (const e of w.encounters) if (e.def.boss === 'coffin-matron') e.state = 'cleared';
    expect(bossInTheWay(w, ossric)).toBeNull();
    // and Ossric stands before Morgrave
    expect(bossInTheWay(w, { kind: 'boss', boss: 'morgrave' })).toBe('ossric');
    // nothing for a step that isn't a boss's, a boss not in this dungeon, or out of a dungeon
    expect(bossInTheWay(w, { kind: 'kill', boss: undefined })).toBeNull();
    expect(bossInTheWay(w, { kind: 'boss', boss: 'grimtusk' })).toBeNull();
    expect(bossInTheWay(newWorld('briarhollow', hero), ossric)).toBeNull();
  });

  it('a run played on Story stays off the leaderboard, even if it ends on another', () => {
    // (the engine can't be made in a test without a page: what it does is held by its text)
    const engine = readFileSync('src/games/sigilfall/engine.ts', 'utf8');
    expect(engine).toContain("...(this.settings.difficulty === 'story' ? { story: true } : {})");
    expect(engine).toContain("if (this.run && this.save.settings.difficulty === 'story') this.run.story = true;");
    expect(engine).toContain("if (!this.hero.review && !this.trial && !this.run.story && this.settings.difficulty !== 'story') this.host.report(");
  });
});
