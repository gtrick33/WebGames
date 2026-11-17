/**
 * The Ring says what is going on (the owner: "the debuffs are just squares and i dont understand anything from
 * them ... you could add a highlight on the spell, a glowing frame ... the preset setups should include the combos
 * ... make the combat a tiny bit slower, like 5-10% max"):
 * - the bar can ask, before a blow, whether its combo is set up, and the answer is the one the blow itself gets;
 * - every playstyle holds a combo made with its basic ability or its super, named with what sets it up;
 * - a live match runs a little under the clock, and the rules' own time is untouched.
 */
import { describe, expect, it } from 'vitest';
import { ABILITIES, barCombos, kitOf, PRESETS } from '../src/games/sigilfall/arena/abilities';
import { CLASS_DMG, Match, PACE, RANGED, type MatchSetup } from '../src/games/sigilfall/arena/sim';
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
    const other = new Match(setup('ranger', 'warrior'));
    const draw = ABILITIES['r-aimed']!;
    other.fighters[1]!.auras.push({ ab: 'd-hammer', kind: 'cc', cc: 'stun', src: 1, t: 2, dur: 2, harmful: true, magic: false, n: 0 });
    expect(other.comboReady(other.fighters[0]!, draw, other.fighters[1]!)?.name).toBe(draw.combo!.name);
  });

  it('every playstyle holds a combo with what sets it up, made with its basic ability or its super', () => {
    // (the owner, 2026-11-16: "combos to be done with your basic spell or even ur ult")
    for (const cls of CLASS_IDS) {
      for (const p of PRESETS[cls]) {
        const combos = barCombos(cls, p.bar, p.ult);
        expect(combos.length, `${cls} ${p.name}`).toBeGreaterThanOrEqual(1);
        const basic = p.bar[0]!;
        expect(combos.some((c) => c.from.id === basic || c.to.id === basic || c.from.id === p.ult || c.to.id === p.ult), `${cls} ${p.name}: nothing made with its basic ability or its super`).toBe(true);
        for (const c of combos) {
          if (c.kind === 'combo') expect(c.to.combo!.name).toBe(c.name);
          expect(c.from.id).not.toBe(c.to.id);
          expect(c.text.length).toBeGreaterThan(8);
          // (both ends are the playstyle's own: its four or its super)
          expect([...p.bar, p.ult]).toContain(c.from.id);
          expect([...p.bar, p.ult]).toContain(c.to.id);
        }
        // (and every combo its abilities name can be set up by something else it has)
        for (const id of [...p.bar, p.ult]) if (ABILITIES[id]!.combo) expect(combos.map((c) => c.to.id), `${cls} ${p.name}: ${id}`).toContain(id);
      }
      // (nothing in a class's kit is left off both its playstyles)
      for (const a of kitOf(cls)) expect(PRESETS[cls].some((p) => p.bar.includes(a.id)), `${cls}: ${a.name}`).toBe(true);
    }
  });

  it('each class deals its own share of its numbers, and those at range less than those at arm’s length', () => {
    for (const cls of CLASS_IDS) {
      const m = new Match(setup(cls, 'warrior'));
      expect(m.fighters[0]!.mods.dmg, cls).toBeCloseTo(CLASS_DMG[cls], 5);
      expect(CLASS_DMG[cls], cls).toBeGreaterThanOrEqual(0.6);
      expect(CLASS_DMG[cls], cls).toBeLessThanOrEqual(1);
    }
    const mean = (far: boolean): number => {
      const list = CLASS_IDS.filter((c) => RANGED.has(c) === far);
      return list.reduce((n, c) => n + CLASS_DMG[c], 0) / list.length;
    };
    // (by 0.05 or more until the warrior's share came down to 0.82 by players' word, 2026-11-17)
    expect(mean(true)).toBeLessThan(mean(false));
  });

  it('a live match runs a little under the clock', () => {
    expect(PACE).toBeGreaterThanOrEqual(0.9);
    expect(PACE).toBeLessThanOrEqual(0.95);
  });
});
