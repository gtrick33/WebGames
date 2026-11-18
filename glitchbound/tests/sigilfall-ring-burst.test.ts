/**
 * The Ring's fights in bursts (the owner, 2026-11-18): "currently the combat feels too erm slow, can we make it more
 * bursty, especially with the combos, healing should also increase but mostly from the special combo spells or ults,
 * i want more dynamic bursty combat rather than slow steady one, e.g. bursting a player for a stun duration should be
 * possible if everything is set up properly as long as its not unfair to healers".
 *
 * What changed: every combo that deals or heals "N% more" does half again as much more (Flashover 70% -> 155%, Final
 * Verdict 80% -> 135%, a healer's combo heals 30% -> 95%); every super deals and heals half again as much; a burst
 * ability (a big cooldown) hits 1.5 times its number, not 1.25. The steady blows and the steady heals are as they were.
 * The druid deals 0.83 of its numbers (was 0.85: its combos and supers carried it to 64% of its duels). Shatter, at
 * x3.3 by the owner's word the day before, is as it was.
 *
 * Measured between computers (sharp, 0.85), before -> after:
 *   1v1  a match 37 s -> 25 s; the most anyone lost in 2.5 s 28% -> 39% of their health; who lost over 60% of it in
 *        2.5 s 0% -> 8%
 *   2v2  58 s -> 42 s; 29% -> 39%; 1% -> 17%; healing to damage 0.28 -> 0.27
 *   3v3  60 s -> 46 s; 33% -> 45%; 5% -> 24%; healing to damage 0.35 -> 0.33
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
    expect(BURST_K).toBe(1.5);
    expect(ABILITIES['m-burn']!.combo!.mult).toBe(2.55);
    const combos = Object.values(ABILITIES).filter((a) => a.combo && /% more/.test(a.combo.text));
    expect(combos.length).toBeGreaterThan(15);
    for (const a of combos) {
      expect(a.combo!.mult, a.id).toBeGreaterThanOrEqual(1.95);
      // (its words say what it does)
      expect(a.combo!.text, a.id).toContain(`${Math.round((a.combo!.mult - 1) * 100)}% more`);
    }
    expect(combos.some((a) => /^Heals/.test(a.combo!.text))).toBe(true);
  });

  it('in 2v2 a set-up burst takes a fighter most of the way in a stun’s time, and the healing keeps pace', () => {
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
    expect(biggest / seen).toBeGreaterThan(0.34);
    expect(big / seen).toBeGreaterThan(0.08);
    expect(heal / dmg).toBeGreaterThan(0.22);
  }, 120_000);
});
