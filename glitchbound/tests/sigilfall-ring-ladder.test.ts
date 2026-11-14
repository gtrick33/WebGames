/**
 * The Ring's ladder after the owner's notes of 2026-11-14: "they could do better the higher the rate ... it should
 * progressively get harder to beat them, they should be bad when you first start and get progressively harder and
 * harder ... adjust mmr as needed for it to be like WoW's arenas".
 *
 * How sharp the computer plays climbs with the rating it is drawn at (arena/ladder.ts skillAt), and what it does with
 * that sharpness is arena/bot.ts and arena/tactics.ts. Measured on the computer playing itself, the same teams on both
 * sides, sides swapped every match (300 random matches of each format per pair, in % won by the higher rating):
 *
 *   rating (skill)                 1v1   2v2   3v3
 *   1250 (0.28) vs 1000 (0.10)      68    71    84
 *   1500 (0.45) vs 1250 (0.28)      68    77    78
 *   1750 (0.62) vs 1500 (0.45)      59    59    58
 *   2000 (0.79) vs 1750 (0.62)      63    69    64
 *   2250 (0.97) vs 2000 (0.79)      61    65    66
 *   2250 (0.97) vs 1000 (0.10)      90    96    99
 *
 * Before, the middle of the ladder was flat in 2v2 and 3v3 (1750 beat 1500 about half the time): a computer player
 * looked at its bar on a beat of its own, and some beats fell just after the global cooldown and some didn't. It now
 * looks again as the cooldown comes up (tactics.ts nextLook). In 1v1 at a fixed skill the classes win what they won
 * before, give or take a few points (tests/sigilfall-ring-aim.test.ts); 2v2 and 3v3 by
 * tests/sigilfall-ring-balance.test.ts.
 *
 * The rating is elo against the other side, with a hidden matchmaking rating beside the one shown, as rated arenas
 * keep: the other side is drawn against it, and the rating shown climbs toward it (catchUp).
 */
import { describe, expect, it } from 'vitest';
import { ABILITIES, PRESETS } from '../src/games/sigilfall/arena/abilities';
import { botThink, newBrain } from '../src/games/sigilfall/arena/bot';
import { afterMatch, catchUp, CATCH_UP, K_BASE, K_MMR_NEW, K_NEW, MATE_FLOOR, mateSkill, MMR_FLOOR, mmrOf, NEW_STANDING, PLACEMENT, RATING_FLOOR, rivalFor, skillAt, SKILL_TOP, stakesOf, type Standing } from '../src/games/sigilfall/arena/ladder';
import { MAP_IDS } from '../src/games/sigilfall/arena/maps';
import { Match, type FighterSetup, type MoveInput } from '../src/games/sigilfall/arena/sim';
import { lapse } from '../src/games/sigilfall/arena/tactics';
import { CLASS_IDS } from '../src/games/sigilfall/data/classes';
import type { ClassId } from '../src/games/sigilfall/data/types';

const seasoned: Standing = { ...NEW_STANDING, wins: 20, losses: 20 };

describe('The Ring: the computer gets sharper as the rating climbs', () => {
  it('skill never falls as the rating rises, and climbs all the way from the bottom to the top', () => {
    let last = -1;
    for (let r = 500; r <= 3000; r += 10) {
      const s = skillAt(r);
      expect(s).toBeGreaterThanOrEqual(last);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
      last = s;
    }
    // (strictly, everywhere a player can stand between the start and the top)
    for (let r = 900; r < SKILL_TOP; r += 50) expect(skillAt(r + 50)).toBeGreaterThan(skillAt(r));
    // clumsy where everyone starts, everything it has at the top
    expect(skillAt(NEW_STANDING.rating)).toBeLessThan(0.15);
    expect(skillAt(SKILL_TOP)).toBe(1);
    expect(skillAt(2100)).toBeGreaterThan(0.8);
  });

  it('a friend on your own side is never as clumsy as a newcomer’s opponents', () => {
    expect(mateSkill(800)).toBe(MATE_FLOOR);
    expect(mateSkill(2000)).toBe(skillAt(2000));
  });

  it('a newcomer stands about now and then; a sharp player almost never does', () => {
    const count = (skill: number): number => {
      const b = newBrain(7);
      let n = 0;
      for (let i = 0; i < 4000; i++) if (lapse(b, skill)) n++;
      return n / 4000;
    };
    expect(count(skillAt(1000))).toBeGreaterThan(0.15);
    expect(count(skillAt(1600))).toBeLessThan(count(skillAt(1000)));
    expect(count(1)).toBe(0);
  });
});

describe('The Ring: rating and matchmaking rating', () => {
  it('a standing kept before the matchmaking rating existed reads as its own rating, and moves as it did', () => {
    expect(mmrOf({ rating: 1234 })).toBe(1234);
    const was = afterMatch({ ...seasoned, rating: 1400, best: 1400 }, 1400, true);
    expect(was.change).toBe(K_BASE / 2);
    expect(was.next.mmr).toBe(1400 + K_BASE / 2);
  });

  it('below the matchmaking rating, wins pay more and losses cost less; above it, the other way round', () => {
    expect(catchUp(1500, 1500, true)).toBe(1);
    expect(catchUp(1500, 1500 + CATCH_UP, true)).toBe(2);
    expect(catchUp(1500, 1500 + CATCH_UP, false)).toBe(0.5);
    expect(catchUp(1500, 1300, true)).toBe(0.5);
    expect(catchUp(1500, 1300, false)).toBe(1.5);
    const behind = { ...seasoned, rating: 1300, best: 1300, mmr: 1600 };
    const even = { ...seasoned, rating: 1600, best: 1600, mmr: 1600 };
    // (against the same side: the expectation is the matchmaking rating's)
    expect(afterMatch(behind, 1600, true).change).toBeGreaterThan(afterMatch(even, 1600, true).change);
    expect(-afterMatch(behind, 1600, false).change).toBeLessThan(-afterMatch(even, 1600, false).change);
    // (what the match screen says is what happens)
    expect(stakesOf(behind, 1600)).toEqual({ win: afterMatch(behind, 1600, true).change, lose: -afterMatch(behind, 1600, false).change });
    const ahead = { ...seasoned, rating: 1700, best: 1700, mmr: 1500 };
    expect(afterMatch(ahead, 1500, true).change).toBeLessThan(K_BASE / 2);
    expect(-afterMatch(ahead, 1500, false).change).toBeGreaterThan(K_BASE / 2);
  });

  it('the matchmaking rating finds a newcomer’s level faster than the rating shown, which follows it', () => {
    let s: Standing = { ...NEW_STANDING };
    const first = afterMatch(s, 1000, true);
    expect(first.change).toBe(K_NEW / 2);
    expect(first.next.mmr).toBe(1000 + K_MMR_NEW / 2);
    // a strong newcomer winning every placement match against sides at their matchmaking rating
    for (let i = 0; i < PLACEMENT; i++) s = afterMatch(s, mmrOf(s), true).next;
    expect(mmrOf(s)).toBeGreaterThan(s.rating);
    // and then, still winning at even odds, the rating shown closes on it: each win pays more than an even one
    const gap = mmrOf(s) - s.rating;
    const next = afterMatch(s, mmrOf(s), true);
    expect(next.change).toBeGreaterThan(K_BASE / 2);
    expect(mmrOf(next.next) - next.next.rating).toBeLessThan(gap);
  });

  it('a losing run sinks the matchmaking rating below the floor the rating shown keeps, so the sides get easier', () => {
    let s: Standing = { ...seasoned, rating: 900, best: 1000 };
    for (let i = 0; i < 30; i++) s = afterMatch(s, mmrOf(s), false).next;
    expect(s.rating).toBe(RATING_FLOOR);
    expect(mmrOf(s)).toBeLessThan(RATING_FLOOR);
    expect(mmrOf(s)).toBeGreaterThanOrEqual(MMR_FLOOR);
    expect(skillAt(rivalFor(s, 150))).toBeLessThan(skillAt(rivalFor(seasoned, 150)));
  });

  it('the computer’s side is drawn either way of the matchmaking rating, up to 150', () => {
    const s = { ...seasoned, rating: 1500, best: 1500, mmr: 1700 };
    const drawn = Array.from({ length: 301 }, (_, seed) => rivalFor(s, seed));
    expect(Math.min(...drawn)).toBe(1550);
    expect(Math.max(...drawn)).toBe(1850);
  });

  it('a leaver’s loss counts against both ratings', () => {
    const s = { ...seasoned, rating: 1500, best: 1500, mmr: 1500 };
    const left = afterMatch(s, 1500, false, 1.5);
    const lost = afterMatch(s, 1500, false);
    expect(left.change).toBeLessThan(lost.change);
    expect(left.next.mmr!).toBeLessThan(lost.next.mmr!);
  });
});

/* ------------------------------------------------------------------ the bots themselves */

const STEP = 1 / 30;
type Spec = { cls: ClassId; p: number; heal: boolean };
const heals = (bar: string[]): boolean => bar.some((id) => ABILITIES[id]?.role === 'heal' && ABILITIES[id]?.aim === 'friend');
const SPECS: Spec[] = CLASS_IDS.flatMap((cls) => PRESETS[cls].map((pr, p) => ({ cls, p, heal: heals(pr.bar) })));

/** The share won by skill `a` against skill `b`, the same random team on both sides, sides swapped each match. */
function share(size: 1 | 2, a: number, b: number, games: number): number {
  let s = 99 + size;
  const rand = (): number => ((s = (s * 1664525 + 1013904223) >>> 0), s / 4294967296);
  let won = 0;
  for (let g = 0; g < games; g++) {
    const team: Spec[] = [];
    const hs = SPECS.filter((x) => x.heal);
    if (size > 1 && rand() < 0.6) team.push(hs[Math.floor(rand() * hs.length)]!);
    while (team.length < size) {
      const pool = SPECS.filter((x) => (size === 1 || !x.heal) && !team.some((o) => o.cls === x.cls));
      team.push(pool[Math.floor(rand() * pool.length)]!);
    }
    const flip = g % 2 === 1;
    const skills = flip ? [b, a] : [a, b];
    const fighters: FighterSetup[] = [0, 1].flatMap((t) => team.map((x, i) => ({ team: t as 0 | 1, cls: x.cls, name: `${x.cls}${t}${i}`, bar: PRESETS[x.cls][x.p]!.bar, talents: PRESETS[x.cls][x.p]!.talents })));
    const m = new Match({ seed: 500 + g, map: MAP_IDS[g % MAP_IDS.length]!, fighters });
    const brains = m.fighters.map((_, i) => newBrain(g * 31 + i));
    for (let i = 0; i < 30 * 300 && m.phase !== 'over'; i++) {
      const moves: Record<number, MoveInput> = {};
      for (const f of m.fighters) moves[f.id] = botThink(m, f, brains[f.id]!, skills[f.team]!, STEP);
      m.step(STEP, moves);
      m.events.length = 0;
    }
    won += m.winner === null ? 0.5 : m.winner === (flip ? 1 : 0) ? 1 : 0;
  }
  return won / games;
}

describe('The Ring: the computer at a higher rating beats the computer at a lower one', () => {
  it('the top of the ladder beats where everyone starts nearly always, and the middle sits between', () => {
    const low = skillAt(1000);
    const mid = skillAt(1600);
    const top = skillAt(2300);
    for (const size of [1, 2] as const) {
      const topLow = share(size, top, low, 24);
      const midLow = share(size, mid, low, 24);
      const topMid = share(size, top, mid, 24);
      expect(topLow, `${size}v${size} top vs start`).toBeGreaterThanOrEqual(0.8);
      expect(midLow, `${size}v${size} middle vs start`).toBeGreaterThan(0.55);
      expect(topMid, `${size}v${size} top vs middle`).toBeGreaterThan(0.5);
    }
  }, 90_000);
});
