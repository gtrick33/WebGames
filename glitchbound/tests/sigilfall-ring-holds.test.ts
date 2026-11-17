/**
 * The Ring after the owner's balancing notes of 2026-11-14: "any stun, root, or fear shouldnt be breakable by dmg"
 * (later that day roots and fears break on hurt again: "roots should break after some dmg has been done, similar to
 * wows roots, same for fears", and "the frost roots should only apply for 1 rime spear except ult that applies for 2");
 * "swift step part should have another tab for that where you should be able to replace it with a trinket that frees
 * u from any stun with 30s cooldown" (taken out again with the oaths on 2026-11-15); the mage's Frost Snare and Hoar Grip "shouldnt break by dmg or get diminishing
 * returns, hex should clear all dots if used on a target"; and the Nightblade "should put u to stealth auto if u are not
 * damaged for 5s". Since 2026-11-16 a playstyle's abilities are its own: Hoar Grip is gone with the choosing, the
 * shard that shatters ice is the Rime's instant Frostfang ("instant dmg spell like ice lance"), not its spear, and
 * there is no trinket.
 */
import { describe, expect, it } from 'vitest';
import { ABILITIES, BODY, PRESETS, type Ability } from '../src/games/sigilfall/arena/abilities';
import { setsOf, type RingSetup } from '../src/games/sigilfall/arena/ladder';
import { GATES, Match, ROOT_BREAK, VEIL, type Fighter, type FighterSetup } from '../src/games/sigilfall/arena/sim';
import type { ClassId } from '../src/games/sigilfall/data/types';
import { cleanPick } from '../src/games/sigilfall/net/ringRoom';

const STEP = 1 / 30;

interface Inside {
  damage(src: Fighter, t: Fighter, amount: number, direct: boolean, ab?: Ability): number;
}
const inside = (m: Match): Inside => m as unknown as Inside;

function duel(a: ClassId, bar: string[], b: ClassId, foeBar: string[] = ['w-hew']): Match {
  const side = (cls: ClassId, team: 0 | 1, list: string[]): FighterSetup => ({ team, cls, name: cls, bar: list, talents: [] });
  const m = new Match({ seed: 6, map: 'sands', fighters: [side(a, 0, bar), side(b, 1, foeBar)] });
  m.step(GATES + 0.01, {});
  const [f, g] = m.fighters as [Fighter, Fighter];
  Object.assign(f, { x: 200, y: 125, dirX: 1, dirY: 0, target: 1 });
  Object.assign(g, { x: 222, y: 125, dirX: -1, dirY: 0, target: 0 });
  return m;
}
const wait = (m: Match, seconds: number): void => {
  for (let i = 0; i < seconds / STEP; i++) {
    m.step(STEP, {});
    m.events.length = 0;
  }
};

/** The Rime's four. */
const RIME = PRESETS.mage[1]!.bar;

describe('The Ring: holds that hold', () => {
  it('a stun holds through any hurt', () => {
    const m = duel('paladin', PRESETS.paladin[1]!.bar, 'warrior');
    const [pal, w] = m.fighters as [Fighter, Fighter];
    expect(m.press(pal.id, 'd-hammer')).toBeNull();
    inside(m).damage(pal, w, w.maxHp * 0.4, true, ABILITIES['d-blow']);
    expect(m.held(w)?.cc).toBe('stun');
  });

  it('the Rime’s hold is a stun from range now, a second and a half, and lands in full every time like any other', () => {
    // (the owner, 2026-11-17: "for the rime mage, you can replace the frost snare with a ranged stun for 1.5s or a
    // kick". The Frost Snare rooted everyone near and never wore off with use; Frostclasp is one target, from afar.)
    const ab = ABILITIES['m-ring']!;
    expect(ab).toMatchObject({ name: 'Frostclasp', aim: 'enemy', cast: 0.6 });
    const m = duel('mage', PRESETS.mage[1]!.bar, 'warrior');
    const [mage, w] = m.fighters as [Fighter, Fighter];
    w.x = mage.x + 150;
    expect(m.press(mage.id, 'm-ring')).toBeNull();
    for (let i = 0; i < 60 && !w.auras.some((a) => a.cc === 'stun'); i++) m.step(STEP, {});
    expect(w.auras.find((a) => a.cc === 'stun')?.dur).toBe(1.5);
    // (a second one, once it is ready again, lasts as long: there are no diminishing returns)
    w.auras = [];
    mage.cds = {};
    mage.gcd = 0;
    expect(m.press(mage.id, 'm-ring')).toBeNull();
    for (let i = 0; i < 60 && !w.auras.some((a) => a.cc === 'stun'); i++) m.step(STEP, {});
    expect(w.auras.find((a) => a.cc === 'stun')?.dur).toBe(1.5);
  });

  it('Toad Hex snuffs out everything burning or rotting on its target, so that the toad stays a toad', () => {
    const m = duel('mage', ['m-toad', 'm-lash'], 'warlock', ['k-dart']);
    const [mage, k] = m.fighters as [Fighter, Fighter];
    k.auras.push({ ab: 'm-lash', kind: 'dot', src: mage.id, t: 6, dur: 6, harmful: true, magic: true, n: 5, next: 1 });
    expect(m.press(mage.id, 'm-toad')).toBeNull();
    for (let i = 0; i < 60 && !k.auras.some((a) => a.cc === 'incap'); i++) wait(m, STEP);
    expect(k.auras.some((a) => a.cc === 'incap')).toBe(true);
    expect(k.auras.some((a) => a.kind === 'dot')).toBe(false);
    wait(m, 2);
    expect(k.auras.some((a) => a.cc === 'incap')).toBe(true);
  });
});

describe('The Ring: Frostfang shatters the ice', () => {
  /** Looses a Frostfang and waits for it to get there: whether it was a Shatter, and whether the target is still rooted. */
  const fang = (m: Match): { shatter: boolean; rooted: boolean } => {
    const [mage, w] = m.fighters as [Fighter, Fighter];
    mage.gcd = 0;
    mage.cds = {};
    m.events.length = 0;
    const hp = w.hp;
    expect(m.press(mage.id, 'm-fang')).toBeNull();
    // (it is seen crossing, and lands as it gets there)
    expect(w.hp).toBe(hp);
    expect(m.bolts.map((b) => b.ab)).toEqual(['m-fang']);
    for (let i = 0; i < 30 && m.bolts.length; i++) m.step(STEP, {});
    expect(m.bolts).toHaveLength(0);
    const shatter = m.events.some((e) => e.k === 'word' && e.word === 'Shatter');
    m.events.length = 0;
    expect(w.hp).toBeLessThan(hp);
    return { shatter, rooted: w.auras.some((a) => a.cc === 'root') };
  };
  /** Held by the Rime's Frostclasp: stunned. */
  const clasped = (): Match => {
    const m = duel('mage', RIME, 'warrior');
    const [mage, w] = m.fighters as [Fighter, Fighter];
    w.hp = w.maxHp = 50000;
    expect(m.press(mage.id, 'm-ring')).toBeNull();
    for (let i = 0; i < 60 && !w.auras.some((a) => a.cc === 'stun'); i++) m.step(STEP, {});
    expect(w.auras.some((a) => a.cc === 'stun')).toBe(true);
    return m;
  };

  it('three times as hard on the frozen, and the same shard on anyone else', () => {
    const hit = (frozen: boolean): number => {
      const m = duel('mage', RIME, 'warrior');
      const [mage, w] = m.fighters as [Fighter, Fighter];
      (m as unknown as { rand: () => number }).rand = () => 0.99;
      w.hp = w.maxHp = 50000;
      if (frozen) w.auras.push({ ab: 'l-roots', kind: 'cc', cc: 'root', src: 1, t: 5, dur: 5, harmful: true, magic: true, n: 0, took: 0 });
      expect(m.press(mage.id, 'm-fang')).toBeNull();
      for (let i = 0; i < 30 && m.bolts.length; i++) m.step(STEP, {});
      return 50000 - w.hp;
    };
    expect(ABILITIES['m-fang']!.combo!.mult).toBe(3);
    expect(hit(true) / hit(false)).toBeCloseTo(3, 1);
    // (instant, on the move, and with no long wait between; seen crossing in a third of a second or so)
    expect(ABILITIES['m-fang']).toMatchObject({ cast: 0, bolt: true });
    expect(ABILITIES['m-fang']!.flight!.most).toBeLessThanOrEqual(0.45);
    expect(ABILITIES['m-fang']!.cd).toBeLessThanOrEqual(4);
  });

  it('Frostclasp sets Frostfang up: every shard that lands while they are stunned is a Shatter, and the stun stays', () => {
    const m = clasped();
    const w = m.fighters[1]!;
    expect(fang(m).shatter).toBe(true);
    expect(w.auras.some((a) => a.cc === 'stun')).toBe(true);
    expect(fang(m).shatter).toBe(true);
    // (and once it has run out, a plain shard)
    w.auras = w.auras.filter((a) => a.cc !== 'stun');
    expect(fang(m).shatter).toBe(false);
  });

  it('Winter’s Grasp’s ice takes two: the first leaves it standing, the second frees them', () => {
    const m = duel('mage', RIME, 'warrior');
    const [mage, w] = m.fighters as [Fighter, Fighter];
    w.hp = w.maxHp = 50000;
    mage.charge = 1;
    expect(m.press(mage.id, 'm-super2')).toBeNull();
    expect(w.auras.find((a) => a.cc === 'root')?.shatters).toBe(2);
    expect(fang(m)).toEqual({ shatter: true, rooted: true });
    expect(fang(m)).toEqual({ shatter: true, rooted: false });
    expect(fang(m).shatter).toBe(false);
  });

  it('the shard that shatters the ice isn’t counted toward breaking it: a crit can’t rob the super of its second', () => {
    const m = duel('mage', RIME, 'warrior');
    const [mage, w] = m.fighters as [Fighter, Fighter];
    mage.charge = 1;
    expect(m.press(mage.id, 'm-super2')).toBeNull();
    const ice = w.auras.find((a) => a.cc === 'root')!;
    ice.took = w.maxHp * ROOT_BREAK - 1;
    expect(fang(m)).toEqual({ shatter: true, rooted: true });
    // (anything else that lands breaks it as it would any root)
    inside(m).damage(mage, w, 5, true, ABILITIES['m-spear']);
    expect(w.auras.some((a) => a.cc === 'root')).toBe(false);
  });

  it('a root that isn’t ice, or a stun with the ice, shatters without using it up', () => {
    const m = duel('mage', RIME, 'warrior');
    const [mage, w] = m.fighters as [Fighter, Fighter];
    w.hp = w.maxHp = 50000;
    mage.charge = 1;
    expect(m.press(mage.id, 'm-super2')).toBeNull();
    w.auras.push({ ab: 'd-hammer', kind: 'cc', cc: 'stun', src: mage.id, t: 5, dur: 5, harmful: true, magic: true, n: 0, took: 0 });
    expect(fang(m)).toEqual({ shatter: true, rooted: true });
    const d = duel('mage', RIME, 'druid', ['l-roots']);
    const [dm, dw] = d.fighters as [Fighter, Fighter];
    dw.hp = dw.maxHp = 50000;
    dw.auras.push({ ab: 'l-roots', kind: 'cc', cc: 'root', src: 1, t: 5, dur: 5, harmful: true, magic: true, n: 0, took: 0 });
    expect(dm.id).toBe(0);
    expect(fang(d)).toEqual({ shatter: true, rooted: true });
    expect(fang(d)).toEqual({ shatter: true, rooted: true });
  });
});

describe('The Ring: nothing beside the bar but the super (2026-11-15: "remove oaths and the extras, leave only spells, talents and ults")', () => {
  it('no step, no charm, no oath, and no trinket: a hero is their playstyle’s four and its super', () => {
    const m = duel('mage', RIME, 'warrior');
    for (const f of m.fighters) expect(m.extras(f).map((a) => a.super)).toEqual([true]);
    expect(ABILITIES.dash).toBeUndefined();
    expect(ABILITIES.charm).toBeUndefined();
    // (the trinket every class could take as one of its five went with the choosing of abilities, 2026-11-16)
    expect(ABILITIES.trinket).toBeUndefined();
    expect(m.press(0, 'trinket')).toBe('You don’t have that');
    expect(duel('mage', ['m-spear', 'trinket'], 'warrior').fighters[0]!.bar).toEqual(RIME);
    // (and a hero is as their class is built, with no oath's bonus on top)
    expect(m.fighters[0]!.maxHp).toBe(BODY.mage.hp);
    expect(m.fighters[1]!.maxHp).toBe(BODY.warrior.hp);
  });

  it('a setup kept with an oath and the charm, and a pick from a game from before, are read without them', () => {
    const old = { bar: ['w-hew', 'w-gash', 'w-rush', 'w-hurl'], oath: 'iron', talents: [], step: 'charm' } as unknown as RingSetup;
    const kept = setsOf({ standings: {}, sets: { warrior: { active: 0, list: [old] } } }, 'warrior').list[0]!;
    expect(kept).not.toHaveProperty('oath');
    expect(kept).not.toHaveProperty('step');
    expect(kept.bar).toEqual(PRESETS.warrior[0]!.bar);
    const pick = cleanPick({ team: 0, cls: 'warrior', bar: ['w-hew'], oath: 'iron', talents: [], step: 'charm' });
    expect(pick).not.toBeNull();
    expect(pick).not.toHaveProperty('oath');
    expect(pick).not.toHaveProperty('step');
    // (a pick with no oath at all is as good)
    expect(cleanPick({ team: 0, cls: 'warrior', bar: ['w-hew'], talents: [] })).not.toBeNull();
  });
});

describe('The Ring: the Nightblade slips back into the shroud by themself', () => {
  it('out of the fight a while, back in the shroud without pressing anything; not while the fight goes on', () => {
    const m = duel('gloamknight', PRESETS.gloamknight[1]!.bar, 'warrior');
    const [g, w] = m.fighters as [Fighter, Fighter];
    expect(m.press(g.id, 'g-ambush')).toBeNull();
    expect(m.hidden(g)).toBe(false);
    wait(m, 2);
    expect(m.hidden(g)).toBe(false);
    // (struck again: the clock starts over)
    inside(m).damage(w, g, 10, true, ABILITIES['w-hew']);
    wait(m, VEIL.calm - 0.5);
    expect(m.hidden(g)).toBe(false);
    wait(m, 1);
    expect(m.hidden(g)).toBe(true);
    // (and it costs nothing: the shroud is still ready to press)
    expect(g.cds['g-veil'] ?? 0).toBe(0);
    // a Bloodsworn, without the shroud, does no such thing
    const b = duel('gloamknight', PRESETS.gloamknight[0]!.bar, 'warrior');
    wait(b, VEIL.calm + 1);
    expect(b.hidden(b.fighters[0]!)).toBe(false);
  });

  it('a fear on them is a fight too: they don’t slip away the moment it lands', () => {
    const m = duel('gloamknight', PRESETS.gloamknight[1]!.bar, 'priest', PRESETS.priest[0]!.bar);
    const [g, w] = m.fighters as [Fighter, Fighter];
    expect(m.press(w.id, 'p-wail')).toBeNull();
    expect(m.hidden(g)).toBe(false);
    wait(m, 1);
    expect(m.hidden(g)).toBe(false);
  });
});
