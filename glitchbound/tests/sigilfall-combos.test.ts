/**
 * Every specialization's combo (data/types.ts SpecDef.combo): the one thing its skills do together. Each of the 24
 * exists and names only skills and companions its class has; and the three things combos are made of work on the
 * simulation: a cast that another skill has set up (stronger, free, ready, with no cast time), charges that build
 * and are spent whole, and a blow that sets off a burn or a bleed that was already there.
 */
import { describe, expect, it } from 'vitest';
import { CLASS_IDS, CLASSES, KITS } from '../src/games/sigilfall/data/classes';
import { next, stack } from '../src/games/sigilfall/data/kits/kit';
import { PETS } from '../src/games/sigilfall/data/pets';
import { SKILLS } from '../src/games/sigilfall/data/skills';
import type { ClassId, Mod } from '../src/games/sigilfall/data/types';
import { setSkill, type Character } from '../src/games/sigilfall/progress/character';
import { castTimeOf, skillCost, tryCast } from '../src/games/sigilfall/sim/cast';
import { addBuff, applyEffect, applyStatus, effStats, empowerFull, empowerOf } from '../src/games/sigilfall/sim/combat';
import { emptyInput, type World } from '../src/games/sigilfall/sim/world';
import { comboNow } from '../src/games/sigilfall/ui/comboMark';
import { newWorld, readyHero } from './sigilfall-bot';

const step = (w: World, seconds: number): void => {
  for (let t = 0; t < seconds; t += 1 / 60) {
    w.input = emptyInput();
    w.step(1 / 60);
  }
};

function heroWith(cls: ClassId, skill: string, spec: 0 | 1 | 2 = 0): World {
  const c: Character = readyHero(cls, 50, 'uncommon', 7, spec);
  expect(setSkill(c, 0, skill), skill).toBe(true);
  const w = newWorld('whisperwood', c);
  w.enemies = [];
  w.player.mana = w.player.maxMana;
  // (past the moment's grace on arriving)
  step(w, 0.8);
  w.enemies = [];
  return w;
}

function target(w: World, dx: number, hp = 1e6) {
  const e = w.addEnemy('moss-slime', w.player.x + dx, w.player.y, 30, { room: -1, pack: 0 });
  e.hp = e.maxHp = hp;
  e.state = 'chase';
  e.aggro = true;
  return e;
}

const cast = (w: World): boolean => tryCast(w, { slot: 's1', angle: 0, dist: 0.5, assist: 0 });

describe('Sigilfall: every specialization has a combo', () => {
  it('all 24, each named, said in words, and made only of what its class has', () => {
    let n = 0;
    for (const cls of CLASS_IDS) {
      const mine = new Set(KITS[cls].skills.map((s) => s.id));
      for (const tree of CLASSES[cls].trees) {
        const c = tree.combo;
        expect(c, `${cls} ${tree.name}`).toBeTruthy();
        n++;
        expect(c!.name.length, `${cls} ${tree.name}`).toBeGreaterThan(2);
        expect(c!.text.length, `${cls} ${tree.name}`).toBeGreaterThan(30);
        const procs = c!.mods.filter((m): m is Extract<Mod, { t: 'proc' }> => m.t === 'proc').map((m) => m.proc);
        expect(procs.length, `${cls} ${tree.name}`).toBeGreaterThan(0);
        for (const p of procs) {
          expect(p.id.startsWith('combo-'), p.id).toBe(true);
          if (p.skill) expect(mine.has(p.skill), `${cls} ${tree.name}: ${p.skill}`).toBe(true);
          const e = p.effect;
          if (e.kind === 'buff' && e.buff.empower) expect(mine.has(e.buff.empower.skill), `${cls} ${tree.name}: ${e.buff.empower.skill}`).toBe(true);
          if (e.kind === 'summon') expect(PETS[e.pet], e.pet).toBeTruthy();
        }
      }
    }
    expect(n).toBe(24);
  });

  it('no two combos share a name, and none is the name of a skill', () => {
    const names = CLASS_IDS.flatMap((cls) => CLASSES[cls].trees.map((t) => t.combo!.name));
    expect(new Set(names).size).toBe(names.length);
    const skills = new Set(Object.values(SKILLS).map((s) => s.name));
    for (const n of names) expect(skills.has(n), n).toBe(false);
  });

  it('a hero has their specialization’s combo and only that one', () => {
    for (const spec of [0, 1, 2] as const) {
      const w = newWorld('whisperwood', readyHero('mage', 30, 'uncommon', 7, spec));
      const ids = w.build.procs.filter((p) => p.id.startsWith('combo-')).map((p) => p.id);
      const want = CLASSES.mage.trees[spec]!.combo!.mods.filter((m) => m.t === 'proc').map((m) => (m as Extract<Mod, { t: 'proc' }>).proc.id);
      expect(ids.sort()).toEqual(want.sort());
    }
  });
});

describe('Sigilfall: what combos are made of', () => {
  it('a set-up cast is ready at once, free and stronger, and the cast uses it up', () => {
    const w = heroWith('warrior', 'heavy-strike', 0);
    // (no critical hits: none of the hero's own procs get a say)
    w.build.stats.crit = 0;
    const e = target(w, 24);
    expect(cast(w)).toBe(true);
    step(w, 0.5);
    // (on cooldown now)
    expect(w.player.cds.s1.charges).toBe(0);
    const spec = w.build.skills['heavy-strike']!.spec;
    w.player.mana = 0;
    expect(skillCost(w, spec, 's1')).toBeGreaterThan(0);
    addBuff(w, next('t', 'Test', '#fff', 'heavy-strike', 8, { pct: 50, free: true, ready: true }));
    expect(w.player.cds.s1.charges).toBe(1);
    expect(skillCost(w, spec, 's1')).toBe(0);
    expect(empowerFull(empowerOf(w, 'heavy-strike')!)).toBe(true);
    expect(comboNow(w)?.name).toBe('Test');
    const before = e.hp;
    expect(cast(w)).toBe(true);
    step(w, 0.6);
    expect(empowerOf(w, 'heavy-strike')).toBeNull();
    expect(e.hp).toBeLessThan(before);
    expect(comboNow(w)).toBeNull();
  });

  it('a stronger cast hits harder than a plain one', () => {
    const hit = (boost: boolean): number => {
      const w = heroWith('warrior', 'heavy-strike', 1);
      // (no critical hits: the same blow both times)
      w.build.stats.crit = 0;
      const e = target(w, 24);
      if (boost) addBuff(w, next('t', 'Test', '#fff', 'heavy-strike', 8, { pct: 100 }));
      const before = e.hp;
      expect(cast(w)).toBe(true);
      step(w, 0.6);
      return before - e.hp;
    };
    const plain = hit(false);
    const strong = hit(true);
    expect(plain).toBeGreaterThan(0);
    expect(strong / plain).toBeGreaterThan(1.8);
    expect(strong / plain).toBeLessThan(2.2);
  });

  it('charges build to their limit, a cast takes them all, and a spell is instant only when they are whole', () => {
    const w = heroWith('warlock', 'chaos-bolt', 2);
    const buff = next('c', 'Test Cinders', '#f80', 'chaos-bolt', 10, { pct: 10, instant: true }, 5);
    for (let i = 0; i < 3; i++) addBuff(w, buff);
    expect(empowerOf(w, 'chaos-bolt')!.n).toBe(3);
    expect(empowerFull(empowerOf(w, 'chaos-bolt')!)).toBe(false);
    expect(castTimeOf(w.build.skills['chaos-bolt']!.spec)).toBeGreaterThan(0);
    for (let i = 0; i < 6; i++) addBuff(w, buff);
    expect(empowerOf(w, 'chaos-bolt')!.n).toBe(5);
    target(w, 60);
    expect(cast(w)).toBe(true);
    // (whole: no cast bar at all, and the charges are gone)
    expect(w.player.casting).toBeFalsy();
    expect(empowerOf(w, 'chaos-bolt')).toBeNull();
  });

  it('a combo for several casts lasts that many', () => {
    const w = heroWith('druid', 'starsurge', 0);
    addBuff(w, next('f', 'Test Light', '#aaf', 'wrath', 8, { pct: 40, casts: 3 }));
    target(w, 60);
    for (let i = 0; i < 3; i++) {
      expect(empowerOf(w, 'wrath'), `cast ${i}`).not.toBeNull();
      expect(tryCast(w, { slot: 'basic', angle: 0, dist: 0.5, assist: 0 })).toBe(true);
      step(w, 0.6);
    }
    expect(empowerOf(w, 'wrath')).toBeNull();
  });

  it('a state on the hero stacks to its limit and counts once a stack', () => {
    const w = heroWith('paladin', 'shield-of-the-righteous', 1);
    const armor = effStats(w).armor;
    const buff = stack('u', 'Test Unbroken', '#8af', 8, 5, { armor: 6 });
    for (let i = 0; i < 8; i++) addBuff(w, buff);
    expect(effStats(w).armor).toBe(armor + 30);
    expect(comboNow(w)).toMatchObject({ n: 5, of: 5 });
    step(w, 8.5);
    expect(effStats(w).armor).toBe(armor);
  });

  it('a blow sets off a burn that was already there, at once and whole, and not one it has only just lit', () => {
    const w = heroWith('mage', 'fireball', 0);
    const e = target(w, 60);
    applyStatus(w, e, { status: 'burn', dur: 4, power: 1 }, 100);
    // (the same moment: nothing to set off yet)
    const ctx = { x: e.x, y: e.y, angle: 0, spec: null, base: 10, type: 'fire' as const, depth: 0, target: e, hitDmg: 10, when: 'proc' as const };
    applyEffect(w, { kind: 'detonate', status: 'burn', mul: 1.5 }, ctx);
    expect(e.statuses.some((s) => s.id === 'burn')).toBe(true);
    step(w, 0.2);
    const before = e.hp;
    applyEffect(w, { kind: 'detonate', status: 'burn', mul: 1.5 }, ctx);
    expect(e.statuses.some((s) => s.id === 'burn')).toBe(false);
    // (about 100 a second for what was left of 4 s, half again: well over 400)
    expect(before - e.hp).toBeGreaterThan(400);
  });
});

describe('Sigilfall: the combos in play', () => {
  it('Pyromancer: a Fireball into a Burning enemy sets the fire off', () => {
    const w = heroWith('mage', 'fireball', 0);
    const e = target(w, 60);
    applyStatus(w, e, { status: 'burn', dur: 4, power: 1 }, 200);
    step(w, 0.1);
    expect(cast(w)).toBe(true);
    step(w, 1);
    // (the old burn is gone; a talent may have lit a new one, which is younger)
    expect(e.statuses.filter((s) => s.id === 'burn' && (s.born ?? 0) < 1).length).toBe(0);
  });

  it('Stormcaller: Arcane Bolts build Charge for Chain Lightning', () => {
    const w = heroWith('mage', 'chain-lightning', 1);
    target(w, 60);
    for (let i = 0; i < 8; i++) {
      tryCast(w, { slot: 'basic', angle: 0, dist: 0.5, assist: 0 });
      step(w, 0.5);
    }
    const c = empowerOf(w, 'chain-lightning');
    expect(c).not.toBeNull();
    expect(c!.n).toBeGreaterThanOrEqual(3);
  });

  it('Guardian: Shield Bash sets up a Heavy Strike', () => {
    const c: Character = readyHero('warrior', 50, 'uncommon', 7, 1);
    expect(setSkill(c, 0, 'shield-bash')).toBe(true);
    expect(setSkill(c, 1, 'heavy-strike')).toBe(true);
    const w = newWorld('whisperwood', c);
    w.enemies = [];
    step(w, 0.8);
    w.enemies = [];
    w.player.mana = w.player.maxMana;
    target(w, 30);
    expect(tryCast(w, { slot: 's1', angle: 0, dist: 0.5, assist: 0 })).toBe(true);
    step(w, 0.6);
    expect(empowerOf(w, 'heavy-strike')).not.toBeNull();
  });

  it('Beastmaster: a kill calls a wolf', () => {
    const w = heroWith('ranger', 'piercing-arrow', 2);
    const pets = w.pets.length;
    target(w, 50, 1);
    for (let i = 0; i < 4 && w.pets.length === pets; i++) {
      tryCast(w, { slot: 'basic', angle: 0, dist: 0.5, assist: 0 });
      step(w, 0.5);
    }
    expect(w.pets.length).toBeGreaterThan(pets);
  });
});
