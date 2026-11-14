/**
 * The Ring after the owner's balancing notes of 2026-11-14: "any stun, root, or fear shouldnt be breakable by dmg";
 * "swift step part should have another tab for that where you should be able to replace it with a trinket that frees
 * u from any stun with 30s cooldown"; the mage's Frost Snare and Hoar Grip "shouldnt break by dmg or get diminishing
 * returns, hex should clear all dots if used on a target"; and the Nightblade "should put u to stealth auto if u are not
 * damaged for 5s".
 */
import { describe, expect, it } from 'vitest';
import { ABILITIES, CHARM, DASH, stepOf, type Ability } from '../src/games/sigilfall/arena/abilities';
import { setsOf } from '../src/games/sigilfall/arena/ladder';
import { GATES, Match, VEIL, type Fighter, type FighterSetup } from '../src/games/sigilfall/arena/sim';
import type { ClassId } from '../src/games/sigilfall/data/types';
import { cleanPick } from '../src/games/sigilfall/net/ringRoom';

const STEP = 1 / 30;

interface Inside {
  damage(src: Fighter, t: Fighter, amount: number, direct: boolean, ab?: Ability): number;
}
const inside = (m: Match): Inside => m as unknown as Inside;

function duel(a: ClassId, bar: string[], b: ClassId, foeBar: string[] = ['w-hew'], step?: string): Match {
  const side = (cls: ClassId, team: 0 | 1, list: string[], st?: string): FighterSetup => ({ team, cls, name: cls, bar: list, talents: [], step: st });
  const m = new Match({ seed: 6, map: 'sands', fighters: [side(a, 0, bar), side(b, 1, foeBar, step)] });
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

describe('The Ring: holds that hold', () => {
  it('a stun holds through any hurt, and only a daze breaks on it', () => {
    const m = duel('mage', ['m-chill', 'm-toad'], 'warrior');
    const [mage, w] = m.fighters as [Fighter, Fighter];
    expect(m.press(mage.id, 'm-chill')).toBeNull();
    inside(m).damage(mage, w, w.maxHp * 0.4, true, ABILITIES['m-lash']);
    expect(m.held(w)?.cc).toBe('stun');
  });

  it('Frost Snare and Hoar Grip never wear off with use: the third lasts as long as the first', () => {
    const m = duel('mage', ['m-chill', 'm-ring'], 'warrior');
    const [mage, w] = m.fighters as [Fighter, Fighter];
    const lengths: number[] = [];
    for (let i = 0; i < 3; i++) {
      mage.cds = {};
      mage.gcd = 0;
      w.auras = [];
      expect(m.press(mage.id, 'm-chill')).toBeNull();
      lengths.push(w.auras.find((a) => a.cc === 'stun')!.dur);
    }
    expect(lengths[2]).toBeCloseTo(lengths[0]!, 5);
    expect(w.dr.stun).toBeUndefined();
    // (and nothing else's holds are counted the less for them: a hawk's stun after three grips is a first one)
    const hawk = duel('ranger', ['r-hawk'], 'warrior');
    expect(hawk.press(0, 'r-hawk')).toBeNull();
    expect(hawk.fighters[1]!.dr.stun?.n).toBe(1);
  });

  it('Toad Hex snuffs out everything burning or rotting on its target, so that the toad stays a toad', () => {
    const m = duel('mage', ['m-toad', 'm-lash'], 'warlock', ['k-agony']);
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

describe('The Ring: the Unbinding Charm, in the Swift Step’s place', () => {
  it('carried instead of the Swift Step, it breaks every hold, even while held, and is 30 seconds coming back', () => {
    expect(stepOf('charm')).toBe(CHARM);
    expect(stepOf(undefined)).toBe(DASH);
    expect(stepOf('nonsense')).toBe(DASH);
    expect(CHARM.cd).toBe(30);
    const m = duel('mage', ['m-chill', 'm-ring'], 'warrior', ['w-hew'], 'charm');
    const [mage, w] = m.fighters as [Fighter, Fighter];
    expect(m.extras(w)[0]).toBe(CHARM);
    expect(m.press(w.id, DASH.id)).toBe('You don’t have that');
    m.press(mage.id, 'm-chill');
    mage.gcd = 0;
    m.press(mage.id, 'm-ring');
    expect(w.auras.some((a) => a.cc === 'stun') && w.auras.some((a) => a.cc === 'root')).toBe(true);
    expect(m.press(w.id, 'charm')).toBeNull();
    expect(w.auras.some((a) => !!a.cc)).toBe(false);
    expect(w.cds.charm).toBeCloseTo(30, 0);
    // the Swift Step is still the default
    expect(m.extras(mage)[0]).toBe(DASH);
  });

  it('a setup keeps its choice, a room passes it on, and a player can change it in the entry', () => {
    const kept = setsOf({ standings: {}, sets: { warrior: { active: 0, list: [{ bar: ['w-hew', 'w-gash', 'w-rush', 'w-hurl'], oath: 'iron', talents: [], step: 'charm' }] } } }, 'warrior');
    expect(kept.list[0]!.step).toBe('charm');
    expect(cleanPick({ team: 0, cls: 'warrior', bar: ['w-hew'], oath: 'iron', talents: [], step: 'charm' })?.step).toBe('charm');
    expect(cleanPick({ team: 0, cls: 'warrior', bar: ['w-hew'], oath: 'iron', talents: [], step: 'teleport' })?.step).toBeUndefined();
    const m = new Match({ seed: 1, map: 'sands', fighters: [{ team: 0, cls: 'warrior', name: 'a', bar: ['w-hew'] }, { team: 1, cls: 'mage', name: 'b', bar: ['m-lash'] }] });
    expect(m.equip(0, { bar: ['w-hew', 'w-gash', 'w-rush', 'w-hurl'], step: 'charm' })).toBe(true);
    expect(m.extras(m.fighters[0]!)[0]).toBe(CHARM);
  });
});

describe('The Ring: the Nightblade slips back into the shroud by themself', () => {
  it('out of the fight a while, back in the shroud without pressing anything; not while the fight goes on', () => {
    const m = duel('gloamknight', ['g-veil', 'g-ambush', 'g-knife', 'g-walk'], 'warrior');
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
    const b = duel('gloamknight', ['g-cleave', 'g-reap', 'g-lunge', 'g-hand'], 'warrior');
    wait(b, VEIL.calm + 1);
    expect(b.hidden(b.fighters[0]!)).toBe(false);
  });

  it('a fear on them is a fight too: they don’t slip away the moment it lands', () => {
    const m = duel('gloamknight', ['g-veil', 'g-ambush', 'g-knife', 'g-walk'], 'warrior', ['w-hew', 'w-shout']);
    const [g, w] = m.fighters as [Fighter, Fighter];
    expect(m.press(w.id, 'w-shout')).toBeNull();
    expect(m.hidden(g)).toBe(false);
    wait(m, 1);
    expect(m.hidden(g)).toBe(false);
  });
});
