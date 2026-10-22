import { describe, expect, it } from 'vitest';
import { CLASSES } from '../src/games/sigilfall/data/classes';
import { PETS } from '../src/games/sigilfall/data/pets';
import type { ClassId } from '../src/games/sigilfall/data/types';
import { learnedSkills, newCharacter, setSkill, type Character } from '../src/games/sigilfall/progress/character';
import { migrate, SAVE_VERSION } from '../src/games/sigilfall/progress/save';
import { tryCast } from '../src/games/sigilfall/sim/cast';
import { applyStatus, hurtPlayer } from '../src/games/sigilfall/sim/combat';
import { summonPet } from '../src/games/sigilfall/sim/pets';
import { emptyInput, type World } from '../src/games/sigilfall/sim/world';
import { newWorld, readyHero } from './sigilfall-bot';

/** Steps the world; `each` runs before every frame (to hold a state still, like being in combat). */
const step = (w: World, seconds: number, each?: (w: World) => void) => {
  for (let t = 0; t < seconds; t += 1 / 60) {
    each?.(w);
    w.input = emptyInput();
    w.step(1 / 60);
  }
};

/** A hero with one skill in the first slot, in the Whisperwood, alone. */
function heroWith(cls: ClassId, level: number, skill: string, spec: 0 | 1 | 2 = 0): World {
  const c: Character = readyHero(cls, level, 'uncommon', 7, spec);
  expect(setSkill(c, 0, skill), `${skill} is learned at ${level}`).toBe(true);
  const w = newWorld('whisperwood', c);
  w.enemies = [];
  return w;
}

/** A practice target that won't die. */
function target(w: World, dx: number, dy = 0) {
  const e = w.addEnemy('moss-slime', w.player.x + dx, w.player.y + dy, 3, { room: -1, pack: 0 });
  e.hp = e.maxHp = 1e6;
  e.state = 'chase';
  e.aggro = true;
  return e;
}

const cast = (w: World, slot: 'basic' | 's1', angle = 0) => tryCast(w, { slot, angle, dist: null, assist: 0 });
const inCombat = (w: World) => {
  w.player.calm = 0;
};

describe('sigilfall saves from before the specializations', () => {
  it('a version 1 hero keeps everything but gets their talent points back, with no specialization yet', () => {
    const hero = JSON.parse(JSON.stringify({ ...newCharacter('mage', 'Old', 'old', 0), level: 20, gold: 77 })) as Record<string, unknown>;
    delete hero.spec;
    hero.talents = { kindling: 3, conduction: 2 };
    const save = migrate({ v: 1, heroes: [hero, null, null], last: 0, settings: {}, saved: 5 })!;
    expect(save.v).toBe(SAVE_VERSION);
    const h = save.heroes[0]!;
    expect(h.level).toBe(20);
    expect(h.gold).toBe(77);
    expect(h.talents).toEqual({});
    expect(h.spec).toBeNull();
  });
});

describe('sigilfall holy power', () => {
  it('builds a point per landed strike, is spent in whole points by finishers, and fades after the fight', () => {
    const w = heroWith('paladin', 12, 'divine-storm');
    const p = w.player;
    expect(w.build.resource?.kind).toBe('holy');
    expect(p.maxMana).toBe(5);
    expect(p.mana).toBe(0);
    // a swing at nothing gives nothing; one that lands gives a point
    p.aim = Math.PI;
    expect(cast(w, 'basic', Math.PI)).toBe(true);
    expect(p.mana).toBe(0);
    target(w, 14);
    p.cds.basic.charges = p.cds.basic.max;
    expect(cast(w, 'basic', 0)).toBe(true);
    expect(p.mana).toBe(1);
    // Divine Storm costs 3
    p.mana = 2.9;
    expect(cast(w, 's1')).toBe(false);
    p.mana = 3;
    expect(cast(w, 's1')).toBe(true);
    expect(p.mana).toBe(0);
    // out of the fight it fades
    p.mana = 4;
    w.enemies = [];
    p.calm = 10;
    step(w, 4);
    expect(p.mana).toBeLessThan(4);
  });
});

describe('sigilfall drains, buffs and heals over time', () => {
  it('Drain Life hurts its target and heals the warlock while it channels', () => {
    const run = (drain: boolean) => {
      const w = heroWith('warlock', 8, 'drain-life');
      const e = target(w, 40);
      w.player.hp = w.player.maxHp * 0.5;
      if (drain) expect(cast(w, 's1')).toBe(true);
      step(w, 3, (x) => {
        inCombat(x);
        x.player.iframe = 1;
      });
      return { hp: w.player.hp / w.player.maxHp, lost: e.maxHp - e.hp };
    };
    const still = run(false);
    const drained = run(true);
    expect(drained.lost).toBeGreaterThan(still.lost);
    expect(drained.hp).toBeGreaterThan(still.hp + 0.05);
  });

  it('Renew heals over its duration, on top of in-combat regeneration', () => {
    const run = (renew: boolean) => {
      const w = heroWith('priest', 14, 'renew');
      w.player.hp = w.player.maxHp * 0.3;
      if (renew) expect(cast(w, 's1')).toBe(true);
      step(w, 9, inCombat);
      return w.player.hp / w.player.maxHp;
    };
    const plain = run(false);
    const renewed = run(true);
    // 3% a second for 8 seconds, raised by the hero's healing bonus
    expect(renewed - plain).toBeGreaterThan(0.2);
    expect(renewed - plain).toBeLessThan(0.45);
  });

  it('Shield Wall halves the damage the warrior takes while it lasts', () => {
    const taken = (wall: boolean) => {
      const w = heroWith('warrior', 12, 'shield-wall', 1);
      const p = w.player;
      p.mana = p.maxMana;
      if (wall) {
        expect(cast(w, 's1')).toBe(true);
        expect(p.buffs.map((b) => b.def.id)).toContain('shield-wall');
      }
      p.iframe = 0;
      const before = p.hp;
      hurtPlayer(w, 100, {});
      return before - p.hp;
    };
    const plain = taken(false);
    const walled = taken(true);
    expect(walled / plain).toBeGreaterThan(0.4);
    expect(walled / plain).toBeLessThan(0.6);
  });
});

describe('sigilfall companions', () => {
  it('a demon on the bar comes along, stays, and calling it again heals it instead of adding another', () => {
    const w = heroWith('warlock', 8, 'summon-imp');
    // it is already there when the hero arrives
    expect(w.pets).toHaveLength(1);
    w.pets = [];
    expect(cast(w, 's1')).toBe(true);
    expect(w.pets).toHaveLength(1);
    const imp = w.pets[0]!;
    expect(imp.def.id).toBe('imp');
    expect(imp.life).toBe(Infinity);
    expect(imp.maxHp).toBe(Math.round(w.player.maxHp * PETS.imp!.hp * (1 + (w.build.stats.pet ?? 0) / 100)));
    imp.hp = 1;
    w.player.cds.s1.charges = w.player.cds.s1.max;
    w.player.mana = w.player.maxMana;
    expect(cast(w, 's1')).toBe(true);
    expect(w.pets).toHaveLength(1);
    expect(imp.hp).toBe(imp.maxHp);
  });

  it('enemies go for a taunting pet near them instead of the hero, and the pet takes the blows', () => {
    const w = heroWith('warlock', 8, 'fear');
    const p = w.player;
    summonPet(w, 'voidwalker', 1, 0);
    const vw = w.pets[0]!;
    vw.x = p.x + 60;
    vw.y = p.y;
    const e = target(w, 80);
    step(w, 0.2);
    expect(e.victim).toBe(vw.id);
    step(w, 4);
    expect(vw.hp).toBeLessThan(vw.maxHp);
    expect(p.hp).toBe(p.maxHp);
  });

  it('temporary companions leave when their time is up', () => {
    const w = heroWith('druid', 8, 'moonfire');
    summonPet(w, 'treant', 2, 1);
    expect(w.pets.filter((x) => !x.dead)).toHaveLength(2);
    step(w, 1.8);
    expect(w.pets).toHaveLength(0);
  });
});

describe('sigilfall fear', () => {
  it('a feared enemy runs from the hero; a boss is only slowed', () => {
    const w = heroWith('warlock', 8, 'fear');
    const p = w.player;
    const e = target(w, 30);
    applyStatus(w, e, { status: 'fear', dur: 3, power: 1 }, 0);
    const d0 = Math.hypot(e.x - p.x, e.y - p.y);
    step(w, 1);
    expect(Math.hypot(e.x - p.x, e.y - p.y)).toBeGreaterThan(d0 + 15);
    expect(p.hp).toBe(p.maxHp);
    // bosses shrug it off into a short slow
    const boss = target(w, -30);
    boss.boss = { ...(boss.boss as object) } as NonNullable<typeof boss.boss>;
    applyStatus(w, boss, { status: 'fear', dur: 3, power: 1 }, 0);
    expect(boss.statuses.some((s) => s.id === 'fear')).toBe(false);
    expect(boss.statuses.some((s) => s.id === 'chill')).toBe(true);
  });
});

describe('sigilfall druid forms', () => {
  it('Cat Form swaps the bar for claws and back again; Bear Form adds health', () => {
    const w = heroWith('druid', 8, 'cat-form');
    const p = w.player;
    const plainHp = p.maxHp;
    const plainSpeed = w.build.stats.speed;
    expect(w.build.bar.basic).toBe('wrath');
    expect(cast(w, 's1')).toBe(true);
    expect(p.form).toBe('cat');
    expect(w.build.bar.basic).toBe('claw');
    expect(w.build.bar.dodge).toBe('pounce');
    expect(w.build.bar.s1).toBe('cat-form');
    expect([w.build.bar.s2, w.build.bar.s3]).toEqual(['rake', 'ferocious-bite']);
    expect(w.build.stats.speed).toBe(plainSpeed + CLASSES.druid.forms![0]!.stats.speed!);
    // and back
    p.cds.s1.charges = p.cds.s1.max;
    expect(cast(w, 's1')).toBe(true);
    expect(p.form).toBeNull();
    expect(w.build.bar.basic).toBe('wrath');
    // the bear is tougher
    w.setForm('bear');
    expect(w.build.bar.basic).toBe('maul');
    expect(p.maxHp).toBeGreaterThan(plainHp * 1.2);
  });

  it('a Feral druid’s Rip is a cat skill: it replaces Ferocious Bite in Cat Form and never sits on the caster bar', () => {
    const c = readyHero('druid', 12, 'uncommon', 7, 1);
    expect(c.spec).toBe(1);
    expect(learnedSkills(c)).not.toContain('rip');
    expect(c.skills).not.toContain('rip');
    expect(setSkill(c, 0, 'cat-form')).toBe(true);
    const w = newWorld('whisperwood', c);
    w.setForm('cat');
    expect([w.build.bar.s2, w.build.bar.s3]).toEqual(['rake', 'rip']);
  });
});
