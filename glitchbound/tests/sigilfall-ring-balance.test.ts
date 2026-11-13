/**
 * The Ring in 2v2 and 3v3, after the owner's notes of 2026-11-13: "can we go over every single class for balancing,
 * currently it feels like some classes are stronger than others in 1v1, 2v2 and 3v3 ... increase the healing a tad bit
 * more for the healers in the 2v2/3v3 and probably increase the dmg of the dot warlock spec ... keep in mind that when
 * players play, they line of sight behind pillars, sometimes they hide".
 *
 * How it was done: the computer played every ready-made setup (sixteen, two a class) against every other in 1v1, and
 * 6,000 random teams in each of 2v2 and 3v3 (no class twice on a side; most teams bring a healer), with sharp players
 * hiding behind stone when hurt by a caster (arena/bot.ts, pillar play). Each setup's own abilities were then scaled
 * until its wins over the three formats together came to about half (a healer's: about 55% in 2v2 and 3v3, since a
 * person heals less well than the computer does). What changed and what it measured afterwards, in % of matches won
 * (1v1 / 2v2 / 3v3):
 *
 *   Hexer (the curse warlock)  32 / 35 / 36  ->  60 / 45 / 42   curses 40% stronger, Dread Gaze 2 s -> 1.5 s
 *   Doomcaller                 68 / 62 / 58  ->  50 / 52 / 53   Gloom Bolt and Ruin 20% weaker
 *   Trapper                    47 / 34 / 34  ->  67 / 41 / 40   Serpent Volley almost twice as strong, trap combo x3 -> x1.8
 *   Longbow                    65 / 58 / 58  ->  53 / 46 / 50
 *   Hound                      47 / 37 / 38  ->  61 / 44 / 44   Rending Cut and Hock Cut almost twice as strong
 *   Reaper                     51 / 60 / 70  ->  41 / 48 / 60   Festering Gash cuts healing 35% (was half), x1.25 on the stunned
 *   Bloodsworn                 67 / 45 / 46  ->  60 / 42 / 45   drinks far less of its blows, deals 0.9 (was 0.84)
 *   healing in 2v2 / 3v3       +20% / +35%   ->  +30% / +45%     (the priest's Knit Wounds 12% less: it led by far)
 *
 * The computer is not a person, so this guards against a change that tips a class far over, no more. (Healers in 1v1,
 * where they have nobody to heal, win a quarter of their matches: a healer's setup is for team fights.)
 *
 * When the talents became each class's own (2026-11-13, "please make them very unique"), each was measured in the
 * ready-made builds against its row's other two, and the ones far ahead or behind were tuned (Pit Imp, Mana Skin,
 * Verdict of Light, Light Returned, Halo of Dread, Forager, Soul Shield, Open Heart, Sapping Word). Classes, in % won
 * (1v1 by tests/sigilfall-ring-aim.test.ts, then 2v2 / 3v3 here), before -> after:
 *
 *   warrior 42/46/54 -> 47/51/54   mage    50/45/45 -> 54/42/44   ranger  50/42/45 -> 45/44/44   paladin     50/57/49 -> 49/55/53
 *   priest  49/61/61 -> 49/62/58   warlock 52/45/48 -> 52/47/43   druid   49/54/52 -> 56/51/51   gloamknight 58/44/44 -> 47/43/51
 */
import { describe, expect, it } from 'vitest';
import { ABILITIES, PRESETS } from '../src/games/sigilfall/arena/abilities';
import { botThink, newBrain } from '../src/games/sigilfall/arena/bot';
import { MAP_IDS } from '../src/games/sigilfall/arena/maps';
import { Match, type FighterSetup, type MoveInput } from '../src/games/sigilfall/arena/sim';
import { CLASS_IDS } from '../src/games/sigilfall/data/classes';
import type { ClassId } from '../src/games/sigilfall/data/types';

const STEP = 1 / 30;
type Spec = { cls: ClassId; p: number; heal: boolean };
const heals = (bar: string[]): boolean => bar.some((id) => ABILITIES[id]?.role === 'heal' && ABILITIES[id]?.aim === 'friend');
const SPECS: Spec[] = CLASS_IDS.flatMap((cls) => PRESETS[cls].map((pr, p) => ({ cls, p, heal: heals(pr.bar) })));

function shares(size: 2 | 3, games: number): Record<string, number> {
  let s = 777 + size;
  const rand = (): number => ((s = (s * 1664525 + 1013904223) >>> 0), s / 4294967296);
  const team = (): Spec[] => {
    const out: Spec[] = [];
    if (rand() < (size === 3 ? 0.8 : 0.6)) {
      const hs = SPECS.filter((x) => x.heal);
      out.push(hs[Math.floor(rand() * hs.length)]!);
    }
    while (out.length < size) {
      const pool = SPECS.filter((x) => !x.heal && !out.some((o) => o.cls === x.cls));
      out.push(pool[Math.floor(rand() * pool.length)]!);
    }
    return out;
  };
  const won: Record<string, number> = {};
  const played: Record<string, number> = {};
  for (let g = 1; g <= games; g++) {
    const sides = [team(), team()];
    const fighters: FighterSetup[] = sides.flatMap((list, t) => list.map((x, i) => ({ team: t as 0 | 1, cls: x.cls, name: `${x.cls}${t}${i}`, bar: PRESETS[x.cls][x.p]!.bar, talents: PRESETS[x.cls][x.p]!.talents })));
    const m = new Match({ seed: g, map: MAP_IDS[g % MAP_IDS.length]!, fighters });
    const brains = m.fighters.map((_, i) => newBrain(g * 31 + i));
    const skill = [0.6, 0.9, 0.75][g % 3]!;
    for (let i = 0; i < 30 * 400 && m.phase !== 'over'; i++) {
      const moves: Record<number, MoveInput> = {};
      for (const f of m.fighters) moves[f.id] = botThink(m, f, brains[f.id]!, skill, STEP);
      m.step(STEP, moves);
      m.events.length = 0;
    }
    sides.forEach((list, t) => {
      for (const c of new Set(list.map((x) => x.cls))) {
        played[c] = (played[c] ?? 0) + 1;
        won[c] = (won[c] ?? 0) + (m.winner === null ? 0.5 : m.winner === t ? 1 : 0);
      }
    });
  }
  return Object.fromEntries(Object.keys(played).map((c) => [c, won[c]! / played[c]!]));
}

describe('The Ring: no class far above or below the rest in team fights', () => {
  for (const size of [2, 3] as const) {
    it(`${size}v${size}: each class wins between 38% and 64% when the computer plays random teams`, () => {
      const got = shares(size, 900);
      for (const c of CLASS_IDS) {
        expect(got[c], `${c} ${Math.round(got[c]! * 100)}%`).toBeGreaterThan(0.38);
        expect(got[c], `${c} ${Math.round(got[c]! * 100)}%`).toBeLessThan(0.64);
      }
    }, 120_000);
  }
});
