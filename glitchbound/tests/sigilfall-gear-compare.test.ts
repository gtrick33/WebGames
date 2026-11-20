/**
 * Gear weighed for how a hero plays (the owner, 2026-11-20: on a phone a better piece asks to be worn, and "better"
 * knows a tank from a healer from a fire mage): progress/compare.ts.
 */
import { describe, expect, it } from 'vitest';
import { compareGear, gearRole, heroElements, statWeights } from '../src/games/sigilfall/progress/compare';
import type { Item, StatKey } from '../src/games/sigilfall/data/types';
import type { Character } from '../src/games/sigilfall/progress/character';

const ring = (uid: string, st: [StatKey, number][], il = 30): Item => ({ uid, base: 'ring', r: 'uncommon', il, st });
type Who = Pick<Character, 'cls' | 'spec' | 'equip'>;
const hero = (cls: Character['cls'], spec: Character['spec'], worn?: Item): Who => ({ cls, spec, equip: worn ? { ring: worn } : {} });

describe('gear weighed for how the hero plays', () => {
  it('reads each specialization’s role from its own words', () => {
    expect(gearRole({ cls: 'warrior', spec: 1 })).toBe('tank');
    expect(gearRole({ cls: 'priest', spec: 0 })).toBe('healer');
    expect(gearRole({ cls: 'mage', spec: 0 })).toBe('damage');
    expect(gearRole({ cls: 'mage', spec: null })).toBe('damage');
  });

  it('a tank wants armor and health, a striker power and crits', () => {
    const tank = statWeights({ cls: 'warrior', spec: 1 });
    const fury = statWeights({ cls: 'warrior', spec: 0 });
    expect(tank.armor!).toBeGreaterThan(tank.power!);
    expect(fury.power!).toBeGreaterThan(fury.armor!);
    const heal = statWeights({ cls: 'priest', spec: 0 });
    expect(heal.healing!).toBeGreaterThan(heal.power!);
  });

  it('a mage of one element hardly values another’s', () => {
    const els = heroElements({ cls: 'mage', spec: 0 });
    expect(els.size).toBeGreaterThan(0);
    const w = statWeights({ cls: 'mage', spec: 0 });
    const own = [...els][0]!;
    const other = (['fire', 'frost', 'lightning', 'arcane'] as StatKey[]).find((e) => !els.has(e))!;
    expect(w[own]!).toBeGreaterThan(w[other]! * 5);
  });

  it('the same two rings are an upgrade for one specialization and not for another', () => {
    const armorRing = ring('a', [['armor', 40]]);
    const powerRing = ring('p', [['power', 30]]);
    // wearing the power ring, the armor ring is better for the tank, worse for the striker
    expect(compareGear(hero('warrior', 1, powerRing), armorRing).better).toBe(true);
    expect(compareGear(hero('warrior', 0, powerRing), armorRing).better).toBe(false);
    // and the other way about
    expect(compareGear(hero('warrior', 0, armorRing), powerRing).better).toBe(true);
    expect(compareGear(hero('warrior', 1, armorRing), powerRing).better).toBe(false);
  });

  it('an empty slot always takes it, and the changes are listed with what matters first', () => {
    const r = ring('x', [['speed', 3], ['power', 10]]);
    expect(compareGear(hero('mage', 0), r).better).toBe(true);
    const worn = ring('w', [['power', 5], ['crit', 4]]);
    const cmp = compareGear(hero('mage', 0, worn), r);
    expect(cmp.deltas.map((d) => d.stat)).toEqual(['power', 'crit', 'speed']);
    expect(cmp.deltas.find((d) => d.stat === 'crit')!.n).toBe(-4);
    expect(cmp.deltas.find((d) => d.stat === 'power')!.n).toBe(5);
  });
});
