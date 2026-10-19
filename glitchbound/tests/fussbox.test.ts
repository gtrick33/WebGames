import { describe, expect, it } from 'vitest';
import { addDays, hashString } from '../src/platform/dates';
import {
  ALL_CARDS,
  cardId,
  cardOf,
  correctOf,
  dailyRound,
  EXAM_SIZE,
  levelFor,
  likedCount,
  likes,
  makeRound,
  MAX_SCORE,
  resultLine,
  scoreOf,
  type Level,
} from '../src/games/fussbox/logic';
import { describe as say } from '../src/games/fussbox/words';

describe('Fussbox cards', () => {
  it('has 81 different cards that round-trip through their ids', () => {
    expect(new Set(ALL_CARDS.map((id) => JSON.stringify(cardOf(id)))).size).toBe(81);
    for (const id of ALL_CARDS) expect(cardId(cardOf(id))).toBe(id);
  });
});

describe('Fussbox rounds', () => {
  it('the same seed gives the same round; the daily is the same for everyone', () => {
    expect(makeRound(123, 3)).toEqual(makeRound(123, 3));
    expect(dailyRound('2026-10-21', hashString)).toEqual(dailyRound('2026-10-21', hashString));
    expect(dailyRound('2026-10-21', hashString)).not.toEqual(dailyRound('2026-10-22', hashString));
  });

  it('gets fussier through the week: Mon–Tue 1, Wed–Thu 2, Fri–Sat 3, Sun 4', () => {
    // 2026-10-19 is a Monday.
    expect([0, 1, 2, 3, 4, 5, 6].map((d) => levelFor(addDays('2026-10-19', d)))).toEqual([1, 1, 2, 2, 3, 3, 4]);
  });

  it('every rule is fair, every example and exam card is right and different, the exam is mixed', () => {
    for (let seed = 1; seed <= 1500; seed++) {
      const level = ((seed % 4) + 1) as Level;
      const r = makeRound(seed * 2654435761, level);
      const n = likedCount(r.rule);
      expect(n, `seed ${seed}`).toBeGreaterThanOrEqual(9);
      expect(n, `seed ${seed}`).toBeLessThanOrEqual(70);
      for (const id of r.liked) expect(likes(r.rule, cardOf(id))).toBe(true);
      for (const id of r.hated) expect(likes(r.rule, cardOf(id))).toBe(false);
      const all = [...r.liked, ...r.hated, ...r.exam];
      expect(new Set(all).size, `seed ${seed}`).toBe(4 + EXAM_SIZE);
      const yes = r.exam.filter((id) => likes(r.rule, cardOf(id))).length;
      expect(yes, `seed ${seed}`).toBeGreaterThanOrEqual(3);
      expect(yes, `seed ${seed}`).toBeLessThanOrEqual(5);
    }
  });

  it('every rule can be put into words, in English and Bulgarian', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const r = makeRound(seed, (((seed * 7) % 4) + 1) as Level);
      expect(say(r.rule, 'en')).toMatch(/^[a-z(]/);
      expect(say(r.rule, 'bg')).toMatch(/[а-я]/);
    }
  });
});

describe('Fussbox scoring', () => {
  it('pays 100 a right answer plus a bonus for few tests, never above the maximum', () => {
    expect(scoreOf(8, 0)).toBe(MAX_SCORE);
    expect(scoreOf(8, 3)).toBe(1000);
    expect(scoreOf(8, 8)).toBe(800 + 100);
    expect(scoreOf(8, 13)).toBe(800);
    expect(scoreOf(8, 40)).toBe(800);
    expect(scoreOf(4, 0)).toBe(400 + 100);
    expect(scoreOf(0, 0)).toBe(0);
  });

  it('marks the exam and writes a spoiler-free share line', () => {
    const r = makeRound(99, 2);
    const right = r.exam.map((id) => likes(r.rule, cardOf(id)));
    expect(correctOf(r, right)).toBe(8);
    const flipped = right.map((x, i) => (i < 2 ? !x : x));
    expect(correctOf(r, flipped)).toBe(6);
    expect(resultLine(r, flipped)).toBe('🟥🟥🟩🟩🟩🟩🟩🟩');
    expect(correctOf(r, right.map(() => null))).toBe(0);
  });
});
