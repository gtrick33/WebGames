/**
 * The campaign's combat made like the Ring's (2026-11-19, the owner: "make the spells and specs very similar to the
 * ring's - combos, ults, casting while moving"):
 *
 * - a combo blow (data/types.ts ComboSpec) lands many times as hard on a target another skill set up, says its name,
 *   and with `consume` takes what it needed off; a boss, which takes a stun as a short slow, counts as held a moment;
 * - a specialization's points (PointsDef) are built a cast at a time as the cast lands, all spent by one skill, and
 *   fade after a fight;
 * - a spell with a cast time gathers on the move, the hero slowed to CAST_SLOW (or not at all with a swift skill);
 * - every specialization carries its own ultimate once chosen, and the class's before;
 * - a buff that lasts (`keep`) makes every cast of its skill stronger while it is up.
 */
import { describe, expect, it } from 'vitest';
import { next } from '../src/games/sigilfall/data/kits/kit';
import type { ClassId } from '../src/games/sigilfall/data/types';
import { buildHero } from '../src/games/sigilfall/progress/build';
import { setSkill, type Character } from '../src/games/sigilfall/progress/character';
import { CAST_SLOW, castPace, execute, tryCast } from '../src/games/sigilfall/sim/cast';
import { addBuff, applyStatus, BOSS_HELD, comboMet, empowerOf, gainPoints, hitEnemy, spendEmpower } from '../src/games/sigilfall/sim/combat';
import { emptyInput, POINTS_FADE, type World } from '../src/games/sigilfall/sim/world';
import { newWorld, readyHero } from './sigilfall-bot';

const step = (w: World, seconds: number, input?: Partial<ReturnType<typeof emptyInput>>): void => {
  for (let t = 0; t < seconds; t += 1 / 60) {
    w.input = { ...emptyInput(), ...input };
    w.step(1 / 60);
  }
};

function heroWith(cls: ClassId, skills: string[], spec: 0 | 1 | 2, level = 40): World {
  const c: Character = readyHero(cls, level, 'uncommon', 7, spec);
  c.talents = {};
  skills.forEach((id, i) => expect(setSkill(c, i as 0 | 1 | 2 | 3, id), id).toBe(true));
  const w = newWorld('whisperwood', c);
  w.player.mana = w.player.maxMana;
  w.enemies = [];
  step(w, 0.8);
  w.enemies = [];
  w.build.stats.crit = 0;
  return w;
}

function target(w: World, dx: number, hp = 1e6) {
  const e = w.addEnemy('moss-slime', w.player.x + dx, w.player.y, 30, { room: -1, pack: 0 });
  e.hp = e.maxHp = hp;
  e.state = 'chase';
  e.aggro = true;
  return e;
}

describe('Sigilfall: combo blows', () => {
  it('a Guardian’s Heavy Strike lands twice as hard on a stunned enemy, and says so', () => {
    const blow = (stunned: boolean): { dealt: number; combos: number } => {
      const w = heroWith('warrior', ['heavy-strike'], 1);
      const e = target(w, 24);
      if (stunned) applyStatus(w, e, { status: 'stun', dur: 3, power: 1 }, 0);
      const before = e.hp;
      expect(tryCast(w, { slot: 's1', angle: 0, dist: 0.5, assist: 0 })).toBe(true);
      step(w, 0.6);
      return { dealt: before - e.hp, combos: w.combos };
    };
    const plain = blow(false);
    const combo = blow(true);
    expect(plain.combos).toBe(0);
    expect(combo.combos).toBe(1);
    expect(combo.dealt / plain.dealt).toBeGreaterThan(1.9);
    expect(combo.dealt / plain.dealt).toBeLessThan(2.1);
  });

  it('a boss takes a stun as a slow, and counts as held for a moment after it', () => {
    const w = heroWith('warrior', ['heavy-strike'], 1);
    const e = target(w, 24);
    e.boss = { phase: 0 } as never;
    applyStatus(w, e, { status: 'stun', dur: 1, power: 1 }, 0);
    expect(e.statuses.some((s) => s.id === 'stun')).toBe(false);
    expect(comboMet(e, ['held'], w.time)).toBe(true);
    expect(comboMet(e, ['held'], w.time + BOSS_HELD + 0.01)).toBe(false);
  });

  it('a combo that consumes takes what it needed off the target', () => {
    const w = heroWith('warrior', ['heavy-strike'], 1);
    const e = target(w, 24);
    applyStatus(w, e, { status: 'chill', dur: 5, power: 0.3 }, 0);
    const spec = { ...w.build.skills['heavy-strike']!.spec, combo: { name: 'Test', vs: ['chill' as const], mult: 2, consume: true } };
    hitEnemy(w, e, 10, 'physical', { spec, depth: 0 });
    expect(w.combos).toBe(1);
    expect(e.statuses.some((s) => s.id === 'chill')).toBe(false);
  });
});

describe('Sigilfall: a specialization’s points', () => {
  it('a Berserker’s Cleave builds Fury as it lands, and Blood Hunger spends it all for a heavier blow', () => {
    const w = heroWith('warrior', ['bloodthirst'], 0);
    expect(w.build.points?.name).toBe('Fury');
    const e = target(w, 20);
    // a swing at nothing builds nothing
    w.enemies = [];
    execute(w, 'basic', w.build.skills.cleave!.spec, Math.PI, w.player.x - 20, w.player.y, null);
    step(w, 0.1);
    expect(w.player.points).toBe(0);
    w.enemies = [e];
    for (let i = 0; i < 4; i++) {
      execute(w, 'basic', w.build.skills.cleave!.spec, 0, e.x, e.y, null);
      step(w, 0.05);
    }
    expect(w.player.points).toBe(4);
    for (let i = 0; i < 4; i++) gainPoints(w, 1);
    expect(w.player.points).toBe(5);
    const full = w.build.skills.bloodthirst!.spec;
    const before = e.hp;
    execute(w, 's1', full, 0, e.x, e.y, null);
    step(w, 0.05);
    const strong = before - e.hp;
    expect(w.player.points).toBe(0);
    const mid = e.hp;
    execute(w, 's1', full, 0, e.x, e.y, null);
    step(w, 0.05);
    const plain = mid - e.hp;
    // (five points, 20% each: twice as hard)
    expect(strong / plain).toBeGreaterThan(1.9);
    expect(strong / plain).toBeLessThan(2.1);
  });

  it('points fade a while after the fight', () => {
    const w = heroWith('warrior', ['bloodthirst'], 0);
    gainPoints(w, 3);
    w.player.calm = POINTS_FADE + 1;
    step(w, 6);
    expect(w.player.points).toBe(0);
  });

  it('a specialization whose bar builds nothing shows no points', () => {
    const w = heroWith('warrior', ['heavy-strike'], 1);
    expect(w.build.points).toBeNull();
  });
});

describe('Sigilfall: casting on the move', () => {
  it('a cast goes on while the hero walks, at a slowed pace, and goes off', () => {
    const w = heroWith('mage', ['flamestrike'], 0);
    target(w, 90);
    expect(tryCast(w, { slot: 's1', angle: 0, dist: 0.5, assist: 0 })).toBe(true);
    const c = w.player.casting;
    expect(c).toBeTruthy();
    expect(castPace(c)).toBe(CAST_SLOW);
    const y0 = w.player.y;
    step(w, 0.3, { my: 1 });
    expect(w.player.casting).toBeTruthy();
    expect(w.player.y).toBeGreaterThan(y0);
    step(w, c!.total, { my: 1 });
    expect(w.player.casting).toBeNull();
    expect(w.castEnd?.fired).toBe(true);
  });

  it('a swift skill is cast at full pace', () => {
    const w = heroWith('mage', ['flamestrike'], 0);
    const spec = { ...w.build.skills.flamestrike!.spec, extra: { ...w.build.skills.flamestrike!.spec.extra, swift: 1 } };
    expect(castPace({ spec })).toBe(1);
  });
});

describe('Sigilfall: a specialization’s own ultimate', () => {
  it('before a specialization the class’s, after it the specialization’s', () => {
    const young = readyHero('warrior', 9, 'uncommon', 7, 0);
    expect(buildHero(young).bar.ult).toBe('earthsplitter');
    expect(buildHero(readyHero('warrior', 20, 'uncommon', 7, 0)).bar.ult).toBe('red-tempest');
    expect(buildHero(readyHero('warrior', 20, 'uncommon', 7, 1)).bar.ult).toBe('earthsplitter');
    expect(buildHero(readyHero('warrior', 20, 'uncommon', 7, 2)).bar.ult).toBe('thousand-cuts');
  });
});

describe('Sigilfall: a buff that lasts', () => {
  it('every cast of its skill takes it while it is up', () => {
    const w = heroWith('warrior', ['heavy-strike'], 1);
    addBuff(w, { ...next('aura', 'Aura', '#fff', 'heavy-strike', 6, { pct: 50 }), empower: { skill: 'heavy-strike', pct: 50, keep: true } });
    spendEmpower(w, 'heavy-strike');
    spendEmpower(w, 'heavy-strike');
    expect(empowerOf(w, 'heavy-strike')).not.toBeNull();
    step(w, 6.1);
    expect(empowerOf(w, 'heavy-strike')).toBeNull();
  });
});
