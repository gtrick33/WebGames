/**
 * The Vigil's builds (the owner, 2026-11-25: "add quite some more options for each class ... make sure its replayable"):
 * with ten spells a class and five places for them, two nights with one class should end with different spells, and no
 * one spell should be the answer every time. A bot that plays the same way every night (runs from what is near, dashes
 * out of a corner, takes a card at random) keeps many nights with each class; what it ended with and how long it held
 * are counted. `VIGIL_BUILDS=<file>` writes the whole table (docs/review/sf9-vigil-spells/builds.md was made so).
 */
import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CLASS_IDS } from '../src/games/sigilfall/data/classes';
import type { ClassId } from '../src/games/sigilfall/data/types';
import { SPELL_SLOTS, SPELLS, spellsOf } from '../src/games/sigilfall/vigil/kit';
import { Vigil, type VigilInput } from '../src/games/sigilfall/vigil/sim';

const OUT = process.env.VIGIL_BUILDS;
const SEEDS = OUT ? 40 : 8;
/** A night is stopped here: long enough for five spells to be chosen, and for the table, to say who was still standing. */
const CAP = OUT ? 600 : 300;
/** What fell short, said together at the end so the table is whole. */
const wrong: string[] = [];
const hold = (ok: boolean, what: string): void => {
  if (!ok) wrong.push(what);
};

/** A number from 0 to 1 for the nth choice of a night: the bot's own dice, apart from the night's. */
const dice = (seed: number, n: number): number => {
  let h = (Math.imul(seed + 77, 0x9e3779b1) ^ Math.imul(n + 1, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
};

interface Night {
  t: number;
  spells: string[];
  evolved: string[];
}

function night(cls: ClassId, seed: number): Night {
  const v = new Vigil(seed, 2000, 2000, { cls });
  let picks = 0;
  for (let t = 0; t < CAP && !v.over; t += 1 / 30) {
    if (v.cards) v.choose(Math.floor(dice(seed, picks++) * v.cards.length));
    let ax = 0;
    let ay = 0;
    let close = 0;
    for (const f of v.foes) {
      const d = Math.hypot(v.x - f.x, v.y - f.y) || 1;
      if (d < 70) {
        ax += (v.x - f.x) / d / d;
        ay += (v.y - f.y) / d / d;
        if (d < 34) close++;
      }
    }
    const input: VigilInput = { mx: ax * 40 + Math.cos(t * 0.5) * 0.3, my: ay * 40 + Math.sin(t * 0.5) * 0.3, dash: close >= 3 };
    v.step(1 / 30, input);
  }
  return { t: v.t, spells: Object.keys(v.spells).sort(), evolved: [...v.evolved].sort() };
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)]! : 0;
};

describe('The Vigil: builds differ', () => {
  it('a class’s nights end with different spells, every spell gets held, and none is the answer every time', () => {
    const lines: string[] = ['| Class | Spell | Kind | Nights held in | Reached 5:00 with it | Reached 5:00 without it |', '| --- | --- | --- | --- | --- | --- |'];
    const summary: string[] = ['| Class | Nights | Different sets of spells | Median night (s) | Reached 5:00 | Nights with an evolution |', '| --- | --- | --- | --- | --- | --- |'];
    const five = (ns: Night[]): string => (ns.length ? `${Math.round((ns.filter((n) => n.t >= 300).length / ns.length) * 100)}% of ${ns.length}` : '–');
    let neverAll = 0;
    for (const cls of CLASS_IDS) {
      const nights = Array.from({ length: SEEDS }, (_, i) => night(cls, 100 + i));
      const all = median(nights.map((n) => n.t));
      const sets = new Set(nights.map((n) => n.spells.join(' ')));
      summary.push(`| ${cls} | ${SEEDS} | ${sets.size} | ${Math.round(all)} | ${five(nights)} | ${nights.filter((n) => n.evolved.length).length} |`);
      // nearly every night ends with a set of spells no other night had
      hold(sets.size >= Math.floor(SEEDS * 0.7), `${cls}: only ${sets.size} different sets of spells in ${SEEDS} nights`);
      const first = spellsOf(cls)[0]!.id;
      let never = 0;
      for (const def of spellsOf(cls)) {
        const with_ = nights.filter((n) => n.spells.includes(def.id));
        const without = nights.filter((n) => !n.spells.includes(def.id));
        lines.push(`| ${cls} | ${def.name}${def.id === first ? ' (first)' : ''} | ${def.kind} | ${Math.round((with_.length / SEEDS) * 100)}% | ${five(with_)} | ${five(without)} |`);
        if (def.id === first) continue;
        if (!with_.length) never++;
        // none is in nearly every night's five
        hold(with_.length / SEEDS < 0.9, `${cls}: ${def.name} is in nearly every night`);
      }
      // nearly every spell ends up in some night's five (with few nights, one may miss out)
      neverAll += never;
      if (OUT) hold(never === 0, `${cls}: ${never} spells were never held`);
      // (a night's five places are filled from ten, whatever the class)
      for (const n of nights) expect(n.spells.length).toBeLessThanOrEqual(SPELL_SLOTS);
      for (const n of nights) for (const id of n.spells) expect(SPELLS[id]!.cls).toBe(cls);
    }
    if (OUT) writeFileSync(OUT, `${summary.join('\n')}\n\n${lines.join('\n')}\n`);
    // (with few nights a spell may miss out in a class that falls early; across all of them, few do)
    hold(neverAll <= 8, `${neverAll} of 72 spells were never held`);
    expect(wrong).toEqual([]);
  }, 900_000);
});
