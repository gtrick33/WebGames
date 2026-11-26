/**
 * The Vigil's classes are even (the owner, 2026-11-26: "run balance check for every class and keep them in the 48-52%
 * win rate zone ... deviation up to 5% is ok"). The Vigil has no win as the Ring has, so the measure is its own mark:
 * **a night is won when it is held five minutes**, which is what opens the next land and is each class's deed. One bot
 * keeps many nights with each class in the first land (it runs from what is near, dashes when hemmed in, and takes a
 * card at random, so no build is favored), and each class's edge (kit.ts's CLASS_EDGE) is found so that about half of
 * its nights are won.
 *
 *   VIGIL_TUNE=mage VIGIL_OUT=<file> npx vitest run --no-fsModuleCache tests/sigilfall-vigil-balance   finds one class's edge
 *   VIGIL_BALANCE=<file> [VIGIL_CLASS=mage] npx vitest run …                                         the table, on other nights
 *
 * Run as part of the suite it keeps a few nights with each class and holds them to a wide band: enough to catch a
 * class knocked far out of line by a later change, not enough to prove the narrow one (that takes hundreds of nights
 * a class: the table).
 */
import { appendFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CLASS_IDS } from '../src/games/sigilfall/data/classes';
import type { ClassId } from '../src/games/sigilfall/data/types';
import { CLASS_EDGE, UNLOCK_HOLD } from '../src/games/sigilfall/vigil/kit';
import { Vigil, type VigilInput } from '../src/games/sigilfall/vigil/sim';

const TUNE = process.env.VIGIL_TUNE as ClassId | undefined;
const TABLE = process.env.VIGIL_BALANCE;
const ONLY = process.env.VIGIL_CLASS as ClassId | undefined;
const OUT = process.env.VIGIL_OUT;
const N = Number(process.env.VIGIL_N) || (TUNE ? 160 : TABLE ? 300 : 24);
/** The nights the edges were found on, the other nights the table is made from, and the suite's few. */
const FIRST = Number(process.env.VIGIL_FIRST) || (TUNE ? 1000 : TABLE ? 50_000 : 9000);

const dice = (seed: number, n: number): number => {
  let h = (Math.imul(seed + 77, 0x9e3779b1) ^ Math.imul(n + 1, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
};

/** One night with the bot: whether it was held five minutes, and how long it lasted if not. */
function night(cls: ClassId, seed: number): number {
  const v = new Vigil(seed, 2000, 2000, { cls });
  let picks = 0;
  for (let t = 0; t < UNLOCK_HOLD && !v.over; t += 1 / 30) {
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
  return v.over ? v.t : UNLOCK_HOLD;
}

/** The share of a class's nights that were won, and their median length. */
function rate(cls: ClassId, n = N, first = FIRST): { won: number; median: number } {
  const times = Array.from({ length: n }, (_, i) => night(cls, first + i)).sort((a, b) => a - b);
  return { won: times.filter((t) => t >= UNLOCK_HOLD).length / n, median: times[Math.floor(n / 2)]! };
}

describe('The Vigil: the classes are even', () => {
  if (TUNE) {
    it(`finds ${TUNE}'s edge`, () => {
      // between half and two and a half times, halving the gap each time: more edge, more nights won
      let lo = Math.log(0.5);
      let hi = Math.log(2.6);
      const tried: [number, number][] = [];
      for (let i = 0; i < 8; i++) {
        const mid = (lo + hi) / 2;
        CLASS_EDGE[TUNE] = Math.exp(mid);
        const r = rate(TUNE);
        tried.push([Math.round(Math.exp(mid) * 1000) / 1000, Math.round(r.won * 1000) / 10]);
        if (r.won > 0.5) hi = mid;
        else lo = mid;
      }
      // (the nearest to half of those tried)
      const best = tried.reduce((a, b) => (Math.abs(b[1] - 50) < Math.abs(a[1] - 50) ? b : a));
      const line = JSON.stringify({ cls: TUNE, edge: best[0], won: best[1], nights: N, tried });
      if (OUT) appendFileSync(OUT, `${line}\n`);
      console.info(line);
      expect(Math.abs(best[1] - 50)).toBeLessThan(8);
    }, 3_600_000);
    return;
  }

  it(`with the bot, every class holds five minutes in about half its nights (${N} each)`, () => {
    const rows: string[] = ['| Class | Edge | Health | Nights | Held five minutes | Median night (s) |', '| --- | --- | --- | --- | --- | --- |'];
    const out: Record<string, number> = {};
    for (const cls of CLASS_IDS) {
      if (ONLY && cls !== ONLY) continue;
      const r = rate(cls);
      out[cls] = r.won;
      rows.push(`| ${cls} | ${CLASS_EDGE[cls]} | ${Math.round(new Vigil(1, 0, 0, { cls }).maxHp)} | ${N} | ${Math.round(r.won * 1000) / 10}% | ${Math.round(r.median)} |`);
    }
    if (TABLE) (ONLY ? appendFileSync : writeFileSync)(TABLE, `${(ONLY ? rows.slice(2) : rows).join('\n')}\n`);
    // the table's band is the owner's (45% to 55%); the suite's few nights can only hold a wider one
    const [low, high] = TABLE ? [0.45, 0.55] : [0.25, 0.75];
    for (const [cls, won] of Object.entries(out)) {
      expect(won, `${cls} holds five minutes too seldom`).toBeGreaterThanOrEqual(low);
      expect(won, `${cls} holds five minutes too often`).toBeLessThanOrEqual(high);
    }
  }, 3_600_000);
});
