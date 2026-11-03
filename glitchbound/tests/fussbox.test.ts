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
  NEAR_MISS_FROM,
  resultLine,
  scoreOf,
  type Level,
  type Rule,
  ATTRS,
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

describe('Fussbox exams test the whole rule (FB-02)', () => {
  const singles: Rule[] = [...ATTRS.flatMap((a) => [0, 1, 2].map((v): Rule => ({ t: 'is', a, v }))), { t: 'corners', op: 'atLeast', n: 6 }, { t: 'corners', op: 'atLeast', n: 8 }, { t: 'corners', op: 'odd', n: 0 }];
  const halves = [...singles, ...singles.map((r): Rule => ({ t: 'not', r }))];
  /** A rival that fits the examples, isn't the rule, and still gets all eight exam cards right. */
  const aces = (r: ReturnType<typeof makeRound>, h: Rule): boolean =>
    r.liked.every((id) => likes(h, cardOf(id))) &&
    r.hated.every((id) => !likes(h, cardOf(id))) &&
    ALL_CARDS.some((id) => likes(h, cardOf(id)) !== likes(r.rule, cardOf(id))) &&
    r.exam.every((id) => likes(h, cardOf(id)) === likes(r.rule, cardOf(id)));

  it('no single property that fits the four examples aces the exam', () => {
    let aced = 0;
    for (let seed = 1; seed <= 1200; seed++) {
      const r = makeRound(seed * 2654435761, (((seed * 3) % 4) + 1) as Level);
      if (halves.some((h) => aces(r, h))) aced++;
    }
    expect(aced).toBeLessThanOrEqual(2); // was about 1 round in 5
  });

  it('daily #11 (“two symbols and not solid”) now has to be cracked whole', () => {
    // The same rule from 2026-10-29, with this round's own exam: a hated card has two symbols.
    const old = dailyRound('2026-10-29', hashString);
    const now = makeRound(old.seed, old.level);
    expect(halves.some((h) => aces(old, h))).toBe(true);
    expect(halves.some((h) => aces(now, h))).toBe(false);
  });

  it('dailies before the change keep the exam they always had', () => {
    expect(NEAR_MISS_FROM > '2026-11-03').toBe(true);
    const snap = { '2026-10-29': [53, 65, 28, 44, 38, 15, 47, 77], '2026-11-02': [35, 76, 5, 33, 3, 61, 63, 18], '2026-11-22': [39, 5, 68, 29, 38, 52, 14, 27] };
    for (const [day, exam] of Object.entries(snap)) expect(dailyRound(day, hashString).exam, day).toEqual(exam);
    const later = dailyRound(NEAR_MISS_FROM, hashString);
    expect(later).toEqual(makeRound(later.seed, later.level, true));
  });
});

describe('Fussbox reveal text reads one way only (FB-04)', () => {
  const pink: Rule = { t: 'is', a: 'colour', v: 0 };
  const circles: Rule = { t: 'is', a: 'shape', v: 0 };
  const not = (r: Rule): Rule => ({ t: 'not', r });
  it('puts the plain part first and says “neither” for two “not”s', () => {
    expect(say({ t: 'or', l: not(pink), r: circles }, 'en')).toBe('circles or not pink');
    expect(say({ t: 'and', l: not(pink), r: circles }, 'en')).toBe('circles and not pink');
    expect(say({ t: 'and', l: not(pink), r: not(circles) }, 'en')).toBe('neither pink nor circles');
    expect(say({ t: 'or', l: not(pink), r: not(circles) }, 'en')).toBe('not both pink and circles');
    expect(say({ t: 'or', l: not(pink), r: circles }, 'bg')).toBe('кръгове или не розово');
    expect(say({ t: 'and', l: not(pink), r: not(circles) }, 'bg')).toBe('нито розово, нито кръгове');
  });

  it('no rule the game makes starts its reveal with a bare “not … and/or”', () => {
    for (let seed = 1; seed <= 1500; seed++) {
      const r = makeRound(seed * 7919, (((seed * 5) % 4) + 1) as Level);
      expect(say(r.rule, 'en')).not.toMatch(/^not \S+( \S+)? (and|or) /);
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
