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
 * When the talents became each class's own (2026-11-13, "please make them very unique"), every talent was measured
 * against the other two in its row, in 1v1 and in 2v2 (a healer's on its healer's build), on the same seeds, and tuned
 * until each row's three came within a few points of each other where they are meant to be used (a team talent, an
 * aura or Skypiercer, shows little in 1v1). Two changes outside the talents: the mage deals 0.72 of its numbers (was
 * 0.74; its new talents carry it further in a duel than in a team), and the priest's Knit Wounds heals 86 (was 95; its
 * healing build won 68% of 2v2s, against 60% for the paladin's). Classes, in % won (1v1 by
 * tests/sigilfall-ring-aim.test.ts, then 2v2 / 3v3 here), before -> after:
 *
 *   warrior 42/46/54 -> 46/49/54   mage    50/45/45 -> 60/46/44   ranger  50/42/45 -> 43/45/47   paladin     50/57/49 -> 53/57/52
 *   priest  49/61/61 -> 42/57/54   warlock 52/45/48 -> 49/44/47   druid   49/54/52 -> 49/53/51   gloamknight 58/44/44 -> 57/44/50
 *
 * Then each ready-made setup on its own, with the new talents: every one of the sixteen played every other in 1v1 and in
 * random 2v2 and 3v3 teams, and each setup's own abilities (never one it shares with its class's other setup) were
 * scaled until its wins over the three came to about half, a healer's about 55% in teams (a healer in 1v1, with
 * nobody to heal, still loses most). The Reaper's Festering Gash and Hurled Maul 15% weaker; the Lifegiver's Knit
 * Wounds, Dawnlight and Ward of Faith 7-15% weaker, the Oathkeeper's Dawn's Touch 10%; the Hound's bleed and Hock
 * Cut, the Rime's spear and shards, the Trapper's Hobbling Shot and Serpent Volley, the Zealot's Oath Blow and Wave
 * of Dawn, the Doomcaller's bolt and Ruin and the Bloodsworn's blows 6-18% stronger, the Curse-speaker's 6% weaker.
 * Each setup's 1v1 / 2v2 / 3v3, and the mean of the three, after:
 *
 *   Reaper      46/53/61 54   Hound     52/49/47 49   Pyre         63/48/47 53   Rime        66/42/45 51
 *   Longbow     57/41/47 48   Trapper   60/47/49 52   Oathkeeper   24/60/53 46   Zealot      57/46/48 50
 *   Lifegiver   17/59/54 43   Curse-sp. 45/55/51 50   Hexer        67/44/43 51   Doomcaller  49/47/50 49
 *   Grovekeeper 25/55/57 45   Starseer  62/48/42 51   Bloodsworn   59/45/44 49   Dreadbinder 53/44/55 51
 *
 * Then the Gloamknight became a death knight or a blade in the dark, and the ashbound dead the warlock's (2026-11-14, a
 * friend of the owner's: "typical dk and a shadow rogue, leave summons for a necro warlock spec"): the Dreadbinder gave
 * way to the Nightblade, who hides, and the Doomcaller to the Gravecaller, who raises the dead. Their numbers were set
 * the same way, over 12 seeds of every 1v1 and 900 random teams of each size. Each new setup, and the one beside it:
 *
 *   Nightblade  44/50/60 51   Gravecaller 71/46/44 54   Bloodsworn   69/43/42 51   Hexer       67/43/44 51
 *
 * The owner then asked for the Gravecaller to win fewer duels. What carried it there was the slow on its dead's claws
 * (without it: 37/40/38); at 10%, not 20%, it came to 61/52/47 53.
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
