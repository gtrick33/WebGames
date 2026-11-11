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
import { addBuff, applyEffect, applyStatus, effStats, empowerFull, empowerOf, GUARD_BLOW, hurtPlayer, THORN_BLOW } from '../src/games/sigilfall/sim/combat';
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
        expect(c!.mods.length, `${cls} ${tree.name}`).toBeGreaterThan(0);
        const procs = c!.mods.filter((m): m is Extract<Mod, { t: 'proc' }> => m.t === 'proc').map((m) => m.proc);
        // (a combo is a trigger, or something a skill of the class's own now does)
        for (const m of c!.mods) if (m.t === 'skill' && m.skill !== '*') expect(mine.has(m.skill), `${cls} ${tree.name}: ${m.skill}`).toBe(true);
        const effects = [...procs.map((p) => p.effect), ...c!.mods.flatMap((m) => (m.t === 'skill' && 'effect' in m.op ? [m.op.effect] : []))];
        for (const p of procs) {
          expect(p.id.startsWith('combo-'), p.id).toBe(true);
          if (p.skill) expect(mine.has(p.skill), `${cls} ${tree.name}: ${p.skill}`).toBe(true);
        }
        for (const e of effects) {
          // (one that waits on a kind of damage names no skill)
          if (e.kind === 'buff' && e.buff.empower && !e.buff.empower.type) expect(mine.has(e.buff.empower.skill), `${cls} ${tree.name}: ${e.buff.empower.skill}`).toBe(true);
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

  it('what is set off lands as what it is, damage over time: never a critical blow on top of the hit it was sized from', () => {
    // (a warlock's Wild Hex once took two thirds of a boss's life in one blow: the rot struck critically a second time)
    const blast = (crit: number): number => {
      const w = heroWith('warlock', 'unstable-affliction', 0);
      w.build.stats.crit = crit;
      const e = target(w, 60);
      applyStatus(w, e, { status: 'curse', dur: 8, power: 1 }, 100, 'corruption');
      step(w, 0.25);
      // (what is left of it, as the ticks would have dealt it)
      const left = e.statuses.filter((s) => s.id === 'curse').reduce((a, s) => a + s.power * s.t, 0);
      const before = e.hp;
      applyEffect(w, { kind: 'detonate', status: 'curse', mul: 1.5 }, { x: e.x, y: e.y, angle: 0, spec: null, base: 10, type: 'shadow', depth: 0, target: e, hitDmg: 10, when: 'proc' });
      expect(e.statuses.some((s) => s.id === 'curse')).toBe(false);
      return (before - e.hp) / left;
    };
    const plain = blast(0);
    const lucky = blast(100);
    // half again what was left, whatever the hero's chance to strike critically
    expect(plain).toBeGreaterThan(1.4);
    expect(plain).toBeLessThan(1.6);
    expect(lucky).toBeCloseTo(plain, 5);
  });

  it('a blow that lays a curse again and sets the rot off in the same breath sets off what was there, and leaves what it laid', () => {
    const w = heroWith('warlock', 'unstable-affliction', 0);
    w.build.stats.crit = 0;
    const e = target(w, 60);
    // an old, small curse with three seconds left; and another skill's, untouched by this blow
    applyStatus(w, e, { status: 'curse', dur: 4, power: 1 }, 100, 'unstable-affliction');
    applyStatus(w, e, { status: 'curse', dur: 6, power: 1 }, 50, 'corruption');
    step(w, 1);
    const mine = e.statuses.find((s) => s.src === 'unstable-affliction')!;
    const other = e.statuses.find((s) => s.src === 'corruption')!;
    const owed = mine.power * mine.t + other.power * other.t;
    // the blow: the same curse laid again, far stronger and for longer, and the rot set off at once
    applyStatus(w, e, { status: 'curse', dur: 8, power: 1 }, 4000, 'unstable-affliction');
    const laid = { power: mine.power, t: mine.t };
    expect(laid.power).toBeGreaterThan(3000);
    const before = e.hp;
    applyEffect(w, { kind: 'detonate', status: 'curse', mul: 1.5 }, { x: e.x, y: e.y, angle: 0, spec: null, base: 10, type: 'shadow', depth: 0, target: e, hitDmg: 10, when: 'proc' });
    const dealt = before - e.hp;
    // half again what the two old curses still owed: nothing of the 32,000 this blow has only just laid
    expect(dealt).toBeGreaterThan(owed * 1.4);
    expect(dealt).toBeLessThan(owed * 1.6);
    expect(dealt).toBeLessThan(2000);
    // the other skill's curse is spent; this blow's own stays, whole, to run its course
    expect(e.statuses.some((s) => s.src === 'corruption')).toBe(false);
    const kept = e.statuses.find((s) => s.src === 'unstable-affliction')!;
    expect(kept).toMatchObject(laid);
    expect(kept.was).toBeUndefined();
    // and a later blow can set that one off in its turn
    step(w, 1);
    const then = e.hp;
    applyEffect(w, { kind: 'detonate', status: 'curse', mul: 1.5 }, { x: e.x, y: e.y, angle: 0, spec: null, base: 10, type: 'shadow', depth: 0, target: e, hitDmg: 10, when: 'proc' });
    expect(then - e.hp).toBeGreaterThan(20000);
    expect(e.statuses.some((s) => s.id === 'curse')).toBe(false);
  });
});

describe('Sigilfall: the combos in play', () => {
  it('Pyromancer: fire on a Chilled enemy breaks the cold in a burst that reaches the ones beside it', () => {
    const w = heroWith('mage', 'fireball', 0);
    w.build.stats.crit = 0;
    const e = target(w, 60);
    const beside = w.addEnemy('moss-slime', e.x + 4, e.y + 26, 30, { room: -1, pack: 0 });
    beside.hp = beside.maxHp = 1e6;
    applyStatus(w, e, { status: 'chill', dur: 6, power: 0.4 }, 10);
    expect(cast(w)).toBe(true);
    step(w, 1);
    expect(w.procCd['combo-thermal-chill'] ?? 0).toBeGreaterThan(0);
    expect(beside.hp).toBeLessThan(1e6);
    // (and nothing of the kind on an enemy the frost never touched)
    const dry = heroWith('mage', 'fireball', 0);
    target(dry, 60);
    cast(dry);
    step(dry, 1);
    expect(dry.procCd['combo-thermal-chill'] ?? 0).toBe(0);
  });

  it('Stormcaller: lightning on a Chilled enemy arcs on, and whatever lightning strikes is Shocked', () => {
    const w = heroWith('mage', 'chain-lightning', 1);
    const e = target(w, 60);
    applyStatus(w, e, { status: 'chill', dur: 6, power: 0.4 }, 10);
    expect(cast(w)).toBe(true);
    step(w, 0.3);
    expect(w.procCd['combo-conduction-chill'] ?? 0).toBeGreaterThan(0);
    expect(e.statuses.some((x) => x.id === 'shock')).toBe(true);
  });

  it('Cryomancer: frost on a Burning enemy freezes it solid', () => {
    const w = heroWith('mage', 'ice-lance', 2);
    const e = target(w, 60);
    applyStatus(w, e, { status: 'burn', dur: 6, power: 0.2 }, 10);
    expect(cast(w)).toBe(true);
    step(w, 0.6);
    expect(e.statuses.some((x) => x.id === 'freeze')).toBe(true);
  });

  it('Deadeye: the same arrow hits a third harder on an enemy a long way off', () => {
    const hit = (dx: number): number => {
      const w = heroWith('ranger', 'piercing-arrow', 0);
      w.build.stats.crit = 0;
      const e = target(w, dx);
      // (held where it stands, so the distance is the distance)
      e.state = 'idle';
      e.aggro = false;
      const before = e.hp;
      expect(tryCast(w, { slot: 'basic', angle: 0, dist: 0.5, assist: 0 })).toBe(true);
      step(w, 0.9);
      return before - e.hp;
    };
    const near = hit(50);
    const far = hit(150);
    expect(near).toBeGreaterThan(0);
    // (35% from the combo, and this hero's three ranks of Far Mark on top)
    expect(far / near).toBeGreaterThan(1.3);
    expect(far / near).toBeLessThan(1.6);
  });

  it('Dawnkeeper and Shieldbearer: spending Zeal mends the one and steadies the other', () => {
    const dawn = heroWith('paladin', 'divine-storm', 0);
    dawn.player.hp = dawn.player.maxHp * 0.5;
    const before = dawn.player.hp;
    target(dawn, 24);
    expect(cast(dawn)).toBe(true);
    step(dawn, 0.1);
    expect(dawn.player.hp).toBeGreaterThan(before);
    const wall = heroWith('paladin', 'divine-storm', 1);
    const armor = effStats(wall).armor;
    target(wall, 24);
    expect(cast(wall)).toBe(true);
    step(wall, 0.1);
    expect(effStats(wall).armor).toBe(armor + 6);
  });

  it('Zealot: Zeal spent on a blow sets up the next Oath Strike', () => {
    const w = heroWith('paladin', 'templars-verdict', 2);
    target(w, 24);
    expect(cast(w)).toBe(true);
    step(w, 0.4);
    expect(empowerOf(w, 'crusader-strike')).not.toBeNull();
    expect(tryCast(w, { slot: 'basic', angle: 0, dist: 0.5, assist: 0 })).toBe(true);
    step(w, 0.3);
    expect(empowerOf(w, 'crusader-strike')).toBeNull();
  });

  it('Priest: a holy hit strengthens the next shadow skill, which strengthens the next holy one; Smite never spends either', () => {
    const c: Character = readyHero('priest', 50, 'uncommon', 7, 2);
    expect(setSkill(c, 0, 'mind-blast')).toBe(true);
    expect(setSkill(c, 1, 'holy-nova')).toBe(true);
    const w = newWorld('whisperwood', c);
    w.enemies = [];
    step(w, 0.8);
    w.enemies = [];
    w.player.mana = w.player.maxMana;
    target(w, 30);
    expect(empowerOf(w, 'mind-blast')).toBeNull();
    // Smite is holy: Dusk
    expect(tryCast(w, { slot: 'basic', angle: 0, dist: 0.5, assist: 0 })).toBe(true);
    step(w, 0.2);
    expect(empowerOf(w, 'mind-blast')?.def.name).toBe('Dusk');
    expect(empowerOf(w, 'smite')).toBeNull();
    // the shadow skill spends Dusk and leaves Dawn for the holy one
    expect(tryCast(w, { slot: 's1', angle: 0, dist: 0.5, assist: 0 })).toBe(true);
    step(w, 0.2);
    expect(empowerOf(w, 'holy-nova')?.def.name).toBe('Dawn');
    // (Smite, cast again, has renewed Dusk but not taken Dawn)
    step(w, 0.6);
    tryCast(w, { slot: 'basic', angle: 0, dist: 0.5, assist: 0 });
    step(w, 0.2);
    expect(empowerOf(w, 'holy-nova')?.def.name).toBe('Dawn');
    expect(tryCast(w, { slot: 's2', angle: 0, dist: 0.5, assist: 0 })).toBe(true);
    step(w, 0.2);
    expect(empowerOf(w, 'holy-nova')).toBeNull();
  });

  it('Doomcaller: what dies cursed goes up in fire, and the pyre readies an instant Ruin Bolt', () => {
    const w = heroWith('warlock', 'chaos-bolt', 2);
    const e = target(w, 40, 5);
    const beside = target(w, 60, 1e6);
    applyStatus(w, e, { status: 'curse', dur: 6, power: 0.2 }, 10);
    expect(tryCast(w, { slot: 'basic', angle: 0, dist: 0.5, assist: 0 })).toBe(true);
    step(w, 0.8);
    expect(e.dead).toBe(true);
    expect(beside.hp).toBeLessThan(1e6);
    expect(empowerOf(w, 'chaos-bolt')).not.toBeNull();
    expect(cast(w)).toBe(true);
    expect(w.player.casting).toBeFalsy();
  });

  it('Gloamknight: a blow taken on the guard readies Umbral Rend', () => {
    const w = heroWith('gloamknight', 'umbral-rend', 0);
    const e = target(w, 24);
    expect(tryCast(w, { slot: 'dodge', angle: 0, dist: null, assist: 0 })).toBe(true);
    expect(w.player.guard).toBeGreaterThan(0);
    const hp = w.player.hp;
    const foe = e.hp;
    expect(hurtPlayer(w, 50, { fromX: e.x, fromY: e.y, source: e })).toBe(false);
    expect(w.player.hp).toBe(hp);
    // paid back, and the debt called in
    expect(e.hp).toBeLessThan(foe);
    expect(empowerOf(w, 'umbral-rend')).not.toBeNull();
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

  it("a Gloamknight's guard pays each blow back once, however long the blow leans on it", () => {
    // (a boss's rush reaches for the hero every step it touches them, and a guard never lets it land: answered step
    // for step, Stand Fast did 95% of a late boss's life by itself)
    const w = heroWith('gloamknight', 'umbral-rend', 0);
    w.build.stats.crit = 0;
    // (only the guard's own answer: no talent that curses or lashes out on top of it)
    w.build.procs = [];
    const e = target(w, 24);
    const other = target(w, -24);
    const p = w.player;
    const guard = (): void => {
      p.cds.dodge.charges = 1;
      p.cds.dodge.t = 0;
      expect(tryCast(w, { slot: 'dodge', angle: 0, dist: 0.5, assist: 0 })).toBe(true);
      expect(p.guard).toBeGreaterThan(0);
    };
    guard();
    const hp = e.hp;
    let landed = 0;
    // one blow, leaning on the guard for as long as it stands
    for (let i = 0; i < 40 && p.guard > 0; i++) {
      if (hurtPlayer(w, 400, { source: e })) landed++;
      if (i === 0) expect(e.hp).toBeLessThan(hp);
      w.input = emptyInput();
      w.step(1 / 60);
    }
    expect(landed).toBe(0);
    const once = hp - e.hp;
    expect(once).toBeGreaterThan(0);
    // a second enemy's blow on the next guard is its own, and the first is answered again: one each
    step(w, 1);
    const hp2 = e.hp;
    guard();
    for (let i = 0; i < 10; i++) {
      hurtPlayer(w, 400, { source: e });
      hurtPlayer(w, 400, { source: other });
    }
    expect(hp2 - e.hp).toBe(once);
    expect(1e6 - other.hp).toBe(once);
    expect(GUARD_BLOW).toBeGreaterThan(SKILLS['shade-step']!.base.duration + 0.08);
  });

  it('thorns prick whoever strikes once a blow, not once a step', () => {
    const w = heroWith('gloamknight', 'night-mantle', 0);
    w.build.stats.crit = 0;
    w.build.procs = [];
    const e = target(w, 24);
    const p = w.player;
    p.hp = p.maxHp = 1e9;
    expect(cast(w)).toBe(true);
    expect(p.buffs.some((b) => (b.def.thorns ?? 0) > 0)).toBe(true);
    const hp = e.hp;
    // a fire that burns every step for a quarter of a second: one prick
    for (let i = 0; i < 15; i++) {
      expect(hurtPlayer(w, 5, { source: e })).toBe(true);
      w.time += 1 / 60;
    }
    const once = hp - e.hp;
    expect(once).toBeGreaterThan(0);
    // and the next blow, a moment later, is pricked again
    w.time += THORN_BLOW;
    hurtPlayer(w, 5, { source: e });
    expect(hp - e.hp).toBe(once * 2);
  });
});
