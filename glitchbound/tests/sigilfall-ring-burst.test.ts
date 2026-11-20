/**
 * The Ring's fights in bursts (the owner, 2026-11-18): "currently the combat feels too erm slow, can we make it more
 * bursty, especially with the combos, healing should also increase but mostly from the special combo spells or ults,
 * i want more dynamic bursty combat rather than slow steady one, e.g. bursting a player for a stun duration should be
 * possible if everything is set up properly as long as its not unfair to healers".
 *
 * What changed: every combo that deals or heals "N% more" deals or heals a quarter more than it did (Flashover 70% ->
 * 110%, Final Verdict 80% -> 125%, a healer's combo heals 30% -> 60%); every super deals and heals a quarter more; a
 * burst ability (a big cooldown) hits 1.35 times its number, not 1.25. The steady blows and the steady heals are as
 * they were. Shatter, at x3.3 by the owner's word the day before, is as it was. (Half again, for a day, was too much:
 * the owner, "noo this is too much 1v1s are broken, lets reduce the dmg a little bit".)
 *
 * Measured between computers (sharp, 0.85), before -> after (and at half again, the day it was too much):
 *   1v1  a match 37 s -> 31 s (25 s); the most anyone lost in 2.5 s 28% -> 33% (39%) of their health; who lost over
 *        60% of it in 2.5 s 0% -> 2% (8%)
 *   2v2  58 s -> 49 s (42 s); 29% -> 34% (39%); 1% -> 6% (17%); healing to damage 0.28 -> 0.28
 *   3v3  60 s -> 54 s (46 s); 33% -> 38% (45%); 5% -> 10% (24%); healing to damage 0.35 -> 0.35
 * Every class still wins between 38% and 64% of its matches in each format (tests/sigilfall-ring-balance.test.ts,
 * tests/sigilfall-ring-aim.test.ts), the healers' setups included.
 */
import { describe, expect, it } from 'vitest';
import { ABILITIES, PRESETS } from '../src/games/sigilfall/arena/abilities';
import { botThink, newBrain } from '../src/games/sigilfall/arena/bot';
import { MAP_IDS } from '../src/games/sigilfall/arena/maps';
import { BURST_K, Match, type FighterSetup, type MoveInput } from '../src/games/sigilfall/arena/sim';
import { CLASS_IDS } from '../src/games/sigilfall/data/classes';

const STEP = 1 / 30;

describe('The Ring fights in bursts', () => {
  it('combos, supers and burst abilities hit hard, and what a combo or a super heals with them', () => {
    expect(BURST_K).toBe(1.35);
    expect(ABILITIES['m-burn']!.combo!.mult).toBe(2.1);
    const combos = Object.values(ABILITIES).filter((a) => a.combo && /% more/.test(a.combo.text));
    expect(combos.length).toBeGreaterThan(15);
    for (const a of combos) {
      // (the Pyre's Cinder Comet the one below: its Conflagration cut to 35% more, the owner, 2026-11-20, as the comet
      // on a Kindled target took most of a life in one blow)
      expect(a.combo!.mult, a.id).toBeGreaterThanOrEqual(a.id === 'm-super' ? 1.35 : 1.6);
      // (its words say what it does)
      expect(a.combo!.text, a.id).toContain(`${Math.round((a.combo!.mult - 1) * 100)}% more`);
    }
    expect(combos.some((a) => /^Heals/.test(a.combo!.text))).toBe(true);
  });

  it('in 2v2 a set-up burst takes a big bite in a stun’s time, and the healing keeps pace', () => {
    let r = 11;
    const rand = (): number => (r = (r * 1664525 + 1013904223) >>> 0) / 2 ** 32;
    const specs = CLASS_IDS.flatMap((cls) => PRESETS[cls].map((p) => ({ cls, p })));
    let biggest = 0;
    let big = 0;
    let seen = 0;
    let heal = 0;
    let dmg = 0;
    for (let g = 0; g < 40; g++) {
      const fighters: FighterSetup[] = [];
      for (const team of [0, 1] as const) {
        const a = specs[Math.floor(rand() * specs.length)]!;
        let b = specs[Math.floor(rand() * specs.length)]!;
        while (b.cls === a.cls) b = specs[Math.floor(rand() * specs.length)]!;
        for (const x of [a, b]) fighters.push({ team, cls: x.cls, name: `${x.p.name}${team}`, bar: x.p.bar, talents: x.p.talents, ult: x.p.ult });
      }
      const m = new Match({ seed: g + 1, map: MAP_IDS[g % MAP_IDS.length]!, fighters, gates: 1 });
      const brains = m.fighters.map((_, i) => newBrain(g * 31 + i));
      const hist: number[][] = [[], [], [], []];
      for (let i = 0; i < 30 * 200 && m.phase !== 'over'; i++) {
        const moves: Record<number, MoveInput> = {};
        for (const f of m.fighters) moves[f.id] = botThink(m, f, brains[f.id]!, 0.85, STEP);
        m.step(STEP, moves);
        m.fighters.slice(0, 4).forEach((f, j) => hist[j]!.push(f.hp / f.maxHp));
      }
      const W = Math.round(2.5 * 30);
      for (const h of hist) {
        let most = 0;
        for (let i = W; i < h.length; i++) most = Math.max(most, h[i - W]! - h[i]!);
        biggest += most;
        if (most > 0.6) big++;
        seen++;
      }
      for (const f of m.fighters.slice(0, 4)) {
        heal += f.score.heal;
        dmg += f.score.dmg;
      }
    }
    expect(biggest / seen).toBeGreaterThan(0.3);
    expect(big / seen).toBeGreaterThan(0.02);
    // (and not the day it was too much: a fight is still a fight)
    expect(big / seen).toBeLessThan(0.14);
    expect(heal / dmg).toBeGreaterThan(0.22);
  }, 120_000);
});
