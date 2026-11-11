/**
 * The Ring says what is going on (the owner: "the debuffs are just squares and i dont understand anything from
 * them ... you could add a highlight on the spell, a glowing frame ... the preset setups should include the combos
 * ... make the combat a tiny bit slower, like 5-10% max"):
 * - the bar can ask, before a blow, whether its combo is set up, and the answer is the one the blow itself gets;
 * - every ready-made setup holds a combo, and the fighting ones two, each named with what sets it up;
 * - a live match runs a little under the clock, and the rules' own time is untouched.
 */
import { describe, expect, it } from 'vitest';
import { ABILITIES, barCombos, kitOf, PRESETS } from '../src/games/sigilfall/arena/abilities';
import { Match, PACE, RANGED, RANGED_DMG, type MatchSetup } from '../src/games/sigilfall/arena/sim';
import { CLASS_IDS } from '../src/games/sigilfall/data/classes';
import type { ClassId } from '../src/games/sigilfall/data/types';

const setup = (a: ClassId, b: ClassId): MatchSetup => ({
  map: 'sands',
  seed: 7,
  fighters: [
    { name: 'A', cls: a, team: 0, seat: 0, bar: PRESETS[a][0]!.bar, talents: [], oath: 'iron' },
    { name: 'B', cls: b, team: 1, seat: null, bar: PRESETS[b][0]!.bar, talents: [], oath: 'iron' },
  ],
} as unknown as MatchSetup);

describe('Sigilfall: the Ring says what is going on', () => {
  it('a combo is known to be ready before the blow, by the same test the blow makes', () => {
    const m = new Match(setup('warrior', 'ranger'));
    const [me, foe] = m.fighters as [Match['fighters'][number], Match['fighters'][number]];
    const hew = ABILITIES['w-hew']!;
    expect(m.comboReady(me, hew, foe)).toBeNull();
    // his own gash on them: Hew's combo is set up
    foe.auras.push({ ab: 'w-gash', kind: 'antiheal', src: me.id, t: 8, dur: 8, harmful: true, magic: false, n: 0.5 });
    expect(m.comboReady(me, hew, foe)?.name).toBe(hew.combo!.name);
    // someone else's gash is not his to use, and nothing lands on the dead
    foe.auras[0]!.src = foe.id;
    expect(m.comboReady(me, hew, foe)).toBeNull();
    foe.auras[0]!.src = me.id;
    foe.dead = true;
    expect(m.comboReady(me, hew, foe)).toBeNull();
    // a hold sets up the ones that ask for it, whoever held them
    const other = new Match(setup('warrior', 'ranger'));
    const gash = ABILITIES['w-gash']!;
    other.fighters[1]!.auras.push({ ab: 'r-hawk', kind: 'cc', cc: 'stun', src: 1, t: 2, dur: 2, harmful: true, magic: false, n: 0 });
    expect(other.comboReady(other.fighters[0]!, gash, other.fighters[1]!)?.name).toBe(gash.combo!.name);
  });

  it('every ready-made setup holds a combo with what sets it up, and the fighting ones two', () => {
    for (const cls of CLASS_IDS) {
      for (const p of PRESETS[cls]) {
        const combos = barCombos(cls, p.bar);
        const heals = p.bar.filter((id) => ABILITIES[id]!.role === 'heal').length >= 2;
        expect(combos.length, `${cls} ${p.name}`).toBeGreaterThanOrEqual(heals ? 1 : 2);
        for (const c of combos) {
          expect(c.to.combo!.name).toBe(c.name);
          expect(c.from.id).not.toBe(c.to.id);
          expect(c.text.length).toBeGreaterThan(8);
        }
      }
      // (and every combo a class has can be set up by something in its own kit)
      const kit = kitOf(cls).map((a) => a.id);
      const all = barCombos(cls, kit).map((c) => c.to.id);
      for (const a of kitOf(cls)) if (a.combo) expect(all, `${cls}: ${a.name}`).toContain(a.id);
    }
  });

  it('who fights from range deals a tenth less than who fights at arm’s length', () => {
    const m = new Match(setup('mage', 'warrior'));
    expect(RANGED.has('mage')).toBe(true);
    expect(RANGED.has('warrior')).toBe(false);
    expect(m.fighters[0]!.mods.dmg).toBeCloseTo(m.fighters[1]!.mods.dmg * RANGED_DMG, 5);
    expect(RANGED_DMG).toBe(0.9);
  });

  it('a live match runs a little under the clock', () => {
    expect(PACE).toBeGreaterThanOrEqual(0.9);
    expect(PACE).toBeLessThanOrEqual(0.95);
  });
});
